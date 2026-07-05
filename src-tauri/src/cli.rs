use crate::core::{
    app_identifier, app_name, apply_auth_backup, binary_name, copy_profile, create_auth_backup,
    create_profile, delete_profile, import_profile_auth, install_wechat_bridge_service,
    launch_profile, list_auth_vault, list_profiles, list_wechat_bridges, read_profile_quota,
    read_wechat_bridge_log, repair_profile_network, reset_profile, rollback_auth_application,
    start_wechat_bridge, stop_wechat_bridge, terminate_profile, update_profile_metadata,
    ApplyAuthBackupInput, CopyProfileInput, CreateAuthBackupInput, CreateProfileInput,
    ImportAuthInput, InstallWechatBridgeServiceInput, ProfileContext, ProfileLauncherKind,
    ProfileMetadataInput, ReadWechatBridgeLogInput, ResetProfileInput,
    RollbackAuthApplicationInput, StartWechatBridgeInput, StopWechatBridgeInput,
};
use clap::error::ErrorKind;
use clap::{Parser, Subcommand};
use serde::Serialize;
use serde_json::json;
use std::ffi::OsStr;
use std::path::PathBuf;

#[derive(Debug, Parser)]
#[command(name = "rcodexmanager")]
#[command(about = "Manage isolated Codex desktop profiles and launch commands.")]
pub struct Cli {
    #[arg(long, global = true)]
    pub json: bool,
    #[arg(long, global = true, value_name = "PATH")]
    pub zshrc: Option<PathBuf>,
    #[arg(long, global = true, value_name = "PATH")]
    pub home: Option<PathBuf>,
    #[command(subcommand)]
    pub command: Option<Commands>,
}

#[derive(Debug, Subcommand)]
pub enum Commands {
    Desktop,
    Info,
    Capabilities,
    List,
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
    Delete {
        #[arg(long)]
        name: String,
        #[arg(long)]
        archive_data: bool,
    },
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
    Launch {
        #[arg(long)]
        name: String,
    },
    #[command(alias = "stop")]
    Terminate {
        #[arg(long)]
        name: String,
    },
    Quota {
        #[arg(long)]
        name: String,
    },
    #[command(name = "import-auth")]
    ImportAuth {
        #[arg(long)]
        name: String,
        #[arg(long, value_name = "PATH")]
        source: String,
        #[arg(long)]
        confirm_sensitive: bool,
    },
    #[command(name = "repair-network")]
    RepairNetwork {
        #[arg(long)]
        name: String,
        #[arg(long)]
        skip_launchctl: bool,
    },
    Auth {
        #[command(subcommand)]
        command: AuthCommands,
    },
    Wechat {
        #[command(subcommand)]
        command: WechatCommands,
    },
}

#[derive(Debug, Subcommand)]
pub enum AuthCommands {
    List,
    Backup {
        #[arg(long)]
        name: String,
        #[arg(long)]
        label: Option<String>,
    },
    Apply {
        #[arg(long)]
        backup_id: String,
        #[arg(long)]
        target: String,
        #[arg(long)]
        confirm_sensitive: bool,
    },
    Rollback {
        #[arg(long)]
        application_id: String,
        #[arg(long)]
        confirm_sensitive: bool,
    },
}

#[derive(Debug, Subcommand)]
pub enum WechatCommands {
    Status {
        #[arg(long)]
        name: Option<String>,
    },
    Start {
        #[arg(long)]
        name: String,
    },
    Stop {
        #[arg(long)]
        name: String,
    },
    Log {
        #[arg(long)]
        name: String,
        #[arg(long)]
        lines: Option<usize>,
    },
    Switch {
        #[arg(long)]
        from: Option<String>,
        #[arg(long)]
        to: String,
    },
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

fn app_info() -> AppInfo {
    AppInfo {
        name: app_name(),
        binary: binary_name(),
        version: env!("CARGO_PKG_VERSION"),
        identifier: app_identifier(),
        family: "r",
        architecture: "simple-tool",
        default_command: "desktop",
    }
}

fn capability_manifest() -> CapabilityManifest {
    CapabilityManifest {
        global_flags: vec![
            FlagInfo {
                flag: "--json",
                description: "Return a single machine-friendly JSON object.",
            },
            FlagInfo {
                flag: "--zshrc <PATH>",
                description: "Use an explicit zsh config file instead of ~/.zshrc.",
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
                command: "list",
                description: "Read ~/.zshrc and list Codex launcher profiles.",
                json_supported: true,
                reads_files: true,
                writes_files: false,
                examples: vec!["rcodexmanager list --json"],
            },
            CapabilityInfo {
                command: "create",
                description: "Create profile directories, config.toml, a zsh launcher function, and optional local metadata.",
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
                command: "repair-network",
                description: "Enable Codex Responses WebSocket feature flags for a profile and sync the active macOS system proxy into launchctl.",
                json_supported: true,
                reads_files: true,
                writes_files: true,
                examples: vec![
                    "rcodexmanager repair-network --name codex-f --json",
                    "rcodexmanager repair-network --name codex-f --skip-launchctl --json",
                ],
            },
            CapabilityInfo {
                command: "auth",
                description: "Manage the auth vault from CLI: list backups, create a backup, apply a backup to a stopped profile, or roll back an application.",
                json_supported: true,
                reads_files: true,
                writes_files: true,
                examples: vec![
                    "rcodexmanager auth list --json",
                    "rcodexmanager auth backup --name codex-o --label Server --json",
                    "rcodexmanager auth apply --backup-id <id> --target codex-o --confirm-sensitive --json",
                ],
            },
            CapabilityInfo {
                command: "wechat",
                description: "Manage server-friendly WeChat bridges: status, start, stop, log, switch profile, and render or install a systemd user service.",
                json_supported: true,
                reads_files: true,
                writes_files: true,
                examples: vec![
                    "rcodexmanager wechat status --json",
                    "rcodexmanager wechat start --name codex-o --json",
                    "rcodexmanager wechat service --name codex-o --install --enable --now --json",
                ],
            },
        ],
    }
}

fn print_info(info: &AppInfo) {
    println!("{} {}", info.name, info.version);
    println!("binary: {}", info.binary);
    println!("identifier: {}", info.identifier);
    println!("family: {}", info.family);
    println!("architecture: {}", info.architecture);
    println!("default command: {}", info.default_command);
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

pub fn run_from_env() -> CliOutcome {
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
        None | Some(Commands::Desktop) => CliOutcome::LaunchDesktop,
        Some(Commands::Info) => {
            let info = app_info();
            emit_success(cli.json, "info", &info);
            if !cli.json {
                print_info(&info);
            }
            CliOutcome::Exit(0)
        }
        Some(Commands::Capabilities) => {
            let manifest = capability_manifest();
            emit_success(cli.json, "capabilities", &manifest);
            if !cli.json {
                print_capabilities(&manifest);
            }
            CliOutcome::Exit(0)
        }
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
        Some(Commands::RepairNetwork {
            name,
            skip_launchctl,
        }) => match repair_profile_network(&context, &name, !skip_launchctl) {
            Ok(report) => {
                emit_success(cli.json, "repair-network", &report);
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
    }
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
