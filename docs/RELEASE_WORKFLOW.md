# 发布流程

[English](RELEASE_WORKFLOW_EN.md)

rCodexManager 采用“源码先行、服务器打 Tag、GitHub 云端构建”的发布流程，同时生成桌面候选包与 Linux Headless CLI 归档。

## 职责边界

- 开发 Mac 只运行源码检查、前端测试与构建、Rust 测试和编译验证，不上传本地生成的安装包。
- 发布服务器在批准的周末发布窗口生成过滤后的干净源码记录，并创建 `vX.Y.Z` Tag。
- GitHub Actions 从该 Tag 构建 macOS、Windows 和 Linux Headless 候选产物。
- Tag 构建成功后只创建 Draft GitHub Release。维护者检查校验和、安装行为、签名状态、Headless 安装脚本、更新日志与官网元数据后，才决定是否发布。

## Tag 前检查

1. 对齐 `package.json`、桌面 Cargo package、Headless Cargo package、Tauri config、App Manifest、`CHANGELOG.md` 与 `CHANGELOG_EN.md` 的版本。
2. 运行 `npm run check`，再运行 `npm run manifest:check:release`，确认全部本地化文档已经复核当前版本。
3. 检查服务器过滤快照，确认不含认证备份、绑定二维码、SSH 私钥、真实节点信息、会话正文、构建产物、本机路径或 QA 图片。
4. 运行发布服务器 dry-run，人工检查干净差异。
5. 仅在批准的周末窗口由服务器创建并推送 Tag。

## Tag 合同

Tag 必须与应用版本完全一致，例如 `0.1.2` 只能使用 `v0.1.2`。`.github/workflows/release.yml` 会在打包前拒绝不匹配的 Tag。

每份本地化文档的 `reviewedForVersion` 也必须与应用版本一致。只有实际复核正文后才能更新该字段；Tag workflow 会在打包前拒绝过期文档。

手动触发 workflow 只用于验证 GitHub 构建环境，不会创建 GitHub Release。

## 当前预览边界

`0.1.x` 仍是开发预览。macOS 包未完成 Developer ID 签名与公证，Windows 包未完成 Authenticode 签名，因此 Release 必须保持 Draft 和 prerelease，不作为官网正式下载入口。Linux Headless 归档包含 CLI 与用户级安装脚本，但服务器安装仍需显式执行和 Doctor 验证。

正式分发还需要完成桌面签名、公证、安装烟测和 updater 闭环。
