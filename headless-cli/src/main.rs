#![allow(dead_code)]

#[path = "../../src-tauri/src/cli.rs"]
mod cli;
#[path = "../../src-tauri/src/core.rs"]
mod core;

fn main() {
    match cli::run_from_env_with_desktop(false) {
        cli::CliOutcome::LaunchDesktop => unreachable!("headless CLI cannot launch a desktop"),
        cli::CliOutcome::Exit(code) => std::process::exit(code),
    }
}
