# Contributing / 参与贡献

感谢你帮助改进 rCodexManager。提交代码前请先搜索现有 Issue；涉及认证、远程写入、模型路由或 Profile 数据模型的变化，请先开 Feature Request 对齐安全边界。

Thank you for improving rCodexManager. Search existing Issues first. Open a Feature Request before changing authentication, remote writes, model routing, or the Profile data model.

## Local checks

```bash
npm ci
npm run release:check
npm run check
```

Keep changes scoped and preserve the existing backup, preview, confirmation, redaction, and rollback contracts. Public fixtures, screenshots, logs, and examples must use synthetic data and must not contain credentials, OAuth challenges, private URLs, usernames, or machine-specific paths.

## Pull requests

- Explain the user-visible behavior and security impact.
- Link the related Issue when one exists.
- Update Chinese and English documentation together.
- Update changelogs and `r-app.manifest.json` when public behavior changes.
- Confirm `npm run release:check` and `npm run check` pass.

By contributing, you agree that your contribution is licensed under the repository's MIT License.
