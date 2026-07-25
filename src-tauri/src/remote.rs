use crate::core::{
    list_profiles, ApplyModelRouteInput, CodexAccountInfo, CreateProfileInput,
    ListProfileSessionsInput, ModelRoutePreset, PreviewModelRouteInput, ProfileContext,
    ReadProfileSessionDetailInput, UpdateProfileModelInput,
};
use chrono::Utc;
use glob::glob;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::BTreeSet;
use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Mutex, OnceLock};
use std::thread;
use std::time::{Duration, Instant};

const SERVER_NODE_STORE_VERSION: u32 = 1;
const SSH_PROBE_TIMEOUT: Duration = Duration::from_secs(15);
const SSH_READ_TIMEOUT: Duration = Duration::from_secs(30);
const SSH_DETAIL_TIMEOUT: Duration = Duration::from_secs(60);
const SSH_WRITE_TIMEOUT: Duration = Duration::from_secs(60);
const SSH_NETWORK_TIMEOUT: Duration = Duration::from_secs(120);
const SSH_CHANNEL_TIMEOUT: Duration = Duration::from_secs(120);
const SSH_STDOUT_LIMIT: usize = 8 * 1024 * 1024;
const SSH_STDERR_LIMIT: usize = 512 * 1024;

static SERVER_NODE_OPERATION_SEQUENCE: AtomicU64 = AtomicU64::new(1);
static SERVER_NODE_WRITE_LOCKS: OnceLock<Mutex<BTreeSet<String>>> = OnceLock::new();

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerNodeConfig {
    pub id: String,
    pub name: String,
    pub ssh_target: String,
    pub remote_binary: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpsertServerNodeInput {
    pub id: Option<String>,
    pub name: String,
    pub ssh_target: String,
    pub remote_binary: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteServerNodeInput {
    pub node_id: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerNodeReport {
    pub generated_at: String,
    pub store_path: String,
    pub nodes: Vec<ServerNodeConfig>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SshHostOption {
    pub alias: String,
    pub hostname: Option<String>,
    pub user: Option<String>,
    pub port: Option<u16>,
    pub source_path: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SshHostReport {
    pub generated_at: String,
    pub config_path: String,
    pub config_exists: bool,
    pub hosts: Vec<SshHostOption>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerNodeStatus {
    pub node_id: String,
    pub checked_at: String,
    pub reachable: bool,
    pub latency_ms: u128,
    pub hostname: Option<String>,
    pub user: Option<String>,
    pub os: Option<String>,
    pub arch: Option<String>,
    pub shell: Option<String>,
    pub codex_installed: bool,
    pub cli_installed: bool,
    pub cli_version: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerNodeProbeReport {
    pub node: ServerNodeConfig,
    pub status: ServerNodeStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProbeServerNodeInput {
    pub node_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(
    tag = "kind",
    rename_all = "kebab-case",
    rename_all_fields = "camelCase"
)]
pub enum ServerNodeOperation {
    Doctor,
    ListProfiles,
    ListSessions {
        input: ListProfileSessionsInput,
    },
    ReadSession {
        input: ReadProfileSessionDetailInput,
    },
    AuthStatus,
    WechatStatus {
        profile_name: Option<String>,
    },
    FeishuStatus,
    FeishuStart {
        profile_name: String,
    },
    FeishuStop,
    FeishuRestart,
    ModelRouteStatus {
        profile_name: Option<String>,
    },
    ModelRoutePreview {
        input: PreviewModelRouteInput,
    },
    ModelRouteCheck {
        profile_name: String,
    },
    CreateProfile {
        input: CreateProfileInput,
    },
    LaunchProfile {
        profile_name: String,
    },
    TerminateProfile {
        profile_name: String,
    },
    UpdateProfileModel {
        input: UpdateProfileModelInput,
    },
    CreateAuthBackup {
        profile_name: String,
        label: Option<String>,
    },
    ApplyAuthBackup {
        backup_id: String,
        target_profile_name: String,
        confirm_sensitive: bool,
    },
    WechatStart {
        profile_name: String,
    },
    WechatStop {
        profile_name: String,
    },
    WechatRestart {
        profile_name: String,
    },
    ModelRouteApply {
        input: ApplyModelRouteInput,
    },
    ModelRouteRestore {
        profile_name: String,
        confirm_sensitive: bool,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunServerNodeOperationInput {
    pub node_id: String,
    pub operation: ServerNodeOperation,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncServerProfileInput {
    pub node_id: String,
    pub source_profile_name: String,
    pub target_profile_name: String,
    #[serde(default)]
    pub sync_auth: bool,
    #[serde(default)]
    pub confirm_sensitive: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncServerProfileReport {
    pub node_id: String,
    pub operation_id: String,
    pub generated_at: String,
    pub source_profile_name: String,
    pub target_profile_name: String,
    pub auth_synced: bool,
    pub source_account: Option<CodexAccountInfo>,
    pub profile: Value,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerNodeOperationReport {
    pub node_id: String,
    pub operation_id: String,
    pub started_at: String,
    pub generated_at: String,
    pub timeout_seconds: u64,
    pub duration_ms: u128,
    pub exit_code: i32,
    pub ok: bool,
    pub command: String,
    pub output_truncated: bool,
    pub data: Option<Value>,
    pub error: Option<Value>,
}

#[derive(Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ServerNodeStore {
    #[serde(default = "server_node_store_version")]
    version: u32,
    #[serde(default)]
    nodes: Vec<ServerNodeConfig>,
}

struct ProcessOutput {
    exit_code: i32,
    stdout: String,
    stderr: String,
    stdout_truncated: bool,
    stderr_truncated: bool,
    duration_ms: u128,
}

struct BoundedOutput {
    bytes: Vec<u8>,
    truncated: bool,
}

#[derive(Debug)]
struct ServerNodeWriteGuard {
    node_id: String,
}

impl Drop for ServerNodeWriteGuard {
    fn drop(&mut self) {
        if let Ok(mut locks) = server_node_write_locks().lock() {
            locks.remove(&self.node_id);
        }
    }
}

pub fn list_server_nodes(context: &ProfileContext) -> Result<ServerNodeReport, String> {
    let store = read_server_node_store(context)?;
    Ok(report_from_store(context, store))
}

pub fn list_ssh_hosts(context: &ProfileContext) -> Result<SshHostReport, String> {
    let ssh_dir = context.home_dir.join(".ssh");
    let config_path = ssh_dir.join("config");
    if !config_path.is_file() {
        return Ok(SshHostReport {
            generated_at: Utc::now().to_rfc3339(),
            config_path: display_home_path(&context.home_dir, &config_path),
            config_exists: false,
            hosts: Vec::new(),
        });
    }

    let mut visited = BTreeSet::new();
    let mut seen_aliases = BTreeSet::new();
    let mut aliases = Vec::new();
    collect_ssh_host_aliases(
        &config_path,
        &ssh_dir,
        &mut visited,
        &mut seen_aliases,
        &mut aliases,
    )?;

    let hosts = aliases
        .into_iter()
        .map(|(alias, source_path)| {
            let (hostname, user, port) = resolve_ssh_host(&config_path, &alias);
            SshHostOption {
                alias,
                hostname,
                user,
                port,
                source_path: display_home_path(&context.home_dir, &source_path),
            }
        })
        .collect();

    Ok(SshHostReport {
        generated_at: Utc::now().to_rfc3339(),
        config_path: display_home_path(&context.home_dir, &config_path),
        config_exists: true,
        hosts,
    })
}

pub fn upsert_server_node(
    context: &ProfileContext,
    input: UpsertServerNodeInput,
) -> Result<ServerNodeReport, String> {
    let name = input.name.trim();
    let ssh_target = input.ssh_target.trim();
    let remote_binary = input
        .remote_binary
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("rcodexmanager");
    validate_node_name(name)?;
    validate_ssh_target(ssh_target)?;
    validate_remote_binary(remote_binary)?;

    let mut store = read_server_node_store(context)?;
    let now = Utc::now().to_rfc3339();
    if let Some(id) = input.id.as_deref() {
        let node = store
            .nodes
            .iter_mut()
            .find(|node| node.id == id)
            .ok_or_else(|| format!("server node not found: {id}"))?;
        node.name = name.to_string();
        node.ssh_target = ssh_target.to_string();
        node.remote_binary = remote_binary.to_string();
        node.updated_at = now;
    } else {
        if store.nodes.iter().any(|node| node.ssh_target == ssh_target) {
            return Err(format!("SSH target already exists: {ssh_target}"));
        }
        store.nodes.push(ServerNodeConfig {
            id: format!(
                "node-{}-{}",
                slug_fragment(ssh_target),
                Utc::now().timestamp_millis()
            ),
            name: name.to_string(),
            ssh_target: ssh_target.to_string(),
            remote_binary: remote_binary.to_string(),
            created_at: now.clone(),
            updated_at: now,
        });
    }
    store
        .nodes
        .sort_by(|left, right| left.name.cmp(&right.name));
    write_server_node_store(context, &store)?;
    Ok(report_from_store(context, store))
}

pub fn delete_server_node(
    context: &ProfileContext,
    input: DeleteServerNodeInput,
) -> Result<ServerNodeReport, String> {
    let mut store = read_server_node_store(context)?;
    let previous_len = store.nodes.len();
    store.nodes.retain(|node| node.id != input.node_id);
    if store.nodes.len() == previous_len {
        return Err(format!("server node not found: {}", input.node_id));
    }
    write_server_node_store(context, &store)?;
    Ok(report_from_store(context, store))
}

pub fn probe_server_node(
    context: &ProfileContext,
    input: ProbeServerNodeInput,
) -> Result<ServerNodeProbeReport, String> {
    probe_server_node_with_ssh(context, input, Path::new("ssh"))
}

pub fn run_server_node_operation(
    context: &ProfileContext,
    input: RunServerNodeOperationInput,
) -> Result<ServerNodeOperationReport, String> {
    run_server_node_operation_with_ssh(context, input, Path::new("ssh"))
}

pub fn sync_server_profile(
    context: &ProfileContext,
    input: SyncServerProfileInput,
) -> Result<SyncServerProfileReport, String> {
    sync_server_profile_with_ssh(context, input, Path::new("ssh"))
}

pub fn sync_server_profile_with_ssh(
    context: &ProfileContext,
    input: SyncServerProfileInput,
    ssh_binary: &Path,
) -> Result<SyncServerProfileReport, String> {
    let operation_id = next_server_node_operation_id();
    let target_name = input.target_profile_name.trim();
    if !target_name.starts_with("codex-")
        || target_name.len() > 80
        || !target_name.chars().all(|character| {
            character.is_ascii_lowercase() || character.is_ascii_digit() || character == '-'
        })
    {
        return Err(format!(
            "{operation_id}: target profile name must start with codex- and use lowercase letters, numbers, or hyphens"
        ));
    }
    if input.sync_auth && !input.confirm_sensitive {
        return Err(format!(
            "{operation_id}: explicit confirmation is required before syncing authentication"
        ));
    }

    let source_report = list_profiles(context)?;
    let source = source_report
        .profiles
        .into_iter()
        .find(|profile| profile.name == input.source_profile_name)
        .ok_or_else(|| {
            format!(
                "{operation_id}: local source profile not found: {}",
                input.source_profile_name
            )
        })?;
    let auth_bytes = if input.sync_auth {
        let auth_path = PathBuf::from(&source.codex_home).join("auth.json");
        let bytes = fs::read(&auth_path).map_err(|error| {
            format!(
                "{operation_id}: failed to read local auth.json for {}: {error}",
                source.name
            )
        })?;
        if bytes.len() > 2 * 1024 * 1024 {
            return Err(format!(
                "{operation_id}: local auth.json is unexpectedly large; refusing to transfer it"
            ));
        }
        serde_json::from_slice::<Value>(&bytes).map_err(|error| {
            format!(
                "{operation_id}: local auth.json for {} is invalid JSON: {error}",
                source.name
            )
        })?;
        Some(bytes)
    } else {
        None
    };

    let node = find_server_node(context, &input.node_id)?;
    let _write_guard = acquire_server_node_write_guard(&node.id)
        .map_err(|message| format!("{operation_id}: {message}"))?;
    let create_arguments = operation_arguments(ServerNodeOperation::CreateProfile {
        input: CreateProfileInput {
            name: target_name.to_string(),
            codex_home: None,
            user_data_dir: None,
            model: source.model.clone(),
            reasoning_effort: source.reasoning_effort.clone(),
            alias: source.alias.clone(),
            category: Some(source.category.clone()),
            note: source.note.clone(),
            launcher_kind: None,
        },
    })?;
    let create_report = run_remote_cli(
        ssh_binary,
        &node,
        &create_arguments,
        SSH_WRITE_TIMEOUT,
        format!("{operation_id}-create"),
        Utc::now().to_rfc3339(),
    )?;
    if !create_report.ok {
        return Err(format!(
            "{operation_id}: {}",
            server_operation_error(&create_report, "failed to create the server profile")
        ));
    }

    if let Some(auth_bytes) = auth_bytes.as_deref() {
        let remote_command = format!(
            "set -eu; umask 077; tmp_dir=$(mktemp -d \"${{TMPDIR:-/tmp}}/rcodexmanager-auth-sync.XXXXXX\"); trap 'rm -rf \"$tmp_dir\"' EXIT HUP INT TERM; cat > \"$tmp_dir/auth.json\"; chmod 600 \"$tmp_dir/auth.json\"; {} --json import-auth --name {} --source \"$tmp_dir/auth.json\" --confirm-sensitive",
            shell_quote(&node.remote_binary),
            shell_quote(target_name),
        );
        let output = run_ssh_with_input(
            ssh_binary,
            &node,
            &remote_command,
            SSH_WRITE_TIMEOUT,
            Some(auth_bytes),
        )?;
        let auth_report = remote_cli_report_from_output(
            &node,
            output,
            SSH_WRITE_TIMEOUT,
            format!("{operation_id}-auth"),
            Utc::now().to_rfc3339(),
        )?;
        if !auth_report.ok {
            return Err(format!(
                "{operation_id}: server profile was created, but authentication sync failed: {}",
                server_operation_error(&auth_report, "remote authentication import failed")
            ));
        }
    }

    let verify_report = run_remote_cli(
        ssh_binary,
        &node,
        &["list".to_string()],
        SSH_READ_TIMEOUT,
        format!("{operation_id}-verify"),
        Utc::now().to_rfc3339(),
    )?;
    if !verify_report.ok {
        return Err(format!(
            "{operation_id}: profile sync completed, but verification failed: {}",
            server_operation_error(&verify_report, "remote profile verification failed")
        ));
    }
    let profile = verify_report
        .data
        .as_ref()
        .and_then(|data| data.get("profiles"))
        .and_then(Value::as_array)
        .and_then(|profiles| {
            profiles
                .iter()
                .find(|profile| profile.get("name").and_then(Value::as_str) == Some(target_name))
        })
        .cloned()
        .ok_or_else(|| {
            format!("{operation_id}: synced profile was not returned by verification")
        })?;

    Ok(SyncServerProfileReport {
        node_id: node.id,
        operation_id,
        generated_at: Utc::now().to_rfc3339(),
        source_profile_name: source.name,
        target_profile_name: target_name.to_string(),
        auth_synced: input.sync_auth,
        source_account: source.account,
        profile,
    })
}

pub fn probe_server_node_with_ssh(
    context: &ProfileContext,
    input: ProbeServerNodeInput,
    ssh_binary: &Path,
) -> Result<ServerNodeProbeReport, String> {
    let node = find_server_node(context, &input.node_id)?;
    let binary = shell_quote(&node.remote_binary);
    let script = format!(
        "printf '__RCM_HOST__=%s\\n' \"$(hostname 2>/dev/null || true)\"; \
         printf '__RCM_USER__=%s\\n' \"$(id -un 2>/dev/null || true)\"; \
         printf '__RCM_OS__=%s\\n' \"$(. /etc/os-release 2>/dev/null && printf '%s %s' \"$ID\" \"$VERSION_ID\" || uname -s)\"; \
         printf '__RCM_ARCH__=%s\\n' \"$(uname -m 2>/dev/null || true)\"; \
         printf '__RCM_SHELL__=%s\\n' \"${{SHELL:-}}\"; \
         if command -v codex >/dev/null 2>&1; then echo '__RCM_CODEX__=1'; else echo '__RCM_CODEX__=0'; fi; \
         if command -v {binary} >/dev/null 2>&1 || test -x {binary}; then echo '__RCM_CLI__=1'; else echo '__RCM_CLI__=0'; fi"
    );
    let output = run_ssh(ssh_binary, &node, &script, SSH_PROBE_TIMEOUT)?;
    let reachable = output.exit_code == 0;
    let cli_installed = marker(&output.stdout, "__RCM_CLI__") == Some("1");
    let mut cli_version = None;
    let mut error = if reachable {
        None
    } else {
        Some(compact_error(&output.stderr, "SSH connection failed"))
    };

    if reachable && cli_installed {
        match run_remote_cli(
            ssh_binary,
            &node,
            &["info".to_string()],
            SSH_READ_TIMEOUT,
            next_server_node_operation_id(),
            Utc::now().to_rfc3339(),
        ) {
            Ok(report) if report.ok => {
                cli_version = report
                    .data
                    .as_ref()
                    .and_then(|value| value.get("version"))
                    .and_then(Value::as_str)
                    .map(str::to_string);
            }
            Ok(report) => {
                error = report
                    .error
                    .as_ref()
                    .and_then(|value| value.get("message"))
                    .and_then(Value::as_str)
                    .map(str::to_string);
            }
            Err(message) => error = Some(message),
        }
    }

    Ok(ServerNodeProbeReport {
        status: ServerNodeStatus {
            node_id: node.id.clone(),
            checked_at: Utc::now().to_rfc3339(),
            reachable,
            latency_ms: output.duration_ms,
            hostname: marker_owned(&output.stdout, "__RCM_HOST__"),
            user: marker_owned(&output.stdout, "__RCM_USER__"),
            os: marker_owned(&output.stdout, "__RCM_OS__"),
            arch: marker_owned(&output.stdout, "__RCM_ARCH__"),
            shell: marker_owned(&output.stdout, "__RCM_SHELL__"),
            codex_installed: marker(&output.stdout, "__RCM_CODEX__") == Some("1"),
            cli_installed,
            cli_version,
            error,
        },
        node,
    })
}

pub fn run_server_node_operation_with_ssh(
    context: &ProfileContext,
    input: RunServerNodeOperationInput,
    ssh_binary: &Path,
) -> Result<ServerNodeOperationReport, String> {
    let node = find_server_node(context, &input.node_id)?;
    let timeout = operation_timeout(&input.operation);
    let is_write = operation_is_write(&input.operation);
    let operation_id = next_server_node_operation_id();
    let started_at = Utc::now().to_rfc3339();
    let arguments = operation_arguments(input.operation)
        .map_err(|message| format!("{operation_id}: {message}"))?;
    let _write_guard = if is_write {
        Some(
            acquire_server_node_write_guard(&node.id)
                .map_err(|message| format!("{operation_id}: {message}"))?,
        )
    } else {
        None
    };
    run_remote_cli(
        ssh_binary,
        &node,
        &arguments,
        timeout,
        operation_id.clone(),
        started_at,
    )
    .map_err(|message| format!("{operation_id}: {message}"))
}

fn operation_timeout(operation: &ServerNodeOperation) -> Duration {
    match operation {
        ServerNodeOperation::ReadSession { .. } => SSH_DETAIL_TIMEOUT,
        ServerNodeOperation::ModelRouteCheck { .. } => SSH_NETWORK_TIMEOUT,
        ServerNodeOperation::WechatStart { .. }
        | ServerNodeOperation::WechatRestart { .. }
        | ServerNodeOperation::FeishuStart { .. }
        | ServerNodeOperation::FeishuRestart => SSH_CHANNEL_TIMEOUT,
        operation if operation_is_write(operation) => SSH_WRITE_TIMEOUT,
        _ => SSH_READ_TIMEOUT,
    }
}

fn operation_is_write(operation: &ServerNodeOperation) -> bool {
    matches!(
        operation,
        ServerNodeOperation::FeishuStart { .. }
            | ServerNodeOperation::FeishuStop
            | ServerNodeOperation::FeishuRestart
            | ServerNodeOperation::CreateProfile { .. }
            | ServerNodeOperation::LaunchProfile { .. }
            | ServerNodeOperation::TerminateProfile { .. }
            | ServerNodeOperation::UpdateProfileModel { .. }
            | ServerNodeOperation::CreateAuthBackup { .. }
            | ServerNodeOperation::ApplyAuthBackup { .. }
            | ServerNodeOperation::WechatStart { .. }
            | ServerNodeOperation::WechatStop { .. }
            | ServerNodeOperation::WechatRestart { .. }
            | ServerNodeOperation::ModelRouteApply { .. }
            | ServerNodeOperation::ModelRouteRestore { .. }
    )
}

fn operation_arguments(operation: ServerNodeOperation) -> Result<Vec<String>, String> {
    let mut arguments = Vec::new();
    match operation {
        ServerNodeOperation::Doctor => arguments.push("doctor".to_string()),
        ServerNodeOperation::ListProfiles => arguments.push("list".to_string()),
        ServerNodeOperation::ListSessions { input } => {
            arguments.extend(["sessions".to_string(), "list".to_string()]);
            push_option(&mut arguments, "--profile", input.profile_name);
            push_option(&mut arguments, "--category", input.category);
            push_option(&mut arguments, "--query", input.query);
            arguments.extend(["--offset".to_string(), input.offset.to_string()]);
            arguments.extend(["--limit".to_string(), input.limit.clamp(1, 50).to_string()]);
        }
        ServerNodeOperation::ReadSession { input } => {
            arguments.extend(["sessions".to_string(), "detail".to_string()]);
            arguments.extend(["--profile".to_string(), input.profile_name]);
            arguments.extend(["--session-id".to_string(), input.session_id]);
            push_option(&mut arguments, "--updated-at", input.updated_at);
        }
        ServerNodeOperation::AuthStatus => {
            arguments.extend(["auth".to_string(), "list".to_string()]);
        }
        ServerNodeOperation::WechatStatus { profile_name } => {
            arguments.extend(["wechat".to_string(), "status".to_string()]);
            push_option(&mut arguments, "--name", profile_name);
        }
        ServerNodeOperation::FeishuStatus => {
            arguments.extend(["feishu".to_string(), "status".to_string()]);
        }
        ServerNodeOperation::FeishuStart { profile_name } => {
            arguments.extend([
                "feishu".to_string(),
                "start".to_string(),
                "--name".to_string(),
                profile_name,
            ]);
        }
        ServerNodeOperation::FeishuStop => {
            arguments.extend(["feishu".to_string(), "stop".to_string()]);
        }
        ServerNodeOperation::FeishuRestart => {
            arguments.extend(["feishu".to_string(), "restart".to_string()]);
        }
        ServerNodeOperation::ModelRouteStatus { profile_name } => {
            arguments.extend(["model-route".to_string(), "status".to_string()]);
            push_option(&mut arguments, "--name", profile_name);
        }
        ServerNodeOperation::ModelRoutePreview { input } => {
            if input
                .api_key
                .as_deref()
                .is_some_and(|value| !value.is_empty())
            {
                return Err(
                    "remote model routes accept only apiKeyEnv; plaintext API keys are not sent over the node protocol"
                        .to_string(),
                );
            }
            arguments.extend([
                "model-route".to_string(),
                "preview".to_string(),
                "--name".to_string(),
                input.profile_name,
                "--preset".to_string(),
                model_route_preset(input.preset).to_string(),
                "--model".to_string(),
                input.model,
            ]);
            push_model_route_options(
                &mut arguments,
                input.reasoning_effort,
                input.proxy_base_url,
                input.upstream_base_url,
                input.api_key_env,
            );
        }
        ServerNodeOperation::ModelRouteCheck { profile_name } => {
            arguments.extend([
                "model-route".to_string(),
                "check".to_string(),
                "--name".to_string(),
                profile_name,
            ]);
        }
        ServerNodeOperation::CreateProfile { input } => {
            arguments.push("create".to_string());
            arguments.extend(["--name".to_string(), input.name]);
            push_option(&mut arguments, "--codex-home", input.codex_home);
            push_option(&mut arguments, "--user-data-dir", input.user_data_dir);
            push_option(&mut arguments, "--model", input.model);
            push_option(&mut arguments, "--reasoning-effort", input.reasoning_effort);
            push_option(&mut arguments, "--alias", input.alias);
            push_option(&mut arguments, "--category", input.category);
            push_option(&mut arguments, "--note", input.note);
            arguments.push("--server".to_string());
        }
        ServerNodeOperation::LaunchProfile { profile_name } => {
            arguments.extend(["launch".to_string(), "--name".to_string(), profile_name]);
        }
        ServerNodeOperation::TerminateProfile { profile_name } => {
            arguments.extend(["terminate".to_string(), "--name".to_string(), profile_name]);
        }
        ServerNodeOperation::UpdateProfileModel { input } => {
            arguments.extend([
                "model".to_string(),
                "set".to_string(),
                "--name".to_string(),
                input.profile_name,
                "--model".to_string(),
                input.model,
            ]);
            push_option(&mut arguments, "--reasoning-effort", input.reasoning_effort);
        }
        ServerNodeOperation::CreateAuthBackup {
            profile_name,
            label,
        } => {
            arguments.extend([
                "auth".to_string(),
                "backup".to_string(),
                "--name".to_string(),
                profile_name,
            ]);
            push_option(&mut arguments, "--label", label);
        }
        ServerNodeOperation::ApplyAuthBackup {
            backup_id,
            target_profile_name,
            confirm_sensitive,
        } => {
            require_confirmation(confirm_sensitive, "applying a server auth backup")?;
            arguments.extend([
                "auth".to_string(),
                "apply".to_string(),
                "--backup-id".to_string(),
                backup_id,
                "--target".to_string(),
                target_profile_name,
                "--confirm-sensitive".to_string(),
            ]);
        }
        ServerNodeOperation::WechatStart { profile_name } => {
            push_wechat_action(&mut arguments, "start", profile_name)
        }
        ServerNodeOperation::WechatStop { profile_name } => {
            push_wechat_action(&mut arguments, "stop", profile_name)
        }
        ServerNodeOperation::WechatRestart { profile_name } => {
            push_wechat_action(&mut arguments, "restart", profile_name)
        }
        ServerNodeOperation::ModelRouteApply { input } => {
            require_confirmation(input.confirm_sensitive, "applying a server model route")?;
            if input
                .api_key
                .as_deref()
                .is_some_and(|value| !value.is_empty())
            {
                return Err(
                    "remote model routes accept only apiKeyEnv; plaintext API keys are not sent over the node protocol"
                        .to_string(),
                );
            }
            arguments.extend([
                "model-route".to_string(),
                "apply".to_string(),
                "--name".to_string(),
                input.profile_name,
                "--preset".to_string(),
                model_route_preset(input.preset).to_string(),
                "--model".to_string(),
                input.model,
            ]);
            push_model_route_options(
                &mut arguments,
                input.reasoning_effort,
                input.proxy_base_url,
                input.upstream_base_url,
                input.api_key_env,
            );
            arguments.push("--confirm-sensitive".to_string());
        }
        ServerNodeOperation::ModelRouteRestore {
            profile_name,
            confirm_sensitive,
        } => {
            require_confirmation(confirm_sensitive, "restoring a server model route")?;
            arguments.extend([
                "model-route".to_string(),
                "restore".to_string(),
                "--name".to_string(),
                profile_name,
                "--confirm-sensitive".to_string(),
            ]);
        }
    }
    Ok(arguments)
}

fn run_remote_cli(
    ssh_binary: &Path,
    node: &ServerNodeConfig,
    arguments: &[String],
    timeout: Duration,
    operation_id: String,
    started_at: String,
) -> Result<ServerNodeOperationReport, String> {
    let mut command = vec![node.remote_binary.clone(), "--json".to_string()];
    command.extend(arguments.iter().cloned());
    let remote_command = command
        .iter()
        .map(|value| shell_quote(value))
        .collect::<Vec<_>>()
        .join(" ");
    let output = run_ssh(ssh_binary, node, &remote_command, timeout)?;
    remote_cli_report_from_output(node, output, timeout, operation_id, started_at)
}

fn remote_cli_report_from_output(
    node: &ServerNodeConfig,
    output: ProcessOutput,
    timeout: Duration,
    operation_id: String,
    started_at: String,
) -> Result<ServerNodeOperationReport, String> {
    if output.stdout_truncated {
        return Err(format!(
            "server node output exceeded {} MiB; narrow the request and retry",
            SSH_STDOUT_LIMIT / 1024 / 1024
        ));
    }
    let envelope: Value = serde_json::from_str(output.stdout.trim()).map_err(|error| {
        format!(
            "server node returned invalid JSON: {error}; {}",
            compact_error(&output.stderr, "no diagnostic output")
        )
    })?;
    let ok = envelope.get("ok").and_then(Value::as_bool).unwrap_or(false);
    let command = envelope
        .get("command")
        .and_then(Value::as_str)
        .unwrap_or("unknown")
        .to_string();
    Ok(ServerNodeOperationReport {
        node_id: node.id.clone(),
        operation_id,
        started_at,
        generated_at: Utc::now().to_rfc3339(),
        timeout_seconds: timeout.as_secs(),
        duration_ms: output.duration_ms,
        exit_code: output.exit_code,
        ok,
        command,
        output_truncated: output.stderr_truncated,
        data: envelope.get("data").cloned(),
        error: envelope.get("error").cloned(),
    })
}

fn server_operation_error(report: &ServerNodeOperationReport, fallback: &str) -> String {
    report
        .error
        .as_ref()
        .and_then(|error| error.get("message"))
        .and_then(Value::as_str)
        .filter(|message| !message.trim().is_empty())
        .unwrap_or(fallback)
        .to_string()
}

fn run_ssh(
    ssh_binary: &Path,
    node: &ServerNodeConfig,
    remote_command: &str,
    timeout: Duration,
) -> Result<ProcessOutput, String> {
    run_ssh_with_input(ssh_binary, node, remote_command, timeout, None)
}

fn run_ssh_with_input(
    ssh_binary: &Path,
    node: &ServerNodeConfig,
    remote_command: &str,
    timeout: Duration,
    input: Option<&[u8]>,
) -> Result<ProcessOutput, String> {
    let started = Instant::now();
    let mut child = Command::new(ssh_binary)
        .args([
            "-o",
            "BatchMode=yes",
            "-o",
            "ConnectTimeout=8",
            "-o",
            "ServerAliveInterval=5",
            "-o",
            "ServerAliveCountMax=1",
            &node.ssh_target,
            remote_command,
        ])
        .stdin(if input.is_some() {
            Stdio::piped()
        } else {
            Stdio::null()
        })
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| format!("failed to start ssh: {error}"))?;

    if let Some(input) = input {
        let mut stdin = child
            .stdin
            .take()
            .ok_or_else(|| "failed to open ssh stdin".to_string())?;
        stdin
            .write_all(input)
            .map_err(|error| format!("failed to stream sensitive input over ssh: {error}"))?;
    }

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "failed to capture ssh stdout".to_string())?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "failed to capture ssh stderr".to_string())?;
    let stdout_reader = thread::spawn(move || read_bounded_output(stdout, SSH_STDOUT_LIMIT));
    let stderr_reader = thread::spawn(move || read_bounded_output(stderr, SSH_STDERR_LIMIT));

    loop {
        if let Some(status) = child
            .try_wait()
            .map_err(|error| format!("failed to inspect ssh process: {error}"))?
        {
            let stdout = join_output_reader(stdout_reader, "stdout")?;
            let stderr = join_output_reader(stderr_reader, "stderr")?;
            return Ok(ProcessOutput {
                exit_code: status.code().unwrap_or(1),
                stdout: String::from_utf8_lossy(&stdout.bytes).to_string(),
                stderr: String::from_utf8_lossy(&stderr.bytes).to_string(),
                stdout_truncated: stdout.truncated,
                stderr_truncated: stderr.truncated,
                duration_ms: started.elapsed().as_millis(),
            });
        }
        if started.elapsed() >= timeout {
            let _ = child.kill();
            let _ = child.wait();
            let _stdout = join_output_reader(stdout_reader, "stdout")?;
            let stderr = join_output_reader(stderr_reader, "stderr")?;
            let diagnostic = compact_error(
                &String::from_utf8_lossy(&stderr.bytes),
                "the remote command did not finish",
            );
            return Err(format!(
                "SSH operation timed out after {} seconds: {diagnostic}",
                timeout.as_secs(),
            ));
        }
        thread::sleep(Duration::from_millis(40));
    }
}

fn read_bounded_output(mut reader: impl Read, limit: usize) -> BoundedOutput {
    let mut bytes = Vec::with_capacity(limit.min(64 * 1024));
    let mut chunk = [0_u8; 16 * 1024];
    let mut truncated = false;
    loop {
        let read = match reader.read(&mut chunk) {
            Ok(0) | Err(_) => break,
            Ok(read) => read,
        };
        let remaining = limit.saturating_sub(bytes.len());
        let retained = remaining.min(read);
        bytes.extend_from_slice(&chunk[..retained]);
        if retained < read {
            truncated = true;
        }
    }
    BoundedOutput { bytes, truncated }
}

fn join_output_reader(
    reader: thread::JoinHandle<BoundedOutput>,
    stream_name: &str,
) -> Result<BoundedOutput, String> {
    reader
        .join()
        .map_err(|_| format!("failed to collect ssh {stream_name}"))
}

fn next_server_node_operation_id() -> String {
    let sequence = SERVER_NODE_OPERATION_SEQUENCE.fetch_add(1, Ordering::Relaxed);
    format!("node-op-{}-{sequence}", Utc::now().timestamp_millis())
}

fn server_node_write_locks() -> &'static Mutex<BTreeSet<String>> {
    SERVER_NODE_WRITE_LOCKS.get_or_init(|| Mutex::new(BTreeSet::new()))
}

fn acquire_server_node_write_guard(node_id: &str) -> Result<ServerNodeWriteGuard, String> {
    let mut locks = server_node_write_locks()
        .lock()
        .map_err(|_| "server node write lock is unavailable".to_string())?;
    if !locks.insert(node_id.to_string()) {
        return Err(
            "another write operation is already running on this server node; wait for it to finish"
                .to_string(),
        );
    }
    Ok(ServerNodeWriteGuard {
        node_id: node_id.to_string(),
    })
}

fn server_node_store_version() -> u32 {
    SERVER_NODE_STORE_VERSION
}

fn server_node_store_path(context: &ProfileContext) -> PathBuf {
    context.home_dir.join(".rcodexmanager/server-nodes.json")
}

fn read_server_node_store(context: &ProfileContext) -> Result<ServerNodeStore, String> {
    let path = server_node_store_path(context);
    if !path.exists() {
        return Ok(ServerNodeStore {
            version: SERVER_NODE_STORE_VERSION,
            nodes: Vec::new(),
        });
    }
    let body = fs::read_to_string(&path).map_err(|error| error.to_string())?;
    serde_json::from_str(&body).map_err(|error| format!("invalid server node store: {error}"))
}

fn write_server_node_store(
    context: &ProfileContext,
    store: &ServerNodeStore,
) -> Result<(), String> {
    let path = server_node_store_path(context);
    let parent = path
        .parent()
        .ok_or_else(|| "server node store has no parent directory".to_string())?;
    fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    let temporary = path.with_extension("json.tmp");
    let body = serde_json::to_string_pretty(store).map_err(|error| error.to_string())?;
    fs::write(&temporary, format!("{body}\n")).map_err(|error| error.to_string())?;
    fs::rename(&temporary, &path).map_err(|error| error.to_string())
}

fn report_from_store(context: &ProfileContext, store: ServerNodeStore) -> ServerNodeReport {
    ServerNodeReport {
        generated_at: Utc::now().to_rfc3339(),
        store_path: server_node_store_path(context)
            .to_string_lossy()
            .to_string(),
        nodes: store.nodes,
    }
}

fn find_server_node(context: &ProfileContext, node_id: &str) -> Result<ServerNodeConfig, String> {
    read_server_node_store(context)?
        .nodes
        .into_iter()
        .find(|node| node.id == node_id)
        .ok_or_else(|| format!("server node not found: {node_id}"))
}

fn collect_ssh_host_aliases(
    config_path: &Path,
    ssh_dir: &Path,
    visited: &mut BTreeSet<PathBuf>,
    seen_aliases: &mut BTreeSet<String>,
    aliases: &mut Vec<(String, PathBuf)>,
) -> Result<(), String> {
    let visit_key = fs::canonicalize(config_path).unwrap_or_else(|_| config_path.to_path_buf());
    if !visited.insert(visit_key) || !config_path.is_file() {
        return Ok(());
    }

    let body = fs::read_to_string(config_path).map_err(|error| {
        format!(
            "failed to read SSH config {}: {error}",
            config_path.display()
        )
    })?;
    for raw_line in body.lines() {
        let line = strip_ssh_comment(raw_line).trim();
        let Some((keyword, arguments)) = ssh_keyword_and_arguments(line) else {
            continue;
        };

        if keyword.eq_ignore_ascii_case("host") {
            for alias in split_ssh_tokens(arguments) {
                if is_literal_ssh_host_alias(&alias) && seen_aliases.insert(alias.clone()) {
                    aliases.push((alias, config_path.to_path_buf()));
                }
            }
        } else if keyword.eq_ignore_ascii_case("include") {
            for include in split_ssh_tokens(arguments) {
                for included_path in expand_ssh_include(&include, ssh_dir)? {
                    collect_ssh_host_aliases(
                        &included_path,
                        ssh_dir,
                        visited,
                        seen_aliases,
                        aliases,
                    )?;
                }
            }
        }
    }
    Ok(())
}

fn strip_ssh_comment(value: &str) -> &str {
    let mut quote = None;
    let mut escaped = false;
    for (index, character) in value.char_indices() {
        if escaped {
            escaped = false;
            continue;
        }
        if character == '\\' {
            escaped = true;
            continue;
        }
        if matches!(character, '\'' | '"') {
            if quote == Some(character) {
                quote = None;
            } else if quote.is_none() {
                quote = Some(character);
            }
            continue;
        }
        if character == '#' && quote.is_none() {
            return &value[..index];
        }
    }
    value
}

fn ssh_keyword_and_arguments(value: &str) -> Option<(&str, &str)> {
    let value = value.trim();
    if value.is_empty() {
        return None;
    }
    let split_at = value
        .char_indices()
        .find(|(_, character)| character.is_ascii_whitespace() || *character == '=')
        .map(|(index, _)| index)?;
    let arguments = value[split_at..]
        .trim_start_matches(|character: char| character.is_ascii_whitespace() || character == '=')
        .trim();
    Some((&value[..split_at], arguments))
}

fn split_ssh_tokens(value: &str) -> Vec<String> {
    let mut tokens = Vec::new();
    let mut current = String::new();
    let mut quote = None;
    let mut escaped = false;
    for character in value.chars() {
        if escaped {
            current.push(character);
            escaped = false;
            continue;
        }
        if character == '\\' {
            escaped = true;
            continue;
        }
        if matches!(character, '\'' | '"') {
            if quote == Some(character) {
                quote = None;
            } else if quote.is_none() {
                quote = Some(character);
            } else {
                current.push(character);
            }
            continue;
        }
        if character.is_ascii_whitespace() && quote.is_none() {
            if !current.is_empty() {
                tokens.push(std::mem::take(&mut current));
            }
        } else {
            current.push(character);
        }
    }
    if escaped {
        current.push('\\');
    }
    if !current.is_empty() {
        tokens.push(current);
    }
    tokens
}

fn is_literal_ssh_host_alias(value: &str) -> bool {
    !value.is_empty()
        && !value.starts_with('!')
        && !value.contains(['*', '?', '[', ']', '%'])
        && validate_ssh_target(value).is_ok()
}

fn expand_ssh_include(value: &str, ssh_dir: &Path) -> Result<Vec<PathBuf>, String> {
    let home_dir = ssh_dir.parent().unwrap_or(ssh_dir);
    let expanded = if value == "~" {
        home_dir.to_path_buf()
    } else if let Some(relative) = value.strip_prefix("~/") {
        home_dir.join(relative)
    } else {
        let path = PathBuf::from(value);
        if path.is_absolute() {
            path
        } else {
            ssh_dir.join(path)
        }
    };

    if !value.contains(['*', '?', '[']) {
        return Ok(vec![expanded]);
    }

    let pattern = expanded.to_string_lossy();
    let paths = glob(&pattern)
        .map_err(|error| format!("invalid SSH Include pattern {value}: {error}"))?
        .filter_map(Result::ok)
        .filter(|path| path.is_file())
        .collect();
    Ok(paths)
}

fn resolve_ssh_host(
    config_path: &Path,
    alias: &str,
) -> (Option<String>, Option<String>, Option<u16>) {
    let Ok(output) = Command::new("ssh")
        .arg("-F")
        .arg(config_path)
        .args(["-G", alias])
        .output()
    else {
        return (None, None, None);
    };
    if !output.status.success() {
        return (None, None, None);
    }

    let mut hostname = None;
    let mut user = None;
    let mut port = None;
    for line in String::from_utf8_lossy(&output.stdout).lines() {
        let Some((key, value)) = line.split_once(char::is_whitespace) else {
            continue;
        };
        let value = value.trim();
        match key {
            "hostname" => hostname = Some(value.to_string()),
            "user" => user = Some(value.to_string()),
            "port" => port = value.parse().ok(),
            _ => {}
        }
    }
    (hostname, user, port)
}

fn display_home_path(home_dir: &Path, path: &Path) -> String {
    path.strip_prefix(home_dir)
        .map(|relative| format!("~/{}", relative.to_string_lossy()))
        .unwrap_or_else(|_| path.to_string_lossy().to_string())
}

fn validate_node_name(value: &str) -> Result<(), String> {
    if value.is_empty() || value.chars().count() > 48 {
        return Err("server node name must contain 1 to 48 characters".to_string());
    }
    Ok(())
}

fn validate_ssh_target(value: &str) -> Result<(), String> {
    if value.is_empty()
        || value.starts_with('-')
        || value.len() > 160
        || !value
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || "._@:-".contains(character))
    {
        return Err("SSH target must be a host alias or user@host without spaces".to_string());
    }
    Ok(())
}

fn validate_remote_binary(value: &str) -> Result<(), String> {
    if value.is_empty() || value.len() > 240 || value.contains(['\n', '\r', '\0']) {
        return Err("remote binary path is invalid".to_string());
    }
    Ok(())
}

fn require_confirmation(value: bool, action: &str) -> Result<(), String> {
    if value {
        Ok(())
    } else {
        Err(format!("explicit confirmation is required before {action}"))
    }
}

fn push_option(arguments: &mut Vec<String>, flag: &str, value: Option<String>) {
    if let Some(value) = value.filter(|value| !value.trim().is_empty()) {
        arguments.extend([flag.to_string(), value]);
    }
}

fn push_wechat_action(arguments: &mut Vec<String>, action: &str, profile_name: String) {
    arguments.extend([
        "wechat".to_string(),
        action.to_string(),
        "--name".to_string(),
        profile_name,
    ]);
}

fn push_model_route_options(
    arguments: &mut Vec<String>,
    reasoning_effort: Option<String>,
    proxy_base_url: Option<String>,
    upstream_base_url: Option<String>,
    api_key_env: Option<String>,
) {
    push_option(arguments, "--reasoning-effort", reasoning_effort);
    push_option(arguments, "--proxy-base-url", proxy_base_url);
    push_option(arguments, "--upstream-base-url", upstream_base_url);
    push_option(arguments, "--api-key-env", api_key_env);
}

fn model_route_preset(value: ModelRoutePreset) -> &'static str {
    match value {
        ModelRoutePreset::AliyunQwen => "aliyun-qwen",
        ModelRoutePreset::Glm => "glm",
        ModelRoutePreset::OpenaiChat => "openai-chat",
        ModelRoutePreset::LocalOpenai => "local-openai",
        ModelRoutePreset::CustomResponses => "custom-responses",
    }
}

fn marker<'a>(body: &'a str, key: &str) -> Option<&'a str> {
    body.lines().find_map(|line| {
        line.strip_prefix(key)
            .and_then(|value| value.strip_prefix('='))
    })
}

fn marker_owned(body: &str, key: &str) -> Option<String> {
    marker(body, key)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}

fn shell_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "'\\''"))
}

fn compact_error(stderr: &str, fallback: &str) -> String {
    let compact = stderr
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .take(4)
        .collect::<Vec<_>>()
        .join(" ");
    if compact.is_empty() {
        fallback.to_string()
    } else {
        compact.chars().take(600).collect()
    }
}

fn slug_fragment(value: &str) -> String {
    let slug = value
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() {
                character.to_ascii_lowercase()
            } else {
                '-'
            }
        })
        .collect::<String>();
    slug.trim_matches('-').chars().take(24).collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Cursor;
    use tempfile::tempdir;

    #[test]
    fn shell_quote_handles_single_quotes() {
        assert_eq!(shell_quote("a'b"), "'a'\\''b'");
    }

    #[test]
    fn ssh_target_rejects_options_and_shell_syntax() {
        assert!(validate_ssh_target("demo-server").is_ok());
        assert!(validate_ssh_target("admin@example.com").is_ok());
        assert!(validate_ssh_target("-oProxyCommand=x").is_err());
        assert!(validate_ssh_target("host; rm -rf /").is_err());
    }

    #[test]
    fn ssh_config_discovery_reads_includes_and_ignores_patterns() {
        let root = tempdir().expect("temp home");
        let ssh_dir = root.path().join(".ssh");
        let include_dir = ssh_dir.join("config.d");
        fs::create_dir_all(&include_dir).expect("create SSH config directory");
        fs::write(
            ssh_dir.join("config"),
            "Host *\n  ServerAliveInterval 30\nInclude config.d/*.conf\nHost aliyun demo-server # cloud aliases\n  HostName 127.0.0.1\n",
        )
        .expect("write root config");
        fs::write(
            include_dir.join("work.conf"),
            "Host github-work\n  HostName github.com\nHost !blocked *.internal\n",
        )
        .expect("write included config");

        let mut visited = BTreeSet::new();
        let mut seen = BTreeSet::new();
        let mut aliases = Vec::new();
        collect_ssh_host_aliases(
            &ssh_dir.join("config"),
            &ssh_dir,
            &mut visited,
            &mut seen,
            &mut aliases,
        )
        .expect("discover aliases");

        assert_eq!(
            aliases
                .into_iter()
                .map(|(alias, _)| alias)
                .collect::<Vec<_>>(),
            ["github-work", "aliyun", "demo-server"]
        );
    }

    #[test]
    fn ssh_tokenizer_keeps_quoted_include_paths() {
        assert_eq!(
            split_ssh_tokens("\"config.d/work hosts.conf\" config.d/personal.conf"),
            ["config.d/work hosts.conf", "config.d/personal.conf"]
        );
        assert_eq!(strip_ssh_comment("Host cloud # note"), "Host cloud ");
        assert_eq!(
            strip_ssh_comment("Host \"cloud#prod\""),
            "Host \"cloud#prod\""
        );
    }

    #[test]
    fn sensitive_remote_operations_require_confirmation() {
        let operation = ServerNodeOperation::ApplyAuthBackup {
            backup_id: "backup-1".to_string(),
            target_profile_name: "codex-o".to_string(),
            confirm_sensitive: false,
        };
        assert!(operation_arguments(operation).is_err());
    }

    #[test]
    fn plaintext_model_keys_are_rejected() {
        let operation = ServerNodeOperation::ModelRouteApply {
            input: ApplyModelRouteInput {
                profile_name: "codex-o".to_string(),
                preset: ModelRoutePreset::Glm,
                model: "glm-4.6".to_string(),
                reasoning_effort: None,
                proxy_base_url: None,
                upstream_base_url: None,
                api_key: Some("secret".to_string()),
                api_key_env: None,
                confirm_sensitive: true,
            },
        };
        assert!(operation_arguments(operation).is_err());
    }

    #[test]
    fn profile_model_update_forwards_model_and_reasoning_effort() {
        let arguments = operation_arguments(ServerNodeOperation::UpdateProfileModel {
            input: UpdateProfileModelInput {
                profile_name: "codex-p".to_string(),
                model: "gpt-5.5".to_string(),
                reasoning_effort: Some("xhigh".to_string()),
            },
        })
        .expect("operation arguments");
        assert_eq!(
            arguments,
            [
                "model",
                "set",
                "--name",
                "codex-p",
                "--model",
                "gpt-5.5",
                "--reasoning-effort",
                "xhigh",
            ]
            .map(str::to_string)
        );
    }

    #[test]
    fn output_reader_drains_stream_and_reports_truncation() {
        let output = read_bounded_output(Cursor::new(vec![b'x'; 256 * 1024]), 64 * 1024);
        assert_eq!(output.bytes.len(), 64 * 1024);
        assert!(output.truncated);
    }

    #[test]
    fn operation_timeouts_match_expected_workload() {
        assert_eq!(
            operation_timeout(&ServerNodeOperation::ListProfiles),
            SSH_READ_TIMEOUT
        );
        assert_eq!(
            operation_timeout(&ServerNodeOperation::ReadSession {
                input: ReadProfileSessionDetailInput {
                    profile_name: "codex-o".to_string(),
                    session_id: "session-1".to_string(),
                    updated_at: None,
                },
            }),
            SSH_DETAIL_TIMEOUT
        );
        assert_eq!(
            operation_timeout(&ServerNodeOperation::ModelRouteCheck {
                profile_name: "codex-o".to_string(),
            }),
            SSH_NETWORK_TIMEOUT
        );
        assert_eq!(
            operation_timeout(&ServerNodeOperation::WechatStart {
                profile_name: "codex-o".to_string(),
            }),
            SSH_CHANNEL_TIMEOUT
        );
    }

    #[test]
    fn wechat_operations_forward_the_selected_profile() {
        for (operation, action) in [
            (
                ServerNodeOperation::WechatStart {
                    profile_name: "codex-p".to_string(),
                },
                "start",
            ),
            (
                ServerNodeOperation::WechatStop {
                    profile_name: "codex-p".to_string(),
                },
                "stop",
            ),
            (
                ServerNodeOperation::WechatRestart {
                    profile_name: "codex-p".to_string(),
                },
                "restart",
            ),
        ] {
            assert_eq!(
                operation_arguments(operation).expect("operation arguments"),
                ["wechat", action, "--name", "codex-p"].map(str::to_string)
            );
        }
    }

    #[test]
    fn same_node_rejects_concurrent_writes() {
        let node_id = "test-node-write-lock";
        let guard = acquire_server_node_write_guard(node_id).expect("first write lock");
        let error = acquire_server_node_write_guard(node_id).expect_err("second write must fail");
        assert!(error.contains("another write operation"));
        drop(guard);
        assert!(acquire_server_node_write_guard(node_id).is_ok());
    }

    #[test]
    fn operation_ids_are_unique_and_traceable() {
        let first = next_server_node_operation_id();
        let second = next_server_node_operation_id();
        assert!(first.starts_with("node-op-"));
        assert_ne!(first, second);
    }
}
