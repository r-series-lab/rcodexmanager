use base64::{engine::general_purpose, Engine as _};
use chrono::{SecondsFormat, Utc};
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use std::collections::BTreeMap;
use std::collections::BTreeSet;
use std::fs;
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{Duration, SystemTime};

const MANAGED_BLOCK_START: &str = "# >>> rCodexManager profiles >>>";
const MANAGED_BLOCK_END: &str = "# <<< rCodexManager profiles <<<";
const DEFAULT_MODEL: &str = "gpt-5.5";
const DEFAULT_REASONING_EFFORT: &str = "xhigh";
const CHATGPT_BASE_URL: &str = "https://chatgpt.com";
const CHATGPT_USAGE_ENDPOINT: &str = "https://chatgpt.com/backend-api/wham/usage";
const QUOTA_HTTP_TIMEOUT_SECONDS: u64 = 25;
const RECENT_SESSION_LIMIT: usize = 8;
const DEFAULT_NO_PROXY: &str = "localhost,127.0.0.1,::1,*.local";
const CODEX_WEBSOCKET_FEATURE_FLAGS: &[&str] = &[
    "responses_websockets",
    "responses_websockets_v2",
    "responses_websocket_response_processed",
];

pub fn app_name() -> &'static str {
    "rCodexManager"
}

pub fn binary_name() -> &'static str {
    "rcodexmanager"
}

pub fn app_identifier() -> &'static str {
    "app.rseries.rcodexmanager"
}

#[derive(Debug, Clone)]
pub struct ProfileContext {
    pub home_dir: PathBuf,
    pub zshrc_path: PathBuf,
}

impl ProfileContext {
    pub fn from_options(
        zshrc_path: Option<PathBuf>,
        home_dir: Option<PathBuf>,
    ) -> Result<Self, String> {
        let resolved_home = home_dir
            .or_else(|| std::env::var_os("HOME").map(PathBuf::from))
            .ok_or_else(|| "HOME is not set; pass --home explicitly".to_string())?;
        let resolved_zshrc = zshrc_path.unwrap_or_else(|| resolved_home.join(".zshrc"));

        Ok(Self {
            home_dir: resolved_home,
            zshrc_path: resolved_zshrc,
        })
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateProfileInput {
    pub name: String,
    pub codex_home: Option<String>,
    pub user_data_dir: Option<String>,
    pub model: Option<String>,
    pub reasoning_effort: Option<String>,
    pub alias: Option<String>,
    pub category: Option<String>,
    pub note: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResetProfileInput {
    pub name: String,
    pub model: Option<String>,
    pub reasoning_effort: Option<String>,
    #[serde(default = "default_true")]
    pub reset_user_data: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportAuthInput {
    pub name: String,
    pub source_path: String,
    #[serde(default)]
    pub confirm_sensitive: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfileInfo {
    pub name: String,
    pub alias: Option<String>,
    pub category: String,
    pub note: Option<String>,
    pub codex_home: String,
    pub user_data_dir: String,
    pub config_path: String,
    pub model: Option<String>,
    pub reasoning_effort: Option<String>,
    pub home_exists: bool,
    pub user_data_exists: bool,
    pub config_exists: bool,
    pub websocket_features_enabled: bool,
    pub managed_by_app: bool,
    pub is_default: bool,
    pub zshrc_line: usize,
    pub is_running: bool,
    pub running_pids: Vec<u32>,
    pub running_process_count: usize,
    pub account: Option<CodexAccountInfo>,
    pub latest_session: Option<CodexSessionSummary>,
    pub recent_sessions: Vec<CodexSessionSummary>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodexSessionSummary {
    pub id: String,
    pub title: String,
    pub summary: Option<String>,
    pub updated_at: Option<String>,
    pub started_at: Option<String>,
    pub cwd: Option<String>,
    pub path: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodexAccountInfo {
    pub auth_mode: Option<String>,
    pub email: Option<String>,
    pub name: Option<String>,
    pub account_id: Option<String>,
    pub user_id: Option<String>,
    pub plan_type: Option<String>,
    pub organization_title: Option<String>,
    pub last_refresh: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QuotaWindowInfo {
    pub id: String,
    pub label: String,
    pub used_percent: Option<f64>,
    pub remaining_percent: Option<f64>,
    pub window_minutes: Option<i64>,
    pub resets_at: Option<i64>,
    pub allowed: Option<bool>,
    pub limit_reached: Option<bool>,
    pub status: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfileQuotaReport {
    pub generated_at: String,
    pub profile_name: String,
    pub account: Option<CodexAccountInfo>,
    pub captured_at: i64,
    pub endpoint: String,
    pub windows: Vec<QuotaWindowInfo>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProxyEnvSettings {
    pub http_proxy: Option<String>,
    pub https_proxy: Option<String>,
    pub all_proxy: Option<String>,
    pub ws_proxy: Option<String>,
    pub wss_proxy: Option<String>,
    pub no_proxy: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodexNetworkRepairReport {
    pub generated_at: String,
    pub profile_name: String,
    pub config_path: String,
    pub config_updated: bool,
    pub feature_flags: Vec<String>,
    pub proxy: Option<ProxyEnvSettings>,
    pub launch_env_updated: bool,
    pub launch_env_error: Option<String>,
    pub message: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfileReport {
    pub generated_at: String,
    pub zshrc_path: String,
    pub metadata_path: String,
    pub home_dir: String,
    pub profile_count: usize,
    pub profiles: Vec<ProfileInfo>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfileSessionReport {
    pub generated_at: String,
    pub session_count: usize,
    pub sessions: Vec<ProfileSessionSummary>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfileSessionSummary {
    pub profile_name: String,
    pub profile_alias: Option<String>,
    pub profile_category: String,
    pub is_default: bool,
    pub session: CodexSessionSummary,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupInfo {
    pub original_path: String,
    pub backup_path: String,
    pub moved: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfileActionReport {
    pub generated_at: String,
    pub action: String,
    pub zshrc_path: String,
    pub profile: Option<ProfileInfo>,
    pub backups: Vec<BackupInfo>,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfileMetadataInput {
    pub name: String,
    pub alias: Option<String>,
    pub category: Option<String>,
    pub note: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProfileMetadata {
    alias: Option<String>,
    category: Option<String>,
    note: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProfileMetadataStore {
    profiles: BTreeMap<String, ProfileMetadata>,
}

#[derive(Debug, Clone)]
struct ShellFunction {
    name: String,
    start_line: usize,
    end_line: usize,
    body: String,
}

#[derive(Debug, Clone)]
struct ProfileDraft {
    name: String,
    codex_home: PathBuf,
    user_data_dir: PathBuf,
}

#[derive(Debug, Clone)]
struct CodexAuthMaterial {
    account: Option<CodexAccountInfo>,
    access_token: Option<String>,
    account_id: Option<String>,
    access_token_expires_at: Option<i64>,
}

#[derive(Debug, Clone)]
struct ImportedAuthPayload {
    auth_json: Value,
    has_refresh_token: bool,
}

pub fn list_profiles(context: &ProfileContext) -> Result<ProfileReport, String> {
    let contents = read_zshrc(context)?;
    let managed_ranges = managed_ranges(&contents);
    let metadata_store = read_metadata_store(context)?;
    let running_processes = running_codex_processes()?;
    let mut profiles = BTreeMap::new();

    if let Some(default_profile) =
        default_profile_info(context, &metadata_store, &running_processes)
    {
        profiles.insert(default_profile.name.clone(), default_profile);
    }

    for function in parse_shell_functions(&contents) {
        if !function.name.starts_with("codex-") {
            continue;
        }

        let Some(codex_home_raw) = extract_shell_value(&function.body, "CODEX_HOME=") else {
            continue;
        };
        let Some(user_data_raw) = extract_shell_value(&function.body, "--user-data-dir=") else {
            continue;
        };

        let codex_home = expand_shell_path(&codex_home_raw, &context.home_dir);
        let user_data_dir = expand_shell_path(&user_data_raw, &context.home_dir);
        let config_path = codex_home.join("config.toml");
        let config = read_codex_config(&config_path);
        let recent_sessions = read_recent_session_summaries(&codex_home, RECENT_SESSION_LIMIT);
        let latest_session = recent_sessions.first().cloned();
        let metadata = metadata_store
            .profiles
            .get(&function.name)
            .cloned()
            .unwrap_or_default();
        let category = metadata
            .category
            .clone()
            .filter(|value| !value.trim().is_empty())
            .unwrap_or_else(|| derived_category(config.reasoning_effort.as_deref()));
        let managed_by_app = managed_ranges
            .iter()
            .any(|(start, end)| function.start_line >= *start && function.end_line <= *end);
        let running_pids = matching_profile_pids(&running_processes, &user_data_dir);

        profiles.insert(
            function.name.clone(),
            ProfileInfo {
                name: function.name,
                alias: metadata.alias,
                category,
                note: metadata.note,
                codex_home: path_string(&codex_home),
                user_data_dir: path_string(&user_data_dir),
                config_path: path_string(&config_path),
                model: config.model,
                reasoning_effort: config.reasoning_effort,
                home_exists: codex_home.exists(),
                user_data_exists: user_data_dir.exists(),
                config_exists: config_path.exists(),
                websocket_features_enabled: config.websocket_features_enabled,
                managed_by_app,
                is_default: false,
                zshrc_line: function.start_line + 1,
                is_running: !running_pids.is_empty(),
                running_process_count: running_pids.len(),
                running_pids,
                account: read_codex_account(&codex_home),
                latest_session,
                recent_sessions,
            },
        );
    }

    let profiles: Vec<_> = profiles.into_values().collect();

    Ok(ProfileReport {
        generated_at: now_iso(),
        zshrc_path: path_string(&context.zshrc_path),
        metadata_path: path_string(&metadata_path(context)),
        home_dir: path_string(&context.home_dir),
        profile_count: profiles.len(),
        profiles,
    })
}

pub fn list_profile_sessions(context: &ProfileContext) -> Result<ProfileSessionReport, String> {
    let report = list_profiles(context)?;
    let mut sessions = Vec::new();

    for profile in report.profiles {
        let codex_home = PathBuf::from(&profile.codex_home);
        sessions.extend(
            read_recent_session_summaries(&codex_home, usize::MAX)
                .into_iter()
                .map(|session| ProfileSessionSummary {
                    profile_name: profile.name.clone(),
                    profile_alias: profile.alias.clone(),
                    profile_category: profile.category.clone(),
                    is_default: profile.is_default,
                    session,
                }),
        );
    }

    sessions.sort_by(|left, right| {
        session_sort_value(&right.session)
            .cmp(session_sort_value(&left.session))
            .then_with(|| left.profile_name.cmp(&right.profile_name))
            .then_with(|| left.session.id.cmp(&right.session.id))
    });

    Ok(ProfileSessionReport {
        generated_at: now_iso(),
        session_count: sessions.len(),
        sessions,
    })
}

pub fn create_profile(
    context: &ProfileContext,
    input: CreateProfileInput,
) -> Result<ProfileActionReport, String> {
    let draft = profile_draft(context, &input)?;
    validate_profile_name(&draft.name)?;

    let contents = read_zshrc(context)?;
    if find_shell_function(&contents, &draft.name).is_some() {
        return Err(format!(
            "profile {} already exists in {}",
            draft.name,
            path_string(&context.zshrc_path)
        ));
    }

    fs::create_dir_all(&draft.codex_home).map_err(|error| error.to_string())?;
    fs::create_dir_all(&draft.user_data_dir).map_err(|error| error.to_string())?;
    write_profile_config(
        &draft.codex_home.join("config.toml"),
        input.model.as_deref().unwrap_or(DEFAULT_MODEL),
        input
            .reasoning_effort
            .as_deref()
            .unwrap_or(DEFAULT_REASONING_EFFORT),
    )?;

    let next_contents = upsert_function(&contents, context, &draft, false)?;
    write_zshrc(context, &contents, &next_contents)?;
    upsert_metadata(
        context,
        ProfileMetadataInput {
            name: draft.name.clone(),
            alias: input.alias,
            category: input.category,
            note: input.note,
        },
    )?;

    let profile = find_profile(context, &draft.name)?;
    Ok(ProfileActionReport {
        generated_at: now_iso(),
        action: "create".to_string(),
        zshrc_path: path_string(&context.zshrc_path),
        profile: Some(profile),
        backups: Vec::new(),
        message: format!("created {} and added its zsh launcher", draft.name),
    })
}

pub fn delete_profile(
    context: &ProfileContext,
    name: &str,
    archive_data: bool,
) -> Result<ProfileActionReport, String> {
    validate_profile_selector_name(name)?;
    let profile = find_profile(context, name)?;
    ensure_mutable_profile(&profile, "delete")?;
    let contents = read_zshrc(context)?;
    let next_contents = remove_function(&contents, name).ok_or_else(|| {
        format!(
            "profile {name} was not found in {}",
            path_string(&context.zshrc_path)
        )
    })?;
    write_zshrc(context, &contents, &next_contents)?;

    let mut backups = Vec::new();
    if archive_data {
        backups.extend(archive_existing_path(
            &PathBuf::from(&profile.codex_home),
            "deleted",
        )?);
        backups.extend(archive_existing_path(
            &PathBuf::from(&profile.user_data_dir),
            "deleted",
        )?);
    }
    remove_metadata(context, name)?;

    Ok(ProfileActionReport {
        generated_at: now_iso(),
        action: "delete".to_string(),
        zshrc_path: path_string(&context.zshrc_path),
        profile: Some(profile),
        backups,
        message: if archive_data {
            format!("removed {name} launcher and archived its data directories")
        } else {
            format!("removed {name} launcher; data directories were kept")
        },
    })
}

pub fn update_profile_metadata(
    context: &ProfileContext,
    input: ProfileMetadataInput,
) -> Result<ProfileActionReport, String> {
    validate_profile_selector_name(&input.name)?;
    find_profile(context, &input.name)?;
    upsert_metadata(context, input.clone())?;
    let profile = find_profile(context, &input.name)?;

    Ok(ProfileActionReport {
        generated_at: now_iso(),
        action: "update".to_string(),
        zshrc_path: path_string(&context.zshrc_path),
        profile: Some(profile),
        backups: Vec::new(),
        message: format!("updated {} metadata", input.name),
    })
}

pub fn reset_profile(
    context: &ProfileContext,
    input: ResetProfileInput,
) -> Result<ProfileActionReport, String> {
    validate_profile_selector_name(&input.name)?;
    let profile = find_profile(context, &input.name)?;
    ensure_mutable_profile(&profile, "reset")?;
    let model = input
        .model
        .or(profile.model.clone())
        .unwrap_or_else(|| DEFAULT_MODEL.to_string());
    let reasoning_effort = input
        .reasoning_effort
        .or(profile.reasoning_effort.clone())
        .unwrap_or_else(|| DEFAULT_REASONING_EFFORT.to_string());

    let mut backups = Vec::new();
    backups.extend(archive_existing_path(
        &PathBuf::from(&profile.codex_home),
        "reset",
    )?);
    if input.reset_user_data {
        backups.extend(archive_existing_path(
            &PathBuf::from(&profile.user_data_dir),
            "reset",
        )?);
    }

    fs::create_dir_all(&profile.codex_home).map_err(|error| error.to_string())?;
    fs::create_dir_all(&profile.user_data_dir).map_err(|error| error.to_string())?;
    write_profile_config(
        &PathBuf::from(&profile.config_path),
        &model,
        &reasoning_effort,
    )?;

    let refreshed = find_profile(context, &input.name)?;
    Ok(ProfileActionReport {
        generated_at: now_iso(),
        action: "reset".to_string(),
        zshrc_path: path_string(&context.zshrc_path),
        profile: Some(refreshed),
        backups,
        message: format!(
            "reset {} with model {} / {}",
            input.name, model, reasoning_effort
        ),
    })
}

pub fn launch_profile(context: &ProfileContext, name: &str) -> Result<ProfileActionReport, String> {
    validate_profile_selector_name(name)?;
    let profile = find_profile(context, name)?;

    fs::create_dir_all(&profile.codex_home).map_err(|error| error.to_string())?;
    fs::create_dir_all(&profile.user_data_dir).map_err(|error| error.to_string())?;

    let mut command = Command::new("open");
    command
        .arg("-n")
        .arg("-a")
        .arg("Codex")
        .arg("--env")
        .arg(format!("CODEX_HOME={}", profile.codex_home));
    if let Ok(proxy) = detect_system_proxy_env() {
        append_open_proxy_env(&mut command, &proxy);
    }
    command
        .arg("--args")
        .arg(format!("--user-data-dir={}", profile.user_data_dir))
        .spawn()
        .map_err(|error| format!("failed to launch Codex: {error}"))?;

    Ok(ProfileActionReport {
        generated_at: now_iso(),
        action: "launch".to_string(),
        zshrc_path: path_string(&context.zshrc_path),
        profile: Some(find_profile(context, name)?),
        backups: Vec::new(),
        message: format!("launched {name}"),
    })
}

pub fn terminate_profile(
    context: &ProfileContext,
    name: &str,
) -> Result<ProfileActionReport, String> {
    validate_profile_selector_name(name)?;
    let profile = find_profile(context, name)?;
    if profile.is_default {
        return Err(
            "default codex profile cannot be terminated safely because macOS does not expose a reliable main-process profile marker".to_string(),
        );
    }
    let pids = profile.running_pids.clone();

    if pids.is_empty() {
        return Ok(ProfileActionReport {
            generated_at: now_iso(),
            action: "terminate".to_string(),
            zshrc_path: path_string(&context.zshrc_path),
            profile: Some(profile),
            backups: Vec::new(),
            message: format!("{name} is not running"),
        });
    }

    let mut command = Command::new("kill");
    for pid in &pids {
        command.arg(pid.to_string());
    }
    let status = command
        .status()
        .map_err(|error| format!("failed to terminate {name}: {error}"))?;
    if !status.success() {
        return Err(format!(
            "failed to terminate {name}; kill exited with {status}"
        ));
    }

    Ok(ProfileActionReport {
        generated_at: now_iso(),
        action: "terminate".to_string(),
        zshrc_path: path_string(&context.zshrc_path),
        profile: Some(find_profile(context, name).unwrap_or(profile)),
        backups: Vec::new(),
        message: format!("terminated {name} ({})", format_pids(&pids)),
    })
}

pub fn read_profile_quota(
    context: &ProfileContext,
    name: &str,
) -> Result<ProfileQuotaReport, String> {
    validate_profile_selector_name(name)?;
    let profile = find_profile(context, name)?;
    let codex_home = PathBuf::from(&profile.codex_home);
    let auth = read_codex_auth_material(&codex_home)
        .ok_or_else(|| format!("{} has no readable auth.json", profile.name))?;
    let access_token = auth.access_token.as_deref().ok_or_else(|| {
        format!(
            "{} auth.json does not contain an access token; open Codex and sign in first",
            profile.name
        )
    })?;

    if auth
        .access_token_expires_at
        .is_some_and(|expires_at| expires_at <= Utc::now().timestamp())
    {
        return Err(format!(
            "{} access token has expired; open this Codex profile once to refresh login, then retry",
            profile.name
        ));
    }

    let account_id = auth.account_id.as_deref().or_else(|| {
        auth.account
            .as_ref()
            .and_then(|account| account.account_id.as_deref())
    });
    let usage = fetch_usage_json(access_token, account_id)?;
    let windows = parse_quota_windows(&usage);
    if windows.is_empty() {
        return Err("usage endpoint returned no quota windows".to_string());
    }

    Ok(ProfileQuotaReport {
        generated_at: now_iso(),
        profile_name: profile.name,
        account: auth.account,
        captured_at: Utc::now().timestamp(),
        endpoint: CHATGPT_USAGE_ENDPOINT.to_string(),
        windows,
    })
}

pub fn import_profile_auth(
    context: &ProfileContext,
    input: ImportAuthInput,
) -> Result<ProfileActionReport, String> {
    validate_profile_selector_name(&input.name)?;
    if !input.confirm_sensitive {
        return Err("must confirm sensitive token import before writing auth.json".to_string());
    }

    let profile = find_profile(context, &input.name)?;
    ensure_mutable_profile(&profile, "import auth into")?;
    if profile.is_running {
        return Err(format!(
            "{} is running; terminate the target profile before importing auth.json",
            profile.name
        ));
    }

    let source_path = resolve_import_source_path(context, &input.source_path)?;
    let target_auth_path = PathBuf::from(&profile.codex_home).join("auth.json");
    ensure_not_same_file(&source_path, &target_auth_path)?;

    let contents = fs::read_to_string(&source_path).map_err(|error| {
        format!(
            "failed to read source auth json {}: {error}",
            path_string(&source_path)
        )
    })?;
    let imported = normalize_import_auth_json(&contents)?;

    if let Some(parent) = target_auth_path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    let mut backups = Vec::new();
    if target_auth_path.exists() {
        backups.push(backup_file_copy(&target_auth_path, "import")?);
    }
    write_json_atomic(&target_auth_path, &imported.auth_json)?;

    let refreshed = find_profile(context, &input.name)?;
    let refresh_hint = if imported.has_refresh_token {
        "refresh_token included"
    } else {
        "refresh_token missing; login may expire"
    };

    Ok(ProfileActionReport {
        generated_at: now_iso(),
        action: "importAuth".to_string(),
        zshrc_path: path_string(&context.zshrc_path),
        profile: Some(refreshed),
        backups,
        message: format!("imported auth.json into {} ({refresh_hint})", profile.name),
    })
}

pub fn repair_profile_network(
    context: &ProfileContext,
    name: &str,
    update_launch_env: bool,
) -> Result<CodexNetworkRepairReport, String> {
    validate_profile_selector_name(name)?;
    let profile = find_profile(context, name)?;
    let codex_home = PathBuf::from(&profile.codex_home);
    fs::create_dir_all(&codex_home).map_err(|error| error.to_string())?;

    let config_path = codex_home.join("config.toml");
    let config_updated = ensure_codex_websocket_features(
        &config_path,
        profile.model.as_deref().unwrap_or(DEFAULT_MODEL),
        profile
            .reasoning_effort
            .as_deref()
            .unwrap_or(DEFAULT_REASONING_EFFORT),
    )?;

    let proxy = detect_system_proxy_env().ok();
    let mut launch_env_updated = false;
    let mut launch_env_error = None;
    if update_launch_env {
        if let Some(proxy) = proxy.as_ref() {
            match apply_launchctl_proxy_env(proxy) {
                Ok(()) => launch_env_updated = true,
                Err(error) => launch_env_error = Some(error),
            }
        }
    }

    let message = match (config_updated, proxy.is_some(), launch_env_updated) {
        (true, true, true) => format!(
            "repaired {name}: enabled WebSocket flags and synced launch proxy; restart Codex to use the new environment"
        ),
        (false, true, true) => format!(
            "{name} already had WebSocket flags; synced launch proxy, restart Codex to use it"
        ),
        (true, true, false) => {
            format!("enabled WebSocket flags for {name}; proxy was detected but launch env was not updated")
        }
        (false, true, false) => {
            format!("{name} already had WebSocket flags; proxy was detected but launch env was not updated")
        }
        (true, false, _) => format!(
            "enabled WebSocket flags for {name}; no macOS system proxy was detected"
        ),
        (false, false, _) => format!(
            "{name} already had WebSocket flags; no macOS system proxy was detected"
        ),
    };

    Ok(CodexNetworkRepairReport {
        generated_at: now_iso(),
        profile_name: profile.name,
        config_path: path_string(&config_path),
        config_updated,
        feature_flags: CODEX_WEBSOCKET_FEATURE_FLAGS
            .iter()
            .map(|flag| (*flag).to_string())
            .collect(),
        proxy,
        launch_env_updated,
        launch_env_error,
        message,
    })
}

pub fn reveal_in_finder(path: PathBuf) -> Result<(), String> {
    if !path.exists() {
        return Err(format!("path does not exist: {}", path_string(&path)));
    }

    Command::new("open")
        .arg("-R")
        .arg(&path)
        .status()
        .map_err(|error| error.to_string())?;

    Ok(())
}

pub fn default_profile_paths(
    context: &ProfileContext,
    name: &str,
) -> Result<(PathBuf, PathBuf), String> {
    validate_profile_name(name)?;
    let suffix = name.strip_prefix("codex-").unwrap_or(name);
    let codex_home = context.home_dir.join(format!(".codex-{suffix}"));
    let user_data_dir = context
        .home_dir
        .join("Library")
        .join("Application Support")
        .join(format!("Codex-{}", title_suffix(suffix)));
    Ok((codex_home, user_data_dir))
}

fn default_main_profile_paths(context: &ProfileContext) -> (PathBuf, PathBuf) {
    let codex_home = context.home_dir.join(".codex");
    let user_data_dir = context
        .home_dir
        .join("Library")
        .join("Application Support")
        .join("Codex");
    (codex_home, user_data_dir)
}

fn default_profile_info(
    context: &ProfileContext,
    metadata_store: &ProfileMetadataStore,
    running_processes: &[RunningCodexProcess],
) -> Option<ProfileInfo> {
    let (codex_home, user_data_dir) = default_main_profile_paths(context);
    let config_path = codex_home.join("config.toml");
    let running_pids = matching_default_profile_pids(running_processes, &user_data_dir);
    let recent_sessions = read_recent_session_summaries(&codex_home, RECENT_SESSION_LIMIT);
    let latest_session = recent_sessions.first().cloned();
    let should_show = codex_home.exists() || user_data_dir.exists();
    if !should_show {
        return None;
    }

    let config = read_codex_config(&config_path);
    let metadata = metadata_store
        .profiles
        .get("codex")
        .cloned()
        .unwrap_or_default();
    let category = metadata
        .category
        .clone()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| "默认".to_string());

    Some(ProfileInfo {
        name: "codex".to_string(),
        alias: metadata.alias,
        category,
        note: metadata.note,
        codex_home: path_string(&codex_home),
        user_data_dir: path_string(&user_data_dir),
        config_path: path_string(&config_path),
        model: config.model,
        reasoning_effort: config.reasoning_effort,
        home_exists: codex_home.exists(),
        user_data_exists: user_data_dir.exists(),
        config_exists: config_path.exists(),
        websocket_features_enabled: config.websocket_features_enabled,
        managed_by_app: false,
        is_default: true,
        zshrc_line: 0,
        is_running: !running_pids.is_empty(),
        running_process_count: running_pids.len(),
        running_pids,
        account: read_codex_account(&codex_home),
        latest_session,
        recent_sessions,
    })
}

fn profile_draft(
    context: &ProfileContext,
    input: &CreateProfileInput,
) -> Result<ProfileDraft, String> {
    let name = input.name.trim().to_string();
    validate_profile_name(&name)?;
    let (default_home, default_user_data) = default_profile_paths(context, &name)?;
    let codex_home = input
        .codex_home
        .as_deref()
        .filter(|value| !value.trim().is_empty())
        .map(|value| expand_shell_path(value, &context.home_dir))
        .unwrap_or(default_home);
    let user_data_dir = input
        .user_data_dir
        .as_deref()
        .filter(|value| !value.trim().is_empty())
        .map(|value| expand_shell_path(value, &context.home_dir))
        .unwrap_or(default_user_data);

    Ok(ProfileDraft {
        name,
        codex_home,
        user_data_dir,
    })
}

fn find_profile(context: &ProfileContext, name: &str) -> Result<ProfileInfo, String> {
    list_profiles(context)?
        .profiles
        .into_iter()
        .find(|profile| profile.name == name)
        .ok_or_else(|| format!("profile {name} was not found"))
}

#[derive(Debug, Clone)]
struct RunningCodexProcess {
    pid: u32,
    command: String,
}

fn running_codex_processes() -> Result<Vec<RunningCodexProcess>, String> {
    let output = Command::new("ps")
        .args(["axww", "-o", "pid=,command="])
        .output()
        .map_err(|error| format!("failed to inspect running Codex processes: {error}"))?;
    if !output.status.success() {
        return Err(format!(
            "failed to inspect running Codex processes; ps exited with {}",
            output.status
        ));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok(stdout
        .lines()
        .filter_map(parse_running_codex_process)
        .collect())
}

fn parse_running_codex_process(line: &str) -> Option<RunningCodexProcess> {
    let trimmed = line.trim_start();
    let (pid_raw, command_raw) = trimmed.split_once(char::is_whitespace)?;
    let pid = pid_raw.parse().ok()?;
    let command = command_raw.trim().to_string();
    if is_codex_main_process(&command) {
        Some(RunningCodexProcess { pid, command })
    } else {
        None
    }
}

fn is_codex_main_process(command: &str) -> bool {
    command.ends_with(".app/Contents/MacOS/Codex")
        || command.contains(".app/Contents/MacOS/Codex --")
}

fn matching_profile_pids(processes: &[RunningCodexProcess], user_data_dir: &Path) -> Vec<u32> {
    processes
        .iter()
        .filter(|process| command_has_user_data_dir(&process.command, user_data_dir))
        .map(|process| process.pid)
        .collect()
}

fn matching_default_profile_pids(
    processes: &[RunningCodexProcess],
    user_data_dir: &Path,
) -> Vec<u32> {
    processes
        .iter()
        .filter(|process| command_has_user_data_dir(&process.command, user_data_dir))
        .map(|process| process.pid)
        .collect()
}

fn command_has_user_data_dir(command: &str, user_data_dir: &Path) -> bool {
    let marker = format!("--user-data-dir={}", path_string(user_data_dir));
    command.match_indices(&marker).any(|(start, _)| {
        let end = start + marker.len();
        match command[end..].chars().next() {
            Some(next_char) => next_char.is_whitespace(),
            None => true,
        }
    })
}

fn format_pids(pids: &[u32]) -> String {
    pids.iter()
        .map(u32::to_string)
        .collect::<Vec<_>>()
        .join(", ")
}

#[derive(Debug, Clone, Deserialize)]
struct SessionIndexEntry {
    id: String,
    thread_name: Option<String>,
    updated_at: Option<String>,
}

#[derive(Debug, Default)]
struct SessionFileDetails {
    id: Option<String>,
    started_at: Option<String>,
    cwd: Option<String>,
    summary: Option<String>,
}

fn read_recent_session_summaries(codex_home: &Path, limit: usize) -> Vec<CodexSessionSummary> {
    if limit == 0 {
        return Vec::new();
    }

    let index_entries = read_session_index_entries(codex_home);
    let sessions_dir = codex_home.join("sessions");
    let mut files = Vec::new();
    collect_session_files(&sessions_dir, &mut files);
    files.sort_by_key(session_modified_at);
    files.reverse();

    let mut summaries = Vec::new();
    let mut seen_ids = BTreeSet::new();
    let mut seen_paths = BTreeSet::new();

    for entry in index_entries {
        if summaries.len() >= limit {
            break;
        }
        let session_path = find_session_file_by_id_in_files(&files, &entry.id);
        if let Some(summary) = session_summary_from_parts(Some(entry), session_path.as_deref()) {
            if remember_session_summary(&summary, &mut seen_ids, &mut seen_paths) {
                summaries.push(summary);
            }
        }
    }

    for path in files {
        if summaries.len() >= limit {
            break;
        }
        if let Some(summary) = session_summary_from_parts(None, Some(path.as_path())) {
            if remember_session_summary(&summary, &mut seen_ids, &mut seen_paths) {
                summaries.push(summary);
            }
        }
    }

    summaries
}

fn session_summary_from_parts(
    index_entry: Option<SessionIndexEntry>,
    session_path: Option<&Path>,
) -> Option<CodexSessionSummary> {
    let details = session_path
        .map(read_session_file_details)
        .unwrap_or_default();

    let id = index_entry
        .as_ref()
        .map(|entry| entry.id.clone())
        .or(details.id)
        .or_else(|| {
            session_path
                .as_ref()
                .and_then(|path| path.file_stem())
                .map(|value| value.to_string_lossy().to_string())
        })?;
    let title = index_entry
        .as_ref()
        .and_then(|entry| normalize_session_title(entry.thread_name.as_deref()))
        .or_else(|| details.summary.as_deref().and_then(summary_title_from_text))
        .unwrap_or_else(|| "未命名会话".to_string());
    let path = session_path.map(path_string);

    Some(CodexSessionSummary {
        id,
        title,
        summary: details.summary,
        updated_at: index_entry.and_then(|entry| entry.updated_at),
        started_at: details.started_at,
        cwd: details.cwd,
        path,
    })
}

fn read_session_index_entries(codex_home: &Path) -> Vec<SessionIndexEntry> {
    let Ok(file) = fs::File::open(codex_home.join("session_index.jsonl")) else {
        return Vec::new();
    };
    let reader = BufReader::new(file);
    let mut entries = reader
        .lines()
        .map_while(Result::ok)
        .filter_map(|line| {
            let trimmed = line.trim();
            if trimmed.is_empty() {
                return None;
            }
            let entry = serde_json::from_str::<SessionIndexEntry>(trimmed).ok()?;
            if entry.id.trim().is_empty() {
                None
            } else {
                Some(entry)
            }
        })
        .collect::<Vec<_>>();
    entries.sort_by(|left, right| {
        right
            .updated_at
            .as_deref()
            .unwrap_or_default()
            .cmp(left.updated_at.as_deref().unwrap_or_default())
            .then_with(|| left.id.cmp(&right.id))
    });
    entries
}

fn find_session_file_by_id_in_files(files: &[PathBuf], id: &str) -> Option<PathBuf> {
    let id = id.trim();
    if id.is_empty() {
        return None;
    }
    files
        .iter()
        .filter(|path| {
            path.file_name()
                .map(|name| name.to_string_lossy().contains(id))
                .unwrap_or(false)
        })
        .max_by_key(|path| session_modified_at(path))
        .cloned()
}

fn collect_session_files(dir: &Path, out: &mut Vec<PathBuf>) {
    let Ok(entries) = fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            collect_session_files(&path, out);
        } else if path.extension().and_then(|value| value.to_str()) == Some("jsonl") {
            out.push(path);
        }
    }
}

fn session_modified_at(path: &PathBuf) -> SystemTime {
    path.metadata()
        .and_then(|metadata| metadata.modified())
        .unwrap_or(SystemTime::UNIX_EPOCH)
}

fn session_sort_value(session: &CodexSessionSummary) -> &str {
    session
        .updated_at
        .as_deref()
        .or(session.started_at.as_deref())
        .unwrap_or_default()
}

fn remember_session_summary(
    summary: &CodexSessionSummary,
    seen_ids: &mut BTreeSet<String>,
    seen_paths: &mut BTreeSet<String>,
) -> bool {
    let id_seen = !summary.id.trim().is_empty() && !seen_ids.insert(summary.id.clone());
    let path_seen = summary
        .path
        .as_ref()
        .is_some_and(|path| !seen_paths.insert(path.clone()));
    !(id_seen || path_seen)
}

fn read_session_file_details(path: &Path) -> SessionFileDetails {
    let Ok(file) = fs::File::open(path) else {
        return SessionFileDetails::default();
    };
    let reader = BufReader::new(file);
    let mut details = SessionFileDetails::default();

    for line in reader.lines().map_while(Result::ok) {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        let Ok(root) = serde_json::from_str::<Value>(trimmed) else {
            continue;
        };
        match string_at(&root, &["type"]).as_deref() {
            Some("session_meta") => {
                if let Some(payload) = root.get("payload") {
                    if details.id.is_none() {
                        details.id = string_at(payload, &["id"]);
                    }
                    if details.started_at.is_none() {
                        details.started_at = string_at(payload, &["timestamp"]);
                    }
                    if details.cwd.is_none() {
                        details.cwd = string_at(payload, &["cwd"]);
                    }
                }
            }
            Some("response_item") => {
                if let Some(message) = root
                    .get("payload")
                    .and_then(extract_user_response_item_text)
                {
                    if let Some(candidate) = session_summary_candidate(&message) {
                        details.summary = Some(candidate);
                    }
                }
            }
            Some("event_msg") => {
                if let Some(payload) = root.get("payload") {
                    if string_at(payload, &["type"]).as_deref() == Some("user_message") {
                        if let Some(message) = string_at(payload, &["message"]) {
                            if let Some(candidate) = session_summary_candidate(&message) {
                                details.summary = Some(candidate);
                            }
                        }
                    }
                }
            }
            _ => {}
        }
    }

    details
}

fn extract_user_response_item_text(payload: &Value) -> Option<String> {
    if string_at(payload, &["type"]).as_deref() != Some("message")
        || string_at(payload, &["role"]).as_deref() != Some("user")
    {
        return None;
    }
    let items = payload.get("content")?.as_array()?;
    let text = items
        .iter()
        .filter(|item| string_at(item, &["type"]).as_deref() == Some("input_text"))
        .filter_map(|item| string_at(item, &["text"]))
        .collect::<Vec<_>>()
        .join("\n");
    if text.trim().is_empty() {
        None
    } else {
        Some(text)
    }
}

fn session_summary_candidate(value: &str) -> Option<String> {
    let normalized = normalize_session_text(value);
    if normalized.is_empty() || is_technical_session_text(&normalized) {
        return None;
    }
    Some(truncate_chars(&normalized, 220))
}

fn normalize_session_title(value: Option<&str>) -> Option<String> {
    value
        .map(normalize_session_text)
        .filter(|value| !value.is_empty())
        .map(|value| truncate_chars(&value, 64))
}

fn summary_title_from_text(value: &str) -> Option<String> {
    let title = truncate_chars(value, 36);
    if title.is_empty() {
        None
    } else {
        Some(title)
    }
}

fn normalize_session_text(value: &str) -> String {
    value
        .replace("<image>", "")
        .replace("</image>", "")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

fn is_technical_session_text(value: &str) -> bool {
    let trimmed = value.trim_start();
    [
        "<environment_context>",
        "<skill>",
        "<permissions instructions>",
        "<app-context>",
        "<collaboration_mode>",
        "<skills_instructions>",
        "<plugins_instructions>",
        "<developer",
        "<system",
    ]
    .iter()
    .any(|prefix| trimmed.starts_with(prefix))
}

fn truncate_chars(value: &str, max_chars: usize) -> String {
    if value.chars().count() <= max_chars {
        return value.to_string();
    }
    let keep = max_chars.saturating_sub(3);
    format!("{}...", value.chars().take(keep).collect::<String>())
}

fn read_codex_account(codex_home: &Path) -> Option<CodexAccountInfo> {
    read_codex_auth_material(codex_home)?.account
}

fn read_codex_auth_material(codex_home: &Path) -> Option<CodexAuthMaterial> {
    let auth_path = codex_home.join("auth.json");
    let contents = fs::read_to_string(auth_path).ok()?;
    let root: Value = serde_json::from_str(&contents).ok()?;
    read_codex_auth_material_from_value(&root)
}

fn read_codex_auth_material_from_value(root: &Value) -> Option<CodexAuthMaterial> {
    let tokens = root.get("tokens").unwrap_or(&Value::Null);
    let access_token = string_at(tokens, &["access_token"]);
    let claims = tokens
        .get("id_token")
        .and_then(Value::as_str)
        .and_then(decode_jwt_payload)
        .or_else(|| {
            tokens
                .get("access_token")
                .and_then(Value::as_str)
                .and_then(decode_jwt_payload)
        });
    let auth_claim = claims
        .as_ref()
        .and_then(|value| value.get("https://api.openai.com/auth"));
    let profile_claim = claims
        .as_ref()
        .and_then(|value| value.get("https://api.openai.com/profile"));

    let auth_mode = string_at(&root, &["auth_mode"]);
    let account_id = string_at(tokens, &["account_id"])
        .or_else(|| string_at(auth_claim?, &["chatgpt_account_id"]));
    let email = claims
        .as_ref()
        .and_then(|value| string_at(value, &["email"]))
        .or_else(|| profile_claim.and_then(|value| string_at(value, &["email"])));
    let name = claims
        .as_ref()
        .and_then(|value| string_at(value, &["name"]));
    let user_id = auth_claim.and_then(|value| {
        string_at(value, &["chatgpt_user_id"]).or_else(|| string_at(value, &["user_id"]))
    });
    let plan_type = auth_claim.and_then(|value| string_at(value, &["chatgpt_plan_type"]));
    let organization_title = auth_claim.and_then(default_organization_title);
    let last_refresh = string_at(&root, &["last_refresh"]);
    let access_token_expires_at = tokens
        .get("access_token")
        .and_then(Value::as_str)
        .and_then(decode_jwt_payload)
        .and_then(|value| value.get("exp").and_then(Value::as_i64));

    let account = if auth_mode.is_none()
        && account_id.is_none()
        && email.is_none()
        && name.is_none()
        && user_id.is_none()
        && plan_type.is_none()
        && organization_title.is_none()
    {
        None
    } else {
        Some(CodexAccountInfo {
            auth_mode,
            email,
            name,
            account_id: account_id.clone(),
            user_id,
            plan_type,
            organization_title,
            last_refresh,
        })
    };

    if account.is_none() && access_token.is_none() {
        return None;
    }

    Some(CodexAuthMaterial {
        account,
        access_token,
        account_id,
        access_token_expires_at,
    })
}

fn fetch_usage_json(access_token: &str, account_id: Option<&str>) -> Result<Value, String> {
    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(QUOTA_HTTP_TIMEOUT_SECONDS))
        .user_agent(format!(
            "rCodexManager/{} ({})",
            env!("CARGO_PKG_VERSION"),
            CHATGPT_BASE_URL
        ))
        .build()
        .map_err(|error| format!("failed to build usage client: {error}"))?;

    let mut request = client
        .get(CHATGPT_USAGE_ENDPOINT)
        .bearer_auth(access_token)
        .header("Accept", "application/json")
        .header("Origin", CHATGPT_BASE_URL)
        .header("Referer", format!("{CHATGPT_BASE_URL}/"));
    if let Some(account_id) = account_id.map(str::trim).filter(|value| !value.is_empty()) {
        request = request.header("ChatGPT-Account-ID", account_id);
    }

    let response = request
        .send()
        .map_err(|error| format!("usage request failed: {error}"))?;
    let status = response.status();
    let content_type = response
        .headers()
        .get("content-type")
        .and_then(|value| value.to_str().ok())
        .unwrap_or("")
        .to_string();

    if !status.is_success() {
        let body = response.text().unwrap_or_default();
        return Err(format_usage_http_error(status.as_u16(), &body));
    }
    if content_type.to_ascii_lowercase().contains("text/html") {
        return Err(
            "usage endpoint returned HTML; ChatGPT may require browser verification".to_string(),
        );
    }

    response
        .json::<Value>()
        .map_err(|error| format!("failed to parse usage response: {error}"))
}

fn resolve_import_source_path(
    context: &ProfileContext,
    source_path: &str,
) -> Result<PathBuf, String> {
    let trimmed = source_path.trim();
    if trimmed.is_empty() {
        return Err("source path is required".to_string());
    }
    let expanded = expand_shell_path(trimmed, &context.home_dir);
    let candidate = if expanded.is_dir() {
        expanded.join("auth.json")
    } else {
        expanded
    };
    if !candidate.exists() {
        return Err(format!(
            "source auth json does not exist: {}",
            path_string(&candidate)
        ));
    }
    if !candidate.is_file() {
        return Err(format!(
            "source path is not a file: {}",
            path_string(&candidate)
        ));
    }
    Ok(candidate)
}

fn ensure_not_same_file(source: &Path, target: &Path) -> Result<(), String> {
    if !target.exists() {
        return Ok(());
    }
    let source_canonical = fs::canonicalize(source).map_err(|error| error.to_string())?;
    let target_canonical = fs::canonicalize(target).map_err(|error| error.to_string())?;
    if source_canonical == target_canonical {
        return Err("source auth.json is the same file as the target auth.json".to_string());
    }
    Ok(())
}

fn normalize_import_auth_json(contents: &str) -> Result<ImportedAuthPayload, String> {
    let source: Value = serde_json::from_str(contents)
        .map_err(|error| format!("failed to parse source json: {error}"))?;
    let access_token = required_string_any(
        &[
            (&source, &["tokens", "access_token"]),
            (&source, &["tokens", "accessToken"]),
            (&source, &["access_token"]),
            (&source, &["accessToken"]),
        ],
        "access_token/accessToken",
    )?;
    let id_token = optional_string_any(&[
        (&source, &["tokens", "id_token"]),
        (&source, &["tokens", "idToken"]),
        (&source, &["id_token"]),
        (&source, &["idToken"]),
    ]);
    let refresh_token = optional_string_any(&[
        (&source, &["tokens", "refresh_token"]),
        (&source, &["tokens", "refreshToken"]),
        (&source, &["refresh_token"]),
        (&source, &["refreshToken"]),
    ]);
    let account_id = optional_string_any(&[
        (&source, &["tokens", "account_id"]),
        (&source, &["tokens", "accountId"]),
        (&source, &["account_id"]),
        (&source, &["accountId"]),
        (&source, &["tokens", "chatgpt_account_id"]),
        (&source, &["tokens", "chatgptAccountId"]),
        (&source, &["chatgpt_account_id"]),
        (&source, &["chatgptAccountId"]),
    ])
    .or_else(|| {
        id_token
            .as_deref()
            .and_then(extract_chatgpt_account_id_from_token)
    })
    .or_else(|| extract_chatgpt_account_id_from_token(&access_token));

    let mut root = if source.get("tokens").is_some() {
        source.as_object().cloned().unwrap_or_default()
    } else {
        Map::new()
    };
    root.entry("auth_mode".to_string())
        .or_insert_with(|| Value::String("chatgpt".to_string()));
    root.entry("last_refresh".to_string())
        .or_insert_with(|| Value::String(now_iso()));

    let existing_tokens = root
        .remove("tokens")
        .and_then(|value| value.as_object().cloned())
        .unwrap_or_default();
    let mut tokens = existing_tokens;
    tokens.insert("access_token".to_string(), Value::String(access_token));
    if let Some(id_token) = id_token {
        tokens.insert("id_token".to_string(), Value::String(id_token));
    }
    if let Some(refresh_token) = refresh_token.clone() {
        tokens.insert("refresh_token".to_string(), Value::String(refresh_token));
    }
    if let Some(account_id) = account_id {
        tokens.insert("account_id".to_string(), Value::String(account_id));
    }
    root.insert("tokens".to_string(), Value::Object(tokens));

    let auth_json = Value::Object(root);
    if read_codex_auth_material_from_value(&auth_json)
        .and_then(|material| material.access_token)
        .is_none()
    {
        return Err("source json could not be normalized as Codex auth.json".to_string());
    }

    Ok(ImportedAuthPayload {
        auth_json,
        has_refresh_token: refresh_token.is_some(),
    })
}

fn backup_file_copy(path: &Path, label: &str) -> Result<BackupInfo, String> {
    let file_name = path
        .file_name()
        .map(|value| value.to_string_lossy())
        .unwrap_or_else(|| "auth.json".into());
    let backup_path = path.with_file_name(format!(
        "{file_name}.rcodexmanager-{label}-{}.bak",
        timestamp_compact()
    ));
    fs::copy(path, &backup_path).map_err(|error| error.to_string())?;
    Ok(BackupInfo {
        original_path: path_string(path),
        backup_path: path_string(&backup_path),
        moved: false,
    })
}

fn write_json_atomic(path: &Path, value: &Value) -> Result<(), String> {
    let payload = serde_json::to_string_pretty(value).map_err(|error| error.to_string())?;
    let tmp_path = path.with_file_name(format!(
        ".{}.rcodexmanager-{}.tmp",
        path.file_name()
            .map(|value| value.to_string_lossy())
            .unwrap_or_else(|| "auth.json".into()),
        timestamp_compact()
    ));
    fs::write(&tmp_path, format!("{payload}\n")).map_err(|error| error.to_string())?;
    fs::rename(&tmp_path, path).map_err(|error| {
        let _ = fs::remove_file(&tmp_path);
        error.to_string()
    })
}

fn format_usage_http_error(status: u16, body: &str) -> String {
    let status_hint = match status {
        401 => {
            "usage endpoint returned 401; the access token may be expired, open this Codex profile once and retry"
        }
        403 => "usage endpoint returned 403; ChatGPT may require browser verification or a different network",
        _ => "usage endpoint returned an error",
    };
    let body_hint = compact_body_hint(body);
    if body_hint.is_empty() {
        format!("{status_hint} (status {status})")
    } else {
        format!("{status_hint} (status {status}): {body_hint}")
    }
}

fn compact_body_hint(body: &str) -> String {
    body.split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .chars()
        .take(220)
        .collect()
}

fn parse_quota_windows(root: &Value) -> Vec<QuotaWindowInfo> {
    let mut windows = Vec::new();
    if let Some(rate_limit) = root.get("rate_limit") {
        append_quota_window(
            &mut windows,
            "primary",
            "主窗口",
            rate_limit.get("primary_window"),
            None,
            None,
        );
        append_quota_window(
            &mut windows,
            "secondary",
            "长窗口",
            rate_limit.get("secondary_window"),
            None,
            None,
        );
    }

    if let Some(object) = root.as_object() {
        for (key, value) in object {
            if key == "rate_limit" || !key.ends_with("_rate_limit") {
                continue;
            }
            append_extra_quota_windows(&mut windows, key, value);
        }
    }

    match root.get("additional_rate_limits") {
        Some(Value::Array(items)) => {
            for (index, item) in items.iter().enumerate() {
                let fallback = format!("additional_rate_limits[{index}]");
                append_extra_quota_windows(&mut windows, &fallback, item);
            }
        }
        Some(Value::Object(items)) => {
            for (key, item) in items {
                append_extra_quota_windows(&mut windows, key, item);
            }
        }
        _ => {}
    }

    windows
}

fn append_extra_quota_windows(out: &mut Vec<QuotaWindowInfo>, source_key: &str, value: &Value) {
    let rate_limit = value.get("rate_limit").unwrap_or(value);
    let limit_id = string_at(value, &["limit_id"])
        .or_else(|| string_at(value, &["metered_feature"]))
        .or_else(|| string_at(value, &["limit_name"]))
        .unwrap_or_else(|| source_key.to_string());
    let label = string_at(value, &["limit_name"])
        .or_else(|| string_at(value, &["metered_feature"]))
        .unwrap_or_else(|| title_limit_label(source_key));
    let allowed = bool_at(value, &["allowed"]).or_else(|| bool_at(rate_limit, &["allowed"]));
    let limit_reached =
        bool_at(value, &["limit_reached"]).or_else(|| bool_at(rate_limit, &["limit_reached"]));
    let has_primary = rate_limit.get("primary_window").is_some();
    let has_secondary = rate_limit.get("secondary_window").is_some();
    let primary_label = if has_secondary {
        format!("{label} 主")
    } else {
        label.clone()
    };
    append_quota_window(
        out,
        &format!("{limit_id}:primary"),
        &primary_label,
        rate_limit.get("primary_window"),
        allowed,
        limit_reached,
    );
    if has_secondary {
        append_quota_window(
            out,
            &format!("{limit_id}:secondary"),
            &format!("{label} 长"),
            rate_limit.get("secondary_window"),
            allowed,
            limit_reached,
        );
    } else if !has_primary {
        append_quota_window(
            out,
            &limit_id,
            &label,
            Some(rate_limit),
            allowed,
            limit_reached,
        );
    }
}

fn append_quota_window(
    out: &mut Vec<QuotaWindowInfo>,
    id: &str,
    label: &str,
    window: Option<&Value>,
    allowed: Option<bool>,
    limit_reached: Option<bool>,
) {
    let Some(window) = window else {
        return;
    };
    if !window.is_object() {
        return;
    }
    let used_percent = number_at(window, &["used_percent"]);
    let remaining_percent = used_percent.map(|value| (100.0 - value).clamp(0.0, 100.0));
    let window_minutes =
        int_at(window, &["limit_window_seconds"]).map(|seconds| (seconds + 59) / 60);
    let resets_at = int_at(window, &["reset_at"]);

    if used_percent.is_none()
        && window_minutes.is_none()
        && resets_at.is_none()
        && allowed.is_none()
        && limit_reached.is_none()
    {
        return;
    }

    out.push(QuotaWindowInfo {
        id: id.to_string(),
        label: label.to_string(),
        used_percent,
        remaining_percent,
        window_minutes,
        resets_at,
        allowed,
        limit_reached,
        status: quota_window_status(used_percent, allowed, limit_reached).to_string(),
    });
}

fn quota_window_status(
    used_percent: Option<f64>,
    allowed: Option<bool>,
    limit_reached: Option<bool>,
) -> &'static str {
    if limit_reached.unwrap_or(false) || allowed == Some(false) {
        return "exhausted";
    }
    match used_percent {
        Some(value) if value >= 100.0 => "exhausted",
        Some(value) if value >= 80.0 => "low",
        Some(_) => "available",
        None => "unknown",
    }
}

fn title_limit_label(value: &str) -> String {
    value
        .trim_end_matches("_rate_limit")
        .replace('_', " ")
        .split_whitespace()
        .map(|part| {
            let mut chars = part.chars();
            match chars.next() {
                Some(first) => format!("{}{}", first.to_ascii_uppercase(), chars.as_str()),
                None => String::new(),
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

fn decode_jwt_payload(token: &str) -> Option<Value> {
    let payload = token.split('.').nth(1)?;
    let bytes = general_purpose::URL_SAFE_NO_PAD
        .decode(payload)
        .or_else(|_| general_purpose::URL_SAFE.decode(payload))
        .ok()?;
    serde_json::from_slice(&bytes).ok()
}

fn string_at(value: &Value, path: &[&str]) -> Option<String> {
    let mut current = value;
    for key in path {
        current = current.get(*key)?;
    }
    current
        .as_str()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToString::to_string)
}

fn required_string_any(candidates: &[(&Value, &[&str])], label: &str) -> Result<String, String> {
    optional_string_any(candidates).ok_or_else(|| format!("missing field: {label}"))
}

fn optional_string_any(candidates: &[(&Value, &[&str])]) -> Option<String> {
    candidates
        .iter()
        .find_map(|(value, path)| string_at(value, path))
}

fn extract_chatgpt_account_id_from_token(token: &str) -> Option<String> {
    let claims = decode_jwt_payload(token)?;
    claims
        .get("https://api.openai.com/auth")
        .and_then(|value| string_at(value, &["chatgpt_account_id"]))
        .or_else(|| string_at(&claims, &["chatgpt_account_id"]))
        .or_else(|| string_at(&claims, &["account_id"]))
}

fn bool_at(value: &Value, path: &[&str]) -> Option<bool> {
    let mut current = value;
    for key in path {
        current = current.get(*key)?;
    }
    current.as_bool()
}

fn int_at(value: &Value, path: &[&str]) -> Option<i64> {
    let mut current = value;
    for key in path {
        current = current.get(*key)?;
    }
    current.as_i64()
}

fn number_at(value: &Value, path: &[&str]) -> Option<f64> {
    let mut current = value;
    for key in path {
        current = current.get(*key)?;
    }
    current.as_f64()
}

fn default_organization_title(auth_claim: &Value) -> Option<String> {
    let organizations = auth_claim.get("organizations")?.as_array()?;
    let selected = organizations
        .iter()
        .find(|item| {
            item.get("is_default")
                .and_then(Value::as_bool)
                .unwrap_or(false)
        })
        .or_else(|| organizations.first())?;
    string_at(selected, &["title"])
}

fn read_zshrc(context: &ProfileContext) -> Result<String, String> {
    if !context.zshrc_path.exists() {
        return Ok(String::new());
    }
    fs::read_to_string(&context.zshrc_path).map_err(|error| error.to_string())
}

fn metadata_path(context: &ProfileContext) -> PathBuf {
    context
        .home_dir
        .join(".rcodexmanager")
        .join("profile-metadata.json")
}

fn read_metadata_store(context: &ProfileContext) -> Result<ProfileMetadataStore, String> {
    let path = metadata_path(context);
    if !path.exists() {
        return Ok(ProfileMetadataStore::default());
    }

    let contents = fs::read_to_string(&path).map_err(|error| error.to_string())?;
    serde_json::from_str(&contents).map_err(|error| {
        format!(
            "failed to parse metadata file {}: {error}",
            path_string(&path)
        )
    })
}

fn write_metadata_store(
    context: &ProfileContext,
    store: &ProfileMetadataStore,
) -> Result<(), String> {
    let path = metadata_path(context);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let payload = serde_json::to_string_pretty(store).map_err(|error| error.to_string())?;
    fs::write(path, format!("{payload}\n")).map_err(|error| error.to_string())
}

fn upsert_metadata(context: &ProfileContext, input: ProfileMetadataInput) -> Result<(), String> {
    let mut store = read_metadata_store(context)?;
    let current = store.profiles.remove(&input.name).unwrap_or_default();
    let next = ProfileMetadata {
        alias: merge_metadata_field(current.alias, input.alias),
        category: merge_metadata_field(current.category, input.category),
        note: merge_metadata_field(current.note, input.note),
    };

    if next.alias.is_some() || next.category.is_some() || next.note.is_some() {
        store.profiles.insert(input.name, next);
    }

    write_metadata_store(context, &store)
}

fn merge_metadata_field(current: Option<String>, incoming: Option<String>) -> Option<String> {
    match incoming {
        Some(value) => {
            let trimmed = value.trim();
            if trimmed.is_empty() {
                None
            } else {
                Some(trimmed.to_string())
            }
        }
        None => current,
    }
}

fn remove_metadata(context: &ProfileContext, name: &str) -> Result<(), String> {
    let mut store = read_metadata_store(context)?;
    store.profiles.remove(name);
    write_metadata_store(context, &store)
}

fn write_zshrc(context: &ProfileContext, previous: &str, next: &str) -> Result<(), String> {
    if let Some(parent) = context.zshrc_path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    if context.zshrc_path.exists() && previous != next {
        let backup_path = context.zshrc_path.with_file_name(format!(
            ".zshrc.rcodexmanager-backup-{}",
            timestamp_compact()
        ));
        fs::write(&backup_path, previous).map_err(|error| error.to_string())?;
    }

    fs::write(&context.zshrc_path, next).map_err(|error| error.to_string())
}

fn parse_shell_functions(contents: &str) -> Vec<ShellFunction> {
    let lines: Vec<&str> = contents.lines().collect();
    let mut functions = Vec::new();
    let mut index = 0;

    while index < lines.len() {
        let Some(name) = shell_function_name(lines[index]) else {
            index += 1;
            continue;
        };

        let mut depth = 0isize;
        let mut end_line = index;
        let mut body_lines = Vec::new();

        for cursor in index..lines.len() {
            let line = lines[cursor];
            depth += line.chars().filter(|char| *char == '{').count() as isize;
            depth -= line.chars().filter(|char| *char == '}').count() as isize;
            body_lines.push(line);
            end_line = cursor;
            if depth <= 0 && cursor >= index {
                break;
            }
        }

        functions.push(ShellFunction {
            name,
            start_line: index,
            end_line,
            body: body_lines.join("\n"),
        });
        index = end_line + 1;
    }

    functions
}

fn shell_function_name(line: &str) -> Option<String> {
    let trimmed = line.trim_start();
    let marker = trimmed.find("()")?;
    let name = trimmed[..marker].trim();
    let after = trimmed[marker + 2..].trim_start();
    if name.is_empty() || !after.starts_with('{') {
        return None;
    }
    Some(name.to_string())
}

fn find_shell_function(contents: &str, name: &str) -> Option<ShellFunction> {
    parse_shell_functions(contents)
        .into_iter()
        .find(|function| function.name == name)
}

fn managed_ranges(contents: &str) -> Vec<(usize, usize)> {
    let mut ranges = Vec::new();
    let mut start = None;
    for (index, line) in contents.lines().enumerate() {
        if line.trim() == MANAGED_BLOCK_START {
            start = Some(index);
        }
        if line.trim() == MANAGED_BLOCK_END {
            if let Some(start_line) = start.take() {
                ranges.push((start_line, index));
            }
        }
    }
    ranges
}

fn extract_shell_value(body: &str, token: &str) -> Option<String> {
    let token_start = body.find(token)?;
    let rest = body[token_start + token.len()..].trim_start();
    if let Some(stripped) = rest.strip_prefix('"') {
        let end = stripped.find('"')?;
        return Some(stripped[..end].to_string());
    }
    if let Some(stripped) = rest.strip_prefix('\'') {
        let end = stripped.find('\'')?;
        return Some(stripped[..end].to_string());
    }
    let end = rest
        .find(|char: char| char.is_whitespace() || char == '\\')
        .unwrap_or(rest.len());
    Some(rest[..end].to_string())
}

fn expand_shell_path(value: &str, home_dir: &Path) -> PathBuf {
    if value == "$HOME" || value == "~" {
        return home_dir.to_path_buf();
    }
    if let Some(rest) = value.strip_prefix("$HOME/") {
        return home_dir.join(rest);
    }
    if let Some(rest) = value.strip_prefix("~/") {
        return home_dir.join(rest);
    }
    PathBuf::from(value)
}

fn shorten_home_path(path: &Path, home_dir: &Path) -> String {
    if let Ok(rest) = path.strip_prefix(home_dir) {
        if rest.as_os_str().is_empty() {
            return "$HOME".to_string();
        }
        return format!("$HOME/{}", rest.to_string_lossy());
    }
    path_string(path)
}

fn upsert_function(
    contents: &str,
    context: &ProfileContext,
    draft: &ProfileDraft,
    replace_existing: bool,
) -> Result<String, String> {
    let rendered = render_profile_function(context, draft);
    if let Some(existing) = find_shell_function(contents, &draft.name) {
        if !replace_existing {
            return Err(format!("profile {} already exists", draft.name));
        }
        let mut lines: Vec<String> = contents.lines().map(ToString::to_string).collect();
        lines.splice(
            existing.start_line..=existing.end_line,
            rendered.lines().map(ToString::to_string),
        );
        return Ok(with_trailing_newline(lines.join("\n")));
    }

    if contents.contains(MANAGED_BLOCK_START) && contents.contains(MANAGED_BLOCK_END) {
        let mut lines: Vec<String> = contents.lines().map(ToString::to_string).collect();
        let end_index = lines
            .iter()
            .position(|line| line.trim() == MANAGED_BLOCK_END)
            .ok_or_else(|| "managed block end marker is missing".to_string())?;
        let insert_lines: Vec<_> = rendered.lines().map(ToString::to_string).collect();
        lines.splice(end_index..end_index, insert_lines);
        return Ok(with_trailing_newline(lines.join("\n")));
    }

    let mut next = contents.trim_end().to_string();
    if !next.is_empty() {
        next.push_str("\n\n");
    }
    next.push_str(MANAGED_BLOCK_START);
    next.push('\n');
    next.push_str(&rendered);
    next.push_str(MANAGED_BLOCK_END);
    next.push('\n');
    Ok(next)
}

fn remove_function(contents: &str, name: &str) -> Option<String> {
    let existing = find_shell_function(contents, name)?;
    let mut lines: Vec<String> = contents.lines().map(ToString::to_string).collect();
    lines.splice(existing.start_line..=existing.end_line, std::iter::empty());

    while existing.start_line < lines.len() && lines[existing.start_line].trim().is_empty() {
        lines.remove(existing.start_line);
    }

    Some(with_trailing_newline(lines.join("\n")))
}

fn render_profile_function(context: &ProfileContext, draft: &ProfileDraft) -> String {
    let codex_home = escape_double_quotes(&shorten_home_path(&draft.codex_home, &context.home_dir));
    let user_data_dir =
        escape_double_quotes(&shorten_home_path(&draft.user_data_dir, &context.home_dir));

    format!(
        "{name}() {{\n  mkdir -p \"{codex_home}\" \"{user_data_dir}\"\n  open -n -a \"Codex\" \\\n    --env CODEX_HOME=\"{codex_home}\" \\\n    --args --user-data-dir=\"{user_data_dir}\"\n}}\n\n",
        name = draft.name,
    )
}

fn write_profile_config(
    config_path: &Path,
    model: &str,
    reasoning_effort: &str,
) -> Result<(), String> {
    if let Some(parent) = config_path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let config = format!(
        "model = \"{}\"\nmodel_reasoning_effort = \"{}\"\n\n[features]\nresponses_websockets = true\nresponses_websockets_v2 = true\nresponses_websocket_response_processed = true\n",
        escape_toml_string(model),
        escape_toml_string(reasoning_effort),
    );
    fs::write(config_path, config).map_err(|error| error.to_string())
}

#[derive(Debug, Default)]
struct CodexConfig {
    model: Option<String>,
    reasoning_effort: Option<String>,
    websocket_features_enabled: bool,
}

fn read_codex_config(config_path: &Path) -> CodexConfig {
    let Ok(contents) = fs::read_to_string(config_path) else {
        return CodexConfig::default();
    };

    CodexConfig {
        model: read_top_level_string(&contents, "model"),
        reasoning_effort: read_top_level_string(&contents, "model_reasoning_effort"),
        websocket_features_enabled: CODEX_WEBSOCKET_FEATURE_FLAGS
            .iter()
            .all(|flag| read_bool_in_section(&contents, "features", flag) == Some(true)),
    }
}

fn derived_category(reasoning_effort: Option<&str>) -> String {
    match reasoning_effort.unwrap_or_default() {
        "xhigh" | "high" => "深度".to_string(),
        "medium" => "平衡".to_string(),
        "low" | "minimal" | "none" => "轻量".to_string(),
        _ => "未分类".to_string(),
    }
}

fn read_top_level_string(contents: &str, key: &str) -> Option<String> {
    let prefix = format!("{key} =");
    contents.lines().find_map(|line| {
        let trimmed = line.trim();
        if !trimmed.starts_with(&prefix) {
            return None;
        }
        let value = trimmed[prefix.len()..].trim();
        let value = value.strip_prefix('"')?.strip_suffix('"')?;
        Some(value.to_string())
    })
}

fn read_bool_in_section(contents: &str, section: &str, key: &str) -> Option<bool> {
    let lines: Vec<&str> = contents.lines().collect();
    let (start, end) = find_toml_section_range(&lines, section)?;
    let prefix = format!("{key} =");
    lines[start..end].iter().find_map(|line| {
        let trimmed = line.trim();
        if !trimmed.starts_with(&prefix) {
            return None;
        }
        match trimmed[prefix.len()..].trim() {
            "true" => Some(true),
            "false" => Some(false),
            _ => None,
        }
    })
}

fn ensure_codex_websocket_features(
    config_path: &Path,
    fallback_model: &str,
    fallback_reasoning_effort: &str,
) -> Result<bool, String> {
    if !config_path.exists() {
        write_profile_config(config_path, fallback_model, fallback_reasoning_effort)?;
        return Ok(true);
    }

    let previous = fs::read_to_string(config_path).map_err(|error| {
        format!(
            "failed to read config {}: {error}",
            path_string(config_path)
        )
    })?;
    let next = upsert_toml_bool_section(
        &previous,
        "features",
        CODEX_WEBSOCKET_FEATURE_FLAGS
            .iter()
            .map(|flag| (*flag, true)),
    );
    if next == previous {
        return Ok(false);
    }

    fs::write(config_path, next).map_err(|error| {
        format!(
            "failed to write config {}: {error}",
            path_string(config_path)
        )
    })?;
    Ok(true)
}

fn upsert_toml_bool_section<'a>(
    contents: &str,
    section: &str,
    pairs: impl IntoIterator<Item = (&'a str, bool)>,
) -> String {
    let pairs: Vec<(&str, bool)> = pairs.into_iter().collect();
    let mut lines: Vec<String> = contents.lines().map(ToString::to_string).collect();
    let had_trailing_newline = contents.ends_with('\n');
    let borrowed: Vec<&str> = lines.iter().map(String::as_str).collect();

    let Some((start, end)) = find_toml_section_range(&borrowed, section) else {
        if !lines.is_empty() && !lines.last().is_some_and(|line| line.trim().is_empty()) {
            lines.push(String::new());
        }
        lines.push(format!("[{section}]"));
        for (key, value) in pairs {
            lines.push(format!("{key} = {value}"));
        }
        return with_trailing_newline(lines.join("\n"));
    };

    let mut insert_at = end;
    for (key, value) in pairs {
        let prefix = format!("{key} =");
        let replacement = format!("{key} = {value}");
        if let Some(index) =
            (start..end).find(|index| lines[*index].trim_start().starts_with(&prefix))
        {
            lines[index] = replacement;
        } else {
            lines.insert(insert_at, replacement);
            insert_at += 1;
        }
    }

    let joined = lines.join("\n");
    if had_trailing_newline {
        with_trailing_newline(joined)
    } else {
        joined
    }
}

fn find_toml_section_range(lines: &[&str], section: &str) -> Option<(usize, usize)> {
    let header = format!("[{section}]");
    let start = lines
        .iter()
        .position(|line| line.trim() == header)?
        .checked_add(1)?;
    let end = lines[start..]
        .iter()
        .position(|line| {
            let trimmed = line.trim();
            trimmed.starts_with('[') && trimmed.ends_with(']')
        })
        .map(|offset| start + offset)
        .unwrap_or(lines.len());
    Some((start, end))
}

fn detect_system_proxy_env() -> Result<ProxyEnvSettings, String> {
    let output = Command::new("scutil")
        .arg("--proxy")
        .output()
        .map_err(|error| format!("failed to inspect macOS proxy settings: {error}"))?;
    if !output.status.success() {
        return Err(format!(
            "failed to inspect macOS proxy settings; scutil exited with {}",
            output.status
        ));
    }
    let stdout = String::from_utf8_lossy(&output.stdout);
    proxy_env_from_scutil(&stdout).ok_or_else(|| "no macOS system proxy is enabled".to_string())
}

fn proxy_env_from_scutil(contents: &str) -> Option<ProxyEnvSettings> {
    let values = parse_scutil_proxy_values(contents);
    let http_proxy = proxy_url(&values, "HTTP", "http");
    let https_proxy = proxy_url(&values, "HTTPS", "http").or_else(|| http_proxy.clone());
    let ws_proxy = http_proxy.clone().or_else(|| https_proxy.clone());
    let wss_proxy = https_proxy.clone().or_else(|| http_proxy.clone());
    let all_proxy = proxy_url(&values, "SOCKS", "socks5").or_else(|| https_proxy.clone());

    if http_proxy.is_none() && https_proxy.is_none() && all_proxy.is_none() {
        return None;
    }

    Some(ProxyEnvSettings {
        http_proxy,
        https_proxy,
        all_proxy,
        ws_proxy,
        wss_proxy,
        no_proxy: DEFAULT_NO_PROXY.to_string(),
    })
}

fn parse_scutil_proxy_values(contents: &str) -> BTreeMap<String, String> {
    contents
        .lines()
        .filter_map(|line| {
            let (key, value) = line.split_once(':')?;
            let key = key.trim();
            if key.is_empty() || key.chars().all(|char| char.is_ascii_digit()) {
                return None;
            }
            Some((key.to_string(), value.trim().to_string()))
        })
        .collect()
}

fn proxy_url(values: &BTreeMap<String, String>, prefix: &str, scheme: &str) -> Option<String> {
    if values.get(&format!("{prefix}Enable")).map(String::as_str) != Some("1") {
        return None;
    }
    let host = values.get(&format!("{prefix}Proxy"))?.trim();
    let port = values.get(&format!("{prefix}Port"))?.trim();
    if host.is_empty() || port.is_empty() {
        return None;
    }
    Some(format!("{scheme}://{host}:{port}"))
}

fn append_open_proxy_env(command: &mut Command, proxy: &ProxyEnvSettings) {
    for (key, value) in proxy_env_pairs(proxy) {
        command.arg("--env").arg(format!("{key}={value}"));
    }
}

fn apply_launchctl_proxy_env(proxy: &ProxyEnvSettings) -> Result<(), String> {
    for (key, value) in proxy_env_pairs(proxy) {
        let status = Command::new("launchctl")
            .args(["setenv", key, &value])
            .status()
            .map_err(|error| format!("failed to run launchctl setenv {key}: {error}"))?;
        if !status.success() {
            return Err(format!("launchctl setenv {key} exited with {status}"));
        }
    }
    Ok(())
}

fn proxy_env_pairs(proxy: &ProxyEnvSettings) -> Vec<(&'static str, String)> {
    let mut pairs = Vec::new();
    if let Some(value) = proxy.http_proxy.as_ref() {
        pairs.push(("HTTP_PROXY", value.clone()));
    }
    if let Some(value) = proxy.https_proxy.as_ref() {
        pairs.push(("HTTPS_PROXY", value.clone()));
    }
    if let Some(value) = proxy.all_proxy.as_ref() {
        pairs.push(("ALL_PROXY", value.clone()));
    }
    if let Some(value) = proxy.ws_proxy.as_ref() {
        pairs.push(("WS_PROXY", value.clone()));
    }
    if let Some(value) = proxy.wss_proxy.as_ref() {
        pairs.push(("WSS_PROXY", value.clone()));
    }
    pairs.push(("NO_PROXY", proxy.no_proxy.clone()));
    pairs
}

fn archive_existing_path(path: &Path, label: &str) -> Result<Vec<BackupInfo>, String> {
    if !path.exists() {
        return Ok(Vec::new());
    }
    let backup_path = path.with_file_name(format!(
        "{}.rcodexmanager-{}-{}",
        path.file_name()
            .map(|value| value.to_string_lossy())
            .unwrap_or_else(|| "profile".into()),
        label,
        timestamp_compact()
    ));
    fs::rename(path, &backup_path).map_err(|error| error.to_string())?;
    Ok(vec![BackupInfo {
        original_path: path_string(path),
        backup_path: path_string(&backup_path),
        moved: true,
    }])
}

fn validate_profile_name(name: &str) -> Result<(), String> {
    if !name.starts_with("codex-") {
        return Err("profile name must start with codex-".to_string());
    }
    if name.len() <= "codex-".len() {
        return Err("profile name needs a suffix, for example codex-f".to_string());
    }
    if !name
        .chars()
        .all(|char| char.is_ascii_lowercase() || char.is_ascii_digit() || char == '-')
    {
        return Err(
            "profile name may contain only lowercase letters, digits, and hyphens".to_string(),
        );
    }
    Ok(())
}

fn validate_profile_selector_name(name: &str) -> Result<(), String> {
    if name == "codex" {
        return Ok(());
    }
    validate_profile_name(name)
}

fn ensure_mutable_profile(profile: &ProfileInfo, action: &str) -> Result<(), String> {
    if profile.is_default {
        return Err(format!(
            "default codex profile is protected; cannot {action} {}",
            profile.name
        ));
    }
    Ok(())
}

fn title_suffix(suffix: &str) -> String {
    suffix
        .split('-')
        .filter(|part| !part.is_empty())
        .map(|part| {
            let mut chars = part.chars();
            match chars.next() {
                Some(first) => format!("{}{}", first.to_ascii_uppercase(), chars.as_str()),
                None => String::new(),
            }
        })
        .collect::<Vec<_>>()
        .join("-")
}

fn escape_double_quotes(value: &str) -> String {
    value.replace('\\', "\\\\").replace('"', "\\\"")
}

fn escape_toml_string(value: &str) -> String {
    value.replace('\\', "\\\\").replace('"', "\\\"")
}

#[cfg(test)]
mod tests {
    use std::path::Path;

    use super::command_has_user_data_dir;

    #[test]
    fn user_data_dir_matching_uses_complete_argument_value() {
        let default_dir = Path::new("/Users/ikiru/Library/Application Support/Codex");
        let deep_dir = Path::new("/Users/ikiru/Library/Application Support/Codex-E");
        let deep_command =
            "/Applications/Codex.app/Contents/MacOS/Codex --user-data-dir=/Users/ikiru/Library/Application Support/Codex-E";
        let default_command =
            "/Applications/Codex.app/Contents/MacOS/Codex --user-data-dir=/Users/ikiru/Library/Application Support/Codex";

        assert!(command_has_user_data_dir(deep_command, deep_dir));
        assert!(!command_has_user_data_dir(deep_command, default_dir));
        assert!(command_has_user_data_dir(default_command, default_dir));
    }
}

fn with_trailing_newline(value: String) -> String {
    if value.ends_with('\n') {
        value
    } else {
        format!("{value}\n")
    }
}

fn default_true() -> bool {
    true
}

fn now_iso() -> String {
    Utc::now().to_rfc3339_opts(SecondsFormat::Secs, true)
}

fn timestamp_compact() -> String {
    Utc::now().format("%Y%m%d%H%M%S").to_string()
}

fn path_string(path: &Path) -> String {
    path.to_string_lossy().to_string()
}
