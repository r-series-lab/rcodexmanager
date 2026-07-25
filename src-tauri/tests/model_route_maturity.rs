use rcodexmanager_lib::core::{
    check_model_route_draft, ModelRoutePreset, PreviewModelRouteInput, ProfileContext,
};

#[test]
fn draft_check_does_not_write_profile_config() {
    let home = tempfile::tempdir().unwrap();
    std::fs::write(
        home.path().join(".zshrc"),
        r#"
codex-draft-check-fixture() {
  mkdir -p "$HOME/.codex-draft-check" "$HOME/Library/Application Support/Codex-Draft-Check"
  open -n -a "Codex" \
    --env CODEX_HOME="$HOME/.codex-draft-check" \
    --args --user-data-dir="$HOME/Library/Application Support/Codex-Draft-Check"
}
"#,
    )
    .unwrap();
    let codex_home = home.path().join(".codex-draft-check");
    std::fs::create_dir_all(&codex_home).unwrap();
    let config_path = codex_home.join("config.toml");
    let original = "model = \"gpt-5.5\"\nmodel_reasoning_effort = \"medium\"\n";
    std::fs::write(&config_path, original).unwrap();
    let context = ProfileContext::from_options(None, Some(home.path().to_path_buf())).unwrap();

    let result = check_model_route_draft(
        &context,
        PreviewModelRouteInput {
            profile_name: "codex-draft-check-fixture".to_string(),
            preset: ModelRoutePreset::CustomResponses,
            model: "draft-model".to_string(),
            reasoning_effort: Some("medium".to_string()),
            proxy_base_url: None,
            upstream_base_url: Some("http://127.0.0.1:9/v1".to_string()),
            api_key: None,
            api_key_env: None,
        },
    )
    .expect("connection failure should be returned as a diagnostic result");

    assert!(!result.ok);
    assert_eq!(result.status, "connect-failed");
    assert_eq!(std::fs::read_to_string(&config_path).unwrap(), original);
    assert!(std::fs::read_dir(&codex_home)
        .unwrap()
        .filter_map(Result::ok)
        .all(|entry| !entry.file_name().to_string_lossy().contains("model-route")));
}
