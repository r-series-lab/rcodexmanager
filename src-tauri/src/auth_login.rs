use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::io::Read;
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use std::thread;
use std::time::{Duration, Instant};

const AUTH_LOGIN_START_TIMEOUT: Duration = Duration::from_secs(10);
const AUTH_LOGIN_BROWSER_TTL_SECONDS: i64 = 10 * 60;
const AUTH_LOGIN_DEVICE_TTL_SECONDS: i64 = 15 * 60;
const AUTH_LOGIN_OUTPUT_LIMIT: usize = 64 * 1024;
const AUTH_LOGIN_FINISHED_RETENTION_SECONDS: i64 = 30 * 60;

static AUTH_LOGIN_SESSION_SEQUENCE: AtomicU64 = AtomicU64::new(1);
static AUTH_LOGIN_SESSIONS: OnceLock<Mutex<BTreeMap<String, AuthLoginRuntime>>> = OnceLock::new();

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum AuthLoginTargetKind {
    LocalProfile,
    ServerProfile,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum AuthLoginMode {
    BrowserOauth,
    DeviceCode,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum AuthLoginStatus {
    Waiting,
    Completed,
    Failed,
    Cancelled,
    Expired,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthLoginSessionReport {
    pub session_id: String,
    pub target_kind: AuthLoginTargetKind,
    pub target_id: Option<String>,
    pub profile_name: String,
    pub mode: AuthLoginMode,
    pub status: AuthLoginStatus,
    pub verification_url: Option<String>,
    pub user_code: Option<String>,
    pub started_at: String,
    pub expires_at: String,
    pub message: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartLocalProfileLoginInput {
    pub profile_name: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartServerProfileLoginInput {
    pub node_id: String,
    pub profile_name: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthLoginSessionInput {
    pub session_id: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenAuthLoginUrlInput {
    pub url: String,
}

struct AuthLoginRuntime {
    scope: String,
    report: AuthLoginSessionReport,
    child: Child,
    output: Arc<Mutex<Vec<u8>>>,
    expires_at_epoch: i64,
    finished_at_epoch: Option<i64>,
}

pub fn start_auth_login_process(
    target_kind: AuthLoginTargetKind,
    target_id: Option<String>,
    profile_name: String,
    mode: AuthLoginMode,
    scope: String,
    mut command: Command,
) -> Result<AuthLoginSessionReport, String> {
    ensure_auth_login_slot_available(&scope, mode)?;

    command
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .env("NO_COLOR", "1");
    let mut child = command
        .spawn()
        .map_err(|error| format!("failed to start Codex login: {error}"))?;
    let output = Arc::new(Mutex::new(Vec::new()));
    if let Some(stdout) = child.stdout.take() {
        spawn_auth_login_output_reader(stdout, Arc::clone(&output));
    }
    if let Some(stderr) = child.stderr.take() {
        spawn_auth_login_output_reader(stderr, Arc::clone(&output));
    }

    let started = Instant::now();
    let challenge = loop {
        let snapshot = auth_login_output_text(&output);
        if let Some(challenge) = parse_auth_login_challenge(mode, &snapshot) {
            break challenge;
        }
        if let Some(status) = child
            .try_wait()
            .map_err(|error| format!("failed to inspect Codex login: {error}"))?
        {
            let detail = sanitized_auth_login_detail(&snapshot);
            return Err(if detail.is_empty() {
                format!("Codex login exited before returning an authorization challenge ({status})")
            } else {
                format!("Codex login could not start: {detail}")
            });
        }
        if started.elapsed() >= AUTH_LOGIN_START_TIMEOUT {
            let _ = child.kill();
            let _ = child.wait();
            return Err(
                "Codex login did not return an authorization challenge in time".to_string(),
            );
        }
        thread::sleep(Duration::from_millis(80));
    };

    let now = Utc::now();
    let ttl_seconds = match mode {
        AuthLoginMode::BrowserOauth => AUTH_LOGIN_BROWSER_TTL_SECONDS,
        AuthLoginMode::DeviceCode => AUTH_LOGIN_DEVICE_TTL_SECONDS,
    };
    let expires_at = now + chrono::Duration::seconds(ttl_seconds);
    let session_id = format!(
        "auth-login-{}-{}",
        now.timestamp_millis(),
        AUTH_LOGIN_SESSION_SEQUENCE.fetch_add(1, Ordering::Relaxed)
    );
    let report = AuthLoginSessionReport {
        session_id: session_id.clone(),
        target_kind,
        target_id,
        profile_name,
        mode,
        status: AuthLoginStatus::Waiting,
        verification_url: Some(challenge.verification_url),
        user_code: challenge.user_code,
        started_at: now.to_rfc3339(),
        expires_at: expires_at.to_rfc3339(),
        message: match mode {
            AuthLoginMode::BrowserOauth => "授权页已就绪，正在等待浏览器完成登录。".to_string(),
            AuthLoginMode::DeviceCode => "设备码已就绪，正在等待服务器完成登录。".to_string(),
        },
    };
    let runtime = AuthLoginRuntime {
        scope,
        report: report.clone(),
        child,
        output,
        expires_at_epoch: expires_at.timestamp(),
        finished_at_epoch: None,
    };
    auth_login_sessions()
        .lock()
        .map_err(|_| "authentication session store is unavailable".to_string())?
        .insert(session_id, runtime);
    Ok(report)
}

pub fn read_auth_login_session(
    input: AuthLoginSessionInput,
) -> Result<AuthLoginSessionReport, String> {
    let mut sessions = auth_login_sessions()
        .lock()
        .map_err(|_| "authentication session store is unavailable".to_string())?;
    cleanup_auth_login_sessions(&mut sessions);
    let runtime = sessions
        .get_mut(input.session_id.trim())
        .ok_or_else(|| "authentication session was not found or has expired".to_string())?;
    refresh_auth_login_runtime(runtime)?;
    Ok(runtime.report.clone())
}

pub fn cancel_auth_login_session(
    input: AuthLoginSessionInput,
) -> Result<AuthLoginSessionReport, String> {
    let mut sessions = auth_login_sessions()
        .lock()
        .map_err(|_| "authentication session store is unavailable".to_string())?;
    let runtime = sessions
        .get_mut(input.session_id.trim())
        .ok_or_else(|| "authentication session was not found or has expired".to_string())?;
    if runtime.report.status == AuthLoginStatus::Waiting {
        let _ = runtime.child.kill();
        let _ = runtime.child.wait();
        finish_auth_login_runtime(
            runtime,
            AuthLoginStatus::Cancelled,
            "登录已取消。".to_string(),
        );
    }
    Ok(runtime.report.clone())
}

pub fn cancel_all_auth_login_sessions() {
    let Ok(mut sessions) = auth_login_sessions().lock() else {
        return;
    };
    for runtime in sessions.values_mut() {
        if runtime.report.status == AuthLoginStatus::Waiting {
            let _ = runtime.child.kill();
            let _ = runtime.child.wait();
            finish_auth_login_runtime(
                runtime,
                AuthLoginStatus::Cancelled,
                "应用已退出，登录会话已取消。".to_string(),
            );
        }
    }
    sessions.clear();
}

pub fn open_auth_login_url(input: OpenAuthLoginUrlInput) -> Result<(), String> {
    let url = input.url.trim();
    let parsed =
        reqwest::Url::parse(url).map_err(|_| "authorization URL is invalid".to_string())?;
    if parsed.scheme() != "https" || parsed.host_str() != Some("auth.openai.com") {
        return Err("only OpenAI authorization URLs can be opened".to_string());
    }

    #[cfg(target_os = "macos")]
    let mut command = Command::new("open");
    #[cfg(target_os = "linux")]
    let mut command = Command::new("xdg-open");
    #[cfg(target_os = "windows")]
    let mut command = {
        let mut command = Command::new("cmd");
        command.args(["/C", "start", ""]);
        command
    };
    command
        .arg(url)
        .spawn()
        .map_err(|error| format!("failed to open authorization page: {error}"))?;
    Ok(())
}

fn auth_login_sessions() -> &'static Mutex<BTreeMap<String, AuthLoginRuntime>> {
    AUTH_LOGIN_SESSIONS.get_or_init(|| Mutex::new(BTreeMap::new()))
}

fn ensure_auth_login_slot_available(scope: &str, mode: AuthLoginMode) -> Result<(), String> {
    let mut sessions = auth_login_sessions()
        .lock()
        .map_err(|_| "authentication session store is unavailable".to_string())?;
    cleanup_auth_login_sessions(&mut sessions);
    for runtime in sessions.values_mut() {
        refresh_auth_login_runtime(runtime)?;
        if runtime.report.status != AuthLoginStatus::Waiting {
            continue;
        }
        if runtime.scope == scope {
            return Err("this profile already has an active login session".to_string());
        }
        if mode == AuthLoginMode::BrowserOauth && runtime.report.mode == AuthLoginMode::BrowserOauth
        {
            return Err(
                "another browser login is already using the local callback port".to_string(),
            );
        }
    }
    Ok(())
}

fn refresh_auth_login_runtime(runtime: &mut AuthLoginRuntime) -> Result<(), String> {
    if runtime.report.status != AuthLoginStatus::Waiting {
        return Ok(());
    }
    if Utc::now().timestamp() >= runtime.expires_at_epoch {
        let _ = runtime.child.kill();
        let _ = runtime.child.wait();
        finish_auth_login_runtime(
            runtime,
            AuthLoginStatus::Expired,
            "授权已超时，请重新生成。".to_string(),
        );
        return Ok(());
    }
    if let Some(status) = runtime
        .child
        .try_wait()
        .map_err(|error| format!("failed to inspect Codex login: {error}"))?
    {
        if status.success() {
            finish_auth_login_runtime(
                runtime,
                AuthLoginStatus::Completed,
                "认证已完成。".to_string(),
            );
        } else {
            let detail = sanitized_auth_login_detail(&auth_login_output_text(&runtime.output));
            let message = if detail.is_empty() {
                "Codex 登录未完成，请重试。".to_string()
            } else {
                format!("Codex 登录未完成：{detail}")
            };
            finish_auth_login_runtime(runtime, AuthLoginStatus::Failed, message);
        }
    }
    Ok(())
}

fn finish_auth_login_runtime(
    runtime: &mut AuthLoginRuntime,
    status: AuthLoginStatus,
    message: String,
) {
    runtime.report.status = status;
    runtime.report.verification_url = None;
    runtime.report.user_code = None;
    runtime.report.message = message;
    runtime.finished_at_epoch = Some(Utc::now().timestamp());
    if let Ok(mut output) = runtime.output.lock() {
        output.clear();
    }
}

fn cleanup_auth_login_sessions(sessions: &mut BTreeMap<String, AuthLoginRuntime>) {
    let now = Utc::now().timestamp();
    sessions.retain(|_, runtime| {
        runtime.finished_at_epoch.is_none_or(|finished_at| {
            now.saturating_sub(finished_at) < AUTH_LOGIN_FINISHED_RETENTION_SECONDS
        })
    });
}

fn spawn_auth_login_output_reader<R>(mut reader: R, output: Arc<Mutex<Vec<u8>>>)
where
    R: Read + Send + 'static,
{
    thread::spawn(move || {
        let mut chunk = [0_u8; 2048];
        loop {
            let Ok(read) = reader.read(&mut chunk) else {
                break;
            };
            if read == 0 {
                break;
            }
            let Ok(mut buffer) = output.lock() else {
                break;
            };
            buffer.extend_from_slice(&chunk[..read]);
            if buffer.len() > AUTH_LOGIN_OUTPUT_LIMIT {
                let overflow = buffer.len() - AUTH_LOGIN_OUTPUT_LIMIT;
                buffer.drain(..overflow);
            }
        }
    });
}

fn auth_login_output_text(output: &Arc<Mutex<Vec<u8>>>) -> String {
    output
        .lock()
        .map(|buffer| String::from_utf8_lossy(&buffer).into_owned())
        .unwrap_or_default()
}

struct AuthLoginChallenge {
    verification_url: String,
    user_code: Option<String>,
}

fn parse_auth_login_challenge(mode: AuthLoginMode, output: &str) -> Option<AuthLoginChallenge> {
    let clean = strip_ansi(output);
    let verification_url = clean
        .split_whitespace()
        .find(|part| {
            part.starts_with("https://auth.openai.com/")
                && match mode {
                    AuthLoginMode::BrowserOauth => part.contains("/oauth/authorize?"),
                    AuthLoginMode::DeviceCode => part.contains("/codex/device"),
                }
        })?
        .trim_matches(|character: char| {
            matches!(
                character,
                '"' | '\'' | '(' | ')' | '[' | ']' | '<' | '>' | ','
            )
        })
        .to_string();
    let user_code = if mode == AuthLoginMode::DeviceCode {
        clean
            .lines()
            .map(str::trim)
            .find(|line| is_device_user_code(line))
            .map(str::to_string)
    } else {
        None
    };
    if mode == AuthLoginMode::DeviceCode && user_code.is_none() {
        return None;
    }
    Some(AuthLoginChallenge {
        verification_url,
        user_code,
    })
}

fn is_device_user_code(value: &str) -> bool {
    let length = value.len();
    (9..=20).contains(&length)
        && value.contains('-')
        && value.chars().all(|character| {
            character.is_ascii_uppercase() || character.is_ascii_digit() || character == '-'
        })
}

fn sanitized_auth_login_detail(output: &str) -> String {
    strip_ansi(output)
        .lines()
        .filter_map(|line| {
            let trimmed = line.trim();
            if trimmed.is_empty()
                || trimmed.contains("https://auth.openai.com/")
                || is_device_user_code(trimmed)
            {
                None
            } else {
                Some(trimmed)
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
        .chars()
        .take(320)
        .collect()
}

fn strip_ansi(value: &str) -> String {
    let mut output = String::with_capacity(value.len());
    let mut characters = value.chars().peekable();
    while let Some(character) = characters.next() {
        if character != '\u{1b}' {
            output.push(character);
            continue;
        }
        if characters.peek() == Some(&'[') {
            characters.next();
            for next in characters.by_ref() {
                if ('@'..='~').contains(&next) {
                    break;
                }
            }
        }
    }
    output
}

#[cfg(test)]
mod tests {
    use super::{
        cancel_auth_login_session, parse_auth_login_challenge, read_auth_login_session,
        sanitized_auth_login_detail, start_auth_login_process, strip_ansi, AuthLoginMode,
        AuthLoginSessionInput, AuthLoginStatus, AuthLoginTargetKind,
    };
    use std::process::Command;
    use std::thread;
    use std::time::Duration;

    #[test]
    fn parses_browser_oauth_challenge_without_persisting_other_output() {
        let challenge = parse_auth_login_challenge(
            AuthLoginMode::BrowserOauth,
            "navigate to:\nhttps://auth.openai.com/oauth/authorize?state=test&code_challenge=abc\n",
        )
        .unwrap();
        assert!(challenge.verification_url.contains("/oauth/authorize?"));
        assert!(challenge.user_code.is_none());
    }

    #[test]
    fn parses_ansi_device_code_challenge() {
        let output = "\u{1b}[94mhttps://auth.openai.com/codex/device\u{1b}[0m\n\u{1b}[94mABCD-EFGHI\u{1b}[0m\n";
        let challenge = parse_auth_login_challenge(AuthLoginMode::DeviceCode, output).unwrap();
        assert_eq!(
            challenge.verification_url,
            "https://auth.openai.com/codex/device"
        );
        assert_eq!(challenge.user_code.as_deref(), Some("ABCD-EFGHI"));
    }

    #[test]
    fn sanitizes_authorization_challenges_from_errors() {
        let output = "open https://auth.openai.com/codex/device\nABCD-EFGHI\nnetwork failed";
        let detail = sanitized_auth_login_detail(output);
        assert_eq!(detail, "network failed");
        assert!(!detail.contains("ABCD"));
        assert_eq!(strip_ansi("\u{1b}[90mtext\u{1b}[0m"), "text");
    }

    #[test]
    #[cfg(unix)]
    fn completed_login_sessions_clear_the_ephemeral_challenge() {
        let mut command = Command::new("sh");
        command.args([
            "-c",
            "printf 'https://auth.openai.com/codex/device\\nTEST-CODE1\\n'; sleep 0.1",
        ]);
        let started = start_auth_login_process(
            AuthLoginTargetKind::ServerProfile,
            Some("test-node".to_string()),
            "codex-test".to_string(),
            AuthLoginMode::DeviceCode,
            format!("test-scope-{}", std::process::id()),
            command,
        )
        .expect("start login session");
        assert_eq!(started.status, AuthLoginStatus::Waiting);
        assert_eq!(started.user_code.as_deref(), Some("TEST-CODE1"));

        thread::sleep(Duration::from_millis(180));
        let completed = read_auth_login_session(AuthLoginSessionInput {
            session_id: started.session_id.clone(),
        })
        .expect("read completed session");
        assert_eq!(completed.status, AuthLoginStatus::Completed);
        assert!(completed.verification_url.is_none());
        assert!(completed.user_code.is_none());

        let unchanged = cancel_auth_login_session(AuthLoginSessionInput {
            session_id: started.session_id,
        })
        .expect("completed session remains readable");
        assert_eq!(unchanged.status, AuthLoginStatus::Completed);
    }
}
