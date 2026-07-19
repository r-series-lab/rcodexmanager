# Release

## rCodexManager 0.1.0

- Desktop profile manager for local macOS and remote Linux Codex profiles.
- Unified session, auth vault, remote-channel, model-route, Doctor, and server-node management.
- Shared JSON CLI plus a Linux headless node that auto-detects Bash/Zsh and uses tmux for persistent profile lifecycle.

This repository uses a stage-one preview release workflow.

## Targets

- macOS Apple Silicon: `aarch64-apple-darwin`
- macOS Intel: `x86_64-apple-darwin`
- Windows x64: `x86_64-pc-windows-msvc`
- Linux headless x64: `x86_64-unknown-linux-gnu`

## How to Build

Open GitHub Actions and run **Release rCodexManager packages** manually. The workflow uploads desktop packages and `rcodexmanager-linux-x86_64.tar.gz` as artifacts.

To create a draft GitHub Release, push a version tag:

```bash
git tag v0.1.0
git push origin v0.1.0
```

The workflow creates a draft release and attaches the generated macOS, Windows, and Linux headless packages.

## Unsigned Package Notice

These stage-one packages use macOS ad-hoc signing only and are not Developer ID signed or notarized. Windows packages are not Authenticode signed.

- macOS may show a Gatekeeper warning.
- Windows may show a SmartScreen warning.

Signing and notarization are intentionally left for a later release stage.
