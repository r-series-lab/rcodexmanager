---
name: rcodexmanager
description: Use and manage the user's rCodexManager desktop app, local CLI, and Linux headless server nodes. Use when tasks involve Codex profiles, isolated CODEX_HOME or user-data-dir instances, Mac-to-Linux SSH management, profile lifecycle, session history, auth vault backups or login-state transfer, quota, WebSocket/network repair, WeChat or Feishu remote channels, model providers, Responses proxies, cc-switch integration, or rCodexManager diagnostics and packaging.
---

# rCodexManager

Operate the user's local Codex profile workspace through the shared rCodexManager CLI and desktop application. Prefer bounded inspection, explicit previews, and recoverable writes.

## Operating Contract

- Prefer CLI over GUI automation. Use the desktop app when the task needs visual selection, theme/settings changes, QR scanning, or the built-in proxy's long-running lifecycle.
- Add `--json` to every machine-read CLI call. Parse `ok`, `command`, `data`, and `error`; do not scrape human output.
- Inspect current state before changing it. Use `list` for profile protection/running state and the feature-specific status command for the target resource.
- Treat default profile `codex` as protected. Do not delete, reset, overwrite auth, terminate, or apply model routes to it.
- Require a stopped target before auth application/import, model-route apply/restore, or other operations that modify a profile's active files.
- Never print or summarize access tokens, refresh tokens, API keys, auth package contents, or Feishu App Secret values.
- Use `--confirm-sensitive` only when the user has requested the corresponding sensitive write. The flag is authorization for that one operation, not standing consent.
- Preserve user data. Prefer backup, archive, preview, and rollback paths; never manually delete profile/auth/channel directories when the CLI has a recoverable operation.
- For a server node, use the configured SSH alias and the remote headless CLI JSON contract. Do not open an extra management port or copy SSH credentials into rCodexManager metadata.
- Remote model-route operations accept an API-key environment variable name only. Never send a plaintext API key through SSH arguments.

## Locate The CLI

Use the installed binary when available:

```bash
command -v rcodexmanager
rcodexmanager --json info
```

Otherwise use the source checkout:

```bash
cd /path/to/rcodexmanager
cargo run --quiet --manifest-path ./src-tauri/Cargo.toml -- --json info
```

In source-checkout examples below, replace `rcodexmanager` with:

```bash
cargo run --quiet --manifest-path /path/to/rcodexmanager/src-tauri/Cargo.toml --
```

Keep the global `--json` flag after `--` when using `cargo run`.

On a Linux server, prefer the installed headless node:

```bash
ssh demo-server '/home/demo/.local/bin/rcodexmanager --json info'
ssh demo-server '/home/demo/.local/bin/rcodexmanager --json doctor'
```

The headless build reports `desktopAvailable=false`. It auto-detects `.zshrc` or `.bashrc`; use `--shell-rc <PATH>` only when detection is wrong.

## Choose The Execution Context

Identify the control side and execution side before running commands:

- **Mac local:** use the installed desktop/CLI for local profiles. Use the App only for visual workflows or a long-running built-in proxy.
- **Mac controlling Linux:** keep SSH credentials in the user's SSH configuration. Use the App server-node dialog for visual management, or run the Linux headless CLI through the configured SSH alias for agent-led work.
- **Linux local/headless:** use the installed headless CLI directly. Never attempt `desktop`, macOS `open`, launchctl repair, DMG packaging, or Tauri GUI automation.

Confirm the context with `uname -s`, `uname -m`, `info`, and `capabilities`. Do not assume a desktop build and a server node expose identical capabilities merely because their versions match.

When the Linux node is missing, installation may be performed manually by the AI only when the user asks:

1. Inspect the server OS/architecture and the intended login user.
2. Use the matching published headless archive, or build the headless crate on Linux.
3. Run the included `install.sh`; default destination is `~/.local/bin/rcodexmanager`.
4. Verify the installed binary with `info`, `capabilities`, and `doctor`.
5. Configure the Mac node with an absolute binary path when non-interactive SSH does not include `~/.local/bin` in `PATH`.

Do not add an App-owned automatic installer or modify SSH/firewall configuration unless explicitly requested.

## Start With Context

For an unfamiliar request:

1. Run `info` to confirm the binary.
2. Run `capabilities` when command coverage may have changed.
3. Run `doctor` when diagnosing an unfamiliar environment or a cross-feature failure. It is read-only and its output is already redacted.
4. Run `list` and identify the exact profile by `name`, not alias alone.
5. Check `isDefault`, `isRunning`, paths, auth state, and current model before a write.
6. Read only the relevant feature status named by the Doctor check id: `sessions list`, `auth list`, `wechat status`, `feishu status`, or `model-route status`.

Do not open every management surface or load every session detail by default.

## Choose The Surface

Use CLI for:

- Read-only aggregate health checks with `doctor` before targeted troubleshooting.
- Profile creation, copy, metadata, lifecycle, reset/archive, quota, auth import, and network repair.
- Paginated session index queries and one selected session detail.
- Auth vault backup, import preview, import/export, metadata, apply, rollback, cleanup, and delete.
- WeChat and Feishu status/lifecycle/log operations.
- Model-route status, proxy detection, preview, draft testing, apply, restore, and self-check.

Use the desktop app for:

- QR scanning and visually following channel connection logs.
- Theme mode and UI settings.
- Starting/stopping the built-in model proxy. A one-shot CLI process cannot own its long-running lifecycle.
- Comparing complex auth or model-route details when visual confirmation reduces risk.
- Adding, probing, and managing Linux server nodes from the Mac server-node dialog.

## Profile Workflow

1. Read `list`.
2. For create/copy, confirm the new command starts with `codex-` and paths do not collide.
3. For launch, avoid starting a duplicate when `isRunning=true`.
4. For terminate, target the exact custom profile; default `codex` cannot be safely terminated.
5. For a model-only change, use `model set` on a stopped custom profile and verify `model` plus `modelProvider` from a fresh `list`. Do not use `reset` for this.
6. For reset/delete, explain whether user data is retained or archived before executing.

On Linux, managed launch uses a `rcodexmanager-<profile>` tmux session. After launch/terminate, verify `isRunning` from a fresh `list`; do not infer success from process creation alone.

## Server Node Workflow

1. Verify direct SSH access with the user's configured host alias.
2. Probe the node and require Linux, Codex CLI, and the headless `rcodexmanager` binary.
3. Run remote `doctor` and `list` before writes.
4. Load only the selected tab/resource: profiles, sessions, auth, route, channel, or diagnostics.
   The App keeps non-secret resource metadata in process memory for 30 seconds; use refresh when evidence must be current.
5. Treat remote default and running profiles with the same protections as local profiles.
6. For Mac-to-Linux profile sync, create a new stopped server profile first. Transfer auth only after explicit confirmation, only over SSH stdin, and verify the new profile from a fresh server list. Never copy sessions or desktop User Data.
6. For remote auth/route writes, preview or select a valid backup, confirm once, then refresh state.
7. For server launch, require `tmux`; viewing and configuration inspection remain available without it.
8. Report the node, profile, transition, and backup evidence without exposing remote paths that contain credentials.

In the App, filter and page the server session index first. Selecting a row triggers the one-session detail read; merely opening the server-node dialog must not read every session body.

Remote reports include an `operationId`, elapsed time, timeout budget, and truncation state. Preserve the operation id when reporting a failure. A second write to the same node may be rejected while the first is active; wait and refresh rather than bypassing the lock.

### Remote Failure Recovery

Use the App's recent-task record or the CLI error envelope as the diagnostic handoff. Recent tasks are session-only summaries and are not a durable audit log.

1. Record the exact node alias, operation id, command, duration, timeout budget, and non-sensitive error category.
2. Classify the failure before acting: SSH authentication, unreachable host, timeout, missing node CLI, missing Codex, missing tmux, incompatible CLI contract, protected/running profile, or concurrent write.
3. Retry only read-only operations such as Doctor, list/status, session reads, route preview, and route check.
4. Never automatically replay create, launch/terminate, auth apply, channel lifecycle, or model-route apply/restore after a transport failure. Refresh state first because the remote write may have completed before the response was lost.
5. For a concurrent-write rejection, wait for the first task to finish and refresh. Do not bypass the node lock with a direct second command.
6. Copy diagnostics only after redacting authorization headers, API keys, passwords, secrets, and tokens.

When the App reports a possible version mismatch, compare `info` and `capabilities` on both sides. Update the Linux node manually if needed; do not infer compatibility from a shared semantic version alone.

## Session Workflow

1. Use `sessions list` with profile/category/query and a bounded `--limit`.
2. Select by `profileName + session.id`.
3. Use `sessions detail` only for selected results.
4. Report title, time, cwd, and a short summary. Do not dump full JSONL history unless explicitly requested.

## Auth Workflow

1. Run `auth list` and inspect backup validity and target running state.
2. Create a backup before moving auth between profiles.
3. For an imported package, run `auth preview-import` first; it must not write files.
4. Apply only to a stopped, non-default profile with explicit confirmation.
5. Use recorded application ids for rollback.
6. Export/delete/cleanup only after explicit confirmation; do not expose package contents.

## Remote Channel Workflow

- WeChat is per profile. Distinguish `unbound`, `waiting`, `bound`, `running`, and `error`; use recoverable `unbind` instead of deleting token files.
- Feishu uses an external `codex-remote-feishu` runtime. rCodexManager records profile/binary binding but does not own App ID/App Secret.
- Do not silently download external runtimes. Report a missing dependency and use `feishu open project` only when the user asks to inspect/install it.
- After start/restart, verify status and bounded logs. Configured is not the same as connected.

## Model Route Workflow

1. Read `model-route status --name <profile>` and `model-route proxy`.
2. Use `preview` before every apply. Preview must not change `config.toml`.
3. For a new endpoint, use `test-draft`; pass only an environment variable name through `--api-key-env`.
4. For Chat-only providers, distinguish upstream Chat URL from the Responses proxy URL.
5. Apply only after preview and explicit confirmation; then run `model-route check`.
6. A failed self-check is diagnostic evidence, not permission to overwrite or auto-rollback user configuration.
7. Never stop cc-switch or an unknown external listener. The desktop app may stop only its managed built-in proxy.

## Build And Packaging

Only build an installer when explicitly requested. For normal changes run the smallest relevant checks first:

```bash
cd /path/to/rcodexmanager
npm run web:build
npm run rust-check
npm run rust-test
```

For an Apple Silicon package, use the repository's existing Tauri build flow and report the exact `.dmg`/`.app` output paths. Do not clean unrelated user artifacts.

For the Linux node, run `npm run headless:test`. Build `npm run headless:package` only on Linux or through the release workflow; the archive contains a user-local installer and does not include a desktop app.

## Report Results

- State what was inspected and what changed.
- Include profile names, state transitions, backup ids/paths, or diagnostic labels that prove the result.
- Mention skipped or unavailable checks.
- Redact sensitive values even if they appear in command output.

## References

- Read [references/cli.md](references/cli.md) for command syntax and JSON command names.
- Read [references/workflows.md](references/workflows.md) for safe end-to-end recipes and failure handling.
