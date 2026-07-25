# Changelog

[中文](CHANGELOG.md)

## Unreleased

### Changed

- Split the changelog into Chinese and English entry points, registered the English document source in the app manifest, and included it in version review.
- Aligned the root `RELEASE.md` entry point with the bilingual release contract.

## 0.1.2

- Added server Profile model and Provider reflection in the Mac node manager.
- Added searchable model selection using models discovered from server Profiles and route presets, while retaining free-form model names.
- Added `model set` to safely update model and reasoning fields after backing up `config.toml`, preserving authentication, sessions, Provider routing, and User Data.
- Added feature-level server CLI version compatibility guidance and disabled unsupported model writes on older nodes.
- Added bilingual release documentation, machine-checkable source boundaries, and a server-tagged Draft prerelease workflow.
- Added a release gate that rejects localized documentation not reviewed for the application version.
- Enabled a restrictive production CSP, isolated Vite HMR policy, and frozen JavaScript prototypes for the Tauri WebView.

## 0.1.1

- Fixed Mac-to-Linux remote operation fields so selected Profile names reach WeChat and other server commands correctly.
- Improved server WeChat status detection for externally managed instances, QR presentation, compatible Node.js selection, startup failure reporting, and waiting-for-scan polling.
- Added “Sync from Mac” for creating a Linux Profile from local model metadata with optional, explicitly confirmed authentication transfer over SSH stdin.
- Kept authentication bodies out of command arguments, node metadata, task history, and diagnostics; imported `auth.json` files now use private file permissions on Unix.
- Added server-node UI and protocol tests across light, dark, default, and compact window sizes.

## 0.1.0

- Initial `rCodexManager` MVP for managing local Codex profile launchers.
- Added compact grouped profile board with editable alias, category, and notes.
- Added unified session, auth vault, WeChat/Feishu channel, model-route, and Doctor management dialogs.
- Added Mac-to-Linux server-node management over SSH JSON without an extra management port.
- Added a Linux headless CLI with Bash/Zsh detection and tmux-backed server profile lifecycle.
- Added bounded streaming SSH output, workload-specific timeouts, operation ids, and per-node write exclusion.
- Added session-only server-node task history, actionable remote error guidance, redacted diagnostic copy, and read-only retry controls.
- Expanded the rCodexManager Skill with explicit Mac-local, Mac-to-Linux, and Linux-headless workflows.
- Added a versioned canonical rCodexManager Skill plus install/synchronization checks for any CODEX_HOME.
- Made capability descriptions platform-aware for macOS desktop and Linux headless network/proxy workflows.
- Added browser-only server-node failure fixtures and E2E coverage for SSH auth, missing CLI, read timeout, and concurrent writes.
- Added a 30-second in-memory server-node resource cache plus paginated remote session search and selection-only detail loading.
