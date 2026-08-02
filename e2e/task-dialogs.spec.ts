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
  const profile = page.locator(".profile-card").first();
  await profile.getByRole("button", { name: /更多/ }).click();
  await page
    .getByRole("menuitem", { name: name === "复制 profile" ? "复制 Profile" : "编辑信息" })
    .click();
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
    if (name === "新增 profile") {
      const dialog = page.getByRole("dialog", { name: /新增 profile/ });
      await expect(dialog.getByText("身份与分类", { exact: true })).toBeVisible();
      await expect(dialog.getByText("模型与推理", { exact: true })).toBeVisible();
      await expect(dialog.getByText("工作区路径", { exact: true })).toBeVisible();
      await dialog.getByLabel("显示名称").fill("开发工作区");
      await expect(dialog.locator(".create-profile-preview-title")).toHaveText("开发工作区");
      await dialog.getByLabel("启动命令").fill("invalid");
      await expect(dialog.getByText("仅支持 codex-、小写字母、数字和连字符")).toBeVisible();
      await expect(dialog.getByRole("button", { name: "仅创建" })).toBeDisabled();
      await expect(dialog.getByRole("button", { name: "创建并登录" })).toBeDisabled();
      await dialog.getByLabel("启动命令").fill("codex-work");
      await expect(dialog.getByRole("button", { name: "仅创建" })).toBeEnabled();
      await expect(dialog.getByRole("button", { name: "创建并登录" })).toBeEnabled();
    }
    await expectDialogAligned(page, name, testInfo);
  });
}
