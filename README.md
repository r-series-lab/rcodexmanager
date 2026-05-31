# rCodexManager

`rCodexManager` 是一个本地优先的 Codex profile 管理工具，用来集中查看、创建、删除、重置和启动 `codex-*` 独立实例。它管理的是 `.zshrc` 里的启动函数，以及每个实例对应的 `CODEX_HOME` 与 `--user-data-dir`。

## 功能

- 扫描 `~/.zshrc` 中的 `codex-*` 启动函数
- 显示每个 profile 的 `CODEX_HOME`、user-data-dir、模型和 reasoning effort
- 为每个 profile 维护别名、分类和备注
- 新增 profile：创建目录、写入 `config.toml`、追加 zsh 启动函数
- 删除 profile：默认只移除启动函数，可选择归档数据目录
- 重置 profile：先归档旧目录，再创建新的 `config.toml`
- 启动 profile：等价于 `open -n -a "Codex" --env CODEX_HOME=... --args --user-data-dir=...`
- 提供 AI 友好的 CLI JSON 输出

## 非目标

- 不管理 Codex 账号、订阅或云端状态
- 不解析所有 shell 语法，只针对常见 `name() { ... }` 启动函数
- 不默认删除历史会话数据，删除和重置都会采用保守策略

## 快速开始

```bash
npm install
npm run dev
```

构建桌面应用：

```bash
npm run build
```

Rust 检查：

```bash
npm run rust-check
```

## CLI

构建或测试后可使用 `rcodexmanager`：

```bash
./src-tauri/target/debug/rcodexmanager info --json
./src-tauri/target/debug/rcodexmanager capabilities --json
./src-tauri/target/debug/rcodexmanager list --json
./src-tauri/target/debug/rcodexmanager create --name codex-f --model gpt-5.5 --reasoning-effort xhigh --alias Draft --category 深度 --json
./src-tauri/target/debug/rcodexmanager update --name codex-f --alias 主力 --category 平衡 --note 日常使用 --json
./src-tauri/target/debug/rcodexmanager reset --name codex-f --model gpt-5.5 --reasoning-effort medium --json
./src-tauri/target/debug/rcodexmanager delete --name codex-f --archive-data --json
```

测试或自动化时可指定隔离路径：

```bash
rcodexmanager --home /tmp/mock-home --zshrc /tmp/mock-home/.zshrc list --json
```

## JSON 约定

成功时：

```json
{
  "ok": true,
  "command": "list",
  "data": {
    "profileCount": 4
  }
}
```

失败时：

```json
{
  "ok": false,
  "error": {
    "code": "invalid_arguments",
    "message": "profile name must start with codex-"
  }
}
```

## 数据边界

- 启动函数：`~/.zshrc`
- 别名、分类和备注：`~/.rcodexmanager/profile-metadata.json`
- Codex profile 配置：每个 profile 的 `CODEX_HOME/config.toml`
- Codex App 用户数据：每个 profile 的 `~/Library/Application Support/Codex-*`
- `.zshrc` 写入前会生成 `.zshrc.rcodexmanager-backup-*`
- 删除带 `--archive-data` 时，数据目录会移动为带时间戳的备份目录

## 开发命令

```bash
npm run web:build
npm run rust-check
npm run rust-test
npm run clean
npm run clean:all
```

## License

MIT
