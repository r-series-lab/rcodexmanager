# rCodexManager CLI Reference

## JSON Contract

Use `--json` for agent-facing calls.

```json
{"ok":true,"command":"list","data":{}}
```

```json
{"ok":false,"error":{"code":"invalid_arguments","message":"..."}}
```

Exit codes: `0` success, `1` operation/check failure, `2` invalid arguments or missing sensitive confirmation, `3` missing resource.

## Startup

```bash
rcodexmanager --json info
rcodexmanager --json capabilities
rcodexmanager --json doctor
rcodexmanager --json list
rcodexmanager desktop
```

Source fallback:

```bash
cargo run --quiet --manifest-path /path/to/rcodexmanager/src-tauri/Cargo.toml -- --json info
```

Global flags: `--json`, `--home <PATH>`, `--shell-rc <PATH>`. `--zshrc` remains a compatibility alias.

## Linux Headless Node

```bash
~/.local/bin/rcodexmanager --json info
~/.local/bin/rcodexmanager --json doctor
~/.local/bin/rcodexmanager --json list
```

The headless binary has `desktopAvailable=false` and no `desktop` capability. It auto-detects existing `.zshrc` then `.bashrc`. Mac server-node management executes the same commands over SSH and expects one JSON envelope on stdout.

Read `capabilities` from the binary being operated. Desktop output includes the desktop launcher and may describe the built-in proxy. Linux headless output omits the desktop launcher, and headless model routing does not own the desktop proxy lifecycle.

Node metadata stores only display name, SSH target, and remote binary path. Remote API keys must be referenced by environment-variable name.

Manual installation when requested:

```bash
uname -s
uname -m
tar -xzf rCodexManager_0.1.6_linux-x86_64.tar.gz
./install.sh
~/.local/bin/rcodexmanager --json info
~/.local/bin/rcodexmanager --json capabilities
~/.local/bin/rcodexmanager --json doctor
```

Agent-led Mac-to-Linux inspection may use the configured SSH alias directly:

```bash
ssh demo-server '/home/demo/.local/bin/rcodexmanager --json info'
ssh demo-server '/home/demo/.local/bin/rcodexmanager --json capabilities'
ssh demo-server '/home/demo/.local/bin/rcodexmanager --json doctor'
ssh demo-server '/home/demo/.local/bin/rcodexmanager --json list'
```

Keep all stdout machine-readable. Do not prefix/suffix the remote command with status text when parsing JSON.

## Doctor

```bash
rcodexmanager --json doctor
```

Command name in JSON: `doctor`. This is a read-only aggregate check. Use `ready`, `summary`, and stable `checks[].id` values to choose the next feature-specific inspection. Warnings keep exit code `0`; errors use exit code `1`. The report omits credentials, emails, log bodies, and full home paths.

## Profiles

```bash
rcodexmanager --json create --name codex-f --model gpt-5.5 --reasoning-effort xhigh --alias 主力 --category 深度 --note 日常开发
rcodexmanager --json create --name codex-o --server

rcodexmanager --json copy --source codex-b --name codex-f
rcodexmanager --json copy --source codex-b --name codex-f --auth-source codex-b --confirm-sensitive

rcodexmanager --json update --name codex-f --alias 主力 --category 平衡 --note 日常使用
rcodexmanager --json model set --name codex-f --model gpt-5.5 --reasoning-effort xhigh
rcodexmanager --json launch --name codex-f
rcodexmanager --json terminate --name codex-f
rcodexmanager --json stop --name codex-f

rcodexmanager --json reset --name codex-f --model gpt-5.5 --reasoning-effort medium
rcodexmanager --json reset --name codex-f --keep-user-data
rcodexmanager --json delete --name codex-f
rcodexmanager --json delete --name codex-f --archive-data
```

`stop` aliases `terminate`. `--server` writes a Linux-friendly launcher. Linux `launch` uses a persistent `rcodexmanager-<profile>` tmux session and status maps processes by `CODEX_HOME`. `model set` backs up and changes only model fields, preserving auth, sessions, provider routing, and User Data. Default `codex` is protected.

## Sessions

```bash
rcodexmanager --json sessions list
rcodexmanager --json sessions list --profile codex-g --limit 20
rcodexmanager --json sessions list --category 深度 --query workflow --offset 20 --limit 20
rcodexmanager --json sessions detail --profile codex-g --session-id <id>
rcodexmanager --json sessions detail --profile codex-g --session-id <id> --updated-at <iso-time>
```

Command names in JSON: `sessions-list`, `sessions-detail`.

## Quota And Auth Import

```bash
rcodexmanager login --name codex-g
rcodexmanager login --name codex-g --device-auth
rcodexmanager --json quota --name codex-g
rcodexmanager --json import-auth --name codex-g --source /path/to/auth.json --confirm-sensitive
```

`login` runs the official Codex interactive flow and intentionally rejects `--json`. Keep it attached until completion; use `--device-auth` on a headless host and never persist the OAuth URL or one-time code. `quota` is read-only. Auth import backs up the target.

## Auth Vault

```bash
rcodexmanager --json auth list
rcodexmanager --json auth backup --name codex-g --label "工作账号"
rcodexmanager --json auth backup-many --name codex-b --name codex-g --label "迁移前快照"

rcodexmanager --json auth update --backup-id <id> --label "主备份" --note "可回滚" --pin
rcodexmanager --json auth update --backup-id <id> --clear-note --unpin

rcodexmanager --json auth export --backup-id <id> --confirm-sensitive
rcodexmanager --json auth preview-import --file ./backup.rcodex-auth.json
rcodexmanager --json auth import --file ./backup.rcodex-auth.json --label "导入备份" --note "来源" --pinned --confirm-sensitive

rcodexmanager --json auth apply --backup-id <id> --target codex-g --confirm-sensitive
rcodexmanager --json auth rollback --application-id <id> --confirm-sensitive
rcodexmanager --json auth cleanup --account-key <account-id-or-email> --confirm-sensitive
rcodexmanager --json auth delete --backup-id <id> --confirm-sensitive
```

JSON command names:

- `auth-list`, `auth-backup`, `auth-backup-many`
- `auth-update`, `auth-delete`, `auth-export`
- `auth-preview-import`, `auth-import`, `auth-cleanup`
- `auth-apply`, `auth-rollback`

Account-key priority is account id, user id, email, then name.

## WeChat

```bash
rcodexmanager --json wechat status
rcodexmanager --json wechat status --name codex-g
rcodexmanager --json wechat start --name codex-g
rcodexmanager --json wechat stop --name codex-g
rcodexmanager --json wechat restart --name codex-g
rcodexmanager --json wechat log --name codex-g --lines 120
rcodexmanager --json wechat switch --from codex-b --to codex-g
rcodexmanager --json wechat unbind --name codex-g --confirm-sensitive
rcodexmanager --json wechat service --name codex-o
rcodexmanager --json wechat service --name codex-o --install --enable --now
```

Without service action flags, `wechat service` only renders a unit. Unbind stops the bridge and archives token material.

## Feishu

```bash
rcodexmanager --json feishu status
rcodexmanager --json feishu configure --name codex-g
rcodexmanager --json feishu configure --name codex-g --binary /path/to/codex-remote
rcodexmanager --json feishu start --name codex-g
rcodexmanager --json feishu stop
rcodexmanager --json feishu restart
rcodexmanager --json feishu log --lines 120
rcodexmanager --json feishu open setup
rcodexmanager --json feishu open admin
rcodexmanager --json feishu open project
```

The external runtime owns Feishu credentials. rCodexManager uses its isolated `rcodexmanager` instance.

## Model Route

```bash
rcodexmanager --json model-route status
rcodexmanager --json model-route status --name codex-g
rcodexmanager --json model-route proxy

rcodexmanager --json model-route preview --name codex-g --preset aliyun-qwen --model qwen3-coder-plus --api-key-env DASHSCOPE_API_KEY
rcodexmanager --json model-route preview --name codex-g --preset glm --model glm-4.6 --proxy-base-url http://127.0.0.1:15721/v1 --upstream-base-url https://open.bigmodel.cn/api/paas/v4 --api-key-env ZAI_API_KEY

rcodexmanager --json model-route test-draft --name codex-g --preset glm --model glm-4.6 --upstream-base-url https://open.bigmodel.cn/api/paas/v4 --api-key-env ZAI_API_KEY

rcodexmanager --json model-route apply --name codex-g --preset glm --model glm-4.6 --proxy-base-url http://127.0.0.1:15721/v1 --upstream-base-url https://open.bigmodel.cn/api/paas/v4 --api-key-env ZAI_API_KEY --confirm-sensitive
rcodexmanager --json model-route check --name codex-g
rcodexmanager --json model-route restore --name codex-g --confirm-sensitive
```

Presets: `aliyun-qwen`, `glm`, `local-openai`, `custom-responses`.

`preview` and `test-draft` do not write config. `apply` and `restore` back up `config.toml`. CLI accepts only an API-key environment variable name. `model-route proxy` is read-only; manage the built-in proxy lifecycle in the desktop app.
