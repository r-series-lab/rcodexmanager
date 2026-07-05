pub mod cli;
pub mod core;

#[tauri::command]
async fn list_profiles_command() -> Result<core::ProfileReport, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let context = core::ProfileContext::from_options(None, None)?;
        core::list_profiles(&context)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
async fn list_profile_sessions_command(
    input: core::ListProfileSessionsInput,
) -> Result<core::ProfileSessionReport, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let context = core::ProfileContext::from_options(None, None)?;
        core::list_profile_sessions(&context, input)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
async fn list_auth_vault_command() -> Result<core::AuthVaultReport, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let context = core::ProfileContext::from_options(None, None)?;
        core::list_auth_vault(&context)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
async fn create_auth_backup_command(
    input: core::CreateAuthBackupInput,
) -> Result<core::AuthVaultReport, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let context = core::ProfileContext::from_options(None, None)?;
        core::create_auth_backup(&context, input)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
async fn apply_auth_backup_command(
    input: core::ApplyAuthBackupInput,
) -> Result<core::ProfileActionReport, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let context = core::ProfileContext::from_options(None, None)?;
        core::apply_auth_backup(&context, input)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
async fn rollback_auth_application_command(
    input: core::RollbackAuthApplicationInput,
) -> Result<core::ProfileActionReport, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let context = core::ProfileContext::from_options(None, None)?;
        core::rollback_auth_application(&context, input)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
async fn delete_auth_backup_command(
    input: core::DeleteAuthBackupInput,
) -> Result<core::AuthVaultReport, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let context = core::ProfileContext::from_options(None, None)?;
        core::delete_auth_backup(&context, input)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
async fn update_auth_backup_command(
    input: core::UpdateAuthBackupInput,
) -> Result<core::AuthVaultReport, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let context = core::ProfileContext::from_options(None, None)?;
        core::update_auth_backup(&context, input)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
async fn export_auth_backup_command(
    input: core::ExportAuthBackupInput,
) -> Result<core::AuthBackupExportReport, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let context = core::ProfileContext::from_options(None, None)?;
        core::export_auth_backup(&context, input)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
async fn import_auth_backup_package_command(
    input: core::ImportAuthBackupPackageInput,
) -> Result<core::AuthVaultReport, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let context = core::ProfileContext::from_options(None, None)?;
        core::import_auth_backup_package(&context, input)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
async fn cleanup_auth_backups_command(
    input: core::CleanupAuthBackupsInput,
) -> Result<core::AuthVaultReport, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let context = core::ProfileContext::from_options(None, None)?;
        core::cleanup_auth_backups(&context, input)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
async fn list_wechat_bridges_command() -> Result<core::WechatBridgeReport, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let context = core::ProfileContext::from_options(None, None)?;
        core::list_wechat_bridges(&context)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
async fn start_wechat_bridge_command(
    input: core::StartWechatBridgeInput,
) -> Result<core::WechatBridgeReport, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let context = core::ProfileContext::from_options(None, None)?;
        core::start_wechat_bridge(&context, input)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
async fn stop_wechat_bridge_command(
    input: core::StopWechatBridgeInput,
) -> Result<core::WechatBridgeReport, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let context = core::ProfileContext::from_options(None, None)?;
        core::stop_wechat_bridge(&context, input)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
async fn read_wechat_bridge_log_command(
    input: core::ReadWechatBridgeLogInput,
) -> Result<core::WechatBridgeLogReport, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let context = core::ProfileContext::from_options(None, None)?;
        core::read_wechat_bridge_log(&context, input)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
async fn create_profile_command(
    input: core::CreateProfileInput,
) -> Result<core::ProfileActionReport, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let context = core::ProfileContext::from_options(None, None)?;
        core::create_profile(&context, input)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
async fn copy_profile_command(
    input: core::CopyProfileInput,
) -> Result<core::ProfileActionReport, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let context = core::ProfileContext::from_options(None, None)?;
        core::copy_profile(&context, input)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
async fn delete_profile_command(
    name: String,
    archive_data: bool,
) -> Result<core::ProfileActionReport, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let context = core::ProfileContext::from_options(None, None)?;
        core::delete_profile(&context, &name, archive_data)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
async fn update_profile_metadata_command(
    input: core::ProfileMetadataInput,
) -> Result<core::ProfileActionReport, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let context = core::ProfileContext::from_options(None, None)?;
        core::update_profile_metadata(&context, input)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
async fn reset_profile_command(
    input: core::ResetProfileInput,
) -> Result<core::ProfileActionReport, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let context = core::ProfileContext::from_options(None, None)?;
        core::reset_profile(&context, input)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
async fn launch_profile_command(name: String) -> Result<core::ProfileActionReport, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let context = core::ProfileContext::from_options(None, None)?;
        core::launch_profile(&context, &name)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
async fn terminate_profile_command(name: String) -> Result<core::ProfileActionReport, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let context = core::ProfileContext::from_options(None, None)?;
        core::terminate_profile(&context, &name)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
async fn read_profile_quota_command(name: String) -> Result<core::ProfileQuotaReport, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let context = core::ProfileContext::from_options(None, None)?;
        core::read_profile_quota(&context, &name)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
async fn import_profile_auth_command(
    input: core::ImportAuthInput,
) -> Result<core::ProfileActionReport, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let context = core::ProfileContext::from_options(None, None)?;
        core::import_profile_auth(&context, input)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
async fn repair_profile_network_command(
    name: String,
) -> Result<core::CodexNetworkRepairReport, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let context = core::ProfileContext::from_options(None, None)?;
        core::repair_profile_network(&context, &name, true)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
fn reveal_path_command(path: String) -> Result<(), String> {
    core::reveal_in_finder(path.into())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            list_profiles_command,
            list_profile_sessions_command,
            list_auth_vault_command,
            create_auth_backup_command,
            apply_auth_backup_command,
            rollback_auth_application_command,
            delete_auth_backup_command,
            update_auth_backup_command,
            export_auth_backup_command,
            import_auth_backup_package_command,
            cleanup_auth_backups_command,
            list_wechat_bridges_command,
            start_wechat_bridge_command,
            stop_wechat_bridge_command,
            read_wechat_bridge_log_command,
            create_profile_command,
            copy_profile_command,
            delete_profile_command,
            update_profile_metadata_command,
            reset_profile_command,
            launch_profile_command,
            terminate_profile_command,
            read_profile_quota_command,
            import_profile_auth_command,
            repair_profile_network_command,
            reveal_path_command
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
