// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    match rcodexmanager_lib::cli::run_from_env() {
        rcodexmanager_lib::cli::CliOutcome::LaunchDesktop => rcodexmanager_lib::run(),
        rcodexmanager_lib::cli::CliOutcome::Exit(code) => std::process::exit(code),
    }
}
