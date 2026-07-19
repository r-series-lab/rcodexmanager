pub mod cli;
pub mod core;
pub mod remote;

#[tauri::command]
async fn list_server_nodes_command() -> Result<remote::ServerNodeReport, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let context = core::ProfileContext::from_options(None, None)?;
        remote::list_server_nodes(&context)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
async fn upsert_server_node_command(
    input: remote::UpsertServerNodeInput,
) -> Result<remote::ServerNodeReport, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let context = core::ProfileContext::from_options(None, None)?;
        remote::upsert_server_node(&context, input)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
async fn delete_server_node_command(
    input: remote::DeleteServerNodeInput,
) -> Result<remote::ServerNodeReport, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let context = core::ProfileContext::from_options(None, None)?;
        remote::delete_server_node(&context, input)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
async fn probe_server_node_command(
    input: remote::ProbeServerNodeInput,
) -> Result<remote::ServerNodeProbeReport, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let context = core::ProfileContext::from_options(None, None)?;
        remote::probe_server_node(&context, input)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
async fn run_server_node_operation_command(
    input: remote::RunServerNodeOperationInput,
) -> Result<remote::ServerNodeOperationReport, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let context = core::ProfileContext::from_options(None, None)?;
        remote::run_server_node_operation(&context, input)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
async fn run_doctor_command() -> Result<core::DoctorReport, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let context = core::ProfileContext::from_options(None, None)?;
        core::run_doctor(&context)
    })
    .await
    .map_err(|error| error.to_string())?
}

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
async fn read_profile_session_detail_command(
    input: core::ReadProfileSessionDetailInput,
) -> Result<core::CodexSessionSummary, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let context = core::ProfileContext::from_options(None, None)?;
        core::read_profile_session_detail(&context, input)
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
async fn create_auth_backups_command(
    input: core::CreateAuthBackupsInput,
) -> Result<core::AuthBatchBackupResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let context = core::ProfileContext::from_options(None, None)?;
        core::create_auth_backups(&context, input)
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
async fn preview_auth_backup_package_command(
    input: core::PreviewAuthBackupPackageInput,
) -> Result<core::AuthBackupImportPreview, String> {
    tauri::async_runtime::spawn_blocking(move || core::preview_auth_backup_package(input))
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
async fn list_feishu_remote_command() -> Result<core::FeishuRemoteReport, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let context = core::ProfileContext::from_options(None, None)?;
        core::list_feishu_remote(&context)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
async fn configure_feishu_remote_command(
    input: core::ConfigureFeishuRemoteInput,
) -> Result<core::FeishuRemoteReport, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let context = core::ProfileContext::from_options(None, None)?;
        core::configure_feishu_remote(&context, input)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
async fn start_feishu_remote_command(
    input: core::StartFeishuRemoteInput,
) -> Result<core::FeishuRemoteReport, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let context = core::ProfileContext::from_options(None, None)?;
        core::start_feishu_remote(&context, input)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
async fn stop_feishu_remote_command() -> Result<core::FeishuRemoteReport, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let context = core::ProfileContext::from_options(None, None)?;
        core::stop_feishu_remote(&context)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
async fn restart_feishu_remote_command() -> Result<core::FeishuRemoteReport, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let context = core::ProfileContext::from_options(None, None)?;
        core::restart_feishu_remote(&context)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
async fn read_feishu_remote_log_command(
    input: core::ReadFeishuRemoteLogInput,
) -> Result<core::FeishuRemoteReport, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let context = core::ProfileContext::from_options(None, None)?;
        core::read_feishu_remote_log(&context, input)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
async fn open_feishu_remote_page_command(page: core::FeishuRemotePage) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let context = core::ProfileContext::from_options(None, None)?;
        core::open_feishu_remote_page(&context, page)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
async fn list_model_routes_command() -> Result<core::ModelRouteReport, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let context = core::ProfileContext::from_options(None, None)?;
        core::list_model_routes(&context)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
async fn read_model_route_proxy_status_command() -> Result<core::ModelRouteProxyStatus, String> {
    tauri::async_runtime::spawn_blocking(core::read_model_route_proxy_status)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn start_model_route_proxy_command() -> Result<core::ModelRouteProxyStatus, String> {
    tauri::async_runtime::spawn_blocking(core::start_model_route_proxy)
        .await
        .map_err(|error| error.to_string())?
}

#[tauri::command]
async fn stop_model_route_proxy_command() -> Result<core::ModelRouteProxyStatus, String> {
    tauri::async_runtime::spawn_blocking(core::stop_model_route_proxy)
        .await
        .map_err(|error| error.to_string())?
}

#[tauri::command]
async fn preview_model_route_command(
    input: core::PreviewModelRouteInput,
) -> Result<core::ModelRoutePreview, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let context = core::ProfileContext::from_options(None, None)?;
        core::preview_model_route(&context, input)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
async fn apply_model_route_command(
    input: core::ApplyModelRouteInput,
) -> Result<core::ProfileActionReport, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let context = core::ProfileContext::from_options(None, None)?;
        core::apply_model_route(&context, input)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
async fn restore_model_route_command(
    input: core::RestoreModelRouteInput,
) -> Result<core::ProfileActionReport, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let context = core::ProfileContext::from_options(None, None)?;
        core::restore_model_route(&context, input)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
async fn check_model_route_proxy_command(
    input: core::CheckModelRouteProxyInput,
) -> Result<core::ModelRouteProxyCheckResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let context = core::ProfileContext::from_options(None, None)?;
        core::check_model_route_proxy(&context, input)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
async fn check_model_route_draft_command(
    input: core::PreviewModelRouteInput,
) -> Result<core::ModelRouteProxyCheckResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let context = core::ProfileContext::from_options(None, None)?;
        core::check_model_route_draft(&context, input)
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
async fn restart_wechat_bridge_command(
    input: core::RestartWechatBridgeInput,
) -> Result<core::WechatBridgeReport, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let context = core::ProfileContext::from_options(None, None)?;
        core::restart_wechat_bridge(&context, input)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
async fn unbind_wechat_bridge_command(
    input: core::UnbindWechatBridgeInput,
) -> Result<core::WechatBridgeReport, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let context = core::ProfileContext::from_options(None, None)?;
        core::unbind_wechat_bridge(&context, input)
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

#[tauri::command]
fn open_cc_switch_command() -> Result<String, String> {
    core::open_cc_switch()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            list_server_nodes_command,
            upsert_server_node_command,
            delete_server_node_command,
            probe_server_node_command,
            run_server_node_operation_command,
            run_doctor_command,
            list_profiles_command,
            list_profile_sessions_command,
            read_profile_session_detail_command,
            list_auth_vault_command,
            create_auth_backup_command,
            create_auth_backups_command,
            apply_auth_backup_command,
            rollback_auth_application_command,
            delete_auth_backup_command,
            update_auth_backup_command,
            export_auth_backup_command,
            import_auth_backup_package_command,
            preview_auth_backup_package_command,
            cleanup_auth_backups_command,
            list_model_routes_command,
            read_model_route_proxy_status_command,
            start_model_route_proxy_command,
            stop_model_route_proxy_command,
            preview_model_route_command,
            apply_model_route_command,
            restore_model_route_command,
            check_model_route_proxy_command,
            check_model_route_draft_command,
            list_wechat_bridges_command,
            list_feishu_remote_command,
            configure_feishu_remote_command,
            start_feishu_remote_command,
            stop_feishu_remote_command,
            restart_feishu_remote_command,
            read_feishu_remote_log_command,
            open_feishu_remote_page_command,
            start_wechat_bridge_command,
            stop_wechat_bridge_command,
            restart_wechat_bridge_command,
            unbind_wechat_bridge_command,
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
            reveal_path_command,
            open_cc_switch_command
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
