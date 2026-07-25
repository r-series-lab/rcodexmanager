use rcodexmanager_lib::core::{
    list_wechat_bridges, read_wechat_bridge_log, unbind_wechat_bridge, ProfileContext,
    ReadWechatBridgeLogInput, UnbindWechatBridgeInput,
};

fn fixture_context() -> (tempfile::TempDir, ProfileContext) {
    let temp_dir = tempfile::tempdir().expect("failed to create temp dir");
    std::fs::write(
        temp_dir.path().join(".zshrc"),
        r#"
codex-b() {
  mkdir -p "$HOME/.codex-b" "$HOME/Library/Application Support/Codex-B"
  open -n -a "Codex" \
    --env CODEX_HOME="$HOME/.codex-b" \
    --args --user-data-dir="$HOME/Library/Application Support/Codex-B"
}
"#,
    )
    .expect("failed to write fixture zshrc");
    let codex_home = temp_dir.path().join(".codex-b");
    std::fs::create_dir_all(&codex_home).expect("failed to create codex home");
    std::fs::write(
        codex_home.join("config.toml"),
        "model = \"gpt-5.5\"\nmodel_reasoning_effort = \"medium\"\n",
    )
    .expect("failed to write config");
    std::fs::write(codex_home.join("auth.json"), r#"{"auth_mode":"chatgpt"}"#)
        .expect("failed to write auth");

    let context =
        ProfileContext::from_options(None, Some(temp_dir.path().to_path_buf())).expect("context");
    (temp_dir, context)
}

#[test]
fn list_wechat_bridges_detects_existing_instance_token_without_reading_it() {
    let (home, context) = fixture_context();
    let instance_dir = home.path().join(".wechat-acp/instances/codex-b");
    std::fs::create_dir_all(&instance_dir).expect("failed to create instance dir");
    std::fs::write(
        instance_dir.join("token.json"),
        r#"{"secret":"do-not-read"}"#,
    )
    .expect("failed to write token");

    let report = list_wechat_bridges(&context).expect("bridge report");
    let bridge = report
        .bridges
        .iter()
        .find(|bridge| bridge.profile_name == "codex-b")
        .expect("codex-b bridge should exist");

    assert_eq!(bridge.instance, "codex-b");
    assert!(bridge.auth_exists);
    assert!(bridge.token_exists);
    assert_eq!(bridge.connection_state, "bound");
    assert!(bridge
        .token_path
        .ends_with(".wechat-acp/instances/codex-b/token.json"));
}

#[test]
fn list_wechat_bridges_discovers_one_external_instance_for_one_profile() {
    let (home, context) = fixture_context();
    let instance_dir = home.path().join(".wechat-acp/instances/codex-d");
    std::fs::create_dir_all(&instance_dir).expect("failed to create external instance dir");
    std::fs::write(
        instance_dir.join("token.json"),
        r#"{"secret":"external-do-not-read"}"#,
    )
    .expect("failed to write external token");

    let report = list_wechat_bridges(&context).expect("bridge report");
    let bridge = report
        .bridges
        .iter()
        .find(|bridge| bridge.profile_name == "codex-b")
        .expect("the only profile should receive the only discovered instance");

    assert_eq!(bridge.instance, "codex-d");
    assert!(bridge.token_exists);
    assert!(!bridge.managed_by_app);
    assert_eq!(bridge.connection_state, "bound");
}

#[test]
fn list_wechat_bridges_matches_external_suffix_instance_with_multiple_profiles() {
    let (home, context) = fixture_context();
    let default_home = home.path().join(".codex");
    std::fs::create_dir_all(&default_home).expect("failed to create default codex home");
    std::fs::write(default_home.join("config.toml"), "model = \"gpt-5.5\"\n")
        .expect("failed to write default config");
    std::fs::write(default_home.join("auth.json"), r#"{"auth_mode":"chatgpt"}"#)
        .expect("failed to write default auth");

    let instance_dir = home.path().join(".wechat-acp/instances/codex-d");
    std::fs::create_dir_all(&instance_dir).expect("failed to create external instance dir");
    std::fs::write(
        instance_dir.join("token.json"),
        r#"{"secret":"external-do-not-read"}"#,
    )
    .expect("failed to write external token");

    let report = list_wechat_bridges(&context).expect("bridge report");
    let default_bridge = report
        .bridges
        .iter()
        .find(|bridge| bridge.profile_name == "codex")
        .expect("default profile should exist");
    let custom_bridge = report
        .bridges
        .iter()
        .find(|bridge| bridge.profile_name == "codex-b")
        .expect("custom profile should exist");

    assert_eq!(default_bridge.instance, "codex-d");
    assert!(default_bridge.token_exists);
    assert!(!default_bridge.managed_by_app);
    assert_eq!(custom_bridge.instance, "codex-b");
    assert!(!custom_bridge.token_exists);
}

#[test]
fn unbind_archives_token_and_requires_confirmation() {
    let (home, context) = fixture_context();
    let profile_name = "codex-unbind-fixture";
    let zshrc_path = home.path().join(".zshrc");
    let zshrc = std::fs::read_to_string(&zshrc_path)
        .unwrap()
        .replace("codex-b()", &format!("{profile_name}()"));
    std::fs::write(&zshrc_path, zshrc).unwrap();
    let instance_dir = home
        .path()
        .join(format!(".wechat-acp/instances/{profile_name}"));
    std::fs::create_dir_all(&instance_dir).unwrap();
    let token_path = instance_dir.join("token.json");
    std::fs::write(&token_path, r#"{"secret":"archive-me"}"#).unwrap();

    let rejected = unbind_wechat_bridge(
        &context,
        UnbindWechatBridgeInput {
            profile_name: profile_name.to_string(),
            confirm_sensitive: false,
        },
    );
    assert!(rejected.is_err());
    assert!(token_path.exists());

    let report = unbind_wechat_bridge(
        &context,
        UnbindWechatBridgeInput {
            profile_name: profile_name.to_string(),
            confirm_sensitive: true,
        },
    )
    .expect("unbind should archive the token");
    let bridge = report
        .bridges
        .iter()
        .find(|bridge| bridge.profile_name == profile_name)
        .unwrap();
    assert!(!token_path.exists());
    assert!(!bridge.token_exists);
    assert_eq!(bridge.connection_state, "unbound");

    let backup_root = home.path().join(format!(
        ".rcodexmanager/wechat-bridges/{profile_name}/binding-backups"
    ));
    let archived = std::fs::read_dir(&backup_root)
        .unwrap()
        .filter_map(Result::ok)
        .any(|entry| entry.path().join("token.json").exists());
    assert!(archived);
}

#[test]
fn read_wechat_bridge_log_redacts_sensitive_lines() {
    let (home, context) = fixture_context();
    let instance_dir = home.path().join(".wechat-acp/instances/codex-b");
    std::fs::create_dir_all(&instance_dir).expect("failed to create instance dir");
    std::fs::write(
        instance_dir.join("wechat-acp.log"),
        "ready\naccess_token=secret-value\nscan qr\n",
    )
    .expect("failed to write log");

    let report = read_wechat_bridge_log(
        &context,
        ReadWechatBridgeLogInput {
            profile_name: "codex-b".to_string(),
            lines: Some(10),
        },
    )
    .expect("log report");

    assert_eq!(
        report.log_tail,
        vec![
            "ready".to_string(),
            "[sensitive log line hidden]".to_string(),
            "scan qr".to_string()
        ]
    );
}
