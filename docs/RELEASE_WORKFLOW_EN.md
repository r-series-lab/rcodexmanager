# Release Workflow

[中文](RELEASE_WORKFLOW.md)

rCodexManager uses a source-first, server-tagged, GitHub-built release workflow for desktop candidates and the Linux headless CLI archive.

## Responsibility Boundary

- The development Mac runs source checks, frontend tests and builds, Rust tests, and compile validation only. It does not upload locally generated installers.
- During an approved weekend release window, the publishing server creates a filtered source record and the `vX.Y.Z` Tag.
- GitHub Actions builds the macOS, Windows, and Linux headless candidates from that Tag.
- A successful Tag build creates a Draft GitHub Release. A maintainer reviews checksums, install behavior, signing status, the headless installer, release notes, and website metadata before publishing it.

## Before Tagging

1. Align the version in `package.json`, the desktop Cargo package, the headless Cargo package, the Tauri config, the app manifest, `CHANGELOG.md`, and `CHANGELOG_EN.md`.
2. Run `npm run check`, then run `npm run manifest:check:release` to confirm that every localized document was reviewed for the current version.
3. Confirm that the filtered server snapshot contains no authentication backup, binding QR code, SSH private key, real node detail, session body, build output, machine-specific path, or QA capture.
4. Run the publishing server dry-run and inspect the clean diff.
5. Let the server create and push the Tag only during the approved weekend window.

## Tag Contract

The Tag must exactly match the application version. Version `0.1.2`, for example, requires `v0.1.2`. `.github/workflows/release.yml` rejects a mismatch before packaging.

Each localized document must also set `reviewedForVersion` to the application version. Change that field only after reviewing the document body; the Tag workflow rejects stale documentation before packaging.

A manual workflow dispatch verifies the GitHub build environment but does not create a GitHub Release.

## Current Preview Boundary

The `0.1.x` line remains a development preview. macOS artifacts are not yet Developer ID signed or notarized, and Windows artifacts are not Authenticode signed. Releases must remain Draft prereleases and must not become official website downloads. The Linux headless archive contains the CLI and a user-local installer, but server installation remains an explicit action followed by Doctor verification.

Stable distribution still requires desktop signing, notarization, installation smoke tests, and the updater chain.
