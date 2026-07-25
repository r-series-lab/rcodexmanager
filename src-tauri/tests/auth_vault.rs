use rcodexmanager_lib::core::{
    apply_auth_backup, cleanup_auth_backups, create_auth_backup, create_auth_backups,
    export_auth_backup, import_auth_backup_package, list_auth_vault, preview_auth_backup_package,
    rollback_auth_application, update_auth_backup, ApplyAuthBackupInput, CleanupAuthBackupsInput,
    CreateAuthBackupInput, CreateAuthBackupsInput, ExportAuthBackupInput,
    ImportAuthBackupPackageInput, PreviewAuthBackupPackageInput, ProfileContext,
    RollbackAuthApplicationInput, UpdateAuthBackupInput,
};
use serde_json::{json, Value};

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

codex-f() {
  mkdir -p "$HOME/.codex-f" "$HOME/Library/Application Support/Codex-F"
  open -n -a "Codex" \
    --env CODEX_HOME="$HOME/.codex-f" \
    --args --user-data-dir="$HOME/Library/Application Support/Codex-F"
}
"#,
    )
    .expect("failed to write fixture zshrc");
    for name in [".codex-b", ".codex-f"] {
        std::fs::create_dir_all(temp_dir.path().join(name)).expect("failed to create codex home");
        std::fs::write(
            temp_dir.path().join(name).join("config.toml"),
            "model = \"gpt-5.5\"\nmodel_reasoning_effort = \"medium\"\n",
        )
        .expect("failed to write config");
    }

    let context =
        ProfileContext::from_options(None, Some(temp_dir.path().to_path_buf())).expect("context");
    (temp_dir, context)
}

fn write_auth(path: &std::path::Path, access: &str, refresh: &str, account: &str) {
    std::fs::write(
        path,
        serde_json::to_string_pretty(&json!({
            "auth_mode": "chatgpt",
            "tokens": {
                "access_token": access,
                "refresh_token": refresh,
                "account_id": account
            }
        }))
        .unwrap(),
    )
    .expect("failed to write auth");
}

fn read_account_id(path: &std::path::Path) -> String {
    let value: Value =
        serde_json::from_str(&std::fs::read_to_string(path).expect("auth should be readable"))
            .expect("auth should be json");
    value["tokens"]["account_id"]
        .as_str()
        .expect("account id")
        .to_string()
}

#[test]
fn apply_auth_backup_records_and_rolls_back_previous_auth() {
    let (home, context) = fixture_context();
    let source_auth = home.path().join(".codex-b/auth.json");
    let target_auth = home.path().join(".codex-f/auth.json");
    write_auth(
        &source_auth,
        "source.access",
        "source.refresh",
        "source-account",
    );
    write_auth(&target_auth, "old.access", "old.refresh", "old-account");

    let vault = create_auth_backup(
        &context,
        CreateAuthBackupInput {
            name: "codex-b".to_string(),
            label: Some("Source account".to_string()),
        },
    )
    .expect("backup should succeed");
    let backup_id = vault.backups[0].id.clone();

    let applied = apply_auth_backup(
        &context,
        ApplyAuthBackupInput {
            backup_id,
            target_profile_name: "codex-f".to_string(),
            confirm_sensitive: true,
        },
    )
    .expect("apply should succeed");
    assert_eq!(applied.backups.len(), 1);
    assert_eq!(read_account_id(&target_auth), "source-account");

    let vault = list_auth_vault(&context).expect("vault should read");
    assert_eq!(vault.recent_applications.len(), 1);
    let application = &vault.recent_applications[0];
    assert_eq!(application.backup_label, "Source account");
    assert_eq!(application.target_profile_name, "codex-f");
    assert!(application.previous_auth_exists);
    assert!(application.rolled_back_at.is_none());

    let rolled_back = rollback_auth_application(
        &context,
        RollbackAuthApplicationInput {
            application_id: application.id.clone(),
            confirm_sensitive: true,
        },
    )
    .expect("rollback should succeed");
    assert_eq!(rolled_back.action, "rollbackAuthApplication");
    assert_eq!(read_account_id(&target_auth), "old-account");

    let vault = list_auth_vault(&context).expect("vault should read after rollback");
    assert!(vault.recent_applications[0].rolled_back_at.is_some());
}

#[test]
fn cleanup_auth_backups_keeps_pinned_duplicate_for_account() {
    let (home, context) = fixture_context();
    let source_auth = home.path().join(".codex-b/auth.json");
    write_auth(
        &source_auth,
        "first.access",
        "first.refresh",
        "same-account",
    );

    create_auth_backup(
        &context,
        CreateAuthBackupInput {
            name: "codex-b".to_string(),
            label: Some("Old account".to_string()),
        },
    )
    .expect("first backup should succeed");

    write_auth(
        &source_auth,
        "second.access",
        "second.refresh",
        "same-account",
    );
    let vault = create_auth_backup(
        &context,
        CreateAuthBackupInput {
            name: "codex-b".to_string(),
            label: Some("Pinned account".to_string()),
        },
    )
    .expect("second backup should succeed");
    let pinned_id = vault
        .backups
        .iter()
        .find(|backup| backup.label == "Pinned account")
        .expect("pinned backup")
        .id
        .clone();

    update_auth_backup(
        &context,
        UpdateAuthBackupInput {
            backup_id: pinned_id.clone(),
            label: Some("Pinned account".to_string()),
            note: Some("keep this account".to_string()),
            pinned: true,
        },
    )
    .expect("pin backup should succeed");

    let cleaned = cleanup_auth_backups(
        &context,
        CleanupAuthBackupsInput {
            account_key: "same-account".to_string(),
            confirm_sensitive: true,
        },
    )
    .expect("cleanup should succeed");
    let matching = cleaned
        .backups
        .iter()
        .filter(|backup| {
            backup
                .account
                .as_ref()
                .and_then(|account| account.account_id.as_deref())
                == Some("same-account")
        })
        .collect::<Vec<_>>();

    assert_eq!(matching.len(), 1);
    assert_eq!(matching[0].id, pinned_id);
    assert_eq!(matching[0].label, "Pinned account");
    assert!(matching[0].pinned);
    assert_eq!(
        read_account_id(std::path::Path::new(&matching[0].path)),
        "same-account"
    );
}

#[test]
fn export_and_import_auth_backup_package_roundtrips_into_vault() {
    let (home, context) = fixture_context();
    let source_auth = home.path().join(".codex-b/auth.json");
    write_auth(
        &source_auth,
        "package.access",
        "package.refresh",
        "package-account",
    );

    let vault = create_auth_backup(
        &context,
        CreateAuthBackupInput {
            name: "codex-b".to_string(),
            label: Some("Package Source".to_string()),
        },
    )
    .expect("backup should succeed");
    let backup_id = vault.backups[0].id.clone();

    let exported = export_auth_backup(
        &context,
        ExportAuthBackupInput {
            backup_id: backup_id.clone(),
        },
    )
    .expect("export should succeed");
    assert!(std::path::Path::new(&exported.path).exists());
    assert!(exported.file_name.ends_with(".rcodex-auth.json"));

    let package_json = std::fs::read_to_string(&exported.path).expect("package should be readable");
    let package_value: Value = serde_json::from_str(&package_json).expect("package should be json");
    assert_eq!(
        package_value["kind"].as_str(),
        Some("app.rseries.rcodexmanager.auth-backup")
    );

    let imported = import_auth_backup_package(
        &context,
        ImportAuthBackupPackageInput {
            package_json,
            label: Some("Imported Package".to_string()),
            note: Some("roundtrip".to_string()),
            pinned: false,
            confirm_sensitive: true,
        },
    )
    .expect("import package should succeed");
    let imported_backup = imported
        .backups
        .iter()
        .find(|backup| backup.label == "Imported Package")
        .expect("imported backup should exist");

    assert_eq!(imported_backup.note.as_deref(), Some("roundtrip"));
    assert_eq!(
        imported_backup
            .account
            .as_ref()
            .and_then(|account| account.account_id.as_deref()),
        Some("package-account")
    );
    assert_eq!(
        read_account_id(std::path::Path::new(&imported_backup.path)),
        "package-account"
    );
}

#[test]
fn preview_import_is_read_only_and_batch_backup_keeps_partial_results() {
    let (home, context) = fixture_context();
    write_auth(
        &home.path().join(".codex-b/auth.json"),
        "batch.access",
        "batch.refresh",
        "batch-account",
    );

    let batch = create_auth_backups(
        &context,
        CreateAuthBackupsInput {
            profile_names: vec!["codex-b".to_string(), "codex-f".to_string()],
            label: Some("批量备份".to_string()),
        },
    )
    .expect("batch should return per-item results");
    assert_eq!(batch.success_count, 1);
    assert_eq!(batch.failure_count, 1);
    assert!(batch.results.iter().any(|result| result.ok));
    assert!(batch.results.iter().any(|result| !result.ok));
    assert!(batch.vault.backups[0].valid);
    assert!(batch.vault.backups[0].file_size_bytes.is_some());

    let exported = export_auth_backup(
        &context,
        ExportAuthBackupInput {
            backup_id: batch.vault.backups[0].id.clone(),
        },
    )
    .expect("export should succeed");
    let package_json = std::fs::read_to_string(&exported.path).expect("package json");
    let before_count = list_auth_vault(&context).unwrap().backup_count;
    let preview = preview_auth_backup_package(PreviewAuthBackupPackageInput { package_json })
        .expect("preview should parse without writing");
    let after_count = list_auth_vault(&context).unwrap().backup_count;

    assert!(preview.valid);
    assert_eq!(preview.source_profile_name.as_deref(), Some("codex-b"));
    assert!(preview.has_refresh_token);
    assert_eq!(before_count, after_count);
}

#[test]
fn damaged_backup_is_reported_and_cannot_appear_valid() {
    let (home, context) = fixture_context();
    write_auth(
        &home.path().join(".codex-b/auth.json"),
        "valid.access",
        "valid.refresh",
        "valid-account",
    );
    let vault = create_auth_backup(
        &context,
        CreateAuthBackupInput {
            name: "codex-b".to_string(),
            label: Some("Will break".to_string()),
        },
    )
    .unwrap();
    std::fs::write(&vault.backups[0].path, "{broken-json").unwrap();

    let refreshed = list_auth_vault(&context).unwrap();
    assert!(!refreshed.backups[0].valid);
    assert!(refreshed.backups[0]
        .validation_message
        .as_deref()
        .is_some_and(|message| message.contains("JSON")));
}
