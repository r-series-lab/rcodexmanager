# rCodexManager

`rCodexManager` 是一个本地优先的 Codex profile 管理工具，用来集中查看、创建、启动、终止、重置和维护多个独立的 Codex 桌面实例。

它管理的核心对象是：

- `~/.zshrc` 里的 `codex-*` 启动函数。
- 每个 profile 独立的 `CODEX_HOME`。
- 每个 profile 独立的 `--user-data-dir`。
- rCodexManager 自己维护的别名、分类和备注。

它不会管理 Codex 账号订阅或云端状态，也不会默认删除历史会话数据。所有破坏性操作都采用保守策略：先备份、先归档，默认 profile 受保护。

技术栈：`Tauri 2 + Rust + React + Vite + TypeScript + Material UI`

## 适合做什么

- 给 Codex 准备多个隔离实例，例如主力、深度研究、轻量问答、插件测试。
- 为不同实例配置不同的 `CODEX_HOME`、user data、模型和 reasoning effort。
- 从一个界面查看 profile 是否运行、是否登录、最近会话是什么。
- 快速启动或终止某个独立 Codex 实例。
- 复制或导入可信登录态到某个停止中的 profile。
- 检查当前账号额度窗口。
- 修复 Codex WebSocket / 代理环境相关问题。

## 桌面功能

### Profile 列表

- 自动读取默认 `codex` profile。
- 扫描 `~/.zshrc` 中的 `codex-*` 启动函数。
- 解析每个启动函数里的 `CODEX_HOME` 和 `--user-data-dir`。
- 显示 profile 总数、运行中数量、已识别账号数量。
- 支持按分类筛选和关键词搜索。
- 支持亮色 / 暗色模式。
- 每个卡片显示别名、命令名、账号状态和最近会话标题。

### Profile 详情

选择一个 profile 后，右侧详情区会展示：

- 命令名、别名、分类。
- 模型和 reasoning effort。
- `CODEX_HOME` 路径。
- user data 路径。
- `config.toml` 是否存在。
- WebSocket feature flag 是否启用。
- 当前是否运行，以及匹配到的进程数量。
- 账号信息，例如邮箱、姓名、计划类型、组织名称。
- 最近一次会话的标题、摘要、目录和时间。
- 额度窗口查询结果。

### 创建 profile

新增 profile 会完成这些动作：

- 校验命令名必须以 `codex-` 开头。
- 自动生成默认目录：
  - `~/.codex-<suffix>`
  - `~/Library/Application Support/Codex-<TitleSuffix>`
- 创建 `CODEX_HOME` 和 user data 目录。
- 写入新的 `config.toml`。
- 在 `~/.zshrc` 中追加启动函数。
- 写入本地元数据：别名、分类、备注。

默认模型为 `gpt-5.5`，默认 reasoning effort 为 `xhigh`。

### 启动与终止

- 启动 profile 等价于使用 macOS `open -n -a "Codex"` 启动一个新的 Codex 实例。
- 启动时会带上该 profile 的 `CODEX_HOME` 和 `--user-data-dir`。
- 如果系统代理可识别，启动时会附加代理环境变量。
- 终止只会 kill 匹配该 profile user data 路径的 Codex 主进程。
- 默认 `codex` profile 不支持安全终止，需要在 Codex 内手动退出。

### 编辑、删除与重置

- 编辑只修改 rCodexManager 本地元数据，例如别名和分类。
- 删除默认只移除 `.zshrc` 启动函数，不删除数据目录。
- 删除时可选择归档 profile 数据目录。
- 重置会先归档旧 `CODEX_HOME`，再写入新的 `config.toml`。
- 重置可选择是否同时归档 user data 目录。
- 默认 `codex` profile 受保护，不能删除、重置或覆盖导入。
- `.zshrc` 写入前会生成备份文件。

### 账号导入

账号导入用于把可信来源的登录态写入目标 profile 的 `auth.json`。

- 支持来源为 Codex `auth.json` 或可规范化的 ChatGPT session JSON。
- 只会写入目标 profile 的 `CODEX_HOME/auth.json`。
- 已有 `auth.json` 会先复制备份。
- 需要显式确认敏感 token 导入。
- 目标 profile 必须处于停止状态。
- 默认 `codex` profile 受保护，不允许覆盖导入。
- 如果来源没有 refresh token，登录态后续可能过期。

### 额度查询

额度查询会读取目标 profile 的 `auth.json`，使用 access token 访问只读 usage 接口：

```text
https://chatgpt.com/backend-api/wham/usage
```

返回内容会整理成多个额度窗口：

- 窗口名称。
- 已用百分比。
- 剩余百分比。
- 窗口分钟数。
- 重置时间。
- 是否仍可用。
- 是否触达限制。

rCodexManager 不会把查询得到的 token 另存一份。

### 网络修复

网络修复用于处理 Codex Responses WebSocket 或 macOS 启动环境代理问题。

它会：

- 确保 profile 的 `config.toml` 存在。
- 启用 WebSocket feature flags：
  - `responses_websockets`
  - `responses_websockets_v2`
  - `responses_websocket_response_processed`
- 尝试读取当前 macOS 系统代理。
- 默认尝试把代理写入 `launchctl` 环境，供后续启动的 Codex 继承。
- 可通过 CLI 的 `--skip-launchctl` 只更新 `config.toml`，不改 launch 环境。

## 快速开始

安装依赖并启动桌面开发版：

```bash
npm install
npm run dev
```

构建桌面应用：

```bash
npm run build
```

Rust 检查与测试：

```bash
npm run rust-check
npm run rust-test
```

## CLI 用法

开发期可从项目根目录运行：

```bash
cargo run --manifest-path ./src-tauri/Cargo.toml -- info --json
cargo run --manifest-path ./src-tauri/Cargo.toml -- capabilities --json
cargo run --manifest-path ./src-tauri/Cargo.toml -- list --json
```

构建后可直接调用二进制：

```bash
./target/debug/rcodexmanager info --json
./target/debug/rcodexmanager capabilities --json
./target/debug/rcodexmanager list --json
```

### 全局参数

| 参数 | 说明 |
| --- | --- |
| `--json` | 输出单个机器友好的 JSON 对象 |
| `--home <PATH>` | 使用指定 home 目录，适合测试或自动化 |
| `--zshrc <PATH>` | 使用指定 zsh 配置文件，适合隔离环境 |

### 常用命令

```bash
# 查看应用信息
rcodexmanager info --json

# 查看 CLI 能力清单
rcodexmanager capabilities --json

# 列出 profile
rcodexmanager list --json

# 创建 profile
rcodexmanager create \
  --name codex-f \
  --model gpt-5.5 \
  --reasoning-effort xhigh \
  --alias Draft \
  --category 深度 \
  --json

# 更新别名、分类和备注
rcodexmanager update \
  --name codex-f \
  --alias 主力 \
  --category 平衡 \
  --note 日常使用 \
  --json

# 启动 profile
rcodexmanager launch --name codex-f --json

# 终止 profile，stop 是 terminate 的别名
rcodexmanager terminate --name codex-f --json
rcodexmanager stop --name codex-f --json

# 查询额度
rcodexmanager quota --name codex-f --json

# 导入可信 auth.json
rcodexmanager import-auth \
  --name codex-f \
  --source /path/to/auth.json \
  --confirm-sensitive \
  --json

# 修复 WebSocket / 代理环境
rcodexmanager repair-network --name codex-f --json
rcodexmanager repair-network --name codex-f --skip-launchctl --json

# 重置 profile；默认会重置 user-data-dir
rcodexmanager reset \
  --name codex-f \
  --model gpt-5.5 \
  --reasoning-effort medium \
  --json

# 保留 user-data-dir，仅重建 CODEX_HOME/config.toml
rcodexmanager reset --name codex-f --keep-user-data --json

# 删除启动函数；默认保留数据目录
rcodexmanager delete --name codex-f --json

# 删除启动函数并归档数据目录
rcodexmanager delete --name codex-f --archive-data --json
```

测试或自动化时可指定隔离路径：

```bash
rcodexmanager \
  --home /tmp/mock-home \
  --zshrc /tmp/mock-home/.zshrc \
  list \
  --json
```

## JSON 输出约定

成功：

```json
{
  "ok": true,
  "command": "list",
  "data": {
    "profileCount": 4,
    "profiles": []
  }
}
```

失败：

```json
{
  "ok": false,
  "error": {
    "code": "invalid_arguments",
    "message": "profile name must start with codex-"
  }
}
```

CLI 会根据错误类型返回非零退出码，自动化脚本建议只解析 `ok`、`command`、`data`、`error` 字段。

## 数据边界

| 数据 | 默认位置 |
| --- | --- |
| 启动函数 | `~/.zshrc` |
| rCodexManager 元数据 | `~/.rcodexmanager/profile-metadata.json` |
| 默认 Codex profile | `~/.codex` |
| 默认 Codex user data | `~/Library/Application Support/Codex` |
| 新 profile 的 CODEX_HOME | `~/.codex-<suffix>` |
| 新 profile 的 user data | `~/Library/Application Support/Codex-<TitleSuffix>` |
| Codex 配置 | `<CODEX_HOME>/config.toml` |
| Codex 登录态 | `<CODEX_HOME>/auth.json` |
| Codex 会话索引 | `<CODEX_HOME>/session_index.jsonl` |
| Codex 会话文件 | `<CODEX_HOME>/sessions/**/*.jsonl` |

安全策略：

- `.zshrc` 写入前会生成 `.zshrc.rcodexmanager-backup-*`。
- 删除带 `--archive-data` 时，目录会移动为带时间戳的备份目录。
- 重置会归档旧目录，不直接覆盖删除。
- 导入账号会备份旧 `auth.json`。
- 默认 profile 受保护，避免误伤正在使用的主 Codex。

## 开发命令

```bash
npm run dev          # 启动 Tauri 桌面开发版
npm run build        # 构建桌面应用
npm run web:dev      # 仅启动 Vite 前端
npm run web:build    # TypeScript + Vite 构建
npm run rust-check   # Rust 类型检查
npm run rust-test    # Rust 测试，包含 CLI contract
npm run size         # 查看构建缓存和产物体积
npm run clean        # 清理构建产物
npm run clean:all    # 清理构建产物和 node_modules
```

## 项目结构

```text
src/               React 前端、主题、API 封装和类型定义
src-tauri/         Tauri 桌面壳、CLI、profile 管理核心逻辑
src-tauri/tests/   CLI contract 测试
scripts/           本地开发和构建脚本
```

## 非目标

- 不管理 Codex 账号、订阅、组织或云端权限。
- 不解析所有 shell 语法，只针对常见 `name() { ... }` 启动函数。
- 不默认删除历史会话数据。
- 不绕过 Codex 的登录机制，只在用户确认后写入本地登录态文件。

## License

MIT
