use rcodexmanager_lib::core::{run_doctor, DoctorCheckStatus, ProfileContext};

fn fixture_context() -> (tempfile::TempDir, ProfileContext) {
    let home = tempfile::tempdir().expect("temp home");
    std::fs::write(
        home.path().join(".zshrc"),
        r#"
codex-b() {
  mkdir -p "$HOME/.codex-b" "$HOME/Library/Application Support/Codex-B"
  open -n -a "Codex" \
    --env CODEX_HOME="$HOME/.codex-b" \
    --args --user-data-dir="$HOME/Library/Application Support/Codex-B"
}
"#,
    )
    .unwrap();
    std::fs::create_dir_all(home.path().join(".codex-b")).unwrap();
    std::fs::create_dir_all(home.path().join("Library/Application Support/Codex-B")).unwrap();
    std::fs::write(
        home.path().join(".codex-b/config.toml"),
        "model = \"gpt-5.5\"\nmodel_reasoning_effort = \"medium\"\n",
    )
    .unwrap();
    std::fs::write(
        home.path().join(".codex-b/auth.json"),
        r#"{"auth_mode":"chatgpt","tokens":{"access_token":"secret-doctor-token"}}"#,
    )
    .unwrap();
    let context = ProfileContext::from_options(None, Some(home.path().to_path_buf())).unwrap();
    (home, context)
}

#[test]
fn doctor_is_read_only_and_redacts_home_and_auth_material() {
    let (home, context) = fixture_context();
    let zshrc_before = std::fs::read_to_string(home.path().join(".zshrc")).unwrap();
    let config_before = std::fs::read_to_string(home.path().join(".codex-b/config.toml")).unwrap();

    let report = run_doctor(&context).expect("doctor report");
    let payload = serde_json::to_string_pretty(&report).unwrap();

    assert!(report.ready);
    assert!(report.checks.len() >= 8);
    assert!(!payload.contains(home.path().to_string_lossy().as_ref()));
    assert!(!payload.contains("secret-doctor-token"));
    assert_eq!(
        std::fs::read_to_string(home.path().join(".zshrc")).unwrap(),
        zshrc_before
    );
    assert_eq!(
        std::fs::read_to_string(home.path().join(".codex-b/config.toml")).unwrap(),
        config_before
    );
    assert!(!home
        .path()
        .join(".rcodexmanager/feishu-remote.json")
        .exists());
}

#[test]
fn doctor_reports_damaged_metadata_without_exposing_its_absolute_path() {
    let (home, context) = fixture_context();
    std::fs::create_dir_all(home.path().join(".rcodexmanager")).unwrap();
    std::fs::write(
        home.path().join(".rcodexmanager/auth-vault.json"),
        "{ damaged",
    )
    .unwrap();

    let report = run_doctor(&context).expect("doctor report");
    let backup_check = report
        .checks
        .iter()
        .find(|check| check.id == "auth.backups")
        .expect("backup check");
    let payload = serde_json::to_string_pretty(&report).unwrap();

    assert!(!report.ready);
    assert_eq!(backup_check.status, DoctorCheckStatus::Error);
    assert!(!payload.contains(home.path().to_string_lossy().as_ref()));
    assert!(payload.contains("~/"));
}
