# rCodexManager CLI

CLI 与桌面应用共享 `src-tauri/src/core.rs`，适合脚本、服务器管理和 Codex agent 调用。机器读取时始终使用 `--json`。

## 调用方式

已安装：

```bash
rcodexmanager --json info
```

源码目录：

```bash
cd /path/to/rcodexmanager
cargo run --quiet --manifest-path ./src-tauri/Cargo.toml -- --json info
```

全局参数可以放在子命令前后：

| 参数 | 用途 |
| --- | --- |
| `--json` | 输出单个 JSON 对象 |
| `--home <PATH>` | 覆盖 home，用于隔离测试或服务器目录 |
| `--shell-rc <PATH>` | 覆盖 Bash/Zsh 启动配置；兼容旧别名 `--zshrc` |

## 输出合同

成功：

```json
{
  "ok": true,
  "command": "sessions-list",
  "data": {}
}
```

失败：

```json
{
  "ok": false,
  "error": {
    "code": "invalid_arguments",
    "message": "..."
  }
}
```

| 退出码 | 含义 |
| --- | --- |
| `0` | 成功；帮助输出也返回 0 |
| `1` | 操作失败，或网络自检未通过 |
| `2` | 参数错误、缺少敏感操作确认 |
| `3` | profile、备份或其他资源不存在 |

只依赖 `ok`、`command`、`data` 和 `error`。业务数据会继续扩展，不要依赖 JSON 字段顺序。

## 启动与发现

```bash
rcodexmanager desktop
rcodexmanager --json info
rcodexmanager --json capabilities
rcodexmanager --json list
```

`desktop` 打开桌面应用，不支持 JSON。Linux 无界面构建不提供 `desktop`，不带子命令时返回结构化 `desktop_unavailable` 错误。`capabilities` 返回当前构建实际支持的命令组、读写属性和示例，可用于 agent 自发现。

能力说明会按运行面区分：桌面端可描述 launchctl 与内置代理，Linux headless 的网络修复示例固定带 `--skip-launchctl`，模型路由只声明代理状态检查能力。Agent 应读取当前二进制的 `capabilities`，不能直接套用另一平台的示例。

## Linux 无界面节点

服务器不需要图形界面或 Tauri 运行库。发布归档中的无界面 CLI 与桌面端共享 profile、会话、认证、模型路由和渠道核心逻辑：

```bash
tar -xzf rcodexmanager-linux-x86_64.tar.gz
./install.sh
~/.local/bin/rcodexmanager --json info
~/.local/bin/rcodexmanager --json doctor
```

CLI 自动优先读取已存在的 `~/.zshrc`，其次读取 `~/.bashrc`。服务器使用 Bash 时，创建的 `codex-*` 启动函数会写入 `.bashrc` 并在修改前备份。

Mac App 的“服务器节点”通过本机 SSH 配置执行远程 JSON 命令。节点设置只包含显示名称、SSH Host 和远程 CLI 路径；SSH 密码、私钥、API key、认证正文与渠道 token 不进入节点元数据。推荐使用 SSH alias 和绝对 CLI 路径：

```text
SSH Host: demo-server
远程 CLI: /home/demo/.local/bin/rcodexmanager
```

远程协议要求 stdout 中只有一个 CLI JSON envelope。连接提示或 SSH Host 错误应保留在 stderr，不能混入业务 JSON。

Mac 端会在 SSH 运行期间并发读取 stdout/stderr，避免大于系统管道缓冲区的会话详情阻塞。查询默认 30 秒、会话详情和普通写入 60 秒、网络自检和渠道启动 120 秒。任务报告包含 `operationId`、`startedAt`、`durationMs`、`timeoutSeconds` 和 `outputTruncated`。同一 App 进程会拒绝同一节点上的并发写操作。

节点弹窗在当前窗口内为每个节点保留最近 10 条非敏感任务摘要。Doctor、列表/状态、会话读取、路由预览和自检可以安全重试；创建、启停、认证应用、渠道启停和路由写入失败后必须先刷新状态，避免重复执行已经在服务器完成的操作。复制诊断会包含任务号和耗时，并脱敏常见凭据字段。

节点的 Profile、认证、模型路由、渠道、Doctor 与会话分页结果在 App 进程内缓存 30 秒。会话列表通过 `profileName/query/offset/limit` 分页，详情只在用户选择后执行 `read-session`；缓存不写入磁盘，重新启动 App 后自动清空。

Mac App 的 Profiles 页还提供“从本机同步”。它先通过远端 CLI 创建新的服务器 Profile，再按用户选择导入本机认证，最后重新读取服务器列表确认结果。认证正文只经 SSH 标准输入传输，不作为命令参数，也不会写入节点元数据或任务历史；服务器端临时文件会在导入结束后清理。该入口不会复制本机会话和桌面 User Data。

## Doctor 诊断

```bash
rcodexmanager --json doctor
```

`doctor` 是聚合只读检查，不写入 profile、认证库、远程渠道或模型配置。它检查启动配置、profile 路径、进程识别、登录态可读性、模型路由、代理、认证库、微信与飞书状态，并返回：

- `ready`：是否没有错误级检查项。
- `summary`：正常、提醒、错误数量。
- `checks`：稳定的检查 `id`、状态、标题、说明与建议。
- `platform`、`appVersion`、`generatedAt`：诊断环境信息。

报告不会包含 token、API key、认证正文、邮箱、日志正文或完整 home 路径。只有警告时退出码仍为 `0`；存在错误项时返回结构化报告并以退出码 `1` 结束。

## Profile

```bash
# 创建桌面 profile
rcodexmanager --json create --name codex-f --model gpt-5.5 \
  --reasoning-effort xhigh --alias 主力 --category 深度 --note 日常开发

# 创建 Linux/服务器 profile
rcodexmanager --json create --name codex-o --server

# 复制配置和元数据；复制 auth 需要显式确认
rcodexmanager --json copy --source codex-b --name codex-f
rcodexmanager --json copy --source codex-b --name codex-f \
  --auth-source codex-b --confirm-sensitive

# 更新本地元数据
rcodexmanager --json update --name codex-f --alias 主力 --category 平衡 --note 日常使用

# 只更新模型与推理等级；保留认证、会话、Provider 路由和 User Data
rcodexmanager --json model set --name codex-f --model gpt-5.5 --reasoning-effort xhigh

# 生命周期
rcodexmanager --json launch --name codex-f
rcodexmanager --json terminate --name codex-f
rcodexmanager --json stop --name codex-f

# 从日常列表软归档，并按原样恢复
rcodexmanager --json archive --name codex-f
rcodexmanager --json restore --name codex-f

# 重建配置；默认也重置 user data
rcodexmanager --json reset --name codex-f --model gpt-5.5 --reasoning-effort medium
rcodexmanager --json reset --name codex-f --keep-user-data

# 删除启动函数；数据目录默认保留
rcodexmanager --json delete --name codex-f
rcodexmanager --json delete --name codex-f --archive-data
```

默认 `codex` profile 不能归档、删除、重置、修改模型或安全终止。运行中的 profile 必须先停止才能归档。`archive` 只在 `~/.rcodexmanager/profile-metadata.json` 写入归档时间，不修改启动函数、`CODEX_HOME`、User Data、认证、会话或模型配置；`list` 的 `profiles` 只返回活动项，归档项位于 `archivedProfiles`。执行写操作前先用 `list` 检查 `isDefault`、`isRunning` 和 `isArchived`。

`list` 中每个 Profile 的 `authState` 只返回认证状态、access token 到期时间和是否存在 refresh token，不返回凭证正文。状态包括 `missing`、`valid`、`refresh-required`、`expired`、`api-key`、`unknown` 和 `invalid`。静态状态不等同于服务端在线确认；服务器节点详情中的“验证认证”会执行只读 `quota --name <profile>`。

`model set` 会备份当前 `config.toml`，只更新顶层 `model` 和 `model_reasoning_effort`，并保留 `model_provider`、Provider 配置、认证和会话。运行中的 Profile 必须先停止。不要为了切换模型使用 `reset`，后者会归档并重建 Profile 数据目录。

Linux 的 `launch` 使用 `rcodexmanager-<profile>` 命名的独立 `tmux` 会话保持交互式 Codex 运行，`terminate` 只停止对应的受管会话。`list` 通过进程环境中的 `CODEX_HOME` 和受管 tmux 会话双重识别状态。服务器未安装 `tmux` 时，查看、会话、认证和路由命令仍可用，但 `launch` 会返回明确的依赖错误。

## 会话

```bash
# 只读取分页索引
rcodexmanager --json sessions list
rcodexmanager --json sessions list --profile codex-g --limit 20
rcodexmanager --json sessions list --category 深度 --query workflow --offset 20 --limit 20

# 选中后再读取一条详情
rcodexmanager --json sessions detail --profile codex-g --session-id <id>
rcodexmanager --json sessions detail --profile codex-g --session-id <id> --updated-at <iso-time>
```

`limit` 会被核心逻辑限制在安全页容量内。不要通过循环一次性抓取所有详情；先筛选索引，再读取需要的会话。

## 账号与额度

```bash
# 本机浏览器登录；服务器/无界面环境使用设备码
rcodexmanager login --name codex-g
rcodexmanager login --name codex-g --device-auth

rcodexmanager --json quota --name codex-g

rcodexmanager --json import-auth --name codex-g \
  --source /path/to/auth.json --confirm-sensitive

```

`login` 调用官方 Codex 登录流程并直接写入目标 `CODEX_HOME`。它需要持续输出授权地址或设备码，因此不支持 `--json`；无界面 Linux 应使用 `--device-auth`。授权地址和一次性代码属于短期敏感信息，不应写入日志。`quota` 使用 profile 当前 access token 调用只读 usage 接口，不另存 token。`import-auth` 只允许停止中的非默认 profile，并先备份原 `auth.json`。

## 认证库

```bash
# 检查
rcodexmanager --json auth list

# 单个或批量备份
rcodexmanager --json auth backup --name codex-g --label "工作账号"
rcodexmanager --json auth backup-many \
  --name codex-b --name codex-g --label "迁移前快照"

# 更新标签、备注和置顶状态
rcodexmanager --json auth update --backup-id <id> --label "主备份" --note "可回滚" --pin
rcodexmanager --json auth update --backup-id <id> --clear-note --unpin

# 导出、预检、导入
rcodexmanager --json auth export --backup-id <id> --confirm-sensitive
rcodexmanager --json auth preview-import --file ./backup.rcodex-auth.json
rcodexmanager --json auth import --file ./backup.rcodex-auth.json \
  --label "导入备份" --note "来源 MacBook" --pinned --confirm-sensitive

# 应用与回滚
rcodexmanager --json auth apply --backup-id <id> --target codex-g --confirm-sensitive
rcodexmanager --json auth rollback --application-id <id> --confirm-sensitive

# 清理同账号重复项或删除一项
rcodexmanager --json auth cleanup --account-key <account-id-or-email> --confirm-sensitive
rcodexmanager --json auth delete --backup-id <id> --confirm-sensitive
```

`account-key` 的优先级是 `accountId`、`userId`、email、name；可从 `auth list` 的备份账号字段取得。导入前始终先运行 `preview-import`。

## 微信渠道

```bash
rcodexmanager --json wechat status
rcodexmanager --json wechat status --name codex-g
rcodexmanager --json wechat start --name codex-g
rcodexmanager --json wechat stop --name codex-g
rcodexmanager --json wechat restart --name codex-g
rcodexmanager --json wechat log --name codex-g --lines 120

# 从一个 profile 切换到另一个
rcodexmanager --json wechat switch --from codex-b --to codex-g

# 可恢复解绑
rcodexmanager --json wechat unbind --name codex-g --confirm-sensitive

# 服务器 systemd user service：不带动作时只渲染 unit
rcodexmanager --json wechat service --name codex-o
rcodexmanager --json wechat service --name codex-o --install --enable --now
```

启动依赖本机可用的 `wechat-acp` 与 `codex-acp`。日志输出已做基础脱敏。

## 飞书渠道

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

飞书使用外部 `codex-remote-feishu`。`configure` 只记录 profile 和可执行文件路径；App ID/App Secret 由外部运行时管理。

## 模型路由

```bash
# 只读状态与当前本机代理探测
rcodexmanager --json model-route status
rcodexmanager --json model-route status --name codex-g
rcodexmanager --json model-route proxy

# 预览，不写 config.toml
rcodexmanager --json model-route preview --name codex-g \
  --preset aliyun-qwen --model qwen3-coder-plus --api-key-env DASHSCOPE_API_KEY

rcodexmanager --json model-route preview --name codex-g \
  --preset glm --model glm-4.6 \
  --proxy-base-url http://127.0.0.1:15721/v1 \
  --upstream-base-url https://open.bigmodel.cn/api/paas/v4 \
  --api-key-env ZAI_API_KEY

# 测试表单草稿，不写配置；Chat-only 直接测试上游 chat/completions
rcodexmanager --json model-route test-draft --name codex-g \
  --preset glm --model glm-4.6 \
  --upstream-base-url https://open.bigmodel.cn/api/paas/v4 \
  --api-key-env ZAI_API_KEY

# 应用与恢复
rcodexmanager --json model-route apply --name codex-g \
  --preset glm --model glm-4.6 \
  --proxy-base-url http://127.0.0.1:15721/v1 \
  --upstream-base-url https://open.bigmodel.cn/api/paas/v4 \
  --api-key-env ZAI_API_KEY --confirm-sensitive

rcodexmanager --json model-route check --name codex-g
rcodexmanager --json model-route restore --name codex-g --confirm-sensitive
```

预设值：`aliyun-qwen`、`glm`、`local-openai`、`custom-responses`。

重要边界：

- CLI 不接受明文 `--api-key`，只接受环境变量名。
- `preview` 与 `test-draft` 不写配置。
- `apply` 与 `restore` 只允许停止中的非默认 profile，并先备份 `config.toml`。
- `model-route proxy` 只检查状态。内置代理由长驻桌面进程管理，应在模型路由弹窗中启动或停止；一次性 CLI 进程不承担代理生命周期。
- 不要停止 `serviceKind` 为外部未知或 cc-switch 的代理。

## Agent 安全顺序

1. `info` 与 `capabilities` 确认二进制和命令版本。
2. 不熟悉当前环境或正在排障时先运行 `doctor`，按检查 `id` 定位模块。
3. `list` 检查目标 profile 是否存在、是否默认、是否运行。
4. 对会话只先读取 `sessions list`，再按需读详情。
5. 认证导入先 `preview-import`；认证应用先确认目标已停止。
6. 模型路由先 `status`、`proxy`、`preview`，必要时 `test-draft`，最后才 `apply`。
7. 任何 `--confirm-sensitive` 都只在用户明确要求对应写操作后使用。
8. 输出中只汇报账号标识、状态和脱敏路径，不打印 token、API key 或认证包正文。
