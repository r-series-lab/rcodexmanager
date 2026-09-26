import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.removeItem("rcodexmanager-active-profile");
    localStorage.removeItem("rcodexmanager-profile-sort");
  });
  await page.reload();
  await expect(page.locator(".profile-card").first()).toBeVisible();
});

test("row selection stays compact and archived profiles can be restored", async ({ page }) => {
  const inspector = page.locator('aside[aria-label="profile 详情"]');
  const profileRow = page.locator(".profile-card").filter({ hasText: "codex-g" });

  await expect(inspector).toBeHidden();
  await profileRow.locator(".profile-card-main").click();
  await expect(profileRow).toHaveClass(/selected/);
  await expect(inspector).toBeHidden();

  const toolbarButtons = page.locator(".window-toolbar button");
  await expect(toolbarButtons).toHaveCount(1);
  await expect(toolbarButtons.nth(0)).toHaveAttribute("aria-label", "打开设置");
  await profileRow.getByRole("button", { name: "更多操作 codex-g" }).click();
  await page.getByRole("menuitem", { name: "归档", exact: true }).click();

  const confirmDialog = page.getByRole("dialog", { name: /归档 Profile/ });
  await expect(confirmDialog).toContainText("认证、会话和模型配置都会原样保留");
  await confirmDialog.getByRole("button", { name: "确认归档" }).click();

  await expect(page.locator(".profile-card").filter({ hasText: "codex-g" })).toHaveCount(0);
  await page.getByRole("button", { name: /已归档/ }).click();

  const archivedRow = page.locator(".profile-card.archived").filter({ hasText: "codex-g" });
  await expect(archivedRow).toBeVisible();
  await expect(archivedRow).toContainText("已归档");
  await archivedRow.getByRole("button", { name: "恢复 codex-g" }).click();

  await expect(page.getByRole("button", { name: /全部/ })).toHaveClass(/selected/);
  await expect(page.locator(".profile-card").filter({ hasText: "codex-g" })).toBeVisible();
});

test("row actions replace the removed profile inspector", async ({ page }) => {
  const profileRow = page.locator(".profile-card").first();

  await expect(page.getByRole("button", { name: /展开详情栏|收起详情栏/ })).toHaveCount(0);
  await expect(profileRow.getByRole("button", { name: /归档/ })).toHaveCount(0);
  await expect(profileRow.getByRole("button", { name: /删除/ })).toHaveCount(0);
  await expect(profileRow.getByRole("button", { name: /查看额度/ })).toBeVisible();

  await profileRow.getByRole("button", { name: /更多/ }).click();
  await expect(page.getByRole("menuitem", { name: "修复 WebSocket" })).toHaveCount(0);
  await expect(page.getByRole("menuitem", { name: /刷新认证|登录 Profile/ })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "打开 CODEX_HOME" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "复制 Profile" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "归档", exact: true })).toBeDisabled();
  await expect(page.getByRole("menuitem", { name: "删除", exact: true })).toBeDisabled();
  await page.getByRole("menuitem", { name: "查看额度" }).click();

  const quotaDialog = page.getByRole("dialog", { name: /Profile 额度/ });
  await expect(quotaDialog).toBeVisible();
  await quotaDialog.getByRole("button", { name: "完成" }).click();
  await expect(quotaDialog).not.toBeVisible();
});

test("profile context menu exposes only lifecycle and maintenance actions", async ({ page }) => {
  const profileRow = page.locator(".profile-card").filter({ hasText: "codex-g" });

  await profileRow.click({ button: "right" });
  const contextMenu = page.getByRole("menu");
  await expect(contextMenu).toBeVisible();
  await expect(contextMenu.getByRole("menuitem")).toHaveCount(4);
  await expect(contextMenu.getByRole("menuitem", { name: "启动", exact: true })).toBeVisible();
  await expect(contextMenu.getByRole("menuitem", { name: "编辑", exact: true })).toBeVisible();
  await expect(contextMenu.getByRole("menuitem", { name: "归档", exact: true })).toBeEnabled();
  await expect(contextMenu.getByRole("menuitem", { name: "删除", exact: true })).toBeEnabled();
  await expect(contextMenu.getByRole("menuitem", { name: "打开 CODEX_HOME" })).toHaveCount(0);

  await contextMenu.getByRole("menuitem", { name: "编辑", exact: true }).click();
  const editor = page.getByRole("dialog", { name: /编辑 profile/ });
  await expect(editor).toBeVisible();
  await editor.getByRole("button", { name: "关闭" }).click();

  await profileRow.click({ button: "right" });
  await page.getByRole("menuitem", { name: "删除", exact: true }).click();
  const deleteDialog = page.getByRole("dialog", { name: /删除 profile/ });
  await expect(deleteDialog).toBeVisible();
  await deleteDialog.getByRole("button", { name: "关闭" }).click();
});

test("double click opens the expanded profile editor", async ({ page }) => {
  const profileRow = page.locator(".profile-card").filter({ hasText: "codex-g" });

  await profileRow.locator(".profile-card-main").dblclick();
  const editor = page.getByRole("dialog", { name: /编辑 profile/ });

  await expect(editor).toBeVisible();
  await expect(editor.getByText("基本信息", { exact: true })).toBeVisible();
  await expect(editor.getByText("模型与推理", { exact: true })).toBeVisible();
  await expect(editor.getByText("路径与运行配置", { exact: true })).toBeVisible();
  await expect(editor.getByLabel("启动命令")).toHaveValue("codex-g");
  await expect(editor.getByLabel("模型")).toBeEnabled();
  await expect(editor.getByLabel("推理等级")).toBeEnabled();
  await editor.getByLabel("备注").fill("双击编辑测试");
  await expect(editor.getByRole("button", { name: "保存更改" })).toBeEnabled();
  await editor.getByRole("button", { name: "关闭" }).click();
});
