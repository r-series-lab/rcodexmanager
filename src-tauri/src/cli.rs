use crate::core::{
    app_identifier, app_name, apply_auth_backup, apply_model_route, archive_profile, binary_name,
    check_model_route_draft, check_model_route_proxy, cleanup_auth_backups,
    configure_feishu_remote, copy_profile, create_auth_backup, create_auth_backups, create_profile,
    delete_auth_backup, delete_profile, export_auth_backup, import_auth_backup_package,
    import_profile_auth, install_wechat_bridge_service, launch_profile, list_auth_vault,
    list_feishu_remote, list_model_routes, list_profile_sessions, list_profiles,
    list_wechat_bridges, open_feishu_remote_page, preview_auth_backup_package, preview_model_route,
    read_feishu_remote_log, read_model_route_proxy_status, read_profile_quota,
    read_profile_session_detail, read_wechat_bridge_log, reset_profile, restart_feishu_remote,
    restart_wechat_bridge, restore_archived_profile, restore_model_route,
    rollback_auth_application, run_doctor, run_profile_login_foreground, start_feishu_remote,
    start_wechat_bridge, stop_feishu_remote, stop_wechat_bridge, terminate_profile,
    unbind_wechat_bridge, update_auth_backup, update_profile_metadata, update_profile_model,
    ApplyAuthBackupInput, ApplyModelRouteInput, CheckModelRouteProxyInput, CleanupAuthBackupsInput,
    ConfigureFeishuRemoteInput, CopyProfileInput, CreateAuthBackupInput, CreateAuthBackupsInput,
    CreateProfileInput, DeleteAuthBackupInput, DoctorReport, ExportAuthBackupInput,
    FeishuRemotePage, ImportAuthBackupPackageInput, ImportAuthInput,
    InstallWechatBridgeServiceInput, ListProfileSessionsInput, ModelRoutePreset,
    PreviewAuthBackupPackageInput, PreviewModelRouteInput, ProfileContext, ProfileLauncherKind,
    ProfileMetadataInput, ReadFeishuRemoteLogInput, ReadProfileSessionDetailInput,
    ReadWechatBridgeLogInput, ResetProfileInput, RestartWechatBridgeInput, RestoreModelRouteInput,
    RollbackAuthApplicationInput, StartFeishuRemoteInput, StartWechatBridgeInput,
    StopWechatBridgeInput, UnbindWechatBridgeInput, UpdateAuthBackupInput, UpdateProfileModelInput,
};
use clap::error::ErrorKind;
use clap::{Parser, Subcommand, ValueEnum};
use serde::Serialize;
use serde_json::json;
use std::ffi::OsStr;
use std::path::PathBuf;

#[derive(Debug, Parser)]
#[command(name = "rcodexmanager")]
#[command(
    about = "Manage Codex profiles, sessions, auth backups, remote channels, and model routes."
)]
pub struct Cli {
    #[arg(long, global = true)]
    pub json: bool,
    #[arg(
        long = "shell-rc",
        visible_alias = "zshrc",
        global = true,
        value_name = "PATH"
    )]
    pub zshrc: Option<PathBuf>,
    #[arg(long, global = true, value_name = "PATH")]
    pub home: Option<PathBuf>,
    #[command(subcommand)]
    pub command: Option<Commands>,
}

#[derive(Debug, Subcommand)]
pub enum Commands {
    /// Launch the rCodexManager desktop app.
    Desktop,
    /// Show app identity, version, and runtime metadata.
    Info,
    /// List CLI command groups, side effects, and examples.
    Capabilities,
    /// Run read-only, redacted health checks across local rCodexManager features.
    Doctor,
    /// List discovered Codex profiles and their current state.
    List,
    /// Create an isolated Codex profile and launcher.
    Create {
        #[arg(long)]
        name: String,
        #[arg(long)]
        codex_home: Option<String>,
        #[arg(long)]
        user_data_dir: Option<String>,
        #[arg(long)]
        model: Option<String>,
        #[arg(long)]
        reasoning_effort: Option<String>,
        #[arg(long)]
        alias: Option<String>,
        #[arg(long)]
        category: Option<String>,
        #[arg(long)]
        note: Option<String>,
        #[arg(long)]
        server: bool,
    },
    /// Copy a profile's config and metadata into a new profile.
    Copy {
        #[arg(long)]
        source: String,
        #[arg(long)]
        name: String,
        #[arg(long)]
        codex_home: Option<String>,
        #[arg(long)]
        user_data_dir: Option<String>,
        #[arg(long)]
        model: Option<String>,
        #[arg(long)]
        reasoning_effort: Option<String>,
        #[arg(long)]
        alias: Option<String>,
        #[arg(long)]
        category: Option<String>,
        #[arg(long)]
        note: Option<String>,
        #[arg(long)]
        auth_source: Option<String>,
        #[arg(long)]
        confirm_sensitive: bool,
        #[arg(long)]
        server: bool,
    },
    /// Update rCodexManager alias, category, or note metadata.
    Update {
        #[arg(long)]
        name: String,
        #[arg(long)]
        alias: Option<String>,
        #[arg(long)]
        category: Option<String>,
        #[arg(long)]
        note: Option<String>,
    },
    /// Hide a stopped custom profile from active lists while keeping all data.
    Archive {
        #[arg(long)]
        name: String,
    },
    /// Return an archived profile to active lists.
    Restore {
        #[arg(long)]
        name: String,
    },
    /// Remove a custom launcher and optionally archive its data.
    Delete {
        #[arg(long)]
        name: String,
        #[arg(long)]
        archive_data: bool,
    },
    /// Archive and rebuild a custom profile configuration.
    Reset {
        #[arg(long)]
        name: String,
        #[arg(long)]
        model: Option<String>,
        #[arg(long)]
        reasoning_effort: Option<String>,
        #[arg(long)]
        keep_user_data: bool,
    },
    /// Launch one Codex desktop profile.
    Launch {
        #[arg(long)]
        name: String,
    },
    /// Terminate a running custom Codex profile.
    #[command(alias = "stop")]
    Terminate {
        #[arg(long)]
        name: String,
    },
    /// Fetch the selected profile's read-only usage snapshot.
    Quota {
        #[arg(long)]
        name: String,
    },
    /// Sign in one profile with ChatGPT. Use --device-auth on headless hosts.
    Login {
        #[arg(long)]
        name: String,
        #[arg(long)]
        device_auth: bool,
    },
    /// Import trusted auth material into a stopped custom profile.
    #[command(name = "import-auth")]
    ImportAuth {
        #[arg(long)]
        name: String,
        #[arg(long, value_name = "PATH")]
        source: String,
        #[arg(long)]
        confirm_sensitive: bool,
    },
    /// Manage local auth backups and application history.
    Auth {
        #[command(subcommand)]
        command: AuthCommands,
    },
    /// Page through session indexes and read selected details.
    Sessions {
        #[command(subcommand)]
        command: SessionCommands,
    },
    /// Inspect or safely update a profile's model configuration.
    Model {
        #[command(subcommand)]
        command: ProfileModelCommands,
    },
    /// Manage per-profile WeChat ACP bridges.
    Wechat {
        #[command(subcommand)]
        command: WechatCommands,
    },
    /// Manage the external codex-remote Feishu instance.
    Feishu {
        #[command(subcommand)]
        command: FeishuCommands,
    },
    /// Inspect, test, apply, or restore model routing.
    #[command(name = "model-route")]
    ModelRoute {
        #[command(subcommand)]
        command: ModelRouteCommands,
    },
}

#[derive(Debug, Subcommand)]
pub enum ProfileModelCommands {
    /// Update only model fields in config.toml after backing it up.
    Set {
        #[arg(long)]
        name: String,
        #[arg(long)]
        model: String,
        #[arg(long)]
        reasoning_effort: Option<String>,
    },
}

#[derive(Debug, Subcommand)]
pub enum AuthCommands {
    /// List profile auth slots, backups, and recent applications.
    List,
    /// Back up auth.json from one profile.
    Backup {
        #[arg(long)]
        name: String,
        #[arg(long)]
        label: Option<String>,
    },
    /// Back up auth.json from multiple profiles with per-item results.
    #[command(name = "backup-many")]
    BackupMany {
        #[arg(long = "name", required = true)]
        names: Vec<String>,
        #[arg(long)]
        label: Option<String>,
    },
    /// Apply a valid backup to a stopped custom profile.
    Apply {
        #[arg(long)]
        backup_id: String,
        #[arg(long)]
        target: String,
        #[arg(long)]
        confirm_sensitive: bool,
    },
    /// Restore the auth state recorded before an application.
    Rollback {
        #[arg(long)]
        application_id: String,
        #[arg(long)]
        confirm_sensitive: bool,
    },
    /// Change a backup label, note, or pinned state.
    Update {
        #[arg(long)]
        backup_id: String,
        #[arg(long)]
        label: Option<String>,
        #[arg(long)]
        note: Option<String>,
        #[arg(long, conflicts_with = "note")]
        clear_note: bool,
        #[arg(long, conflicts_with = "unpin")]
        pin: bool,
        #[arg(long, conflicts_with = "pin")]
        unpin: bool,
    },
    /// Permanently remove one vault backup after confirmation.
    Delete {
        #[arg(long)]
        backup_id: String,
        #[arg(long)]
        confirm_sensitive: bool,
    },
    /// Export one backup as a portable rcodex-auth package.
    Export {
        #[arg(long)]
        backup_id: String,
        #[arg(long)]
        confirm_sensitive: bool,
    },
    /// Validate and summarize an import package without writing files.
    #[command(name = "preview-import")]
    PreviewImport {
        #[arg(long, value_name = "PATH")]
        file: PathBuf,
    },
    /// Import a validated rcodex-auth package into the vault.
    Import {
        #[arg(long, value_name = "PATH")]
        file: PathBuf,
        #[arg(long)]
        label: Option<String>,
        #[arg(long)]
        note: Option<String>,
        #[arg(long)]
        pinned: bool,
        #[arg(long)]
        confirm_sensitive: bool,
    },
    /// Remove duplicate backups for one account, preserving the preferred copy.
    Cleanup {
        #[arg(long)]
        account_key: String,
        #[arg(long)]
        confirm_sensitive: bool,
    },
}

#[derive(Debug, Subcommand)]
pub enum SessionCommands {
    /// List a bounded page of session index entries.
    List {
        #[arg(long)]
        profile: Option<String>,
        #[arg(long)]
        category: Option<String>,
        #[arg(long)]
        query: Option<String>,
        #[arg(long, default_value_t = 0)]
        offset: usize,
        #[arg(long, default_value_t = 20)]
        limit: usize,
    },
    /// Read the bounded summary/source detail for one session.
    Detail {
        #[arg(long)]
        profile: String,
        #[arg(long)]
        session_id: String,
        #[arg(long)]
        updated_at: Option<String>,
    },
}

#[derive(Debug, Subcommand)]
pub enum WechatCommands {
    /// Show all bridges or one profile bridge.
    Status {
        #[arg(long)]
        name: Option<String>,
    },
    /// Start a profile's bridge and QR flow.
    Start {
        #[arg(long)]
        name: String,
    },
    /// Stop a profile's managed bridge process.
    Stop {
        #[arg(long)]
        name: String,
    },
    /// Stop and start a profile's managed bridge.
    Restart {
        #[arg(long)]
        name: String,
    },
    /// Stop the bridge and archive its binding token.
    Unbind {
        #[arg(long)]
        name: String,
        #[arg(long)]
        confirm_sensitive: bool,
    },
    /// Read a bounded, redacted bridge log tail.
    Log {
        #[arg(long)]
        name: String,
        #[arg(long)]
        lines: Option<usize>,
    },
    /// Stop an optional source bridge and start the target bridge.
    Switch {
        #[arg(long)]
        from: Option<String>,
        #[arg(long)]
        to: String,
    },
    /// Render or install a user-level systemd service.
    Service {
        #[arg(long)]
        name: String,
        #[arg(long)]
        install: bool,
        #[arg(long)]
        enable: bool,
        #[arg(long)]
        now: bool,
    },
}

#[derive(Debug, Subcommand)]
pub enum FeishuCommands {
    /// Inspect installation, binding, process, and gateway state.
    Status,
    /// Bind the isolated external runtime to a Codex profile.
    Configure {
        #[arg(long)]
        name: String,
        #[arg(long, value_name = "PATH")]
        binary: Option<String>,
    },
    /// Configure and start the isolated external runtime.
    Start {
        #[arg(long)]
        name: String,
        #[arg(long, value_name = "PATH")]
        binary: Option<String>,
    },
    /// Stop the managed external runtime process.
    Stop,
    /// Restart the managed external runtime process.
    Restart,
    /// Read a bounded, redacted runtime log tail.
    Log {
        #[arg(long)]
        lines: Option<usize>,
    },
    /// Open WebSetup, Admin, or the upstream project page.
    Open {
        #[arg(value_enum)]
        page: CliFeishuPage,
    },
}

#[derive(Debug, Clone, ValueEnum)]
pub enum CliFeishuPage {
    Setup,
    Admin,
    Project,
}

impl From<CliFeishuPage> for FeishuRemotePage {
    fn from(value: CliFeishuPage) -> Self {
        match value {
            CliFeishuPage::Setup => FeishuRemotePage::Setup,
            CliFeishuPage::Admin => FeishuRemotePage::Admin,
            CliFeishuPage::Project => FeishuRemotePage::Project,
        }
    }
}

#[derive(Debug, Clone, ValueEnum)]
pub enum CliModelRoutePreset {
    #[value(name = "aliyun-qwen")]
    AliyunQwen,
    #[value(name = "glm")]
    Glm,
    #[value(name = "local-openai")]
    LocalOpenai,
    #[value(name = "custom-responses")]
    CustomResponses,
}

impl From<CliModelRoutePreset> for ModelRoutePreset {
    fn from(value: CliModelRoutePreset) -> Self {
        match value {
            CliModelRoutePreset::AliyunQwen => ModelRoutePreset::AliyunQwen,
            CliModelRoutePreset::Glm => ModelRoutePreset::Glm,
            CliModelRoutePreset::LocalOpenai => ModelRoutePreset::LocalOpenai,
            CliModelRoutePreset::CustomResponses => ModelRoutePreset::CustomResponses,
        }
    }
}

#[derive(Debug, Subcommand)]
pub enum ModelRouteCommands {
    /// Inspect profile routes, presets, and proxy diagnostics.
    Status {
        #[arg(long)]
        name: Option<String>,
    },
    /// Probe the default local Responses proxy without changing it.
    Proxy,
    /// Preview the config change without writing config.toml.
    Preview {
        #[arg(long)]
        name: String,
        #[arg(long, value_enum)]
        preset: CliModelRoutePreset,
        #[arg(long)]
        model: String,
        #[arg(long)]
        reasoning_effort: Option<String>,
        #[arg(long)]
        proxy_base_url: Option<String>,
        #[arg(long)]
        upstream_base_url: Option<String>,
        #[arg(long)]
        api_key_env: Option<String>,
    },
    /// Apply a previewed route to a stopped custom profile.
    Apply {
        #[arg(long)]
        name: String,
        #[arg(long, value_enum)]
        preset: CliModelRoutePreset,
        #[arg(long)]
        model: String,
        #[arg(long)]
        reasoning_effort: Option<String>,
        #[arg(long)]
        proxy_base_url: Option<String>,
        #[arg(long)]
        upstream_base_url: Option<String>,
        #[arg(long)]
        api_key_env: Option<String>,
        #[arg(long)]
        confirm_sensitive: bool,
    },
    /// Remove rCodexManager route fields from a stopped custom profile.
    Restore {
        #[arg(long)]
        name: String,
        #[arg(long)]
        confirm_sensitive: bool,
    },
    /// Run a minimal Responses self-check using the saved profile route.
    Check {
        #[arg(long)]
        name: String,
    },
    /// Test current draft fields without writing config.toml.
    #[command(name = "test-draft")]
    TestDraft {
        #[arg(long)]
        name: String,
        #[arg(long, value_enum)]
        preset: CliModelRoutePreset,
        #[arg(long)]
        model: String,
        #[arg(long)]
        reasoning_effort: Option<String>,
        #[arg(long)]
        proxy_base_url: Option<String>,
        #[arg(long)]
        upstream_base_url: Option<String>,
        #[arg(long)]
        api_key_env: Option<String>,
    },
}

#[derive(Debug)]
pub enum CliOutcome {
    LaunchDesktop,
    Exit(i32),
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct AppInfo {
    name: &'static str,
    binary: &'static str,
    version: &'static str,
    identifier: &'static str,
    family: &'static str,
    architecture: &'static str,
    default_command: &'static str,
    desktop_available: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct FlagInfo {
    flag: &'static str,
    description: &'static str,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct CapabilityInfo {
    command: &'static str,
    description: &'static str,
    json_supported: bool,
    reads_files: bool,
    writes_files: bool,
    examples: Vec<&'static str>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct CapabilityManifest {
    global_flags: Vec<FlagInfo>,
    commands: Vec<CapabilityInfo>,
}

fn app_info(desktop_available: bool) -> AppInfo {
    AppInfo {
        name: app_name(),
        binary: binary_name(),
        version: env!("CARGO_PKG_VERSION"),
        identifier: app_identifier(),
        family: "r",
        architecture: "simple-tool",
        default_command: if desktop_available { "desktop" } else { "info" },
        desktop_available,
    }
}

fn capability_manifest(desktop_available: bool) -> CapabilityManifest {
    let model_route_description = if desktop_available {
        "Inspect, preview, test, apply, or restore Codex model routing config for stopped non-default profiles; inspect the desktop-owned proxy."
    } else {
        "Inspect, preview, test, apply, or restore Codex model routing config for stopped non-default profiles. Headless nodes can inspect proxy status but do not own the desktop built-in proxy lifecycle."
    };
    let mut manifest = CapabilityManifest {
        global_flags: vec![
            FlagInfo {
                flag: "--json",
                description: "Return a single machine-friendly JSON object.",
            },
            FlagInfo {
                flag: "--shell-rc <PATH>",
                description: "Use an explicit Bash or Zsh startup file instead of auto-detection.",
            },
            FlagInfo {
                flag: "--home <PATH>",
                description: "Use an explicit home directory for testing or automation.",
            },
        ],
        commands: vec![
            CapabilityInfo {
                command: "desktop",
                description: "Launch the desktop workspace.",
                json_supported: false,
                reads_files: true,
                writes_files: false,
                examples: vec!["rcodexmanager desktop"],
            },
            CapabilityInfo {
                command: "info",
                description: "Show app identity and family metadata.",
                json_supported: true,
                reads_files: false,
                writes_files: false,
                examples: vec!["rcodexmanager info --json"],
            },
            CapabilityInfo {
                command: "capabilities",
                description: "List available CLI operations and usage hints.",
                json_supported: true,
                reads_files: false,
                writes_files: false,
                examples: vec!["rcodexmanager capabilities --json"],
            },
            CapabilityInfo {
                command: "doctor",
                description: "Run read-only checks for profiles, auth backups, remote channels, and model routing; output is redacted for support sharing.",
                json_supported: true,
                reads_files: true,
                writes_files: false,
                examples: vec!["rcodexmanager doctor --json"],
            },
            CapabilityInfo {
                command: "list",
                description: "Read the detected Bash or Zsh startup file and list Codex launcher profiles.",
                json_supported: true,
                reads_files: true,
                writes_files: false,
                examples: vec!["rcodexmanager list --json"],
            },
            CapabilityInfo {
                command: "sessions",
                description: "Page through session indexes and lazily read one selected session detail without scanning every JSONL body.",
                json_supported: true,
                reads_files: true,
                writes_files: false,
                examples: vec![
                    "rcodexmanager sessions list --profile codex-g --limit 20 --json",
                    "rcodexmanager sessions detail --profile codex-g --session-id <id> --json",
                ],
            },
            CapabilityInfo {
                command: "create",
                description: "Create profile directories, config.toml, a shell launcher function, and optional local metadata.",
                json_supported: true,
                reads_files: true,
                writes_files: true,
                examples: vec![
                    "rcodexmanager create --name codex-f --model gpt-5.5 --reasoning-effort xhigh --alias Draft --category 深度 --json",
                    "rcodexmanager create --name codex-o --server --json",
                ],
            },
            CapabilityInfo {
                command: "copy",
                description: "Copy one profile into a new launcher command, preserving config and metadata, with optional trusted auth.json copy.",
                json_supported: true,
                reads_files: true,
                writes_files: true,
                examples: vec![
                    "rcodexmanager copy --source codex-b --name codex-f --auth-source codex-b --confirm-sensitive --json",
                    "rcodexmanager copy --source codex --name codex-o --server --auth-source codex --confirm-sensitive --json",
                ],
            },
            CapabilityInfo {
                command: "update",
                description: "Set a profile alias, category, or note in rCodexManager's local metadata file.",
                json_supported: true,
                reads_files: true,
                writes_files: true,
                examples: vec![
                    "rcodexmanager update --name codex-f --alias 主力 --category 平衡 --note 日常使用 --json",
                ],
            },
            CapabilityInfo {
                command: "archive",
                description: "Hide a stopped custom profile from active lists without changing its launcher, authentication, sessions, configuration, or data directories.",
                json_supported: true,
                reads_files: true,
                writes_files: true,
                examples: vec!["rcodexmanager archive --name codex-f --json"],
            },
            CapabilityInfo {
                command: "restore",
                description: "Return an archived profile to active lists without rebuilding or moving its data.",
                json_supported: true,
                reads_files: true,
                writes_files: true,
                examples: vec!["rcodexmanager restore --name codex-f --json"],
            },
            CapabilityInfo {
                command: "model set",
                description: "Back up config.toml and update only the model and reasoning effort for a stopped custom profile, preserving auth, sessions, provider routing, and user data.",
                json_supported: true,
                reads_files: true,
                writes_files: true,
                examples: vec![
                    "rcodexmanager model set --name codex-f --model gpt-5.5 --reasoning-effort xhigh --json",
                ],
            },
            CapabilityInfo {
                command: "delete",
                description: "Remove a launcher function; --archive-data also moves profile directories aside.",
                json_supported: true,
                reads_files: true,
                writes_files: true,
                examples: vec!["rcodexmanager delete --name codex-f --archive-data --json"],
            },
            CapabilityInfo {
                command: "reset",
                description: "Archive profile data directories, recreate them, and write a fresh config.toml; use --keep-user-data to preserve the app user-data-dir.",
                json_supported: true,
                reads_files: true,
                writes_files: true,
                examples: vec![
                    "rcodexmanager reset --name codex-f --model gpt-5.5 --reasoning-effort medium --json",
                ],
            },
            CapabilityInfo {
                command: "launch",
                description: "Launch Codex with the profile's CODEX_HOME and user-data-dir.",
                json_supported: true,
                reads_files: true,
                writes_files: true,
                examples: vec!["rcodexmanager launch --name codex-f --json"],
            },
            CapabilityInfo {
                command: "terminate",
                description: "Terminate the running Codex main process for one profile; alias: stop.",
                json_supported: true,
                reads_files: true,
                writes_files: false,
                examples: vec!["rcodexmanager terminate --name codex-f --json"],
            },
            CapabilityInfo {
                command: "quota",
                description: "Read a profile auth.json and fetch a read-only ChatGPT usage snapshot without storing tokens.",
                json_supported: true,
                reads_files: true,
                writes_files: false,
                examples: vec!["rcodexmanager quota --name codex-f --json"],
            },
            CapabilityInfo {
                command: "login",
                description: "Run the official Codex ChatGPT login flow for one profile. Use --device-auth on a remote or headless host.",
                json_supported: false,
                reads_files: true,
                writes_files: true,
                examples: vec![
                    "rcodexmanager login --name codex-f",
                    "rcodexmanager login --name codex-f --device-auth",
                ],
            },
            CapabilityInfo {
                command: "import-auth",
                description: "Import a trusted auth.json or ChatGPT session JSON into one stopped profile, backing up the previous auth.json first.",
                json_supported: true,
                reads_files: true,
                writes_files: true,
                examples: vec![
                    "rcodexmanager import-auth --name codex-f --source /path/to/auth.json --confirm-sensitive --json",
                ],
            },
            CapabilityInfo {
                command: "auth",
                description: "Manage the auth vault: inspect, batch backup, preview/import/export packages, update metadata, apply, roll back, clean up, or delete.",
                json_supported: true,
                reads_files: true,
                writes_files: true,
                examples: vec![
                    "rcodexmanager auth list --json",
                    "rcodexmanager auth backup --name codex-o --label Server --json",
                    "rcodexmanager auth backup-many --name codex-b --name codex-g --label Snapshot --json",
                    "rcodexmanager auth preview-import --file ./backup.rcodex-auth.json --json",
                    "rcodexmanager auth apply --backup-id <id> --target codex-o --confirm-sensitive --json",
                ],
            },
            CapabilityInfo {
                command: "wechat",
                description: "Manage server-friendly WeChat bridges: status, start, stop, restart, recoverable unbind, logs, switching, and systemd services.",
                json_supported: true,
                reads_files: true,
                writes_files: true,
                examples: vec![
                    "rcodexmanager wechat status --json",
                    "rcodexmanager wechat start --name codex-o --json",
                    "rcodexmanager wechat unbind --name codex-o --confirm-sensitive --json",
                    "rcodexmanager wechat service --name codex-o --install --enable --now --json",
                ],
            },
            CapabilityInfo {
                command: "feishu",
                description: "Bind a Codex profile to an external codex-remote runtime and manage its local Feishu Bot service without storing App credentials.",
                json_supported: true,
                reads_files: true,
                writes_files: true,
                examples: vec![
                    "rcodexmanager feishu status --json",
                    "rcodexmanager feishu configure --name codex-g --json",
                    "rcodexmanager feishu start --name codex-g --json",
                    "rcodexmanager feishu open setup --json",
                ],
            },
            CapabilityInfo {
                command: "model-route",
                description: model_route_description,
                json_supported: true,
                reads_files: true,
                writes_files: true,
                examples: vec![
                    "rcodexmanager model-route status --json",
                    "rcodexmanager model-route proxy --json",
                    "rcodexmanager model-route preview --name codex-g --preset aliyun-qwen --model qwen3-coder-plus --json",
                    "rcodexmanager model-route preview --name codex-g --preset glm --model glm-4.6 --proxy-base-url http://127.0.0.1:15721/v1 --upstream-base-url https://open.bigmodel.cn/api/paas/v4 --json",
                    "rcodexmanager model-route test-draft --name codex-g --preset glm --model glm-4.6 --upstream-base-url https://open.bigmodel.cn/api/paas/v4 --api-key-env ZAI_API_KEY --json",
                    "rcodexmanager model-route apply --name codex-g --preset glm --model glm-4.6 --proxy-base-url http://127.0.0.1:15721/v1 --upstream-base-url https://open.bigmodel.cn/api/paas/v4 --api-key-env ZAI_API_KEY --confirm-sensitive --json",
                ],
            },
        ],
    };
    if !desktop_available {
        manifest
            .commands
            .retain(|command| command.command != "desktop");
    }
    manifest
}

fn print_info(info: &AppInfo) {
    println!("{} {}", info.name, info.version);
    println!("binary: {}", info.binary);
    println!("identifier: {}", info.identifier);
    println!("family: {}", info.family);
    println!("architecture: {}", info.architecture);
    println!("default command: {}", info.default_command);
    println!("desktop available: {}", info.desktop_available);
}

fn print_capabilities(manifest: &CapabilityManifest) {
    println!("global flags:");
    for flag in &manifest.global_flags {
        println!("  {}: {}", flag.flag, flag.description);
    }
    println!();
    println!("commands:");
    for command in &manifest.commands {
        println!("  {}", command.command);
        println!("    {}", command.description);
        if let Some(example) = command.examples.first() {
            println!("    example: {example}");
        }
    }
}

fn print_doctor(report: &DoctorReport) {
    println!(
        "doctor: {} ok, {} warning, {} error ({})",
        report.summary.ok_count,
        report.summary.warning_count,
        report.summary.error_count,
        report.platform
    );
    for check in &report.checks {
        let status = match check.status {
            crate::core::DoctorCheckStatus::Ok => "ok",
            crate::core::DoctorCheckStatus::Warning => "warning",
            crate::core::DoctorCheckStatus::Error => "error",
        };
        println!("  [{status}] {}: {}", check.label, check.message);
        for detail in &check.details {
            println!("    - {detail}");
        }
    }
}

pub fn run_from_env() -> CliOutcome {
    run_from_env_with_desktop(true)
}

pub fn run_from_env_with_desktop(desktop_available: bool) -> CliOutcome {
    let raw_args: Vec<_> = std::env::args_os().collect();
    let wants_json = raw_args.iter().any(|arg| arg == OsStr::new("--json"));
    let cli = match Cli::try_parse_from(raw_args) {
        Ok(cli) => cli,
        Err(error) => return emit_parse_error(wants_json, error),
    };

    let context = match ProfileContext::from_options(cli.zshrc.clone(), cli.home.clone()) {
        Ok(context) => context,
        Err(message) => return emit_error(cli.json, "invalid_arguments", &message, 2),
    };

    match cli.command {
        None | Some(Commands::Desktop) if desktop_available => CliOutcome::LaunchDesktop,
        None | Some(Commands::Desktop) => emit_error(
            cli.json,
            "desktop_unavailable",
            "This is the headless server CLI; pass a CLI command such as info, doctor, or list.",
            2,
        ),
        Some(Commands::Info) => {
            let info = app_info(desktop_available);
            emit_success(cli.json, "info", &info);
            if !cli.json {
                print_info(&info);
            }
            CliOutcome::Exit(0)
        }
        Some(Commands::Capabilities) => {
            let manifest = capability_manifest(desktop_available);
            emit_success(cli.json, "capabilities", &manifest);
            if !cli.json {
                print_capabilities(&manifest);
            }
            CliOutcome::Exit(0)
        }
        Some(Commands::Doctor) => match run_doctor(&context) {
            Ok(report) => {
                let exit_code = if report.summary.error_count == 0 {
                    0
                } else {
                    1
                };
                emit_success(cli.json, "doctor", &report);
                if !cli.json {
                    print_doctor(&report);
                }
                CliOutcome::Exit(exit_code)
            }
            Err(message) => emit_error(cli.json, "doctor_failed", &message, 1),
        },
        Some(Commands::List) => match list_profiles(&context) {
            Ok(report) => {
                emit_success(cli.json, "list", &report);
                if !cli.json {
                    for profile in report.profiles {
                        let status = if profile.is_running {
                            "running"
                        } else {
                            "idle"
                        };
                        println!(
                            "{} [{}] -> {} ({}/{})",
                            profile.name,
                            status,
                            profile.codex_home,
                            profile.model.unwrap_or_else(|| "unknown".to_string()),
                            profile
                                .reasoning_effort
                                .unwrap_or_else(|| "unknown".to_string())
                        );
                    }
                }
                CliOutcome::Exit(0)
            }
            Err(message) => emit_error(cli.json, "list_failed", &message, 1),
        },
        Some(Commands::Create {
            name,
            codex_home,
            user_data_dir,
            model,
            reasoning_effort,
            alias,
            category,
            note,
            server,
        }) => match create_profile(
            &context,
            CreateProfileInput {
                name,
                codex_home,
                user_data_dir,
                model,
                reasoning_effort,
                alias,
                category,
                note,
                launcher_kind: server.then_some(ProfileLauncherKind::Server),
            },
        ) {
            Ok(report) => {
                emit_success(cli.json, "create", &report);
                if !cli.json {
                    println!("{}", report.message);
                }
                CliOutcome::Exit(0)
            }
            Err(message) => emit_action_error(cli.json, &message),
        },
        Some(Commands::Copy {
            source,
            name,
            codex_home,
            user_data_dir,
            model,
            reasoning_effort,
            alias,
            category,
            note,
            auth_source,
            confirm_sensitive,
            server,
        }) => match copy_profile(
            &context,
            CopyProfileInput {
                source_name: source,
                name,
                codex_home,
                user_data_dir,
                model,
                reasoning_effort,
                alias,
                category,
                note,
                auth_source_name: auth_source,
                confirm_sensitive,
                launcher_kind: server.then_some(ProfileLauncherKind::Server),
            },
        ) {
            Ok(report) => {
                emit_success(cli.json, "copy", &report);
                if !cli.json {
                    println!("{}", report.message);
                }
                CliOutcome::Exit(0)
            }
            Err(message) => emit_action_error(cli.json, &message),
        },
        Some(Commands::Update {
            name,
            alias,
            category,
            note,
        }) => match update_profile_metadata(
            &context,
            ProfileMetadataInput {
                name,
                alias,
                category,
                note,
            },
        ) {
            Ok(report) => {
                emit_success(cli.json, "update", &report);
                if !cli.json {
                    println!("{}", report.message);
                }
                CliOutcome::Exit(0)
            }
            Err(message) => emit_action_error(cli.json, &message),
        },
        Some(Commands::Archive { name }) => match archive_profile(&context, &name) {
            Ok(report) => {
                emit_success(cli.json, "archive", &report);
                if !cli.json {
                    println!("{}", report.message);
                }
                CliOutcome::Exit(0)
            }
            Err(message) => emit_action_error(cli.json, &message),
        },
        Some(Commands::Restore { name }) => match restore_archived_profile(&context, &name) {
            Ok(report) => {
                emit_success(cli.json, "restore", &report);
                if !cli.json {
                    println!("{}", report.message);
                }
                CliOutcome::Exit(0)
            }
            Err(message) => emit_action_error(cli.json, &message),
        },
        Some(Commands::Delete { name, archive_data }) => {
            match delete_profile(&context, &name, archive_data) {
                Ok(report) => {
                    emit_success(cli.json, "delete", &report);
                    if !cli.json {
                        println!("{}", report.message);
                    }
                    CliOutcome::Exit(0)
                }
                Err(message) => emit_action_error(cli.json, &message),
            }
        }
        Some(Commands::Reset {
            name,
            model,
            reasoning_effort,
            keep_user_data,
        }) => match reset_profile(
            &context,
            ResetProfileInput {
                name,
                model,
                reasoning_effort,
                reset_user_data: !keep_user_data,
            },
        ) {
            Ok(report) => {
                emit_success(cli.json, "reset", &report);
                if !cli.json {
                    println!("{}", report.message);
                }
                CliOutcome::Exit(0)
            }
            Err(message) => emit_action_error(cli.json, &message),
        },
        Some(Commands::Model { command }) => match command {
            ProfileModelCommands::Set {
                name,
                model,
                reasoning_effort,
            } => match update_profile_model(
                &context,
                UpdateProfileModelInput {
                    profile_name: name,
                    model,
                    reasoning_effort,
                },
            ) {
                Ok(report) => {
                    emit_success(cli.json, "model-set", &report);
                    if !cli.json {
                        println!("{}", report.message);
                    }
                    CliOutcome::Exit(0)
                }
                Err(message) => emit_action_error(cli.json, &message),
            },
        },
        Some(Commands::Launch { name }) => match launch_profile(&context, &name) {
            Ok(report) => {
                emit_success(cli.json, "launch", &report);
                if !cli.json {
                    println!("{}", report.message);
                }
                CliOutcome::Exit(0)
            }
            Err(message) => emit_action_error(cli.json, &message),
        },
        Some(Commands::Terminate { name }) => match terminate_profile(&context, &name) {
            Ok(report) => {
                emit_success(cli.json, "terminate", &report);
                if !cli.json {
                    println!("{}", report.message);
                }
                CliOutcome::Exit(0)
            }
            Err(message) => emit_action_error(cli.json, &message),
        },
        Some(Commands::Quota { name }) => match read_profile_quota(&context, &name) {
            Ok(report) => {
                emit_success(cli.json, "quota", &report);
                if !cli.json {
                    println!(
                        "{} quota windows: {}",
                        report.profile_name,
                        report.windows.len()
                    );
                }
                CliOutcome::Exit(0)
            }
            Err(message) => emit_action_error(cli.json, &message),
        },
        Some(Commands::Login { name, device_auth }) => {
            if cli.json {
                emit_error(
                    true,
                    "streaming_command",
                    "login is an interactive streaming command and does not support --json",
                    2,
                )
            } else {
                match run_profile_login_foreground(&context, &name, device_auth) {
                    Ok(()) => {
                        println!("authentication completed for {name}");
                        CliOutcome::Exit(0)
                    }
                    Err(message) => emit_action_error(false, &message),
                }
            }
        }
        Some(Commands::ImportAuth {
            name,
            source,
            confirm_sensitive,
        }) => match import_profile_auth(
            &context,
            ImportAuthInput {
                name,
                source_path: source,
                confirm_sensitive,
            },
        ) {
            Ok(report) => {
                emit_success(cli.json, "import-auth", &report);
                if !cli.json {
                    println!("{}", report.message);
                }
                CliOutcome::Exit(0)
            }
            Err(message) => emit_action_error(cli.json, &message),
        },
        Some(Commands::Auth { command }) => match command {
            AuthCommands::List => match list_auth_vault(&context) {
                Ok(report) => {
                    emit_success(cli.json, "auth-list", &report);
                    if !cli.json {
                        println!(
                            "auth vault: {} backup(s), {} profile(s)",
                            report.backup_count, report.profile_count
                        );
                    }
                    CliOutcome::Exit(0)
                }
                Err(message) => emit_action_error(cli.json, &message),
            },
            AuthCommands::Backup { name, label } => {
                match create_auth_backup(&context, CreateAuthBackupInput { name, label }) {
                    Ok(report) => {
                        emit_success(cli.json, "auth-backup", &report);
                        if !cli.json {
                            println!("auth vault: {} backup(s)", report.backup_count);
                        }
                        CliOutcome::Exit(0)
                    }
                    Err(message) => emit_action_error(cli.json, &message),
                }
            }
            AuthCommands::BackupMany { names, label } => match create_auth_backups(
                &context,
                CreateAuthBackupsInput {
                    profile_names: names,
                    label,
                },
            ) {
                Ok(report) => {
                    emit_success(cli.json, "auth-backup-many", &report);
                    if !cli.json {
                        println!(
                            "auth backups: {} succeeded, {} failed",
                            report.success_count, report.failure_count
                        );
                    }
                    CliOutcome::Exit(0)
                }
                Err(message) => emit_action_error(cli.json, &message),
            },
            AuthCommands::Apply {
                backup_id,
                target,
                confirm_sensitive,
            } => match apply_auth_backup(
                &context,
                ApplyAuthBackupInput {
                    backup_id,
                    target_profile_name: target,
                    confirm_sensitive,
                },
            ) {
                Ok(report) => {
                    emit_success(cli.json, "auth-apply", &report);
                    if !cli.json {
                        println!("{}", report.message);
                    }
                    CliOutcome::Exit(0)
                }
                Err(message) => emit_action_error(cli.json, &message),
            },
            AuthCommands::Rollback {
                application_id,
                confirm_sensitive,
            } => match rollback_auth_application(
                &context,
                RollbackAuthApplicationInput {
                    application_id,
                    confirm_sensitive,
                },
            ) {
                Ok(report) => {
                    emit_success(cli.json, "auth-rollback", &report);
                    if !cli.json {
                        println!("{}", report.message);
                    }
                    CliOutcome::Exit(0)
                }
                Err(message) => emit_action_error(cli.json, &message),
            },
            AuthCommands::Update {
                backup_id,
                label,
                note,
                clear_note,
                pin,
                unpin,
            } => {
                let current = list_auth_vault(&context).and_then(|vault| {
                    vault
                        .backups
                        .into_iter()
                        .find(|backup| backup.id == backup_id)
                        .ok_or_else(|| format!("auth backup {backup_id} was not found"))
                });
                match current.and_then(|backup| {
                    update_auth_backup(
                        &context,
                        UpdateAuthBackupInput {
                            backup_id,
                            label: label.or(Some(backup.label)),
                            note: if clear_note {
                                None
                            } else {
                                note.or(backup.note)
                            },
                            pinned: if pin {
                                true
                            } else if unpin {
                                false
                            } else {
                                backup.pinned
                            },
                        },
                    )
                }) {
                    Ok(report) => {
                        emit_success(cli.json, "auth-update", &report);
                        if !cli.json {
                            println!("auth backup updated");
                        }
                        CliOutcome::Exit(0)
                    }
                    Err(message) => emit_action_error(cli.json, &message),
                }
            }
            AuthCommands::Delete {
                backup_id,
                confirm_sensitive,
            } => {
                if !confirm_sensitive {
                    emit_action_error(
                        cli.json,
                        "must confirm sensitive auth backup deletion before deleting files",
                    )
                } else {
                    match delete_auth_backup(&context, DeleteAuthBackupInput { backup_id }) {
                        Ok(report) => {
                            emit_success(cli.json, "auth-delete", &report);
                            if !cli.json {
                                println!("auth backup deleted");
                            }
                            CliOutcome::Exit(0)
                        }
                        Err(message) => emit_action_error(cli.json, &message),
                    }
                }
            }
            AuthCommands::Export {
                backup_id,
                confirm_sensitive,
            } => {
                if !confirm_sensitive {
                    emit_action_error(
                        cli.json,
                        "must confirm sensitive auth backup export before writing token material",
                    )
                } else {
                    match export_auth_backup(&context, ExportAuthBackupInput { backup_id }) {
                        Ok(report) => {
                            emit_success(cli.json, "auth-export", &report);
                            if !cli.json {
                                println!("{}", report.path);
                            }
                            CliOutcome::Exit(0)
                        }
                        Err(message) => emit_action_error(cli.json, &message),
                    }
                }
            }
            AuthCommands::PreviewImport { file } => {
                match read_json_text_file(&file).and_then(|package_json| {
                    preview_auth_backup_package(PreviewAuthBackupPackageInput { package_json })
                }) {
                    Ok(report) => {
                        emit_success(cli.json, "auth-preview-import", &report);
                        if !cli.json {
                            println!(
                                "{} [{}]",
                                report.label,
                                if report.valid { "valid" } else { "invalid" }
                            );
                        }
                        CliOutcome::Exit(0)
                    }
                    Err(message) => emit_action_error(cli.json, &message),
                }
            }
            AuthCommands::Import {
                file,
                label,
                note,
                pinned,
                confirm_sensitive,
            } => match read_json_text_file(&file).and_then(|package_json| {
                import_auth_backup_package(
                    &context,
                    ImportAuthBackupPackageInput {
                        package_json,
                        label,
                        note,
                        pinned,
                        confirm_sensitive,
                    },
                )
            }) {
                Ok(report) => {
                    emit_success(cli.json, "auth-import", &report);
                    if !cli.json {
                        println!("auth vault: {} backup(s)", report.backup_count);
                    }
                    CliOutcome::Exit(0)
                }
                Err(message) => emit_action_error(cli.json, &message),
            },
            AuthCommands::Cleanup {
                account_key,
                confirm_sensitive,
            } => match cleanup_auth_backups(
                &context,
                CleanupAuthBackupsInput {
                    account_key,
                    confirm_sensitive,
                },
            ) {
                Ok(report) => {
                    emit_success(cli.json, "auth-cleanup", &report);
                    if !cli.json {
                        println!("auth vault: {} backup(s)", report.backup_count);
                    }
                    CliOutcome::Exit(0)
                }
                Err(message) => emit_action_error(cli.json, &message),
            },
        },
        Some(Commands::Sessions { command }) => match command {
            SessionCommands::List {
                profile,
                category,
                query,
                offset,
                limit,
            } => match list_profile_sessions(
                &context,
                ListProfileSessionsInput {
                    profile_name: profile,
                    category,
                    query,
                    offset,
                    limit,
                },
            ) {
                Ok(report) => {
                    emit_success(cli.json, "sessions-list", &report);
                    if !cli.json {
                        for item in report.sessions {
                            println!(
                                "{} {} {}",
                                item.profile_name, item.session.id, item.session.title
                            );
                        }
                    }
                    CliOutcome::Exit(0)
                }
                Err(message) => emit_action_error(cli.json, &message),
            },
            SessionCommands::Detail {
                profile,
                session_id,
                updated_at,
            } => match read_profile_session_detail(
                &context,
                ReadProfileSessionDetailInput {
                    profile_name: profile,
                    session_id,
                    updated_at,
                },
            ) {
                Ok(report) => {
                    emit_success(cli.json, "sessions-detail", &report);
                    if !cli.json {
                        println!("{}\n{}", report.title, report.summary.unwrap_or_default());
                    }
                    CliOutcome::Exit(0)
                }
                Err(message) => emit_action_error(cli.json, &message),
            },
        },
        Some(Commands::Wechat { command }) => match command {
            WechatCommands::Status { name } => match list_wechat_bridges(&context) {
                Ok(mut report) => {
                    if let Some(name) = name {
                        report.bridges.retain(|bridge| bridge.profile_name == name);
                        report.bridge_count = report.bridges.len();
                        report.running_count = report
                            .bridges
                            .iter()
                            .filter(|bridge| bridge.running)
                            .count();
                    }
                    emit_success(cli.json, "wechat-status", &report);
                    if !cli.json {
                        for bridge in report.bridges {
                            let status = if bridge.running {
                                "running"
                            } else if bridge.token_exists {
                                "bound"
                            } else {
                                "idle"
                            };
                            println!(
                                "{} [{}] instance {}",
                                bridge.profile_name, status, bridge.instance
                            );
                        }
                    }
                    CliOutcome::Exit(0)
                }
                Err(message) => emit_action_error(cli.json, &message),
            },
            WechatCommands::Start { name } => {
                match start_wechat_bridge(&context, StartWechatBridgeInput { profile_name: name }) {
                    Ok(report) => {
                        emit_success(cli.json, "wechat-start", &report);
                        if !cli.json {
                            println!("wechat bridge running: {}", report.running_count);
                        }
                        CliOutcome::Exit(0)
                    }
                    Err(message) => emit_action_error(cli.json, &message),
                }
            }
            WechatCommands::Stop { name } => {
                match stop_wechat_bridge(&context, StopWechatBridgeInput { profile_name: name }) {
                    Ok(report) => {
                        emit_success(cli.json, "wechat-stop", &report);
                        if !cli.json {
                            println!("wechat bridge running: {}", report.running_count);
                        }
                        CliOutcome::Exit(0)
                    }
                    Err(message) => emit_action_error(cli.json, &message),
                }
            }
            WechatCommands::Restart { name } => match restart_wechat_bridge(
                &context,
                RestartWechatBridgeInput { profile_name: name },
            ) {
                Ok(report) => {
                    emit_success(cli.json, "wechat-restart", &report);
                    if !cli.json {
                        println!("wechat bridge running: {}", report.running_count);
                    }
                    CliOutcome::Exit(0)
                }
                Err(message) => emit_action_error(cli.json, &message),
            },
            WechatCommands::Unbind {
                name,
                confirm_sensitive,
            } => match unbind_wechat_bridge(
                &context,
                UnbindWechatBridgeInput {
                    profile_name: name,
                    confirm_sensitive,
                },
            ) {
                Ok(report) => {
                    emit_success(cli.json, "wechat-unbind", &report);
                    if !cli.json {
                        println!("wechat bridge binding archived");
                    }
                    CliOutcome::Exit(0)
                }
                Err(message) => emit_action_error(cli.json, &message),
            },
            WechatCommands::Log { name, lines } => match read_wechat_bridge_log(
                &context,
                ReadWechatBridgeLogInput {
                    profile_name: name,
                    lines,
                },
            ) {
                Ok(report) => {
                    emit_success(cli.json, "wechat-log", &report);
                    if !cli.json {
                        for line in report.log_tail {
                            println!("{line}");
                        }
                    }
                    CliOutcome::Exit(0)
                }
                Err(message) => emit_action_error(cli.json, &message),
            },
            WechatCommands::Switch { from, to } => {
                if let Some(from) = from {
                    if let Err(message) =
                        stop_wechat_bridge(&context, StopWechatBridgeInput { profile_name: from })
                    {
                        return emit_action_error(cli.json, &message);
                    }
                }
                match start_wechat_bridge(&context, StartWechatBridgeInput { profile_name: to }) {
                    Ok(report) => {
                        emit_success(cli.json, "wechat-switch", &report);
                        if !cli.json {
                            println!("wechat bridge running: {}", report.running_count);
                        }
                        CliOutcome::Exit(0)
                    }
                    Err(message) => emit_action_error(cli.json, &message),
                }
            }
            WechatCommands::Service {
                name,
                install,
                enable,
                now,
            } => match install_wechat_bridge_service(
                &context,
                InstallWechatBridgeServiceInput {
                    profile_name: name,
                    install,
                    enable,
                    now,
                },
            ) {
                Ok(report) => {
                    emit_success(cli.json, "wechat-service", &report);
                    if !cli.json {
                        if install || enable || now {
                            println!("{}", report.message);
                        } else {
                            print!("{}", report.unit_contents);
                        }
                    }
                    CliOutcome::Exit(0)
                }
                Err(message) => emit_action_error(cli.json, &message),
            },
        },
        Some(Commands::Feishu { command }) => match command {
            FeishuCommands::Status => match list_feishu_remote(&context) {
                Ok(report) => {
                    emit_success(cli.json, "feishu-status", &report);
                    if !cli.json {
                        println!(
                            "feishu [{}] profile {} gateways {}/{}",
                            report.connection_state,
                            report.profile_name.as_deref().unwrap_or("unbound"),
                            report.connected_gateway_count,
                            report.gateway_count
                        );
                    }
                    CliOutcome::Exit(0)
                }
                Err(message) => emit_action_error(cli.json, &message),
            },
            FeishuCommands::Configure { name, binary } => match configure_feishu_remote(
                &context,
                ConfigureFeishuRemoteInput {
                    profile_name: name,
                    binary_path: binary,
                },
            ) {
                Ok(report) => {
                    emit_success(cli.json, "feishu-configure", &report);
                    if !cli.json {
                        println!(
                            "feishu profile: {}",
                            report.profile_name.as_deref().unwrap_or("unbound")
                        );
                    }
                    CliOutcome::Exit(0)
                }
                Err(message) => emit_action_error(cli.json, &message),
            },
            FeishuCommands::Start { name, binary } => match start_feishu_remote(
                &context,
                StartFeishuRemoteInput {
                    profile_name: name,
                    binary_path: binary,
                },
            ) {
                Ok(report) => {
                    emit_success(cli.json, "feishu-start", &report);
                    if !cli.json {
                        println!("feishu: {}", report.connection_state);
                    }
                    CliOutcome::Exit(0)
                }
                Err(message) => emit_action_error(cli.json, &message),
            },
            FeishuCommands::Stop => match stop_feishu_remote(&context) {
                Ok(report) => {
                    emit_success(cli.json, "feishu-stop", &report);
                    if !cli.json {
                        println!("feishu stopped");
                    }
                    CliOutcome::Exit(0)
                }
                Err(message) => emit_action_error(cli.json, &message),
            },
            FeishuCommands::Restart => match restart_feishu_remote(&context) {
                Ok(report) => {
                    emit_success(cli.json, "feishu-restart", &report);
                    if !cli.json {
                        println!("feishu: {}", report.connection_state);
                    }
                    CliOutcome::Exit(0)
                }
                Err(message) => emit_action_error(cli.json, &message),
            },
            FeishuCommands::Log { lines } => {
                match read_feishu_remote_log(&context, ReadFeishuRemoteLogInput { lines }) {
                    Ok(report) => {
                        emit_success(cli.json, "feishu-log", &report);
                        if !cli.json {
                            for line in report.log_tail {
                                println!("{line}");
                            }
                        }
                        CliOutcome::Exit(0)
                    }
                    Err(message) => emit_action_error(cli.json, &message),
                }
            }
            FeishuCommands::Open { page } => match open_feishu_remote_page(&context, page.into()) {
                Ok(url) => {
                    emit_success(cli.json, "feishu-open", &json!({ "url": url }));
                    if !cli.json {
                        println!("{url}");
                    }
                    CliOutcome::Exit(0)
                }
                Err(message) => emit_action_error(cli.json, &message),
            },
        },
        Some(Commands::ModelRoute { command }) => match command {
            ModelRouteCommands::Status { name } => match list_model_routes(&context) {
                Ok(mut report) => {
                    if let Some(name) = name {
                        report
                            .profiles
                            .retain(|profile| profile.profile_name == name);
                        report.profile_count = report.profiles.len();
                        report.routed_count = report
                            .profiles
                            .iter()
                            .filter(|profile| profile.routed)
                            .count();
                        report.needs_attention_count = report
                            .profiles
                            .iter()
                            .filter(|profile| profile.needs_attention)
                            .count();
                    }
                    emit_success(cli.json, "model-route-status", &report);
                    if !cli.json {
                        for profile in report.profiles {
                            println!(
                                "{} [{}] {}",
                                profile.profile_name,
                                profile.route_status_label,
                                profile.config_path
                            );
                        }
                    }
                    CliOutcome::Exit(0)
                }
                Err(message) => emit_action_error(cli.json, &message),
            },
            ModelRouteCommands::Proxy => {
                let report = read_model_route_proxy_status();
                emit_success(cli.json, "model-route-proxy", &report);
                if !cli.json {
                    println!(
                        "{} {} ({})",
                        report.base_url, report.status_label, report.message
                    );
                }
                CliOutcome::Exit(0)
            }
            ModelRouteCommands::Preview {
                name,
                preset,
                model,
                reasoning_effort,
                proxy_base_url,
                upstream_base_url,
                api_key_env,
            } => match preview_model_route(
                &context,
                PreviewModelRouteInput {
                    profile_name: name,
                    preset: preset.into(),
                    model,
                    reasoning_effort,
                    proxy_base_url,
                    upstream_base_url,
                    api_key: None,
                    api_key_env,
                },
            ) {
                Ok(report) => {
                    emit_success(cli.json, "model-route-preview", &report);
                    if !cli.json {
                        print!("{}", report.config_preview);
                    }
                    CliOutcome::Exit(0)
                }
                Err(message) => emit_action_error(cli.json, &message),
            },
            ModelRouteCommands::Apply {
                name,
                preset,
                model,
                reasoning_effort,
                proxy_base_url,
                upstream_base_url,
                api_key_env,
                confirm_sensitive,
            } => match apply_model_route(
                &context,
                ApplyModelRouteInput {
                    profile_name: name,
                    preset: preset.into(),
                    model,
                    reasoning_effort,
                    proxy_base_url,
                    upstream_base_url,
                    api_key: None,
                    api_key_env,
                    confirm_sensitive,
                },
            ) {
                Ok(report) => {
                    emit_success(cli.json, "model-route-apply", &report);
                    if !cli.json {
                        println!("{}", report.message);
                    }
                    CliOutcome::Exit(0)
                }
                Err(message) => emit_action_error(cli.json, &message),
            },
            ModelRouteCommands::Restore {
                name,
                confirm_sensitive,
            } => match restore_model_route(
                &context,
                RestoreModelRouteInput {
                    profile_name: name,
                    confirm_sensitive,
                },
            ) {
                Ok(report) => {
                    emit_success(cli.json, "model-route-restore", &report);
                    if !cli.json {
                        println!("{}", report.message);
                    }
                    CliOutcome::Exit(0)
                }
                Err(message) => emit_action_error(cli.json, &message),
            },
            ModelRouteCommands::Check { name } => match check_model_route_proxy(
                &context,
                CheckModelRouteProxyInput { profile_name: name },
            ) {
                Ok(report) => {
                    emit_success(cli.json, "model-route-check", &report);
                    if !cli.json {
                        println!(
                            "{} {} ({})",
                            report.profile_name, report.status_label, report.message
                        );
                    }
                    CliOutcome::Exit(if report.ok { 0 } else { 1 })
                }
                Err(message) => emit_action_error(cli.json, &message),
            },
            ModelRouteCommands::TestDraft {
                name,
                preset,
                model,
                reasoning_effort,
                proxy_base_url,
                upstream_base_url,
                api_key_env,
            } => match check_model_route_draft(
                &context,
                PreviewModelRouteInput {
                    profile_name: name,
                    preset: preset.into(),
                    model,
                    reasoning_effort,
                    proxy_base_url,
                    upstream_base_url,
                    api_key: None,
                    api_key_env,
                },
            ) {
                Ok(report) => {
                    emit_success(cli.json, "model-route-test-draft", &report);
                    if !cli.json {
                        println!(
                            "{} {} ({})",
                            report.profile_name, report.status_label, report.message
                        );
                    }
                    CliOutcome::Exit(if report.ok { 0 } else { 1 })
                }
                Err(message) => emit_action_error(cli.json, &message),
            },
        },
    }
}

fn read_json_text_file(path: &PathBuf) -> Result<String, String> {
    std::fs::read_to_string(path)
        .map_err(|error| format!("failed to read {}: {error}", path.display()))
}

fn emit_action_error(json_output: bool, message: &str) -> CliOutcome {
    let code = if message.contains("not found") {
        ("not_found", 3)
    } else if message.contains("already exists")
        || message.contains("must")
        || message.contains("may contain")
    {
        ("invalid_arguments", 2)
    } else {
        ("profile_action_failed", 1)
    };
    emit_error(json_output, code.0, message, code.1)
}

fn emit_success<T: Serialize>(json_output: bool, command: &str, data: T) {
    if json_output {
        let payload = json!({
            "ok": true,
            "command": command,
            "data": data,
        });
        println!("{}", serde_json::to_string_pretty(&payload).unwrap());
    }
}

fn emit_error(json_output: bool, code: &str, message: &str, exit_code: i32) -> CliOutcome {
    if json_output {
        let payload = json!({
            "ok": false,
            "error": {
                "code": code,
                "message": message,
            }
        });
        println!("{}", serde_json::to_string_pretty(&payload).unwrap());
    } else {
        eprintln!("{message}");
    }

    CliOutcome::Exit(exit_code)
}

fn emit_parse_error(json_output: bool, error: clap::Error) -> CliOutcome {
    let kind = error.kind();
    let message = error.to_string().trim().to_string();

    if json_output {
        if matches!(
            kind,
            ErrorKind::DisplayHelp | ErrorKind::DisplayHelpOnMissingArgumentOrSubcommand
        ) {
            let payload = json!({
                "ok": true,
                "command": "help",
                "data": {
                    "message": message,
                }
            });
            println!("{}", serde_json::to_string_pretty(&payload).unwrap());
            return CliOutcome::Exit(0);
        }

        if kind == ErrorKind::DisplayVersion {
            let payload = json!({
                "ok": true,
                "command": "version",
                "data": {
                    "message": message,
                }
            });
            println!("{}", serde_json::to_string_pretty(&payload).unwrap());
            return CliOutcome::Exit(0);
        }

        let payload = json!({
            "ok": false,
            "error": {
                "code": "invalid_arguments",
                "message": message,
            }
        });
        println!("{}", serde_json::to_string_pretty(&payload).unwrap());
        return CliOutcome::Exit(2);
    }

    let exit_code = if matches!(
        kind,
        ErrorKind::DisplayHelp
            | ErrorKind::DisplayHelpOnMissingArgumentOrSubcommand
            | ErrorKind::DisplayVersion
    ) {
        0
    } else {
        2
    };

    let _ = error.print();
    CliOutcome::Exit(exit_code)
}
