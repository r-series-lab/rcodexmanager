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
async fn list_profile_sessions_command() -> Result<core::ProfileSessionReport, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let context = core::ProfileContext::from_options(None, None)?;
        core::list_profile_sessions(&context)
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
            create_profile_command,
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
