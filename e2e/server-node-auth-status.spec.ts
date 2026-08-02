import { expect, test } from "@playwright/test";

test("server profiles show refresh-required credentials and support an online check", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Profiles", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "打开服务器节点" }).click();
  const dialog = page.getByRole("dialog", { name: /服务器节点/ });
  await dialog.getByRole("tab", { name: /Profiles/ }).click();

  const refreshRow = dialog.locator(".server-profile-row").filter({ hasText: "codex-o" });
  await expect(refreshRow).toContainText("待刷新");
  await refreshRow.click();

  const inspector = dialog.locator(".server-profile-inspector");
  await expect(inspector).toContainText("认证状态");
  await expect(inspector).toContainText("存在 refresh token");

  const inspectorGeometry = await inspector.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(inspectorGeometry.scrollWidth).toBeLessThanOrEqual(inspectorGeometry.clientWidth + 1);

  const authAlert = inspector.locator(".MuiAlert-root").filter({ hasText: "存在 refresh token" });
  const alertGeometry = await authAlert.evaluate((element) => {
    const message = element.querySelector(".MuiAlert-message");
    const alertRect = element.getBoundingClientRect();
    const messageRect = message?.getBoundingClientRect();
    return {
      alertTop: alertRect.top,
      alertBottom: alertRect.bottom,
      messageTop: messageRect?.top ?? 0,
      messageBottom: messageRect?.bottom ?? 0,
    };
  });
  expect(alertGeometry.messageTop).toBeGreaterThanOrEqual(alertGeometry.alertTop - 1);
  expect(alertGeometry.messageBottom).toBeLessThanOrEqual(alertGeometry.alertBottom + 1);

  await inspector.getByRole("button", { name: "验证认证" }).click();
  await expect(refreshRow).toContainText("已验证");
  await expect(inspector).toContainText("已验证");
});
