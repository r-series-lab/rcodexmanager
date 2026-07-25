import { expect, test, type Page, type TestInfo } from "@playwright/test";

async function openDialog(page: Page, name: string) {
  if (name === "设置") {
    await page.getByRole("button", { name: "打开设置" }).click();
    return;
  }
  if (name === "新增 profile") {
    await page.getByRole("button", { name: "新增 profile" }).click();
    return;
  }
  await page.locator(".profile-card-main").first().click();
  const maintenanceActions = page.locator(".secondary-action-bar button");
  await (name === "复制 profile" ? maintenanceActions.first() : maintenanceActions.last()).click();
}

async function expectDialogAligned(page: Page, name: string, testInfo: TestInfo) {
  const dialog = page.getByRole("dialog", { name: new RegExp(name) });
  await expect(dialog).toBeVisible();
  const layout = await dialog.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return {
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      scrollWidth: node.scrollWidth,
      clientWidth: node.clientWidth,
    };
  });
  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();
  expect(layout.left).toBeGreaterThanOrEqual(0);
  expect(layout.top).toBeGreaterThanOrEqual(0);
  expect(layout.right).toBeLessThanOrEqual(viewport!.width + 1);
  expect(layout.bottom).toBeLessThanOrEqual(viewport!.height + 1);
  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth + 1);
  await page.screenshot({
    path: `test-results/playwright/${testInfo.project.name}-${name}.png`,
    animations: "disabled",
  });
  await dialog.getByRole("button", { name: "关闭" }).click();
  await expect(dialog).not.toBeVisible();
}

test.beforeEach(async ({ page }, testInfo) => {
  const preference = testInfo.project.name.endsWith("-light")
    ? "light"
    : testInfo.project.name.endsWith("-dark")
      ? "dark"
      : "system";
  await page.addInitScript((value) => localStorage.setItem("rcodexmanager-style", value), preference);
  await page.goto("/");
  await expect(page.getByText("Profiles", { exact: true })).toBeVisible();
});

for (const name of ["设置", "新增 profile", "复制 profile", "编辑 profile"] as const) {
  test(`${name} uses the unified task dialog`, async ({ page }, testInfo) => {
    await openDialog(page, name);
    if (name === "设置") {
      const dialog = page.getByRole("dialog", { name: /设置/ });
      await dialog.getByRole("button", { name: "开始检查" }).click();
      await expect(dialog.getByText("核心功能可用", { exact: true })).toBeVisible();
      await expect(dialog.getByText(/正常 · .*提醒 · .*错误/)).toBeVisible();
    }
    await expectDialogAligned(page, name, testInfo);
  });
}
