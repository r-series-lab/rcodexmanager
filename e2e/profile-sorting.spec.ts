import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.removeItem("rcodexmanager-profile-sort");
    localStorage.removeItem("rcodexmanager-active-profile");
    localStorage.removeItem("rcodexmanager-server-profile-sort");
    localStorage.removeItem("rcodexmanager-selected-server-node");
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith("rcodexmanager-selected-server-profile:")) {
        localStorage.removeItem(key);
      }
    }
  });
  await page.reload();
  await expect(page.locator(".profile-card").first()).toBeVisible();
});

test("remembers local and server profile sorting and selection", async ({ page }, testInfo) => {
  const localSort = page.getByRole("combobox", { name: "Profile 排序" });
  await expect(localSort).toContainText("智能排序");
  await expect(page.locator(".profile-card").first()).toContainText("codex-b");

  await localSort.click();
  await page.getByRole("option", { name: "最近使用" }).click();
  await expect(page.locator(".profile-card").first()).toContainText("rDevTool");
  await page.locator(".profile-card").filter({ hasText: "codex-g" }).locator(".profile-card-main").click();
  await page.screenshot({
    path: `test-results/playwright/${testInfo.project.name}-profile-sorting-local.png`,
    animations: "disabled",
  });

  await page.getByRole("button", { name: /服务器节点/ }).click();
  const serverDialog = page.getByRole("dialog", { name: /服务器节点/ });
  await expect(serverDialog).toBeVisible();
  await serverDialog.getByRole("tab", { name: /Profiles/ }).click();
  const serverSort = serverDialog.getByRole("combobox", { name: "服务器 Profile 排序" });
  await expect(serverSort).toContainText("智能排序");
  await serverSort.click();
  await page.getByRole("option", { name: "最近使用" }).click();
  await serverDialog.locator(".server-profile-row").filter({ hasText: "codex-q" }).click();
  await page.screenshot({
    path: `test-results/playwright/${testInfo.project.name}-profile-sorting-server.png`,
    animations: "disabled",
  });

  await page.reload();
  await expect(page.locator(".profile-card").first()).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Profile 排序" })).toContainText("最近使用");
  await expect(page.locator(".profile-card.selected")).toContainText("codex-g");

  await page.getByRole("button", { name: /服务器节点/ }).click();
  const reopenedServerDialog = page.getByRole("dialog", { name: /服务器节点/ });
  await reopenedServerDialog.getByRole("tab", { name: /Profiles/ }).click();
  await expect(reopenedServerDialog.getByRole("combobox", { name: "服务器 Profile 排序" })).toContainText("最近使用");
  await expect(reopenedServerDialog.locator(".server-profile-row.selected")).toContainText("codex-q");
});
