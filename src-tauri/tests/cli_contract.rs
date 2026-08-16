use serde_json::{json, Value};
#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;
use std::process::{Command, Output};

fn binary_path() -> &'static str {
    env!("CARGO_BIN_EXE_rcodexmanager")
}

fn run_cli(args: &[&str]) -> Output {
    Command::new(binary_path())
        .args(args)
        .output()
        .expect("failed to run rcodexmanager binary")
}

fn parse_stdout_json(output: &Output) -> Value {
    serde_json::from_slice(&output.stdout).expect("stdout should contain valid json")
}

fn fixture_home() -> tempfile::TempDir {
    let temp_dir = tempfile::tempdir().expect("failed to create temp dir");
    std::fs::write(
        temp_dir.path().join(".zshrc"),
        r#"
codex-b() {
  mkdir -p "$HOME/.codex-isolated-test" "$HOME/Library/Application Support/Codex-Isolated-Test"
  open -n -a "Codex" \
    --env CODEX_HOME="$HOME/.codex-isolated-test" \
    --args --user-data-dir="$HOME/Library/Application Support/Codex-Isolated-Test"
}
"#,
    )
    .expect("failed to write fixture zshrc");
    std::fs::create_dir_all(temp_dir.path().join(".codex-isolated-test"))
        .expect("failed to create codex home");
    std::fs::write(
        temp_dir.path().join(".codex-isolated-test/config.toml"),
        "model = \"gpt-5.5\"\nmodel_reasoning_effort = \"medium\"\n",
    )
    .expect("failed to write fixture config");
    temp_dir
}

fn home_arg(home: &std::path::Path) -> String {
    home.to_string_lossy().to_string()
}

fn write_fixture_session(home: &std::path::Path, session_id: &str) {
    let codex_home = home.join(".codex-isolated-test");
    let session_dir = codex_home.join("sessions/2026/07/15");
    std::fs::create_dir_all(&session_dir).expect("failed to create session fixture directory");
    std::fs::write(
        codex_home.join("session_index.jsonl"),
        format!(
            "{}\n",
            json!({
                "id": session_id,
                "thread_name": "CLI session detail",
                "updated_at": "2026-07-15T10:08:00.000Z"
            })
        ),
    )
    .expect("failed to write session index fixture");
    std::fs::write(
        session_dir.join(format!("rollout-2026-07-15T10-00-00-{session_id}.jsonl")),
        format!(
            "{}\n{}\n",
            json!({
                "timestamp": "2026-07-15T10:00:00.000Z",
                "type": "session_meta",
                "payload": {
                    "id": session_id,
                    "timestamp": "2026-07-15T10:00:00.000Z",
                    "cwd": "/tmp/rcodexmanager-cli"
                }
            }),
            json!({
                "timestamp": "2026-07-15T10:08:00.000Z",
                "type": "event_msg",
                "payload": {
                    "type": "user_message",
                    "message": "Read this detail only after selecting the indexed session."
                }
            })
        ),
    )
    .expect("failed to write session detail fixture");
}

#[test]
fn info_json_returns_family_metadata() {
    let output = run_cli(&["info", "--json"]);
    assert_eq!(output.status.code(), Some(0));

    let payload = parse_stdout_json(&output);
    assert_eq!(payload["ok"], true);
    assert_eq!(payload["command"], "info");
    assert_eq!(payload["data"]["name"], "rCodexManager");
    assert_eq!(payload["data"]["binary"], "rcodexmanager");
    assert_eq!(payload["data"]["architecture"], "modular-workbench");
}

#[test]
fn capabilities_json_lists_profile_commands() {
    let output = run_cli(&["capabilities", "--json"]);
    assert_eq!(output.status.code(), Some(0));

    let payload = parse_stdout_json(&output);
    let commands = payload["data"]["commands"]
        .as_array()
        .expect("commands should be an array");

    assert!(commands.iter().any(|item| item["command"] == "list"));
    assert!(commands.iter().any(|item| item["command"] == "doctor"));
    assert!(commands.iter().any(|item| item["command"] == "create"));
    assert!(commands.iter().any(|item| item["command"] == "copy"));
    assert!(commands.iter().any(|item| item["command"] == "update"));
    assert!(commands.iter().any(|item| item["command"] == "reset"));
    assert!(commands.iter().any(|item| item["command"] == "delete"));
    assert!(commands.iter().any(|item| item["command"] == "terminate"));
    assert!(commands.iter().any(|item| item["command"] == "quota"));
    assert!(commands.iter().any(|item| item["command"] == "login"));
    assert!(commands.iter().any(|item| item["command"] == "import-auth"));
    assert!(!commands
        .iter()
        .any(|item| item["command"] == "repair-network"));
    assert!(commands.iter().any(|item| item["command"] == "auth"));
    assert!(commands.iter().any(|item| item["command"] == "sessions"));
    assert!(commands.iter().any(|item| item["command"] == "wechat"));
    assert!(commands.iter().any(|item| item["command"] == "feishu"));
    assert!(commands.iter().any(|item| item["command"] == "model-route"));

    for command in commands.iter().filter(|item| item["jsonSupported"] == true) {
        for example in command["examples"]
            .as_array()
            .expect("capability examples should be an array")
        {
            assert!(
                example
                    .as_str()
                    .expect("capability example should be text")
                    .starts_with("rcodexmanager --json "),
                "JSON capability example must place the global flag before the command: {example}"
            );
        }
    }
}

#[test]
fn login_rejects_json_without_starting_an_interactive_process() {
    let home = fixture_home();
    let home_path = home_arg(home.path());
    let output = run_cli(&[
        "--home",
        &home_path,
        "--json",
        "login",
        "--name",
        "codex-b",
        "--device-auth",
    ]);
    assert_eq!(output.status.code(), Some(2));

    let payload = parse_stdout_json(&output);
    assert_eq!(payload["ok"], false);
    assert_eq!(payload["error"]["code"], "streaming_command");
}

#[test]
fn doctor_json_is_read_only_and_redacted() {
    let home = fixture_home();
    let home_path = home_arg(home.path());
    let output = run_cli(&["--home", &home_path, "doctor", "--json"]);
    assert_eq!(output.status.code(), Some(0));

    let payload = parse_stdout_json(&output);
    let serialized = serde_json::to_string(&payload).unwrap();
    assert_eq!(payload["ok"], true);
    assert_eq!(payload["command"], "doctor");
    assert!(payload["data"]["checks"].as_array().unwrap().len() >= 8);
    assert!(!serialized.contains(&home_path));
    assert!(!home
        .path()
        .join(".rcodexmanager/profile-metadata.json")
        .exists());
}

#[test]
fn feishu_status_json_is_read_only_when_no_runtime_is_configured() {
    let home = fixture_home();
    let home_path = home_arg(home.path());
    let output = run_cli(&["--home", &home_path, "feishu", "status", "--json"]);
    assert_eq!(output.status.code(), Some(0));

    let payload = parse_stdout_json(&output);
    assert_eq!(payload["ok"], true);
    assert_eq!(payload["command"], "feishu-status");
    assert_eq!(payload["data"]["instance"], "rcodexmanager");
    assert_eq!(payload["data"]["profileName"], Value::Null);
    assert_eq!(
        payload["data"]["projectUrl"],
        "https://github.com/kxn/codex-remote-feishu"
    );
    assert!(!home
        .path()
        .join(".rcodexmanager/feishu-remote.json")
        .exists());
}

#[test]
fn list_json_reads_codex_functions_from_zshrc() {
    let home = fixture_home();
    let home_path = home_arg(home.path());

    let output = run_cli(&["--home", &home_path, "list", "--json"]);
    assert_eq!(output.status.code(), Some(0));

    let payload = parse_stdout_json(&output);
    assert_eq!(payload["ok"], true);
    assert_eq!(payload["command"], "list");
    assert_eq!(payload["data"]["profileCount"], 1);
    assert_eq!(payload["data"]["profiles"][0]["name"], "codex-b");
    assert_eq!(payload["data"]["profiles"][0]["model"], "gpt-5.5");
    assert_eq!(payload["data"]["profiles"][0]["isRunning"], false);
    assert_eq!(
        payload["data"]["profiles"][0]["runningPids"]
            .as_array()
            .unwrap()
            .len(),
        0
    );
}

#[test]
fn list_json_includes_latest_session_summary() {
    let home = fixture_home();
    let home_path = home_arg(home.path());
    let codex_home = home.path().join(".codex-isolated-test");
    let session_id = "019e8b38-c4f3-7281-8b15-acc716cd7a3f";
    let updated_at = "2026-06-03T02:47:55.000000Z";
    let session_dir = codex_home.join("sessions/2026/06/03");
    let session_path = session_dir.join(format!("rollout-2026-06-03T10-03-34-{session_id}.jsonl"));

    std::fs::write(
        codex_home.join("session_index.jsonl"),
        format!(
            "{}\n{}\n",
            json!({
                "id": "019e86f9-09aa-73b0-989a-fe792db41e7a",
                "thread_name": "旧会话",
                "updated_at": "2026-06-02T06:17:04.571447Z"
            }),
            json!({
                "id": session_id,
                "thread_name": "优化 Codex Manage",
                "updated_at": updated_at
            })
        ),
    )
    .expect("failed to write fixture session index");
    std::fs::create_dir_all(&session_dir).expect("failed to create fixture session dir");
    std::fs::write(
        &session_path,
        format!(
            "{}\n{}\n{}\n",
            json!({
                "timestamp": "2026-06-03T02:07:26.986Z",
                "type": "session_meta",
                "payload": {
                    "id": session_id,
                    "timestamp": "2026-06-03T02:03:34.047Z",
                    "cwd": "/tmp/rcodexmanager-project"
                }
            }),
            json!({
                "timestamp": "2026-06-03T02:07:27.212Z",
                "type": "response_item",
                "payload": {
                    "type": "message",
                    "role": "user",
                    "content": [{
                        "type": "input_text",
                        "text": "<environment_context><cwd>/tmp/rcodexmanager-project</cwd></environment_context>"
                    }]
                }
            }),
            json!({
                "timestamp": "2026-06-03T02:47:55.000Z",
                "type": "event_msg",
                "payload": {
                    "type": "user_message",
                    "message": "能展示最新的会话摘要标题、摘要信息吗;"
                }
            })
        ),
    )
    .expect("failed to write fixture session jsonl");

    let output = run_cli(&["--home", &home_path, "list", "--json"]);
    assert_eq!(output.status.code(), Some(0));

    let payload = parse_stdout_json(&output);
    let session = &payload["data"]["profiles"][0]["latestSession"];
    assert_eq!(session["id"], session_id);
    assert_eq!(session["title"], "优化 Codex Manage");
    assert_eq!(session["renamedTitle"], "优化 Codex Manage");
    assert_eq!(session["updatedAt"], updated_at);
    assert_eq!(session["startedAt"], "2026-06-03T02:03:34.047Z");
    assert_eq!(session["cwd"], "/tmp/rcodexmanager-project");
    assert!(session["summary"].as_str().unwrap().contains("摘要标题"));
    assert!(session["path"].as_str().unwrap().contains(session_id));

    let recent_sessions = payload["data"]["profiles"][0]["recentSessions"]
        .as_array()
        .expect("recentSessions should be an array");
    assert_eq!(recent_sessions.len(), 1);
    assert_eq!(recent_sessions[0]["id"], session_id);
    assert_eq!(recent_sessions[0]["title"], "优化 Codex Manage");
    assert_eq!(recent_sessions[0]["renamedTitle"], "优化 Codex Manage");
}

#[test]
fn sessions_cli_pages_indexes_and_reads_detail_on_demand() {
    let home = fixture_home();
    let home_path = home_arg(home.path());
    let session_id = "019f8c00-1234-7000-8000-000000000001";
    write_fixture_session(home.path(), session_id);

    let listed = run_cli(&[
        "--home",
        &home_path,
        "sessions",
        "list",
        "--profile",
        "codex-b",
        "--limit",
        "10",
        "--json",
    ]);
    assert_eq!(listed.status.code(), Some(0));
    let listed_payload = parse_stdout_json(&listed);
    assert_eq!(listed_payload["ok"], true);
    assert_eq!(listed_payload["command"], "sessions-list");
    assert_eq!(listed_payload["data"]["limit"], 10);
    assert_eq!(
        listed_payload["data"]["sessions"][0]["profileName"],
        "codex-b"
    );
    assert_eq!(
        listed_payload["data"]["sessions"][0]["session"]["id"],
        session_id
    );

    let detail = run_cli(&[
        "--home",
        &home_path,
        "sessions",
        "detail",
        "--profile",
        "codex-b",
        "--session-id",
        session_id,
        "--json",
    ]);
    assert_eq!(detail.status.code(), Some(0));
    let detail_payload = parse_stdout_json(&detail);
    assert_eq!(detail_payload["ok"], true);
    assert_eq!(detail_payload["command"], "sessions-detail");
    assert_eq!(detail_payload["data"]["id"], session_id);
    assert!(detail_payload["data"]["summary"]
        .as_str()
        .expect("session summary")
        .contains("selecting the indexed session"));
}

#[test]
fn list_json_includes_existing_default_codex_profile_as_protected() {
    let home = fixture_home();
    let home_path = home_arg(home.path());
    std::fs::create_dir_all(home.path().join(".codex")).expect("failed to create default codex");
    std::fs::write(
        home.path().join(".codex/config.toml"),
        "model = \"gpt-5.4\"\nmodel_reasoning_effort = \"medium\"\n",
    )
    .expect("failed to write default config");

    let output = run_cli(&["--home", &home_path, "list", "--json"]);
    assert_eq!(output.status.code(), Some(0));

    let payload = parse_stdout_json(&output);
    assert_eq!(payload["ok"], true);
    assert_eq!(payload["data"]["profileCount"], 2);
    let profiles = payload["data"]["profiles"]
        .as_array()
        .expect("profiles should be an array");
    let default_profile = profiles
        .iter()
        .find(|profile| profile["name"] == "codex")
        .expect("default codex profile should be listed");
    assert_eq!(default_profile["isDefault"], true);
    assert_eq!(default_profile["category"], "默认");
    assert_eq!(default_profile["model"], "gpt-5.4");

    let reset = run_cli(&["--home", &home_path, "reset", "--name", "codex", "--json"]);
    assert_eq!(reset.status.code(), Some(1));
    let reset_payload = parse_stdout_json(&reset);
    assert_eq!(reset_payload["ok"], false);
    assert!(reset_payload["error"]["message"]
        .as_str()
        .unwrap()
        .contains("protected"));

    let terminate = run_cli(&[
        "--home",
        &home_path,
        "terminate",
        "--name",
        "codex",
        "--json",
    ]);
    assert_eq!(terminate.status.code(), Some(1));
    let terminate_payload = parse_stdout_json(&terminate);
    assert_eq!(terminate_payload["ok"], false);
    assert!(terminate_payload["error"]["message"]
        .as_str()
        .unwrap()
        .contains("cannot be terminated safely"));
}

#[test]
fn model_set_backs_up_config_and_preserves_auth_sessions_and_provider() {
    let home = fixture_home();
    let home_path = home_arg(home.path());
    let codex_home = home.path().join(".codex-isolated-test");
    let config_path = codex_home.join("config.toml");
    std::fs::write(
        &config_path,
        r#"model = "old-model"
model_provider = "custom-provider"
model_reasoning_effort = "medium"

[model_providers.custom-provider]
name = "Custom Provider"
base_url = "http://127.0.0.1:15721/v1"
wire_api = "responses"

[features]
responses_websockets = true
responses_websockets_v2 = true
responses_websocket_response_processed = true
"#,
    )
    .expect("route config");
    let auth_path = codex_home.join("auth.json");
    std::fs::write(&auth_path, r#"{"OPENAI_API_KEY":"preserve-me"}"#).expect("auth");
    let session_path = codex_home.join("sessions/keep.jsonl");
    std::fs::create_dir_all(session_path.parent().unwrap()).expect("sessions");
    std::fs::write(&session_path, "session-must-remain\n").expect("session");

    let output = run_cli(&[
        "--home",
        &home_path,
        "model",
        "set",
        "--name",
        "codex-b",
        "--model",
        "new-model",
        "--reasoning-effort",
        "xhigh",
        "--json",
    ]);
    assert_eq!(output.status.code(), Some(0));
    let payload = parse_stdout_json(&output);
    assert_eq!(payload["command"], "model-set");
    assert_eq!(payload["data"]["profile"]["model"], "new-model");
    assert_eq!(
        payload["data"]["profile"]["modelProvider"],
        "custom-provider"
    );
    assert_eq!(payload["data"]["profile"]["authState"]["status"], "api-key");
    assert_eq!(payload["data"]["backups"].as_array().unwrap().len(), 1);
    assert!(std::path::Path::new(
        payload["data"]["backups"][0]["backupPath"]
            .as_str()
            .expect("backup path")
    )
    .exists());

    let config = std::fs::read_to_string(&config_path).expect("updated config");
    assert!(config.contains("model = \"new-model\""));
    assert!(config.contains("model_reasoning_effort = \"xhigh\""));
    assert!(config.contains("model_provider = \"custom-provider\""));
    assert!(config.contains("base_url = \"http://127.0.0.1:15721/v1\""));
    assert_eq!(
        std::fs::read_to_string(&auth_path).expect("preserved auth"),
        r#"{"OPENAI_API_KEY":"preserve-me"}"#
    );
    assert_eq!(
        std::fs::read_to_string(&session_path).expect("preserved session"),
        "session-must-remain\n"
    );
}

#[test]
fn quota_json_without_auth_fails_without_network() {
    let home = fixture_home();
    let home_path = home_arg(home.path());

    let output = run_cli(&["--home", &home_path, "quota", "--name", "codex-b", "--json"]);
    assert_eq!(output.status.code(), Some(1));

    let payload = parse_stdout_json(&output);
    assert_eq!(payload["ok"], false);
    assert_eq!(payload["error"]["code"], "profile_action_failed");
    assert!(payload["error"]["message"]
        .as_str()
        .unwrap()
        .contains("auth.json"));
}

#[test]
fn import_auth_json_requires_confirmation_and_backs_up_target_auth() {
    let home = fixture_home();
    let home_path = home_arg(home.path());
    let target_auth_path = home.path().join(".codex-isolated-test/auth.json");
    let source_auth_path = home.path().join("source-session.json");

    std::fs::write(
        &target_auth_path,
        serde_json::to_string_pretty(&json!({
            "auth_mode": "chatgpt",
            "tokens": {
                "access_token": "old.access",
                "account_id": "old-account"
            }
        }))
        .unwrap(),
    )
    .expect("failed to write target auth");
    std::fs::write(
        &source_auth_path,
        serde_json::to_string_pretty(&json!({
            "accessToken": "new.access",
            "refreshToken": "new.refresh",
            "accountId": "new-account"
        }))
        .unwrap(),
    )
    .expect("failed to write source auth");
    let source_path = source_auth_path.to_string_lossy().to_string();

    let rejected = run_cli(&[
        "--home",
        &home_path,
        "import-auth",
        "--name",
        "codex-b",
        "--source",
        &source_path,
        "--json",
    ]);
    assert_eq!(rejected.status.code(), Some(2));
    let rejected_payload = parse_stdout_json(&rejected);
    assert_eq!(rejected_payload["ok"], false);

    let imported = run_cli(&[
        "--home",
        &home_path,
        "import-auth",
        "--name",
        "codex-b",
        "--source",
        &source_path,
        "--confirm-sensitive",
        "--json",
    ]);
    assert_eq!(imported.status.code(), Some(0));
    let imported_payload = parse_stdout_json(&imported);
    assert_eq!(imported_payload["ok"], true);
    assert_eq!(imported_payload["command"], "import-auth");
    assert_eq!(
        imported_payload["data"]["profile"]["account"]["accountId"],
        "new-account"
    );
    assert_eq!(
        imported_payload["data"]["backups"]
            .as_array()
            .unwrap()
            .len(),
        1
    );
    assert_eq!(imported_payload["data"]["backups"][0]["moved"], false);

    let target_auth: Value = serde_json::from_str(
        &std::fs::read_to_string(&target_auth_path).expect("target auth should exist"),
    )
    .expect("target auth should be json");
    assert_eq!(target_auth["auth_mode"], "chatgpt");
    assert_eq!(target_auth["tokens"]["access_token"], "new.access");
    assert_eq!(target_auth["tokens"]["refresh_token"], "new.refresh");
    assert_eq!(target_auth["tokens"]["account_id"], "new-account");
    #[cfg(unix)]
    assert_eq!(
        std::fs::metadata(&target_auth_path)
            .expect("target auth metadata")
            .permissions()
            .mode()
            & 0o777,
        0o600
    );
}

#[test]
fn auth_cli_supports_batch_metadata_export_preview_import_and_delete() {
    let home = fixture_home();
    let home_path = home_arg(home.path());
    std::fs::write(
        home.path().join(".codex-isolated-test/auth.json"),
        serde_json::to_string_pretty(&json!({
            "auth_mode": "chatgpt",
            "tokens": {
                "access_token": "vault.access",
                "refresh_token": "vault.refresh",
                "account_id": "vault-account"
            }
        }))
        .unwrap(),
    )
    .expect("failed to write auth fixture");

    let backed_up = run_cli(&[
        "--home",
        &home_path,
        "auth",
        "backup-many",
        "--name",
        "codex-b",
        "--label",
        "CLI snapshot",
        "--json",
    ]);
    assert_eq!(backed_up.status.code(), Some(0));
    let backed_up_payload = parse_stdout_json(&backed_up);
    assert_eq!(backed_up_payload["command"], "auth-backup-many");
    assert_eq!(backed_up_payload["data"]["successCount"], 1);
    let backup_id = backed_up_payload["data"]["results"][0]["backupId"]
        .as_str()
        .expect("backup id")
        .to_string();

    let updated = run_cli(&[
        "--home",
        &home_path,
        "auth",
        "update",
        "--backup-id",
        &backup_id,
        "--note",
        "created from CLI",
        "--pin",
        "--json",
    ]);
    assert_eq!(updated.status.code(), Some(0));
    let updated_payload = parse_stdout_json(&updated);
    assert_eq!(updated_payload["command"], "auth-update");
    assert_eq!(updated_payload["data"]["backups"][0]["pinned"], true);
    assert_eq!(
        updated_payload["data"]["backups"][0]["note"],
        "created from CLI"
    );

    let exported = run_cli(&[
        "--home",
        &home_path,
        "auth",
        "export",
        "--backup-id",
        &backup_id,
        "--confirm-sensitive",
        "--json",
    ]);
    assert_eq!(exported.status.code(), Some(0));
    let exported_payload = parse_stdout_json(&exported);
    assert_eq!(exported_payload["command"], "auth-export");
    let export_path = exported_payload["data"]["path"]
        .as_str()
        .expect("export path")
        .to_string();
    assert!(std::path::Path::new(&export_path).exists());

    let previewed = run_cli(&[
        "--home",
        &home_path,
        "auth",
        "preview-import",
        "--file",
        &export_path,
        "--json",
    ]);
    assert_eq!(previewed.status.code(), Some(0));
    let previewed_payload = parse_stdout_json(&previewed);
    assert_eq!(previewed_payload["command"], "auth-preview-import");
    assert_eq!(previewed_payload["data"]["valid"], true);
    assert_eq!(previewed_payload["data"]["hasRefreshToken"], true);

    let imported = run_cli(&[
        "--home",
        &home_path,
        "auth",
        "import",
        "--file",
        &export_path,
        "--label",
        "Imported snapshot",
        "--confirm-sensitive",
        "--json",
    ]);
    assert_eq!(imported.status.code(), Some(0));
    let imported_payload = parse_stdout_json(&imported);
    assert_eq!(imported_payload["command"], "auth-import");
    assert_eq!(imported_payload["data"]["backupCount"], 2);

    let rejected_delete = run_cli(&[
        "--home",
        &home_path,
        "auth",
        "delete",
        "--backup-id",
        &backup_id,
        "--json",
    ]);
    assert_eq!(rejected_delete.status.code(), Some(2));

    let deleted = run_cli(&[
        "--home",
        &home_path,
        "auth",
        "delete",
        "--backup-id",
        &backup_id,
        "--confirm-sensitive",
        "--json",
    ]);
    assert_eq!(deleted.status.code(), Some(0));
    let deleted_payload = parse_stdout_json(&deleted);
    assert_eq!(deleted_payload["command"], "auth-delete");
    assert_eq!(deleted_payload["data"]["backupCount"], 1);
}

#[test]
fn copy_profile_creates_new_launcher_and_can_copy_auth() {
    let home = fixture_home();
    let home_path = home_arg(home.path());
    let source_auth_path = home.path().join(".codex-isolated-test/auth.json");
    std::fs::write(
        &source_auth_path,
        serde_json::to_string_pretty(&json!({
            "auth_mode": "chatgpt",
            "tokens": {
                "access_token": "source.access",
                "refresh_token": "source.refresh",
                "account_id": "source-account"
            }
        }))
        .unwrap(),
    )
    .expect("failed to write source auth");

    let copied = run_cli(&[
        "--home",
        &home_path,
        "copy",
        "--source",
        "codex-b",
        "--name",
        "codex-f",
        "--alias",
        "Copied",
        "--auth-source",
        "codex-b",
        "--confirm-sensitive",
        "--json",
    ]);
    assert_eq!(copied.status.code(), Some(0));
    let copied_payload = parse_stdout_json(&copied);
    assert_eq!(copied_payload["ok"], true);
    assert_eq!(copied_payload["command"], "copy");
    assert_eq!(copied_payload["data"]["profile"]["name"], "codex-f");
    assert_eq!(copied_payload["data"]["profile"]["alias"], "Copied");
    assert_eq!(
        copied_payload["data"]["profile"]["account"]["accountId"],
        "source-account"
    );

    let config = std::fs::read_to_string(home.path().join(".codex-f/config.toml"))
        .expect("copied config should exist");
    assert!(config.contains("model = \"gpt-5.5\""));
    assert!(config.contains("model_reasoning_effort = \"medium\""));
    assert!(!config.contains("responses_websockets"));

    let target_auth: Value = serde_json::from_str(
        &std::fs::read_to_string(home.path().join(".codex-f/auth.json"))
            .expect("target auth should exist"),
    )
    .expect("target auth should be json");
    assert_eq!(target_auth["tokens"]["access_token"], "source.access");
    assert_eq!(target_auth["tokens"]["refresh_token"], "source.refresh");
    assert_eq!(target_auth["tokens"]["account_id"], "source-account");

    let listed = run_cli(&["--home", &home_path, "list", "--json"]);
    assert_eq!(listed.status.code(), Some(0));
    let listed_payload = parse_stdout_json(&listed);
    assert_eq!(listed_payload["data"]["profileCount"], 2);
}

#[test]
fn create_server_profile_writes_linux_friendly_launcher() {
    let home = fixture_home();
    let home_path = home_arg(home.path());

    let created = run_cli(&[
        "--home", &home_path, "create", "--name", "codex-o", "--server", "--json",
    ]);
    assert_eq!(created.status.code(), Some(0));
    let payload = parse_stdout_json(&created);
    assert_eq!(payload["ok"], true);
    assert_eq!(payload["data"]["profile"]["name"], "codex-o");
    assert_eq!(payload["data"]["profile"]["launcherKind"], "server");
    assert_eq!(
        payload["data"]["profile"]["userDataDir"],
        home.path()
            .join(".local/share/rcodexmanager/profiles/codex-o")
            .to_string_lossy()
            .to_string()
    );

    let zshrc = std::fs::read_to_string(home.path().join(".zshrc")).expect("zshrc");
    assert!(zshrc.contains("CODEX_HOME=\"$HOME/.codex-o\" codex \"$@\""));
    assert!(!zshrc.contains("open -n -a \"Codex\" \\\n    --env CODEX_HOME=\"$HOME/.codex-o\""));
}

#[test]
fn wechat_service_json_renders_user_systemd_unit() {
    let home = fixture_home();
    let home_path = home_arg(home.path());

    let output = run_cli(&[
        "--home", &home_path, "wechat", "service", "--name", "codex-b", "--json",
    ]);
    assert_eq!(output.status.code(), Some(0));

    let payload = parse_stdout_json(&output);
    assert_eq!(payload["ok"], true);
    assert_eq!(payload["command"], "wechat-service");
    assert_eq!(payload["data"]["profileName"], "codex-b");
    assert_eq!(
        payload["data"]["serviceName"],
        "rcodexmanager-wechat-codex-b.service"
    );
    assert_eq!(payload["data"]["installed"], false);
    let unit = payload["data"]["unitContents"].as_str().expect("unit text");
    assert!(unit.contains("ExecStart=/bin/sh -lc"));
    assert!(unit.contains("wechat-acp --instance"));
    assert!(unit.contains("codex-b"));
    assert!(unit.contains("Restart=always"));
}

#[test]
fn wechat_unbind_rejection_has_a_json_contract_and_requires_confirmation() {
    let home = fixture_home();
    let profile_name = "codex-cli-unbind-fixture";
    let zshrc_path = home.path().join(".zshrc");
    let zshrc = std::fs::read_to_string(&zshrc_path)
        .unwrap()
        .replace("codex-b()", &format!("{profile_name}()"));
    std::fs::write(&zshrc_path, zshrc).unwrap();
    let home_path = home_arg(home.path());

    let rejected = run_cli(&[
        "--home",
        &home_path,
        "wechat",
        "unbind",
        "--name",
        profile_name,
        "--json",
    ]);
    assert_eq!(rejected.status.code(), Some(2));
    let payload = parse_stdout_json(&rejected);
    assert_eq!(payload["ok"], false);
    assert_eq!(payload["error"]["code"], "invalid_arguments");
    assert!(payload["error"]["message"]
        .as_str()
        .unwrap()
        .contains("confirm"));
}

#[test]
fn model_route_preview_apply_and_restore_keep_json_contract() {
    let home = fixture_home();
    let home_path = home_arg(home.path());
    let codex_home = home.path().join(".codex-isolated-test");
    let config_path = codex_home.join("config.toml");
    let auth_path = codex_home.join("auth.json");
    std::fs::write(&auth_path, r#"{"auth_mode":"chatgpt","token":"keep"}"#)
        .expect("failed to write fixture auth");

    let status = run_cli(&["--home", &home_path, "model-route", "status", "--json"]);
    assert_eq!(status.status.code(), Some(0));
    let status_payload = parse_stdout_json(&status);
    assert_eq!(status_payload["ok"], true);
    assert_eq!(status_payload["command"], "model-route-status");
    assert_eq!(status_payload["data"]["profileCount"], 1);
    assert_eq!(
        status_payload["data"]["profiles"][0]["routeStatusLabel"],
        "官方默认"
    );
    assert_eq!(
        status_payload["data"]["proxy"]["baseUrl"],
        "http://127.0.0.1:15721/v1"
    );
    assert!(["offline", "external", "managed"].contains(
        &status_payload["data"]["proxy"]["status"]
            .as_str()
            .expect("proxy status")
    ));
    let aliyun_preset = status_payload["data"]["presets"]
        .as_array()
        .expect("presets")
        .iter()
        .find(|item| item["id"] == "aliyun-qwen")
        .expect("aliyun preset");
    assert_eq!(aliyun_preset["requiresProxy"], false);
    assert_eq!(
        aliyun_preset["defaultBaseUrl"],
        "https://dashscope.aliyuncs.com/compatible-mode/v1"
    );

    let before_preview = std::fs::read_to_string(&config_path).expect("fixture config");
    let aliyun_preview = run_cli(&[
        "--home",
        &home_path,
        "model-route",
        "preview",
        "--name",
        "codex-b",
        "--preset",
        "aliyun-qwen",
        "--model",
        "qwen3-coder-plus",
        "--json",
    ]);
    assert_eq!(aliyun_preview.status.code(), Some(0));
    let aliyun_preview_payload = parse_stdout_json(&aliyun_preview);
    assert_eq!(aliyun_preview_payload["ok"], true);
    assert_eq!(
        aliyun_preview_payload["data"]["baseUrl"],
        "https://dashscope.aliyuncs.com/compatible-mode/v1"
    );
    assert_eq!(aliyun_preview_payload["data"]["usesProxy"], false);
    assert_eq!(
        std::fs::read_to_string(&config_path).expect("fixture config"),
        before_preview
    );

    let proxy_status = run_cli(&["--home", &home_path, "model-route", "proxy", "--json"]);
    assert_eq!(proxy_status.status.code(), Some(0));
    let proxy_status_payload = parse_stdout_json(&proxy_status);
    assert_eq!(proxy_status_payload["ok"], true);
    assert_eq!(proxy_status_payload["command"], "model-route-proxy");
    assert_eq!(
        proxy_status_payload["data"]["baseUrl"],
        "http://127.0.0.1:15721/v1"
    );

    let preview = run_cli(&[
        "--home",
        &home_path,
        "model-route",
        "preview",
        "--name",
        "codex-b",
        "--preset",
        "glm",
        "--model",
        "glm-4.6",
        "--proxy-base-url",
        "http://127.0.0.1:15721/v1",
        "--upstream-base-url",
        "https://open.bigmodel.cn/api/paas/v4",
        "--json",
    ]);
    assert_eq!(preview.status.code(), Some(0));
    let preview_payload = parse_stdout_json(&preview);
    assert_eq!(preview_payload["ok"], true);
    assert_eq!(preview_payload["command"], "model-route-preview");
    assert_eq!(preview_payload["data"]["profileName"], "codex-b");
    assert_eq!(
        preview_payload["data"]["baseUrl"],
        "http://127.0.0.1:15721/v1"
    );
    assert_eq!(preview_payload["data"]["usesProxy"], true);
    assert_eq!(
        std::fs::read_to_string(&config_path).expect("fixture config"),
        before_preview
    );

    let missing_proxy = run_cli(&[
        "--home",
        &home_path,
        "model-route",
        "preview",
        "--name",
        "codex-b",
        "--preset",
        "glm",
        "--model",
        "glm-4.6",
        "--json",
    ]);
    assert_ne!(missing_proxy.status.code(), Some(0));
    let missing_proxy_payload = parse_stdout_json(&missing_proxy);
    assert_eq!(missing_proxy_payload["ok"], false);
    assert!(missing_proxy_payload["error"]["message"]
        .as_str()
        .expect("error message")
        .contains("Chat-only"));

    let apply = run_cli(&[
        "--home",
        &home_path,
        "model-route",
        "apply",
        "--name",
        "codex-b",
        "--preset",
        "glm",
        "--model",
        "glm-4.6",
        "--reasoning-effort",
        "xhigh",
        "--proxy-base-url",
        "http://127.0.0.1:15721/v1",
        "--upstream-base-url",
        "https://open.bigmodel.cn/api/paas/v4",
        "--confirm-sensitive",
        "--json",
    ]);
    assert_eq!(apply.status.code(), Some(0));
    let apply_payload = parse_stdout_json(&apply);
    assert_eq!(apply_payload["ok"], true);
    assert_eq!(apply_payload["command"], "model-route-apply");
    assert_eq!(apply_payload["data"]["profile"]["model"], "glm-4.6");
    let backup_path = apply_payload["data"]["backups"][0]["backupPath"]
        .as_str()
        .expect("backup path");
    assert!(std::path::Path::new(backup_path).exists());

    let routed_config = std::fs::read_to_string(&config_path).expect("routed config");
    assert!(routed_config.contains("model = \"glm-4.6\""));
    assert!(routed_config.contains("model_reasoning_effort = \"xhigh\""));
    assert!(routed_config.contains("model_provider = \"rcodexmanager-route\""));
    assert!(routed_config.contains("base_url = \"http://127.0.0.1:15721/v1\""));
    assert!(routed_config.contains("wire_api = \"responses\""));
    assert!(routed_config.contains("rcodexmanager_route_mode = \"chat\""));
    assert!(routed_config.contains("rcodexmanager_preset = \"glm\""));
    assert!(routed_config
        .contains("rcodexmanager_upstream_base_url = \"https://open.bigmodel.cn/api/paas/v4\""));
    assert!(!routed_config.contains("responses_websockets"));
    assert!(!routed_config.contains("auth_mode"));
    assert_eq!(
        std::fs::read_to_string(&auth_path).expect("auth should stay unchanged"),
        r#"{"auth_mode":"chatgpt","token":"keep"}"#
    );

    let routed_status = run_cli(&[
        "--home",
        &home_path,
        "model-route",
        "status",
        "--name",
        "codex-b",
        "--json",
    ]);
    assert_eq!(routed_status.status.code(), Some(0));
    let routed_status_payload = parse_stdout_json(&routed_status);
    assert_eq!(
        routed_status_payload["data"]["profiles"][0]["routeStatusLabel"],
        "已配置路由"
    );

    let restore = run_cli(&[
        "--home",
        &home_path,
        "model-route",
        "restore",
        "--name",
        "codex-b",
        "--confirm-sensitive",
        "--json",
    ]);
    assert_eq!(restore.status.code(), Some(0));
    let restore_payload = parse_stdout_json(&restore);
    assert_eq!(restore_payload["ok"], true);
    assert_eq!(restore_payload["command"], "model-route-restore");

    let restored_config = std::fs::read_to_string(&config_path).expect("restored config");
    assert!(restored_config.contains("model = \"glm-4.6\""));
    assert!(restored_config.contains("model_reasoning_effort = \"xhigh\""));
    assert!(!restored_config.contains("model_provider = \"rcodexmanager-route\""));
    assert!(!restored_config.contains("rcodexmanager-route"));
    assert_eq!(
        std::fs::read_to_string(&auth_path).expect("auth should stay unchanged"),
        r#"{"auth_mode":"chatgpt","token":"keep"}"#
    );
}

#[test]
fn model_route_apply_rejects_default_profile() {
    let home = fixture_home();
    let home_path = home_arg(home.path());
    let default_home = home.path().join(".codex");
    std::fs::create_dir_all(&default_home).expect("failed to create default codex home");
    let default_config = default_home.join("config.toml");
    std::fs::write(
        &default_config,
        "model = \"gpt-5.5\"\nmodel_reasoning_effort = \"xhigh\"\n",
    )
    .expect("failed to write default config");

    let apply = run_cli(&[
        "--home",
        &home_path,
        "model-route",
        "apply",
        "--name",
        "codex",
        "--preset",
        "custom-responses",
        "--model",
        "gpt-5.5",
        "--upstream-base-url",
        "https://api.openai.com/v1",
        "--confirm-sensitive",
        "--json",
    ]);
    assert_ne!(apply.status.code(), Some(0));
    let payload = parse_stdout_json(&apply);
    assert_eq!(payload["ok"], false);
    assert!(payload["error"]["message"]
        .as_str()
        .expect("error message")
        .contains("default codex profile is protected"));

    let config = std::fs::read_to_string(default_config).expect("default config");
    assert!(!config.contains("rcodexmanager-route"));
}

#[test]
fn create_reset_and_delete_profile_keep_json_contract() {
    let home = fixture_home();
    let home_path = home_arg(home.path());

    let create = run_cli(&[
        "--home",
        &home_path,
        "create",
        "--name",
        "codex-f",
        "--model",
        "gpt-5.5",
        "--reasoning-effort",
        "xhigh",
        "--alias",
        "Draft",
        "--category",
        "深度",
        "--json",
    ]);
    assert_eq!(create.status.code(), Some(0));
    let create_payload = parse_stdout_json(&create);
    assert_eq!(create_payload["ok"], true);
    assert_eq!(create_payload["command"], "create");
    assert_eq!(create_payload["data"]["profile"]["name"], "codex-f");
    assert_eq!(create_payload["data"]["profile"]["alias"], "Draft");
    assert_eq!(create_payload["data"]["profile"]["category"], "深度");
    let created_config =
        std::fs::read_to_string(home.path().join(".codex-f/config.toml")).expect("created config");
    assert!(!created_config.contains("responses_websockets"));

    let update = run_cli(&[
        "--home",
        &home_path,
        "update",
        "--name",
        "codex-f",
        "--alias",
        "Main",
        "--category",
        "平衡",
        "--note",
        "日常主力",
        "--json",
    ]);
    assert_eq!(update.status.code(), Some(0));
    let update_payload = parse_stdout_json(&update);
    assert_eq!(update_payload["ok"], true);
    assert_eq!(update_payload["command"], "update");
    assert_eq!(update_payload["data"]["profile"]["alias"], "Main");
    assert_eq!(update_payload["data"]["profile"]["note"], "日常主力");

    let duplicate = run_cli(&[
        "--home", &home_path, "create", "--name", "codex-f", "--json",
    ]);
    assert_eq!(duplicate.status.code(), Some(2));
    let duplicate_payload = parse_stdout_json(&duplicate);
    assert_eq!(duplicate_payload["ok"], false);
    assert_eq!(duplicate_payload["error"]["code"], "invalid_arguments");

    let reset = run_cli(&[
        "--home",
        &home_path,
        "reset",
        "--name",
        "codex-f",
        "--model",
        "gpt-5.4",
        "--reasoning-effort",
        "medium",
        "--json",
    ]);
    assert_eq!(reset.status.code(), Some(0));
    let reset_payload = parse_stdout_json(&reset);
    assert_eq!(reset_payload["ok"], true);
    assert_eq!(reset_payload["command"], "reset");
    assert_eq!(reset_payload["data"]["profile"]["model"], "gpt-5.4");

    let terminate = run_cli(&[
        "--home",
        &home_path,
        "terminate",
        "--name",
        "codex-f",
        "--json",
    ]);
    assert_eq!(terminate.status.code(), Some(0));
    let terminate_payload = parse_stdout_json(&terminate);
    assert_eq!(terminate_payload["ok"], true);
    assert_eq!(terminate_payload["command"], "terminate");

    let delete = run_cli(&[
        "--home",
        &home_path,
        "delete",
        "--name",
        "codex-f",
        "--archive-data",
        "--json",
    ]);
    assert_eq!(delete.status.code(), Some(0));
    let delete_payload = parse_stdout_json(&delete);
    assert_eq!(delete_payload["ok"], true);
    assert_eq!(delete_payload["command"], "delete");
}

#[test]
fn archive_and_restore_profile_only_change_visibility_metadata() {
    let home = fixture_home();
    let home_path = home_arg(home.path());
    let zshrc_path = home.path().join(".zshrc");
    let config_path = home.path().join(".codex-isolated-test/config.toml");
    let zshrc_before = std::fs::read_to_string(&zshrc_path).expect("zshrc before archive");
    let config_before = std::fs::read_to_string(&config_path).expect("config before archive");

    let archive = run_cli(&[
        "--home", &home_path, "archive", "--name", "codex-b", "--json",
    ]);
    assert_eq!(archive.status.code(), Some(0));
    let archive_payload = parse_stdout_json(&archive);
    assert_eq!(archive_payload["ok"], true);
    assert_eq!(archive_payload["command"], "archive");
    assert_eq!(archive_payload["data"]["profile"]["isArchived"], true);
    assert!(archive_payload["data"]["profile"]["archivedAt"].is_string());

    let archived_list = run_cli(&["--home", &home_path, "list", "--json"]);
    let archived_payload = parse_stdout_json(&archived_list);
    assert_eq!(archived_payload["data"]["profileCount"], 0);
    assert_eq!(archived_payload["data"]["archivedCount"], 1);
    assert_eq!(
        archived_payload["data"]["archivedProfiles"][0]["name"],
        "codex-b"
    );
    assert_eq!(
        std::fs::read_to_string(&zshrc_path).expect("zshrc after archive"),
        zshrc_before
    );
    assert_eq!(
        std::fs::read_to_string(&config_path).expect("config after archive"),
        config_before
    );

    let duplicate = run_cli(&[
        "--home", &home_path, "create", "--name", "codex-b", "--json",
    ]);
    assert_eq!(duplicate.status.code(), Some(2));

    let restore = run_cli(&[
        "--home", &home_path, "restore", "--name", "codex-b", "--json",
    ]);
    assert_eq!(restore.status.code(), Some(0));
    let restore_payload = parse_stdout_json(&restore);
    assert_eq!(restore_payload["ok"], true);
    assert_eq!(restore_payload["command"], "restore");
    assert_eq!(restore_payload["data"]["profile"]["isArchived"], false);

    let active_list = run_cli(&["--home", &home_path, "list", "--json"]);
    let active_payload = parse_stdout_json(&active_list);
    assert_eq!(active_payload["data"]["profileCount"], 1);
    assert_eq!(active_payload["data"]["archivedCount"], 0);
    assert_eq!(active_payload["data"]["profiles"][0]["name"], "codex-b");
}
