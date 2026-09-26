import { expect, test, type Locator, type Page } from "@playwright/test";

const outputRoot = "docs/assets/screenshots";

test.skip(
  !process.env.RCODEXMANAGER_CAPTURE_PRODUCT,
  "Product screenshots are generated only through npm run screenshots:product.",
);

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("rcodexmanager-style", "light");
    localStorage.setItem("rcodexmanager-language", "zh-CN");
    localStorage.removeItem("rcodexmanager-active-profile");
  });
  await page.goto("/");
  await expect(page.getByRole("main")).toBeVisible();
});

async function capture(locator: Locator, fileName: string) {
  await locator.screenshot({
    path: `${outputRoot}/${fileName}`,
    animations: "disabled",
  });
}

async function openManager(page: Page, name: string) {
  await page.getByRole("button", { name: new RegExp(name) }).click();
  const dialog = page.getByRole("dialog", { name: new RegExp(name) });
  await expect(dialog).toBeVisible();
  return dialog;
}

test("capture public product interface", async ({ page }) => {
  await page.getByRole("button", { name: "查询当前列表额度" }).click();
  await expect(page.locator(".profile-quota-values").first()).toContainText("62%");
  await capture(page.locator(".app-shell"), "profile-workspace.png");

  const sessions = await openManager(page, "会话中心");
  await sessions.locator(".feature-list-item").first().click();
  await expect(sessions.locator(".feature-detail-title")).toBeVisible();
  await capture(sessions, "session-center.png");
  await sessions.getByRole("button", { name: "关闭", exact: true }).click();

  const auth = await openManager(page, "认证库");
  await auth.locator(".feature-list-item").first().click();
  await expect(auth.locator(".feature-detail-title")).toBeVisible();
  await capture(auth, "auth-vault.png");
  await auth.getByRole("button", { name: "关闭", exact: true }).click();

  const channels = await openManager(page, "远程渠道");
  await channels.getByRole("tab", { name: "飞书", exact: true }).click();
  await expect(channels.getByText("飞书远程渠道", { exact: true })).toBeVisible();
  await capture(channels, "remote-channels.png");
  await channels.getByRole("button", { name: "关闭", exact: true }).click();

  const routes = await openManager(page, "模型路由");
  await routes.getByRole("tab", { name: "配置", exact: true }).click();
  await expect(routes.getByLabel("Provider 预设")).toBeVisible();
  await capture(routes, "model-routing.png");
  await routes.getByRole("button", { name: "关闭", exact: true }).click();

});
