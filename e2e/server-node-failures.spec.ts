import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

async function openServerNodes(page: Page, scenario: string) {
  await page.addInitScript(() => localStorage.setItem("rcodexmanager-style", "light"));
  await page.goto(`/?serverNodeMock=${scenario}`);
  await expect(page.getByText("Profiles", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /服务器节点/ }).click();
  const dialog = page.getByRole("dialog", { name: /服务器节点/ });
  await expect(dialog).toBeVisible();
  return dialog;
}

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "default-light", "failure matrix uses the default light viewport");
});

test("server-node failure: SSH authentication has a recovery path", async ({ page }) => {
  const dialog = await openServerNodes(page, "ssh-auth");
  await expect(dialog.getByText("SSH 身份验证失败", { exact: true })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "重新检查" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "复制服务器诊断信息" })).toBeVisible();
});

test("server-node failure: missing node CLI stays read-only", async ({ page }) => {
  const dialog = await openServerNodes(page, "cli-missing");
  await expect(dialog.getByText("待安装节点 CLI", { exact: true }).first()).toBeVisible();
  await expect(dialog.getByText("SSH 已连接，但服务器尚未安装 rCodexManager 节点 CLI。", { exact: true })).toBeVisible();
  await dialog.getByRole("tab", { name: "会话", exact: true }).click();
  await expect(dialog.getByText("节点 CLI 尚未就绪", { exact: true })).toBeVisible();
});

test("server-node compatibility: old CLI disables profile model writes", async ({ page }) => {
  const dialog = await openServerNodes(page, "cli-old");
  await expect(dialog.getByText(/升级到 0\.1\.2 后可直接反显并选择 Profile 模型/)).toBeVisible();
  await dialog.getByRole("tab", { name: /Profiles/ }).click();
  await dialog.locator(".server-profile-row").filter({ hasText: "codex-o" }).click();
  await expect(dialog.getByRole("button", { name: "配置模型" })).toBeDisabled();
});

test("server-node failure: timed-out read can be retried", async ({ page }) => {
  const dialog = await openServerNodes(page, "timeout");
  await dialog.getByRole("tab", { name: "诊断", exact: true }).click();
  await expect(dialog.getByText("远程任务等待超时", { exact: true })).toBeVisible();
  await expect(dialog.locator(".server-node-recovery").getByRole("button", { name: "重试" })).toBeVisible();
  await expect(dialog.locator(".server-node-task-strip")).toContainText("运行服务器诊断");
});

test("server-node failure: failed write is not replayed automatically", async ({ page }) => {
  const dialog = await openServerNodes(page, "write-busy");
  await dialog.getByRole("tab", { name: /Profiles/ }).click();
  await dialog.locator(".server-profile-row").filter({ hasText: "codex-o" }).click();
  await dialog.getByRole("button", { name: "启动", exact: true }).click();
  const recovery = dialog.locator(".server-node-recovery");
  await expect(recovery.getByText("节点正在处理另一项修改", { exact: true })).toBeVisible();
  await expect(recovery.getByRole("button", { name: "重试" })).toHaveCount(0);
  await expect(recovery.getByRole("button", { name: "重新检查" })).toBeVisible();
});
