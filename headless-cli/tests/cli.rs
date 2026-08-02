use serde_json::Value;
use std::process::Command;

fn run_cli(args: &[&str]) -> std::process::Output {
    Command::new(env!("CARGO_BIN_EXE_rcodexmanager"))
        .args(args)
        .output()
        .expect("headless CLI should run")
}

fn parse_json(output: &std::process::Output) -> Value {
    serde_json::from_slice(&output.stdout).unwrap_or_else(|error| {
        panic!(
            "expected JSON output: {error}; stdout={}; stderr={}",
            String::from_utf8_lossy(&output.stdout),
            String::from_utf8_lossy(&output.stderr)
        )
    })
}

#[test]
fn info_and_capabilities_identify_headless_runtime() {
    let info = run_cli(&["--json", "info"]);
    assert!(info.status.success());
    let info_json = parse_json(&info);
    assert_eq!(info_json["data"]["desktopAvailable"], false);
    assert_eq!(info_json["data"]["defaultCommand"], "info");

    let capabilities = run_cli(&["--json", "capabilities"]);
    assert!(capabilities.status.success());
    let capabilities_json = parse_json(&capabilities);
    let commands = capabilities_json["data"]["commands"]
        .as_array()
        .expect("commands array");
    assert!(!commands.iter().any(|entry| entry["command"] == "desktop"));
    assert!(commands.iter().any(|entry| entry["command"] == "login"));
    assert!(!commands
        .iter()
        .any(|entry| entry["command"] == "repair-network"));
    let model_route = commands
        .iter()
        .find(|entry| entry["command"] == "model-route")
        .expect("model-route capability");
    assert!(model_route["description"]
        .as_str()
        .expect("model-route description")
        .contains("do not own the desktop built-in proxy lifecycle"));
}

#[test]
fn interactive_login_rejects_json_before_starting_codex() {
    let output = run_cli(&["--json", "login", "--name", "codex-o", "--device-auth"]);
    assert_eq!(output.status.code(), Some(2));
    let payload = parse_json(&output);
    assert_eq!(payload["error"]["code"], "streaming_command");
}

#[test]
fn no_subcommand_returns_a_structured_headless_error() {
    let output = run_cli(&["--json"]);
    assert_eq!(output.status.code(), Some(2));
    let payload = parse_json(&output);
    assert_eq!(payload["ok"], false);
    assert_eq!(payload["error"]["code"], "desktop_unavailable");
}

#[test]
fn bashrc_is_auto_detected_when_zshrc_is_absent() {
    let home = tempfile::tempdir().expect("temp home");
    let codex_home = home.path().join(".codex-o");
    std::fs::create_dir_all(&codex_home).expect("codex home");
    std::fs::write(
        codex_home.join("config.toml"),
        "model = \"gpt-5.5\"\nmodel_reasoning_effort = \"medium\"\n",
    )
    .expect("config");
    std::fs::write(
        home.path().join(".bashrc"),
        "codex-o() {\n  mkdir -p \"$HOME/.codex-o\"\n  CODEX_HOME=\"$HOME/.codex-o\" codex \"$@\"\n}\n",
    )
    .expect("bashrc");

    let home_arg = home.path().to_string_lossy().to_string();
    let output = run_cli(&["--json", "--home", &home_arg, "list"]);
    assert!(output.status.success());
    let payload = parse_json(&output);
    assert_eq!(
        payload["data"]["zshrcPath"],
        home.path().join(".bashrc").to_string_lossy().as_ref()
    );
    assert!(payload["data"]["profiles"]
        .as_array()
        .expect("profiles")
        .iter()
        .any(|profile| profile["name"] == "codex-o"));
}
