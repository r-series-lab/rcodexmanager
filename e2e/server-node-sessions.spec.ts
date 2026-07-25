import { expect, test } from "@playwright/test";

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "default-light", "server session flow uses the default window");
});

test("server sessions are filtered in pages and details load on selection", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("rcodexmanager-style", "light"));
  await page.goto("/");
  await expect(page.getByText("Profiles", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /服务器节点/ }).click();

  const dialog = page.getByRole("dialog", { name: /服务器节点/ });
  await expect(dialog.getByText("可用", { exact: true }).first()).toBeVisible();
  await dialog.getByRole("tab", { name: "会话", exact: true }).click();

  const search = dialog.getByPlaceholder("搜索会话标题或摘要");
  await expect(search).toBeVisible();
  await search.fill("rTerm");
  const row = dialog.locator(".server-session-row").filter({ hasText: "rTerm" });
  await expect(row).toHaveCount(1);
  await expect(dialog.getByText("详情会在选中后按需读取。", { exact: true })).toBeVisible();

  await row.click();
  await expect(dialog.locator(".server-session-detail-content")).toContainText("检查本地开发服务状态");
  await expect(dialog.locator(".server-session-detail-content code").last()).toContainText("019e86f9");

  await dialog.getByRole("tab", { name: /Profiles/ }).click();
  await dialog.getByRole("tab", { name: "会话", exact: true }).click();
  await expect(row).toBeVisible();
  await expect(dialog.getByText(/内存缓存 · 更新于/)).toBeVisible();

  await dialog.getByRole("button", { name: "查看最近任务" }).click();
  await expect(dialog.locator(".server-node-task-history")).toContainText("读取会话详情");
  await expect(dialog.locator(".server-node-task-row").filter({ hasText: "读取服务器会话" })).toHaveCount(1);
});
