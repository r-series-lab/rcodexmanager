# Changelog

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
