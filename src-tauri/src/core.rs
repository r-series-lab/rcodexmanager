use base64::{engine::general_purpose, Engine as _};
use chrono::{DateTime, Duration as ChronoDuration, SecondsFormat, Utc};
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use std::collections::BTreeMap;
use std::collections::BTreeSet;
use std::fs;
use std::fs::OpenOptions;
use std::io::{BufRead, BufReader, Read, Seek, SeekFrom};
#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::{Duration, SystemTime};

const MANAGED_BLOCK_START: &str = "# >>> rCodexManager profiles >>>";
const MANAGED_BLOCK_END: &str = "# <<< rCodexManager profiles <<<";
const DEFAULT_MODEL: &str = "gpt-5.5";
const DEFAULT_REASONING_EFFORT: &str = "xhigh";
const CHATGPT_BASE_URL: &str = "https://chatgpt.com";
const CHATGPT_USAGE_ENDPOINT: &str = "https://chatgpt.com/backend-api/wham/usage";
const QUOTA_HTTP_TIMEOUT_SECONDS: u64 = 25;
const PROFILE_SESSION_PREVIEW_LIMIT: usize = 1;
const SESSION_INDEX_READ_CHUNK_SIZE: u64 = 16 * 1024;
const DEFAULT_NO_PROXY: &str = "localhost,127.0.0.1,::1,*.local";
const AUTH_BACKUP_EXPORT_KIND: &str = "app.rseries.rcodexmanager.auth-backup";
const AUTH_BACKUP_EXPORT_VERSION: u16 = 1;
const WECHAT_ACP_PACKAGE: &str = "wechat-acp@0.2.3";
const CODEX_ACP_PACKAGE: &str = "@zed-industries/codex-acp@0.15.0";
const WECHAT_BRIDGE_LOG_TAIL_LINES: usize = 80;
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
    #[serde(default)]
    pub launcher_kind: Option<ProfileLauncherKind>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CopyProfileInput {
    pub source_name: String,
    pub name: String,
    pub codex_home: Option<String>,
    pub user_data_dir: Option<String>,
    pub model: Option<String>,
    pub reasoning_effort: Option<String>,
    pub alias: Option<String>,
    pub category: Option<String>,
    pub note: Option<String>,
    pub auth_source_name: Option<String>,
    #[serde(default)]
    pub confirm_sensitive: bool,
    #[serde(default)]
    pub launcher_kind: Option<ProfileLauncherKind>,
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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListProfileSessionsInput {
    pub profile_name: Option<String>,
    pub category: Option<String>,
    pub query: Option<String>,
    #[serde(default)]
    pub offset: usize,
    #[serde(default = "default_session_page_limit")]
    pub limit: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateAuthBackupInput {
    pub name: String,
    pub label: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApplyAuthBackupInput {
    pub backup_id: String,
    pub target_profile_name: String,
    #[serde(default)]
    pub confirm_sensitive: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RollbackAuthApplicationInput {
    pub application_id: String,
    #[serde(default)]
    pub confirm_sensitive: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteAuthBackupInput {
    pub backup_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateAuthBackupInput {
    pub backup_id: String,
    pub label: Option<String>,
    pub note: Option<String>,
    #[serde(default)]
    pub pinned: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportAuthBackupInput {
    pub backup_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportAuthBackupPackageInput {
    pub package_json: String,
    pub label: Option<String>,
    pub note: Option<String>,
    #[serde(default)]
    pub pinned: bool,
    #[serde(default)]
    pub confirm_sensitive: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanupAuthBackupsInput {
    pub account_key: String,
    #[serde(default)]
    pub confirm_sensitive: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartWechatBridgeInput {
    pub profile_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StopWechatBridgeInput {
    pub profile_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadWechatBridgeLogInput {
    pub profile_name: String,
    pub lines: Option<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallWechatBridgeServiceInput {
    pub profile_name: String,
    #[serde(default)]
    pub install: bool,
    #[serde(default)]
    pub enable: bool,
    #[serde(default)]
    pub now: bool,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum ProfileLauncherKind {
    Desktop,
    Server,
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
    pub launcher_kind: ProfileLauncherKind,
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
    pub renamed_title: Option<String>,
    pub summary: Option<String>,
    pub updated_at: Option<String>,
    pub started_at: Option<String>,
    pub cwd: Option<String>,
    pub path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
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
    pub offset: usize,
    pub limit: usize,
    pub has_more: bool,
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
pub struct AuthProfileSlot {
    pub profile_name: String,
    pub profile_alias: Option<String>,
    pub profile_category: String,
    pub is_default: bool,
    pub is_running: bool,
    pub codex_home: String,
    pub auth_path: String,
    pub auth_exists: bool,
    pub account: Option<CodexAccountInfo>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthBackupEntry {
    pub id: String,
    pub label: String,
    pub note: Option<String>,
    pub created_at: String,
    pub updated_at: Option<String>,
    pub source_profile_name: Option<String>,
    pub source_profile_label: Option<String>,
    pub source_codex_home: Option<String>,
    pub path: String,
    pub exists: bool,
    pub pinned: bool,
    pub account: Option<CodexAccountInfo>,
    pub has_refresh_token: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthApplicationEntry {
    pub id: String,
    pub applied_at: String,
    pub backup_id: String,
    pub backup_label: String,
    pub target_profile_name: String,
    pub target_profile_label: Option<String>,
    pub target_codex_home: String,
    pub previous_auth_path: Option<String>,
    pub previous_auth_exists: bool,
    pub previous_account: Option<CodexAccountInfo>,
    pub applied_account: Option<CodexAccountInfo>,
    pub rolled_back_at: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthVaultReport {
    pub generated_at: String,
    pub vault_path: String,
    pub index_path: String,
    pub profile_count: usize,
    pub backup_count: usize,
    pub profiles: Vec<AuthProfileSlot>,
    pub backups: Vec<AuthBackupEntry>,
    pub recent_applications: Vec<AuthApplicationEntry>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WechatBridgeReport {
    pub generated_at: String,
    pub store_path: String,
    pub bridge_count: usize,
    pub running_count: usize,
    pub wechat_acp_package: String,
    pub codex_acp_package: String,
    pub bridges: Vec<WechatBridgeEntry>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WechatBridgeEntry {
    pub profile_name: String,
    pub profile_label: String,
    pub profile_category: String,
    pub codex_home: String,
    pub auth_exists: bool,
    pub account: Option<CodexAccountInfo>,
    pub instance: String,
    pub storage_dir: String,
    pub token_path: String,
    pub inbox_dir: String,
    pub wrapper_path: String,
    pub app_log_path: String,
    pub default_log_path: String,
    pub token_exists: bool,
    pub running: bool,
    pub running_pids: Vec<u32>,
    pub last_started_at: Option<String>,
    pub last_stopped_at: Option<String>,
    pub last_error: Option<String>,
    pub log_tail: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WechatBridgeLogReport {
    pub generated_at: String,
    pub profile_name: String,
    pub instance: String,
    pub app_log_path: String,
    pub default_log_path: String,
    pub log_tail: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WechatBridgeServiceReport {
    pub generated_at: String,
    pub profile_name: String,
    pub instance: String,
    pub service_name: String,
    pub unit_path: String,
    pub unit_contents: String,
    pub installed: bool,
    pub enabled: bool,
    pub started: bool,
    pub message: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthBackupExportReport {
    pub generated_at: String,
    pub path: String,
    pub file_name: String,
    pub backup: AuthBackupEntry,
    pub message: String,
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
    launcher_kind: ProfileLauncherKind,
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

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AuthVaultStore {
    #[serde(default)]
    backups: BTreeMap<String, AuthBackupRecord>,
    #[serde(default)]
    applications: BTreeMap<String, AuthApplicationRecord>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WechatBridgeStore {
    #[serde(default)]
    bindings: BTreeMap<String, WechatBridgeRecord>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WechatBridgeRecord {
    profile_name: String,
    instance: String,
    created_at: String,
    updated_at: String,
    last_started_at: Option<String>,
    last_stopped_at: Option<String>,
    last_error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AuthBackupRecord {
    id: String,
    label: String,
    note: Option<String>,
    created_at: String,
    updated_at: Option<String>,
    source_profile_name: Option<String>,
    source_profile_label: Option<String>,
    source_codex_home: Option<String>,
    path: String,
    #[serde(default)]
    pinned: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AuthApplicationRecord {
    id: String,
    applied_at: String,
    backup_id: String,
    backup_label: String,
    target_profile_name: String,
    target_profile_label: Option<String>,
    target_codex_home: String,
    previous_auth_path: Option<String>,
    applied_account: Option<CodexAccountInfo>,
    rolled_back_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AuthBackupExportPackage {
    kind: String,
    version: u16,
    exported_at: String,
    backup: AuthBackupExportMetadata,
    auth_json: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AuthBackupExportMetadata {
    id: String,
    label: String,
    note: Option<String>,
    created_at: String,
    updated_at: Option<String>,
    source_profile_name: Option<String>,
    source_profile_label: Option<String>,
    source_codex_home: Option<String>,
    pinned: bool,
    account: Option<CodexAccountInfo>,
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
        let launcher_kind = profile_launcher_kind_from_body(&function.body);
        let codex_home = expand_shell_path(&codex_home_raw, &context.home_dir);
        let user_data_dir = extract_shell_value(&function.body, "--user-data-dir=")
            .map(|value| expand_shell_path(&value, &context.home_dir))
            .unwrap_or_else(|| default_user_data_dir(context, &function.name, launcher_kind));
        let config_path = codex_home.join("config.toml");
        let config = read_codex_config(&config_path);
        let recent_sessions =
            read_recent_session_summaries(&codex_home, PROFILE_SESSION_PREVIEW_LIMIT);
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
                launcher_kind,
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

pub fn list_profile_sessions(
    context: &ProfileContext,
    input: ListProfileSessionsInput,
) -> Result<ProfileSessionReport, String> {
    let report = list_profiles(context)?;
    let offset = input.offset;
    let limit = normalize_session_page_limit(input.limit);
    let scan_limit = if input
        .query
        .as_deref()
        .is_some_and(|value| !value.trim().is_empty())
    {
        (offset + limit + 1).max(80).min(400)
    } else {
        offset + limit + 1
    };
    let requested_profile = normalized_optional_filter(input.profile_name.as_deref());
    let requested_category = normalized_optional_filter(input.category.as_deref());
    let query = input
        .query
        .as_deref()
        .map(normalize_search_query)
        .filter(|value| !value.is_empty());
    let mut sessions = Vec::new();

    for profile in report.profiles {
        if requested_profile
            .as_ref()
            .is_some_and(|value| profile.name != *value)
        {
            continue;
        }
        if requested_category
            .as_ref()
            .is_some_and(|value| profile.category != *value)
        {
            continue;
        }

        let codex_home = PathBuf::from(&profile.codex_home);
        sessions.extend(
            read_recent_session_summaries(&codex_home, scan_limit)
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

    if let Some(query) = query.as_ref() {
        sessions.retain(|item| profile_session_matches_query(item, query));
    }

    sessions.sort_by(|left, right| {
        session_sort_value(&right.session)
            .cmp(session_sort_value(&left.session))
            .then_with(|| left.profile_name.cmp(&right.profile_name))
            .then_with(|| left.session.id.cmp(&right.session.id))
    });
    let session_count = sessions.len();
    let page_sessions = sessions
        .into_iter()
        .skip(offset)
        .take(limit)
        .collect::<Vec<_>>();

    Ok(ProfileSessionReport {
        generated_at: now_iso(),
        session_count,
        offset,
        limit,
        has_more: offset + page_sessions.len() < session_count,
        sessions: page_sessions,
    })
}

pub fn list_auth_vault(context: &ProfileContext) -> Result<AuthVaultReport, String> {
    let report = list_profiles(context)?;
    let profiles = report
        .profiles
        .iter()
        .map(auth_profile_slot)
        .collect::<Vec<_>>();
    let store = read_auth_vault_store(context)?;
    let mut backups = store
        .backups
        .into_values()
        .map(auth_backup_entry)
        .collect::<Vec<_>>();
    let mut recent_applications = store
        .applications
        .into_values()
        .map(auth_application_entry)
        .collect::<Vec<_>>();

    backups.sort_by(auth_backup_sort_order);
    recent_applications.sort_by(|left, right| {
        right
            .applied_at
            .cmp(&left.applied_at)
            .then_with(|| left.id.cmp(&right.id))
    });

    Ok(AuthVaultReport {
        generated_at: now_iso(),
        vault_path: path_string(&auth_vault_dir(context)),
        index_path: path_string(&auth_vault_index_path(context)),
        profile_count: profiles.len(),
        backup_count: backups.len(),
        profiles,
        backups,
        recent_applications,
    })
}

pub fn list_wechat_bridges(context: &ProfileContext) -> Result<WechatBridgeReport, String> {
    let report = list_profiles(context)?;
    let store = read_wechat_bridge_store(context)?;
    let processes = running_wechat_bridge_processes()?;
    let bridges = report
        .profiles
        .iter()
        .map(|profile| wechat_bridge_entry(context, profile, &store, &processes))
        .collect::<Vec<_>>();
    let running_count = bridges.iter().filter(|bridge| bridge.running).count();

    Ok(WechatBridgeReport {
        generated_at: now_iso(),
        store_path: path_string(&wechat_bridge_store_path(context)),
        bridge_count: bridges.len(),
        running_count,
        wechat_acp_package: WECHAT_ACP_PACKAGE.to_string(),
        codex_acp_package: CODEX_ACP_PACKAGE.to_string(),
        bridges,
    })
}

pub fn start_wechat_bridge(
    context: &ProfileContext,
    input: StartWechatBridgeInput,
) -> Result<WechatBridgeReport, String> {
    validate_profile_selector_name(&input.profile_name)?;
    let profile = find_profile(context, &input.profile_name)?;
    let auth_path = PathBuf::from(&profile.codex_home).join("auth.json");
    if !auth_path.exists() {
        return Err(format!(
            "{} has no auth.json; apply or import auth before binding WeChat",
            profile.name
        ));
    }

    let instance = wechat_bridge_instance_name(&profile.name);
    let paths = wechat_bridge_paths(context, &instance);
    fs::create_dir_all(&paths.runtime_dir).map_err(|error| error.to_string())?;
    fs::create_dir_all(&paths.inbox_dir).map_err(|error| error.to_string())?;
    write_wechat_bridge_wrapper(&paths.wrapper_path, &profile)?;

    let running = running_wechat_bridge_processes()?;
    let running_pids = matching_wechat_bridge_pids(&running, &instance);
    if !running_pids.is_empty() {
        upsert_wechat_bridge_record(context, &profile.name, &instance, |record| {
            record.updated_at = now_iso();
            record.last_error = None;
        })?;
        return list_wechat_bridges(context);
    }

    let log = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&paths.app_log_path)
        .map_err(|error| {
            format!(
                "failed to open WeChat bridge log {}: {error}",
                path_string(&paths.app_log_path)
            )
        })?;
    let stderr = log.try_clone().map_err(|error| {
        format!(
            "failed to duplicate WeChat bridge log {}: {error}",
            path_string(&paths.app_log_path)
        )
    })?;

    let started_at = now_iso();
    let mut command = Command::new("npx");
    command
        .args([
            "-y",
            "--package",
            WECHAT_ACP_PACKAGE,
            "wechat-acp",
            "--instance",
            &instance,
            "--agent",
            paths.wrapper_path.to_string_lossy().as_ref(),
            "--cwd",
            context.home_dir.to_string_lossy().as_ref(),
            "--inbox-dir",
            paths.inbox_dir.to_string_lossy().as_ref(),
            "--hide-thoughts",
        ])
        .env("CODEX_HOME", &profile.codex_home)
        .stdin(Stdio::null())
        .stdout(Stdio::from(log))
        .stderr(Stdio::from(stderr));
    if let Ok(proxy) = detect_system_proxy_env() {
        apply_child_proxy_env(&mut command, &proxy);
    }
    let spawn_result = command.spawn();

    match spawn_result {
        Ok(_) => {
            upsert_wechat_bridge_record(context, &profile.name, &instance, |record| {
                record.updated_at = started_at.clone();
                record.last_started_at = Some(started_at.clone());
                record.last_error = None;
            })?;
        }
        Err(error) => {
            let message = format!(
                "failed to start WeChat bridge for {}: {error}",
                profile.name
            );
            upsert_wechat_bridge_record(context, &profile.name, &instance, |record| {
                record.updated_at = now_iso();
                record.last_error = Some(message.clone());
            })?;
            return Err(message);
        }
    }

    list_wechat_bridges(context)
}

pub fn stop_wechat_bridge(
    context: &ProfileContext,
    input: StopWechatBridgeInput,
) -> Result<WechatBridgeReport, String> {
    validate_profile_selector_name(&input.profile_name)?;
    let profile = find_profile(context, &input.profile_name)?;
    let instance = wechat_bridge_instance_name(&profile.name);
    let processes = running_wechat_bridge_processes()?;
    let running_pids = matching_wechat_bridge_pids(&processes, &instance);
    terminate_wechat_bridge_pids(&running_pids)?;
    let stopped_at = now_iso();
    upsert_wechat_bridge_record(context, &profile.name, &instance, |record| {
        record.updated_at = stopped_at.clone();
        record.last_stopped_at = Some(stopped_at.clone());
        record.last_error = None;
    })?;

    list_wechat_bridges(context)
}

pub fn read_wechat_bridge_log(
    context: &ProfileContext,
    input: ReadWechatBridgeLogInput,
) -> Result<WechatBridgeLogReport, String> {
    validate_profile_selector_name(&input.profile_name)?;
    let profile = find_profile(context, &input.profile_name)?;
    let instance = wechat_bridge_instance_name(&profile.name);
    let paths = wechat_bridge_paths(context, &instance);
    let lines = input
        .lines
        .unwrap_or(WECHAT_BRIDGE_LOG_TAIL_LINES)
        .clamp(20, 240);

    Ok(WechatBridgeLogReport {
        generated_at: now_iso(),
        profile_name: profile.name,
        instance,
        app_log_path: path_string(&paths.app_log_path),
        default_log_path: path_string(&paths.default_log_path),
        log_tail: read_wechat_bridge_log_tail(&paths, lines),
    })
}

pub fn install_wechat_bridge_service(
    context: &ProfileContext,
    input: InstallWechatBridgeServiceInput,
) -> Result<WechatBridgeServiceReport, String> {
    validate_profile_selector_name(&input.profile_name)?;
    let profile = find_profile(context, &input.profile_name)?;
    let instance = wechat_bridge_instance_name(&profile.name);
    let paths = wechat_bridge_paths(context, &instance);
    fs::create_dir_all(&paths.runtime_dir).map_err(|error| error.to_string())?;
    fs::create_dir_all(&paths.inbox_dir).map_err(|error| error.to_string())?;
    write_wechat_bridge_wrapper(&paths.wrapper_path, &profile)?;
    upsert_wechat_bridge_record(context, &profile.name, &instance, |record| {
        record.updated_at = now_iso();
        record.last_error = None;
    })?;

    let service_name = format!("rcodexmanager-wechat-{instance}.service");
    let unit_path = context
        .home_dir
        .join(".config")
        .join("systemd")
        .join("user")
        .join(&service_name);
    let unit_contents = render_wechat_bridge_user_service(context, &profile, &paths, &instance);
    let mut installed = false;
    let mut enabled = false;
    let mut started = false;

    if input.install || input.enable || input.now {
        if let Some(parent) = unit_path.parent() {
            fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        }
        fs::write(&unit_path, &unit_contents).map_err(|error| error.to_string())?;
        installed = true;
        run_systemctl_user(&["daemon-reload"])?;
    }
    if input.enable {
        run_systemctl_user(&["enable", &service_name])?;
        enabled = true;
    }
    if input.now {
        run_systemctl_user(&["restart", &service_name])?;
        started = true;
    }

    let message = if installed {
        format!("installed user service {service_name}")
    } else {
        format!("rendered user service {service_name}")
    };

    Ok(WechatBridgeServiceReport {
        generated_at: now_iso(),
        profile_name: profile.name,
        instance,
        service_name,
        unit_path: path_string(&unit_path),
        unit_contents,
        installed,
        enabled,
        started,
        message,
    })
}

pub fn create_auth_backup(
    context: &ProfileContext,
    input: CreateAuthBackupInput,
) -> Result<AuthVaultReport, String> {
    validate_profile_selector_name(&input.name)?;
    let profile = find_profile(context, &input.name)?;
    let auth_path = PathBuf::from(&profile.codex_home).join("auth.json");
    let contents = fs::read_to_string(&auth_path).map_err(|error| {
        format!(
            "failed to read {} auth.json for backup: {error}",
            profile.name
        )
    })?;
    let auth_json: Value = serde_json::from_str(&contents)
        .map_err(|error| format!("failed to parse source auth.json: {error}"))?;
    if read_codex_auth_material_from_value(&auth_json).is_none() {
        return Err(format!(
            "{} auth.json does not contain readable Codex auth material",
            profile.name
        ));
    }

    let mut store = read_auth_vault_store(context)?;
    let vault_dir = auth_vault_dir(context);
    fs::create_dir_all(&vault_dir).map_err(|error| error.to_string())?;
    let backup_id = unique_auth_backup_id(&store, &profile.name);
    let backup_path = vault_dir.join(format!("{backup_id}.auth.json"));
    write_json_atomic(&backup_path, &auth_json)?;

    let label = input
        .label
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
        .unwrap_or_else(|| {
            format!(
                "{} 认证备份",
                profile.alias.as_deref().unwrap_or(profile.name.as_str())
            )
        });

    store.backups.insert(
        backup_id.clone(),
        AuthBackupRecord {
            id: backup_id,
            label,
            note: None,
            created_at: now_iso(),
            updated_at: None,
            source_profile_name: Some(profile.name),
            source_profile_label: profile.alias,
            source_codex_home: Some(profile.codex_home),
            path: path_string(&backup_path),
            pinned: false,
        },
    );
    write_auth_vault_store(context, &store)?;

    list_auth_vault(context)
}

pub fn apply_auth_backup(
    context: &ProfileContext,
    input: ApplyAuthBackupInput,
) -> Result<ProfileActionReport, String> {
    if !input.confirm_sensitive {
        return Err("must confirm sensitive token restore before writing auth.json".to_string());
    }

    let backup_id = input.backup_id.trim();
    if backup_id.is_empty() {
        return Err("backup id is required".to_string());
    }
    validate_profile_selector_name(&input.target_profile_name)?;
    let target = find_profile(context, &input.target_profile_name)?;
    ensure_mutable_profile(&target, "apply auth backup to")?;
    if target.is_running {
        return Err(format!(
            "{} is running; terminate the target profile before applying auth backup",
            target.name
        ));
    }

    let mut store = read_auth_vault_store(context)?;
    let record = store
        .backups
        .get(backup_id)
        .cloned()
        .ok_or_else(|| format!("auth backup {backup_id} was not found"))?;
    let backup_path = PathBuf::from(&record.path);
    let contents = fs::read_to_string(&backup_path).map_err(|error| {
        format!(
            "failed to read auth backup {}: {error}",
            path_string(&backup_path)
        )
    })?;
    let imported = normalize_import_auth_json(&contents)?;
    let target_auth_path = PathBuf::from(&target.codex_home).join("auth.json");

    if let Some(parent) = target_auth_path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    let mut backups = Vec::new();
    let previous_auth_path = if target_auth_path.exists() {
        let backup = backup_file_copy(&target_auth_path, "auth-vault-apply")?;
        let previous_auth_path = backup.backup_path.clone();
        backups.push(backup);
        Some(previous_auth_path)
    } else {
        None
    };
    write_json_atomic(&target_auth_path, &imported.auth_json)?;
    let applied_account = read_codex_auth_material_from_value(&imported.auth_json)
        .and_then(|material| material.account);
    let application_id = unique_auth_application_id(&store, &target.name);
    store.applications.insert(
        application_id.clone(),
        AuthApplicationRecord {
            id: application_id,
            applied_at: now_iso(),
            backup_id: record.id.clone(),
            backup_label: record.label.clone(),
            target_profile_name: target.name.clone(),
            target_profile_label: target.alias.clone(),
            target_codex_home: target.codex_home.clone(),
            previous_auth_path,
            applied_account,
            rolled_back_at: None,
        },
    );
    write_auth_vault_store(context, &store)?;

    let refreshed = find_profile(context, &target.name)?;
    let refresh_hint = if imported.has_refresh_token {
        "refresh_token included"
    } else {
        "refresh_token missing; login may expire"
    };

    Ok(ProfileActionReport {
        generated_at: now_iso(),
        action: "applyAuthBackup".to_string(),
        zshrc_path: path_string(&context.zshrc_path),
        profile: Some(refreshed),
        backups,
        message: format!(
            "applied auth backup {} to {} ({refresh_hint})",
            record.label, target.name
        ),
    })
}

pub fn rollback_auth_application(
    context: &ProfileContext,
    input: RollbackAuthApplicationInput,
) -> Result<ProfileActionReport, String> {
    if !input.confirm_sensitive {
        return Err("must confirm sensitive auth rollback before writing auth.json".to_string());
    }

    let application_id = input.application_id.trim();
    if application_id.is_empty() {
        return Err("auth application id is required".to_string());
    }

    let mut store = read_auth_vault_store(context)?;
    let record = store
        .applications
        .get(application_id)
        .cloned()
        .ok_or_else(|| format!("auth application {application_id} was not found"))?;
    if record.rolled_back_at.is_some() {
        return Err(format!(
            "auth application {application_id} has already been rolled back"
        ));
    }
    let previous_auth_path = record.previous_auth_path.as_deref().ok_or_else(|| {
        "this auth application has no previous auth.json to roll back to".to_string()
    })?;
    let previous_path = PathBuf::from(previous_auth_path);
    let contents = fs::read_to_string(&previous_path).map_err(|error| {
        format!(
            "failed to read previous auth backup {}: {error}",
            path_string(&previous_path)
        )
    })?;
    let imported = normalize_import_auth_json(&contents)?;

    let target = find_profile(context, &record.target_profile_name)?;
    ensure_mutable_profile(&target, "roll back auth for")?;
    if target.is_running {
        return Err(format!(
            "{} is running; terminate the target profile before rolling back auth",
            target.name
        ));
    }

    let target_auth_path = PathBuf::from(&target.codex_home).join("auth.json");
    if let Some(parent) = target_auth_path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    let mut backups = Vec::new();
    if target_auth_path.exists() {
        backups.push(backup_file_copy(&target_auth_path, "auth-vault-rollback")?);
    }
    write_json_atomic(&target_auth_path, &imported.auth_json)?;

    if let Some(stored) = store.applications.get_mut(application_id) {
        stored.rolled_back_at = Some(now_iso());
    }
    write_auth_vault_store(context, &store)?;

    let refreshed = find_profile(context, &target.name)?;
    let refresh_hint = if imported.has_refresh_token {
        "refresh_token included"
    } else {
        "refresh_token missing; login may expire"
    };

    Ok(ProfileActionReport {
        generated_at: now_iso(),
        action: "rollbackAuthApplication".to_string(),
        zshrc_path: path_string(&context.zshrc_path),
        profile: Some(refreshed),
        backups,
        message: format!(
            "rolled back auth for {} to the state before {} ({refresh_hint})",
            target.name, record.backup_label
        ),
    })
}

pub fn delete_auth_backup(
    context: &ProfileContext,
    input: DeleteAuthBackupInput,
) -> Result<AuthVaultReport, String> {
    let backup_id = input.backup_id.trim();
    if backup_id.is_empty() {
        return Err("backup id is required".to_string());
    }
    let mut store = read_auth_vault_store(context)?;
    let record = store
        .backups
        .remove(backup_id)
        .ok_or_else(|| format!("auth backup {backup_id} was not found"))?;
    write_auth_vault_store(context, &store)?;

    let backup_path = PathBuf::from(record.path);
    if backup_path.exists() {
        fs::remove_file(&backup_path).map_err(|error| error.to_string())?;
    }

    list_auth_vault(context)
}

pub fn update_auth_backup(
    context: &ProfileContext,
    input: UpdateAuthBackupInput,
) -> Result<AuthVaultReport, String> {
    let backup_id = input.backup_id.trim();
    if backup_id.is_empty() {
        return Err("backup id is required".to_string());
    }
    let mut store = read_auth_vault_store(context)?;
    let record = store
        .backups
        .get_mut(backup_id)
        .ok_or_else(|| format!("auth backup {backup_id} was not found"))?;
    let label = input
        .label
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
        .unwrap_or_else(|| record.label.clone());
    let note = input
        .note
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned);

    record.label = label;
    record.note = note;
    record.pinned = input.pinned;
    record.updated_at = Some(now_iso());
    write_auth_vault_store(context, &store)?;

    list_auth_vault(context)
}

pub fn export_auth_backup(
    context: &ProfileContext,
    input: ExportAuthBackupInput,
) -> Result<AuthBackupExportReport, String> {
    let backup_id = input.backup_id.trim();
    if backup_id.is_empty() {
        return Err("backup id is required".to_string());
    }

    let store = read_auth_vault_store(context)?;
    let record = store
        .backups
        .get(backup_id)
        .cloned()
        .ok_or_else(|| format!("auth backup {backup_id} was not found"))?;
    let backup = auth_backup_entry(record.clone());
    if !backup.exists {
        return Err(format!("auth backup file for {} is missing", backup.label));
    }

    let auth_json: Value =
        serde_json::from_str(&fs::read_to_string(&record.path).map_err(|error| error.to_string())?)
            .map_err(|error| format!("failed to parse auth backup json: {error}"))?;
    if read_codex_auth_material_from_value(&auth_json).is_none() {
        return Err("auth backup does not contain readable Codex auth material".to_string());
    }

    let package = AuthBackupExportPackage {
        kind: AUTH_BACKUP_EXPORT_KIND.to_string(),
        version: AUTH_BACKUP_EXPORT_VERSION,
        exported_at: now_iso(),
        backup: AuthBackupExportMetadata {
            id: backup.id.clone(),
            label: backup.label.clone(),
            note: backup.note.clone(),
            created_at: backup.created_at.clone(),
            updated_at: backup.updated_at.clone(),
            source_profile_name: backup.source_profile_name.clone(),
            source_profile_label: backup.source_profile_label.clone(),
            source_codex_home: backup.source_codex_home.clone(),
            pinned: backup.pinned,
            account: backup.account.clone(),
            has_refresh_token: backup.has_refresh_token,
        },
        auth_json,
    };

    let export_dir = auth_vault_exports_dir(context);
    fs::create_dir_all(&export_dir).map_err(|error| error.to_string())?;
    let export_path = unique_auth_export_path(&export_dir, &backup.label);
    let package_json = serde_json::to_value(&package).map_err(|error| error.to_string())?;
    write_json_atomic(&export_path, &package_json)?;
    let file_name = export_path
        .file_name()
        .map(|value| value.to_string_lossy().to_string())
        .unwrap_or_else(|| "auth-backup.rcodex-auth.json".to_string());

    Ok(AuthBackupExportReport {
        generated_at: now_iso(),
        path: path_string(&export_path),
        file_name: file_name.clone(),
        backup,
        message: format!("exported auth backup to {file_name}"),
    })
}

pub fn import_auth_backup_package(
    context: &ProfileContext,
    input: ImportAuthBackupPackageInput,
) -> Result<AuthVaultReport, String> {
    if !input.confirm_sensitive {
        return Err("must confirm sensitive auth backup import before storing tokens".to_string());
    }
    if input.package_json.trim().is_empty() {
        return Err("auth backup package json is required".to_string());
    }

    let package: AuthBackupExportPackage = serde_json::from_str(&input.package_json)
        .map_err(|error| format!("failed to parse auth backup package: {error}"))?;
    if package.kind != AUTH_BACKUP_EXPORT_KIND {
        return Err(format!(
            "unsupported auth backup package kind {}",
            package.kind
        ));
    }
    if package.version != AUTH_BACKUP_EXPORT_VERSION {
        return Err(format!(
            "unsupported auth backup package version {}",
            package.version
        ));
    }
    if read_codex_auth_material_from_value(&package.auth_json).is_none() {
        return Err(
            "auth backup package does not contain readable Codex auth material".to_string(),
        );
    }

    let mut store = read_auth_vault_store(context)?;
    let vault_dir = auth_vault_dir(context);
    fs::create_dir_all(&vault_dir).map_err(|error| error.to_string())?;
    let label = input
        .label
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
        .unwrap_or_else(|| package.backup.label.clone());
    let note = input
        .note
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
        .or(package.backup.note.clone());
    let backup_id = unique_auth_backup_id(&store, &label);
    let backup_path = vault_dir.join(format!("{backup_id}.auth.json"));
    write_json_atomic(&backup_path, &package.auth_json)?;

    store.backups.insert(
        backup_id.clone(),
        AuthBackupRecord {
            id: backup_id,
            label,
            note,
            created_at: now_iso(),
            updated_at: Some(now_iso()),
            source_profile_name: package.backup.source_profile_name,
            source_profile_label: package.backup.source_profile_label,
            source_codex_home: package.backup.source_codex_home,
            path: path_string(&backup_path),
            pinned: input.pinned || package.backup.pinned,
        },
    );
    write_auth_vault_store(context, &store)?;

    list_auth_vault(context)
}

pub fn cleanup_auth_backups(
    context: &ProfileContext,
    input: CleanupAuthBackupsInput,
) -> Result<AuthVaultReport, String> {
    if !input.confirm_sensitive {
        return Err("must confirm sensitive auth backup cleanup before deleting files".to_string());
    }

    let account_key = input.account_key.trim();
    if account_key.is_empty() {
        return Err("account key is required".to_string());
    }

    let mut store = read_auth_vault_store(context)?;
    let mut matching_backups = store
        .backups
        .values()
        .cloned()
        .map(auth_backup_entry)
        .filter(|entry| codex_account_key(entry.account.as_ref()) == account_key)
        .collect::<Vec<_>>();

    if matching_backups.len() <= 1 {
        return list_auth_vault(context);
    }

    matching_backups.sort_by(auth_backup_sort_order);
    let remove_ids = matching_backups
        .iter()
        .skip(1)
        .map(|entry| entry.id.clone())
        .collect::<BTreeSet<_>>();
    let mut remove_paths = Vec::new();
    for backup_id in remove_ids {
        if let Some(record) = store.backups.remove(&backup_id) {
            remove_paths.push(record.path);
        }
    }

    write_auth_vault_store(context, &store)?;
    for path in remove_paths {
        let backup_path = PathBuf::from(path);
        if backup_path.exists() {
            fs::remove_file(&backup_path).map_err(|error| error.to_string())?;
        }
    }

    list_auth_vault(context)
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

pub fn copy_profile(
    context: &ProfileContext,
    input: CopyProfileInput,
) -> Result<ProfileActionReport, String> {
    validate_profile_selector_name(&input.source_name)?;
    let source = find_profile(context, &input.source_name)?;
    let draft = profile_draft(
        context,
        &CreateProfileInput {
            name: input.name.clone(),
            codex_home: input.codex_home.clone(),
            user_data_dir: input.user_data_dir.clone(),
            model: None,
            reasoning_effort: None,
            alias: None,
            category: None,
            note: None,
            launcher_kind: input.launcher_kind.or(Some(source.launcher_kind)),
        },
    )?;
    validate_profile_name(&draft.name)?;
    ensure_copy_target_paths_are_new(&source, &draft)?;

    let auth_source_name = input
        .auth_source_name
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty() && *value != "none")
        .map(ToOwned::to_owned);
    let imported_auth = match auth_source_name.as_deref() {
        Some(name) => {
            if !input.confirm_sensitive {
                return Err(
                    "must confirm sensitive token copy before writing auth.json".to_string()
                );
            }
            Some(read_profile_auth_payload(context, name)?)
        }
        None => None,
    };

    let contents = read_zshrc(context)?;
    if find_shell_function(&contents, &draft.name).is_some() {
        return Err(format!(
            "profile {} already exists in {}",
            draft.name,
            path_string(&context.zshrc_path)
        ));
    }

    let model = normalized_input(input.model.as_deref())
        .or(source.model.as_deref())
        .unwrap_or(DEFAULT_MODEL)
        .to_string();
    let reasoning_effort = normalized_input(input.reasoning_effort.as_deref())
        .or(source.reasoning_effort.as_deref())
        .unwrap_or(DEFAULT_REASONING_EFFORT)
        .to_string();

    fs::create_dir_all(&draft.codex_home).map_err(|error| error.to_string())?;
    fs::create_dir_all(&draft.user_data_dir).map_err(|error| error.to_string())?;
    write_copied_profile_config(
        &PathBuf::from(&source.config_path),
        &draft.codex_home.join("config.toml"),
        &model,
        &reasoning_effort,
    )?;

    let next_contents = upsert_function(&contents, context, &draft, false)?;
    write_zshrc(context, &contents, &next_contents)?;
    upsert_metadata(
        context,
        ProfileMetadataInput {
            name: draft.name.clone(),
            alias: input.alias.or(source.alias.clone()),
            category: input.category.or(Some(source.category.clone())),
            note: input.note.or(source.note.clone()),
        },
    )?;

    let mut backups = Vec::new();
    let mut copied_auth = false;
    if let Some(imported) = imported_auth {
        let target_auth_path = draft.codex_home.join("auth.json");
        if let Some(parent) = target_auth_path.parent() {
            fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        }
        if target_auth_path.exists() {
            backups.push(backup_file_copy(&target_auth_path, "copy-profile")?);
        }
        write_json_atomic(&target_auth_path, &imported.auth_json)?;
        copied_auth = true;
    }

    let profile = find_profile(context, &draft.name)?;
    let auth_hint = if copied_auth { ", copied auth" } else { "" };
    Ok(ProfileActionReport {
        generated_at: now_iso(),
        action: "copy".to_string(),
        zshrc_path: path_string(&context.zshrc_path),
        profile: Some(profile),
        backups,
        message: format!("copied {} to {}{auth_hint}", source.name, draft.name),
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

    if profile.launcher_kind == ProfileLauncherKind::Server {
        let mut command = Command::new("codex");
        command.env("CODEX_HOME", &profile.codex_home);
        if let Ok(proxy) = detect_system_proxy_env() {
            apply_child_proxy_env(&mut command, &proxy);
        }
        command
            .spawn()
            .map_err(|error| format!("failed to launch codex for {name}: {error}"))?;
        return Ok(ProfileActionReport {
            generated_at: now_iso(),
            action: "launch".to_string(),
            zshrc_path: path_string(&context.zshrc_path),
            profile: Some(find_profile(context, name)?),
            backups: Vec::new(),
            message: format!("launched {name} with server CODEX_HOME"),
        });
    }

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

fn read_profile_auth_payload(
    context: &ProfileContext,
    source_profile_name: &str,
) -> Result<ImportedAuthPayload, String> {
    validate_profile_selector_name(source_profile_name)?;
    let profile = find_profile(context, source_profile_name)?;
    let auth_path = PathBuf::from(&profile.codex_home).join("auth.json");
    let contents = fs::read_to_string(&auth_path).map_err(|error| {
        format!(
            "failed to read source auth.json from {}: {error}",
            profile.name
        )
    })?;
    normalize_import_auth_json(&contents)
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
    default_profile_paths_for_launcher(context, name, default_profile_launcher_kind())
}

pub fn default_profile_paths_for_launcher(
    context: &ProfileContext,
    name: &str,
    launcher_kind: ProfileLauncherKind,
) -> Result<(PathBuf, PathBuf), String> {
    validate_profile_name(name)?;
    let suffix = name.strip_prefix("codex-").unwrap_or(name);
    let codex_home = context.home_dir.join(format!(".codex-{suffix}"));
    let user_data_dir = default_user_data_dir(context, name, launcher_kind);
    Ok((codex_home, user_data_dir))
}

fn default_main_profile_paths(context: &ProfileContext) -> (PathBuf, PathBuf) {
    let codex_home = context.home_dir.join(".codex");
    let user_data_dir = default_user_data_dir(context, "codex", default_profile_launcher_kind());
    (codex_home, user_data_dir)
}

fn default_user_data_dir(
    context: &ProfileContext,
    name: &str,
    launcher_kind: ProfileLauncherKind,
) -> PathBuf {
    match launcher_kind {
        ProfileLauncherKind::Desktop => {
            let suffix = name.strip_prefix("codex-").unwrap_or(name);
            let app_name = if name == "codex" {
                "Codex".to_string()
            } else {
                format!("Codex-{}", title_suffix(suffix))
            };
            context
                .home_dir
                .join("Library")
                .join("Application Support")
                .join(app_name)
        }
        ProfileLauncherKind::Server => context
            .home_dir
            .join(".local")
            .join("share")
            .join("rcodexmanager")
            .join("profiles")
            .join(name),
    }
}

fn default_profile_launcher_kind() -> ProfileLauncherKind {
    if cfg!(target_os = "macos") {
        ProfileLauncherKind::Desktop
    } else {
        ProfileLauncherKind::Server
    }
}

fn default_profile_info(
    context: &ProfileContext,
    metadata_store: &ProfileMetadataStore,
    running_processes: &[RunningCodexProcess],
) -> Option<ProfileInfo> {
    let (codex_home, user_data_dir) = default_main_profile_paths(context);
    let config_path = codex_home.join("config.toml");
    let running_pids = matching_default_profile_pids(running_processes, &user_data_dir);
    let recent_sessions = read_recent_session_summaries(&codex_home, PROFILE_SESSION_PREVIEW_LIMIT);
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
        launcher_kind: default_profile_launcher_kind(),
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
    let launcher_kind = input
        .launcher_kind
        .unwrap_or_else(default_profile_launcher_kind);
    let (default_home, default_user_data) =
        default_profile_paths_for_launcher(context, &name, launcher_kind)?;
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
        launcher_kind,
    })
}

fn normalized_input(value: Option<&str>) -> Option<&str> {
    value.map(str::trim).filter(|value| !value.is_empty())
}

fn ensure_copy_target_paths_are_new(
    source: &ProfileInfo,
    draft: &ProfileDraft,
) -> Result<(), String> {
    let source_home = PathBuf::from(&source.codex_home);
    if paths_refer_to_same_location(&source_home, &draft.codex_home) {
        return Err("copy target CODEX_HOME must be different from source profile".to_string());
    }
    let source_user_data = PathBuf::from(&source.user_data_dir);
    if paths_refer_to_same_location(&source_user_data, &draft.user_data_dir) {
        return Err("copy target user-data-dir must be different from source profile".to_string());
    }
    Ok(())
}

fn paths_refer_to_same_location(left: &Path, right: &Path) -> bool {
    let normalized_left = fs::canonicalize(left).unwrap_or_else(|_| left.to_path_buf());
    let normalized_right = fs::canonicalize(right).unwrap_or_else(|_| right.to_path_buf());
    normalized_left == normalized_right
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

#[derive(Debug, Clone)]
struct RunningWechatBridgeProcess {
    pid: u32,
    instance: String,
}

fn running_wechat_bridge_processes() -> Result<Vec<RunningWechatBridgeProcess>, String> {
    let output = Command::new("ps")
        .args(["axww", "-o", "pid=,command="])
        .output()
        .map_err(|error| format!("failed to inspect running WeChat bridges: {error}"))?;
    if !output.status.success() {
        return Err(format!(
            "failed to inspect running WeChat bridges; ps exited with {}",
            output.status
        ));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok(stdout
        .lines()
        .filter_map(parse_running_wechat_bridge_process)
        .collect())
}

fn parse_running_wechat_bridge_process(line: &str) -> Option<RunningWechatBridgeProcess> {
    let trimmed = line.trim_start();
    let (pid_raw, command_raw) = trimmed.split_once(char::is_whitespace)?;
    let pid = pid_raw.parse().ok()?;
    let command = command_raw.trim();
    if !command.contains("wechat-acp") {
        return None;
    }
    let instance = command_flag_value(command, "--instance")?;
    Some(RunningWechatBridgeProcess { pid, instance })
}

fn command_flag_value(command: &str, flag: &str) -> Option<String> {
    let equals_prefix = format!("{flag}=");
    let mut saw_flag = false;
    for part in command.split_whitespace() {
        if let Some(value) = part.strip_prefix(&equals_prefix) {
            return Some(trim_shell_token(value).to_string());
        }
        if saw_flag {
            return Some(trim_shell_token(part).to_string());
        }
        saw_flag = part == flag;
    }
    None
}

fn trim_shell_token(value: &str) -> &str {
    value.trim_matches(|char| char == '"' || char == '\'')
}

fn matching_wechat_bridge_pids(
    processes: &[RunningWechatBridgeProcess],
    instance: &str,
) -> Vec<u32> {
    processes
        .iter()
        .filter(|process| process.instance == instance)
        .map(|process| process.pid)
        .collect()
}

fn terminate_wechat_bridge_pids(pids: &[u32]) -> Result<(), String> {
    let mut failures = Vec::new();
    for pid in pids {
        match Command::new("kill")
            .arg("-TERM")
            .arg(pid.to_string())
            .status()
        {
            Ok(status) if status.success() => {}
            Ok(status) => failures.push(format!("{pid} ({status})")),
            Err(error) => failures.push(format!("{pid} ({error})")),
        }
    }
    if failures.is_empty() {
        Ok(())
    } else {
        Err(format!(
            "failed to stop WeChat bridge process(es): {}",
            failures.join(", ")
        ))
    }
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

    let index_scan_limit = limit.saturating_mul(2).max(limit + 16);
    let index_entries = read_recent_session_index_entries(codex_home, index_scan_limit);
    let sessions_dir = codex_home.join("sessions");
    let mut summaries = Vec::new();
    let mut seen_ids = BTreeSet::new();
    let mut seen_paths = BTreeSet::new();

    for entry in index_entries {
        if summaries.len() >= limit {
            break;
        }
        let session_path =
            find_session_file_by_id(codex_home, &entry.id, entry.updated_at.as_deref());
        if let Some(summary) = session_summary_from_parts(Some(entry), session_path.as_deref()) {
            if remember_session_summary(&summary, &mut seen_ids, &mut seen_paths) {
                summaries.push(summary);
            }
        }
    }

    let files = collect_recent_session_files_limited(&sessions_dir, limit);
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
    let renamed_title = index_entry
        .as_ref()
        .and_then(|entry| normalize_session_title(entry.thread_name.as_deref()));
    let title = renamed_title
        .clone()
        .or_else(|| details.summary.as_deref().and_then(summary_title_from_text))
        .unwrap_or_else(|| "未命名会话".to_string());
    let updated_at = index_entry
        .as_ref()
        .and_then(|entry| entry.updated_at.clone());
    let path = session_path.map(path_string);

    Some(CodexSessionSummary {
        id,
        title,
        renamed_title,
        summary: details.summary,
        updated_at,
        started_at: details.started_at,
        cwd: details.cwd,
        path,
    })
}

fn read_recent_session_index_entries(codex_home: &Path, limit: usize) -> Vec<SessionIndexEntry> {
    if limit == 0 {
        return Vec::new();
    }

    let Ok(mut file) = fs::File::open(codex_home.join("session_index.jsonl")) else {
        return Vec::new();
    };

    let Ok(metadata) = file.metadata() else {
        return Vec::new();
    };
    let mut position = metadata.len();
    let mut carry = Vec::new();
    let mut entries = Vec::new();

    while position > 0 && entries.len() < limit {
        let read_len = position.min(SESSION_INDEX_READ_CHUNK_SIZE) as usize;
        position -= read_len as u64;
        let mut chunk = vec![0; read_len];
        if file.seek(SeekFrom::Start(position)).is_err() || file.read_exact(&mut chunk).is_err() {
            return Vec::new();
        }
        chunk.extend_from_slice(&carry);

        let mut lines = chunk.split(|byte| *byte == b'\n').collect::<Vec<_>>();
        carry = if position > 0 && !lines.is_empty() {
            lines.remove(0).to_vec()
        } else {
            Vec::new()
        };

        for line in lines.into_iter().rev() {
            if let Some(entry) = parse_session_index_line(line) {
                entries.push(entry);
                if entries.len() >= limit {
                    break;
                }
            }
        }
    }

    entries.sort_by(|left, right| {
        right
            .updated_at
            .as_deref()
            .unwrap_or_default()
            .cmp(left.updated_at.as_deref().unwrap_or_default())
            .then_with(|| left.id.cmp(&right.id))
    });
    entries.truncate(limit);
    entries
}

fn parse_session_index_line(line: &[u8]) -> Option<SessionIndexEntry> {
    let trimmed = trim_ascii_bytes(line);
    if trimmed.is_empty() {
        return None;
    }
    let text = std::str::from_utf8(trimmed).ok()?;
    let entry = serde_json::from_str::<SessionIndexEntry>(text).ok()?;
    if entry.id.trim().is_empty() {
        None
    } else {
        Some(entry)
    }
}

fn trim_ascii_bytes(mut bytes: &[u8]) -> &[u8] {
    while bytes.first().is_some_and(|byte| byte.is_ascii_whitespace()) {
        bytes = &bytes[1..];
    }
    while bytes.last().is_some_and(|byte| byte.is_ascii_whitespace()) {
        bytes = &bytes[..bytes.len() - 1];
    }
    bytes
}

fn find_session_file_by_id(
    codex_home: &Path,
    id: &str,
    updated_at: Option<&str>,
) -> Option<PathBuf> {
    let id = id.trim();
    if id.is_empty() {
        return None;
    }
    let sessions_dir = codex_home.join("sessions");
    find_session_file_by_id_near_date(&sessions_dir, id, updated_at)
        .or_else(|| find_session_file_by_id_recursive(&sessions_dir, id))
}

fn find_session_file_by_id_near_date(
    sessions_dir: &Path,
    id: &str,
    updated_at: Option<&str>,
) -> Option<PathBuf> {
    let parsed = updated_at.and_then(|value| DateTime::parse_from_rfc3339(value).ok())?;
    let date = parsed.date_naive();

    for offset in 0_i64..=7 {
        let Some(day) = date.checked_sub_signed(ChronoDuration::days(offset)) else {
            continue;
        };
        let dir = sessions_dir
            .join(day.format("%Y").to_string())
            .join(day.format("%m").to_string())
            .join(day.format("%d").to_string());
        if let Some(path) = find_session_file_by_id_in_dir(&dir, id) {
            return Some(path);
        }
    }

    None
}

fn find_session_file_by_id_recursive(dir: &Path, id: &str) -> Option<PathBuf> {
    for path in sorted_dir_entries(dir) {
        if path.is_dir() {
            if let Some(candidate) = find_session_file_by_id_recursive(&path, id) {
                return Some(candidate);
            }
        } else if is_session_file_match(&path, id) {
            return Some(path);
        }
    }
    None
}

fn find_session_file_by_id_in_dir(dir: &Path, id: &str) -> Option<PathBuf> {
    let mut best = None;
    for path in sorted_dir_entries(dir) {
        if is_session_file_match(&path, id) {
            keep_latest_session_file(&mut best, path);
        }
    }
    best
}

fn collect_recent_session_files_limited(dir: &Path, limit: usize) -> Vec<PathBuf> {
    let mut files = Vec::new();
    collect_session_files_limited(dir, &mut files, limit);
    files.sort_by_key(session_modified_at);
    files.reverse();
    files.truncate(limit);
    files
}

fn collect_session_files_limited(dir: &Path, out: &mut Vec<PathBuf>, limit: usize) {
    if out.len() >= limit {
        return;
    }
    for path in sorted_dir_entries(dir) {
        if out.len() >= limit {
            break;
        }
        if path.is_dir() {
            collect_session_files_limited(&path, out, limit);
        } else if is_session_jsonl(&path) {
            out.push(path);
        }
    }
}

fn sorted_dir_entries(dir: &Path) -> Vec<PathBuf> {
    let Ok(entries) = fs::read_dir(dir) else {
        return Vec::new();
    };
    let mut paths = entries
        .flatten()
        .map(|entry| entry.path())
        .collect::<Vec<_>>();
    paths.sort_by(|left, right| {
        path_file_name(right)
            .cmp(&path_file_name(left))
            .then_with(|| right.cmp(left))
    });
    paths
}

fn path_file_name(path: &Path) -> String {
    path.file_name()
        .map(|value| value.to_string_lossy().to_string())
        .unwrap_or_default()
}

fn is_session_file_match(path: &Path, id: &str) -> bool {
    is_session_jsonl(path)
        && path
            .file_name()
            .map(|name| name.to_string_lossy().contains(id))
            .unwrap_or(false)
}

fn is_session_jsonl(path: &Path) -> bool {
    path.extension().and_then(|value| value.to_str()) == Some("jsonl")
}

fn keep_latest_session_file(best: &mut Option<PathBuf>, candidate: PathBuf) {
    let should_replace = best
        .as_ref()
        .map(|current| session_modified_at(&candidate) > session_modified_at(current))
        .unwrap_or(true);
    if should_replace {
        *best = Some(candidate);
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

fn normalize_session_page_limit(limit: usize) -> usize {
    limit.clamp(1, 50)
}

fn normalized_optional_filter(value: Option<&str>) -> Option<String> {
    value
        .map(str::trim)
        .filter(|value| !value.is_empty() && *value != "all")
        .map(ToOwned::to_owned)
}

fn normalize_search_query(value: &str) -> String {
    value
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .to_lowercase()
}

fn profile_session_matches_query(item: &ProfileSessionSummary, query: &str) -> bool {
    [
        item.profile_name.as_str(),
        item.profile_alias.as_deref().unwrap_or_default(),
        item.profile_category.as_str(),
        item.session.id.as_str(),
        item.session.title.as_str(),
        item.session.renamed_title.as_deref().unwrap_or_default(),
        item.session.summary.as_deref().unwrap_or_default(),
        item.session.cwd.as_deref().unwrap_or_default(),
        item.session.path.as_deref().unwrap_or_default(),
    ]
    .join(" ")
    .to_lowercase()
    .contains(query)
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
    app_data_dir(context).join("profile-metadata.json")
}

fn app_data_dir(context: &ProfileContext) -> PathBuf {
    context.home_dir.join(".rcodexmanager")
}

fn auth_vault_dir(context: &ProfileContext) -> PathBuf {
    app_data_dir(context).join("auth-vault")
}

fn auth_vault_exports_dir(context: &ProfileContext) -> PathBuf {
    auth_vault_dir(context).join("exports")
}

fn auth_vault_index_path(context: &ProfileContext) -> PathBuf {
    app_data_dir(context).join("auth-vault.json")
}

fn wechat_bridge_store_path(context: &ProfileContext) -> PathBuf {
    app_data_dir(context).join("wechat-bridges.json")
}

fn wechat_bridge_root_dir(context: &ProfileContext) -> PathBuf {
    app_data_dir(context).join("wechat-bridges")
}

#[derive(Debug, Clone)]
struct WechatBridgePaths {
    runtime_dir: PathBuf,
    storage_dir: PathBuf,
    token_path: PathBuf,
    inbox_dir: PathBuf,
    wrapper_path: PathBuf,
    app_log_path: PathBuf,
    default_log_path: PathBuf,
}

fn wechat_bridge_paths(context: &ProfileContext, instance: &str) -> WechatBridgePaths {
    let runtime_dir = wechat_bridge_root_dir(context).join(instance);
    let storage_dir = context
        .home_dir
        .join(".wechat-acp")
        .join("instances")
        .join(instance);
    WechatBridgePaths {
        token_path: storage_dir.join("token.json"),
        default_log_path: storage_dir.join("wechat-acp.log"),
        inbox_dir: runtime_dir.join("inbox"),
        wrapper_path: runtime_dir.join("codex-acp-server"),
        app_log_path: runtime_dir.join("wechat-acp.log"),
        runtime_dir,
        storage_dir,
    }
}

fn read_auth_vault_store(context: &ProfileContext) -> Result<AuthVaultStore, String> {
    let path = auth_vault_index_path(context);
    if !path.exists() {
        return Ok(AuthVaultStore::default());
    }

    let contents = fs::read_to_string(&path).map_err(|error| error.to_string())?;
    serde_json::from_str(&contents).map_err(|error| {
        format!(
            "failed to parse auth vault file {}: {error}",
            path_string(&path)
        )
    })
}

fn write_auth_vault_store(context: &ProfileContext, store: &AuthVaultStore) -> Result<(), String> {
    let path = auth_vault_index_path(context);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let payload = serde_json::to_string_pretty(store).map_err(|error| error.to_string())?;
    fs::write(path, format!("{payload}\n")).map_err(|error| error.to_string())
}

fn read_wechat_bridge_store(context: &ProfileContext) -> Result<WechatBridgeStore, String> {
    let path = wechat_bridge_store_path(context);
    if !path.exists() {
        return Ok(WechatBridgeStore::default());
    }

    let contents = fs::read_to_string(&path).map_err(|error| error.to_string())?;
    serde_json::from_str(&contents).map_err(|error| {
        format!(
            "failed to parse WeChat bridge file {}: {error}",
            path_string(&path)
        )
    })
}

fn write_wechat_bridge_store(
    context: &ProfileContext,
    store: &WechatBridgeStore,
) -> Result<(), String> {
    let path = wechat_bridge_store_path(context);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let payload = serde_json::to_string_pretty(store).map_err(|error| error.to_string())?;
    fs::write(path, format!("{payload}\n")).map_err(|error| error.to_string())
}

fn upsert_wechat_bridge_record<F>(
    context: &ProfileContext,
    profile_name: &str,
    instance: &str,
    update: F,
) -> Result<(), String>
where
    F: FnOnce(&mut WechatBridgeRecord),
{
    let mut store = read_wechat_bridge_store(context)?;
    let created_at = now_iso();
    let mut record = store
        .bindings
        .remove(profile_name)
        .unwrap_or_else(|| WechatBridgeRecord {
            profile_name: profile_name.to_string(),
            instance: instance.to_string(),
            created_at: created_at.clone(),
            updated_at: created_at,
            last_started_at: None,
            last_stopped_at: None,
            last_error: None,
        });
    record.profile_name = profile_name.to_string();
    record.instance = instance.to_string();
    update(&mut record);
    store.bindings.insert(profile_name.to_string(), record);
    write_wechat_bridge_store(context, &store)
}

fn auth_profile_slot(profile: &ProfileInfo) -> AuthProfileSlot {
    let auth_path = PathBuf::from(&profile.codex_home).join("auth.json");
    AuthProfileSlot {
        profile_name: profile.name.clone(),
        profile_alias: profile.alias.clone(),
        profile_category: profile.category.clone(),
        is_default: profile.is_default,
        is_running: profile.is_running,
        codex_home: profile.codex_home.clone(),
        auth_path: path_string(&auth_path),
        auth_exists: auth_path.exists(),
        account: profile.account.clone(),
    }
}

fn wechat_bridge_entry(
    context: &ProfileContext,
    profile: &ProfileInfo,
    store: &WechatBridgeStore,
    processes: &[RunningWechatBridgeProcess],
) -> WechatBridgeEntry {
    let instance = store
        .bindings
        .get(&profile.name)
        .map(|record| record.instance.clone())
        .unwrap_or_else(|| wechat_bridge_instance_name(&profile.name));
    let paths = wechat_bridge_paths(context, &instance);
    let record = store.bindings.get(&profile.name);
    let running_pids = matching_wechat_bridge_pids(processes, &instance);
    let auth_path = PathBuf::from(&profile.codex_home).join("auth.json");

    WechatBridgeEntry {
        profile_name: profile.name.clone(),
        profile_label: profile
            .alias
            .clone()
            .unwrap_or_else(|| profile.name.clone()),
        profile_category: profile.category.clone(),
        codex_home: profile.codex_home.clone(),
        auth_exists: auth_path.exists(),
        account: profile.account.clone(),
        instance,
        storage_dir: path_string(&paths.storage_dir),
        token_path: path_string(&paths.token_path),
        inbox_dir: path_string(&paths.inbox_dir),
        wrapper_path: path_string(&paths.wrapper_path),
        app_log_path: path_string(&paths.app_log_path),
        default_log_path: path_string(&paths.default_log_path),
        token_exists: paths.token_path.exists(),
        running: !running_pids.is_empty(),
        running_pids,
        last_started_at: record.and_then(|record| record.last_started_at.clone()),
        last_stopped_at: record.and_then(|record| record.last_stopped_at.clone()),
        last_error: record.and_then(|record| record.last_error.clone()),
        log_tail: read_wechat_bridge_log_tail(&paths, WECHAT_BRIDGE_LOG_TAIL_LINES),
    }
}

fn auth_backup_entry(record: AuthBackupRecord) -> AuthBackupEntry {
    let path = PathBuf::from(&record.path);
    let auth_json = fs::read_to_string(&path)
        .ok()
        .and_then(|contents| serde_json::from_str::<Value>(&contents).ok());
    let account = auth_json
        .as_ref()
        .and_then(read_codex_auth_material_from_value)
        .and_then(|material| material.account);
    let has_refresh_token = auth_json.as_ref().is_some_and(auth_json_has_refresh_token);

    AuthBackupEntry {
        id: record.id,
        label: record.label,
        note: record.note,
        created_at: record.created_at,
        updated_at: record.updated_at,
        source_profile_name: record.source_profile_name,
        source_profile_label: record.source_profile_label,
        source_codex_home: record.source_codex_home,
        path: record.path,
        exists: path.exists(),
        pinned: record.pinned,
        account,
        has_refresh_token,
    }
}

fn auth_backup_sort_order(left: &AuthBackupEntry, right: &AuthBackupEntry) -> std::cmp::Ordering {
    right
        .pinned
        .cmp(&left.pinned)
        .then_with(|| {
            right
                .updated_at
                .as_deref()
                .unwrap_or(&right.created_at)
                .cmp(left.updated_at.as_deref().unwrap_or(&left.created_at))
        })
        .then_with(|| right.created_at.cmp(&left.created_at))
        .then_with(|| left.label.cmp(&right.label))
}

fn codex_account_key(account: Option<&CodexAccountInfo>) -> String {
    account
        .and_then(|account| {
            [
                account.account_id.as_deref(),
                account.user_id.as_deref(),
                account.email.as_deref(),
                account.name.as_deref(),
            ]
            .into_iter()
            .flatten()
            .map(str::trim)
            .find(|value| !value.is_empty())
            .map(ToOwned::to_owned)
        })
        .unwrap_or_default()
}

fn auth_application_entry(record: AuthApplicationRecord) -> AuthApplicationEntry {
    let previous_auth_exists = record
        .previous_auth_path
        .as_ref()
        .is_some_and(|path| PathBuf::from(path).exists());
    let previous_account = record
        .previous_auth_path
        .as_ref()
        .and_then(|path| read_auth_account_from_path(Path::new(path)));

    AuthApplicationEntry {
        id: record.id,
        applied_at: record.applied_at,
        backup_id: record.backup_id,
        backup_label: record.backup_label,
        target_profile_name: record.target_profile_name,
        target_profile_label: record.target_profile_label,
        target_codex_home: record.target_codex_home,
        previous_auth_path: record.previous_auth_path,
        previous_auth_exists,
        previous_account,
        applied_account: record.applied_account,
        rolled_back_at: record.rolled_back_at,
    }
}

fn read_auth_account_from_path(path: &Path) -> Option<CodexAccountInfo> {
    fs::read_to_string(path)
        .ok()
        .and_then(|contents| serde_json::from_str::<Value>(&contents).ok())
        .and_then(|value| read_codex_auth_material_from_value(&value))
        .and_then(|material| material.account)
}

fn auth_json_has_refresh_token(value: &Value) -> bool {
    string_at(
        value.get("tokens").unwrap_or(&Value::Null),
        &["refresh_token"],
    )
    .or_else(|| string_at(value, &["refresh_token"]))
    .is_some()
}

fn unique_auth_backup_id(store: &AuthVaultStore, profile_name: &str) -> String {
    let suffix = sanitize_id_component(profile_name);
    let base = format!("{}-{suffix}", timestamp_compact());
    if !store.backups.contains_key(&base) {
        return base;
    }
    for index in 2..1000 {
        let candidate = format!("{base}-{index}");
        if !store.backups.contains_key(&candidate) {
            return candidate;
        }
    }
    format!("{base}-{}", Utc::now().timestamp_millis())
}

fn unique_auth_application_id(store: &AuthVaultStore, profile_name: &str) -> String {
    let suffix = sanitize_id_component(profile_name);
    let base = format!("{}-apply-{suffix}", timestamp_compact());
    if !store.applications.contains_key(&base) {
        return base;
    }
    for index in 2..1000 {
        let candidate = format!("{base}-{index}");
        if !store.applications.contains_key(&candidate) {
            return candidate;
        }
    }
    format!("{base}-{}", Utc::now().timestamp_millis())
}

fn unique_auth_export_path(dir: &Path, label: &str) -> PathBuf {
    let suffix = sanitize_id_component(label);
    let base = format!("{}-{suffix}", timestamp_compact());
    for index in 1..1000 {
        let file_name = if index == 1 {
            format!("{base}.rcodex-auth.json")
        } else {
            format!("{base}-{index}.rcodex-auth.json")
        };
        let candidate = dir.join(file_name);
        if !candidate.exists() {
            return candidate;
        }
    }
    dir.join(format!(
        "{base}-{}.rcodex-auth.json",
        Utc::now().timestamp_millis()
    ))
}

fn sanitize_id_component(value: &str) -> String {
    let normalized = value
        .chars()
        .map(|char| {
            if char.is_ascii_alphanumeric() || char == '-' || char == '_' {
                char
            } else {
                '-'
            }
        })
        .collect::<String>();
    let trimmed = normalized.trim_matches('-');
    if trimmed.is_empty() {
        "auth".to_string()
    } else {
        trimmed.to_string()
    }
}

fn wechat_bridge_instance_name(profile_name: &str) -> String {
    sanitize_id_component(profile_name)
}

fn write_wechat_bridge_wrapper(path: &Path, profile: &ProfileInfo) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let script = format!(
        "#!/usr/bin/env bash\nset -euo pipefail\nexport CODEX_HOME={}\nexec npx -y --package {} codex-acp -c 'shell_environment_policy.inherit=\"all\"' \"$@\"\n",
        shell_quote(&profile.codex_home),
        CODEX_ACP_PACKAGE,
    );
    fs::write(path, script).map_err(|error| {
        format!(
            "failed to write WeChat Codex ACP wrapper {}: {error}",
            path_string(path)
        )
    })?;
    #[cfg(unix)]
    {
        let mut permissions = fs::metadata(path)
            .map_err(|error| error.to_string())?
            .permissions();
        permissions.set_mode(0o755);
        fs::set_permissions(path, permissions).map_err(|error| error.to_string())?;
    }
    Ok(())
}

fn render_wechat_bridge_user_service(
    context: &ProfileContext,
    profile: &ProfileInfo,
    paths: &WechatBridgePaths,
    instance: &str,
) -> String {
    let exec = format!(
        "exec npx -y --package {} wechat-acp --instance {} --agent {} --cwd {} --inbox-dir {} --hide-thoughts",
        shell_quote(WECHAT_ACP_PACKAGE),
        shell_quote(instance),
        shell_quote(&path_string(&paths.wrapper_path)),
        shell_quote(&path_string(&context.home_dir)),
        shell_quote(&path_string(&paths.inbox_dir)),
    );
    format!(
        "[Unit]\nDescription=rCodexManager WeChat bridge for {profile_name}\nAfter=network-online.target\nWants=network-online.target\n\n[Service]\nType=simple\nWorkingDirectory={workdir}\nEnvironment=CODEX_HOME={codex_home}\nExecStart=/bin/sh -lc {exec}\nRestart=always\nRestartSec=5\n\n[Install]\nWantedBy=default.target\n",
        profile_name = profile.name,
        workdir = path_string(&context.home_dir),
        codex_home = profile.codex_home,
        exec = shell_quote(&exec),
    )
}

fn run_systemctl_user(args: &[&str]) -> Result<(), String> {
    let status = Command::new("systemctl")
        .arg("--user")
        .args(args)
        .status()
        .map_err(|error| format!("failed to run systemctl --user {}: {error}", args.join(" ")))?;
    if status.success() {
        Ok(())
    } else {
        Err(format!(
            "systemctl --user {} exited with {status}",
            args.join(" ")
        ))
    }
}

fn shell_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "'\\''"))
}

fn read_wechat_bridge_log_tail(paths: &WechatBridgePaths, lines: usize) -> Vec<String> {
    let app_tail = tail_text_file_lines(&paths.app_log_path, lines);
    if !app_tail.is_empty() {
        return app_tail;
    }
    tail_text_file_lines(&paths.default_log_path, lines)
}

fn tail_text_file_lines(path: &Path, lines: usize) -> Vec<String> {
    if lines == 0 {
        return Vec::new();
    }
    let mut file = match fs::File::open(path) {
        Ok(file) => file,
        Err(_) => return Vec::new(),
    };
    let length = match file.metadata() {
        Ok(metadata) => metadata.len(),
        Err(_) => return Vec::new(),
    };
    let read_size = (128 * 1024).min(length);
    if file
        .seek(SeekFrom::Start(length.saturating_sub(read_size)))
        .is_err()
    {
        return Vec::new();
    }
    let mut buffer = String::new();
    if file.read_to_string(&mut buffer).is_err() {
        return Vec::new();
    }
    if read_size < length {
        if let Some((_, tail)) = buffer.split_once('\n') {
            buffer = tail.to_string();
        }
    }

    let mut result = buffer
        .lines()
        .rev()
        .take(lines)
        .map(sanitize_wechat_log_line)
        .collect::<Vec<_>>();
    result.reverse();
    result
}

fn sanitize_wechat_log_line(line: &str) -> String {
    let lower = line.to_ascii_lowercase();
    let sensitive = [
        "access_token",
        "refresh_token",
        "authorization",
        "bearer ",
        "set-cookie",
        "cookie:",
        "http_proxy=",
        "https_proxy=",
        "all_proxy=",
    ];
    if sensitive.iter().any(|marker| lower.contains(marker)) {
        "[sensitive log line hidden]".to_string()
    } else {
        line.to_string()
    }
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

fn profile_launcher_kind_from_body(body: &str) -> ProfileLauncherKind {
    if body.contains("open -n -a \"Codex\"")
        || body.contains("open -n -a Codex")
        || body.contains("--user-data-dir=")
    {
        ProfileLauncherKind::Desktop
    } else {
        ProfileLauncherKind::Server
    }
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

    match draft.launcher_kind {
        ProfileLauncherKind::Desktop => format!(
            "{name}() {{\n  mkdir -p \"{codex_home}\" \"{user_data_dir}\"\n  open -n -a \"Codex\" \\\n    --env CODEX_HOME=\"{codex_home}\" \\\n    --args --user-data-dir=\"{user_data_dir}\"\n}}\n\n",
            name = draft.name,
        ),
        ProfileLauncherKind::Server => format!(
            "{name}() {{\n  mkdir -p \"{codex_home}\"\n  CODEX_HOME=\"{codex_home}\" codex \"$@\"\n}}\n\n",
            name = draft.name,
        ),
    }
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

fn write_copied_profile_config(
    source_config_path: &Path,
    target_config_path: &Path,
    model: &str,
    reasoning_effort: &str,
) -> Result<(), String> {
    if let Some(parent) = target_config_path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    let source_contents = fs::read_to_string(source_config_path).ok();
    let Some(contents) = source_contents else {
        return write_profile_config(target_config_path, model, reasoning_effort);
    };

    let contents = upsert_toml_top_level_strings(
        &contents,
        [
            ("model", model),
            ("model_reasoning_effort", reasoning_effort),
        ],
    );
    let contents = upsert_toml_bool_section(
        &contents,
        "features",
        CODEX_WEBSOCKET_FEATURE_FLAGS
            .iter()
            .map(|flag| (*flag, true)),
    );
    fs::write(target_config_path, contents).map_err(|error| {
        format!(
            "failed to write copied config {}: {error}",
            path_string(target_config_path)
        )
    })
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

fn upsert_toml_top_level_strings<'a>(
    contents: &str,
    pairs: impl IntoIterator<Item = (&'a str, &'a str)>,
) -> String {
    let mut lines: Vec<String> = contents.lines().map(ToString::to_string).collect();
    let had_trailing_newline = contents.ends_with('\n');
    let pairs = pairs.into_iter().collect::<Vec<_>>();
    let first_section = lines
        .iter()
        .position(|line| line.trim_start().starts_with('['))
        .unwrap_or(lines.len());
    let mut insert_at = first_section;

    for (key, value) in pairs {
        let prefix = format!("{key} =");
        let replacement = format!("{key} = \"{}\"", escape_toml_string(value));
        if let Some(index) =
            (0..first_section).find(|index| lines[*index].trim_start().starts_with(&prefix))
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

fn apply_child_proxy_env(command: &mut Command, proxy: &ProxyEnvSettings) {
    for (key, value) in proxy_env_pairs(proxy) {
        command.env(key, &value);
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

fn default_session_page_limit() -> usize {
    10
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
