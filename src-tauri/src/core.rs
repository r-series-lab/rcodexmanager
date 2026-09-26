use base64::{engine::general_purpose, Engine as _};
use chrono::{DateTime, Duration as ChronoDuration, SecondsFormat, Utc};
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use std::collections::BTreeMap;
use std::collections::BTreeSet;
use std::collections::VecDeque;
use std::fs;
use std::fs::OpenOptions;
use std::io::{BufRead, BufReader, Read, Seek, SeekFrom, Write};
use std::net::{SocketAddr, TcpListener, TcpStream};
#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use std::thread::{self, JoinHandle};
use std::time::{Duration, Instant, SystemTime};

const MANAGED_BLOCK_START: &str = "# >>> rCodexManager profiles >>>";
const MANAGED_BLOCK_END: &str = "# <<< rCodexManager profiles <<<";
const DEFAULT_MODEL: &str = "gpt-5.5";
const DEFAULT_REASONING_EFFORT: &str = "xhigh";
const MODEL_ROUTE_PROXY_HOST: &str = "127.0.0.1";
const MODEL_ROUTE_PROXY_PORT: u16 = 15721;
const MODEL_ROUTE_PROXY_TIMEOUT_MS: u64 = 250;
const MODEL_ROUTE_PROXY_MAX_REQUEST_BYTES: usize = 8 * 1024 * 1024;
const MODEL_ROUTE_UPSTREAM_BASE_URL_KEY: &str = "rcodexmanager_upstream_base_url";
const MODEL_ROUTE_MODE_KEY: &str = "rcodexmanager_route_mode";
const MODEL_ROUTE_PRESET_KEY: &str = "rcodexmanager_preset";
const MODEL_ROUTE_CHAT_TOOL_NAME_MAX_LEN: usize = 64;
const MODEL_ROUTE_CUSTOM_TOOL_INPUT_FIELD: &str = "input";
const MODEL_ROUTE_TOOL_SEARCH_PROXY_NAME: &str = "tool_search";
const MODEL_ROUTE_PROXY_LOG_LIMIT: usize = 30;
const CHATGPT_BASE_URL: &str = "https://chatgpt.com";
const CHATGPT_USAGE_ENDPOINT: &str = "https://chatgpt.com/backend-api/wham/usage";
const QUOTA_HTTP_TIMEOUT_SECONDS: u64 = 25;
const CODEX_WRAPPER_PROXY_SCAN_MAX_BYTES: u64 = 128 * 1024;
const PROXY_ENV_KEYS: &[&str] = &[
    "HTTPS_PROXY",
    "https_proxy",
    "ALL_PROXY",
    "all_proxy",
    "HTTP_PROXY",
    "http_proxy",
];
const PROFILE_SESSION_PREVIEW_LIMIT: usize = 1;
const SESSION_INDEX_READ_CHUNK_SIZE: u64 = 16 * 1024;
const CODEX_MAIN_EXECUTABLE_SUFFIXES: &[&str] = &[
    "/Codex.app/Contents/MacOS/Codex",
    "/Codex.app/Contents/MacOS/ChatGPT",
];
const SERVER_PROFILE_TMUX_PREFIX: &str = "rcodexmanager-";
const SESSION_DETAIL_HEAD_BYTES: u64 = 512 * 1024;
const SESSION_DETAIL_TAIL_BYTES: u64 = 2 * 1024 * 1024;
const SESSION_DETAIL_CACHE_LIMIT: usize = 64;
const DEFAULT_NO_PROXY: &str = "localhost,127.0.0.1,::1,*.local";
const AUTH_BACKUP_EXPORT_KIND: &str = "app.rseries.rcodexmanager.auth-backup";
const AUTH_BACKUP_EXPORT_VERSION: u16 = 1;
const WECHAT_ACP_PACKAGE: &str = "wechat-acp@0.10.0";
const CODEX_ACP_PACKAGE: &str = "@agentclientprotocol/codex-acp@1.12.0";
const WECHAT_BRIDGE_LOG_TAIL_LINES: usize = 80;
const WECHAT_MIN_NODE_MAJOR: u32 = 20;
const WECHAT_START_SETTLE_MS: u64 = 700;
const FEISHU_REMOTE_INSTANCE: &str = "rcodexmanager";
const FEISHU_REMOTE_DEFAULT_ADMIN_PORT: u16 = 9501;
const FEISHU_REMOTE_HTTP_TIMEOUT_MS: u64 = 700;
const FEISHU_REMOTE_LOG_TAIL_LINES: usize = 120;
const FEISHU_REMOTE_PROJECT_URL: &str = "https://github.com/kxn/codex-remote-feishu";
const MODEL_ROUTE_PROVIDER_ID: &str = "rcodexmanager-route";

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
        let resolved_zshrc = zshrc_path.unwrap_or_else(|| default_shell_rc_path(&resolved_home));

        Ok(Self {
            home_dir: resolved_home,
            zshrc_path: resolved_zshrc,
        })
    }
}

fn default_shell_rc_path(home_dir: &Path) -> PathBuf {
    let zshrc = home_dir.join(".zshrc");
    let bashrc = home_dir.join(".bashrc");

    if zshrc.exists() {
        return zshrc;
    }
    if bashrc.exists() {
        return bashrc;
    }

    match std::env::var("SHELL")
        .ok()
        .and_then(|shell| Path::new(&shell).file_name().map(|name| name.to_owned()))
        .and_then(|name| name.to_str().map(str::to_owned))
        .as_deref()
    {
        Some("bash") => bashrc,
        _ => zshrc,
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
pub struct UpdateProfileModelInput {
    pub profile_name: String,
    pub model: String,
    pub reasoning_effort: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateProfileLauncherInput {
    pub profile_name: String,
    pub new_profile_name: String,
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
pub struct ReadProfileSessionDetailInput {
    pub profile_name: String,
    pub session_id: String,
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateAuthBackupInput {
    pub name: String,
    pub label: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateAuthBackupsInput {
    pub profile_names: Vec<String>,
    pub label: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewAuthBackupPackageInput {
    pub package_json: String,
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
pub struct RestartWechatBridgeInput {
    pub profile_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UnbindWechatBridgeInput {
    pub profile_name: String,
    #[serde(default)]
    pub confirm_sensitive: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadWechatBridgeLogInput {
    pub profile_name: String,
    pub lines: Option<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfigureFeishuRemoteInput {
    pub profile_name: String,
    pub binary_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartFeishuRemoteInput {
    pub profile_name: String,
    pub binary_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadFeishuRemoteLogInput {
    pub lines: Option<usize>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum FeishuRemotePage {
    Setup,
    Admin,
    Project,
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
pub enum ModelRoutePreset {
    AliyunQwen,
    Glm,
    OpenaiChat,
    LocalOpenai,
    CustomResponses,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewModelRouteInput {
    pub profile_name: String,
    pub preset: ModelRoutePreset,
    pub model: String,
    pub reasoning_effort: Option<String>,
    pub proxy_base_url: Option<String>,
    pub upstream_base_url: Option<String>,
    pub api_key: Option<String>,
    pub api_key_env: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApplyModelRouteInput {
    pub profile_name: String,
    pub preset: ModelRoutePreset,
    pub model: String,
    pub reasoning_effort: Option<String>,
    pub proxy_base_url: Option<String>,
    pub upstream_base_url: Option<String>,
    pub api_key: Option<String>,
    pub api_key_env: Option<String>,
    #[serde(default)]
    pub confirm_sensitive: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RestoreModelRouteInput {
    pub profile_name: String,
    #[serde(default)]
    pub confirm_sensitive: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckModelRouteProxyInput {
    pub profile_name: String,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum ProfileLauncherKind {
    Desktop,
    Server,
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum ProfileAuthStatus {
    Missing,
    Valid,
    RefreshRequired,
    Expired,
    ApiKey,
    Unknown,
    Invalid,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfileAuthState {
    pub status: ProfileAuthStatus,
    pub expires_at: Option<i64>,
    pub refresh_available: bool,
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
    pub model_provider: Option<String>,
    pub reasoning_effort: Option<String>,
    pub home_exists: bool,
    pub user_data_exists: bool,
    pub config_exists: bool,
    pub managed_by_app: bool,
    pub is_default: bool,
    pub is_archived: bool,
    pub archived_at: Option<String>,
    pub launcher_kind: ProfileLauncherKind,
    pub zshrc_line: usize,
    pub is_running: bool,
    pub running_pids: Vec<u32>,
    pub running_process_count: usize,
    pub account: Option<CodexAccountInfo>,
    pub auth_state: ProfileAuthState,
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

#[derive(Debug, Clone, Deserialize, Default)]
struct QuotaConfigFile {
    #[serde(default)]
    profiles: BTreeMap<String, QuotaProfileConfig>,
    #[serde(default)]
    providers: BTreeMap<String, QuotaProviderConfig>,
}

#[derive(Debug, Clone, Deserialize)]
struct QuotaProfileConfig {
    provider: String,
}

#[derive(Debug, Clone, Deserialize)]
struct QuotaProviderConfig {
    url: String,
    #[serde(default = "default_quota_method")]
    method: String,
    #[serde(default)]
    auth: Option<String>,
    #[serde(default)]
    api_key_env: Option<String>,
    #[serde(default)]
    auth_header: Option<String>,
    #[serde(default)]
    auth_prefix: Option<String>,
    #[serde(default)]
    headers: BTreeMap<String, String>,
    #[serde(default)]
    mapping: QuotaMappingConfig,
}

#[derive(Debug, Clone, Deserialize)]
struct QuotaMappingConfig {
    #[serde(default = "default_quota_windows_path")]
    windows: String,
    #[serde(default = "default_quota_id_path")]
    id: String,
    #[serde(default = "default_quota_label_path")]
    label: String,
    #[serde(default)]
    used_percent: Option<String>,
    #[serde(default)]
    remaining_percent: Option<String>,
    #[serde(default)]
    window_minutes: Option<String>,
    #[serde(default)]
    resets_at: Option<String>,
    #[serde(default)]
    allowed: Option<String>,
    #[serde(default)]
    limit_reached: Option<String>,
    #[serde(default)]
    status: Option<String>,
}

impl Default for QuotaMappingConfig {
    fn default() -> Self {
        Self {
            windows: default_quota_windows_path(),
            id: default_quota_id_path(),
            label: default_quota_label_path(),
            used_percent: None,
            remaining_percent: None,
            window_minutes: None,
            resets_at: None,
            allowed: None,
            limit_reached: None,
            status: None,
        }
    }
}

fn default_quota_method() -> String {
    "GET".to_string()
}
fn default_quota_windows_path() -> String {
    "windows".to_string()
}
fn default_quota_id_path() -> String {
    "id".to_string()
}
fn default_quota_label_path() -> String {
    "label".to_string()
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
pub struct ModelRoutePresetInfo {
    pub id: ModelRoutePreset,
    pub label: String,
    pub description: String,
    pub default_model: String,
    pub default_base_url: Option<String>,
    pub chat_only: bool,
    pub requires_proxy: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfileModelRouteState {
    pub profile_name: String,
    pub profile_label: String,
    pub profile_category: String,
    pub codex_home: String,
    pub config_path: String,
    pub config_exists: bool,
    pub is_default: bool,
    pub is_running: bool,
    pub model: Option<String>,
    pub reasoning_effort: Option<String>,
    pub model_provider: Option<String>,
    pub base_url: Option<String>,
    pub wire_api: Option<String>,
    pub has_api_key: bool,
    pub api_key_source: Option<String>,
    pub api_key_env: Option<String>,
    pub route_mode: Option<String>,
    pub upstream_base_url: Option<String>,
    pub preset: Option<ModelRoutePreset>,
    pub managed_route: bool,
    pub route_status: String,
    pub route_status_label: String,
    pub read_only_reason: Option<String>,
    pub routed: bool,
    pub needs_proxy: bool,
    pub needs_attention: bool,
    pub can_apply: bool,
    pub can_restore: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelRouteProxyStatus {
    pub generated_at: String,
    pub listen_host: String,
    pub listen_port: u16,
    pub base_url: String,
    pub service_kind: String,
    pub service_label: String,
    pub service_detail: Option<String>,
    pub reachable: bool,
    pub managed: bool,
    pub can_start: bool,
    pub can_stop: bool,
    pub status: String,
    pub status_label: String,
    pub message: String,
    pub diagnostics: Vec<ModelRouteProxyDiagnostic>,
    pub recent_logs: Vec<ModelRouteProxyLogEntry>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelRouteProxyDiagnostic {
    pub generated_at: String,
    pub level: String,
    pub code: String,
    pub label: String,
    pub message: String,
    pub detail: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelRouteProxyLogEntry {
    pub generated_at: String,
    pub kind: String,
    pub profile_name: Option<String>,
    pub model: Option<String>,
    pub endpoint: Option<String>,
    pub ok: bool,
    pub status: String,
    pub status_label: String,
    pub message: String,
    pub http_status: Option<u16>,
    pub latency_ms: u128,
    pub diagnostic_code: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelRouteProxyCheckResult {
    pub generated_at: String,
    pub profile_name: String,
    pub model: String,
    pub base_url: Option<String>,
    pub endpoint: Option<String>,
    pub ok: bool,
    pub status: String,
    pub status_label: String,
    pub message: String,
    pub http_status: Option<u16>,
    pub latency_ms: u128,
    pub diagnostic: Option<ModelRouteProxyDiagnostic>,
    pub proxy: ModelRouteProxyStatus,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelRouteReport {
    pub generated_at: String,
    pub profile_count: usize,
    pub routed_count: usize,
    pub needs_attention_count: usize,
    pub proxy: ModelRouteProxyStatus,
    pub presets: Vec<ModelRoutePresetInfo>,
    pub profiles: Vec<ProfileModelRouteState>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelRoutePreview {
    pub generated_at: String,
    pub profile_name: String,
    pub preset: ModelRoutePreset,
    pub preset_label: String,
    pub provider_id: String,
    pub provider_name: String,
    pub model: String,
    pub reasoning_effort: String,
    pub base_url: String,
    pub wire_api: String,
    pub chat_only: bool,
    pub uses_proxy: bool,
    pub api_key_source: Option<String>,
    pub config_preview: String,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum DoctorCheckStatus {
    Ok,
    Warning,
    Error,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DoctorCheck {
    pub id: String,
    pub group: String,
    pub label: String,
    pub status: DoctorCheckStatus,
    pub message: String,
    pub details: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DoctorSummary {
    pub ok_count: usize,
    pub warning_count: usize,
    pub error_count: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DoctorReport {
    pub generated_at: String,
    pub app_version: String,
    pub platform: String,
    pub ready: bool,
    pub summary: DoctorSummary,
    pub checks: Vec<DoctorCheck>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfileReport {
    pub generated_at: String,
    pub zshrc_path: String,
    pub metadata_path: String,
    pub home_dir: String,
    pub profile_count: usize,
    pub archived_count: usize,
    pub profiles: Vec<ProfileInfo>,
    pub archived_profiles: Vec<ProfileInfo>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfileRuntimeTarget {
    pub name: String,
    pub codex_home: String,
    pub user_data_dir: String,
    pub launcher_kind: ProfileLauncherKind,
    pub is_default: bool,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ProfileRuntimeInfo {
    pub name: String,
    pub is_running: bool,
    pub running_pids: Vec<u32>,
    pub running_process_count: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfileRuntimeReport {
    pub generated_at: String,
    pub profiles: Vec<ProfileRuntimeInfo>,
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
    pub valid: bool,
    pub validation_message: Option<String>,
    pub file_size_bytes: Option<u64>,
    pub modified_at: Option<String>,
    pub pinned: bool,
    pub account: Option<CodexAccountInfo>,
    pub has_refresh_token: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthBatchBackupItemResult {
    pub profile_name: String,
    pub ok: bool,
    pub backup_id: Option<String>,
    pub message: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthBatchBackupResult {
    pub generated_at: String,
    pub success_count: usize,
    pub failure_count: usize,
    pub results: Vec<AuthBatchBackupItemResult>,
    pub vault: AuthVaultReport,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthBackupImportPreview {
    pub valid: bool,
    pub label: String,
    pub note: Option<String>,
    pub source_profile_name: Option<String>,
    pub source_profile_label: Option<String>,
    pub account: Option<CodexAccountInfo>,
    pub has_refresh_token: bool,
    pub exported_at: String,
    pub warnings: Vec<String>,
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
    pub managed_by_app: bool,
    pub connection_state: String,
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
pub struct FeishuRemoteReport {
    pub generated_at: String,
    pub instance: String,
    pub installed: bool,
    pub binary_path: Option<String>,
    pub version: Option<String>,
    pub profile_name: Option<String>,
    pub profile_label: Option<String>,
    pub codex_home: Option<String>,
    pub auth_exists: bool,
    pub configured: bool,
    pub running: bool,
    pub healthy: bool,
    pub connection_state: String,
    pub pid: Option<u32>,
    pub config_path: String,
    pub state_path: String,
    pub log_path: String,
    pub admin_port: u16,
    pub setup_url: String,
    pub admin_url: String,
    pub gateway_count: usize,
    pub connected_gateway_count: usize,
    pub last_started_at: Option<String>,
    pub last_stopped_at: Option<String>,
    pub last_error: Option<String>,
    pub log_tail: Vec<String>,
    pub project_url: String,
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
    archived_at: Option<String>,
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
    has_refresh_token: bool,
    has_api_key: bool,
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

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct FeishuRemoteStore {
    profile_name: Option<String>,
    binary_path: Option<String>,
    updated_at: Option<String>,
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
    let running_processes = running_codex_processes().unwrap_or_default();
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

        let Some(codex_home) =
            resolve_shell_path_value(&function.body, "CODEX_HOME=", &context.home_dir)
        else {
            continue;
        };
        let launcher_kind = profile_launcher_kind_from_body(&function.body);
        let user_data_dir =
            resolve_shell_path_value(&function.body, "--user-data-dir=", &context.home_dir)
                .unwrap_or_else(|| default_user_data_dir(context, &function.name, launcher_kind));
        let config_path = codex_home.join("config.toml");
        let config = read_codex_config(&config_path);
        let (account, auth_state) = read_profile_auth(&codex_home);
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
        let archived_at = metadata.archived_at.clone();
        let managed_by_app = managed_ranges
            .iter()
            .any(|(start, end)| function.start_line >= *start && function.end_line <= *end);
        let mut running_pids =
            matching_profile_pids(&running_processes, &codex_home, &user_data_dir);
        if launcher_kind == ProfileLauncherKind::Server {
            if let Some(pid) = server_profile_tmux_pid(context, &function.name) {
                if !running_pids.contains(&pid) {
                    running_pids.push(pid);
                }
            }
        }

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
                model_provider: config.model_provider,
                reasoning_effort: config.reasoning_effort,
                home_exists: codex_home.exists(),
                user_data_exists: user_data_dir.exists(),
                config_exists: config_path.exists(),
                managed_by_app,
                is_default: false,
                is_archived: archived_at.is_some(),
                archived_at,
                launcher_kind,
                zshrc_line: function.start_line + 1,
                is_running: !running_pids.is_empty(),
                running_process_count: running_pids.len(),
                running_pids,
                account,
                auth_state,
                latest_session,
                recent_sessions,
            },
        );
    }

    let (archived_profiles, profiles): (Vec<_>, Vec<_>) = profiles
        .into_values()
        .partition(|profile| profile.is_archived);

    Ok(ProfileReport {
        generated_at: now_iso(),
        zshrc_path: path_string(&context.zshrc_path),
        metadata_path: path_string(&metadata_path(context)),
        home_dir: path_string(&context.home_dir),
        profile_count: profiles.len(),
        archived_count: archived_profiles.len(),
        profiles,
        archived_profiles,
    })
}

pub fn list_profile_runtime_statuses(
    context: &ProfileContext,
    targets: Vec<ProfileRuntimeTarget>,
) -> Result<ProfileRuntimeReport, String> {
    if targets.len() > 256 {
        return Err("too many profile runtime targets; maximum is 256".to_string());
    }
    for target in &targets {
        validate_profile_selector_name(&target.name)?;
    }

    let running_processes = running_codex_processes()?;
    let profiles = profile_runtime_statuses_from_processes(context, targets, &running_processes);
    Ok(ProfileRuntimeReport {
        generated_at: now_iso(),
        profiles,
    })
}

pub fn run_doctor(context: &ProfileContext) -> Result<DoctorReport, String> {
    let mut checks = Vec::new();

    checks.push(doctor_check(
        "system.shell",
        "基础环境",
        "启动配置",
        if context.zshrc_path.exists() {
            DoctorCheckStatus::Ok
        } else {
            DoctorCheckStatus::Warning
        },
        if context.zshrc_path.exists() {
            "Shell 启动配置可读取。".to_string()
        } else {
            "未找到 Shell 启动配置，仅能识别默认 profile。".to_string()
        },
        Vec::new(),
    ));

    let profile_report = match list_profiles(context) {
        Ok(report) => Some(report),
        Err(message) => {
            checks.push(doctor_check(
                "profiles.discovery",
                "Profiles",
                "Profile 发现",
                DoctorCheckStatus::Error,
                "无法读取 profile 配置。".to_string(),
                vec![doctor_safe_text(context, &message)],
            ));
            None
        }
    };

    if let Some(report) = profile_report.as_ref() {
        let mut path_issues = Vec::new();
        for profile in &report.profiles {
            let mut missing = Vec::new();
            if !profile.home_exists {
                missing.push("CODEX_HOME");
            }
            if profile.launcher_kind == ProfileLauncherKind::Desktop && !profile.user_data_exists {
                missing.push("User Data");
            }
            if !profile.config_exists {
                missing.push("config.toml");
            }
            if !missing.is_empty() {
                path_issues.push(format!("{}: 缺少 {}", profile.name, missing.join("、")));
            }
        }
        let profile_status = if report.profile_count == 0 {
            DoctorCheckStatus::Error
        } else if path_issues.is_empty() {
            DoctorCheckStatus::Ok
        } else {
            DoctorCheckStatus::Warning
        };
        checks.push(doctor_check(
            "profiles.paths",
            "Profiles",
            "Profile 路径",
            profile_status,
            if report.profile_count == 0 {
                "没有发现可管理的 Codex profile。".to_string()
            } else if path_issues.is_empty() {
                format!("{} 个 profile 的核心路径完整。", report.profile_count)
            } else {
                format!(
                    "{} 个 profile 中有 {} 个路径需要处理。",
                    report.profile_count,
                    path_issues.len()
                )
            },
            path_issues,
        ));

        let running = report
            .profiles
            .iter()
            .filter(|profile| profile.is_running)
            .collect::<Vec<_>>();
        let unhealthy_running = running
            .iter()
            .filter(|profile| {
                !profile.home_exists
                    || (profile.launcher_kind == ProfileLauncherKind::Desktop
                        && !profile.user_data_exists)
                    || !profile.config_exists
            })
            .map(|profile| format!("{}: 运行中但核心路径不完整", profile.name))
            .collect::<Vec<_>>();
        checks.push(doctor_check(
            "profiles.processes",
            "Profiles",
            "运行实例",
            if unhealthy_running.is_empty() {
                DoctorCheckStatus::Ok
            } else {
                DoctorCheckStatus::Error
            },
            if unhealthy_running.is_empty() {
                format!("检测到 {} 个运行中的 profile。", running.len())
            } else {
                format!("{} 个运行实例的配置不完整。", unhealthy_running.len())
            },
            unhealthy_running,
        ));

        let auth_profiles = report
            .profiles
            .iter()
            .filter(|profile| {
                PathBuf::from(&profile.codex_home)
                    .join("auth.json")
                    .exists()
            })
            .count();
        let missing_auth = report
            .profiles
            .iter()
            .filter(|profile| {
                !PathBuf::from(&profile.codex_home)
                    .join("auth.json")
                    .exists()
            })
            .map(|profile| format!("{}: 未登录", profile.name))
            .collect::<Vec<_>>();
        checks.push(doctor_check(
            "auth.profiles",
            "认证",
            "Profile 认证",
            if auth_profiles > 0 {
                DoctorCheckStatus::Ok
            } else {
                DoctorCheckStatus::Warning
            },
            format!(
                "{auth_profiles}/{} 个 profile 已有本地认证。",
                report.profile_count
            ),
            missing_auth,
        ));

        let route_states = report
            .profiles
            .iter()
            .map(profile_model_route_state)
            .collect::<Vec<_>>();
        let routed_count = route_states.iter().filter(|profile| profile.routed).count();
        let route_issues = route_states
            .iter()
            .filter(|profile| profile.needs_attention)
            .map(|profile| format!("{}: {}", profile.profile_name, profile.route_status_label))
            .collect::<Vec<_>>();
        checks.push(doctor_check(
            "model-route.config",
            "模型路由",
            "路由配置",
            if route_issues.is_empty() {
                DoctorCheckStatus::Ok
            } else {
                DoctorCheckStatus::Warning
            },
            if route_issues.is_empty() {
                format!("{routed_count} 个 profile 使用模型路由，未发现配置缺失。")
            } else {
                format!("{} 个模型路由配置需要处理。", route_issues.len())
            },
            route_issues,
        ));

        let proxy = read_model_route_proxy_status();
        let proxy_required = route_states.iter().any(|profile| profile.needs_proxy);
        checks.push(doctor_check(
            "model-route.proxy",
            "模型路由",
            "代理服务",
            if proxy_required && !proxy.reachable {
                DoctorCheckStatus::Warning
            } else {
                DoctorCheckStatus::Ok
            },
            if !proxy_required {
                "当前没有 profile 依赖本地 Responses 代理。".to_string()
            } else if proxy.reachable {
                format!("代理可用：{}。", proxy.service_label)
            } else {
                "路由需要 Responses 代理，但默认本地端口当前不可达。".to_string()
            },
            Vec::new(),
        ));

        match read_wechat_bridge_store(context) {
            Ok(store) => match running_wechat_bridge_processes() {
                Ok(processes) => {
                    let discovered_instances = discover_wechat_instances(context, &processes);
                    let mut bound_count = 0;
                    let mut running_count = 0;
                    let mut bridge_issues = Vec::new();
                    for profile in &report.profiles {
                        let (instance, _) = resolve_wechat_bridge_instance(
                            profile,
                            &store,
                            &discovered_instances,
                            &report.profiles,
                        );
                        let paths = wechat_bridge_paths(context, &instance);
                        if paths.token_path.exists() {
                            bound_count += 1;
                        }
                        if !matching_wechat_bridge_pids(&processes, &instance).is_empty() {
                            running_count += 1;
                        }
                        if let Some(error) = store
                            .bindings
                            .get(&profile.name)
                            .and_then(|record| record.last_error.as_deref())
                        {
                            bridge_issues.push(format!(
                                "{}: {}",
                                profile.name,
                                doctor_safe_text(context, error)
                            ));
                        }
                    }
                    checks.push(doctor_check(
                        "remote.wechat",
                        "远程渠道",
                        "微信桥接",
                        if bridge_issues.is_empty() {
                            DoctorCheckStatus::Ok
                        } else {
                            DoctorCheckStatus::Warning
                        },
                        format!("{bound_count} 个绑定，{running_count} 个运行中。"),
                        bridge_issues,
                    ));
                }
                Err(message) => checks.push(doctor_check(
                    "remote.wechat",
                    "远程渠道",
                    "微信桥接",
                    DoctorCheckStatus::Warning,
                    "无法确认微信桥接进程状态。".to_string(),
                    vec![doctor_safe_text(context, &message)],
                )),
            },
            Err(message) => checks.push(doctor_check(
                "remote.wechat",
                "远程渠道",
                "微信桥接",
                DoctorCheckStatus::Error,
                "微信桥接元数据无法读取。".to_string(),
                vec![doctor_safe_text(context, &message)],
            )),
        }
    }

    match read_auth_vault_store(context) {
        Ok(store) => {
            let backups = store
                .backups
                .into_values()
                .map(auth_backup_entry)
                .collect::<Vec<_>>();
            let invalid = backups
                .iter()
                .filter(|backup| !backup.valid)
                .map(|backup| {
                    format!(
                        "{}: {}",
                        backup.id,
                        backup.validation_message.as_deref().unwrap_or("备份不可用")
                    )
                })
                .collect::<Vec<_>>();
            checks.push(doctor_check(
                "auth.backups",
                "认证",
                "备份完整性",
                if invalid.is_empty() {
                    DoctorCheckStatus::Ok
                } else {
                    DoctorCheckStatus::Warning
                },
                if invalid.is_empty() {
                    format!("{} 个认证备份均可读取。", backups.len())
                } else {
                    format!("{} 个认证备份不可用。", invalid.len())
                },
                invalid,
            ));
        }
        Err(message) => checks.push(doctor_check(
            "auth.backups",
            "认证",
            "备份完整性",
            DoctorCheckStatus::Error,
            "认证库索引无法读取。".to_string(),
            vec![doctor_safe_text(context, &message)],
        )),
    }

    match read_feishu_remote_store(context) {
        Ok(store) if store.profile_name.is_none() => checks.push(doctor_check(
            "remote.feishu",
            "远程渠道",
            "飞书渠道",
            DoctorCheckStatus::Ok,
            "飞书渠道尚未启用。".to_string(),
            Vec::new(),
        )),
        Ok(_) => match build_feishu_remote_report(context, 0) {
            Ok(report) => {
                let mut details = Vec::new();
                if let Some(profile_name) = report.profile_name.as_deref() {
                    details.push(format!("Profile: {profile_name}"));
                }
                if let Some(version) = report.version.as_deref() {
                    details.push(format!("Runtime: {version}"));
                }
                if let Some(error) = report.last_error.as_deref() {
                    details.push(doctor_safe_text(context, error));
                }
                let status = if report.last_error.is_some() {
                    DoctorCheckStatus::Error
                } else if !report.installed
                    || !report.auth_exists
                    || (report.running && !report.healthy)
                {
                    DoctorCheckStatus::Warning
                } else {
                    DoctorCheckStatus::Ok
                };
                checks.push(doctor_check(
                    "remote.feishu",
                    "远程渠道",
                    "飞书渠道",
                    status,
                    if !report.installed {
                        "已绑定 profile，但未找到 codex-remote runtime。".to_string()
                    } else if !report.auth_exists {
                        "飞书渠道绑定的 profile 尚未登录。".to_string()
                    } else if report.running && !report.healthy {
                        "飞书进程存在，但健康检查未通过。".to_string()
                    } else if report.running {
                        format!(
                            "飞书渠道运行正常，{} 个网关已连接。",
                            report.connected_gateway_count
                        )
                    } else {
                        "飞书渠道配置可用，当前未运行。".to_string()
                    },
                    details,
                ));
            }
            Err(message) => checks.push(doctor_check(
                "remote.feishu",
                "远程渠道",
                "飞书渠道",
                DoctorCheckStatus::Error,
                "无法读取飞书渠道状态。".to_string(),
                vec![doctor_safe_text(context, &message)],
            )),
        },
        Err(message) => checks.push(doctor_check(
            "remote.feishu",
            "远程渠道",
            "飞书渠道",
            DoctorCheckStatus::Error,
            "飞书渠道元数据无法读取。".to_string(),
            vec![doctor_safe_text(context, &message)],
        )),
    }

    let summary = DoctorSummary {
        ok_count: checks
            .iter()
            .filter(|check| check.status == DoctorCheckStatus::Ok)
            .count(),
        warning_count: checks
            .iter()
            .filter(|check| check.status == DoctorCheckStatus::Warning)
            .count(),
        error_count: checks
            .iter()
            .filter(|check| check.status == DoctorCheckStatus::Error)
            .count(),
    };

    Ok(DoctorReport {
        generated_at: now_iso(),
        app_version: env!("CARGO_PKG_VERSION").to_string(),
        platform: format!("{}-{}", std::env::consts::OS, std::env::consts::ARCH),
        ready: summary.error_count == 0,
        summary,
        checks,
    })
}

fn doctor_check(
    id: &str,
    group: &str,
    label: &str,
    status: DoctorCheckStatus,
    message: String,
    details: Vec<String>,
) -> DoctorCheck {
    DoctorCheck {
        id: id.to_string(),
        group: group.to_string(),
        label: label.to_string(),
        status,
        message,
        details,
    }
}

fn doctor_safe_text(context: &ProfileContext, value: &str) -> String {
    let lower = value.to_ascii_lowercase();
    if [
        "access_token",
        "refresh_token",
        "authorization",
        "bearer ",
        "appsecret",
        "app_secret",
        "cookie:",
    ]
    .iter()
    .any(|marker| lower.contains(marker))
    {
        return "[敏感详情已隐藏]".to_string();
    }
    let home = path_string(&context.home_dir);
    truncate_chars(&value.replace(&home, "~"), 360)
}

pub fn list_model_routes(context: &ProfileContext) -> Result<ModelRouteReport, String> {
    let profile_report = list_profiles(context)?;
    let profiles = profile_report
        .profiles
        .iter()
        .map(profile_model_route_state)
        .collect::<Vec<_>>();
    let routed_count = profiles.iter().filter(|profile| profile.routed).count();
    let needs_attention_count = profiles
        .iter()
        .filter(|profile| profile.needs_attention)
        .count();

    Ok(ModelRouteReport {
        generated_at: now_iso(),
        profile_count: profiles.len(),
        routed_count,
        needs_attention_count,
        proxy: read_model_route_proxy_status(),
        presets: model_route_presets(),
        profiles,
    })
}

pub fn read_model_route_proxy_status() -> ModelRouteProxyStatus {
    let managed = is_managed_model_route_proxy_running();
    let reachable = model_route_proxy_tcp_reachable();
    let probe = probe_model_route_proxy_service(managed, reachable);
    let base_url = format!("http://{MODEL_ROUTE_PROXY_HOST}:{MODEL_ROUTE_PROXY_PORT}/v1");
    let (status, status_label, message) = if managed && reachable {
        (
            "managed",
            "内置运行中",
            "rCodexManager 内置代理已启动；当前支持基础文本、tool_search 和常见工具调用的 Responses 到 Chat 转换。",
        )
    } else if managed {
        (
            "unreachable",
            "内置异常",
            "内置代理进程存在，但本机端口暂时不可达；可以尝试停止后重新启动。",
        )
    } else if probe.service_kind == "cc-switch" {
        (
            "cc-switch",
            "cc-switch 接管",
            "检测到 cc-switch 代理正在监听本机默认端口；可直接把 Chat-compatible provider 指向该代理。",
        )
    } else if reachable {
        (
            "external",
            "外部未知",
            "本机端口可连接，但未识别为 rCodexManager 或 cc-switch；请确认它是 Responses-compatible 代理。",
        )
    } else {
        (
            "offline",
            "未检测到",
            "未检测到本机代理；Chat-only provider 可启动内置代理快速试用，或打开 cc-switch 使用成熟代理。",
        )
    };

    ModelRouteProxyStatus {
        generated_at: now_iso(),
        listen_host: MODEL_ROUTE_PROXY_HOST.to_string(),
        listen_port: MODEL_ROUTE_PROXY_PORT,
        base_url,
        service_kind: probe.service_kind,
        service_label: probe.service_label,
        service_detail: probe.service_detail,
        reachable,
        managed,
        can_start: !reachable && !managed,
        can_stop: managed,
        status: status.to_string(),
        status_label: status_label.to_string(),
        message: message.to_string(),
        diagnostics: model_route_proxy_status_diagnostics(status, message),
        recent_logs: recent_model_route_proxy_logs(),
    }
}

fn model_route_proxy_status_diagnostics(
    status: &str,
    status_message: &str,
) -> Vec<ModelRouteProxyDiagnostic> {
    let mut diagnostics = vec![model_route_proxy_diagnostic(
        match status {
            "managed" | "cc-switch" => "info",
            "external" => "warning",
            "unreachable" => "error",
            _ => "warning",
        },
        match status {
            "managed" => "proxy_managed_running",
            "cc-switch" => "proxy_ccswitch_detected",
            "external" => "proxy_external_detected",
            "unreachable" => "proxy_managed_unreachable",
            _ => "proxy_offline",
        },
        match status {
            "managed" => "内置代理正常",
            "cc-switch" => "cc-switch 已运行",
            "external" => "外部代理未知",
            "unreachable" => "内置代理异常",
            _ => "代理未启动",
        },
        status_message,
        None,
    )];

    if let Some(last) = last_model_route_proxy_diagnostic() {
        if last.code != diagnostics[0].code {
            diagnostics.push(last);
        }
    }

    diagnostics
}

fn model_route_proxy_diagnostic(
    level: &str,
    code: &str,
    label: &str,
    message: &str,
    detail: Option<String>,
) -> ModelRouteProxyDiagnostic {
    ModelRouteProxyDiagnostic {
        generated_at: now_iso(),
        level: level.to_string(),
        code: code.to_string(),
        label: label.to_string(),
        message: message.to_string(),
        detail: detail.map(|value| truncate_diagnostic_detail(&value)),
    }
}

fn record_model_route_proxy_diagnostic(
    level: &str,
    code: &str,
    label: &str,
    message: &str,
    detail: Option<String>,
) {
    if let Ok(mut guard) = model_route_proxy_last_diagnostic().lock() {
        *guard = Some(model_route_proxy_diagnostic(
            level, code, label, message, detail,
        ));
    }
}

fn record_model_route_proxy_diagnostic_from_value(diagnostic: ModelRouteProxyDiagnostic) {
    if let Ok(mut guard) = model_route_proxy_last_diagnostic().lock() {
        *guard = Some(diagnostic);
    }
}

fn clear_model_route_proxy_diagnostic() {
    if let Ok(mut guard) = model_route_proxy_last_diagnostic().lock() {
        *guard = None;
    }
}

fn last_model_route_proxy_diagnostic() -> Option<ModelRouteProxyDiagnostic> {
    model_route_proxy_last_diagnostic().lock().ok()?.clone()
}

fn record_model_route_proxy_log(
    kind: &str,
    profile_name: Option<&str>,
    model: Option<&str>,
    endpoint: Option<&str>,
    ok: bool,
    status: &str,
    status_label: &str,
    message: &str,
    http_status: Option<u16>,
    latency_ms: u128,
    diagnostic_code: Option<&str>,
) {
    let entry = ModelRouteProxyLogEntry {
        generated_at: now_iso(),
        kind: kind.to_string(),
        profile_name: profile_name.map(ToOwned::to_owned),
        model: model.map(ToOwned::to_owned),
        endpoint: endpoint.map(ToOwned::to_owned),
        ok,
        status: status.to_string(),
        status_label: status_label.to_string(),
        message: message.to_string(),
        http_status,
        latency_ms,
        diagnostic_code: diagnostic_code.map(ToOwned::to_owned),
    };
    if let Ok(mut logs) = model_route_proxy_recent_logs().lock() {
        logs.push_front(entry);
        while logs.len() > MODEL_ROUTE_PROXY_LOG_LIMIT {
            logs.pop_back();
        }
    }
}

fn recent_model_route_proxy_logs() -> Vec<ModelRouteProxyLogEntry> {
    model_route_proxy_recent_logs()
        .lock()
        .map(|logs| logs.iter().cloned().collect())
        .unwrap_or_default()
}

#[cfg(test)]
fn clear_model_route_proxy_logs() {
    if let Ok(mut logs) = model_route_proxy_recent_logs().lock() {
        logs.clear();
    }
}

fn truncate_diagnostic_detail(value: &str) -> String {
    let trimmed = value.trim();
    let mut output = String::new();
    for ch in trimmed.chars().take(280) {
        output.push(ch);
    }
    if trimmed.chars().count() > output.chars().count() {
        output.push('…');
    }
    output
}

pub fn start_model_route_proxy() -> Result<ModelRouteProxyStatus, String> {
    let service = model_route_proxy_service();
    let mut guard = service
        .lock()
        .map_err(|_| "failed to lock model route proxy service".to_string())?;
    prune_model_route_proxy(&mut guard);

    if guard.is_some() {
        drop(guard);
        return Ok(read_model_route_proxy_status());
    }

    let addr = SocketAddr::from(([127, 0, 0, 1], MODEL_ROUTE_PROXY_PORT));
    let listener = TcpListener::bind(addr).map_err(|error| {
        record_model_route_proxy_diagnostic(
            "error",
            "proxy_port_unavailable",
            "端口不可用",
            "内置代理无法绑定本机端口；可能已有 cc-switch 或其他进程占用。",
            Some(error.to_string()),
        );
        format!(
            "failed to start built-in model route proxy on {MODEL_ROUTE_PROXY_HOST}:{MODEL_ROUTE_PROXY_PORT}: {error}"
        )
    })?;
    listener.set_nonblocking(true).map_err(|error| {
        record_model_route_proxy_diagnostic(
            "error",
            "proxy_socket_config_failed",
            "Socket 配置失败",
            "内置代理端口已打开，但无法切换为后台监听模式。",
            Some(error.to_string()),
        );
        format!("failed to configure built-in model route proxy socket: {error}")
    })?;

    let stop = Arc::new(AtomicBool::new(false));
    let worker_stop = Arc::clone(&stop);
    let handle = thread::Builder::new()
        .name("rcodexmanager-model-route-proxy".to_string())
        .spawn(move || run_model_route_proxy(listener, worker_stop))
        .map_err(|error| {
            record_model_route_proxy_diagnostic(
                "error",
                "proxy_thread_spawn_failed",
                "代理线程启动失败",
                "内置代理端口已准备好，但后台线程启动失败。",
                Some(error.to_string()),
            );
            format!("failed to spawn built-in model route proxy: {error}")
        })?;

    *guard = Some(ManagedModelRouteProxy {
        stop,
        handle: Some(handle),
    });
    clear_model_route_proxy_diagnostic();
    drop(guard);

    Ok(read_model_route_proxy_status())
}

pub fn stop_model_route_proxy() -> Result<ModelRouteProxyStatus, String> {
    let proxy = {
        let service = model_route_proxy_service();
        let mut guard = service
            .lock()
            .map_err(|_| "failed to lock model route proxy service".to_string())?;
        prune_model_route_proxy(&mut guard);
        guard.take()
    };

    if let Some(mut proxy) = proxy {
        proxy.stop.store(true, Ordering::SeqCst);
        if let Some(handle) = proxy.handle.take() {
            let _ = handle.join();
        }
    }
    clear_model_route_proxy_diagnostic();

    Ok(read_model_route_proxy_status())
}

fn model_route_proxy_tcp_reachable() -> bool {
    let addr = SocketAddr::from(([127, 0, 0, 1], MODEL_ROUTE_PROXY_PORT));
    TcpStream::connect_timeout(&addr, Duration::from_millis(MODEL_ROUTE_PROXY_TIMEOUT_MS)).is_ok()
}

fn probe_model_route_proxy_service(managed: bool, reachable: bool) -> ModelRouteProxyProbe {
    if managed {
        return ModelRouteProxyProbe {
            service_kind: "rcodexmanager".to_string(),
            service_label: "rCodexManager 内置代理".to_string(),
            service_detail: Some("由当前 rCodexManager 窗口启动，可在这里停止。".to_string()),
        };
    }
    if !reachable {
        return ModelRouteProxyProbe {
            service_kind: "none".to_string(),
            service_label: "未检测到代理".to_string(),
            service_detail: None,
        };
    }

    if let Some((_status, value)) = read_model_route_proxy_json_endpoint("/health") {
        if value.get("service").and_then(Value::as_str) == Some("rcodexmanager-model-route-proxy") {
            return ModelRouteProxyProbe {
                service_kind: "rcodexmanager".to_string(),
                service_label: "rCodexManager 内置代理".to_string(),
                service_detail: Some("检测到 rCodexManager 代理健康检查响应。".to_string()),
            };
        }
    }

    if let Some((_status, value)) = read_model_route_proxy_json_endpoint("/status") {
        if let Some(detail) = cc_switch_proxy_status_detail(&value) {
            return ModelRouteProxyProbe {
                service_kind: "cc-switch".to_string(),
                service_label: "cc-switch 代理".to_string(),
                service_detail: Some(detail),
            };
        }
    }

    ModelRouteProxyProbe {
        service_kind: "external".to_string(),
        service_label: "外部未知代理".to_string(),
        service_detail: Some(
            "本机端口可连接，但未识别到 rCodexManager 或 cc-switch 指纹。".to_string(),
        ),
    }
}

fn read_model_route_proxy_json_endpoint(path: &str) -> Option<(u16, Value)> {
    let response = read_model_route_proxy_http_endpoint(path)?;
    let body = response_body(&response)?;
    serde_json::from_str::<Value>(body).ok().map(|value| {
        let status = response_status_code(&response).unwrap_or_default();
        (status, value)
    })
}

fn read_model_route_proxy_http_endpoint(path: &str) -> Option<String> {
    let addr = SocketAddr::from(([127, 0, 0, 1], MODEL_ROUTE_PROXY_PORT));
    let mut stream =
        TcpStream::connect_timeout(&addr, Duration::from_millis(MODEL_ROUTE_PROXY_TIMEOUT_MS))
            .ok()?;
    let _ = stream.set_read_timeout(Some(Duration::from_millis(MODEL_ROUTE_PROXY_TIMEOUT_MS)));
    let _ = stream.set_write_timeout(Some(Duration::from_millis(MODEL_ROUTE_PROXY_TIMEOUT_MS)));
    let request = format!(
        "GET {path} HTTP/1.1\r\nHost: {MODEL_ROUTE_PROXY_HOST}:{MODEL_ROUTE_PROXY_PORT}\r\nAccept: application/json\r\nUser-Agent: rcodexmanager-probe\r\nConnection: close\r\n\r\n"
    );
    stream.write_all(request.as_bytes()).ok()?;
    let mut response = String::new();
    stream.read_to_string(&mut response).ok()?;
    Some(response)
}

fn response_status_code(response: &str) -> Option<u16> {
    response
        .lines()
        .next()?
        .split_whitespace()
        .nth(1)?
        .parse()
        .ok()
}

fn response_body(response: &str) -> Option<&str> {
    response
        .split_once("\r\n\r\n")
        .map(|(_, body)| body)
        .or_else(|| response.split_once("\n\n").map(|(_, body)| body))
}

fn cc_switch_proxy_status_detail(value: &Value) -> Option<String> {
    let running = value.get("running").and_then(Value::as_bool)?;
    let address = value.get("address").and_then(Value::as_str)?;
    let port = value.get("port").and_then(Value::as_u64)?;
    let has_cc_switch_shape = value.get("activeConnections").is_some()
        || value.get("totalRequests").is_some()
        || value.get("successRequests").is_some()
        || value.get("failedRequests").is_some()
        || value.get("activeTargets").is_some()
        || value.get("currentProvider").is_some();
    if !has_cc_switch_shape {
        return None;
    }

    let target_summary = value
        .get("activeTargets")
        .and_then(Value::as_array)
        .map(|targets| {
            targets
                .iter()
                .filter_map(|target| {
                    let app = target.get("appType").and_then(Value::as_str)?;
                    let provider = target.get("providerName").and_then(Value::as_str)?;
                    Some(format!("{app}:{provider}"))
                })
                .take(3)
                .collect::<Vec<_>>()
        })
        .filter(|items| !items.is_empty())
        .map(|items| items.join(", "))
        .or_else(|| {
            value
                .get("currentProvider")
                .and_then(Value::as_str)
                .filter(|provider| !provider.trim().is_empty())
                .map(|provider| format!("当前 provider: {provider}"))
        });

    Some(match target_summary {
        Some(summary) => format!(
            "cc-switch /status 响应正常；running={running}; listen={address}:{port}; {summary}"
        ),
        None => format!("cc-switch /status 响应正常；running={running}; listen={address}:{port}"),
    })
}

fn is_managed_model_route_proxy_running() -> bool {
    let service = model_route_proxy_service();
    let Ok(mut guard) = service.lock() else {
        return false;
    };
    prune_model_route_proxy(&mut guard);
    guard.is_some()
}

fn prune_model_route_proxy(proxy: &mut Option<ManagedModelRouteProxy>) {
    let finished = proxy
        .as_ref()
        .and_then(|service| service.handle.as_ref())
        .is_some_and(JoinHandle::is_finished);
    if !finished {
        return;
    }
    if let Some(mut service) = proxy.take() {
        if let Some(handle) = service.handle.take() {
            let _ = handle.join();
        }
    }
}

fn run_model_route_proxy(listener: TcpListener, stop: Arc<AtomicBool>) {
    while !stop.load(Ordering::SeqCst) {
        match listener.accept() {
            Ok((stream, _)) => handle_model_route_proxy_client(stream),
            Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {
                thread::sleep(Duration::from_millis(50));
            }
            Err(_) => {
                thread::sleep(Duration::from_millis(100));
            }
        }
    }
}

fn handle_model_route_proxy_client(mut stream: TcpStream) {
    let request = match read_simple_http_request(&mut stream) {
        Ok(request) => request,
        Err(message) => {
            let body = proxy_json_error(&message, "proxy_bad_request");
            write_proxy_response(&mut stream, 400, "Bad Request", &body);
            return;
        }
    };

    match (request.method.as_str(), request.path.as_str()) {
        ("GET", "/health") | ("GET", "/v1/health") => {
            let body = serde_json::json!({
                "ok": true,
                "service": "rcodexmanager-model-route-proxy",
                "mode": "basic-chat-conversion",
                "baseUrl": format!("http://{MODEL_ROUTE_PROXY_HOST}:{MODEL_ROUTE_PROXY_PORT}/v1"),
                "message": "Basic text, tool_search, function_call, custom tool, and namespace tool Responses-to-Chat conversion is enabled. Complex provider parity can still use cc-switch."
            })
            .to_string();
            write_proxy_response(&mut stream, 200, "OK", &body);
        }
        ("OPTIONS", _) => {
            write_proxy_response(&mut stream, 204, "No Content", "");
        }
        ("POST", "/v1/responses") | ("POST", "/responses") => {
            handle_model_route_responses_request(&mut stream, &request);
        }
        _ => {
            let body = serde_json::json!({
                "error": {
                    "message": "Unknown model route proxy endpoint.",
                    "type": "not_found",
                    "code": "proxy_endpoint_not_found"
                }
            })
            .to_string();
            write_proxy_response(&mut stream, 404, "Not Found", &body);
        }
    }
}

fn write_proxy_response(stream: &mut TcpStream, status: u16, reason: &str, body: &str) {
    let response = format!(
        "HTTP/1.1 {status} {reason}\r\nContent-Type: application/json; charset=utf-8\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Headers: authorization,content-type\r\nAccess-Control-Allow-Methods: GET,POST,OPTIONS\r\nConnection: close\r\nContent-Length: {}\r\n\r\n{}",
        body.as_bytes().len(),
        body
    );
    let _ = stream.write_all(response.as_bytes());
    let _ = stream.flush();
}

fn read_simple_http_request(stream: &mut TcpStream) -> Result<SimpleHttpRequest, String> {
    let _ = stream.set_read_timeout(Some(Duration::from_secs(3)));
    let mut bytes = Vec::new();
    let mut buffer = [0_u8; 8192];
    let header_end = loop {
        let read = stream
            .read(&mut buffer)
            .map_err(|error| format!("failed to read proxy request: {error}"))?;
        if read == 0 {
            return Err("empty proxy request".to_string());
        }
        bytes.extend_from_slice(&buffer[..read]);
        if bytes.len() > MODEL_ROUTE_PROXY_MAX_REQUEST_BYTES {
            return Err("proxy request is too large".to_string());
        }
        if let Some(position) = find_http_header_end(&bytes) {
            break position;
        }
    };

    let header_bytes = &bytes[..header_end];
    let header_text = String::from_utf8_lossy(header_bytes);
    let mut lines = header_text.lines();
    let first_line = lines
        .next()
        .ok_or_else(|| "proxy request is missing request line".to_string())?;
    let mut first_parts = first_line.split_whitespace();
    let method = first_parts
        .next()
        .ok_or_else(|| "proxy request is missing method".to_string())?
        .to_ascii_uppercase();
    let path = first_parts
        .next()
        .ok_or_else(|| "proxy request is missing path".to_string())?
        .to_string();

    let mut headers = BTreeMap::new();
    for line in lines {
        let Some((key, value)) = line.split_once(':') else {
            continue;
        };
        headers.insert(key.trim().to_ascii_lowercase(), value.trim().to_string());
    }

    let content_length = headers
        .get("content-length")
        .and_then(|value| value.parse::<usize>().ok())
        .unwrap_or(0);
    if content_length > MODEL_ROUTE_PROXY_MAX_REQUEST_BYTES {
        return Err("proxy request body is too large".to_string());
    }

    let body_start = header_end + 4;
    while bytes.len().saturating_sub(body_start) < content_length {
        let read = stream
            .read(&mut buffer)
            .map_err(|error| format!("failed to read proxy request body: {error}"))?;
        if read == 0 {
            break;
        }
        bytes.extend_from_slice(&buffer[..read]);
        if bytes.len() > MODEL_ROUTE_PROXY_MAX_REQUEST_BYTES {
            return Err("proxy request is too large".to_string());
        }
    }

    let body_end = body_start.saturating_add(content_length).min(bytes.len());
    let body = bytes[body_start..body_end].to_vec();

    Ok(SimpleHttpRequest {
        method,
        path,
        headers,
        body,
    })
}

fn find_http_header_end(bytes: &[u8]) -> Option<usize> {
    bytes.windows(4).position(|window| window == b"\r\n\r\n")
}

fn handle_model_route_responses_request(stream: &mut TcpStream, request: &SimpleHttpRequest) {
    let started_at = Instant::now();
    let response_body: Value = match serde_json::from_slice(&request.body) {
        Ok(value) => value,
        Err(error) => {
            record_model_route_proxy_diagnostic(
                "error",
                "proxy_invalid_json",
                "请求格式错误",
                "Codex 发给内置代理的 Responses 请求不是有效 JSON。",
                Some(error.to_string()),
            );
            record_model_route_proxy_log(
                "proxy",
                None,
                None,
                None,
                false,
                "invalid-json",
                "请求格式错误",
                "Codex 发给内置代理的 Responses 请求不是有效 JSON。",
                Some(400),
                started_at.elapsed().as_millis(),
                Some("proxy_invalid_json"),
            );
            write_proxy_response(
                stream,
                400,
                "Bad Request",
                &proxy_json_error(
                    &format!("failed to parse Responses request JSON: {error}"),
                    "proxy_invalid_json",
                ),
            );
            return;
        }
    };

    let request_is_streaming = response_body
        .get("stream")
        .and_then(Value::as_bool)
        .unwrap_or(false);

    let request_model = response_body
        .get("model")
        .and_then(Value::as_str)
        .unwrap_or_default();
    let target = match find_model_route_proxy_target(request_model) {
        Ok(target) => target,
        Err(message) => {
            record_model_route_proxy_diagnostic(
                "error",
                "proxy_route_not_found",
                "路由未匹配",
                "没有找到能处理当前模型名的 rCodexManager 路由配置。",
                Some(format!("model={request_model}; {message}")),
            );
            record_model_route_proxy_log(
                "proxy",
                None,
                normalized_input(Some(request_model)),
                None,
                false,
                "route-not-found",
                "路由未匹配",
                "没有找到能处理当前模型名的 rCodexManager 路由配置。",
                Some(404),
                started_at.elapsed().as_millis(),
                Some("proxy_route_not_found"),
            );
            write_proxy_response(
                stream,
                404,
                "Not Found",
                &proxy_json_error(&message, "proxy_route_not_found"),
            );
            return;
        }
    };
    let tool_context = build_model_route_tool_context_from_request(&response_body);
    let chat_body = match responses_to_chat_completions_with_context(
        &response_body,
        &target.model,
        &tool_context,
    ) {
        Ok(value) => value,
        Err(message) => {
            record_model_route_proxy_diagnostic(
                "error",
                "proxy_transform_failed",
                "请求转换失败",
                "Responses 请求无法转换为 Chat Completions 请求。",
                Some(message.clone()),
            );
            record_model_route_proxy_log(
                "proxy",
                Some(&target.profile_name),
                Some(&target.model),
                None,
                false,
                "transform-failed",
                "请求转换失败",
                "Responses 请求无法转换为 Chat Completions 请求。",
                Some(400),
                started_at.elapsed().as_millis(),
                Some("proxy_transform_failed"),
            );
            write_proxy_response(
                stream,
                400,
                "Bad Request",
                &proxy_json_error(&message, "proxy_transform_failed"),
            );
            return;
        }
    };
    let upstream_url = chat_completions_endpoint(&target.upstream_base_url);
    let client = match reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(600))
        .build()
    {
        Ok(client) => client,
        Err(error) => {
            record_model_route_proxy_diagnostic(
                "error",
                "proxy_client_failed",
                "HTTP 客户端初始化失败",
                "内置代理无法创建上游请求客户端。",
                Some(error.to_string()),
            );
            record_model_route_proxy_log(
                "proxy",
                Some(&target.profile_name),
                Some(&target.model),
                Some(&upstream_url),
                false,
                "client-failed",
                "客户端失败",
                "内置代理无法创建上游请求客户端。",
                Some(502),
                started_at.elapsed().as_millis(),
                Some("proxy_client_failed"),
            );
            write_proxy_response(
                stream,
                502,
                "Bad Gateway",
                &proxy_json_error(
                    &format!("failed to initialize proxy HTTP client: {error}"),
                    "proxy_client_failed",
                ),
            );
            return;
        }
    };
    let mut builder = client
        .post(&upstream_url)
        .header("content-type", "application/json");
    if let Some(authorization) = request.headers.get("authorization") {
        builder = builder.header("authorization", authorization);
    } else if let Some(api_key) = target.api_key.as_deref() {
        builder = builder.bearer_auth(api_key);
    }

    let upstream_response = match builder.json(&chat_body).send() {
        Ok(response) => response,
        Err(error) => {
            record_model_route_proxy_diagnostic(
                "error",
                "proxy_upstream_failed",
                "上游连接失败",
                "内置代理无法连接到配置的 Chat 上游服务。",
                Some(format!(
                    "profile={}; upstream={}; {error}",
                    target.profile_name, upstream_url
                )),
            );
            record_model_route_proxy_log(
                "proxy",
                Some(&target.profile_name),
                Some(&target.model),
                Some(&upstream_url),
                false,
                "upstream-connect-failed",
                "上游连接失败",
                "内置代理无法连接到配置的 Chat 上游服务。",
                None,
                started_at.elapsed().as_millis(),
                Some("proxy_upstream_failed"),
            );
            write_proxy_response(
                stream,
                502,
                "Bad Gateway",
                &proxy_json_error(
                    &format!(
                        "failed to call upstream Chat provider for {}: {error}",
                        target.profile_name
                    ),
                    "proxy_upstream_failed",
                ),
            );
            return;
        }
    };
    let status = upstream_response.status();
    let status_code = status.as_u16();
    let reason = if status.is_success() {
        "OK"
    } else {
        status.canonical_reason().unwrap_or("Upstream Error")
    };

    if status.is_success() && request_is_streaming {
        clear_model_route_proxy_diagnostic();
        record_model_route_proxy_log(
            "proxy",
            Some(&target.profile_name),
            Some(&target.model),
            Some(&upstream_url),
            true,
            "streaming",
            "流式转发",
            "已将流式请求转发到上游。",
            Some(status_code),
            started_at.elapsed().as_millis(),
            None,
        );
        stream_chat_completion_to_responses_sse(
            stream,
            upstream_response,
            &target.model,
            tool_context,
        );
        return;
    }

    let upstream_text = match upstream_response.text() {
        Ok(text) => text,
        Err(error) => {
            record_model_route_proxy_diagnostic(
                "error",
                "proxy_upstream_read_failed",
                "上游响应读取失败",
                "内置代理已收到上游响应，但无法读取响应内容。",
                Some(error.to_string()),
            );
            record_model_route_proxy_log(
                "proxy",
                Some(&target.profile_name),
                Some(&target.model),
                Some(&upstream_url),
                false,
                "upstream-read-failed",
                "响应读取失败",
                "内置代理已收到上游响应，但无法读取响应内容。",
                Some(502),
                started_at.elapsed().as_millis(),
                Some("proxy_upstream_read_failed"),
            );
            write_proxy_response(
                stream,
                502,
                "Bad Gateway",
                &proxy_json_error(
                    &format!("failed to read upstream Chat response: {error}"),
                    "proxy_upstream_read_failed",
                ),
            );
            return;
        }
    };

    let upstream_json = match serde_json::from_str::<Value>(&upstream_text) {
        Ok(value) => value,
        Err(error) => {
            record_model_route_proxy_diagnostic(
                "error",
                "proxy_upstream_invalid_json",
                "上游格式不兼容",
                "上游返回的不是有效 Chat Completions JSON。",
                Some(format!(
                    "status={status_code}; parse={error}; body={}",
                    truncate_diagnostic_detail(&upstream_text)
                )),
            );
            record_model_route_proxy_log(
                "proxy",
                Some(&target.profile_name),
                Some(&target.model),
                Some(&upstream_url),
                false,
                "invalid-json",
                "上游格式不兼容",
                "上游返回的不是有效 Chat Completions JSON。",
                Some(502),
                started_at.elapsed().as_millis(),
                Some("proxy_upstream_invalid_json"),
            );
            write_proxy_response(
                stream,
                502,
                "Bad Gateway",
                &proxy_json_error(
                    &format!("upstream Chat response was not valid JSON: {error}"),
                    "proxy_upstream_invalid_json",
                ),
            );
            return;
        }
    };
    if !status.is_success() {
        record_model_route_proxy_diagnostic(
            "error",
            upstream_status_diagnostic_code(status_code),
            upstream_status_diagnostic_label(status_code),
            upstream_status_diagnostic_message(status_code),
            Some(format!(
                "profile={}; upstream={}; status={status_code} {reason}; body={}",
                target.profile_name,
                upstream_url,
                truncate_diagnostic_detail(&upstream_text)
            )),
        );
        record_model_route_proxy_log(
            "proxy",
            Some(&target.profile_name),
            Some(&target.model),
            Some(&upstream_url),
            false,
            "upstream-error",
            upstream_status_diagnostic_label(status_code),
            upstream_status_diagnostic_message(status_code),
            Some(status_code),
            started_at.elapsed().as_millis(),
            Some(upstream_status_diagnostic_code(status_code)),
        );
        write_proxy_response(
            stream,
            status_code,
            reason,
            &chat_error_to_response_error_minimal(&upstream_json).to_string(),
        );
        return;
    }

    match chat_completion_to_response_with_context(&upstream_json, &tool_context) {
        Ok(value) => {
            clear_model_route_proxy_diagnostic();
            record_model_route_proxy_log(
                "proxy",
                Some(&target.profile_name),
                Some(&target.model),
                Some(&upstream_url),
                true,
                "ok",
                "请求成功",
                "Responses 请求已完成转换并返回。",
                Some(status_code),
                started_at.elapsed().as_millis(),
                None,
            );
            write_proxy_response(stream, status_code, reason, &value.to_string())
        }
        Err(message) => {
            record_model_route_proxy_diagnostic(
                "error",
                "proxy_response_transform_failed",
                "响应转换失败",
                "上游返回了 JSON，但不是内置代理可转换的 Chat Completions 结构。",
                Some(message.clone()),
            );
            record_model_route_proxy_log(
                "proxy",
                Some(&target.profile_name),
                Some(&target.model),
                Some(&upstream_url),
                false,
                "response-transform-failed",
                "响应转换失败",
                "上游返回了 JSON，但不是内置代理可转换的 Chat Completions 结构。",
                Some(502),
                started_at.elapsed().as_millis(),
                Some("proxy_response_transform_failed"),
            );
            write_proxy_response(
                stream,
                502,
                "Bad Gateway",
                &proxy_json_error(&message, "proxy_response_transform_failed"),
            )
        }
    }
}

fn stream_chat_completion_to_responses_sse(
    stream: &mut TcpStream,
    mut upstream_response: reqwest::blocking::Response,
    fallback_model: &str,
    tool_context: ModelRouteToolContext,
) {
    let status = upstream_response.status();
    let reason = if status.is_success() {
        "OK"
    } else {
        status.canonical_reason().unwrap_or("Upstream Error")
    };
    write_proxy_stream_headers(stream, status.as_u16(), reason);

    let mut state = ModelRouteStreamState::new(fallback_model, tool_context);
    let mut parse_buffer = String::new();
    let mut utf8_remainder = Vec::new();
    let mut read_buffer = [0_u8; 8192];

    loop {
        match upstream_response.read(&mut read_buffer) {
            Ok(0) => break,
            Ok(read) => {
                append_utf8_safe(&mut parse_buffer, &mut utf8_remainder, &read_buffer[..read]);
                while let Some(block) = take_sse_block(&mut parse_buffer) {
                    for event in chat_sse_block_to_response_events(&block, &mut state) {
                        if stream.write_all(event.as_bytes()).is_err() {
                            return;
                        }
                    }
                    let _ = stream.flush();
                }
            }
            Err(error) => {
                record_model_route_proxy_diagnostic(
                    "error",
                    "proxy_upstream_stream_read_failed",
                    "流式响应中断",
                    "上游流式响应读取失败，可能是上游连接中断或 SSE 格式不兼容。",
                    Some(error.to_string()),
                );
                let event = response_sse_event(
                    "response.failed",
                    serde_json::json!({
                        "type": "response.failed",
                        "response": response_stream_terminal_response(&state, "failed"),
                        "error": {
                            "message": format!("failed to read upstream Chat stream: {error}"),
                            "type": "upstream_stream_error",
                            "code": "proxy_upstream_stream_read_failed"
                        }
                    }),
                );
                let _ = stream.write_all(event.as_bytes());
                let _ = stream.flush();
                return;
            }
        }
    }

    if !parse_buffer.trim().is_empty() && !state.completed {
        if let Ok(chat_body) = serde_json::from_str::<Value>(parse_buffer.trim()) {
            if let Ok(response_body) =
                chat_completion_to_response_with_context(&chat_body, &state.tool_context)
            {
                let event = response_sse_event(
                    "response.completed",
                    serde_json::json!({
                        "type": "response.completed",
                        "response": response_body,
                    }),
                );
                let _ = stream.write_all(event.as_bytes());
                let _ = stream.flush();
                return;
            }
        }
    }

    if !state.completed {
        for event in finish_response_stream_events(&mut state) {
            if stream.write_all(event.as_bytes()).is_err() {
                return;
            }
        }
    }
    let _ = stream.flush();
}

fn write_proxy_stream_headers(stream: &mut TcpStream, status: u16, reason: &str) {
    let response = format!(
        "HTTP/1.1 {status} {reason}\r\nContent-Type: text/event-stream; charset=utf-8\r\nCache-Control: no-cache\r\nX-Accel-Buffering: no\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Headers: authorization,content-type\r\nAccess-Control-Allow-Methods: GET,POST,OPTIONS\r\nConnection: close\r\n\r\n"
    );
    let _ = stream.write_all(response.as_bytes());
    let _ = stream.flush();
}

fn chat_sse_block_to_response_events(
    block: &str,
    state: &mut ModelRouteStreamState,
) -> Vec<String> {
    let mut events = Vec::new();
    for line in block.lines() {
        let Some(data) = strip_sse_field(line, "data") else {
            continue;
        };
        let data = data.trim();
        if data.is_empty() {
            continue;
        }
        if data == "[DONE]" {
            events.extend(finish_response_stream_events(state));
            continue;
        }
        let Ok(chunk) = serde_json::from_str::<Value>(data) else {
            continue;
        };
        update_stream_state_from_chat_chunk(state, &chunk);
        if let Some(usage) = chunk.get("usage").filter(|value| !value.is_null()) {
            state.usage = Some(usage.clone());
        }
        let Some(choices) = chunk.get("choices").and_then(Value::as_array) else {
            continue;
        };
        for choice in choices {
            if let Some(delta) = choice.get("delta") {
                if let Some(text) = chat_delta_text(delta) {
                    if !text.is_empty() {
                        events.extend(start_response_stream_events(state));
                        state.text.push_str(&text);
                        events.push(response_sse_event(
                            "response.output_text.delta",
                            serde_json::json!({
                                "type": "response.output_text.delta",
                                "response_id": state.response_id,
                                "item_id": state.item_id,
                                "output_index": state.message_output_index.unwrap_or(0),
                                "content_index": 0,
                                "delta": text,
                            }),
                        ));
                    }
                }
                if let Some(tool_calls) = delta.get("tool_calls").and_then(Value::as_array) {
                    for tool_call in tool_calls {
                        events.extend(push_stream_tool_call_delta(state, tool_call));
                    }
                }
            }
            if choice
                .get("finish_reason")
                .and_then(Value::as_str)
                .is_some()
            {
                events.extend(finish_response_stream_events(state));
            }
        }
    }
    events
}

fn update_stream_state_from_chat_chunk(state: &mut ModelRouteStreamState, chunk: &Value) {
    if let Some(id) = chunk.get("id").and_then(Value::as_str) {
        if id.starts_with("resp_") {
            state.response_id = id.to_string();
        } else {
            state.response_id = format!("resp_{id}");
        }
        state.item_id = format!("{}_msg", state.response_id);
    }
    if let Some(model) = chunk.get("model").and_then(Value::as_str) {
        state.model = model.to_string();
    }
    if let Some(created) = chunk.get("created").and_then(Value::as_i64) {
        state.created_at = created;
    }
}

fn chat_delta_text(delta: &Value) -> Option<String> {
    delta
        .get("content")
        .and_then(value_to_text)
        .or_else(|| delta.get("reasoning_content").and_then(value_to_text))
}

fn push_stream_tool_call_delta(
    state: &mut ModelRouteStreamState,
    tool_call: &Value,
) -> Vec<String> {
    let chat_index = tool_call.get("index").and_then(Value::as_u64).unwrap_or(0) as usize;
    let id_delta = tool_call.get("id").and_then(Value::as_str);
    let function = tool_call.get("function").unwrap_or(&Value::Null);
    let name_delta = function.get("name").and_then(Value::as_str);
    let name_spec = name_delta
        .filter(|value| !value.trim().is_empty())
        .map(|name| {
            (
                name.to_string(),
                state.tool_context.lookup_chat_name(name).cloned(),
            )
        });
    let args_delta = function
        .get("arguments")
        .and_then(Value::as_str)
        .unwrap_or_default();

    let mut should_add = false;
    let mut output_index = None;
    let mut item_id = String::new();
    let mut pending_arguments = String::new();
    let is_custom_tool;

    {
        let tool_state = state.tool_calls.entry(chat_index).or_default();
        if let Some(id) = id_delta.filter(|value| !value.trim().is_empty()) {
            tool_state.call_id = id.to_string();
        }
        if let Some((chat_name, spec)) = name_spec.as_ref() {
            apply_model_route_tool_spec(tool_state, chat_name, spec.as_ref());
        }
        if !args_delta.is_empty() {
            tool_state.arguments.push_str(args_delta);
        }
        if !tool_state.added && !tool_state.name.is_empty() {
            if tool_state.call_id.is_empty() {
                tool_state.call_id = format!("call_{chat_index}");
            }
            if tool_state.item_id.is_empty() {
                tool_state.item_id = tool_call_item_id(&tool_state.call_id, tool_state.kind);
            }
            should_add = true;
            pending_arguments = tool_state.arguments.clone();
        } else if tool_state.added {
            output_index = tool_state.output_index;
            item_id = tool_state.item_id.clone();
        }
        is_custom_tool = tool_state.kind == ModelRouteToolKind::Custom;
    }

    let mut events = start_response_shell_events(state);

    if should_add {
        let assigned = state.next_output_index();
        if let Some(tool_state) = state.tool_calls.get_mut(&chat_index) {
            tool_state.added = true;
            tool_state.output_index = Some(assigned);
            events.push(response_sse_event(
                "response.output_item.added",
                serde_json::json!({
                    "type": "response.output_item.added",
                    "response_id": state.response_id,
                    "output_index": assigned,
                    "item": response_stream_tool_call_item(tool_state, "in_progress"),
                }),
            ));
            if !pending_arguments.is_empty() && tool_state.kind != ModelRouteToolKind::Custom {
                events.push(response_sse_event(
                    "response.function_call_arguments.delta",
                    serde_json::json!({
                        "type": "response.function_call_arguments.delta",
                        "item_id": tool_state.item_id,
                        "output_index": assigned,
                        "delta": pending_arguments,
                    }),
                ));
            }
        }
    } else if !args_delta.is_empty() && !is_custom_tool {
        if let Some(output_index) = output_index {
            events.push(response_sse_event(
                "response.function_call_arguments.delta",
                serde_json::json!({
                    "type": "response.function_call_arguments.delta",
                    "item_id": item_id,
                    "output_index": output_index,
                    "delta": args_delta,
                }),
            ));
        }
    }

    events
}

fn start_response_stream_events(state: &mut ModelRouteStreamState) -> Vec<String> {
    let mut events = start_response_shell_events(state);
    if state.message_output_index.is_none() {
        state.message_output_index = Some(state.next_output_index());
    }
    if !state.started {
        events.extend(start_response_shell_events(state));
    }
    if !state.content_started {
        state.content_started = true;
        let output_index = state.message_output_index.unwrap_or(0);
        events.push(response_sse_event(
            "response.output_item.added",
            serde_json::json!({
                "type": "response.output_item.added",
                "response_id": state.response_id,
                "output_index": output_index,
                "item": {
                    "id": state.item_id,
                    "type": "message",
                    "status": "in_progress",
                    "role": "assistant",
                    "content": []
                }
            }),
        ));
        events.push(response_sse_event(
            "response.content_part.added",
            serde_json::json!({
                "type": "response.content_part.added",
                "response_id": state.response_id,
                "item_id": state.item_id,
                "output_index": output_index,
                "content_index": 0,
                "part": {
                    "type": "output_text",
                    "text": "",
                    "annotations": []
                }
            }),
        ));
    }
    events
}

fn start_response_shell_events(state: &mut ModelRouteStreamState) -> Vec<String> {
    if state.started {
        return Vec::new();
    }
    state.started = true;
    vec![
        response_sse_event(
            "response.created",
            serde_json::json!({
                "type": "response.created",
                "response": response_stream_base_response(state, "in_progress"),
            }),
        ),
        response_sse_event(
            "response.in_progress",
            serde_json::json!({
                "type": "response.in_progress",
                "response": response_stream_base_response(state, "in_progress"),
            }),
        ),
    ]
}

fn finish_response_stream_events(state: &mut ModelRouteStreamState) -> Vec<String> {
    if state.completed {
        return Vec::new();
    }
    let mut events = start_response_shell_events(state);
    state.completed = true;
    if state.content_started || !state.text.is_empty() {
        events.extend(finish_response_message_events(state));
    }
    events.extend(finish_response_tool_call_events(state));
    if events.is_empty() || (!state.content_started && state.tool_calls.is_empty()) {
        events.extend(start_response_stream_events(state));
        events.extend(finish_response_message_events(state));
    }
    events.push(response_sse_event(
        "response.completed",
        serde_json::json!({
            "type": "response.completed",
            "response": response_stream_terminal_response(state, "completed"),
        }),
    ));
    events
}

fn finish_response_message_events(state: &mut ModelRouteStreamState) -> Vec<String> {
    let output_index = state.message_output_index.unwrap_or_else(|| {
        let next = state.next_output_index();
        state.message_output_index = Some(next);
        next
    });
    vec![
        response_sse_event(
            "response.output_text.done",
            serde_json::json!({
                "type": "response.output_text.done",
                "response_id": state.response_id,
                "item_id": state.item_id,
                "output_index": output_index,
                "content_index": 0,
                "text": state.text,
            }),
        ),
        response_sse_event(
            "response.content_part.done",
            serde_json::json!({
                "type": "response.content_part.done",
                "response_id": state.response_id,
                "item_id": state.item_id,
                "output_index": output_index,
                "content_index": 0,
                "part": {
                    "type": "output_text",
                    "text": state.text,
                    "annotations": []
                }
            }),
        ),
        response_sse_event(
            "response.output_item.done",
            serde_json::json!({
                "type": "response.output_item.done",
                "response_id": state.response_id,
                "output_index": output_index,
                "item": response_stream_message_item(state, "completed"),
            }),
        ),
    ]
}

fn finish_response_tool_call_events(state: &mut ModelRouteStreamState) -> Vec<String> {
    let mut events = Vec::new();
    let response_id = state.response_id.clone();
    let tool_keys = state.tool_calls.keys().copied().collect::<Vec<_>>();
    for tool_key in tool_keys {
        let needs_assignment = state
            .tool_calls
            .get(&tool_key)
            .is_some_and(|tool_state| !tool_state.added && !tool_state.name.is_empty());
        let assigned_output_index = if needs_assignment {
            Some(state.next_output_index())
        } else {
            None
        };

        let Some(tool_state) = state.tool_calls.get_mut(&tool_key) else {
            continue;
        };
        if tool_state.done {
            continue;
        }
        if !tool_state.added {
            if tool_state.name.is_empty() {
                continue;
            }
            if tool_state.call_id.is_empty() {
                tool_state.call_id = format!("call_{tool_key}");
            }
            if tool_state.item_id.is_empty() {
                tool_state.item_id = tool_call_item_id(&tool_state.call_id, tool_state.kind);
            }
            tool_state.output_index = assigned_output_index;
            tool_state.added = true;
            if let Some(output_index) = tool_state.output_index {
                events.push(response_sse_event(
                    "response.output_item.added",
                    serde_json::json!({
                        "type": "response.output_item.added",
                        "response_id": response_id,
                        "output_index": output_index,
                        "item": response_stream_tool_call_item(tool_state, "in_progress"),
                    }),
                ));
            }
        }
        let Some(output_index) = tool_state.output_index else {
            continue;
        };
        tool_state.done = true;
        if tool_state.kind == ModelRouteToolKind::Custom {
            let input = custom_tool_input_from_chat_arguments(&tool_state.arguments);
            if !input.is_empty() {
                events.push(response_sse_event(
                    "response.custom_tool_call_input.delta",
                    serde_json::json!({
                        "type": "response.custom_tool_call_input.delta",
                        "item_id": tool_state.item_id,
                        "output_index": output_index,
                        "delta": input,
                    }),
                ));
            }
            events.push(response_sse_event(
                "response.custom_tool_call_input.done",
                serde_json::json!({
                    "type": "response.custom_tool_call_input.done",
                    "item_id": tool_state.item_id,
                    "output_index": output_index,
                    "input": input,
                }),
            ));
        } else {
            events.push(response_sse_event(
                "response.function_call_arguments.done",
                serde_json::json!({
                    "type": "response.function_call_arguments.done",
                    "item_id": tool_state.item_id,
                    "output_index": output_index,
                    "arguments": tool_state.arguments,
                }),
            ));
        }
        events.push(response_sse_event(
            "response.output_item.done",
            serde_json::json!({
                "type": "response.output_item.done",
                "response_id": response_id,
                "output_index": output_index,
                "item": response_stream_tool_call_item(tool_state, "completed"),
            }),
        ));
    }
    events
}

fn response_stream_base_response(state: &ModelRouteStreamState, status: &str) -> Value {
    serde_json::json!({
        "id": state.response_id,
        "object": "response",
        "created_at": state.created_at,
        "status": status,
        "error": null,
        "incomplete_details": null,
        "model": state.model,
        "output": [],
        "usage": null,
    })
}

fn response_stream_terminal_response(state: &ModelRouteStreamState, status: &str) -> Value {
    serde_json::json!({
        "id": state.response_id,
        "object": "response",
        "created_at": state.created_at,
        "status": status,
        "error": null,
        "incomplete_details": null,
        "model": state.model,
        "output": response_stream_output_items(state, status),
        "usage": chat_usage_to_response_usage_minimal(state.usage.as_ref()),
    })
}

fn response_stream_output_items(state: &ModelRouteStreamState, status: &str) -> Value {
    let mut indexed_items = Vec::new();
    if state.content_started || !state.text.is_empty() || state.tool_calls.is_empty() {
        indexed_items.push((
            state.message_output_index.unwrap_or(0),
            response_stream_message_item(state, status),
        ));
    }
    for tool_state in state.tool_calls.values() {
        if let Some(output_index) = tool_state.output_index {
            indexed_items.push((
                output_index,
                response_stream_tool_call_item(tool_state, status),
            ));
        }
    }
    indexed_items.sort_by_key(|(output_index, _)| *output_index);
    Value::Array(
        indexed_items
            .into_iter()
            .map(|(_, item)| item)
            .collect::<Vec<_>>(),
    )
}

fn response_stream_message_item(state: &ModelRouteStreamState, status: &str) -> Value {
    serde_json::json!({
        "id": state.item_id,
        "type": "message",
        "status": status,
        "role": "assistant",
        "content": [{
            "type": "output_text",
            "text": state.text,
            "annotations": []
        }]
    })
}

fn response_stream_tool_call_item(tool_state: &ModelRouteStreamToolCall, status: &str) -> Value {
    response_tool_call_item_from_parts(
        &tool_state.item_id,
        status,
        &tool_state.call_id,
        tool_state.kind,
        &tool_state.name,
        tool_state.namespace.as_deref(),
        &tool_state.arguments,
    )
}

fn apply_model_route_tool_spec(
    tool_state: &mut ModelRouteStreamToolCall,
    chat_name: &str,
    spec: Option<&ModelRouteToolSpec>,
) {
    tool_state.chat_name = chat_name.to_string();
    if let Some(spec) = spec {
        tool_state.kind = spec.kind;
        tool_state.name = spec.name.clone();
        tool_state.namespace = spec.namespace.clone();
    } else {
        tool_state.kind = ModelRouteToolKind::Function;
        tool_state.name = chat_name.to_string();
        tool_state.namespace = None;
    }
}

fn tool_call_item_id(call_id: &str, kind: ModelRouteToolKind) -> String {
    let prefix = if kind == ModelRouteToolKind::Custom {
        "ctc_"
    } else {
        "fc_"
    };
    if call_id.starts_with(prefix) {
        call_id.to_string()
    } else {
        format!("{prefix}{call_id}")
    }
}

fn response_sse_event(event: &str, data: Value) -> String {
    format!("event: {event}\ndata: {}\n\n", data)
}

#[inline]
fn strip_sse_field<'a>(line: &'a str, field: &str) -> Option<&'a str> {
    line.strip_prefix(&format!("{field}: "))
        .or_else(|| line.strip_prefix(&format!("{field}:")))
}

#[inline]
fn take_sse_block(buffer: &mut String) -> Option<String> {
    let mut best: Option<(usize, usize)> = None;
    for (delimiter, len) in [("\r\n\r\n", 4usize), ("\n\n", 2usize)] {
        if let Some(pos) = buffer.find(delimiter) {
            if best.is_none_or(|(best_pos, _)| pos < best_pos) {
                best = Some((pos, len));
            }
        }
    }
    let (pos, len) = best?;
    let block = buffer[..pos].to_string();
    buffer.drain(..pos + len);
    Some(block)
}

fn append_utf8_safe(buffer: &mut String, remainder: &mut Vec<u8>, new_bytes: &[u8]) {
    let (owned, bytes): (Option<Vec<u8>>, &[u8]) = if remainder.is_empty() {
        (None, new_bytes)
    } else if remainder.len() > 3 {
        buffer.push_str(&String::from_utf8_lossy(remainder));
        remainder.clear();
        (None, new_bytes)
    } else {
        let mut combined = std::mem::take(remainder);
        combined.extend_from_slice(new_bytes);
        (Some(combined), &[])
    };
    let input = owned.as_deref().unwrap_or(bytes);
    let mut pos = 0;
    loop {
        match std::str::from_utf8(&input[pos..]) {
            Ok(text) => {
                buffer.push_str(text);
                return;
            }
            Err(error) => {
                let valid_up_to = pos + error.valid_up_to();
                let valid_slice = &input[pos..valid_up_to];
                match std::str::from_utf8(valid_slice) {
                    Ok(valid) => buffer.push_str(valid),
                    Err(_) => buffer.push_str(&String::from_utf8_lossy(valid_slice)),
                }
                if let Some(invalid_len) = error.error_len() {
                    buffer.push('\u{FFFD}');
                    pos = valid_up_to + invalid_len;
                } else {
                    *remainder = input[valid_up_to..].to_vec();
                    return;
                }
            }
        }
    }
}

pub fn preview_model_route(
    context: &ProfileContext,
    input: PreviewModelRouteInput,
) -> Result<ModelRoutePreview, String> {
    validate_profile_selector_name(&input.profile_name)?;
    let profile = find_profile(context, &input.profile_name)?;
    let plan = build_model_route_plan(&profile, &input, true)?;
    Ok(plan.preview)
}

pub fn apply_model_route(
    context: &ProfileContext,
    input: ApplyModelRouteInput,
) -> Result<ProfileActionReport, String> {
    validate_profile_selector_name(&input.profile_name)?;
    let profile = find_profile(context, &input.profile_name)?;
    ensure_mutable_profile(&profile, "apply model route to")?;
    if profile.is_running {
        return Err(format!(
            "{} is running; stop it before applying model route",
            profile.name
        ));
    }
    if has_sensitive_model_route_input(&input) && !input.confirm_sensitive {
        return Err("must confirm sensitive model route update before writing API key".to_string());
    }

    let preview_input = PreviewModelRouteInput {
        profile_name: input.profile_name.clone(),
        preset: input.preset,
        model: input.model.clone(),
        reasoning_effort: input.reasoning_effort.clone(),
        proxy_base_url: input.proxy_base_url.clone(),
        upstream_base_url: input.upstream_base_url.clone(),
        api_key: input.api_key.clone(),
        api_key_env: input.api_key_env.clone(),
    };
    let plan = build_model_route_plan(&profile, &preview_input, false)?;
    let config_path = PathBuf::from(&profile.config_path);
    if let Some(parent) = config_path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let mut backups = Vec::new();
    if config_path.exists() {
        backups.push(backup_file_copy(&config_path, "model-route")?);
    }
    write_text_atomic(&config_path, &plan.config_text)?;

    let refreshed = find_profile(context, &profile.name)?;
    Ok(ProfileActionReport {
        generated_at: now_iso(),
        action: "model-route-apply".to_string(),
        zshrc_path: path_string(&context.zshrc_path),
        profile: Some(refreshed),
        backups,
        message: format!(
            "applied {} model route to {}",
            plan.preview.preset_label, profile.name
        ),
    })
}

pub fn restore_model_route(
    context: &ProfileContext,
    input: RestoreModelRouteInput,
) -> Result<ProfileActionReport, String> {
    validate_profile_selector_name(&input.profile_name)?;
    let profile = find_profile(context, &input.profile_name)?;
    ensure_mutable_profile(&profile, "restore model route for")?;
    if profile.is_running {
        return Err(format!(
            "{} is running; stop it before restoring model route",
            profile.name
        ));
    }
    if !input.confirm_sensitive {
        return Err("must confirm model route restore before writing config.toml".to_string());
    }

    let config_path = PathBuf::from(&profile.config_path);
    if let Some(parent) = config_path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let mut backups = Vec::new();
    if config_path.exists() {
        backups.push(backup_file_copy(&config_path, "model-route-restore")?);
    }
    let config_text = restore_model_route_config_text(&config_path, &profile)?;
    write_text_atomic(&config_path, &config_text)?;

    let refreshed = find_profile(context, &profile.name)?;
    Ok(ProfileActionReport {
        generated_at: now_iso(),
        action: "model-route-restore".to_string(),
        zshrc_path: path_string(&context.zshrc_path),
        profile: Some(refreshed),
        backups,
        message: format!("restored {} model route config", profile.name),
    })
}

pub fn check_model_route_proxy(
    context: &ProfileContext,
    input: CheckModelRouteProxyInput,
) -> Result<ModelRouteProxyCheckResult, String> {
    validate_profile_selector_name(&input.profile_name)?;
    let profile = find_profile(context, &input.profile_name)?;
    let started_at = Instant::now();
    let config_path = PathBuf::from(&profile.config_path);
    let route_config = read_model_route_config_view(&config_path);
    let model = profile
        .model
        .clone()
        .unwrap_or_else(|| DEFAULT_MODEL.to_string());
    let Some(base_url) = route_config
        .base_url
        .as_deref()
        .and_then(|value| normalized_input(Some(value)).map(ToOwned::to_owned))
    else {
        let diagnostic = model_route_proxy_diagnostic(
            "warning",
            "model_route_profile_not_routed",
            "Profile 未路由",
            "当前 profile 没有配置模型路由 base URL，无法执行代理自检。",
            Some(profile.config_path.clone()),
        );
        record_model_route_proxy_diagnostic_from_value(diagnostic.clone());
        return Ok(model_route_proxy_check_result(
            &profile.name,
            &model,
            None,
            None,
            false,
            "not-routed",
            "未配置路由",
            "当前 profile 没有配置模型路由。",
            None,
            started_at.elapsed().as_millis(),
            Some(diagnostic),
        ));
    };

    let endpoint = model_route_responses_endpoint(&base_url);
    let api_key =
        read_model_route_api_key_from_config(&config_path, route_config.model_provider.as_deref());
    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(45))
        .build()
        .map_err(|error| format!("failed to initialize model route self-check client: {error}"))?;
    let mut builder = client
        .post(&endpoint)
        .header("content-type", "application/json");
    if let Some(api_key) = api_key.as_deref().filter(|value| !value.trim().is_empty()) {
        builder = builder.bearer_auth(api_key);
    }

    let body = serde_json::json!({
        "model": model.clone(),
        "input": "Reply with OK only.",
        "max_output_tokens": 1,
        "stream": false,
    });
    let response = match builder.json(&body).send() {
        Ok(response) => response,
        Err(error) => {
            let diagnostic = model_route_proxy_diagnostic(
                "error",
                "model_route_check_connect_failed",
                "自检连接失败",
                "无法连接到当前 profile 的模型路由 base URL。",
                Some(format!("endpoint={endpoint}; {error}")),
            );
            record_model_route_proxy_diagnostic_from_value(diagnostic.clone());
            return Ok(model_route_proxy_check_result(
                &profile.name,
                body.get("model").and_then(Value::as_str).unwrap_or(&model),
                Some(base_url),
                Some(endpoint),
                false,
                "connect-failed",
                "连接失败",
                "模型路由自检无法连接到目标 endpoint。",
                None,
                started_at.elapsed().as_millis(),
                Some(diagnostic),
            ));
        }
    };

    let status = response.status();
    let http_status = status.as_u16();
    let text = response.text().unwrap_or_default();
    if !status.is_success() {
        let diagnostic = model_route_proxy_diagnostic(
            "error",
            upstream_status_diagnostic_code(http_status),
            upstream_status_diagnostic_label(http_status),
            upstream_status_diagnostic_message(http_status),
            Some(format!(
                "profile={}; endpoint={endpoint}; status={http_status}; body={}",
                profile.name,
                truncate_diagnostic_detail(&text)
            )),
        );
        record_model_route_proxy_diagnostic_from_value(diagnostic.clone());
        return Ok(model_route_proxy_check_result(
            &profile.name,
            body.get("model").and_then(Value::as_str).unwrap_or(&model),
            Some(base_url),
            Some(endpoint),
            false,
            "upstream-error",
            upstream_status_diagnostic_label(http_status),
            upstream_status_diagnostic_message(http_status),
            Some(http_status),
            started_at.elapsed().as_millis(),
            Some(diagnostic),
        ));
    }

    let parsed = match serde_json::from_str::<Value>(&text) {
        Ok(value) => value,
        Err(error) => {
            let diagnostic = model_route_proxy_diagnostic(
                "error",
                "model_route_check_invalid_json",
                "响应格式不兼容",
                "自检 endpoint 返回成功状态，但响应不是有效 JSON。",
                Some(format!(
                    "endpoint={endpoint}; parse={error}; body={}",
                    truncate_diagnostic_detail(&text)
                )),
            );
            record_model_route_proxy_diagnostic_from_value(diagnostic.clone());
            return Ok(model_route_proxy_check_result(
                &profile.name,
                body.get("model").and_then(Value::as_str).unwrap_or(&model),
                Some(base_url),
                Some(endpoint),
                false,
                "invalid-json",
                "格式不兼容",
                "自检 endpoint 返回的不是有效 Responses JSON。",
                Some(http_status),
                started_at.elapsed().as_millis(),
                Some(diagnostic),
            ));
        }
    };

    if !looks_like_responses_success(&parsed) {
        let diagnostic = model_route_proxy_diagnostic(
            "error",
            "model_route_check_invalid_responses_shape",
            "响应结构不兼容",
            "自检 endpoint 返回 JSON，但不是 Codex 期望的 Responses 结构。",
            Some(truncate_diagnostic_detail(&parsed.to_string())),
        );
        record_model_route_proxy_diagnostic_from_value(diagnostic.clone());
        return Ok(model_route_proxy_check_result(
            &profile.name,
            body.get("model").and_then(Value::as_str).unwrap_or(&model),
            Some(base_url),
            Some(endpoint),
            false,
            "invalid-shape",
            "结构不兼容",
            "自检 endpoint 返回 JSON，但不是 Responses 结构。",
            Some(http_status),
            started_at.elapsed().as_millis(),
            Some(diagnostic),
        ));
    }

    clear_model_route_proxy_diagnostic();
    Ok(model_route_proxy_check_result(
        &profile.name,
        body.get("model").and_then(Value::as_str).unwrap_or(&model),
        Some(base_url),
        Some(endpoint),
        true,
        "ok",
        "自检通过",
        "模型路由自检已打通。",
        Some(http_status),
        started_at.elapsed().as_millis(),
        None,
    ))
}

pub fn check_model_route_draft(
    context: &ProfileContext,
    input: PreviewModelRouteInput,
) -> Result<ModelRouteProxyCheckResult, String> {
    validate_profile_selector_name(&input.profile_name)?;
    let profile = find_profile(context, &input.profile_name)?;
    let plan = build_model_route_plan(&profile, &input, false)?;
    let spec = model_route_spec(input.preset);
    let base_url = if spec.chat_only {
        normalized_input(input.upstream_base_url.as_deref())
            .ok_or_else(|| "Chat-only preset requires the upstream Chat base URL".to_string())?
            .trim_end_matches('/')
            .to_string()
    } else {
        plan.preview.base_url.clone()
    };
    let endpoint = if spec.chat_only {
        chat_completions_endpoint(&base_url)
    } else {
        model_route_responses_endpoint(&base_url)
    };
    let (_, api_key_config) = resolve_model_route_api_key(
        input.api_key.as_deref(),
        input.api_key_env.as_deref(),
        false,
    )?;
    let api_key = api_key_config
        .as_ref()
        .and_then(|config| config.actual_value());
    let started_at = Instant::now();
    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(45))
        .build()
        .map_err(|error| format!("failed to initialize model route draft client: {error}"))?;
    let mut request = client
        .post(&endpoint)
        .header("content-type", "application/json");
    if let Some(api_key) = api_key.as_deref().filter(|value| !value.trim().is_empty()) {
        request = request.bearer_auth(api_key);
    }
    let body = if spec.chat_only {
        serde_json::json!({
            "model": plan.preview.model.clone(),
            "messages": [{"role": "user", "content": "Reply with OK only."}],
            "max_tokens": 1,
            "stream": false,
        })
    } else {
        serde_json::json!({
            "model": plan.preview.model.clone(),
            "input": "Reply with OK only.",
            "max_output_tokens": 1,
            "stream": false,
        })
    };
    let response = match request.json(&body).send() {
        Ok(response) => response,
        Err(error) => {
            return Ok(model_route_proxy_check_result(
                &profile.name,
                &plan.preview.model,
                Some(base_url),
                Some(endpoint),
                false,
                "connect-failed",
                "连接失败",
                &format!("草稿配置无法连接到目标 endpoint：{error}"),
                None,
                started_at.elapsed().as_millis(),
                None,
            ));
        }
    };
    let status = response.status();
    let http_status = status.as_u16();
    let text = response.text().unwrap_or_default();
    if !status.is_success() {
        return Ok(model_route_proxy_check_result(
            &profile.name,
            &plan.preview.model,
            Some(base_url),
            Some(endpoint),
            false,
            "upstream-error",
            upstream_status_diagnostic_label(http_status),
            upstream_status_diagnostic_message(http_status),
            Some(http_status),
            started_at.elapsed().as_millis(),
            None,
        ));
    }
    let parsed = match serde_json::from_str::<Value>(&text) {
        Ok(value) => value,
        Err(_) => {
            return Ok(model_route_proxy_check_result(
                &profile.name,
                &plan.preview.model,
                Some(base_url),
                Some(endpoint),
                false,
                "invalid-json",
                "格式不兼容",
                "目标 endpoint 返回成功状态，但响应不是有效 JSON。",
                Some(http_status),
                started_at.elapsed().as_millis(),
                None,
            ));
        }
    };
    let compatible = if spec.chat_only {
        parsed
            .get("choices")
            .and_then(Value::as_array)
            .is_some_and(|choices| !choices.is_empty())
    } else {
        looks_like_responses_success(&parsed)
    };
    if !compatible {
        return Ok(model_route_proxy_check_result(
            &profile.name,
            &plan.preview.model,
            Some(base_url),
            Some(endpoint),
            false,
            "invalid-shape",
            "结构不兼容",
            if spec.chat_only {
                "目标 endpoint 返回 JSON，但不是 Chat Completions 结构。"
            } else {
                "目标 endpoint 返回 JSON，但不是 Responses 结构。"
            },
            Some(http_status),
            started_at.elapsed().as_millis(),
            None,
        ));
    }

    Ok(model_route_proxy_check_result(
        &profile.name,
        &plan.preview.model,
        Some(base_url),
        Some(endpoint),
        true,
        "ok",
        "草稿测试通过",
        "当前表单参数已通过连接测试，尚未写入 profile 配置。",
        Some(http_status),
        started_at.elapsed().as_millis(),
        None,
    ))
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
            read_recent_session_index_summaries(&codex_home, scan_limit)
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

pub fn read_profile_session_detail(
    context: &ProfileContext,
    input: ReadProfileSessionDetailInput,
) -> Result<CodexSessionSummary, String> {
    let profile_name = input.profile_name.trim();
    let session_id = input.session_id.trim();
    if profile_name.is_empty() || session_id.is_empty() {
        return Err("profile name and session id are required".to_string());
    }

    let report = list_profiles(context)?;
    let profile = report
        .profiles
        .into_iter()
        .find(|profile| profile.name == profile_name)
        .ok_or_else(|| format!("profile not found: {profile_name}"))?;
    let codex_home = PathBuf::from(profile.codex_home);
    let session_path =
        find_session_file_by_id(&codex_home, session_id, input.updated_at.as_deref())
            .ok_or_else(|| format!("session file not found: {session_id}"))?;
    let mut summary = session_summary_from_parts(None, Some(session_path.as_path()))
        .ok_or_else(|| format!("failed to read session: {session_id}"))?;
    summary.id = session_id.to_string();
    summary.updated_at = input.updated_at.or(summary.updated_at);
    Ok(summary)
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
    let processes = running_wechat_bridge_processes().unwrap_or_default();
    let discovered_instances = discover_wechat_instances(context, &processes);
    let bridges = report
        .profiles
        .iter()
        .map(|profile| {
            wechat_bridge_entry(
                context,
                profile,
                &store,
                &processes,
                &discovered_instances,
                &report.profiles,
            )
        })
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

    let running = running_wechat_bridge_processes()?;
    let running_pids = matching_wechat_bridge_pids(&running, &instance);
    if !running_pids.is_empty() {
        upsert_wechat_bridge_record(context, &profile.name, &instance, |record| {
            record.updated_at = now_iso();
            record.last_error = None;
        })?;
        return list_wechat_bridges(context);
    }

    let node_runtime = resolve_wechat_node_runtime(context)?;
    write_wechat_bridge_wrapper(&paths.wrapper_path, &profile, &node_runtime)?;

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
    let mut command = Command::new(&node_runtime.npx_path);
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
        .env("PATH", &node_runtime.path_env)
        .stdin(Stdio::null())
        .stdout(Stdio::from(log))
        .stderr(Stdio::from(stderr));
    if let Ok(proxy) = detect_system_proxy_env() {
        apply_child_proxy_env(&mut command, &proxy);
    }
    let spawn_result = command.spawn();

    match spawn_result {
        Ok(mut child) => {
            thread::sleep(Duration::from_millis(WECHAT_START_SETTLE_MS));
            if let Some(status) = child.try_wait().map_err(|error| error.to_string())? {
                let detail = tail_text_file_lines(&paths.app_log_path, 12)
                    .last()
                    .cloned()
                    .unwrap_or_else(|| format!("process exited with {status}"));
                let message = format!(
                    "WeChat bridge for {} exited before it was ready: {detail}",
                    profile.name
                );
                upsert_wechat_bridge_record(context, &profile.name, &instance, |record| {
                    record.updated_at = now_iso();
                    record.last_error = Some(message.clone());
                })?;
                return Err(message);
            }
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

pub fn restart_wechat_bridge(
    context: &ProfileContext,
    input: RestartWechatBridgeInput,
) -> Result<WechatBridgeReport, String> {
    validate_profile_selector_name(&input.profile_name)?;
    stop_wechat_bridge(
        context,
        StopWechatBridgeInput {
            profile_name: input.profile_name.clone(),
        },
    )?;
    start_wechat_bridge(
        context,
        StartWechatBridgeInput {
            profile_name: input.profile_name,
        },
    )
}

pub fn unbind_wechat_bridge(
    context: &ProfileContext,
    input: UnbindWechatBridgeInput,
) -> Result<WechatBridgeReport, String> {
    if !input.confirm_sensitive {
        return Err("must confirm WeChat unbind before archiving the binding token".to_string());
    }
    validate_profile_selector_name(&input.profile_name)?;
    let profile = find_profile(context, &input.profile_name)?;
    let instance = wechat_bridge_instance_name(&profile.name);
    stop_wechat_bridge(
        context,
        StopWechatBridgeInput {
            profile_name: profile.name.clone(),
        },
    )?;

    let paths = wechat_bridge_paths(context, &instance);
    if paths.token_path.exists() {
        let backup_dir = paths
            .runtime_dir
            .join("binding-backups")
            .join(timestamp_compact());
        fs::create_dir_all(&backup_dir).map_err(|error| error.to_string())?;
        let backup_path = backup_dir.join("token.json");
        fs::rename(&paths.token_path, &backup_path).map_err(|error| {
            format!(
                "failed to archive WeChat binding token {}: {error}",
                path_string(&paths.token_path)
            )
        })?;
    }
    upsert_wechat_bridge_record(context, &profile.name, &instance, |record| {
        record.updated_at = now_iso();
        record.last_error = None;
    })?;

    list_wechat_bridges(context)
}

pub fn read_wechat_bridge_log(
    context: &ProfileContext,
    input: ReadWechatBridgeLogInput,
) -> Result<WechatBridgeLogReport, String> {
    validate_profile_selector_name(&input.profile_name)?;
    let report = list_profiles(context)?;
    let profile = report
        .profiles
        .iter()
        .find(|profile| profile.name == input.profile_name)
        .cloned()
        .ok_or_else(|| format!("profile not found: {}", input.profile_name))?;
    let store = read_wechat_bridge_store(context)?;
    let processes = running_wechat_bridge_processes().unwrap_or_default();
    let discovered_instances = discover_wechat_instances(context, &processes);
    let (instance, _) =
        resolve_wechat_bridge_instance(&profile, &store, &discovered_instances, &report.profiles);
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

pub fn list_feishu_remote(context: &ProfileContext) -> Result<FeishuRemoteReport, String> {
    build_feishu_remote_report(context, FEISHU_REMOTE_LOG_TAIL_LINES)
}

pub fn configure_feishu_remote(
    context: &ProfileContext,
    input: ConfigureFeishuRemoteInput,
) -> Result<FeishuRemoteReport, String> {
    validate_profile_selector_name(&input.profile_name)?;
    find_profile(context, &input.profile_name)?;
    let requested_binary = input
        .binary_path
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty());
    let binary_path = if let Some(path) = requested_binary {
        Some(validate_feishu_remote_binary(Path::new(path))?)
    } else {
        resolve_feishu_remote_binary(context, None)
    };
    let mut store = read_feishu_remote_store(context)?;
    store.profile_name = Some(input.profile_name);
    store.binary_path = binary_path.as_deref().map(path_string);
    store.updated_at = Some(now_iso());
    store.last_error = None;
    write_feishu_remote_store(context, &store)?;
    list_feishu_remote(context)
}

pub fn start_feishu_remote(
    context: &ProfileContext,
    input: StartFeishuRemoteInput,
) -> Result<FeishuRemoteReport, String> {
    validate_profile_selector_name(&input.profile_name)?;
    let profile = find_profile(context, &input.profile_name)?;
    let auth_path = PathBuf::from(&profile.codex_home).join("auth.json");
    if !auth_path.exists() {
        return Err(format!(
            "{} has no auth.json; apply or import auth before starting Feishu remote access",
            profile.name
        ));
    }

    let requested_binary = input
        .binary_path
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty());
    let binary_path = if let Some(path) = requested_binary {
        validate_feishu_remote_binary(Path::new(path))?
    } else {
        resolve_feishu_remote_binary(context, None).ok_or_else(|| {
            "codex-remote is not installed; install it first or select the codex-remote executable"
                .to_string()
        })?
    };
    let paths = feishu_remote_paths(context);
    fs::create_dir_all(&paths.base_dir).map_err(|error| error.to_string())?;
    fs::create_dir_all(&paths.install_bin_dir).map_err(|error| error.to_string())?;

    let mut store = read_feishu_remote_store(context)?;
    store.profile_name = Some(profile.name.clone());
    store.binary_path = Some(path_string(&binary_path));
    store.updated_at = Some(now_iso());
    write_feishu_remote_store(context, &store)?;

    let mut command = Command::new(&binary_path);
    command.args([
        "install",
        "-bootstrap-only",
        "-instance",
        FEISHU_REMOTE_INSTANCE,
        "-base-dir",
        paths.base_dir.to_string_lossy().as_ref(),
        "-service-manager",
        "detached",
        "-start-daemon",
    ]);
    if !paths.state_path.exists() {
        command
            .arg("-binary")
            .arg(&binary_path)
            .arg("-install-bin-dir")
            .arg(&paths.install_bin_dir);
    }
    command.env("CODEX_HOME", &profile.codex_home);
    sanitize_external_child_env(&mut command);
    if let Ok(proxy) = detect_system_proxy_env() {
        apply_child_proxy_env(&mut command, &proxy);
    }

    let output = command.output().map_err(|error| {
        format!(
            "failed to start codex-remote from {}: {error}",
            path_string(&binary_path)
        )
    })?;
    if !output.status.success() {
        let details = sanitize_external_command_output(&String::from_utf8_lossy(&output.stderr));
        let message = if details.is_empty() {
            format!("codex-remote exited with {}", output.status)
        } else {
            format!("codex-remote failed: {details}")
        };
        store.updated_at = Some(now_iso());
        store.last_error = Some(message.clone());
        write_feishu_remote_store(context, &store)?;
        return Err(message);
    }

    store.updated_at = Some(now_iso());
    store.last_started_at = store.updated_at.clone();
    store.last_error = None;
    write_feishu_remote_store(context, &store)?;
    for _ in 0..6 {
        let report = list_feishu_remote(context)?;
        if report.healthy {
            return Ok(report);
        }
        thread::sleep(Duration::from_millis(300));
    }
    list_feishu_remote(context)
}

pub fn stop_feishu_remote(context: &ProfileContext) -> Result<FeishuRemoteReport, String> {
    let paths = feishu_remote_paths(context);
    if let Some(pid) = read_feishu_remote_pid(&paths.pid_path) {
        if !is_managed_feishu_remote_process(pid, &paths) {
            return Err(format!(
                "refusing to stop PID {pid}: it is not the rCodexManager codex-remote instance"
            ));
        }
        let status = Command::new("kill")
            .arg("-TERM")
            .arg(pid.to_string())
            .status()
            .map_err(|error| format!("failed to stop codex-remote PID {pid}: {error}"))?;
        if !status.success() {
            return Err(format!("failed to stop codex-remote PID {pid}: {status}"));
        }
        for _ in 0..10 {
            if !process_is_alive(pid) {
                break;
            }
            thread::sleep(Duration::from_millis(150));
        }
    }
    let mut store = read_feishu_remote_store(context)?;
    store.updated_at = Some(now_iso());
    store.last_stopped_at = store.updated_at.clone();
    store.last_error = None;
    write_feishu_remote_store(context, &store)?;
    list_feishu_remote(context)
}

pub fn restart_feishu_remote(context: &ProfileContext) -> Result<FeishuRemoteReport, String> {
    let store = read_feishu_remote_store(context)?;
    let profile_name = store
        .profile_name
        .clone()
        .ok_or_else(|| "bind a profile before restarting Feishu remote access".to_string())?;
    stop_feishu_remote(context)?;
    start_feishu_remote(
        context,
        StartFeishuRemoteInput {
            profile_name,
            binary_path: store.binary_path,
        },
    )
}

pub fn read_feishu_remote_log(
    context: &ProfileContext,
    input: ReadFeishuRemoteLogInput,
) -> Result<FeishuRemoteReport, String> {
    build_feishu_remote_report(
        context,
        input
            .lines
            .unwrap_or(FEISHU_REMOTE_LOG_TAIL_LINES)
            .clamp(20, 300),
    )
}

pub fn open_feishu_remote_page(
    context: &ProfileContext,
    page: FeishuRemotePage,
) -> Result<String, String> {
    let report = list_feishu_remote(context)?;
    let url = match page {
        FeishuRemotePage::Setup => report.setup_url,
        FeishuRemotePage::Admin => report.admin_url,
        FeishuRemotePage::Project => FEISHU_REMOTE_PROJECT_URL.to_string(),
    };
    if !matches!(page, FeishuRemotePage::Project) && !report.running {
        return Err("start the Feishu remote service before opening its local page".to_string());
    }
    let status = Command::new("open")
        .arg(&url)
        .status()
        .map_err(|error| format!("failed to open {url}: {error}"))?;
    if !status.success() {
        return Err(format!("failed to open {url}: {status}"));
    }
    Ok(url)
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
    let node_runtime = resolve_wechat_node_runtime(context)?;
    write_wechat_bridge_wrapper(&paths.wrapper_path, &profile, &node_runtime)?;
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
    let unit_contents =
        render_wechat_bridge_user_service(context, &profile, &paths, &instance, &node_runtime);
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
    create_auth_backup_record(context, &input)?;
    list_auth_vault(context)
}

pub fn create_auth_backups(
    context: &ProfileContext,
    input: CreateAuthBackupsInput,
) -> Result<AuthBatchBackupResult, String> {
    let mut profile_names = input
        .profile_names
        .into_iter()
        .map(|name| name.trim().to_string())
        .filter(|name| !name.is_empty())
        .collect::<Vec<_>>();
    profile_names.sort();
    profile_names.dedup();
    if profile_names.is_empty() {
        return Err("select at least one profile to back up".to_string());
    }

    let multiple = profile_names.len() > 1;
    let mut results = Vec::with_capacity(profile_names.len());
    for profile_name in profile_names {
        let label = input.label.as_deref().and_then(|value| {
            let value = value.trim();
            if value.is_empty() {
                None
            } else if multiple {
                Some(format!("{value} - {profile_name}"))
            } else {
                Some(value.to_string())
            }
        });
        let item = CreateAuthBackupInput {
            name: profile_name.clone(),
            label,
        };
        match create_auth_backup_record(context, &item) {
            Ok(backup_id) => results.push(AuthBatchBackupItemResult {
                profile_name,
                ok: true,
                backup_id: Some(backup_id),
                message: "认证备份已创建".to_string(),
            }),
            Err(message) => results.push(AuthBatchBackupItemResult {
                profile_name,
                ok: false,
                backup_id: None,
                message,
            }),
        }
    }

    let success_count = results.iter().filter(|result| result.ok).count();
    let failure_count = results.len().saturating_sub(success_count);
    Ok(AuthBatchBackupResult {
        generated_at: now_iso(),
        success_count,
        failure_count,
        results,
        vault: list_auth_vault(context)?,
    })
}

fn create_auth_backup_record(
    context: &ProfileContext,
    input: &CreateAuthBackupInput,
) -> Result<String, String> {
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
            id: backup_id.clone(),
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
    Ok(backup_id)
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

pub fn preview_auth_backup_package(
    input: PreviewAuthBackupPackageInput,
) -> Result<AuthBackupImportPreview, String> {
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
    let material = read_codex_auth_material_from_value(&package.auth_json).ok_or_else(|| {
        "auth backup package does not contain readable Codex auth material".to_string()
    })?;
    let has_refresh_token = auth_json_has_refresh_token(&package.auth_json);
    let mut warnings = Vec::new();
    if !has_refresh_token {
        warnings.push("备份不含 refresh_token，登录状态可能较快过期。".to_string());
    }
    if package.backup.source_profile_name.is_none() {
        warnings.push("备份没有记录来源 profile。".to_string());
    }

    Ok(AuthBackupImportPreview {
        valid: true,
        label: package.backup.label,
        note: package.backup.note,
        source_profile_name: package.backup.source_profile_name,
        source_profile_label: package.backup.source_profile_label,
        account: material.account.or(package.backup.account),
        has_refresh_token,
        exported_at: package.exported_at,
        warnings,
    })
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
        message: format!("created {} and added its shell launcher", draft.name),
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

pub fn archive_profile(
    context: &ProfileContext,
    name: &str,
) -> Result<ProfileActionReport, String> {
    validate_profile_selector_name(name)?;
    let profile = find_profile(context, name)?;
    ensure_mutable_profile(&profile, "archive")?;
    if profile.is_running {
        return Err(format!(
            "profile {name} is running; stop it before archiving"
        ));
    }

    set_profile_archived_at(context, name, Some(now_iso()))?;
    let archived = find_archived_profile(context, name)?;
    Ok(ProfileActionReport {
        generated_at: now_iso(),
        action: "archive".to_string(),
        zshrc_path: path_string(&context.zshrc_path),
        profile: Some(archived),
        backups: Vec::new(),
        message: format!("archived {name}; launcher and profile data were kept"),
    })
}

pub fn restore_archived_profile(
    context: &ProfileContext,
    name: &str,
) -> Result<ProfileActionReport, String> {
    validate_profile_selector_name(name)?;
    let archived = find_archived_profile(context, name)?;
    set_profile_archived_at(context, name, None)?;
    let profile = find_profile(context, name)?;
    Ok(ProfileActionReport {
        generated_at: now_iso(),
        action: "restore".to_string(),
        zshrc_path: path_string(&context.zshrc_path),
        profile: Some(profile),
        backups: Vec::new(),
        message: format!("restored {} to the active profile list", archived.name),
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

pub fn update_profile_launcher(
    context: &ProfileContext,
    input: UpdateProfileLauncherInput,
) -> Result<ProfileActionReport, String> {
    validate_profile_selector_name(&input.profile_name)?;
    validate_profile_name(&input.new_profile_name)?;
    let profile = find_profile(context, &input.profile_name)?;
    ensure_mutable_profile(&profile, "rename")?;
    if profile.is_running {
        return Err(format!(
            "{} is running; stop it before renaming the launch command",
            profile.name
        ));
    }
    if input.profile_name == input.new_profile_name {
        return Ok(ProfileActionReport {
            generated_at: now_iso(),
            action: "launcher-update".to_string(),
            zshrc_path: path_string(&context.zshrc_path),
            profile: Some(profile),
            backups: Vec::new(),
            message: format!("launch command remains {}", input.profile_name),
        });
    }

    let contents = read_zshrc(context)?;
    if find_shell_function(&contents, &input.new_profile_name).is_some() {
        return Err(format!(
            "profile {} already exists in {}",
            input.new_profile_name,
            path_string(&context.zshrc_path)
        ));
    }
    let next_contents =
        rename_shell_function(&contents, &input.profile_name, &input.new_profile_name)
            .ok_or_else(|| format!("profile {} launcher was not found", input.profile_name))?;
    write_zshrc(context, &contents, &next_contents)?;
    rename_metadata(context, &input.profile_name, &input.new_profile_name)?;

    let refreshed = find_profile(context, &input.new_profile_name)?;
    Ok(ProfileActionReport {
        generated_at: now_iso(),
        action: "launcher-update".to_string(),
        zshrc_path: path_string(&context.zshrc_path),
        profile: Some(refreshed),
        backups: Vec::new(),
        message: format!(
            "renamed launch command {} to {}",
            input.profile_name, input.new_profile_name
        ),
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

pub fn update_profile_model(
    context: &ProfileContext,
    input: UpdateProfileModelInput,
) -> Result<ProfileActionReport, String> {
    validate_profile_selector_name(&input.profile_name)?;
    let profile = find_profile(context, &input.profile_name)?;
    ensure_mutable_profile(&profile, "update model for")?;
    if profile.is_running {
        return Err(format!(
            "{} is running; stop it before updating the model",
            profile.name
        ));
    }

    let model = validate_model_config_value(&input.model, "model")?;
    let reasoning_effort = validate_model_config_value(
        input
            .reasoning_effort
            .as_deref()
            .or(profile.reasoning_effort.as_deref())
            .unwrap_or(DEFAULT_REASONING_EFFORT),
        "reasoning effort",
    )?;
    let config_path = PathBuf::from(&profile.config_path);
    if let Some(parent) = config_path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let mut backups = Vec::new();
    if config_path.exists() {
        backups.push(backup_file_copy(&config_path, "model-update")?);
    }
    let mut table = read_toml_table_or_empty(&config_path)?;
    table.insert("model".to_string(), toml::Value::String(model.clone()));
    table.insert(
        "model_reasoning_effort".to_string(),
        toml::Value::String(reasoning_effort.clone()),
    );
    let config_text =
        toml::to_string_pretty(&toml::Value::Table(table)).map_err(|error| error.to_string())?;
    write_text_atomic(&config_path, &config_text)?;

    let refreshed = find_profile(context, &profile.name)?;
    Ok(ProfileActionReport {
        generated_at: now_iso(),
        action: "model-update".to_string(),
        zshrc_path: path_string(&context.zshrc_path),
        profile: Some(refreshed),
        backups,
        message: format!(
            "updated {} model to {} / {}",
            profile.name, model, reasoning_effort
        ),
    })
}

fn profile_model_route_launch_env(profile: &ProfileInfo) -> BTreeMap<String, String> {
    let config_path = Path::new(&profile.config_path);
    let Some(env_key) = read_model_route_config_view(config_path).api_key_env else {
        return BTreeMap::new();
    };
    let Ok(value) = std::env::var(&env_key) else {
        return BTreeMap::new();
    };
    let Some(value) = normalized_input(Some(&value)) else {
        return BTreeMap::new();
    };
    BTreeMap::from([(env_key, value.to_string())])
}

pub fn launch_profile(context: &ProfileContext, name: &str) -> Result<ProfileActionReport, String> {
    validate_profile_selector_name(name)?;
    let profile = find_profile(context, name)?;

    fs::create_dir_all(&profile.codex_home).map_err(|error| error.to_string())?;
    fs::create_dir_all(&profile.user_data_dir).map_err(|error| error.to_string())?;

    if profile.launcher_kind == ProfileLauncherKind::Server {
        let tmux = resolve_server_command_binary(context, "tmux").ok_or_else(|| {
            "tmux is required to keep a server Codex profile running; install tmux and retry"
                .to_string()
        })?;
        let codex = resolve_server_command_binary(context, "codex")
            .ok_or_else(|| "codex was not found in the server PATH".to_string())?;
        let session_name = server_profile_tmux_session_name(name);
        if server_tmux_session_exists(&tmux, &session_name) {
            return Ok(ProfileActionReport {
                generated_at: now_iso(),
                action: "launch".to_string(),
                zshrc_path: path_string(&context.zshrc_path),
                profile: Some(find_profile(context, name)?),
                backups: Vec::new(),
                message: format!("{name} is already running in tmux session {session_name}"),
            });
        }

        let launch_command = server_profile_launch_command(
            &profile.codex_home,
            &codex,
            &profile_model_route_launch_env(&profile),
        );
        let status = Command::new(&tmux)
            .args(["new-session", "-d", "-s", &session_name])
            .arg(&launch_command)
            .status()
            .map_err(|error| format!("failed to launch tmux session for {name}: {error}"))?;
        if !status.success() {
            return Err(format!(
                "failed to launch {name}; tmux new-session exited with {status}"
            ));
        }
        thread::sleep(Duration::from_millis(250));
        if !server_tmux_session_exists(&tmux, &session_name) {
            return Err(format!(
                "{name} exited immediately; run it directly on the server to inspect the Codex startup error"
            ));
        }
        return Ok(ProfileActionReport {
            generated_at: now_iso(),
            action: "launch".to_string(),
            zshrc_path: path_string(&context.zshrc_path),
            profile: Some(find_profile(context, name)?),
            backups: Vec::new(),
            message: format!("launched {name} in tmux session {session_name}"),
        });
    }

    let mut launch_env = BTreeMap::new();
    if let Some(api_key) = read_profile_api_key(Path::new(&profile.codex_home)) {
        launch_env.insert("OPENAI_API_KEY".to_string(), api_key);
    }
    launch_env.extend(profile_model_route_launch_env(&profile));

    let mut command = Command::new("open");
    command
        .arg("-n")
        .arg("-a")
        .arg("Codex")
        .arg("--env")
        .arg(format!("CODEX_HOME={}", profile.codex_home));
    for (key, value) in launch_env {
        command.arg("--env").arg(format!("{key}={value}"));
    }
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
            "default codex profile cannot be terminated safely because it is protected".to_string(),
        );
    }
    let pids = profile.running_pids.clone();

    if profile.launcher_kind == ProfileLauncherKind::Server {
        let session_name = server_profile_tmux_session_name(name);
        if let Some(tmux) = resolve_server_command_binary(context, "tmux") {
            if server_tmux_session_exists(&tmux, &session_name) {
                let status = Command::new(&tmux)
                    .args(["kill-session", "-t", &session_name])
                    .status()
                    .map_err(|error| format!("failed to stop tmux session for {name}: {error}"))?;
                if !status.success() {
                    return Err(format!(
                        "failed to stop {name}; tmux kill-session exited with {status}"
                    ));
                }
                thread::sleep(Duration::from_millis(150));
                return Ok(ProfileActionReport {
                    generated_at: now_iso(),
                    action: "terminate".to_string(),
                    zshrc_path: path_string(&context.zshrc_path),
                    profile: Some(find_profile(context, name).unwrap_or(profile)),
                    backups: Vec::new(),
                    message: format!("terminated {name} tmux session"),
                });
            }
        }
    }

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
    let quota_config = load_quota_config(context)?;
    if let Some(profile_config) = quota_config
        .as_ref()
        .and_then(|config| config.profiles.get(name))
    {
        let provider = quota_config
            .as_ref()
            .and_then(|config| config.providers.get(&profile_config.provider))
            .ok_or_else(|| {
                format!(
                    "quota provider '{}' is not configured",
                    profile_config.provider
                )
            })?;
        return read_custom_profile_quota(context, &profile, &profile_config.provider, provider);
    }

    if profile.model_provider.is_some() {
        return Err(format!(
            "{} does not have a configured quota provider",
            profile.name
        ));
    }
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
    let quota_proxy = resolve_quota_proxy_url(context);
    let usage = fetch_usage_json(access_token, account_id, quota_proxy.as_deref())?;
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

fn load_quota_config(context: &ProfileContext) -> Result<Option<QuotaConfigFile>, String> {
    let path = quota_providers_path(context);
    if !path.exists() {
        return Ok(None);
    }
    let contents = fs::read_to_string(&path)
        .map_err(|error| format!("failed to read quota configuration: {error}"))?;
    toml::from_str::<QuotaConfigFile>(&contents)
        .map(Some)
        .map_err(|error| format!("invalid quota configuration: {error}"))
}

fn read_custom_profile_quota(
    context: &ProfileContext,
    profile: &ProfileInfo,
    provider_id: &str,
    provider: &QuotaProviderConfig,
) -> Result<ProfileQuotaReport, String> {
    if !provider.method.eq_ignore_ascii_case("GET") {
        return Err(format!(
            "quota provider '{provider_id}' only supports GET requests"
        ));
    }
    let url = provider.url.trim();
    if !(url.starts_with("https://") || url.starts_with("http://")) {
        return Err(format!(
            "quota provider '{provider_id}' URL must use http or https"
        ));
    }

    let codex_home = PathBuf::from(&profile.codex_home);
    let auth = read_codex_auth_material(&codex_home);
    let auth_mode = provider.auth.as_deref().unwrap_or("bearer");
    let secret = if auth_mode.eq_ignore_ascii_case("none") {
        None
    } else if let Some(env_name) = provider
        .api_key_env
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        Some(std::env::var(env_name).map_err(|_| {
            format!("quota provider '{provider_id}' API key environment variable is unavailable")
        })?)
    } else {
        Some(
            auth.as_ref()
                .and_then(|material| material.access_token.as_deref())
                .ok_or_else(|| {
                    format!(
                        "{} has no credential for quota provider '{provider_id}'",
                        profile.name
                    )
                })?
                .to_string(),
        )
    };

    let proxy_url = resolve_quota_proxy_url(context);
    let mut client_builder = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(QUOTA_HTTP_TIMEOUT_SECONDS))
        .user_agent(format!("rCodexManager/{}", env!("CARGO_PKG_VERSION")));
    if let Some(proxy_url) = proxy_url {
        let proxy = reqwest::Proxy::all(proxy_url)
            .map_err(|_| "configured server proxy is invalid".to_string())?;
        client_builder = client_builder.proxy(proxy);
    }
    let client = client_builder
        .build()
        .map_err(|error| format!("failed to build quota client: {error}"))?;
    let mut request = client.get(url).header("Accept", "application/json");
    for (key, value) in &provider.headers {
        request = request.header(key, value);
    }
    if auth_mode.eq_ignore_ascii_case("none") {
        // Public quota endpoint; no authorization header is added.
    } else {
        let header = provider.auth_header.as_deref().unwrap_or("Authorization");
        let prefix = provider.auth_prefix.as_deref().unwrap_or_else(|| {
            if auth_mode.eq_ignore_ascii_case("api-key") {
                ""
            } else {
                "Bearer "
            }
        });
        request = request.header(
            header,
            format!("{prefix}{}", secret.as_deref().unwrap_or_default()),
        );
    }

    let response = request
        .send()
        .map_err(|error| format!("quota request failed: {error}"))?;
    let status = response.status();
    if !status.is_success() {
        return Err(format!("quota endpoint returned HTTP {}", status.as_u16()));
    }
    let payload = response
        .json::<Value>()
        .map_err(|error| format!("failed to parse quota response: {error}"))?;
    let windows_value = json_path_value(&payload, &provider.mapping.windows)
        .and_then(Value::as_array)
        .ok_or_else(|| {
            format!(
                "quota response field '{}' is not an array",
                provider.mapping.windows
            )
        })?;
    let windows = windows_value
        .iter()
        .enumerate()
        .map(|(index, item)| map_custom_quota_window(item, index, &provider.mapping))
        .collect::<Result<Vec<_>, _>>()?;
    if windows.is_empty() {
        return Err("quota endpoint returned no quota windows".to_string());
    }

    Ok(ProfileQuotaReport {
        generated_at: now_iso(),
        profile_name: profile.name.clone(),
        account: auth.and_then(|material| material.account),
        captured_at: Utc::now().timestamp(),
        endpoint: url.to_string(),
        windows,
    })
}

fn map_custom_quota_window(
    value: &Value,
    index: usize,
    mapping: &QuotaMappingConfig,
) -> Result<QuotaWindowInfo, String> {
    let id = json_path_value(value, &mapping.id)
        .and_then(Value::as_str)
        .map(str::to_string)
        .unwrap_or_else(|| format!("window-{index}"));
    let label = json_path_value(value, &mapping.label)
        .and_then(Value::as_str)
        .map(str::to_string)
        .unwrap_or_else(|| id.clone());
    let used_percent = mapping
        .used_percent
        .as_deref()
        .and_then(|path| json_number(value, path));
    let remaining_percent = mapping
        .remaining_percent
        .as_deref()
        .and_then(|path| json_number(value, path));
    let window_minutes = mapping
        .window_minutes
        .as_deref()
        .and_then(|path| json_integer(value, path));
    let resets_at = mapping
        .resets_at
        .as_deref()
        .and_then(|path| json_integer(value, path));
    let allowed = mapping
        .allowed
        .as_deref()
        .and_then(|path| json_path_value(value, path).and_then(Value::as_bool));
    let limit_reached = mapping
        .limit_reached
        .as_deref()
        .and_then(|path| json_path_value(value, path).and_then(Value::as_bool));
    let status = mapping
        .status
        .as_deref()
        .and_then(|path| json_path_value(value, path).and_then(Value::as_str))
        .map(str::to_string)
        .unwrap_or_else(|| {
            if remaining_percent.unwrap_or(100.0) <= 0.0 {
                "exhausted".to_string()
            } else if remaining_percent.unwrap_or(100.0) <= 20.0 {
                "low".to_string()
            } else {
                "available".to_string()
            }
        });
    Ok(QuotaWindowInfo {
        id,
        label,
        used_percent,
        remaining_percent,
        window_minutes,
        resets_at,
        allowed,
        limit_reached,
        status,
    })
}

fn json_path_value<'a>(value: &'a Value, path: &str) -> Option<&'a Value> {
    path.split('.')
        .filter(|part| !part.is_empty())
        .try_fold(value, |current, part| current.as_object()?.get(part))
}

fn json_number(value: &Value, path: &str) -> Option<f64> {
    json_path_value(value, path)
        .and_then(|item| item.as_f64().or_else(|| item.as_str()?.parse().ok()))
}

fn json_integer(value: &Value, path: &str) -> Option<i64> {
    json_path_value(value, path).and_then(|item| {
        item.as_i64()
            .or_else(|| item.as_f64().map(|number| number as i64))
            .or_else(|| item.as_str()?.parse().ok())
    })
}

pub fn profile_login_command(
    context: &ProfileContext,
    name: &str,
    device_auth: bool,
) -> Result<Command, String> {
    validate_profile_selector_name(name)?;
    let profile = find_profile(context, name)?;
    let codex = resolve_server_command_binary(context, "codex").ok_or_else(|| {
        "Codex CLI was not found in the current PATH or user bin directory".to_string()
    })?;
    let mut command = Command::new(codex);
    command
        .arg("login")
        .args(["-c", "cli_auth_credentials_store=\"file\""])
        .env("CODEX_HOME", &profile.codex_home);
    if device_auth {
        command.arg("--device-auth");
    } else {
        command.env("BROWSER", "/usr/bin/false");
    }
    Ok(command)
}

pub fn run_profile_login_foreground(
    context: &ProfileContext,
    name: &str,
    device_auth: bool,
) -> Result<(), String> {
    let status = profile_login_command(context, name, device_auth)?
        .status()
        .map_err(|error| format!("failed to run Codex login: {error}"))?;
    if status.success() {
        Ok(())
    } else {
        Err(format!("Codex login exited with {status}"))
    }
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
    set_private_file_permissions(&target_auth_path)?;

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

pub fn open_cc_switch() -> Result<String, String> {
    for app_name in ["CC Switch", "cc-switch"] {
        if try_open_application(app_name) {
            return Ok(format!("已尝试打开 {app_name}。"));
        }
    }

    let home_dir = std::env::var_os("HOME").map(PathBuf::from);
    let candidates = home_dir
        .iter()
        .flat_map(|home| {
            [
                home.join("Applications/CC Switch.app"),
                home.join("Documents/cc-switch"),
                home.join("Documents/CC Switch.app"),
            ]
        })
        .chain([
            PathBuf::from("/Applications/CC Switch.app"),
            PathBuf::from("/Applications/cc-switch.app"),
        ]);

    for path in candidates {
        if path.exists() && try_open_path(&path) {
            return Ok(format!("已打开 {}。", path_string(&path)));
        }
    }

    Err("未找到 cc-switch 应用或本机项目目录。可以先安装/启动 cc-switch，或使用 rCodexManager 内置代理。".to_string())
}

fn try_open_application(app_name: &str) -> bool {
    Command::new("open")
        .arg("-a")
        .arg(app_name)
        .status()
        .map(|status| status.success())
        .unwrap_or(false)
}

fn try_open_path(path: &Path) -> bool {
    Command::new("open")
        .arg(path)
        .status()
        .map(|status| status.success())
        .unwrap_or(false)
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
    let mut running_pids =
        matching_default_profile_pids(running_processes, &codex_home, &user_data_dir);
    if default_profile_launcher_kind() == ProfileLauncherKind::Server {
        if let Some(pid) = server_profile_tmux_pid(context, "codex") {
            if !running_pids.contains(&pid) {
                running_pids.push(pid);
            }
        }
    }
    let recent_sessions = read_recent_session_summaries(&codex_home, PROFILE_SESSION_PREVIEW_LIMIT);
    let latest_session = recent_sessions.first().cloned();
    let should_show = codex_home.exists() || user_data_dir.exists();
    if !should_show {
        return None;
    }

    let config = read_codex_config(&config_path);
    let (account, auth_state) = read_profile_auth(&codex_home);
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
        model_provider: config.model_provider,
        reasoning_effort: config.reasoning_effort,
        home_exists: codex_home.exists(),
        user_data_exists: user_data_dir.exists(),
        config_exists: config_path.exists(),
        managed_by_app: false,
        is_default: true,
        is_archived: false,
        archived_at: None,
        launcher_kind: default_profile_launcher_kind(),
        zshrc_line: 0,
        is_running: !running_pids.is_empty(),
        running_process_count: running_pids.len(),
        running_pids,
        account,
        auth_state,
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

fn find_archived_profile(context: &ProfileContext, name: &str) -> Result<ProfileInfo, String> {
    list_profiles(context)?
        .archived_profiles
        .into_iter()
        .find(|profile| profile.name == name)
        .ok_or_else(|| format!("archived profile {name} was not found"))
}

#[derive(Debug, Clone)]
struct RunningCodexProcess {
    pid: u32,
    command: String,
    codex_home: Option<PathBuf>,
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
        Some(RunningCodexProcess {
            pid,
            command,
            codex_home: read_process_codex_home(pid),
        })
    } else {
        None
    }
}

fn is_codex_main_process(command: &str) -> bool {
    if CODEX_MAIN_EXECUTABLE_SUFFIXES
        .iter()
        .any(|suffix| command.ends_with(suffix) || command.contains(&format!("{suffix} --")))
    {
        return true;
    }

    let mut tokens = command.split_whitespace();
    let first = tokens
        .next()
        .map(|value| value.trim_matches(['\'', '"']))
        .unwrap_or_default();
    let first_name = Path::new(first)
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or_default();
    if first_name == "codex" {
        return true;
    }
    if first_name == "node" {
        let script = tokens
            .next()
            .map(|value| value.trim_matches(['\'', '"']))
            .unwrap_or_default();
        let script_name = Path::new(script)
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or_default();
        return script_name == "codex.js" && script.contains("/codex/");
    }
    false
}

fn matching_profile_pids(
    processes: &[RunningCodexProcess],
    codex_home: &Path,
    user_data_dir: &Path,
) -> Vec<u32> {
    processes
        .iter()
        .filter(|process| {
            process
                .codex_home
                .as_deref()
                .is_some_and(|path| paths_refer_to_same_location(path, codex_home))
                || command_has_user_data_dir(&process.command, user_data_dir)
        })
        .map(|process| process.pid)
        .collect()
}

fn matching_default_profile_pids(
    processes: &[RunningCodexProcess],
    codex_home: &Path,
    user_data_dir: &Path,
) -> Vec<u32> {
    processes
        .iter()
        .filter(|process| {
            process
                .codex_home
                .as_deref()
                .is_some_and(|path| paths_refer_to_same_location(path, codex_home))
                || command_has_user_data_dir(&process.command, user_data_dir)
                || (cfg!(target_os = "linux") && process.codex_home.is_none())
        })
        .map(|process| process.pid)
        .collect()
}

fn profile_runtime_statuses_from_processes(
    context: &ProfileContext,
    targets: Vec<ProfileRuntimeTarget>,
    processes: &[RunningCodexProcess],
) -> Vec<ProfileRuntimeInfo> {
    targets
        .into_iter()
        .map(|target| {
            let codex_home = PathBuf::from(&target.codex_home);
            let user_data_dir = PathBuf::from(&target.user_data_dir);
            let mut running_pids = if target.is_default {
                matching_default_profile_pids(processes, &codex_home, &user_data_dir)
            } else {
                matching_profile_pids(processes, &codex_home, &user_data_dir)
            };
            if target.launcher_kind == ProfileLauncherKind::Server {
                if let Some(pid) = server_profile_tmux_pid(context, &target.name) {
                    running_pids.push(pid);
                }
            }
            running_pids.sort_unstable();
            running_pids.dedup();

            ProfileRuntimeInfo {
                name: target.name,
                is_running: !running_pids.is_empty(),
                running_process_count: running_pids.len(),
                running_pids,
            }
        })
        .collect()
}

#[cfg(target_os = "linux")]
fn read_process_codex_home(pid: u32) -> Option<PathBuf> {
    let environ = fs::read(format!("/proc/{pid}/environ")).ok()?;
    parse_codex_home_from_environ(&environ)
}

#[cfg(not(target_os = "linux"))]
fn read_process_codex_home(_pid: u32) -> Option<PathBuf> {
    None
}

#[cfg(any(target_os = "linux", test))]
fn parse_codex_home_from_environ(environ: &[u8]) -> Option<PathBuf> {
    const PREFIX: &[u8] = b"CODEX_HOME=";
    environ
        .split(|byte| *byte == 0)
        .find_map(|entry| entry.strip_prefix(PREFIX))
        .filter(|value| !value.is_empty())
        .map(|value| PathBuf::from(String::from_utf8_lossy(value).into_owned()))
}

fn server_profile_tmux_session_name(profile_name: &str) -> String {
    format!("{SERVER_PROFILE_TMUX_PREFIX}{profile_name}")
}

fn resolve_server_command_binary(context: &ProfileContext, command: &str) -> Option<PathBuf> {
    let mut candidates = vec![
        context.home_dir.join("bin").join(command),
        context.home_dir.join(".local/bin").join(command),
        PathBuf::from("/usr/local/bin").join(command),
        PathBuf::from("/usr/bin").join(command),
    ];
    if let Some(path_value) = std::env::var_os("PATH") {
        candidates
            .extend(std::env::split_paths(&path_value).map(|directory| directory.join(command)));
    }
    candidates.into_iter().find(|candidate| candidate.is_file())
}

#[derive(Debug, Clone)]
struct WechatNodeRuntime {
    npx_path: PathBuf,
    path_env: std::ffi::OsString,
}

fn parse_node_major_version(value: &str) -> Option<u32> {
    value
        .trim()
        .trim_start_matches('v')
        .split('.')
        .next()?
        .parse()
        .ok()
}

fn node_major_version(node_path: &Path) -> Option<u32> {
    let output = Command::new(node_path).arg("--version").output().ok()?;
    if !output.status.success() {
        return None;
    }
    parse_node_major_version(&String::from_utf8_lossy(&output.stdout))
}

fn add_node_version_candidates(root: &Path, suffix: &Path, candidates: &mut BTreeSet<PathBuf>) {
    let Ok(entries) = fs::read_dir(root) else {
        return;
    };
    for entry in entries.flatten() {
        let node_path = entry.path().join(suffix);
        if node_path.is_file() {
            candidates.insert(node_path);
        }
    }
}

fn resolve_wechat_node_runtime(context: &ProfileContext) -> Result<WechatNodeRuntime, String> {
    let mut candidates = BTreeSet::new();
    if let Some(node_path) = resolve_server_command_binary(context, "node") {
        candidates.insert(node_path);
    }
    for node_path in [
        PathBuf::from("/opt/homebrew/bin/node"),
        context.home_dir.join(".volta/bin/node"),
    ] {
        if node_path.is_file() {
            candidates.insert(node_path);
        }
    }
    add_node_version_candidates(
        &context.home_dir.join(".nvm/versions/node"),
        Path::new("bin/node"),
        &mut candidates,
    );
    add_node_version_candidates(
        &context.home_dir.join(".local/share/fnm/node-versions"),
        Path::new("installation/bin/node"),
        &mut candidates,
    );

    let mut compatible = candidates
        .into_iter()
        .filter_map(|node_path| {
            let major = node_major_version(&node_path)?;
            let bin_dir = node_path.parent()?.to_path_buf();
            let npx_path = bin_dir.join("npx");
            (major >= WECHAT_MIN_NODE_MAJOR && npx_path.is_file())
                .then_some((major, bin_dir, npx_path))
        })
        .collect::<Vec<_>>();
    compatible.sort_by(|left, right| right.0.cmp(&left.0).then_with(|| left.1.cmp(&right.1)));
    let Some((_, bin_dir, npx_path)) = compatible.into_iter().next() else {
        return Err(format!(
            "wechat-acp requires Node.js {WECHAT_MIN_NODE_MAJOR}+; install a compatible Node runtime or expose it through NVM, FNM, Volta, or PATH"
        ));
    };

    let inherited_path = std::env::var_os("PATH");
    let path_entries =
        wechat_runtime_path_entries(&context.home_dir, bin_dir, inherited_path.as_deref());
    let path_env = std::env::join_paths(path_entries)
        .map_err(|error| format!("failed to build Node.js PATH: {error}"))?;
    Ok(WechatNodeRuntime { npx_path, path_env })
}

fn wechat_runtime_path_entries(
    home_dir: &Path,
    node_bin_dir: PathBuf,
    inherited_path: Option<&std::ffi::OsStr>,
) -> Vec<PathBuf> {
    let mut entries = Vec::new();
    let user_bin = home_dir.join("bin");
    if user_bin.is_dir() {
        entries.push(user_bin);
    }
    entries.push(node_bin_dir);
    if let Some(path_value) = inherited_path {
        entries.extend(std::env::split_paths(path_value));
    }

    let mut seen = BTreeSet::new();
    entries
        .into_iter()
        .filter(|entry| seen.insert(entry.clone()))
        .collect()
}

fn server_profile_launch_command(
    codex_home: &str,
    codex_binary: &Path,
    extra_env: &BTreeMap<String, String>,
) -> String {
    let mut parts = vec![
        "exec".to_string(),
        "env".to_string(),
        format!("CODEX_HOME={}", shell_quote(codex_home)),
    ];
    for (key, value) in extra_env {
        parts.push(format!("{}={}", key, shell_quote(value)));
    }
    for key in [
        "HTTP_PROXY",
        "HTTPS_PROXY",
        "ALL_PROXY",
        "NO_PROXY",
        "http_proxy",
        "https_proxy",
        "all_proxy",
        "no_proxy",
    ] {
        if let Ok(value) = std::env::var(key) {
            if !value.trim().is_empty() {
                parts.push(format!("{key}={}", shell_quote(&value)));
            }
        }
    }
    parts.push(shell_quote(&path_string(codex_binary)));
    parts.join(" ")
}

fn server_tmux_session_exists(tmux: &Path, session_name: &str) -> bool {
    Command::new(tmux)
        .args(["has-session", "-t", session_name])
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .is_ok_and(|status| status.success())
}

fn server_profile_tmux_pid(context: &ProfileContext, profile_name: &str) -> Option<u32> {
    let tmux = resolve_server_command_binary(context, "tmux")?;
    let session_name = server_profile_tmux_session_name(profile_name);
    let output = Command::new(tmux)
        .args(["list-panes", "-t", &session_name, "-F", "#{pane_pid}"])
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    String::from_utf8_lossy(&output.stdout)
        .lines()
        .find_map(|line| line.trim().parse().ok())
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

fn valid_wechat_instance_name(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 128
        && value
            .chars()
            .all(|char| char.is_ascii_alphanumeric() || char == '-' || char == '_')
}

fn discover_wechat_instances(
    context: &ProfileContext,
    processes: &[RunningWechatBridgeProcess],
) -> Vec<String> {
    let mut instances = BTreeSet::new();
    for process in processes {
        if valid_wechat_instance_name(&process.instance) {
            instances.insert(process.instance.clone());
        }
    }

    let storage_root = context.home_dir.join(".wechat-acp").join("instances");
    if let Ok(entries) = fs::read_dir(storage_root) {
        for entry in entries.flatten() {
            let Some(instance) = entry.file_name().to_str().map(str::to_string) else {
                continue;
            };
            if valid_wechat_instance_name(&instance) && entry.path().join("token.json").is_file() {
                instances.insert(instance);
            }
        }
    }

    instances.into_iter().collect()
}

fn terminate_wechat_bridge_pids(pids: &[u32]) -> Result<(), String> {
    let mut failures = Vec::new();
    for pid in pids {
        match Command::new("kill")
            .arg("-TERM")
            .arg(pid.to_string())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
        {
            Ok(status) if status.success() => {}
            Ok(_status) if !process_is_alive(*pid) => {}
            Ok(status) => failures.push(format!("{pid} ({status})")),
            Err(_) if !process_is_alive(*pid) => {}
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

#[derive(Debug, Clone, Default)]
struct SessionFileDetails {
    id: Option<String>,
    started_at: Option<String>,
    cwd: Option<String>,
    summary: Option<String>,
}

#[derive(Debug, Clone)]
struct CachedSessionFileDetails {
    file_len: u64,
    modified_at: Option<SystemTime>,
    details: SessionFileDetails,
}

static SESSION_FILE_DETAILS_CACHE: OnceLock<Mutex<BTreeMap<PathBuf, CachedSessionFileDetails>>> =
    OnceLock::new();

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

fn read_recent_session_index_summaries(
    codex_home: &Path,
    limit: usize,
) -> Vec<CodexSessionSummary> {
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
        let summary = session_summary_from_index_entry(entry, session_path.as_deref());
        if remember_session_summary(&summary, &mut seen_ids, &mut seen_paths) {
            summaries.push(summary);
        }
    }

    let files = collect_recent_session_files_limited(&sessions_dir, limit);
    for path in files {
        if summaries.len() >= limit {
            break;
        }
        if let Some(summary) = session_summary_from_preview_path(path.as_path()) {
            if remember_session_summary(&summary, &mut seen_ids, &mut seen_paths) {
                summaries.push(summary);
            }
        }
    }

    summaries
}

fn session_summary_from_index_entry(
    entry: SessionIndexEntry,
    session_path: Option<&Path>,
) -> CodexSessionSummary {
    let renamed_title = normalize_session_title(entry.thread_name.as_deref());
    let title = renamed_title
        .clone()
        .unwrap_or_else(|| "未命名会话".to_string());

    CodexSessionSummary {
        id: entry.id,
        title,
        renamed_title,
        summary: None,
        updated_at: entry.updated_at,
        started_at: None,
        cwd: None,
        path: session_path.map(path_string),
    }
}

fn session_summary_from_preview_path(session_path: &Path) -> Option<CodexSessionSummary> {
    let details = read_session_file_details_preview(session_path);
    let id = details.id.or_else(|| {
        session_path
            .file_stem()
            .map(|value| value.to_string_lossy().to_string())
    })?;
    let title = details
        .summary
        .as_deref()
        .and_then(summary_title_from_text)
        .unwrap_or_else(|| "未命名会话".to_string());

    Some(CodexSessionSummary {
        id,
        title,
        renamed_title: None,
        summary: details.summary,
        updated_at: None,
        started_at: details.started_at,
        cwd: details.cwd,
        path: Some(path_string(session_path)),
    })
}

fn session_summary_from_parts(
    index_entry: Option<SessionIndexEntry>,
    session_path: Option<&Path>,
) -> Option<CodexSessionSummary> {
    let details = session_path
        .map(read_session_file_details_cached)
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
    limit.clamp(1, 100)
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

fn read_session_file_details_cached(path: &Path) -> SessionFileDetails {
    let metadata = fs::metadata(path).ok();
    let file_len = metadata
        .as_ref()
        .map(|value| value.len())
        .unwrap_or_default();
    let modified_at = metadata.and_then(|value| value.modified().ok());
    let cache = SESSION_FILE_DETAILS_CACHE.get_or_init(|| Mutex::new(BTreeMap::new()));

    if let Ok(cache) = cache.lock() {
        if let Some(cached) = cache.get(path) {
            if cached.file_len == file_len && cached.modified_at == modified_at {
                return cached.details.clone();
            }
        }
    }

    let details = read_session_file_details(path);
    if let Ok(mut cache) = cache.lock() {
        if cache.len() >= SESSION_DETAIL_CACHE_LIMIT {
            cache.clear();
        }
        cache.insert(
            path.to_path_buf(),
            CachedSessionFileDetails {
                file_len,
                modified_at,
                details: details.clone(),
            },
        );
    }
    details
}

fn read_session_file_details_preview(path: &Path) -> SessionFileDetails {
    let Ok(file) = fs::File::open(path) else {
        return SessionFileDetails::default();
    };
    let mut details = SessionFileDetails::default();
    read_session_file_details_from_reader(
        BufReader::new(file.take(SESSION_DETAIL_HEAD_BYTES)),
        &mut details,
    );
    details
}

fn read_session_file_details(path: &Path) -> SessionFileDetails {
    let Ok(file) = fs::File::open(path) else {
        return SessionFileDetails::default();
    };
    let file_len = file.metadata().map(|value| value.len()).unwrap_or_default();
    let mut details = SessionFileDetails::default();

    if file_len <= SESSION_DETAIL_HEAD_BYTES + SESSION_DETAIL_TAIL_BYTES {
        read_session_file_details_from_reader(BufReader::new(file), &mut details);
        return details;
    }

    read_session_file_details_from_reader(
        BufReader::new(file.take(SESSION_DETAIL_HEAD_BYTES)),
        &mut details,
    );

    let Ok(mut tail_file) = fs::File::open(path) else {
        return details;
    };
    let tail_start = file_len.saturating_sub(SESSION_DETAIL_TAIL_BYTES);
    if tail_file.seek(SeekFrom::Start(tail_start)).is_err() {
        return details;
    }
    let mut tail = Vec::with_capacity(SESSION_DETAIL_TAIL_BYTES as usize);
    if tail_file
        .take(SESSION_DETAIL_TAIL_BYTES)
        .read_to_end(&mut tail)
        .is_err()
    {
        return details;
    }
    let tail = if tail_start > 0 {
        tail.iter()
            .position(|byte| *byte == b'\n')
            .map(|index| &tail[index + 1..])
            .unwrap_or_default()
    } else {
        tail.as_slice()
    };
    for line in tail.split(|byte| *byte == b'\n') {
        if let Ok(text) = std::str::from_utf8(trim_ascii_bytes(line)) {
            apply_session_file_detail_line(&mut details, text);
        }
    }

    details
}

fn read_session_file_details_from_reader<R: BufRead>(reader: R, details: &mut SessionFileDetails) {
    for line in reader.lines().map_while(Result::ok) {
        apply_session_file_detail_line(details, line.trim());
    }
}

fn apply_session_file_detail_line(details: &mut SessionFileDetails, trimmed: &str) {
    if trimmed.is_empty() {
        return;
    }
    let Ok(root) = serde_json::from_str::<Value>(trimmed) else {
        return;
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

fn read_profile_auth(codex_home: &Path) -> (Option<CodexAccountInfo>, ProfileAuthState) {
    let auth_path = codex_home.join("auth.json");
    if !auth_path.exists() {
        return (None, missing_profile_auth_state());
    }

    let Some(material) = read_codex_auth_material(codex_home) else {
        return (
            None,
            ProfileAuthState {
                status: ProfileAuthStatus::Invalid,
                expires_at: None,
                refresh_available: false,
            },
        );
    };
    let state = profile_auth_state_from_material(&material, Utc::now().timestamp());
    (material.account.clone(), state)
}

fn missing_profile_auth_state() -> ProfileAuthState {
    ProfileAuthState {
        status: ProfileAuthStatus::Missing,
        expires_at: None,
        refresh_available: false,
    }
}

fn profile_auth_state_from_material(
    material: &CodexAuthMaterial,
    now_timestamp: i64,
) -> ProfileAuthState {
    let status = if material.has_api_key {
        ProfileAuthStatus::ApiKey
    } else if material.access_token.is_none() {
        ProfileAuthStatus::Invalid
    } else if material
        .access_token_expires_at
        .is_some_and(|expires_at| expires_at <= now_timestamp)
    {
        if material.has_refresh_token {
            ProfileAuthStatus::RefreshRequired
        } else {
            ProfileAuthStatus::Expired
        }
    } else if material.access_token_expires_at.is_some() {
        ProfileAuthStatus::Valid
    } else {
        ProfileAuthStatus::Unknown
    };

    ProfileAuthState {
        status,
        expires_at: material.access_token_expires_at,
        refresh_available: material.has_refresh_token,
    }
}

fn read_codex_auth_material(codex_home: &Path) -> Option<CodexAuthMaterial> {
    let auth_path = codex_home.join("auth.json");
    let contents = fs::read_to_string(auth_path).ok()?;
    let root: Value = serde_json::from_str(&contents).ok()?;
    read_codex_auth_material_from_value(&root)
}

fn read_profile_api_key(codex_home: &Path) -> Option<String> {
    let auth_path = codex_home.join("auth.json");
    let contents = fs::read_to_string(auth_path).ok()?;
    let root: Value = serde_json::from_str(&contents).ok()?;
    string_at(&root, &["OPENAI_API_KEY"]).or_else(|| string_at(&root, &["api_key"]))
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
    let has_refresh_token = string_at(tokens, &["refresh_token"])
        .or_else(|| string_at(root, &["refresh_token"]))
        .is_some();
    let has_api_key = string_at(root, &["OPENAI_API_KEY"])
        .or_else(|| string_at(root, &["api_key"]))
        .is_some();

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

    if account.is_none() && access_token.is_none() && !has_api_key {
        return None;
    }

    Some(CodexAuthMaterial {
        account,
        access_token,
        account_id,
        access_token_expires_at,
        has_refresh_token,
        has_api_key,
    })
}

fn fetch_usage_json(
    access_token: &str,
    account_id: Option<&str>,
    proxy_url: Option<&str>,
) -> Result<Value, String> {
    let mut client_builder = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(QUOTA_HTTP_TIMEOUT_SECONDS))
        .user_agent(format!(
            "rCodexManager/{} ({})",
            env!("CARGO_PKG_VERSION"),
            CHATGPT_BASE_URL
        ));
    if let Some(proxy_url) = proxy_url {
        let proxy = reqwest::Proxy::all(proxy_url)
            .map_err(|_| "configured server proxy is invalid".to_string())?;
        client_builder = client_builder.proxy(proxy);
    }
    let client = client_builder
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
        .map_err(|error| format_usage_transport_error(proxy_url.is_some(), &error.to_string()))?;
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

fn resolve_quota_proxy_url(context: &ProfileContext) -> Option<String> {
    proxy_url_from_environment()
        .or_else(|| proxy_url_from_codex_wrapper(context))
        .or_else(proxy_url_from_system_settings)
}

fn proxy_url_from_environment() -> Option<String> {
    PROXY_ENV_KEYS.iter().find_map(|key| {
        std::env::var(key)
            .ok()
            .and_then(|value| normalize_http_proxy_url(&value))
    })
}

fn proxy_url_from_codex_wrapper(context: &ProfileContext) -> Option<String> {
    let mut candidates = vec![
        context.home_dir.join("bin/codex"),
        context.home_dir.join(".local/bin/codex"),
    ];
    if let Some(resolved) = resolve_server_command_binary(context, "codex") {
        if !candidates.contains(&resolved) {
            candidates.push(resolved);
        }
    }

    candidates.into_iter().find_map(|path| {
        let metadata = fs::metadata(&path).ok()?;
        if !metadata.is_file()
            || metadata.len() == 0
            || metadata.len() > CODEX_WRAPPER_PROXY_SCAN_MAX_BYTES
        {
            return None;
        }
        let contents = fs::read_to_string(path).ok()?;
        proxy_url_from_shell_script(&contents)
    })
}

#[cfg(target_os = "macos")]
fn proxy_url_from_system_settings() -> Option<String> {
    let proxy = detect_system_proxy_env().ok()?;
    preferred_quota_proxy_url(&proxy)
}

#[cfg(not(target_os = "macos"))]
fn proxy_url_from_system_settings() -> Option<String> {
    None
}

fn preferred_quota_proxy_url(proxy: &ProxyEnvSettings) -> Option<String> {
    proxy
        .https_proxy
        .as_deref()
        .or(proxy.http_proxy.as_deref())
        .and_then(normalize_http_proxy_url)
}

fn proxy_url_from_shell_script(contents: &str) -> Option<String> {
    let mut assignments = BTreeMap::new();
    for line in contents.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }
        let assignment = trimmed.strip_prefix("export ").unwrap_or(trimmed).trim();
        let Some((key, raw_value)) = assignment.split_once('=') else {
            continue;
        };
        let key = key.trim();
        if !PROXY_ENV_KEYS.contains(&key) {
            continue;
        }
        if let Some(value) = parse_literal_shell_value(raw_value) {
            assignments.insert(key.to_string(), value);
        }
    }

    PROXY_ENV_KEYS.iter().find_map(|key| {
        assignments
            .get(*key)
            .and_then(|value| normalize_http_proxy_url(value))
    })
}

fn parse_literal_shell_value(raw_value: &str) -> Option<String> {
    let value = raw_value.trim();
    if value.is_empty() {
        return None;
    }

    let parsed = if let Some(inner) = value.strip_prefix('\'') {
        let end = inner.find('\'')?;
        if !inner[end + 1..].trim().is_empty() {
            return None;
        }
        inner[..end].to_string()
    } else if let Some(inner) = value.strip_prefix('"') {
        let end = inner.rfind('"')?;
        if !inner[end + 1..].trim().is_empty() {
            return None;
        }
        let inner = &inner[..end];
        if inner.contains('$') || inner.contains('`') {
            return None;
        }
        inner.replace("\\\"", "\"").replace("\\\\", "\\")
    } else {
        let literal = value.split_whitespace().next()?;
        if literal.contains('$') || literal.contains('`') {
            return None;
        }
        literal.to_string()
    };

    (!parsed.trim().is_empty()).then_some(parsed)
}

fn normalize_http_proxy_url(value: &str) -> Option<String> {
    let trimmed = value.trim();
    let parsed = reqwest::Url::parse(trimmed).ok()?;
    if !matches!(parsed.scheme(), "http" | "https") || parsed.host_str().is_none() {
        return None;
    }
    Some(trimmed.to_string())
}

fn format_usage_transport_error(using_proxy: bool, detail: &str) -> String {
    if using_proxy {
        "usage request could not reach ChatGPT through the configured server proxy; check the proxy service and retry".to_string()
    } else {
        format!("usage request failed: {detail}")
    }
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

fn set_private_file_permissions(path: &Path) -> Result<(), String> {
    #[cfg(unix)]
    {
        let mut permissions = fs::metadata(path)
            .map_err(|error| error.to_string())?
            .permissions();
        permissions.set_mode(0o600);
        fs::set_permissions(path, permissions).map_err(|error| error.to_string())?;
    }
    Ok(())
}

fn write_text_atomic(path: &Path, contents: &str) -> Result<(), String> {
    let tmp_path = path.with_file_name(format!(
        ".{}.rcodexmanager-{}.tmp",
        path.file_name()
            .map(|value| value.to_string_lossy())
            .unwrap_or_else(|| "config.toml".into()),
        timestamp_compact()
    ));
    fs::write(&tmp_path, with_trailing_newline(contents.to_string()))
        .map_err(|error| error.to_string())?;
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

fn quota_providers_path(context: &ProfileContext) -> PathBuf {
    app_data_dir(context).join("quota-providers.toml")
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

fn feishu_remote_store_path(context: &ProfileContext) -> PathBuf {
    app_data_dir(context).join("feishu-remote.json")
}

#[derive(Debug, Clone)]
struct FeishuRemotePaths {
    base_dir: PathBuf,
    install_bin_dir: PathBuf,
    config_path: PathBuf,
    state_path: PathBuf,
    pid_path: PathBuf,
    log_path: PathBuf,
}

fn feishu_remote_paths(context: &ProfileContext) -> FeishuRemotePaths {
    let base_dir = app_data_dir(context).join("feishu-remote");
    let namespace = format!("codex-remote-{FEISHU_REMOTE_INSTANCE}");
    let config_home = base_dir.join(".config").join(&namespace);
    let data_home = base_dir.join(".local/share").join(&namespace);
    let state_home = base_dir.join(".local/state").join(namespace);
    FeishuRemotePaths {
        install_bin_dir: base_dir.join("bin"),
        config_path: config_home.join("codex-remote/config.json"),
        state_path: data_home.join("codex-remote/install-state.json"),
        pid_path: state_home.join("codex-remote/codex-remote-relayd.pid"),
        log_path: data_home.join("codex-remote/logs/codex-remote-relayd.log"),
        base_dir,
    }
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

fn read_feishu_remote_store(context: &ProfileContext) -> Result<FeishuRemoteStore, String> {
    let path = feishu_remote_store_path(context);
    if !path.exists() {
        return Ok(FeishuRemoteStore::default());
    }
    let contents = fs::read_to_string(&path).map_err(|error| error.to_string())?;
    serde_json::from_str(&contents).map_err(|error| {
        format!(
            "failed to parse Feishu remote file {}: {error}",
            path_string(&path)
        )
    })
}

fn write_feishu_remote_store(
    context: &ProfileContext,
    store: &FeishuRemoteStore,
) -> Result<(), String> {
    let path = feishu_remote_store_path(context);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let payload = serde_json::to_string_pretty(store).map_err(|error| error.to_string())?;
    fs::write(path, format!("{payload}\n")).map_err(|error| error.to_string())
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

fn resolve_wechat_bridge_instance(
    profile: &ProfileInfo,
    store: &WechatBridgeStore,
    discovered_instances: &[String],
    profiles: &[ProfileInfo],
) -> (String, bool) {
    if let Some(record) = store.bindings.get(&profile.name) {
        return (record.instance.clone(), true);
    }

    let expected = wechat_bridge_instance_name(&profile.name);
    if discovered_instances
        .iter()
        .any(|instance| instance == &expected)
    {
        return (expected, false);
    }

    let other_profile_instances = profiles
        .iter()
        .filter(|candidate| candidate.name != profile.name)
        .map(|candidate| wechat_bridge_instance_name(&candidate.name))
        .collect::<BTreeSet<_>>();
    let external_prefix = format!("{expected}-");
    let external_matches = discovered_instances
        .iter()
        .filter(|instance| {
            instance.starts_with(&external_prefix)
                && !other_profile_instances.contains(instance.as_str())
        })
        .collect::<Vec<_>>();
    if external_matches.len() == 1 {
        return (external_matches[0].clone(), false);
    }

    if profiles.len() == 1 && discovered_instances.len() == 1 {
        return (discovered_instances[0].clone(), false);
    }
    (expected, false)
}

fn wechat_bridge_entry(
    context: &ProfileContext,
    profile: &ProfileInfo,
    store: &WechatBridgeStore,
    processes: &[RunningWechatBridgeProcess],
    discovered_instances: &[String],
    profiles: &[ProfileInfo],
) -> WechatBridgeEntry {
    let (instance, managed_by_app) =
        resolve_wechat_bridge_instance(profile, store, discovered_instances, profiles);
    let paths = wechat_bridge_paths(context, &instance);
    let record = store.bindings.get(&profile.name);
    let running_pids = matching_wechat_bridge_pids(processes, &instance);
    let auth_path = PathBuf::from(&profile.codex_home).join("auth.json");
    let token_exists = paths.token_path.exists();
    let running = !running_pids.is_empty();
    let last_error = record.and_then(|record| record.last_error.clone());
    let connection_state = if last_error.is_some() {
        "error"
    } else if running && !token_exists {
        "awaiting-scan"
    } else if running {
        "running"
    } else if token_exists {
        "bound"
    } else {
        "unbound"
    };

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
        token_exists,
        running,
        managed_by_app,
        connection_state: connection_state.to_string(),
        running_pids,
        last_started_at: record.and_then(|record| record.last_started_at.clone()),
        last_stopped_at: record.and_then(|record| record.last_stopped_at.clone()),
        last_error,
        log_tail: read_wechat_bridge_log_tail(&paths, WECHAT_BRIDGE_LOG_TAIL_LINES),
    }
}

fn auth_backup_entry(record: AuthBackupRecord) -> AuthBackupEntry {
    let path = PathBuf::from(&record.path);
    let metadata = fs::metadata(&path).ok();
    let file_size_bytes = metadata.as_ref().map(fs::Metadata::len);
    let modified_at = metadata
        .as_ref()
        .and_then(|value| value.modified().ok())
        .map(DateTime::<Utc>::from)
        .map(|value| value.to_rfc3339_opts(SecondsFormat::Secs, true));
    let contents = fs::read_to_string(&path);
    let (auth_json, validation_message) = match contents {
        Ok(contents) => match serde_json::from_str::<Value>(&contents) {
            Ok(value) if read_codex_auth_material_from_value(&value).is_some() => {
                (Some(value), None)
            }
            Ok(_) => (None, Some("备份不包含可识别的 Codex 认证信息".to_string())),
            Err(error) => (None, Some(format!("备份 JSON 损坏：{error}"))),
        },
        Err(error) if path.exists() => (None, Some(format!("无法读取备份文件：{error}"))),
        Err(_) => (None, Some("备份文件缺失".to_string())),
    };
    let account = auth_json
        .as_ref()
        .and_then(read_codex_auth_material_from_value)
        .and_then(|material| material.account);
    let has_refresh_token = auth_json.as_ref().is_some_and(auth_json_has_refresh_token);
    let valid = validation_message.is_none();

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
        valid,
        validation_message,
        file_size_bytes,
        modified_at,
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

fn write_wechat_bridge_wrapper(
    path: &Path,
    profile: &ProfileInfo,
    node_runtime: &WechatNodeRuntime,
) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let script = format!(
        "#!/usr/bin/env bash\nset -euo pipefail\nexport CODEX_HOME={}\nexport PATH={}\nexec {} -y --package {} codex-acp \"$@\"\n",
        shell_quote(&profile.codex_home),
        shell_quote(&node_runtime.path_env.to_string_lossy()),
        shell_quote(&path_string(&node_runtime.npx_path)),
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
    node_runtime: &WechatNodeRuntime,
) -> String {
    let exec = format!(
        "exec env PATH={} {} -y --package {} wechat-acp --instance {} --agent {} --cwd {} --inbox-dir {} --hide-thoughts",
        shell_quote(&node_runtime.path_env.to_string_lossy()),
        shell_quote(&path_string(&node_runtime.npx_path)),
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

fn build_feishu_remote_report(
    context: &ProfileContext,
    log_lines: usize,
) -> Result<FeishuRemoteReport, String> {
    let store = read_feishu_remote_store(context)?;
    let paths = feishu_remote_paths(context);
    let binary_path = resolve_feishu_remote_binary(context, store.binary_path.as_deref());
    let version = binary_path.as_deref().and_then(feishu_remote_version);
    let profile = store
        .profile_name
        .as_deref()
        .and_then(|name| find_profile(context, name).ok());
    let auth_exists = profile
        .as_ref()
        .map(|profile| {
            PathBuf::from(&profile.codex_home)
                .join("auth.json")
                .exists()
        })
        .unwrap_or(false);

    let config = read_json_value_if_exists(&paths.config_path);
    let admin_port = config
        .as_ref()
        .and_then(|value| value.pointer("/admin/listenPort"))
        .and_then(Value::as_u64)
        .and_then(|value| u16::try_from(value).ok())
        .filter(|value| *value > 0)
        .unwrap_or(FEISHU_REMOTE_DEFAULT_ADMIN_PORT);
    let configured_app_count = config
        .as_ref()
        .and_then(|value| value.pointer("/feishu/apps"))
        .and_then(Value::as_array)
        .map(|apps| {
            apps.iter()
                .filter(|app| {
                    app.get("appId")
                        .and_then(Value::as_str)
                        .is_some_and(|value| !value.trim().is_empty())
                        && app
                            .get("appSecret")
                            .and_then(Value::as_str)
                            .is_some_and(|value| !value.trim().is_empty())
                })
                .count()
        })
        .unwrap_or(0);

    let pid = read_feishu_remote_pid(&paths.pid_path)
        .filter(|pid| is_managed_feishu_remote_process(*pid, &paths));
    let admin_url = format!("http://127.0.0.1:{admin_port}/");
    let setup_url = format!("http://127.0.0.1:{admin_port}/setup");
    let health_url = format!("http://127.0.0.1:{admin_port}/healthz");
    let healthy = pid.is_some() && feishu_remote_http_ok(&health_url);
    let runtime_status = if healthy {
        read_feishu_remote_runtime_status(admin_port)
    } else {
        None
    };
    let gateways = runtime_status
        .as_ref()
        .and_then(|value| value.get("gateways"))
        .and_then(Value::as_array);
    let gateway_count = gateways.map_or(configured_app_count, Vec::len);
    let connected_gateway_count = gateways
        .map(|items| {
            items
                .iter()
                .filter(|item| item.get("state").and_then(Value::as_str) == Some("connected"))
                .count()
        })
        .unwrap_or(0);
    let configured = configured_app_count > 0 || gateway_count > 0;
    let running = pid.is_some();
    let connection_state = if binary_path.is_none() {
        "not-installed"
    } else if store.last_error.is_some() && !running {
        "error"
    } else if running && connected_gateway_count > 0 {
        "connected"
    } else if running && configured {
        "starting"
    } else if running {
        "unconfigured"
    } else if configured {
        "stopped"
    } else {
        "unconfigured"
    };

    Ok(FeishuRemoteReport {
        generated_at: now_iso(),
        instance: FEISHU_REMOTE_INSTANCE.to_string(),
        installed: binary_path.is_some(),
        binary_path: binary_path.as_deref().map(path_string),
        version,
        profile_name: profile.as_ref().map(|profile| profile.name.clone()),
        profile_label: profile.as_ref().map(|profile| {
            profile
                .alias
                .clone()
                .unwrap_or_else(|| profile.name.clone())
        }),
        codex_home: profile.as_ref().map(|profile| profile.codex_home.clone()),
        auth_exists,
        configured,
        running,
        healthy,
        connection_state: connection_state.to_string(),
        pid,
        config_path: path_string(&paths.config_path),
        state_path: path_string(&paths.state_path),
        log_path: path_string(&paths.log_path),
        admin_port,
        setup_url,
        admin_url,
        gateway_count,
        connected_gateway_count,
        last_started_at: store.last_started_at,
        last_stopped_at: store.last_stopped_at,
        last_error: store.last_error,
        log_tail: tail_text_file_lines(&paths.log_path, log_lines),
        project_url: FEISHU_REMOTE_PROJECT_URL.to_string(),
    })
}

fn read_json_value_if_exists(path: &Path) -> Option<Value> {
    let contents = fs::read_to_string(path).ok()?;
    serde_json::from_str(&contents).ok()
}

fn resolve_feishu_remote_binary(
    context: &ProfileContext,
    preferred: Option<&str>,
) -> Option<PathBuf> {
    let paths = feishu_remote_paths(context);
    let mut candidates = Vec::new();
    if let Some(path) = preferred.map(str::trim).filter(|value| !value.is_empty()) {
        candidates.push(PathBuf::from(path));
    }
    if let Some(state) = read_json_value_if_exists(&paths.state_path) {
        for key in [
            "currentBinaryPath",
            "installedBinary",
            "installedRelaydBinary",
        ] {
            if let Some(path) = state.get(key).and_then(Value::as_str) {
                candidates.push(PathBuf::from(path));
            }
        }
    }
    candidates.push(paths.install_bin_dir.join("codex-remote"));
    candidates.push(context.home_dir.join(".local/bin/codex-remote"));
    candidates.push(PathBuf::from("/opt/homebrew/bin/codex-remote"));
    candidates.push(PathBuf::from("/usr/local/bin/codex-remote"));
    if let Some(path_value) = std::env::var_os("PATH") {
        candidates.extend(
            std::env::split_paths(&path_value).map(|directory| directory.join("codex-remote")),
        );
    }
    candidates
        .into_iter()
        .find_map(|candidate| validate_feishu_remote_binary(&candidate).ok())
}

fn validate_feishu_remote_binary(path: &Path) -> Result<PathBuf, String> {
    if !path.is_file() {
        return Err(format!(
            "codex-remote executable does not exist: {}",
            path_string(path)
        ));
    }
    let resolved = fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf());
    if feishu_remote_version(&resolved).is_none() {
        return Err(format!(
            "{} is not a working codex-remote executable",
            path_string(&resolved)
        ));
    }
    Ok(resolved)
}

fn feishu_remote_version(path: &Path) -> Option<String> {
    let output = Command::new(path).arg("version").output().ok()?;
    if !output.status.success() {
        return None;
    }
    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    stdout
        .lines()
        .chain(stderr.lines())
        .map(str::trim)
        .find(|line| !line.is_empty())
        .map(str::to_string)
}

fn read_feishu_remote_pid(path: &Path) -> Option<u32> {
    let pid = fs::read_to_string(path).ok()?.trim().parse::<u32>().ok()?;
    process_is_alive(pid).then_some(pid)
}

fn process_is_alive(pid: u32) -> bool {
    Command::new("kill")
        .arg("-0")
        .arg(pid.to_string())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .is_ok_and(|status| status.success())
}

fn is_managed_feishu_remote_process(pid: u32, paths: &FeishuRemotePaths) -> bool {
    let output = match Command::new("ps")
        .args(["-p", &pid.to_string(), "-o", "command="])
        .output()
    {
        Ok(output) if output.status.success() => output,
        _ => return false,
    };
    let command = String::from_utf8_lossy(&output.stdout);
    command.contains("codex-remote") && command.contains(paths.base_dir.to_string_lossy().as_ref())
}

fn feishu_remote_http_ok(url: &str) -> bool {
    reqwest::blocking::Client::builder()
        .timeout(Duration::from_millis(FEISHU_REMOTE_HTTP_TIMEOUT_MS))
        .no_proxy()
        .build()
        .ok()
        .and_then(|client| client.get(url).send().ok())
        .is_some_and(|response| response.status().is_success())
}

fn read_feishu_remote_runtime_status(port: u16) -> Option<Value> {
    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_millis(FEISHU_REMOTE_HTTP_TIMEOUT_MS))
        .no_proxy()
        .build()
        .ok()?;
    client
        .get(format!("http://127.0.0.1:{port}/api/admin/runtime-status"))
        .send()
        .ok()?
        .json()
        .ok()
}

fn sanitize_external_child_env(command: &mut Command) {
    for key in std::env::vars_os().map(|(key, _)| key) {
        let key_text = key.to_string_lossy();
        if key_text.starts_with("TAURI_")
            || key_text.starts_with("CARGO_MANIFEST_")
            || key_text.starts_with("CARGO_PKG_")
            || key_text == "OUT_DIR"
        {
            command.env_remove(key);
        }
    }
}

fn sanitize_external_command_output(contents: &str) -> String {
    contents
        .lines()
        .map(sanitize_wechat_log_line)
        .filter(|line| !line.trim().is_empty())
        .take(4)
        .collect::<Vec<_>>()
        .join("; ")
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
        archived_at: current.archived_at,
    };

    if next.alias.is_some()
        || next.category.is_some()
        || next.note.is_some()
        || next.archived_at.is_some()
    {
        store.profiles.insert(input.name, next);
    }

    write_metadata_store(context, &store)
}

fn set_profile_archived_at(
    context: &ProfileContext,
    name: &str,
    archived_at: Option<String>,
) -> Result<(), String> {
    let mut store = read_metadata_store(context)?;
    let metadata = store.profiles.entry(name.to_string()).or_default();
    metadata.archived_at = archived_at;
    if metadata.alias.is_none()
        && metadata.category.is_none()
        && metadata.note.is_none()
        && metadata.archived_at.is_none()
    {
        store.profiles.remove(name);
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

fn rename_metadata(
    context: &ProfileContext,
    current_name: &str,
    new_name: &str,
) -> Result<(), String> {
    let mut store = read_metadata_store(context)?;
    if let Some(metadata) = store.profiles.remove(current_name) {
        store.profiles.insert(new_name.to_string(), metadata);
    }
    write_metadata_store(context, &store)
}

fn write_zshrc(context: &ProfileContext, previous: &str, next: &str) -> Result<(), String> {
    if let Some(parent) = context.zshrc_path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    if context.zshrc_path.exists() && previous != next {
        let file_name = context
            .zshrc_path
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("shell-rc");
        let backup_path = context.zshrc_path.with_file_name(format!(
            "{file_name}.rcodexmanager-backup-{}",
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

fn resolve_shell_path_value(body: &str, token: &str, home_dir: &Path) -> Option<PathBuf> {
    let raw_value = extract_shell_value(body, token)?;
    let variables = shell_local_variables(body);
    let resolved_value = resolve_shell_variables(&raw_value, &variables);
    Some(expand_shell_path(&resolved_value, home_dir))
}

fn shell_local_variables(body: &str) -> BTreeMap<String, String> {
    body.lines()
        .filter_map(|line| {
            let assignment = line
                .trim()
                .strip_prefix("local ")
                .or_else(|| line.trim().strip_prefix("export "))
                .unwrap_or_else(|| line.trim());
            let (name, _) = assignment.split_once('=')?;
            if name.is_empty()
                || !name
                    .chars()
                    .all(|char| char.is_ascii_alphanumeric() || char == '_')
            {
                return None;
            }
            let value = extract_shell_value(assignment, "=")?;
            Some((name.to_string(), value))
        })
        .collect()
}

fn resolve_shell_variables(value: &str, variables: &BTreeMap<String, String>) -> String {
    let mut current = value.to_string();
    for _ in 0..8 {
        let Some(variable_start) = current.strip_prefix('$') else {
            break;
        };
        let (variable_name, suffix) = if let Some(rest) = variable_start.strip_prefix('{') {
            let Some(end) = rest.find('}') else {
                break;
            };
            (&rest[..end], &rest[end + 1..])
        } else {
            let end = variable_start
                .find(|char: char| !char.is_ascii_alphanumeric() && char != '_')
                .unwrap_or(variable_start.len());
            (&variable_start[..end], &variable_start[end..])
        };
        let Some(replacement) = variables.get(variable_name) else {
            break;
        };
        current = format!("{replacement}{suffix}");
    }
    current
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

fn rename_shell_function(contents: &str, current_name: &str, new_name: &str) -> Option<String> {
    let existing = find_shell_function(contents, current_name)?;
    let mut lines: Vec<String> = contents.lines().map(ToString::to_string).collect();
    let original = lines.get(existing.start_line)?.clone();
    let leading_len = original.len() - original.trim_start().len();
    let leading = &original[..leading_len];
    let trimmed = original[leading_len..].strip_prefix(&format!("{current_name}()"))?;
    lines[existing.start_line] = format!("{leading}{new_name}(){trimmed}");
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
        "model = \"{}\"\nmodel_reasoning_effort = \"{}\"\n",
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
    fs::write(target_config_path, contents).map_err(|error| {
        format!(
            "failed to write copied config {}: {error}",
            path_string(target_config_path)
        )
    })
}

#[derive(Debug, Clone)]
struct ModelRoutePresetSpec {
    id: ModelRoutePreset,
    label: &'static str,
    description: &'static str,
    default_model: &'static str,
    default_base_url: Option<&'static str>,
    provider_name: &'static str,
    chat_only: bool,
}

#[derive(Debug, Clone)]
struct ModelRouteConfigView {
    model_provider: Option<String>,
    managed_route: bool,
    base_url: Option<String>,
    wire_api: Option<String>,
    has_api_key: bool,
    api_key_source: Option<String>,
    api_key_env: Option<String>,
    route_mode: Option<String>,
    upstream_base_url: Option<String>,
    preset: Option<ModelRoutePreset>,
}

#[derive(Debug, Clone)]
enum ModelRouteApiKeyConfig {
    Inline(String),
    Env(String),
}

impl ModelRouteApiKeyConfig {
    fn actual_value(&self) -> Option<String> {
        match self {
            Self::Inline(value) => normalized_input(Some(value)).map(ToOwned::to_owned),
            Self::Env(key) => std::env::var(key)
                .ok()
                .and_then(|value| normalized_input(Some(&value)).map(ToOwned::to_owned)),
        }
    }

    fn source(&self) -> String {
        match self {
            Self::Inline(_) => "inline".to_string(),
            Self::Env(key) => format!("env:{key}"),
        }
    }
}

#[derive(Debug, Clone)]
struct ModelRoutePlan {
    preview: ModelRoutePreview,
    config_text: String,
}

#[derive(Debug, Clone)]
struct ModelRouteProxyTarget {
    profile_name: String,
    model: String,
    upstream_base_url: String,
    api_key: Option<String>,
}

#[derive(Debug)]
struct SimpleHttpRequest {
    method: String,
    path: String,
    headers: BTreeMap<String, String>,
    body: Vec<u8>,
}

#[derive(Debug, Clone)]
struct ModelRouteToolContext {
    chat_name_to_spec: BTreeMap<String, ModelRouteToolSpec>,
    chat_tools: Vec<Value>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum ModelRouteToolKind {
    Function,
    Custom,
    Namespace,
    ToolSearch,
}

#[derive(Debug, Clone)]
struct ModelRouteToolSpec {
    kind: ModelRouteToolKind,
    name: String,
    namespace: Option<String>,
}

impl Default for ModelRouteToolKind {
    fn default() -> Self {
        Self::Function
    }
}

impl Default for ModelRouteToolContext {
    fn default() -> Self {
        Self {
            chat_name_to_spec: BTreeMap::new(),
            chat_tools: Vec::new(),
        }
    }
}

impl ModelRouteToolContext {
    fn add_chat_tool(&mut self, chat_name: String, spec: ModelRouteToolSpec, chat_tool: Value) {
        if chat_name.trim().is_empty() || self.chat_name_to_spec.contains_key(&chat_name) {
            return;
        }
        self.chat_name_to_spec.insert(chat_name, spec);
        self.chat_tools.push(chat_tool);
    }

    fn lookup_chat_name(&self, chat_name: &str) -> Option<&ModelRouteToolSpec> {
        self.chat_name_to_spec.get(chat_name)
    }

    fn chat_name_for_response_function(&self, name: &str, namespace: Option<&str>) -> String {
        if let Some(namespace) = namespace.filter(|value| !value.trim().is_empty()) {
            if let Some((chat_name, _)) = self
                .chat_name_to_spec
                .iter()
                .find(|(_, spec)| spec.namespace.as_deref() == Some(namespace) && spec.name == name)
            {
                return chat_name.clone();
            }
            return flatten_model_route_namespace_tool_name(namespace, name);
        }
        name.to_string()
    }
}

#[derive(Debug, Clone)]
struct ModelRouteStreamState {
    response_id: String,
    item_id: String,
    model: String,
    created_at: i64,
    started: bool,
    content_started: bool,
    completed: bool,
    message_output_index: Option<usize>,
    next_output_index: usize,
    text: String,
    tool_calls: BTreeMap<usize, ModelRouteStreamToolCall>,
    usage: Option<Value>,
    tool_context: ModelRouteToolContext,
}

#[derive(Debug, Clone, Default)]
struct ModelRouteStreamToolCall {
    call_id: String,
    item_id: String,
    chat_name: String,
    name: String,
    namespace: Option<String>,
    kind: ModelRouteToolKind,
    arguments: String,
    added: bool,
    done: bool,
    output_index: Option<usize>,
}

impl ModelRouteStreamState {
    fn new(fallback_model: &str, tool_context: ModelRouteToolContext) -> Self {
        let timestamp = Utc::now().timestamp();
        Self {
            response_id: format!("resp_rcodexmanager_{timestamp}"),
            item_id: format!("msg_rcodexmanager_{timestamp}"),
            model: fallback_model.to_string(),
            created_at: timestamp,
            started: false,
            content_started: false,
            completed: false,
            message_output_index: None,
            next_output_index: 0,
            text: String::new(),
            tool_calls: BTreeMap::new(),
            usage: None,
            tool_context,
        }
    }

    fn next_output_index(&mut self) -> usize {
        let next = self.next_output_index;
        self.next_output_index += 1;
        next
    }
}

struct ManagedModelRouteProxy {
    stop: Arc<AtomicBool>,
    handle: Option<JoinHandle<()>>,
}

#[derive(Debug, Clone)]
struct ModelRouteProxyProbe {
    service_kind: String,
    service_label: String,
    service_detail: Option<String>,
}

static MODEL_ROUTE_PROXY_SERVICE: OnceLock<Mutex<Option<ManagedModelRouteProxy>>> = OnceLock::new();
static MODEL_ROUTE_PROXY_LAST_DIAGNOSTIC: OnceLock<Mutex<Option<ModelRouteProxyDiagnostic>>> =
    OnceLock::new();
static MODEL_ROUTE_PROXY_RECENT_LOGS: OnceLock<Mutex<VecDeque<ModelRouteProxyLogEntry>>> =
    OnceLock::new();

fn model_route_proxy_service() -> &'static Mutex<Option<ManagedModelRouteProxy>> {
    MODEL_ROUTE_PROXY_SERVICE.get_or_init(|| Mutex::new(None))
}

fn model_route_proxy_last_diagnostic() -> &'static Mutex<Option<ModelRouteProxyDiagnostic>> {
    MODEL_ROUTE_PROXY_LAST_DIAGNOSTIC.get_or_init(|| Mutex::new(None))
}

fn model_route_proxy_recent_logs() -> &'static Mutex<VecDeque<ModelRouteProxyLogEntry>> {
    MODEL_ROUTE_PROXY_RECENT_LOGS.get_or_init(|| Mutex::new(VecDeque::new()))
}

fn model_route_spec(preset: ModelRoutePreset) -> ModelRoutePresetSpec {
    match preset {
        ModelRoutePreset::AliyunQwen => ModelRoutePresetSpec {
            id: preset,
            label: "阿里百炼 / Qwen",
            description:
                "DashScope compatible-mode 原生支持 Responses，可直连；Chat-only 模型再走外部代理。",
            default_model: "qwen3-coder-plus",
            default_base_url: Some("https://dashscope.aliyuncs.com/compatible-mode/v1"),
            provider_name: "rCodexManager Aliyun Qwen",
            chat_only: false,
        },
        ModelRoutePreset::Glm => ModelRoutePresetSpec {
            id: preset,
            label: "GLM / Z.ai",
            description:
                "可接 cc-switch 等成熟 Responses 代理；也可试用内置基础代理转到 GLM Chat 接口",
            default_model: "glm-5.2",
            default_base_url: None,
            provider_name: "rCodexManager GLM",
            chat_only: true,
        },
        ModelRoutePreset::OpenaiChat => ModelRoutePresetSpec {
            id: preset,
            label: "Chat-compatible 上游",
            description:
                "适合 DeepSeek、Kimi、火山、硅基流动等 OpenAI Chat-compatible provider，需要 Responses 代理转换",
            default_model: "chat-model",
            default_base_url: None,
            provider_name: "rCodexManager Chat Route",
            chat_only: true,
        },
        ModelRoutePreset::LocalOpenai => ModelRoutePresetSpec {
            id: preset,
            label: "本地 OpenAI-compatible",
            description:
                "可接 cc-switch 等成熟 Responses 代理；也可试用内置基础代理转到本地 Chat 兼容服务",
            default_model: "local-model",
            default_base_url: None,
            provider_name: "rCodexManager Local OpenAI",
            chat_only: true,
        },
        ModelRoutePreset::CustomResponses => ModelRoutePresetSpec {
            id: preset,
            label: "自定义 Responses",
            description: "直接接入原生 OpenAI Responses-compatible 服务",
            default_model: DEFAULT_MODEL,
            default_base_url: None,
            provider_name: "rCodexManager Custom Responses",
            chat_only: false,
        },
    }
}

fn model_route_presets() -> Vec<ModelRoutePresetInfo> {
    [
        ModelRoutePreset::AliyunQwen,
        ModelRoutePreset::Glm,
        ModelRoutePreset::OpenaiChat,
        ModelRoutePreset::LocalOpenai,
        ModelRoutePreset::CustomResponses,
    ]
    .into_iter()
    .map(|preset| {
        let spec = model_route_spec(preset);
        ModelRoutePresetInfo {
            id: spec.id,
            label: spec.label.to_string(),
            description: spec.description.to_string(),
            default_model: spec.default_model.to_string(),
            default_base_url: spec.default_base_url.map(str::to_string),
            chat_only: spec.chat_only,
            requires_proxy: spec.chat_only,
        }
    })
    .collect()
}

fn model_route_preset_id(preset: ModelRoutePreset) -> &'static str {
    match preset {
        ModelRoutePreset::AliyunQwen => "aliyun-qwen",
        ModelRoutePreset::Glm => "glm",
        ModelRoutePreset::OpenaiChat => "openai-chat",
        ModelRoutePreset::LocalOpenai => "local-openai",
        ModelRoutePreset::CustomResponses => "custom-responses",
    }
}

fn parse_model_route_preset(value: &str) -> Option<ModelRoutePreset> {
    match value.trim() {
        "aliyun-qwen" => Some(ModelRoutePreset::AliyunQwen),
        "glm" => Some(ModelRoutePreset::Glm),
        "openai-chat" => Some(ModelRoutePreset::OpenaiChat),
        "local-openai" => Some(ModelRoutePreset::LocalOpenai),
        "custom-responses" => Some(ModelRoutePreset::CustomResponses),
        _ => None,
    }
}

fn infer_model_route_preset(
    model_provider: Option<&str>,
    base_url: Option<&str>,
    wire_api: Option<&str>,
) -> Option<ModelRoutePreset> {
    if model_provider == Some(MODEL_ROUTE_PROVIDER_ID) {
        return None;
    }
    if wire_api.is_some_and(is_chat_wire_api)
        || base_url.is_some_and(looks_like_chat_completions_url)
    {
        return Some(ModelRoutePreset::OpenaiChat);
    }
    if wire_api.is_some_and(|value| value.eq_ignore_ascii_case("responses")) {
        return Some(ModelRoutePreset::CustomResponses);
    }
    None
}

fn profile_model_route_state(profile: &ProfileInfo) -> ProfileModelRouteState {
    let config_path = PathBuf::from(&profile.config_path);
    let route_config = read_model_route_config_view(&config_path);
    let missing_routed_chat_upstream = route_config.route_mode.as_deref() == Some("chat")
        && route_config.upstream_base_url.is_none();
    let needs_proxy = route_config
        .wire_api
        .as_deref()
        .is_some_and(is_chat_wire_api)
        || route_config
            .base_url
            .as_deref()
            .is_some_and(looks_like_chat_completions_url)
        || missing_routed_chat_upstream;
    let routed = route_config.model_provider.is_some() || route_config.base_url.is_some();
    let read_only_reason = if profile.is_default {
        Some("默认 profile 只读".to_string())
    } else if profile.is_running {
        Some("正在运行，先停止再修改".to_string())
    } else {
        None
    };
    let (route_status, route_status_label) = if read_only_reason.is_some() {
        ("read-only", "不可修改")
    } else if !profile.config_exists {
        ("missing", "配置缺失")
    } else if route_config.model_provider.as_deref() == Some(MODEL_ROUTE_PROVIDER_ID)
        && missing_routed_chat_upstream
    {
        ("needs-proxy", "需要外部代理")
    } else if route_config.model_provider.as_deref() == Some(MODEL_ROUTE_PROVIDER_ID) {
        ("routed", "已配置路由")
    } else if needs_proxy {
        ("needs-proxy", "需要外部代理")
    } else if routed {
        ("routed", "已配置路由")
    } else {
        ("official", "官方默认")
    };
    let needs_attention = matches!(route_status, "missing" | "needs-proxy");
    let can_apply = read_only_reason.is_none();
    let can_restore = can_apply && routed;

    ProfileModelRouteState {
        profile_name: profile.name.clone(),
        profile_label: profile
            .alias
            .clone()
            .unwrap_or_else(|| profile.name.clone()),
        profile_category: profile.category.clone(),
        codex_home: profile.codex_home.clone(),
        config_path: profile.config_path.clone(),
        config_exists: profile.config_exists,
        is_default: profile.is_default,
        is_running: profile.is_running,
        model: profile.model.clone(),
        reasoning_effort: profile.reasoning_effort.clone(),
        model_provider: route_config.model_provider,
        base_url: route_config.base_url,
        wire_api: route_config.wire_api,
        has_api_key: route_config.has_api_key,
        api_key_source: route_config.api_key_source,
        api_key_env: route_config.api_key_env,
        route_mode: route_config.route_mode,
        upstream_base_url: route_config.upstream_base_url,
        preset: route_config.preset,
        managed_route: route_config.managed_route,
        route_status: route_status.to_string(),
        route_status_label: route_status_label.to_string(),
        read_only_reason,
        routed,
        needs_proxy,
        needs_attention,
        can_apply,
        can_restore,
    }
}

fn read_model_route_config_view(config_path: &Path) -> ModelRouteConfigView {
    let empty = ModelRouteConfigView {
        model_provider: None,
        managed_route: false,
        base_url: None,
        wire_api: None,
        has_api_key: false,
        api_key_source: None,
        api_key_env: None,
        route_mode: None,
        upstream_base_url: None,
        preset: None,
    };
    let Some(table) = read_toml_table(config_path).ok() else {
        return empty;
    };
    let model_provider = table_string(&table, "model_provider");
    let managed_route = model_provider.as_deref() == Some(MODEL_ROUTE_PROVIDER_ID);
    let provider_table = model_provider
        .as_deref()
        .and_then(|provider_id| nested_toml_table(&table, &["model_providers", provider_id]));
    let base_url = provider_table
        .and_then(|provider| table_string(provider, "base_url"))
        .or_else(|| table_string(&table, "base_url"));
    let wire_api = provider_table
        .and_then(|provider| table_string(provider, "wire_api"))
        .or_else(|| table_string(&table, "wire_api"));
    let inline_api_key = provider_table
        .and_then(|provider| table_string(provider, "experimental_bearer_token"))
        .or_else(|| table_string(&table, "experimental_bearer_token"))
        .filter(|value| !value.trim().is_empty());
    let api_key_env = provider_table
        .and_then(|provider| table_string(provider, "env_key"))
        .or_else(|| table_string(&table, "env_key"))
        .filter(|value| !value.trim().is_empty());
    let api_key_source = inline_api_key
        .as_ref()
        .map(|_| "inline".to_string())
        .or_else(|| api_key_env.as_deref().map(|key| format!("env:{key}")));
    let stored_preset = provider_table
        .and_then(|provider| table_string(provider, MODEL_ROUTE_PRESET_KEY))
        .and_then(|value| parse_model_route_preset(&value));
    let preset = stored_preset.or_else(|| {
        infer_model_route_preset(
            model_provider.as_deref(),
            base_url.as_deref(),
            wire_api.as_deref(),
        )
    });
    let route_mode =
        provider_table.and_then(|provider| table_string(provider, MODEL_ROUTE_MODE_KEY));
    let upstream_base_url = provider_table
        .and_then(|provider| table_string(provider, MODEL_ROUTE_UPSTREAM_BASE_URL_KEY));

    ModelRouteConfigView {
        managed_route,
        has_api_key: inline_api_key.is_some() || api_key_env.is_some(),
        api_key_source,
        api_key_env,
        preset,
        model_provider,
        base_url,
        wire_api,
        route_mode,
        upstream_base_url,
    }
}

fn build_model_route_plan(
    profile: &ProfileInfo,
    input: &PreviewModelRouteInput,
    redacted: bool,
) -> Result<ModelRoutePlan, String> {
    let spec = model_route_spec(input.preset);
    let model = normalized_input(Some(input.model.as_str()))
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| "model is required".to_string())?
        .to_string();
    let reasoning_effort = normalized_input(input.reasoning_effort.as_deref())
        .or(profile.reasoning_effort.as_deref())
        .unwrap_or(DEFAULT_REASONING_EFFORT)
        .to_string();
    let base_url = if spec.chat_only {
        normalized_input(input.proxy_base_url.as_deref())
            .ok_or_else(|| "Chat-only preset requires an external proxy base URL".to_string())?
            .trim_end_matches('/')
            .to_string()
    } else {
        normalized_input(input.upstream_base_url.as_deref())
            .or_else(|| normalized_input(input.proxy_base_url.as_deref()))
            .or(spec.default_base_url)
            .ok_or_else(|| "Responses preset requires an upstream base URL".to_string())?
            .trim_end_matches('/')
            .to_string()
    };
    if spec.chat_only && looks_like_chat_completions_url(&base_url) {
        return Err(
            "Chat-only preset must point Codex to an external Responses proxy, not /chat/completions"
                .to_string(),
        );
    }
    let upstream_base_url = normalized_input(input.upstream_base_url.as_deref())
        .map(|value| value.trim_end_matches('/').to_string());
    if spec.chat_only && is_local_model_route_proxy_url(&base_url) && upstream_base_url.is_none() {
        return Err("built-in model route proxy requires the upstream Chat base URL".to_string());
    }
    let route_mode = if spec.chat_only { "chat" } else { "responses" };

    let (api_key_source, api_key_for_config) = resolve_model_route_api_key(
        input.api_key.as_deref(),
        input.api_key_env.as_deref(),
        redacted,
    )?;
    let config_text = build_model_route_config_text(
        &PathBuf::from(&profile.config_path),
        &model,
        &reasoning_effort,
        spec.provider_name,
        &base_url,
        route_mode,
        spec.id,
        upstream_base_url.as_deref(),
        api_key_for_config.as_ref(),
    )?;
    let warnings = model_route_warnings(profile, spec.chat_only, &base_url);

    Ok(ModelRoutePlan {
        preview: ModelRoutePreview {
            generated_at: now_iso(),
            profile_name: profile.name.clone(),
            preset: input.preset,
            preset_label: spec.label.to_string(),
            provider_id: MODEL_ROUTE_PROVIDER_ID.to_string(),
            provider_name: spec.provider_name.to_string(),
            model,
            reasoning_effort,
            base_url,
            wire_api: "responses".to_string(),
            chat_only: spec.chat_only,
            uses_proxy: spec.chat_only,
            api_key_source,
            config_preview: config_text.clone(),
            warnings,
        },
        config_text,
    })
}

fn model_route_warnings(profile: &ProfileInfo, chat_only: bool, base_url: &str) -> Vec<String> {
    let mut warnings = Vec::new();
    if profile.is_default {
        warnings.push("默认 codex 受保护，不能应用。".to_string());
    }
    if profile.is_running {
        warnings.push("目标 profile 正在运行，先停止再应用。".to_string());
    }
    if chat_only {
        if is_local_model_route_proxy_url(base_url) {
            warnings.push(
                "内置代理当前支持基础文本、tool_search、function_call、custom tool、namespace tool 的流式和非流式 Chat 转换；复杂 provider 兼容建议继续使用 cc-switch。".to_string(),
            );
        } else {
            warnings
                .push("该预设需要外部 Responses 代理；推荐优先接入成熟的 cc-switch。".to_string());
        }
    }
    if base_url.starts_with("http://") && !base_url.starts_with("http://127.0.0.1") {
        warnings.push("HTTP 明文地址建议仅用于本机代理。".to_string());
    }
    warnings
}

fn has_sensitive_model_route_input(input: &ApplyModelRouteInput) -> bool {
    normalized_input(input.api_key.as_deref()).is_some()
        || normalized_input(input.api_key_env.as_deref()).is_some()
}

fn resolve_model_route_api_key(
    api_key: Option<&str>,
    api_key_env: Option<&str>,
    redacted: bool,
) -> Result<(Option<String>, Option<ModelRouteApiKeyConfig>), String> {
    if let Some(value) = normalized_input(api_key) {
        let config = ModelRouteApiKeyConfig::Inline(if redacted {
            "••••••••".to_string()
        } else {
            value.to_string()
        });
        return Ok((Some(config.source()), Some(config)));
    }
    if let Some(env_key) = normalized_input(api_key_env) {
        if !redacted {
            let value = std::env::var(&env_key)
                .map_err(|_| format!("environment variable {env_key} is not set"))?;
            if value.trim().is_empty() {
                return Err(format!("environment variable {env_key} is empty"));
            }
        }
        let config = ModelRouteApiKeyConfig::Env(env_key.to_string());
        return Ok((Some(config.source()), Some(config)));
    }
    Ok((None, None))
}

fn build_model_route_config_text(
    config_path: &Path,
    model: &str,
    reasoning_effort: &str,
    provider_name: &str,
    base_url: &str,
    route_mode: &str,
    preset: ModelRoutePreset,
    upstream_base_url: Option<&str>,
    api_key: Option<&ModelRouteApiKeyConfig>,
) -> Result<String, String> {
    let mut table = read_toml_table_or_empty(config_path)?;
    table.insert("model".to_string(), toml::Value::String(model.to_string()));
    table.insert(
        "model_reasoning_effort".to_string(),
        toml::Value::String(reasoning_effort.to_string()),
    );
    table.insert(
        "model_provider".to_string(),
        toml::Value::String(MODEL_ROUTE_PROVIDER_ID.to_string()),
    );

    let mut provider_table = toml::value::Table::new();
    provider_table.insert(
        "name".to_string(),
        toml::Value::String(provider_name.to_string()),
    );
    provider_table.insert(
        "base_url".to_string(),
        toml::Value::String(base_url.to_string()),
    );
    provider_table.insert(
        "wire_api".to_string(),
        toml::Value::String("responses".to_string()),
    );
    provider_table.insert(
        MODEL_ROUTE_MODE_KEY.to_string(),
        toml::Value::String(route_mode.to_string()),
    );
    provider_table.insert(
        MODEL_ROUTE_PRESET_KEY.to_string(),
        toml::Value::String(model_route_preset_id(preset).to_string()),
    );
    if let Some(upstream_base_url) = upstream_base_url.filter(|value| !value.trim().is_empty()) {
        provider_table.insert(
            MODEL_ROUTE_UPSTREAM_BASE_URL_KEY.to_string(),
            toml::Value::String(upstream_base_url.to_string()),
        );
    }
    match api_key {
        Some(ModelRouteApiKeyConfig::Inline(value)) if !value.trim().is_empty() => {
            provider_table.insert(
                "experimental_bearer_token".to_string(),
                toml::Value::String(value.to_string()),
            );
        }
        Some(ModelRouteApiKeyConfig::Env(env_key)) if !env_key.trim().is_empty() => {
            provider_table.insert(
                "env_key".to_string(),
                toml::Value::String(env_key.to_string()),
            );
        }
        _ => {}
    }
    ensure_table(&mut table, "model_providers")?.insert(
        MODEL_ROUTE_PROVIDER_ID.to_string(),
        toml::Value::Table(provider_table),
    );

    toml::to_string_pretty(&toml::Value::Table(table)).map_err(|error| error.to_string())
}

fn restore_model_route_config_text(
    config_path: &Path,
    profile: &ProfileInfo,
) -> Result<String, String> {
    let mut table = read_toml_table_or_empty(config_path)?;
    if table_string(&table, "model_provider").as_deref() == Some(MODEL_ROUTE_PROVIDER_ID) {
        table.remove("model_provider");
    }
    table.remove("experimental_bearer_token");
    if let Some(providers) = table
        .get_mut("model_providers")
        .and_then(toml::Value::as_table_mut)
    {
        providers.remove(MODEL_ROUTE_PROVIDER_ID);
    }
    if table
        .get("model_providers")
        .and_then(toml::Value::as_table)
        .is_some_and(|providers| providers.is_empty())
    {
        table.remove("model_providers");
    }
    if table_string(&table, "model").is_none() {
        table.insert(
            "model".to_string(),
            toml::Value::String(
                profile
                    .model
                    .clone()
                    .unwrap_or_else(|| DEFAULT_MODEL.to_string()),
            ),
        );
    }
    if table_string(&table, "model_reasoning_effort").is_none() {
        table.insert(
            "model_reasoning_effort".to_string(),
            toml::Value::String(
                profile
                    .reasoning_effort
                    .clone()
                    .unwrap_or_else(|| DEFAULT_REASONING_EFFORT.to_string()),
            ),
        );
    }
    toml::to_string_pretty(&toml::Value::Table(table)).map_err(|error| error.to_string())
}

fn is_local_model_route_proxy_url(value: &str) -> bool {
    let normalized = value.trim().trim_end_matches('/').to_ascii_lowercase();
    normalized == format!("http://{MODEL_ROUTE_PROXY_HOST}:{MODEL_ROUTE_PROXY_PORT}/v1")
        || normalized == format!("http://localhost:{MODEL_ROUTE_PROXY_PORT}/v1")
        || normalized == format!("http://{MODEL_ROUTE_PROXY_HOST}:{MODEL_ROUTE_PROXY_PORT}")
        || normalized == format!("http://localhost:{MODEL_ROUTE_PROXY_PORT}")
}

fn model_route_responses_endpoint(base_url: &str) -> String {
    let base = base_url.trim().trim_end_matches('/');
    if base.ends_with("/responses") {
        base.to_string()
    } else {
        format!("{base}/responses")
    }
}

fn read_model_route_api_key_from_config(
    config_path: &Path,
    model_provider: Option<&str>,
) -> Option<String> {
    let table = read_toml_table(config_path).ok()?;
    let provider_id = model_provider
        .filter(|value| !value.trim().is_empty())
        .map(ToOwned::to_owned)
        .or_else(|| table_string(&table, "model_provider"))?;
    let provider_table = nested_toml_table(&table, &["model_providers", &provider_id]);
    let inline_key = provider_table
        .and_then(|provider| table_string(provider, "experimental_bearer_token"))
        .or_else(|| table_string(&table, "experimental_bearer_token"))
        .and_then(|value| normalized_input(Some(value.as_str())).map(ToOwned::to_owned));
    if inline_key.is_some() {
        return inline_key;
    }
    let env_key = provider_table
        .and_then(|provider| table_string(provider, "env_key"))
        .or_else(|| table_string(&table, "env_key"))?;
    std::env::var(env_key)
        .ok()
        .and_then(|value| normalized_input(Some(&value)).map(ToOwned::to_owned))
}

fn looks_like_responses_success(value: &Value) -> bool {
    value.get("object").and_then(Value::as_str) == Some("response")
        || value.get("output").is_some_and(Value::is_array)
}

fn model_route_proxy_check_result(
    profile_name: &str,
    model: &str,
    base_url: Option<String>,
    endpoint: Option<String>,
    ok: bool,
    status: &str,
    status_label: &str,
    message: &str,
    http_status: Option<u16>,
    latency_ms: u128,
    diagnostic: Option<ModelRouteProxyDiagnostic>,
) -> ModelRouteProxyCheckResult {
    record_model_route_proxy_log(
        "self-check",
        Some(profile_name),
        Some(model),
        endpoint.as_deref(),
        ok,
        status,
        status_label,
        message,
        http_status,
        latency_ms,
        diagnostic.as_ref().map(|item| item.code.as_str()),
    );
    ModelRouteProxyCheckResult {
        generated_at: now_iso(),
        profile_name: profile_name.to_string(),
        model: model.to_string(),
        base_url,
        endpoint,
        ok,
        status: status.to_string(),
        status_label: status_label.to_string(),
        message: message.to_string(),
        http_status,
        latency_ms,
        diagnostic,
        proxy: read_model_route_proxy_status(),
    }
}

fn find_model_route_proxy_target(request_model: &str) -> Result<ModelRouteProxyTarget, String> {
    let context = ProfileContext::from_options(None, None)?;
    let profiles = list_profiles(&context)?.profiles;
    let mut candidates = Vec::new();

    for profile in profiles {
        let config_path = PathBuf::from(&profile.config_path);
        if !config_path.exists() {
            continue;
        }
        let table = match read_toml_table(&config_path) {
            Ok(table) => table,
            Err(_) => continue,
        };
        if table_string(&table, "model_provider").as_deref() != Some(MODEL_ROUTE_PROVIDER_ID) {
            continue;
        }
        let Some(model) = table_string(&table, "model") else {
            continue;
        };
        if !request_model.trim().is_empty() && model != request_model {
            continue;
        }
        let Some(provider_table) = table
            .get("model_providers")
            .and_then(toml::Value::as_table)
            .and_then(|providers| providers.get(MODEL_ROUTE_PROVIDER_ID))
            .and_then(toml::Value::as_table)
        else {
            continue;
        };
        if table_string(provider_table, "base_url")
            .as_deref()
            .is_none_or(|base_url| !is_local_model_route_proxy_url(base_url))
        {
            continue;
        }
        if table_string(provider_table, MODEL_ROUTE_MODE_KEY).as_deref() != Some("chat") {
            continue;
        }
        let Some(upstream_base_url) =
            table_string(provider_table, MODEL_ROUTE_UPSTREAM_BASE_URL_KEY)
                .and_then(|value| normalized_input(Some(value.as_str())).map(ToOwned::to_owned))
        else {
            continue;
        };
        let api_key = table_string(provider_table, "experimental_bearer_token")
            .and_then(|value| normalized_input(Some(value.as_str())).map(ToOwned::to_owned))
            .or_else(|| {
                table_string(provider_table, "env_key").and_then(|env_key| {
                    std::env::var(env_key)
                        .ok()
                        .and_then(|value| normalized_input(Some(&value)).map(ToOwned::to_owned))
                })
            });
        candidates.push(ModelRouteProxyTarget {
            profile_name: profile.name,
            model,
            upstream_base_url: upstream_base_url.trim_end_matches('/').to_string(),
            api_key,
        });
    }

    match candidates.len() {
        0 => {
            if request_model.trim().is_empty() {
                Err("no rCodexManager Chat route is configured for the built-in proxy".to_string())
            } else {
                Err(format!(
                    "no rCodexManager Chat route is configured for model {request_model}"
                ))
            }
        }
        1 => Ok(candidates.remove(0)),
        _ => Err(format!(
            "multiple rCodexManager Chat routes match model {request_model}; use a unique model name per routed profile"
        )),
    }
}

fn chat_completions_endpoint(base_url: &str) -> String {
    let base = base_url.trim().trim_end_matches('/');
    if base.ends_with("/chat/completions") {
        base.to_string()
    } else {
        format!("{base}/chat/completions")
    }
}

#[cfg(test)]
fn responses_to_chat_completions_minimal(
    response_body: &Value,
    upstream_model: &str,
) -> Result<Value, String> {
    let tool_context = build_model_route_tool_context_from_request(response_body);
    responses_to_chat_completions_with_context(response_body, upstream_model, &tool_context)
}

fn responses_to_chat_completions_with_context(
    response_body: &Value,
    upstream_model: &str,
    tool_context: &ModelRouteToolContext,
) -> Result<Value, String> {
    let mut messages = Vec::new();
    if let Some(instructions) = response_body.get("instructions").and_then(value_to_text) {
        if !instructions.trim().is_empty() {
            messages.push(serde_json::json!({
                "role": "system",
                "content": instructions,
            }));
        }
    }

    let input = response_body
        .get("input")
        .ok_or_else(|| "Responses request is missing input".to_string())?;
    append_responses_input_as_chat_messages(input, &mut messages, tool_context);
    if messages.is_empty() {
        return Err("Responses input did not contain any text message content".to_string());
    }

    let mut body = Map::new();
    body.insert(
        "model".to_string(),
        Value::String(if upstream_model.trim().is_empty() {
            response_body
                .get("model")
                .and_then(Value::as_str)
                .unwrap_or_default()
                .to_string()
        } else {
            upstream_model.to_string()
        }),
    );
    body.insert("messages".to_string(), Value::Array(messages));
    let stream = response_body
        .get("stream")
        .and_then(Value::as_bool)
        .unwrap_or(false);
    body.insert("stream".to_string(), Value::Bool(stream));
    if stream {
        let mut stream_options = response_body
            .get("stream_options")
            .and_then(Value::as_object)
            .cloned()
            .unwrap_or_default();
        stream_options.insert("include_usage".to_string(), Value::Bool(true));
        body.insert("stream_options".to_string(), Value::Object(stream_options));
    }

    for key in [
        "temperature",
        "top_p",
        "presence_penalty",
        "frequency_penalty",
    ] {
        if let Some(value) = response_body.get(key) {
            body.insert(key.to_string(), value.clone());
        }
    }
    if let Some(value) = response_body.get("max_output_tokens") {
        body.insert("max_tokens".to_string(), value.clone());
    } else if let Some(value) = response_body.get("max_tokens") {
        body.insert("max_tokens".to_string(), value.clone());
    } else if let Some(value) = response_body.get("max_completion_tokens") {
        body.insert("max_completion_tokens".to_string(), value.clone());
    }
    if !tool_context.chat_tools.is_empty() {
        body.insert(
            "tools".to_string(),
            Value::Array(tool_context.chat_tools.clone()),
        );
    }
    if let Some(tool_choice) = response_body.get("tool_choice") {
        body.insert(
            "tool_choice".to_string(),
            responses_tool_choice_to_chat_tool_choice(tool_choice, tool_context),
        );
    }

    Ok(Value::Object(body))
}

fn build_model_route_tool_context_from_request(response_body: &Value) -> ModelRouteToolContext {
    let mut context = ModelRouteToolContext::default();
    if let Some(tools) = response_body.get("tools").and_then(Value::as_array) {
        add_model_route_response_tools_to_context(tools, &mut context);
    }
    if let Some(input) = response_body.get("input") {
        collect_model_route_tools_from_response_input(input, &mut context);
    }
    context
}

fn collect_model_route_tools_from_response_input(
    value: &Value,
    context: &mut ModelRouteToolContext,
) {
    match value {
        Value::Array(items) => {
            for item in items {
                collect_model_route_tools_from_response_input(item, context);
            }
        }
        Value::Object(object) => {
            if object.get("type").and_then(Value::as_str) == Some("tool_search_output") {
                if let Some(tools) = object.get("tools").and_then(Value::as_array) {
                    add_model_route_response_tools_to_context(tools, context);
                }
            }
            if let Some(content) = object.get("content") {
                collect_model_route_tools_from_response_input(content, context);
            }
        }
        _ => {}
    }
}

fn add_model_route_response_tools_to_context(tools: &[Value], context: &mut ModelRouteToolContext) {
    for tool in tools {
        add_model_route_response_tool_to_context(tool, None, context);
    }
}

fn add_model_route_response_tool_to_context(
    tool: &Value,
    namespace: Option<&str>,
    context: &mut ModelRouteToolContext,
) {
    match tool {
        Value::String(name) if namespace.is_none() => {
            let custom = serde_json::json!({
                "type": "custom",
                "name": name,
            });
            add_model_route_custom_tool_to_context(&custom, context);
        }
        Value::Object(_) => match tool.get("type").and_then(Value::as_str) {
            Some("function") => add_model_route_function_tool_to_context(tool, namespace, context),
            Some("custom") if namespace.is_none() => {
                add_model_route_custom_tool_to_context(tool, context)
            }
            Some("tool_search") if namespace.is_none() => {
                add_model_route_tool_search_tool_to_context(context)
            }
            Some("namespace") if namespace.is_none() => {
                add_model_route_namespace_tool_to_context(tool, context)
            }
            _ => {}
        },
        _ => {}
    }
}

fn add_model_route_function_tool_to_context(
    tool: &Value,
    namespace: Option<&str>,
    context: &mut ModelRouteToolContext,
) {
    let Some(original_name) = response_tool_name(tool) else {
        return;
    };
    let chat_name = namespace
        .map(|namespace| flatten_model_route_namespace_tool_name(namespace, &original_name))
        .unwrap_or_else(|| original_name.clone());
    let Some(chat_tool) = response_function_tool_to_chat_tool(tool, &chat_name) else {
        return;
    };
    context.add_chat_tool(
        chat_name,
        ModelRouteToolSpec {
            kind: if namespace.is_some() {
                ModelRouteToolKind::Namespace
            } else {
                ModelRouteToolKind::Function
            },
            name: original_name,
            namespace: namespace.map(ToOwned::to_owned),
        },
        chat_tool,
    );
}

fn add_model_route_custom_tool_to_context(tool: &Value, context: &mut ModelRouteToolContext) {
    let Some(name) = response_tool_name(tool) else {
        return;
    };
    let description = tool
        .get("description")
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .unwrap_or("Free-form custom tool input. Put the full tool input into the input field.");
    let chat_tool = serde_json::json!({
        "type": "function",
        "function": {
            "name": name,
            "description": description,
            "parameters": {
                "type": "object",
                "properties": {
                    MODEL_ROUTE_CUSTOM_TOOL_INPUT_FIELD: {
                        "type": "string",
                        "description": "Complete free-form input for this custom Codex tool."
                    }
                },
                "required": [MODEL_ROUTE_CUSTOM_TOOL_INPUT_FIELD]
            }
        }
    });
    context.add_chat_tool(
        name.clone(),
        ModelRouteToolSpec {
            kind: ModelRouteToolKind::Custom,
            name,
            namespace: None,
        },
        chat_tool,
    );
}

fn add_model_route_tool_search_tool_to_context(context: &mut ModelRouteToolContext) {
    let chat_tool = serde_json::json!({
        "type": "function",
        "function": {
            "name": MODEL_ROUTE_TOOL_SEARCH_PROXY_NAME,
            "description": "Search and load Codex tools, plugins, connectors, and MCP namespaces for the current task.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Search query for tools or connectors to load."
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Maximum number of tool groups to return."
                    }
                },
                "required": ["query"]
            }
        }
    });
    context.add_chat_tool(
        MODEL_ROUTE_TOOL_SEARCH_PROXY_NAME.to_string(),
        ModelRouteToolSpec {
            kind: ModelRouteToolKind::ToolSearch,
            name: MODEL_ROUTE_TOOL_SEARCH_PROXY_NAME.to_string(),
            namespace: None,
        },
        chat_tool,
    );
}

fn add_model_route_namespace_tool_to_context(tool: &Value, context: &mut ModelRouteToolContext) {
    let Some(namespace) = tool.get("name").and_then(Value::as_str) else {
        return;
    };
    let Some(children) = tool
        .get("tools")
        .or_else(|| tool.get("children"))
        .and_then(Value::as_array)
    else {
        return;
    };
    for child in children {
        add_model_route_response_tool_to_context(child, Some(namespace), context);
    }
}

fn append_responses_input_as_chat_messages(
    input: &Value,
    messages: &mut Vec<Value>,
    tool_context: &ModelRouteToolContext,
) {
    let mut pending_tool_calls = Vec::new();
    match input {
        Value::String(text) => {
            flush_pending_chat_tool_calls(messages, &mut pending_tool_calls);
            push_chat_message(messages, "user", text);
        }
        Value::Array(items) => {
            for item in items {
                append_responses_item_as_chat_message(
                    item,
                    messages,
                    tool_context,
                    &mut pending_tool_calls,
                );
            }
        }
        Value::Object(_) => append_responses_item_as_chat_message(
            input,
            messages,
            tool_context,
            &mut pending_tool_calls,
        ),
        _ => {}
    }
    flush_pending_chat_tool_calls(messages, &mut pending_tool_calls);
}

fn append_responses_item_as_chat_message(
    item: &Value,
    messages: &mut Vec<Value>,
    tool_context: &ModelRouteToolContext,
    pending_tool_calls: &mut Vec<Value>,
) {
    let Some(object) = item.as_object() else {
        return;
    };
    let item_type = object
        .get("type")
        .and_then(Value::as_str)
        .unwrap_or_default();
    match item_type {
        "function_call" => {
            pending_tool_calls.push(responses_function_call_to_chat_tool_call(
                item,
                tool_context,
            ));
        }
        "custom_tool_call" => {
            pending_tool_calls.push(responses_custom_tool_call_to_chat_tool_call(item));
        }
        "tool_search_call" => {
            pending_tool_calls.push(responses_tool_search_call_to_chat_tool_call(item));
        }
        "message" => {
            flush_pending_chat_tool_calls(messages, pending_tool_calls);
            let role = object
                .get("role")
                .and_then(Value::as_str)
                .unwrap_or("user")
                .to_string();
            let content = object
                .get("content")
                .and_then(value_to_text)
                .unwrap_or_default();
            push_chat_message(messages, &role, &content);
        }
        "input_text" => {
            flush_pending_chat_tool_calls(messages, pending_tool_calls);
            if let Some(text) = object.get("text").and_then(Value::as_str) {
                push_chat_message(messages, "user", text);
            }
        }
        "output_text" => {
            flush_pending_chat_tool_calls(messages, pending_tool_calls);
            if let Some(text) = object.get("text").and_then(Value::as_str) {
                push_chat_message(messages, "assistant", text);
            }
        }
        "function_call_output" | "custom_tool_call_output" | "tool_search_output" => {
            flush_pending_chat_tool_calls(messages, pending_tool_calls);
            let content = response_tool_output_content(item, item_type);
            let call_id = object.get("call_id").and_then(Value::as_str).unwrap_or("");
            if !content.trim().is_empty() || !call_id.is_empty() {
                let mut message = Map::new();
                message.insert("role".to_string(), Value::String("tool".to_string()));
                message.insert("content".to_string(), Value::String(content));
                if !call_id.is_empty() {
                    message.insert(
                        "tool_call_id".to_string(),
                        Value::String(call_id.to_string()),
                    );
                }
                messages.push(Value::Object(message));
            }
        }
        "reasoning" => {}
        _ => {
            flush_pending_chat_tool_calls(messages, pending_tool_calls);
            if let Some(text) = item.get("text").and_then(Value::as_str) {
                push_chat_message(messages, "user", text);
            } else if let Some(content) = item.get("content").and_then(value_to_text) {
                push_chat_message(messages, "user", &content);
            }
        }
    }
}

fn flush_pending_chat_tool_calls(messages: &mut Vec<Value>, pending_tool_calls: &mut Vec<Value>) {
    if pending_tool_calls.is_empty() {
        return;
    }
    messages.push(serde_json::json!({
        "role": "assistant",
        "content": null,
        "tool_calls": std::mem::take(pending_tool_calls),
    }));
}

fn responses_function_call_to_chat_tool_call(
    item: &Value,
    tool_context: &ModelRouteToolContext,
) -> Value {
    let call_id = item
        .get("call_id")
        .or_else(|| item.get("id"))
        .and_then(Value::as_str)
        .unwrap_or_default();
    let name = item.get("name").and_then(Value::as_str).unwrap_or_default();
    let namespace = item.get("namespace").and_then(Value::as_str);
    let chat_name = tool_context.chat_name_for_response_function(name, namespace);
    let arguments = response_tool_arguments_string(item.get("arguments"));

    serde_json::json!({
        "id": call_id,
        "type": "function",
        "function": {
            "name": chat_name,
            "arguments": arguments,
        }
    })
}

fn responses_custom_tool_call_to_chat_tool_call(item: &Value) -> Value {
    let call_id = item
        .get("call_id")
        .or_else(|| item.get("id"))
        .and_then(Value::as_str)
        .unwrap_or_default();
    let name = item.get("name").and_then(Value::as_str).unwrap_or_default();
    let input = item
        .get("input")
        .cloned()
        .unwrap_or_else(|| Value::String(String::new()));

    serde_json::json!({
        "id": call_id,
        "type": "function",
        "function": {
            "name": name,
            "arguments": serde_json::json!({
                MODEL_ROUTE_CUSTOM_TOOL_INPUT_FIELD: input,
            }).to_string(),
        }
    })
}

fn responses_tool_search_call_to_chat_tool_call(item: &Value) -> Value {
    let call_id = item
        .get("call_id")
        .or_else(|| item.get("id"))
        .and_then(Value::as_str)
        .unwrap_or_default();
    let arguments = response_tool_arguments_string(item.get("arguments"));

    serde_json::json!({
        "id": call_id,
        "type": "function",
        "function": {
            "name": MODEL_ROUTE_TOOL_SEARCH_PROXY_NAME,
            "arguments": arguments,
        }
    })
}

fn response_tool_arguments_string(value: Option<&Value>) -> String {
    match value {
        Some(Value::String(text)) if !text.trim().is_empty() => text.to_string(),
        Some(Value::String(_)) | None => "{}".to_string(),
        Some(value) => value.to_string(),
    }
}

fn response_tool_output_content(item: &Value, item_type: &str) -> String {
    if item_type == "custom_tool_call_output" || item_type == "tool_search_output" {
        return item.to_string();
    }
    match item.get("output").or_else(|| item.get("content")) {
        Some(Value::String(text)) => canonicalize_json_string_if_parseable(text),
        Some(value) => value.to_string(),
        None => String::new(),
    }
}

fn canonicalize_json_string_if_parseable(text: &str) -> String {
    serde_json::from_str::<Value>(text)
        .map(|value| value.to_string())
        .unwrap_or_else(|_| text.to_string())
}

fn push_chat_message(messages: &mut Vec<Value>, role: &str, content: &str) {
    if content.trim().is_empty() {
        return;
    }
    messages.push(serde_json::json!({
        "role": role,
        "content": content,
    }));
}

fn value_to_text(value: &Value) -> Option<String> {
    match value {
        Value::String(text) => Some(text.clone()),
        Value::Array(parts) => {
            let text = parts
                .iter()
                .filter_map(|part| match part {
                    Value::String(text) => Some(text.clone()),
                    Value::Object(object) => object
                        .get("text")
                        .and_then(Value::as_str)
                        .or_else(|| object.get("content").and_then(Value::as_str))
                        .map(ToOwned::to_owned),
                    _ => None,
                })
                .collect::<Vec<_>>()
                .join("\n");
            Some(text)
        }
        Value::Object(object) => object
            .get("text")
            .and_then(Value::as_str)
            .or_else(|| object.get("content").and_then(Value::as_str))
            .map(ToOwned::to_owned),
        _ => None,
    }
}

fn response_tool_name(tool: &Value) -> Option<String> {
    tool.get("function")
        .and_then(|function| function.get("name"))
        .or_else(|| tool.get("name"))
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
}

fn response_function_tool_to_chat_tool(tool: &Value, chat_name: &str) -> Option<Value> {
    let object = tool.as_object()?;
    let mut function = Map::new();
    function.insert("name".to_string(), Value::String(chat_name.to_string()));
    if let Some(description) = object.get("description").and_then(Value::as_str) {
        function.insert(
            "description".to_string(),
            Value::String(description.to_string()),
        );
    }
    function.insert(
        "parameters".to_string(),
        object
            .get("parameters")
            .or_else(|| object.get("input_schema"))
            .cloned()
            .unwrap_or_else(|| serde_json::json!({ "type": "object", "properties": {} })),
    );
    Some(serde_json::json!({
        "type": "function",
        "function": Value::Object(function),
    }))
}

fn responses_tool_choice_to_chat_tool_choice(
    tool_choice: &Value,
    tool_context: &ModelRouteToolContext,
) -> Value {
    match tool_choice {
        Value::String(value) if value == "required" => Value::String("required".to_string()),
        Value::String(value) if value == "none" => Value::String("none".to_string()),
        Value::String(_) => Value::String("auto".to_string()),
        Value::Object(object) => {
            if object.get("type").and_then(Value::as_str) == Some("tool_search") {
                serde_json::json!({
                    "type": "function",
                    "function": {
                        "name": MODEL_ROUTE_TOOL_SEARCH_PROXY_NAME,
                    }
                })
            } else if let Some(name) = object.get("name").and_then(Value::as_str) {
                let chat_name = tool_context.chat_name_for_response_function(
                    name,
                    object.get("namespace").and_then(Value::as_str),
                );
                serde_json::json!({
                    "type": "function",
                    "function": {
                        "name": chat_name,
                    }
                })
            } else {
                Value::String("auto".to_string())
            }
        }
        _ => Value::String("auto".to_string()),
    }
}

fn flatten_model_route_namespace_tool_name(namespace: &str, name: &str) -> String {
    let full_name = format!("{namespace}__{name}");
    if full_name.len() <= MODEL_ROUTE_CHAT_TOOL_NAME_MAX_LEN {
        return full_name;
    }

    let hash = fnv1a_64_hex(full_name.as_bytes());
    let suffix = format!("__{hash}");
    let prefix_len = MODEL_ROUTE_CHAT_TOOL_NAME_MAX_LEN.saturating_sub(suffix.len());
    let mut prefix = String::new();
    for ch in full_name.chars() {
        if prefix.len() + ch.len_utf8() > prefix_len {
            break;
        }
        prefix.push(ch);
    }
    format!("{prefix}{suffix}")
}

fn fnv1a_64_hex(bytes: &[u8]) -> String {
    let mut hash = 0xcbf2_9ce4_8422_2325_u64;
    for byte in bytes {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x0000_0100_0000_01b3);
    }
    format!("{hash:016x}")
}

#[cfg(test)]
fn chat_completion_to_response_minimal(chat_body: &Value) -> Result<Value, String> {
    chat_completion_to_response_with_context(chat_body, &ModelRouteToolContext::default())
}

fn chat_completion_to_response_with_context(
    chat_body: &Value,
    tool_context: &ModelRouteToolContext,
) -> Result<Value, String> {
    let choice = chat_body
        .get("choices")
        .and_then(Value::as_array)
        .and_then(|choices| choices.first())
        .ok_or_else(|| "upstream Chat response is missing choices".to_string())?;
    let message = choice
        .get("message")
        .ok_or_else(|| "upstream Chat response is missing message".to_string())?;
    let finish_reason = choice
        .get("finish_reason")
        .and_then(Value::as_str)
        .unwrap_or("stop");
    let id = chat_body
        .get("id")
        .and_then(Value::as_str)
        .unwrap_or("chatcmpl-rcodexmanager");
    let response_id = if id.starts_with("resp_") {
        id.to_string()
    } else {
        format!("resp_{id}")
    };

    let mut output = Vec::new();
    if let Some(text) = message.get("content").and_then(value_to_text) {
        if !text.trim().is_empty() {
            output.push(serde_json::json!({
                "id": format!("{response_id}_msg"),
                "type": "message",
                "status": if finish_reason == "length" { "incomplete" } else { "completed" },
                "role": "assistant",
                "content": [{
                    "type": "output_text",
                    "text": text,
                    "annotations": []
                }]
            }));
        }
    }
    if let Some(tool_calls) = message.get("tool_calls").and_then(Value::as_array) {
        for tool_call in tool_calls {
            if let Some(function) = tool_call.get("function").and_then(Value::as_object) {
                let call_id = tool_call
                    .get("id")
                    .and_then(Value::as_str)
                    .unwrap_or("call_rcodexmanager");
                let chat_name = function
                    .get("name")
                    .and_then(Value::as_str)
                    .unwrap_or_default();
                let arguments = function
                    .get("arguments")
                    .and_then(Value::as_str)
                    .unwrap_or("{}");
                output.push(response_tool_call_item_from_chat_name(
                    call_id,
                    "completed",
                    chat_name,
                    arguments,
                    tool_context,
                ));
            }
        }
    }

    let status = if finish_reason == "length" {
        "incomplete"
    } else {
        "completed"
    };
    let mut response = Map::new();
    response.insert("id".to_string(), Value::String(response_id));
    response.insert("object".to_string(), Value::String("response".to_string()));
    response.insert(
        "created_at".to_string(),
        chat_body
            .get("created")
            .cloned()
            .unwrap_or_else(|| Value::Number(serde_json::Number::from(Utc::now().timestamp()))),
    );
    response.insert("status".to_string(), Value::String(status.to_string()));
    response.insert("error".to_string(), Value::Null);
    response.insert(
        "incomplete_details".to_string(),
        if finish_reason == "length" {
            serde_json::json!({ "reason": "max_output_tokens" })
        } else {
            Value::Null
        },
    );
    response.insert(
        "model".to_string(),
        chat_body
            .get("model")
            .cloned()
            .unwrap_or_else(|| Value::String(String::new())),
    );
    response.insert("output".to_string(), Value::Array(output));
    response.insert(
        "usage".to_string(),
        chat_usage_to_response_usage_minimal(chat_body.get("usage")),
    );
    Ok(Value::Object(response))
}

fn response_tool_call_item_from_chat_name(
    call_id: &str,
    status: &str,
    chat_name: &str,
    arguments: &str,
    tool_context: &ModelRouteToolContext,
) -> Value {
    if let Some(spec) = tool_context.lookup_chat_name(chat_name) {
        let item_id = tool_call_item_id(call_id, spec.kind);
        return response_tool_call_item_from_parts(
            &item_id,
            status,
            call_id,
            spec.kind,
            &spec.name,
            spec.namespace.as_deref(),
            arguments,
        );
    }

    let item_id = tool_call_item_id(call_id, ModelRouteToolKind::Function);
    response_tool_call_item_from_parts(
        &item_id,
        status,
        call_id,
        ModelRouteToolKind::Function,
        chat_name,
        None,
        arguments,
    )
}

fn response_tool_call_item_from_parts(
    item_id: &str,
    status: &str,
    call_id: &str,
    kind: ModelRouteToolKind,
    name: &str,
    namespace: Option<&str>,
    arguments: &str,
) -> Value {
    if kind == ModelRouteToolKind::Custom {
        return serde_json::json!({
            "id": item_id,
            "type": "custom_tool_call",
            "status": status,
            "call_id": call_id,
            "name": name,
            "input": custom_tool_input_from_chat_arguments(arguments),
        });
    }
    if kind == ModelRouteToolKind::ToolSearch {
        return serde_json::json!({
            "type": "tool_search_call",
            "call_id": call_id,
            "status": status,
            "execution": "client",
            "arguments": parse_tool_arguments_object(arguments),
        });
    }

    let mut item = Map::new();
    item.insert("id".to_string(), Value::String(item_id.to_string()));
    item.insert(
        "type".to_string(),
        Value::String("function_call".to_string()),
    );
    item.insert("status".to_string(), Value::String(status.to_string()));
    item.insert("call_id".to_string(), Value::String(call_id.to_string()));
    item.insert("name".to_string(), Value::String(name.to_string()));
    if let Some(namespace) = namespace.filter(|value| !value.trim().is_empty()) {
        item.insert(
            "namespace".to_string(),
            Value::String(namespace.to_string()),
        );
    }
    item.insert(
        "arguments".to_string(),
        Value::String(arguments.to_string()),
    );
    Value::Object(item)
}

fn parse_tool_arguments_object(arguments: &str) -> Value {
    if arguments.trim().is_empty() {
        return serde_json::json!({});
    }
    serde_json::from_str::<Value>(arguments)
        .ok()
        .filter(Value::is_object)
        .unwrap_or_else(|| serde_json::json!({ "query": arguments }))
}

fn custom_tool_input_from_chat_arguments(arguments: &str) -> String {
    if arguments.trim().is_empty() {
        return String::new();
    }
    match serde_json::from_str::<Value>(arguments) {
        Ok(Value::Object(object)) => object
            .get(MODEL_ROUTE_CUSTOM_TOOL_INPUT_FIELD)
            .and_then(Value::as_str)
            .unwrap_or(arguments)
            .to_string(),
        _ => arguments.to_string(),
    }
}

fn chat_usage_to_response_usage_minimal(usage: Option<&Value>) -> Value {
    let input_tokens = usage
        .and_then(|value| value.get("prompt_tokens"))
        .and_then(Value::as_u64)
        .unwrap_or(0);
    let output_tokens = usage
        .and_then(|value| value.get("completion_tokens"))
        .and_then(Value::as_u64)
        .unwrap_or(0);
    serde_json::json!({
        "input_tokens": input_tokens,
        "input_tokens_details": {
            "cached_tokens": usage
                .and_then(|value| value.get("prompt_tokens_details"))
                .and_then(|details| details.get("cached_tokens"))
                .and_then(Value::as_u64)
                .unwrap_or(0),
        },
        "output_tokens": output_tokens,
        "output_tokens_details": {
            "reasoning_tokens": usage
                .and_then(|value| value.get("completion_tokens_details"))
                .and_then(|details| details.get("reasoning_tokens"))
                .and_then(Value::as_u64)
                .unwrap_or(0),
        },
        "total_tokens": usage
            .and_then(|value| value.get("total_tokens"))
            .and_then(Value::as_u64)
            .unwrap_or(input_tokens + output_tokens),
    })
}

fn upstream_status_diagnostic_code(status_code: u16) -> &'static str {
    match status_code {
        401 | 403 => "proxy_upstream_auth_failed",
        404 => "proxy_upstream_endpoint_not_found",
        408 | 504 => "proxy_upstream_timeout",
        429 => "proxy_upstream_rate_limited",
        400..=499 => "proxy_upstream_request_rejected",
        500..=599 => "proxy_upstream_server_error",
        _ => "proxy_upstream_status_error",
    }
}

fn upstream_status_diagnostic_label(status_code: u16) -> &'static str {
    match status_code {
        401 | 403 => "上游鉴权失败",
        404 => "上游端点不存在",
        408 | 504 => "上游超时",
        429 => "上游限流",
        400..=499 => "上游拒绝请求",
        500..=599 => "上游服务异常",
        _ => "上游返回错误",
    }
}

fn upstream_status_diagnostic_message(status_code: u16) -> &'static str {
    match status_code {
        401 | 403 => "检查 API key、环境变量或外部代理的鉴权配置。",
        404 => "检查上游 Chat base URL 是否应以 /v1 或服务指定路径结尾。",
        408 | 504 => "上游响应超时，检查网络、代理或模型服务负载。",
        429 => "上游触发限流，稍后重试或调整供应商配额。",
        400..=499 => "上游认为当前 Chat 请求不合法，可能是模型名、工具格式或参数不兼容。",
        500..=599 => "上游模型服务返回服务端错误，稍后重试或查看供应商日志。",
        _ => "上游返回非成功状态码。",
    }
}

fn chat_error_to_response_error_minimal(value: &Value) -> Value {
    if let Some(error) = value.get("error") {
        serde_json::json!({ "error": error })
    } else if let Some(message) = value
        .get("message")
        .and_then(Value::as_str)
        .or_else(|| value.get("msg").and_then(Value::as_str))
    {
        serde_json::json!({
            "error": {
                "message": message,
                "type": "upstream_error",
                "code": value.get("code").and_then(Value::as_str).unwrap_or("upstream_error")
            }
        })
    } else {
        serde_json::json!({
            "error": {
                "message": value.to_string(),
                "type": "upstream_error",
                "code": "upstream_error"
            }
        })
    }
}

fn proxy_json_error(message: &str, code: &str) -> String {
    serde_json::json!({
        "error": {
            "message": message,
            "type": "invalid_request_error",
            "code": code,
        }
    })
    .to_string()
}

fn read_toml_table(config_path: &Path) -> Result<toml::value::Table, String> {
    let contents = fs::read_to_string(config_path).map_err(|error| {
        format!(
            "failed to read config {}: {error}",
            path_string(config_path)
        )
    })?;
    parse_toml_table(config_path, &contents)
}

fn read_toml_table_or_empty(config_path: &Path) -> Result<toml::value::Table, String> {
    if !config_path.exists() {
        return Ok(toml::value::Table::new());
    }
    read_toml_table(config_path)
}

fn parse_toml_table(config_path: &Path, contents: &str) -> Result<toml::value::Table, String> {
    if contents.trim().is_empty() {
        return Ok(toml::value::Table::new());
    }
    match contents.parse::<toml::Value>() {
        Ok(toml::Value::Table(table)) => Ok(table),
        Ok(_) => Err(format!(
            "config {} must be a TOML table",
            path_string(config_path)
        )),
        Err(error) => Err(format!(
            "failed to parse config {}: {error}",
            path_string(config_path)
        )),
    }
}

fn table_string(table: &toml::value::Table, key: &str) -> Option<String> {
    table
        .get(key)
        .and_then(toml::Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToString::to_string)
}

fn nested_toml_table<'a>(
    table: &'a toml::value::Table,
    path: &[&str],
) -> Option<&'a toml::value::Table> {
    let (first, rest) = path.split_first()?;
    let mut current = table.get(*first)?.as_table()?;
    for key in rest {
        current = current.get(*key)?.as_table()?;
    }
    Some(current)
}

fn ensure_table<'a>(
    table: &'a mut toml::value::Table,
    key: &str,
) -> Result<&'a mut toml::value::Table, String> {
    if table.get(key).and_then(toml::Value::as_table).is_none() {
        table.insert(
            key.to_string(),
            toml::Value::Table(toml::value::Table::new()),
        );
    }
    table
        .get_mut(key)
        .and_then(toml::Value::as_table_mut)
        .ok_or_else(|| format!("{key} must be a TOML table"))
}

fn is_chat_wire_api(value: &str) -> bool {
    matches!(
        value.trim().to_ascii_lowercase().as_str(),
        "chat" | "chat_completions" | "chat-completions" | "openai_chat" | "openai-chat"
    )
}

fn looks_like_chat_completions_url(value: &str) -> bool {
    value
        .trim_end_matches('/')
        .to_ascii_lowercase()
        .ends_with("/chat/completions")
}

#[derive(Debug, Default)]
struct CodexConfig {
    model: Option<String>,
    model_provider: Option<String>,
    reasoning_effort: Option<String>,
}

fn read_codex_config(config_path: &Path) -> CodexConfig {
    let Ok(contents) = fs::read_to_string(config_path) else {
        return CodexConfig::default();
    };
    let parsed_table = contents
        .parse::<toml::Value>()
        .ok()
        .and_then(|value| value.as_table().cloned());
    let read_string = |key: &str| {
        parsed_table
            .as_ref()
            .and_then(|table| table_string(table, key))
            .or_else(|| read_top_level_string(&contents, key))
    };

    CodexConfig {
        model: read_string("model"),
        model_provider: read_string("model_provider"),
        reasoning_effort: read_string("model_reasoning_effort"),
    }
}

fn validate_model_config_value(value: &str, label: &str) -> Result<String, String> {
    let value = value.trim();
    if value.is_empty() {
        return Err(format!("{label} is required"));
    }
    if value.chars().count() > 160 || value.chars().any(char::is_control) {
        return Err(format!(
            "{label} must contain at most 160 characters and no control characters"
        ));
    }
    Ok(value.to_string())
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
    use std::collections::BTreeMap;
    use std::io::Write;
    use std::path::Path;
    use std::sync::Mutex;

    use super::{
        build_model_route_config_text, build_model_route_tool_context_from_request,
        cc_switch_proxy_status_detail, chat_completion_to_response_minimal,
        chat_completion_to_response_with_context, chat_completions_endpoint,
        chat_sse_block_to_response_events, clear_model_route_proxy_diagnostic,
        clear_model_route_proxy_logs, command_has_user_data_dir, feishu_remote_paths,
        infer_model_route_preset, is_codex_main_process, matching_profile_pids,
        model_route_proxy_check_result, model_route_responses_endpoint,
        parse_codex_home_from_environ, parse_node_major_version, preferred_quota_proxy_url,
        profile_runtime_statuses_from_processes, proxy_env_from_scutil,
        proxy_url_from_codex_wrapper, proxy_url_from_shell_script, read_model_route_config_view,
        read_model_route_proxy_http_endpoint, read_model_route_proxy_status,
        read_recent_session_index_summaries, read_session_file_details,
        record_model_route_proxy_diagnostic, responses_to_chat_completions_minimal,
        responses_to_chat_completions_with_context, sanitize_external_command_output,
        server_profile_launch_command, start_model_route_proxy, stop_model_route_proxy,
        terminate_wechat_bridge_pids, wechat_runtime_path_entries, CodexAuthMaterial,
        ModelRouteApiKeyConfig, ModelRouteStreamState, ModelRouteToolContext, ProfileAuthStatus,
        ProfileContext, ProfileLauncherKind, ProfileRuntimeTarget, RunningCodexProcess,
        SESSION_DETAIL_HEAD_BYTES, SESSION_DETAIL_TAIL_BYTES,
    };

    static MODEL_ROUTE_PROXY_TEST_LOCK: Mutex<()> = Mutex::new(());

    #[test]
    fn profile_auth_state_distinguishes_expired_and_refreshable_tokens() {
        let valid = CodexAuthMaterial {
            account: None,
            access_token: Some("token".to_string()),
            account_id: None,
            access_token_expires_at: Some(2_000),
            has_refresh_token: true,
            has_api_key: false,
        };
        assert_eq!(
            super::profile_auth_state_from_material(&valid, 1_000).status,
            ProfileAuthStatus::Valid
        );

        let mut refreshable = valid.clone();
        refreshable.access_token_expires_at = Some(900);
        assert_eq!(
            super::profile_auth_state_from_material(&refreshable, 1_000).status,
            ProfileAuthStatus::RefreshRequired
        );

        refreshable.has_refresh_token = false;
        assert_eq!(
            super::profile_auth_state_from_material(&refreshable, 1_000).status,
            ProfileAuthStatus::Expired
        );
    }

    #[test]
    fn feishu_remote_paths_are_isolated_from_external_default_install() {
        let temp = tempfile::tempdir().unwrap();
        let context = ProfileContext {
            home_dir: temp.path().to_path_buf(),
            zshrc_path: temp.path().join(".zshrc"),
        };
        let paths = feishu_remote_paths(&context);
        let base = temp.path().join(".rcodexmanager/feishu-remote");

        assert_eq!(paths.base_dir, base);
        assert!(paths
            .config_path
            .ends_with("codex-remote-rcodexmanager/codex-remote/config.json"));
        assert!(paths
            .pid_path
            .ends_with("codex-remote-rcodexmanager/codex-remote/codex-remote-relayd.pid"));
    }

    #[test]
    fn feishu_command_output_hides_credentials() {
        let output = sanitize_external_command_output(
            "starting\nAuthorization: Bearer secret-value\nready\n",
        );
        assert!(output.contains("starting"));
        assert!(output.contains("[sensitive log line hidden]"));
        assert!(!output.contains("secret-value"));
    }

    #[test]
    fn user_data_dir_matching_uses_complete_argument_value() {
        let default_dir = Path::new("/Users/example/Library/Application Support/Codex");
        let deep_dir = Path::new("/Users/example/Library/Application Support/Codex-E");
        let deep_command =
            "/Applications/Codex.app/Contents/MacOS/Codex --user-data-dir=/Users/example/Library/Application Support/Codex-E";
        let default_command =
            "/Applications/Codex.app/Contents/MacOS/Codex --user-data-dir=/Users/example/Library/Application Support/Codex";

        assert!(command_has_user_data_dir(deep_command, deep_dir));
        assert!(!command_has_user_data_dir(deep_command, default_dir));
        assert!(command_has_user_data_dir(default_command, default_dir));
    }

    #[test]
    fn codex_main_process_supports_old_and_new_executable_names() {
        assert!(is_codex_main_process(
            "/Applications/Codex.app/Contents/MacOS/Codex --user-data-dir=/tmp/Codex-H"
        ));
        assert!(is_codex_main_process(
            "/Applications/Codex.app/Contents/MacOS/ChatGPT --user-data-dir=/tmp/Codex-H"
        ));
        assert!(!is_codex_main_process(
            "/Applications/Codex.app/Contents/Frameworks/Codex Framework.framework/Helpers/Codex (Service) --user-data-dir=/tmp/Codex-H"
        ));
        assert!(!is_codex_main_process(
            "/Applications/ChatGPT.app/Contents/MacOS/ChatGPT --user-data-dir=/tmp/Codex-H"
        ));
        assert!(is_codex_main_process("/usr/local/bin/codex"));
        assert!(is_codex_main_process(
            "/usr/bin/node /usr/local/lib/node_modules/@openai/codex/bin/codex.js"
        ));
        assert!(!is_codex_main_process("/usr/local/bin/rcodexmanager list"));
        assert!(!is_codex_main_process("/usr/local/bin/codex-remote start"));
    }

    #[test]
    fn linux_process_environment_maps_codex_home_to_profile() {
        let codex_home = parse_codex_home_from_environ(
            b"PATH=/usr/local/bin\0CODEX_HOME=/home/demo/.codex-remote-test\0TERM=xterm\0",
        )
        .unwrap();
        assert_eq!(codex_home, Path::new("/home/demo/.codex-remote-test"));

        let processes = vec![RunningCodexProcess {
            pid: 42,
            command: "/usr/local/bin/codex".to_string(),
            codex_home: Some(codex_home),
        }];
        assert_eq!(
            matching_profile_pids(
                &processes,
                Path::new("/home/demo/.codex-remote-test"),
                Path::new("/home/demo/.local/share/rcodexmanager/profiles/codex-remote-test"),
            ),
            vec![42]
        );
    }

    #[test]
    fn runtime_statuses_match_targets_and_normalize_pids() {
        let temp = tempfile::tempdir().unwrap();
        let context = ProfileContext {
            home_dir: temp.path().to_path_buf(),
            zshrc_path: temp.path().join(".zshrc"),
        };
        let codex_home = temp.path().join(".codex-a");
        let user_data_dir = temp.path().join("Codex-A");
        let processes = vec![
            RunningCodexProcess {
                pid: 90,
                command: format!(
                    "/Applications/Codex.app/Contents/MacOS/Codex --user-data-dir={}",
                    user_data_dir.display()
                ),
                codex_home: None,
            },
            RunningCodexProcess {
                pid: 12,
                command: "/usr/local/bin/codex".to_string(),
                codex_home: Some(codex_home.clone()),
            },
        ];
        let statuses = profile_runtime_statuses_from_processes(
            &context,
            vec![
                ProfileRuntimeTarget {
                    name: "codex-a".to_string(),
                    codex_home: codex_home.to_string_lossy().into_owned(),
                    user_data_dir: user_data_dir.to_string_lossy().into_owned(),
                    launcher_kind: ProfileLauncherKind::Desktop,
                    is_default: false,
                },
                ProfileRuntimeTarget {
                    name: "codex-b".to_string(),
                    codex_home: temp.path().join(".codex-b").to_string_lossy().into_owned(),
                    user_data_dir: temp.path().join("Codex-B").to_string_lossy().into_owned(),
                    launcher_kind: ProfileLauncherKind::Desktop,
                    is_default: false,
                },
            ],
            &processes,
        );

        assert_eq!(statuses[0].name, "codex-a");
        assert_eq!(statuses[0].running_pids, vec![12, 90]);
        assert_eq!(statuses[0].running_process_count, 2);
        assert!(statuses[0].is_running);
        assert_eq!(statuses[1].name, "codex-b");
        assert!(statuses[1].running_pids.is_empty());
        assert!(!statuses[1].is_running);
    }

    #[test]
    fn server_launch_command_quotes_profile_paths_and_proxy_values() {
        let command = server_profile_launch_command(
            "/home/demo/codex profile",
            Path::new("/usr/local/bin/codex"),
            &BTreeMap::new(),
        );
        assert!(command.starts_with("exec env CODEX_HOME='/home/demo/codex profile'"));
        assert!(command.ends_with("'/usr/local/bin/codex'"));
    }

    #[test]
    fn model_route_env_key_saves_a_reference_instead_of_a_plaintext_key() {
        let temp = tempfile::tempdir().unwrap();
        let config_path = temp.path().join("config.toml");
        std::fs::write(
            &config_path,
            "model = \"gpt-5.5\"\nmodel_reasoning_effort = \"medium\"\n",
        )
        .unwrap();
        let api_key = ModelRouteApiKeyConfig::Env("KIMI_API_KEY".to_string());
        let config_text = build_model_route_config_text(
            &config_path,
            "kimi-for-coding",
            "xhigh",
            "rCodexManager Chat Route",
            "http://127.0.0.1:15721/v1",
            "chat",
            super::ModelRoutePreset::OpenaiChat,
            Some("https://api.kimi.com/coding/v1"),
            Some(&api_key),
        )
        .unwrap();

        assert!(config_text.contains("env_key = \"KIMI_API_KEY\""));
        assert!(!config_text.contains("experimental_bearer_token"));
        assert!(!config_text.contains("secret-key"));

        std::fs::write(&config_path, &config_text).unwrap();
        let view = read_model_route_config_view(&config_path);
        assert!(view.has_api_key);
        assert_eq!(view.api_key_env.as_deref(), Some("KIMI_API_KEY"));
        assert_eq!(view.api_key_source.as_deref(), Some("env:KIMI_API_KEY"));
        assert_eq!(view.preset, Some(super::ModelRoutePreset::OpenaiChat));
    }

    #[test]
    fn model_route_config_recognizes_manual_env_key_providers() {
        let temp = tempfile::tempdir().unwrap();
        let config_path = temp.path().join("config.toml");
        std::fs::write(
            &config_path,
            r#"
model = "ark-code-latest"
model_provider = "volcengine"

[model_providers.volcengine]
name = "Volcengine Coding Plan"
base_url = "https://ark.example/api/coding/v3"
env_key = "OPENAI_API_KEY"
wire_api = "responses"
"#,
        )
        .unwrap();

        let view = read_model_route_config_view(&config_path);
        assert!(view.model_provider.is_some());
        assert!(!view.managed_route);
        assert!(view.has_api_key);
        assert_eq!(view.api_key_env.as_deref(), Some("OPENAI_API_KEY"));
        assert_eq!(view.api_key_source.as_deref(), Some("env:OPENAI_API_KEY"));
        assert_eq!(view.preset, Some(super::ModelRoutePreset::CustomResponses));
        assert_eq!(
            infer_model_route_preset(
                view.model_provider.as_deref(),
                view.base_url.as_deref(),
                view.wire_api.as_deref()
            ),
            Some(super::ModelRoutePreset::CustomResponses)
        );
    }

    #[test]
    fn resolves_local_shell_path_variables_in_profile_launchers() {
        let body = r#"
codex-kimi() {
  local profile_dir="$HOME/.codex-kimi"
  open -n -a "Codex" \
    --env CODEX_HOME="$profile_dir" \
    --args --user-data-dir="$HOME/Library/Application Support/Codex-Kimi"
}
"#;
        let home = Path::new("/Users/demo");

        assert_eq!(
            super::resolve_shell_path_value(body, "CODEX_HOME=", home),
            Some(Path::new("/Users/demo/.codex-kimi").to_path_buf())
        );
        assert_eq!(
            super::resolve_shell_path_value(body, "--user-data-dir=", home),
            Some(Path::new("/Users/demo/Library/Application Support/Codex-Kimi").to_path_buf())
        );
    }

    #[test]
    fn renames_shell_function_without_changing_its_body() {
        let contents = "codex-old() {\n  echo keep-this\n}\n";
        let renamed = super::rename_shell_function(contents, "codex-old", "codex-new")
            .expect("function should be found");

        assert_eq!(renamed, "codex-new() {\n  echo keep-this\n}\n");
    }

    #[test]
    fn codex_wrapper_proxy_parser_prefers_https_and_ignores_dynamic_shell_values() {
        let script = r#"#!/bin/sh
export HTTP_PROXY='http://127.0.0.1:7891'
export HTTPS_PROXY="http://proxy-user:proxy-password@127.0.0.1:7890"
export ALL_PROXY="$DYNAMIC_PROXY"
exec /usr/local/bin/codex "$@"
"#;

        assert_eq!(
            proxy_url_from_shell_script(script).as_deref(),
            Some("http://proxy-user:proxy-password@127.0.0.1:7890")
        );
    }

    #[test]
    fn quota_proxy_discovers_the_user_codex_wrapper() {
        let temp = tempfile::tempdir().unwrap();
        let bin_dir = temp.path().join("bin");
        std::fs::create_dir_all(&bin_dir).unwrap();
        std::fs::write(
            bin_dir.join("codex"),
            "#!/bin/sh\nexport HTTPS_PROXY='http://127.0.0.1:7890'\n",
        )
        .unwrap();
        let context = ProfileContext {
            home_dir: temp.path().to_path_buf(),
            zshrc_path: temp.path().join(".zshrc"),
        };

        assert_eq!(
            proxy_url_from_codex_wrapper(&context).as_deref(),
            Some("http://127.0.0.1:7890")
        );
    }

    #[test]
    fn quota_proxy_uses_the_enabled_macos_https_proxy() {
        let settings = proxy_env_from_scutil(
            r#"
  HTTPEnable : 1
  HTTPPort : 7897
  HTTPProxy : 127.0.0.1
  HTTPSEnable : 1
  HTTPSPort : 7897
  HTTPSProxy : 127.0.0.1
"#,
        )
        .expect("system proxy settings");

        assert_eq!(
            preferred_quota_proxy_url(&settings).as_deref(),
            Some("http://127.0.0.1:7897")
        );
    }

    #[test]
    fn proxied_usage_transport_errors_do_not_expose_proxy_details() {
        let detail = "proxy authentication failed for proxy-user:proxy-password@127.0.0.1";
        let message = super::format_usage_transport_error(true, detail);

        assert!(message.contains("configured server proxy"));
        assert!(!message.contains("proxy-user"));
        assert!(!message.contains("proxy-password"));
        assert!(!message.contains("127.0.0.1"));
    }

    #[test]
    fn node_major_version_parser_accepts_common_node_output() {
        assert_eq!(parse_node_major_version("v26.2.0\n"), Some(26));
        assert_eq!(parse_node_major_version("20.19.1"), Some(20));
        assert_eq!(parse_node_major_version("not-a-version"), None);
    }

    #[test]
    fn wechat_runtime_prefers_user_wrappers_and_removes_duplicate_paths() {
        let temp = tempfile::tempdir().unwrap();
        let user_bin = temp.path().join("bin");
        let node_bin = temp.path().join(".nvm/versions/node/v26/bin");
        std::fs::create_dir_all(&user_bin).unwrap();
        std::fs::create_dir_all(&node_bin).unwrap();
        let inherited = std::env::join_paths([Path::new("/usr/bin"), user_bin.as_path()]).unwrap();

        let entries = wechat_runtime_path_entries(temp.path(), node_bin.clone(), Some(&inherited));

        assert_eq!(entries[0], user_bin);
        assert_eq!(entries[1], node_bin);
        assert_eq!(
            entries.iter().filter(|entry| *entry == &entries[0]).count(),
            1
        );
    }

    #[test]
    #[cfg(unix)]
    fn terminating_an_already_exited_wechat_process_is_successful() {
        let mut child = std::process::Command::new("sh")
            .args(["-c", "exit 0"])
            .spawn()
            .unwrap();
        let pid = child.id();
        child.wait().unwrap();

        assert!(terminate_wechat_bridge_pids(&[pid]).is_ok());
    }

    #[test]
    fn session_list_uses_index_without_parsing_session_body() {
        let temp = tempfile::tempdir().unwrap();
        let codex_home = temp.path();
        let session_id = "019f65d1-aaaa-7bbb-8ccc-111111111111";
        let session_dir = codex_home.join("sessions/2026/07/15");
        std::fs::create_dir_all(&session_dir).unwrap();
        let session_path =
            session_dir.join(format!("rollout-2026-07-15T10-00-00-{session_id}.jsonl"));
        std::fs::write(
            &session_path,
            serde_json::json!({
                "type": "event_msg",
                "payload": {"type": "user_message", "message": "正文不应在列表阶段读取"}
            })
            .to_string(),
        )
        .unwrap();
        std::fs::write(
            codex_home.join("session_index.jsonl"),
            format!(
                "{}\n",
                serde_json::json!({
                    "id": session_id,
                    "thread_name": "索引标题",
                    "updated_at": "2026-07-15T10:00:00Z"
                })
            ),
        )
        .unwrap();

        let sessions = read_recent_session_index_summaries(codex_home, 1);

        assert_eq!(sessions.len(), 1);
        assert_eq!(sessions[0].title, "索引标题");
        assert_eq!(sessions[0].renamed_title.as_deref(), Some("索引标题"));
        assert!(sessions[0].summary.is_none());
        assert_eq!(sessions[0].path.as_deref(), session_path.to_str());
    }

    #[test]
    fn session_detail_reads_bounded_head_and_tail() {
        let temp = tempfile::tempdir().unwrap();
        let session_path = temp.path().join("large-session.jsonl");
        let mut file = std::fs::File::create(&session_path).unwrap();
        writeln!(
            file,
            "{}",
            serde_json::json!({
                "type": "session_meta",
                "payload": {
                    "id": "session-large",
                    "timestamp": "2026-07-15T09:00:00Z",
                    "cwd": "/tmp/project"
                }
            })
        )
        .unwrap();
        writeln!(
            file,
            "{}",
            serde_json::json!({
                "type": "event_msg",
                "payload": {"type": "user_message", "message": "开头问题"}
            })
        )
        .unwrap();
        file.write_all(&vec![
            b'x';
            (SESSION_DETAIL_HEAD_BYTES + SESSION_DETAIL_TAIL_BYTES + 1024)
                as usize
        ])
        .unwrap();
        writeln!(file).unwrap();
        writeln!(
            file,
            "{}",
            serde_json::json!({
                "type": "event_msg",
                "payload": {"type": "user_message", "message": "尾部问题"}
            })
        )
        .unwrap();
        drop(file);

        let details = read_session_file_details(&session_path);

        assert_eq!(details.id.as_deref(), Some("session-large"));
        assert_eq!(details.cwd.as_deref(), Some("/tmp/project"));
        assert_eq!(details.summary.as_deref(), Some("尾部问题"));
    }

    #[test]
    fn model_route_proxy_converts_basic_responses_request_to_chat() {
        let responses = serde_json::json!({
            "model": "glm-4.6",
            "instructions": "Be concise.",
            "input": [{
                "type": "message",
                "role": "user",
                "content": [{
                    "type": "input_text",
                    "text": "hello"
                }]
            }],
            "max_output_tokens": 120,
            "temperature": 0.2,
            "tools": [{
                "type": "function",
                "name": "lookup",
                "description": "Lookup data",
                "parameters": {
                    "type": "object",
                    "properties": {}
                }
            }]
        });

        let chat = responses_to_chat_completions_minimal(&responses, "glm-4.6")
            .expect("responses should convert to chat");

        assert_eq!(chat["model"], "glm-4.6");
        assert_eq!(chat["stream"], false);
        assert_eq!(chat["max_tokens"], 120);
        assert_eq!(chat["messages"][0]["role"], "system");
        assert_eq!(chat["messages"][0]["content"], "Be concise.");
        assert_eq!(chat["messages"][1]["role"], "user");
        assert_eq!(chat["messages"][1]["content"], "hello");
        assert_eq!(chat["tools"][0]["function"]["name"], "lookup");
    }

    #[test]
    fn model_route_proxy_converts_streaming_request_to_chat_with_usage() {
        let responses = serde_json::json!({
            "model": "glm-4.6",
            "input": "hello",
            "stream": true
        });

        let chat = responses_to_chat_completions_minimal(&responses, "glm-4.6")
            .expect("streaming responses should convert to chat");

        assert_eq!(chat["stream"], true);
        assert_eq!(chat["stream_options"]["include_usage"], true);
    }

    #[test]
    fn model_route_proxy_maps_custom_and_namespace_tools_to_chat() {
        let responses = serde_json::json!({
            "model": "glm-4.6",
            "input": "hello",
            "tools": [{
                "type": "custom",
                "name": "shell",
                "description": "Run shell input"
            }, {
                "type": "namespace",
                "name": "mcp__codex_apps__gmail",
                "tools": [{
                    "type": "function",
                    "name": "_search_emails",
                    "description": "Search Gmail.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "query": { "type": "string" }
                        }
                    }
                }]
            }],
            "tool_choice": {
                "type": "function",
                "name": "_search_emails",
                "namespace": "mcp__codex_apps__gmail"
            }
        });

        let context = build_model_route_tool_context_from_request(&responses);
        let chat = responses_to_chat_completions_with_context(&responses, "glm-4.6", &context)
            .expect("tools should convert to chat");

        assert_eq!(chat["tools"][0]["function"]["name"], "shell");
        assert_eq!(
            chat["tools"][0]["function"]["parameters"]["required"][0],
            "input"
        );
        assert_eq!(
            chat["tools"][1]["function"]["name"],
            "mcp__codex_apps__gmail___search_emails"
        );
        assert_eq!(
            chat["tool_choice"]["function"]["name"],
            "mcp__codex_apps__gmail___search_emails"
        );
    }

    #[test]
    fn model_route_proxy_maps_tool_search_and_loaded_tools_to_chat() {
        let responses = serde_json::json!({
            "model": "glm-4.6",
            "tools": [{
                "type": "tool_search"
            }],
            "tool_choice": {
                "type": "tool_search"
            },
            "input": [{
                "type": "tool_search_call",
                "call_id": "call_tool_search_1",
                "status": "completed",
                "execution": "client",
                "arguments": {
                    "query": "Gmail search emails",
                    "limit": 5
                }
            }, {
                "type": "tool_search_output",
                "call_id": "call_tool_search_1",
                "status": "completed",
                "execution": "client",
                "tools": [{
                    "type": "namespace",
                    "name": "mcp__codex_apps__gmail",
                    "tools": [{
                        "type": "function",
                        "name": "_search_emails",
                        "parameters": {
                            "type": "object",
                            "properties": {
                                "query": {"type": "string"}
                            }
                        }
                    }]
                }]
            }, {
                "type": "message",
                "role": "user",
                "content": "Search unread inbox mail."
            }]
        });

        let context = build_model_route_tool_context_from_request(&responses);
        let chat = responses_to_chat_completions_with_context(&responses, "glm-4.6", &context)
            .expect("tool search should convert to chat");
        let tool_names = chat["tools"]
            .as_array()
            .unwrap()
            .iter()
            .filter_map(|tool| {
                tool.pointer("/function/name")
                    .and_then(serde_json::Value::as_str)
            })
            .collect::<Vec<_>>();

        assert!(tool_names.contains(&"tool_search"));
        assert!(tool_names.contains(&"mcp__codex_apps__gmail___search_emails"));
        assert_eq!(chat["tool_choice"]["function"]["name"], "tool_search");
        assert_eq!(chat["messages"][0]["role"], "assistant");
        assert_eq!(
            chat["messages"][0]["tool_calls"][0]["function"]["name"],
            "tool_search"
        );
        assert_eq!(chat["messages"][1]["role"], "tool");
        assert_eq!(chat["messages"][1]["tool_call_id"], "call_tool_search_1");
        assert!(chat["messages"][1]["content"]
            .as_str()
            .unwrap()
            .contains("mcp__codex_apps__gmail"));
    }

    #[test]
    fn model_route_proxy_carries_tool_call_outputs_into_next_chat_request() {
        let responses = serde_json::json!({
            "model": "glm-4.6",
            "input": [{
                "type": "message",
                "role": "user",
                "content": "search and inspect"
            }, {
                "type": "function_call",
                "call_id": "call_gmail",
                "name": "_search_emails",
                "namespace": "mcp__codex_apps__gmail",
                "arguments": "{\"query\":\"in:inbox\"}"
            }, {
                "type": "custom_tool_call",
                "call_id": "call_shell",
                "name": "shell",
                "input": "ls -la"
            }, {
                "type": "function_call_output",
                "call_id": "call_gmail",
                "output": "[{\"subject\":\"hello\"}]"
            }, {
                "type": "custom_tool_call_output",
                "call_id": "call_shell",
                "output": "total 8"
            }, {
                "type": "message",
                "role": "user",
                "content": "continue"
            }],
            "tools": [{
                "type": "custom",
                "name": "shell"
            }, {
                "type": "namespace",
                "name": "mcp__codex_apps__gmail",
                "tools": [{
                    "type": "function",
                    "name": "_search_emails",
                    "parameters": {"type": "object"}
                }]
            }]
        });

        let context = build_model_route_tool_context_from_request(&responses);
        let chat = responses_to_chat_completions_with_context(&responses, "glm-4.6", &context)
            .expect("tool loop should convert to chat");
        let custom_output: serde_json::Value =
            serde_json::from_str(chat["messages"][3]["content"].as_str().unwrap())
                .expect("custom output should preserve the response item");

        assert_eq!(chat["messages"][0]["role"], "user");
        assert_eq!(chat["messages"][1]["role"], "assistant");
        assert_eq!(chat["messages"][1]["content"], serde_json::Value::Null);
        assert_eq!(chat["messages"][1]["tool_calls"][0]["id"], "call_gmail");
        assert_eq!(
            chat["messages"][1]["tool_calls"][0]["function"]["name"],
            "mcp__codex_apps__gmail___search_emails"
        );
        assert_eq!(chat["messages"][1]["tool_calls"][1]["id"], "call_shell");
        assert_eq!(
            chat["messages"][1]["tool_calls"][1]["function"]["arguments"],
            "{\"input\":\"ls -la\"}"
        );
        assert_eq!(chat["messages"][2]["role"], "tool");
        assert_eq!(chat["messages"][2]["tool_call_id"], "call_gmail");
        assert_eq!(chat["messages"][2]["content"], "[{\"subject\":\"hello\"}]");
        assert_eq!(chat["messages"][3]["role"], "tool");
        assert_eq!(custom_output["type"], "custom_tool_call_output");
        assert_eq!(custom_output["call_id"], "call_shell");
        assert_eq!(chat["messages"][4]["content"], "continue");
    }

    #[test]
    fn model_route_proxy_converts_basic_chat_response_to_responses() {
        let chat = serde_json::json!({
            "id": "chatcmpl-test",
            "created": 123,
            "model": "glm-4.6",
            "choices": [{
                "finish_reason": "stop",
                "message": {
                    "role": "assistant",
                    "content": "hi"
                }
            }],
            "usage": {
                "prompt_tokens": 3,
                "completion_tokens": 2,
                "total_tokens": 5
            }
        });

        let response =
            chat_completion_to_response_minimal(&chat).expect("chat response should convert");

        assert_eq!(response["id"], "resp_chatcmpl-test");
        assert_eq!(response["status"], "completed");
        assert_eq!(response["output"][0]["type"], "message");
        assert_eq!(response["output"][0]["content"][0]["text"], "hi");
        assert_eq!(response["usage"]["input_tokens"], 3);
        assert_eq!(response["usage"]["output_tokens"], 2);
    }

    #[test]
    fn model_route_proxy_restores_custom_and_namespace_tool_calls() {
        let responses_request = serde_json::json!({
            "model": "glm-4.6",
            "input": "hello",
            "tools": [{
                "type": "custom",
                "name": "shell"
            }, {
                "type": "namespace",
                "name": "mcp__codex_apps__gmail",
                "tools": [{
                    "type": "function",
                    "name": "_search_emails",
                    "parameters": {"type": "object"}
                }]
            }]
        });
        let context = build_model_route_tool_context_from_request(&responses_request);
        let custom_chat = serde_json::json!({
            "id": "chatcmpl-custom",
            "created": 123,
            "model": "glm-4.6",
            "choices": [{
                "finish_reason": "tool_calls",
                "message": {
                    "role": "assistant",
                    "tool_calls": [{
                        "id": "call_shell",
                        "type": "function",
                        "function": {
                            "name": "shell",
                            "arguments": "{\"input\":\"ls -la\"}"
                        }
                    }]
                }
            }]
        });
        let namespace_chat = serde_json::json!({
            "id": "chatcmpl-namespace",
            "created": 123,
            "model": "glm-4.6",
            "choices": [{
                "finish_reason": "tool_calls",
                "message": {
                    "role": "assistant",
                    "tool_calls": [{
                        "id": "call_gmail",
                        "type": "function",
                        "function": {
                            "name": "mcp__codex_apps__gmail___search_emails",
                            "arguments": "{\"query\":\"in:inbox\"}"
                        }
                    }]
                }
            }]
        });

        let custom_response = chat_completion_to_response_with_context(&custom_chat, &context)
            .expect("custom tool should restore");
        let namespace_response =
            chat_completion_to_response_with_context(&namespace_chat, &context)
                .expect("namespace tool should restore");

        assert_eq!(custom_response["output"][0]["type"], "custom_tool_call");
        assert_eq!(custom_response["output"][0]["id"], "ctc_call_shell");
        assert_eq!(custom_response["output"][0]["input"], "ls -la");
        assert_eq!(namespace_response["output"][0]["type"], "function_call");
        assert_eq!(
            namespace_response["output"][0]["namespace"],
            "mcp__codex_apps__gmail"
        );
        assert_eq!(namespace_response["output"][0]["name"], "_search_emails");
    }

    #[test]
    fn model_route_proxy_restores_tool_search_call() {
        let responses_request = serde_json::json!({
            "model": "glm-4.6",
            "tools": [{
                "type": "tool_search"
            }],
            "input": "Find tools."
        });
        let context = build_model_route_tool_context_from_request(&responses_request);
        let chat = serde_json::json!({
            "id": "chatcmpl-tool-search",
            "created": 123,
            "model": "glm-4.6",
            "choices": [{
                "finish_reason": "tool_calls",
                "message": {
                    "role": "assistant",
                    "tool_calls": [{
                        "id": "call_tool_search_1",
                        "type": "function",
                        "function": {
                            "name": "tool_search",
                            "arguments": "{\"query\":\"Gmail search emails\",\"limit\":10}"
                        }
                    }]
                }
            }]
        });

        let response = chat_completion_to_response_with_context(&chat, &context)
            .expect("tool search should restore");

        assert_eq!(response["output"][0]["type"], "tool_search_call");
        assert_eq!(response["output"][0]["call_id"], "call_tool_search_1");
        assert_eq!(response["output"][0]["execution"], "client");
        assert_eq!(
            response["output"][0]["arguments"]["query"],
            "Gmail search emails"
        );
        assert_eq!(response["output"][0]["arguments"]["limit"], 10);
    }

    #[test]
    fn model_route_proxy_builds_chat_completions_endpoint() {
        assert_eq!(
            chat_completions_endpoint("https://open.bigmodel.cn/api/paas/v4"),
            "https://open.bigmodel.cn/api/paas/v4/chat/completions"
        );
        assert_eq!(
            chat_completions_endpoint("http://127.0.0.1:8000/v1/chat/completions"),
            "http://127.0.0.1:8000/v1/chat/completions"
        );
    }

    #[test]
    fn model_route_proxy_builds_responses_endpoint() {
        assert_eq!(
            model_route_responses_endpoint("http://127.0.0.1:15721/v1"),
            "http://127.0.0.1:15721/v1/responses"
        );
        assert_eq!(
            model_route_responses_endpoint(
                "https://dashscope.aliyuncs.com/compatible-mode/v1/responses"
            ),
            "https://dashscope.aliyuncs.com/compatible-mode/v1/responses"
        );
    }

    #[test]
    fn model_route_proxy_status_includes_recent_diagnostic() {
        let _guard = MODEL_ROUTE_PROXY_TEST_LOCK
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        clear_model_route_proxy_diagnostic();
        record_model_route_proxy_diagnostic(
            "error",
            "proxy_route_not_found",
            "路由未匹配",
            "没有找到能处理当前模型名的 rCodexManager 路由配置。",
            Some("model=missing".to_string()),
        );

        let status = read_model_route_proxy_status();

        assert!(status
            .diagnostics
            .iter()
            .any(|item| item.code == "proxy_route_not_found"
                && item.detail.as_deref() == Some("model=missing")));
        clear_model_route_proxy_diagnostic();
    }

    #[test]
    fn model_route_proxy_status_includes_recent_self_check_log() {
        let _guard = MODEL_ROUTE_PROXY_TEST_LOCK
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        clear_model_route_proxy_logs();

        let result = model_route_proxy_check_result(
            "codex-g",
            "glm-4.6",
            Some("http://127.0.0.1:15721/v1".to_string()),
            Some("http://127.0.0.1:15721/v1/responses".to_string()),
            true,
            "ok",
            "自检通过",
            "模型路由自检已打通。",
            Some(200),
            12,
            None,
        );

        assert!(result.proxy.recent_logs.iter().any(|item| {
            item.kind == "self-check"
                && item.profile_name.as_deref() == Some("codex-g")
                && item.model.as_deref() == Some("glm-4.6")
                && item.status == "ok"
        }));
        clear_model_route_proxy_logs();
    }

    #[test]
    fn model_route_proxy_detects_cc_switch_status_shape() {
        let value = serde_json::json!({
            "running": true,
            "address": "127.0.0.1",
            "port": 15721,
            "activeConnections": 0,
            "totalRequests": 4,
            "successRequests": 3,
            "failedRequests": 1,
            "activeTargets": [
                {
                    "appType": "Codex",
                    "providerName": "Zhipu GLM",
                    "providerId": "zhipu_glm"
                }
            ]
        });

        let detail = cc_switch_proxy_status_detail(&value).expect("cc-switch status detail");

        assert!(detail.contains("cc-switch /status"));
        assert!(detail.contains("Codex:Zhipu GLM"));
    }

    #[test]
    fn model_route_proxy_does_not_treat_generic_health_as_cc_switch() {
        let value = serde_json::json!({
            "status": "healthy",
            "timestamp": "2026-07-14T00:00:00Z"
        });

        assert!(cc_switch_proxy_status_detail(&value).is_none());
    }

    #[test]
    fn model_route_proxy_converts_chat_sse_text_chunks_to_responses_events() {
        let mut state = ModelRouteStreamState::new("glm-4.6", ModelRouteToolContext::default());
        let first = concat!(
            "data: {\"id\":\"chatcmpl-test\",\"created\":123,\"model\":\"glm-4.6\",",
            "\"choices\":[{\"delta\":{\"role\":\"assistant\",\"content\":\"he\"},\"finish_reason\":null}]}\n\n"
        );
        let second = concat!(
            "data: {\"id\":\"chatcmpl-test\",\"created\":123,\"model\":\"glm-4.6\",",
            "\"choices\":[{\"delta\":{\"content\":\"llo\"},\"finish_reason\":\"stop\"}],",
            "\"usage\":{\"prompt_tokens\":2,\"completion_tokens\":1,\"total_tokens\":3}}\n\n"
        );

        let mut events = chat_sse_block_to_response_events(first.trim_end(), &mut state);
        events.extend(chat_sse_block_to_response_events(
            second.trim_end(),
            &mut state,
        ));

        let joined = events.join("");
        assert!(joined.contains("event: response.created"));
        assert!(joined.contains("event: response.output_text.delta"));
        assert!(joined.contains("\"delta\":\"he\""));
        assert!(joined.contains("\"delta\":\"llo\""));
        assert!(joined.contains("event: response.completed"));
        assert!(joined.contains("\"text\":\"hello\""));
        assert!(joined.contains("\"input_tokens\":2"));
    }

    #[test]
    fn model_route_proxy_converts_chat_sse_tool_calls_to_responses_events() {
        let mut state = ModelRouteStreamState::new("glm-4.6", ModelRouteToolContext::default());
        let first = concat!(
            "data: {\"id\":\"chatcmpl-tool\",\"created\":123,\"model\":\"glm-4.6\",",
            "\"choices\":[{\"delta\":{\"tool_calls\":[{\"index\":0,\"id\":\"call_1\",",
            "\"type\":\"function\",\"function\":{\"name\":\"get_weather\"}}]}}]}\n\n"
        );
        let second = concat!(
            "data: {\"id\":\"chatcmpl-tool\",\"created\":123,\"model\":\"glm-4.6\",",
            "\"choices\":[{\"delta\":{\"tool_calls\":[{\"index\":0,",
            "\"function\":{\"arguments\":\"{\\\"city\\\":\\\"Tokyo\\\"}\"}}]},",
            "\"finish_reason\":\"tool_calls\"}]}\n\n"
        );

        let mut events = chat_sse_block_to_response_events(first.trim_end(), &mut state);
        events.extend(chat_sse_block_to_response_events(
            second.trim_end(),
            &mut state,
        ));

        let joined = events.join("");
        assert!(joined.contains("event: response.output_item.added"));
        assert!(joined.contains("event: response.function_call_arguments.delta"));
        assert!(joined.contains("event: response.function_call_arguments.done"));
        assert!(joined.contains("\"type\":\"function_call\""));
        assert!(joined.contains("\"call_id\":\"call_1\""));
        assert!(joined.contains("\"name\":\"get_weather\""));
        assert!(joined.contains("{\\\"city\\\":\\\"Tokyo\\\"}"));
    }

    #[test]
    fn model_route_proxy_converts_chat_sse_custom_tool_calls_to_responses_events() {
        let responses_request = serde_json::json!({
            "model": "glm-4.6",
            "input": "hello",
            "tools": [{
                "type": "custom",
                "name": "shell"
            }]
        });
        let context = build_model_route_tool_context_from_request(&responses_request);
        let mut state = ModelRouteStreamState::new("glm-4.6", context);
        let first = concat!(
            "data: {\"id\":\"chatcmpl-custom\",\"created\":123,\"model\":\"glm-4.6\",",
            "\"choices\":[{\"delta\":{\"tool_calls\":[{\"index\":0,\"id\":\"call_shell\",",
            "\"type\":\"function\",\"function\":{\"name\":\"shell\"}}]}}]}\n\n"
        );
        let second = concat!(
            "data: {\"id\":\"chatcmpl-custom\",\"created\":123,\"model\":\"glm-4.6\",",
            "\"choices\":[{\"delta\":{\"tool_calls\":[{\"index\":0,",
            "\"function\":{\"arguments\":\"{\\\"input\\\":\\\"ls -la\\\"}\"}}]},",
            "\"finish_reason\":\"tool_calls\"}]}\n\n"
        );

        let mut events = chat_sse_block_to_response_events(first.trim_end(), &mut state);
        events.extend(chat_sse_block_to_response_events(
            second.trim_end(),
            &mut state,
        ));

        let joined = events.join("");
        assert!(joined.contains("\"type\":\"custom_tool_call\""));
        assert!(joined.contains("\"id\":\"ctc_call_shell\""));
        assert!(joined.contains("event: response.custom_tool_call_input.delta"));
        assert!(joined.contains("event: response.custom_tool_call_input.done"));
        assert!(joined.contains("\"input\":\"ls -la\""));
        assert!(!joined.contains("event: response.function_call_arguments.done"));
    }

    #[test]
    fn model_route_proxy_converts_chat_sse_tool_search_calls_to_responses_events() {
        let responses_request = serde_json::json!({
            "model": "glm-4.6",
            "tools": [{
                "type": "tool_search"
            }],
            "input": "Search for tools."
        });
        let context = build_model_route_tool_context_from_request(&responses_request);
        let mut state = ModelRouteStreamState::new("glm-4.6", context);
        let first = concat!(
            "data: {\"id\":\"chatcmpl-tool-search\",\"created\":123,\"model\":\"glm-4.6\",",
            "\"choices\":[{\"delta\":{\"tool_calls\":[{\"index\":0,\"id\":\"call_tool_search_1\",",
            "\"type\":\"function\",\"function\":{\"name\":\"tool_search\"}}]}}]}\n\n"
        );
        let second = concat!(
            "data: {\"id\":\"chatcmpl-tool-search\",\"created\":123,\"model\":\"glm-4.6\",",
            "\"choices\":[{\"delta\":{\"tool_calls\":[{\"index\":0,",
            "\"function\":{\"arguments\":\"{\\\"query\\\":\\\"Gmail search emails\\\",\\\"limit\\\":10}\"}}]},",
            "\"finish_reason\":\"tool_calls\"}]}\n\n"
        );

        let mut events = chat_sse_block_to_response_events(first.trim_end(), &mut state);
        events.extend(chat_sse_block_to_response_events(
            second.trim_end(),
            &mut state,
        ));

        let joined = events.join("");
        assert!(joined.contains("\"type\":\"tool_search_call\""));
        assert!(joined.contains("\"execution\":\"client\""));
        assert!(joined.contains("\"call_id\":\"call_tool_search_1\""));
        assert!(joined.contains("\"query\":\"Gmail search emails\""));
        assert!(joined.contains("event: response.function_call_arguments.done"));
    }

    #[test]
    fn managed_model_route_proxy_health_endpoint_responds_when_port_is_free() {
        let _guard = MODEL_ROUTE_PROXY_TEST_LOCK
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        if read_model_route_proxy_status().reachable {
            return;
        }

        let status = match start_model_route_proxy() {
            Ok(status) => status,
            Err(message)
                if message.contains("Operation not permitted")
                    || message.contains("Permission denied") =>
            {
                return;
            }
            Err(message) => panic!("proxy should start on a free port: {message}"),
        };
        assert!(status.managed);
        assert!(status.reachable);

        let mut response = String::new();
        for _ in 0..8 {
            response = read_model_route_proxy_http_endpoint("/health").unwrap_or_default();
            if response.contains("200 OK") {
                break;
            }
            std::thread::sleep(std::time::Duration::from_millis(25));
        }

        assert!(
            response.contains("200 OK"),
            "unexpected health response: {response:?}"
        );
        assert!(response.contains("\"mode\":\"basic-chat-conversion\""));

        let stopped = stop_model_route_proxy().expect("proxy should stop");
        assert!(!stopped.managed);
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
