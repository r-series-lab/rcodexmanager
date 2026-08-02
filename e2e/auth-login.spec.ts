import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Profiles", { exact: true })).toBeVisible();
});

test("local profile exposes the browser authorization URL without leaving the app", async ({ page }) => {
  const profile = page.locator(".profile-card").first();
  await profile.getByRole("button", { name: /更多/ }).click();
  await page.getByRole("menuitem", { name: /刷新认证|登录 Profile/ }).click();
  const login = page.getByRole("dialog", { name: /刷新认证|登录 Profile/ });

  await login.getByRole("button", { name: "生成授权链接" }).click();
  await expect(login.getByText("auth.openai.com/oauth/authorize")).toBeVisible();
  await expect(login.getByRole("button", { name: "复制链接" })).toBeVisible();
  await expect(login.getByRole("button", { name: "打开授权页" })).toBeVisible();
  await login.getByRole("button", { name: "取消登录" }).click();
  await expect(login).not.toBeVisible();
});

test("new profile can continue directly into authorization or stop after creation", async ({ page }) => {
  await page.getByRole("button", { name: "新增 profile" }).click();
  let createDialog = page.getByRole("dialog", { name: /新增 profile/ });
  await createDialog.getByLabel("启动命令").fill("codex-e2e-skip");
  await createDialog.getByRole("button", { name: "仅创建" }).click();
  await expect(createDialog).not.toBeVisible();
  await expect(page.getByRole("dialog", { name: /登录 Profile/ })).toHaveCount(0);

  await page.getByRole("button", { name: "新增 profile" }).click();
  createDialog = page.getByRole("dialog", { name: /新增 profile/ });
  await createDialog.getByLabel("启动命令").fill("codex-e2e-login");
  await createDialog.getByLabel("显示名称").fill("认证测试");
  await createDialog.getByRole("button", { name: "创建并登录" }).click();

  const login = page.getByRole("dialog", { name: /登录 Profile/ });
  await expect(login).toBeVisible();
  await expect(login.getByText("认证测试", { exact: true })).toBeVisible();
  await login.getByRole("button", { name: "生成授权链接" }).click();
  await expect(login.getByRole("button", { name: "复制链接" })).toBeVisible();
  await expect(login.getByRole("button", { name: "打开授权页" })).toBeVisible();
  await login.getByRole("button", { name: "取消登录" }).click();
});

test("server profile uses a copyable device code", async ({ page }) => {
  await page.getByRole("button", { name: "打开服务器节点" }).click();
  const serverDialog = page.getByRole("dialog", { name: /服务器节点/ });
  await serverDialog.getByRole("tab", { name: /Profiles/ }).click();
  await serverDialog.locator(".server-profile-row").filter({ hasText: "codex-o" }).click();
  await serverDialog.locator(".server-profile-inspector").getByRole("button", { name: "刷新认证" }).click();

  const login = page.getByRole("dialog", { name: "刷新认证" });
  await login.getByRole("button", { name: "生成设备码" }).click();
  await expect(login.getByText("DEMO-CODE1")).toBeVisible();
  await expect(login.getByText("auth.openai.com/codex/device")).toBeVisible();
  await expect(login.getByRole("button", { name: "复制代码" })).toBeVisible();

  const geometry = await login.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);
});
