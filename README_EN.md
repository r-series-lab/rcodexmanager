# rCodexManager

English | [中文](README.md)

`rCodexManager` is a local-first workbench for multiple isolated Codex profiles. It manages profile lifecycle, session history, authorized login-state backups, remote messaging channels, third-party model routing, and headless Linux Codex nodes through one desktop app and JSON CLI.

Typical uses include keeping development, research, plugin testing, and server work in separate `CODEX_HOME` directories; inspecting profile health; safely moving authorized login state between stopped profiles; and operating Codex on a Linux server through an existing SSH configuration.

Stack: `Tauri 2 + Rust + React 19 + TypeScript + Material UI`.

## Product Areas

- **Profile Workspace** discovers, creates, copies, launches, stops, resets, archives, and signs in isolated profiles.
- **Doctor** runs read-only checks across launch configuration, paths, processes, authentication, routing, proxies, the auth vault, and remote channels. Reports are redacted.
- **Session Center** searches a bounded, paginated session index and reads a transcript only after selection.
- **Authentication Vault** backs up, previews, imports, applies, and rolls back authorized login state with recovery copies and explicit confirmation.
- **Remote Channels** manages a profile-specific WeChat bridge and an explicitly installed Feishu runtime without absorbing third-party credentials into rCodexManager.
- **Model Routing** previews, tests, applies, and restores Qwen, GLM, local OpenAI-compatible, or custom Responses routes without modifying `auth.json`.
- **Linux Nodes** use SSH and a headless CLI to manage remote profiles without opening an additional management port.

The desktop window defaults to and is constrained to a minimum of `1000×800`.
Profile rows keep launch, archive, and delete actions visible. Double-clicking a row opens the full profile editor; repair, authentication, quota, path, and session actions remain in the compact overflow menu.

## Profile Boundary

Each custom profile has its own `CODEX_HOME` and, for desktop profiles, its own user-data directory. The default `codex` profile is protected from deletion, reset, authentication replacement, and model-route writes. Running profiles cannot receive authentication or routing changes.

rCodexManager does not merge profile sessions or login state. It does not store SSH passwords or private keys, and it rejects plaintext API keys in remote routing commands.

## Quick Start

```bash
npm install
npm run dev
```

Build the desktop app:

```bash
npm run build
```

`npm run build` is for local development validation and never supplies official Release assets. Use the unified source check for daily acceptance:

```bash
npm run check
```

Run core checks:

```bash
npm run manifest:check
npm run web:build
npm run web:test
npm run rust-check
npm run rust-test
```

## Headless Linux Node

Build and test the server archive:

```bash
npm run headless:test
npm run headless:package
```

After uploading and extracting `dist/rcodexmanager-linux-<arch>.tar.gz` on the server:

```bash
./install.sh
~/.local/bin/rcodexmanager --json doctor
```

The server must already have the Codex CLI and SSH public-key access. Starting or stopping profiles also requires `tmux`. Server installation remains explicit; the desktop app does not change SSH or firewall configuration.

## Release Workflow

rCodexManager does not upload desktop installers or Linux headless archives built on the development Mac. During an approved weekend release window, the publishing server creates a filtered source record and pushes a version-matched `vX.Y.Z` Tag. GitHub Actions builds the macOS, Windows, and Linux headless candidates from that Tag and creates a Draft prerelease with SHA-256 checksums.

The `0.1.x` desktop line does not yet complete macOS Developer ID signing and notarization, Windows Authenticode signing, or the updater chain, so these builds are not official website downloads. See the [release workflow](docs/RELEASE_WORKFLOW_EN.md) and [changelog](CHANGELOG_EN.md).

## CLI Quick Start

The CLI and desktop app share the same Rust core. Automation should use `--json`.

```bash
rcodexmanager --json info
rcodexmanager --json capabilities
rcodexmanager --json doctor
rcodexmanager --json list
rcodexmanager --json quota --name codex-g
```

Sessions and authentication:

```bash
rcodexmanager --json sessions list --profile codex-g --limit 20
rcodexmanager --json sessions detail --profile codex-g --session-id <id>
rcodexmanager --json auth backup-many --name codex-b --name codex-g --label Snapshot
rcodexmanager --json auth preview-import --file ./backup.rcodex-auth.json

# Interactive official Codex login; do not add --json.
rcodexmanager login --name codex-g
rcodexmanager login --name codex-g --device-auth
```

The desktop app exposes the dynamic browser OAuth URL for a local profile. A Linux server profile uses Codex device authentication and shows a copyable URL and one-time code. rCodexManager keeps the official login process alive for the callback, stores no authorization challenge on disk, and clears the challenge after completion, cancellation, or expiry.

Preview a model route before applying it:

```bash
rcodexmanager --json model-route preview \
  --name codex-g \
  --preset glm \
  --model glm-4.6 \
  --proxy-base-url http://127.0.0.1:15721/v1 \
  --upstream-base-url https://open.bigmodel.cn/api/paas/v4

rcodexmanager --json model-route test-draft \
  --name codex-g \
  --preset glm \
  --model glm-4.6 \
  --upstream-base-url https://open.bigmodel.cn/api/paas/v4 \
  --api-key-env ZAI_API_KEY
```

The complete command and JSON contract reference currently lives in [docs/cli.md](docs/cli.md) and is Chinese-first. Command names, JSON keys, and error codes remain stable English identifiers.

## Data and Security

Important locations include:

| Data | Default location |
| --- | --- |
| Server node metadata | `~/.rcodexmanager/server-nodes.json` |
| Profile metadata | `~/.rcodexmanager/profile-metadata.json` |
| Default Codex profile | `~/.codex` |
| Custom profile homes | `~/.codex-<suffix>` |
| Codex configuration and login state | `<CODEX_HOME>/config.toml`, `<CODEX_HOME>/auth.json` |
| Session index and transcripts | `<CODEX_HOME>/session_index.jsonl`, `<CODEX_HOME>/sessions/**/*.jsonl` |
| Authentication vault | `~/.rcodexmanager/auth-vault.json`, `auth-vault/*.auth.json` |

Security rules:

- Shell launch configuration, `config.toml`, and target `auth.json` are backed up before consequential writes.
- Soft-archiving a stopped custom profile only hides it from the active list and is reversible; it preserves the launcher, profile directories, authentication, sessions, and model configuration.
- Deleting a profile removes only its launch function by default; moving its data to a backup directory is a separate explicit option.
- Authentication apply, rollback, import, export, deletion, and cleanup require sensitive-action confirmation.
- Model routing never writes `auth.json`, and logs exclude request bodies, tokens, and API keys.
- Remote calls reuse the user's SSH host verification and credentials without copying them into rCodexManager.
- Authentication synchronization uses SSH standard input and private temporary files that are removed after import.
- The app does not stop proxy or channel processes whose ownership cannot be established.

## License

MIT

This overview is the maintained English documentation for version `0.1.2`.
