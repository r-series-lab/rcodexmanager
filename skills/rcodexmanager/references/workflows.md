# rCodexManager Workflows

## Context Intake

1. Run `rcodexmanager --json info`.
2. Run `rcodexmanager --json capabilities` when documentation and installed binary may differ.
3. Run `rcodexmanager --json doctor` for an unfamiliar environment or a failure spanning multiple features.
4. Use the Doctor check id to choose the relevant feature status command; do not load every surface.
5. Run `rcodexmanager --json list` before any profile-specific write.
6. Match the requested profile by exact `name`; aliases are display labels and may not be unique.
7. Summarize only status relevant to the user's request.

## Create Or Copy A Profile

1. Inspect `list` for name/path collisions.
2. Choose desktop or `--server` launcher based on the requested runtime.
3. Use `create` for a clean profile or `copy` for inherited config/metadata.
4. Copy auth only when explicitly requested, with `--auth-source` and `--confirm-sensitive`.
5. Re-run `list` and verify paths, model, launcher kind, and auth state.

Do not make the new profile default or overwrite default `codex`.

## Launch Or Stop

1. Check `isRunning` and `runningPids` in `list`.
2. Run `launch` only when idle.
3. Re-run `list`; launching successfully is not enough evidence if status remains idle.
4. For stop, use the exact custom profile and `terminate`.
5. Re-run `list` until stopped or report the remaining pid/status.

Default `codex` cannot be safely terminated by rCodexManager.

## Manage A Linux Server Node From Mac

1. Verify the SSH alias without changing SSH or firewall configuration.
2. Probe the node; require reachable SSH plus installed Codex and headless rCodexManager CLI.
3. Run remote `doctor` and `list` before a write.
4. For sessions, search/page the index and select only the detail needed; the App reuses metadata for 30 seconds unless refreshed.
5. Select the exact stopped, non-default server profile.
6. For lifecycle, run `launch`/`terminate` and refresh until `isRunning` reflects the transition.
7. For auth, use a server-local valid backup; do not move token JSON through Mac UI state.
8. For model routes, preview/test using the server endpoint and API-key env name, apply with confirmation, then read status/check.
9. Keep node metadata credential-free; SSH authentication remains in the user's SSH configuration.

Linux `launch` requires `tmux`. Session/history/status/auth/route inspection does not. The Mac app is a control plane; the server remains the execution and credential boundary.

## Recover A Failed Server Task

1. Capture the node alias, operation id, command, elapsed time, timeout, and redacted error.
2. For SSH authentication or reachability failures, verify a direct non-interactive SSH connection before changing rCodexManager configuration.
3. For missing/incompatible node CLI, run remote `info` and `capabilities`; manually install or update only when requested.
4. Retry Doctor, list/status, session reads, route preview, or route check directly.
5. After any failed write, refresh the relevant status first. Do not replay the write until its actual outcome is known.
6. For a busy-node error, wait and refresh; never bypass the App's per-node write exclusion.

The App retains at most ten recent task summaries per node for the current window. Treat this as troubleshooting context, not a persistent audit trail.

## Find A Session

1. Start with a bounded list:
   `sessions list --profile <name> --query <term> --limit 20`.
2. Use `hasMore` and `offset` only when the first page is insufficient.
3. Read details only for selected `profileName + session.id`.
4. Return a concise summary and source path; avoid full JSONL dumps.

If a session changed between list/detail, pass its `updatedAt` to prevent stale cache assumptions.

## Back Up And Apply Auth

1. Run `auth list` and `list`.
2. Confirm source has readable auth and target is stopped/non-default.
3. Create `auth backup` or `auth backup-many`.
4. Select a `valid=true`, `exists=true` backup.
5. Apply with explicit `--confirm-sensitive`.
6. Re-run `auth list` and `list`; record the application id for rollback.

If apply fails, do not manually copy token files. Report the error and preserved backup.

## Sync A Mac Profile To Linux

1. Probe the server node and refresh its Profile list.
2. Choose a local non-default `codex-*` Profile and a new server Profile name.
3. Confirm that only model settings, alias, and category are copied by default; sessions and desktop User Data stay local.
4. If authentication is requested, require explicit sensitive confirmation and stream the auth body over SSH stdin. Never place it in a command argument, task log, or node metadata.
5. Refresh the server Profile list and verify the target account and stopped state before launch.

If Profile creation succeeds but auth import fails, do not blindly retry creation. Refresh the server list first, then repair authentication on the existing target.

## Import An Auth Package

1. Run `auth preview-import --file <path>`.
2. Check `valid`, account identity, refresh-token status, source, and warnings.
3. Show the non-sensitive preview to the user.
4. Import only when requested using `auth import ... --confirm-sensitive`.
5. Re-run `auth list`; do not print package JSON.

## Roll Back Auth

1. Inspect `auth list` recent applications.
2. Confirm target is stopped and application is not already rolled back.
3. Run `auth rollback --application-id <id> --confirm-sensitive`.
4. Re-run `auth list` and `list` to verify account state.

## WeChat Remote

1. Run `wechat status --name <profile>`.
2. Start only the requested profile; use `switch` when another bridge should stop first.
3. While waiting for QR/connection, read a bounded log tail.
4. After scan, re-run status and distinguish bound from running/connected.
5. For reset, use `unbind --confirm-sensitive`; it archives token state.

On a server, inspect the rendered `wechat service` unit before installing/enabling it.

## Feishu Remote

1. Run `feishu status`.
2. If not installed, report the external dependency. Do not silently download it.
3. Configure exact profile and optional binary path.
4. Open setup only when the user needs to enter App credentials.
5. Start/restart, then verify `healthy`, `connectionState`, and connected gateway count.
6. Use bounded, redacted logs for failure diagnosis.

Configured, running, healthy, and connected are separate states.

## Apply A Model Route

1. Run `list`, `model-route status --name <profile>`, and `model-route proxy`.
2. Ensure the target is stopped and non-default.
3. Build a `preview` command with model, preset, URL, and API-key environment variable name.
4. For a new provider/endpoint, run `test-draft`. It tests the draft without writing config.
5. Show the preview's non-sensitive fields and warnings.
6. Apply only when requested with the same arguments plus `--confirm-sensitive`.
7. Run `model-route status` and `model-route check`.

For Chat-only providers:

- `upstream-base-url` is the provider's Chat-compatible base URL.
- `proxy-base-url` is the Responses-compatible endpoint Codex will call.
- Start the built-in proxy from the desktop app, or use cc-switch/external proxy.

Do not attempt to stop an external or cc-switch listener.

## Restore A Model Route

1. Read route status and target running state.
2. Confirm the user wants rCodexManager routing fields removed.
3. Run `model-route restore --confirm-sensitive`.
4. Verify the profile retains base model/reasoning/WebSocket configuration and auth remains unchanged.

## Diagnose A Failed Route

Use evidence in this order:

1. `model-route proxy`: offline, managed, cc-switch, external, or unreachable.
2. `model-route status --name`: current base URL, wire API, provider, missing fields.
3. `test-draft`: direct upstream auth/protocol result without a config write.
4. `model-route check`: full profile-to-endpoint Responses result.
5. Desktop diagnostic log: recent request status and latency without request bodies.

Do not auto-apply, auto-restore, or expose API keys when a check fails.

## Build Apple Silicon Package

Only when explicitly requested:

1. Run `npm run web:build`.
2. Run `npm run rust-check` and `npm run rust-test`.
3. Build with the repository's Tauri Apple Silicon target/flow.
4. Report exact `.app` and `.dmg` paths and whether signing/notarization is present.

Do not delete unrelated `tmp/`, screenshots, user builds, or untracked files.
