use rcodexmanager_lib::core::{
    create_profile, CreateProfileInput, ProfileContext, ProfileLauncherKind,
    ReadProfileSessionDetailInput,
};
use rcodexmanager_lib::remote::{
    list_server_nodes, probe_server_node_with_ssh, run_server_node_operation_with_ssh,
    sync_server_profile_with_ssh, upsert_server_node, ProbeServerNodeInput,
    RunServerNodeOperationInput, ServerNodeOperation, SyncServerProfileInput,
    UpsertServerNodeInput,
};

#[test]
fn server_node_operations_accept_frontend_camel_case_fields() {
    for kind in ["wechat-start", "wechat-stop", "wechat-restart"] {
        let input: RunServerNodeOperationInput = serde_json::from_value(serde_json::json!({
            "nodeId": "node-aliyun",
            "operation": {
                "kind": kind,
                "profileName": "codex-p"
            }
        }))
        .expect("frontend command input should deserialize");

        assert_eq!(input.node_id, "node-aliyun");
        let profile_name = match input.operation {
            ServerNodeOperation::WechatStart { profile_name }
            | ServerNodeOperation::WechatStop { profile_name }
            | ServerNodeOperation::WechatRestart { profile_name } => profile_name,
            _ => panic!("unexpected operation variant"),
        };
        assert_eq!(profile_name, "codex-p");
    }

    for operation in [
        serde_json::json!({"kind": "launch-profile", "profileName": "codex-p"}),
        serde_json::json!({
            "kind": "apply-auth-backup",
            "backupId": "backup-1",
            "targetProfileName": "codex-p",
            "confirmSensitive": true
        }),
        serde_json::json!({
            "kind": "model-route-restore",
            "profileName": "codex-p",
            "confirmSensitive": true
        }),
        serde_json::json!({
            "kind": "update-profile-model",
            "input": {
                "profileName": "codex-p",
                "model": "gpt-5.5",
                "reasoningEffort": "xhigh"
            }
        }),
    ] {
        serde_json::from_value::<ServerNodeOperation>(operation)
            .expect("frontend operation fields should deserialize");
    }

    let serialized = serde_json::to_value(ServerNodeOperation::WechatRestart {
        profile_name: "codex-p".to_string(),
    })
    .expect("operation should serialize");
    assert_eq!(serialized["profileName"], "codex-p");
    assert!(serialized.get("profile_name").is_none());
}

#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;

fn context(home: &tempfile::TempDir) -> ProfileContext {
    ProfileContext::from_options(
        Some(home.path().join(".bashrc")),
        Some(home.path().to_path_buf()),
    )
    .expect("context")
}

#[cfg(unix)]
fn fake_ssh(home: &tempfile::TempDir) -> std::path::PathBuf {
    let path = home.path().join("ssh");
    std::fs::write(
        &path,
        r#"#!/bin/sh
for arg in "$@"; do remote="$arg"; done
case "$remote" in
  *"__RCM_HOST__"*)
    printf '%s\n' \
      '__RCM_HOST__=node-one' \
      '__RCM_USER__=admin' \
      '__RCM_OS__=ubuntu 24.04' \
      '__RCM_ARCH__=x86_64' \
      '__RCM_SHELL__=/bin/bash' \
      '__RCM_CODEX__=1' \
      '__RCM_CLI__=1'
    ;;
  *"'info'"*)
    printf '%s\n' '{"ok":true,"command":"info","data":{"version":"0.1.0","desktopAvailable":false}}'
    ;;
  *"'list'"*)
    printf '%s\n' '{"ok":true,"command":"list","data":{"generatedAt":"now","profileCount":1,"profiles":[{"name":"codex-o","launcherKind":"server"}]}}'
    ;;
  *)
    printf '%s\n' '{"ok":false,"error":{"code":"unsupported","message":"unsupported fake command"}}'
    exit 2
    ;;
esac
"#,
    )
    .expect("fake ssh");
    let mut permissions = std::fs::metadata(&path).expect("metadata").permissions();
    permissions.set_mode(0o755);
    std::fs::set_permissions(&path, permissions).expect("permissions");
    path
}

#[cfg(unix)]
fn flaky_probe_ssh(home: &tempfile::TempDir) -> std::path::PathBuf {
    let path = home.path().join("flaky-probe-ssh");
    let first_probe = home.path().join("first-probe");
    let script = format!(
        r#"#!/bin/sh
for arg in "$@"; do remote="$arg"; done
case "$remote" in
  *"__RCM_HOST__"*)
    if [ ! -f "{first_probe}" ]; then
      touch "{first_probe}"
      echo 'Timeout, server demo-server not responding.' >&2
      exit 255
    fi
    printf '%s\n' \
      '__RCM_HOST__=node-one' \
      '__RCM_USER__=admin' \
      '__RCM_OS__=ubuntu 24.04' \
      '__RCM_ARCH__=x86_64' \
      '__RCM_SHELL__=/bin/bash' \
      '__RCM_CODEX__=1' \
      '__RCM_CLI__=1'
    ;;
  *"'info'"*)
    printf '%s\n' '{{"ok":true,"command":"info","data":{{"version":"0.1.0","desktopAvailable":false}}}}'
    ;;
  *)
    printf '%s\n' '{{"ok":false,"error":{{"code":"unsupported","message":"unsupported fake command"}}}}'
    exit 2
    ;;
esac
"#,
        first_probe = first_probe.display(),
    );
    std::fs::write(&path, script).expect("flaky probe ssh");
    let mut permissions = std::fs::metadata(&path).expect("metadata").permissions();
    permissions.set_mode(0o755);
    std::fs::set_permissions(&path, permissions).expect("permissions");
    path
}

#[cfg(unix)]
fn large_output_ssh(home: &tempfile::TempDir) -> std::path::PathBuf {
    let path = home.path().join("large-output-ssh");
    std::fs::write(
        &path,
        r#"#!/bin/sh
printf '%s' '{"ok":true,"command":"sessions-detail","data":{"summary":"'
awk 'BEGIN { for (i = 0; i < 1048576; i++) printf "x" }'
printf '%s\n' '"}}'
"#,
    )
    .expect("large output ssh");
    let mut permissions = std::fs::metadata(&path).expect("metadata").permissions();
    permissions.set_mode(0o755);
    std::fs::set_permissions(&path, permissions).expect("permissions");
    path
}

#[cfg(unix)]
fn profile_sync_ssh(home: &tempfile::TempDir) -> std::path::PathBuf {
    let path = home.path().join("profile-sync-ssh");
    let auth_capture = home.path().join("received-auth.json");
    let command_log = home.path().join("remote-commands.log");
    let script = r#"#!/bin/sh
for arg in "$@"; do remote="$arg"; done
printf '%s\n' "$remote" >> "__COMMAND_LOG__"
case "$remote" in
  *"'create'"*)
    printf '%s\n' '{"ok":true,"command":"create","data":{"message":"created"}}'
    ;;
  *"import-auth"*)
    cat > "__AUTH_CAPTURE__"
    printf '%s\n' '{"ok":true,"command":"import-auth","data":{"message":"imported"}}'
    ;;
  *"'list'"*)
    printf '%s\n' '{"ok":true,"command":"list","data":{"profileCount":1,"profiles":[{"name":"codex-synced","model":"gpt-5.5","reasoningEffort":"medium","launcherKind":"server"}]}}'
    ;;
  *)
    printf '%s\n' '{"ok":false,"error":{"code":"unsupported","message":"unsupported fake command"}}'
    exit 2
    ;;
esac
"#
    .replace("__AUTH_CAPTURE__", &auth_capture.to_string_lossy())
    .replace("__COMMAND_LOG__", &command_log.to_string_lossy());
    std::fs::write(&path, script).expect("fake profile sync ssh");
    let mut permissions = std::fs::metadata(&path).expect("metadata").permissions();
    permissions.set_mode(0o755);
    std::fs::set_permissions(&path, permissions).expect("permissions");
    path
}

#[test]
#[cfg(unix)]
fn node_store_probe_and_remote_list_form_one_json_contract() {
    let home = tempfile::tempdir().expect("home");
    let context = context(&home);
    let report = upsert_server_node(
        &context,
        UpsertServerNodeInput {
            id: None,
            name: "阿里云".to_string(),
            ssh_target: "demo-server".to_string(),
            remote_binary: None,
        },
    )
    .expect("create node");
    let node = report.nodes.first().expect("node").clone();
    assert_eq!(node.remote_binary, "rcodexmanager");

    let ssh = fake_ssh(&home);
    let probe = probe_server_node_with_ssh(
        &context,
        ProbeServerNodeInput {
            node_id: node.id.clone(),
        },
        &ssh,
    )
    .expect("probe");
    assert!(probe.status.reachable);
    assert!(probe.status.cli_installed);
    assert!(probe.status.codex_installed);
    assert_eq!(probe.status.hostname.as_deref(), Some("node-one"));
    assert_eq!(probe.status.cli_version.as_deref(), Some("0.1.0"));

    let operation = run_server_node_operation_with_ssh(
        &context,
        RunServerNodeOperationInput {
            node_id: node.id,
            operation: ServerNodeOperation::ListProfiles,
        },
        &ssh,
    )
    .expect("remote list");
    assert!(operation.ok);
    assert_eq!(operation.command, "list");
    assert_eq!(operation.data.as_ref().unwrap()["profileCount"], 1);

    let stored = list_server_nodes(&context).expect("stored nodes");
    assert_eq!(stored.nodes.len(), 1);
}

#[cfg(unix)]
#[test]
fn read_only_probe_retries_a_transient_ssh_timeout() {
    let home = tempfile::tempdir().expect("home");
    let context = context(&home);
    let node = upsert_server_node(
        &context,
        UpsertServerNodeInput {
            id: None,
            name: "Flaky node".to_string(),
            ssh_target: "flaky-node".to_string(),
            remote_binary: None,
        },
    )
    .expect("node")
    .nodes
    .remove(0);

    let probe = probe_server_node_with_ssh(
        &context,
        ProbeServerNodeInput { node_id: node.id },
        &flaky_probe_ssh(&home),
    )
    .expect("transient timeout should recover");

    assert!(probe.status.reachable);
    assert_eq!(probe.status.hostname.as_deref(), Some("node-one"));
    assert_eq!(probe.status.cli_version.as_deref(), Some("0.1.0"));
}

#[test]
fn node_configuration_rejects_an_ssh_option_as_target() {
    let home = tempfile::tempdir().expect("home");
    let error = upsert_server_node(
        &context(&home),
        UpsertServerNodeInput {
            id: None,
            name: "unsafe".to_string(),
            ssh_target: "-oProxyCommand=bad".to_string(),
            remote_binary: None,
        },
    )
    .expect_err("target must be rejected");
    assert!(error.contains("SSH target"));
}

#[test]
#[cfg(unix)]
fn remote_session_detail_drains_output_larger_than_a_pipe_buffer() {
    let home = tempfile::tempdir().expect("home");
    let context = context(&home);
    let node = upsert_server_node(
        &context,
        UpsertServerNodeInput {
            id: None,
            name: "large-node".to_string(),
            ssh_target: "large-node".to_string(),
            remote_binary: None,
        },
    )
    .expect("create node")
    .nodes
    .remove(0);

    let report = run_server_node_operation_with_ssh(
        &context,
        RunServerNodeOperationInput {
            node_id: node.id,
            operation: ServerNodeOperation::ReadSession {
                input: ReadProfileSessionDetailInput {
                    profile_name: "codex-o".to_string(),
                    session_id: "session-1".to_string(),
                    updated_at: None,
                },
            },
        },
        &large_output_ssh(&home),
    )
    .expect("large remote detail");

    assert!(report.ok);
    assert_eq!(report.timeout_seconds, 120);
    assert_eq!(
        report.data.unwrap()["summary"].as_str().unwrap().len(),
        1024 * 1024
    );
}

#[test]
#[cfg(unix)]
fn profile_sync_streams_auth_over_stdin_without_exposing_it_in_the_command() {
    let home = tempfile::tempdir().expect("home");
    std::fs::write(home.path().join(".bashrc"), "").expect("shell rc");
    let context = context(&home);
    let created = create_profile(
        &context,
        CreateProfileInput {
            name: "codex-source".to_string(),
            codex_home: None,
            user_data_dir: None,
            model: Some("gpt-5.5".to_string()),
            reasoning_effort: Some("medium".to_string()),
            alias: Some("Source".to_string()),
            category: Some("同步".to_string()),
            note: None,
            launcher_kind: Some(ProfileLauncherKind::Server),
        },
    )
    .expect("create local source profile");
    let source = created.profile.expect("source profile");
    let secret = "token-must-never-appear-in-the-ssh-command";
    let auth_body = format!(r#"{{"OPENAI_API_KEY":"{secret}"}}"#);
    std::fs::write(
        std::path::Path::new(&source.codex_home).join("auth.json"),
        &auth_body,
    )
    .expect("local auth");

    let node = upsert_server_node(
        &context,
        UpsertServerNodeInput {
            id: None,
            name: "sync-node".to_string(),
            ssh_target: "sync-node".to_string(),
            remote_binary: None,
        },
    )
    .expect("create node")
    .nodes
    .remove(0);
    let ssh = profile_sync_ssh(&home);

    let unconfirmed = sync_server_profile_with_ssh(
        &context,
        SyncServerProfileInput {
            node_id: node.id.clone(),
            source_profile_name: "codex-source".to_string(),
            target_profile_name: "codex-synced".to_string(),
            sync_auth: true,
            confirm_sensitive: false,
        },
        &ssh,
    )
    .expect_err("sensitive sync must require confirmation");
    assert!(unconfirmed.contains("explicit confirmation"));

    let report = sync_server_profile_with_ssh(
        &context,
        SyncServerProfileInput {
            node_id: node.id,
            source_profile_name: "codex-source".to_string(),
            target_profile_name: "codex-synced".to_string(),
            sync_auth: true,
            confirm_sensitive: true,
        },
        &ssh,
    )
    .expect("sync profile");

    assert!(report.auth_synced);
    assert_eq!(report.source_profile_name, "codex-source");
    assert_eq!(report.target_profile_name, "codex-synced");
    assert_eq!(report.profile["name"], "codex-synced");
    assert_eq!(
        std::fs::read_to_string(home.path().join("received-auth.json")).expect("captured auth"),
        auth_body
    );
    let commands =
        std::fs::read_to_string(home.path().join("remote-commands.log")).expect("command log");
    assert!(!commands.contains(secret));
    assert!(commands.contains("import-auth"));
}

#[test]
#[ignore = "requires RCM_REAL_SSH_TARGET and a configured SSH host"]
fn real_ssh_node_supports_probe_doctor_and_profile_list() {
    let target = std::env::var("RCM_REAL_SSH_TARGET").expect("RCM_REAL_SSH_TARGET");
    let home = tempfile::tempdir().expect("home");
    let context = context(&home);
    let node = upsert_server_node(
        &context,
        UpsertServerNodeInput {
            id: None,
            name: "real-node".to_string(),
            ssh_target: target,
            remote_binary: Some("rcodexmanager".to_string()),
        },
    )
    .expect("create real node")
    .nodes
    .remove(0);

    let probe = probe_server_node_with_ssh(
        &context,
        ProbeServerNodeInput {
            node_id: node.id.clone(),
        },
        std::path::Path::new("ssh"),
    )
    .expect("real probe");
    assert!(probe.status.reachable);
    assert!(probe.status.codex_installed);
    assert!(probe.status.cli_installed);
    assert_eq!(probe.status.arch.as_deref(), Some("x86_64"));

    for operation in [
        ServerNodeOperation::Doctor,
        ServerNodeOperation::ListProfiles,
    ] {
        let report = run_server_node_operation_with_ssh(
            &context,
            RunServerNodeOperationInput {
                node_id: node.id.clone(),
                operation,
            },
            std::path::Path::new("ssh"),
        )
        .expect("real remote operation");
        assert!(report.ok);
        assert!(report.data.is_some());
    }
}
