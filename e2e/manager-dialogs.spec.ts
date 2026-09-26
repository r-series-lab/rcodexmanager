import { expect, test } from "@playwright/test";

const dialogs = ["会话中心", "认证库", "远程渠道", "模型路由"] as const;

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

for (const dialogName of dialogs) {
  test(`${dialogName} stays aligned`, async ({ page }, testInfo) => {
    await page.getByRole("button", { name: new RegExp(dialogName) }).click();
    const dialog = page.getByRole("dialog", { name: new RegExp(dialogName) });
    await expect(dialog).toBeVisible();

    if (dialogName === "远程渠道") {
      await dialog.getByRole("tab", { name: "飞书", exact: true }).click();
      await expect(dialog.getByText("飞书远程渠道", { exact: true })).toBeVisible();
    }

    const layout = await page.locator(".manager-shell-paper").evaluate((node) => {
      const rect = node.getBoundingClientRect();
      return {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        height: rect.height,
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
    expect(layout.height).toBeGreaterThanOrEqual(viewport!.height * 0.79);
    expect(layout.height).toBeLessThanOrEqual(viewport!.height * 0.81);
    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth + 1);

    const masterPanel = dialog.locator(".manager-master-panel");
    await expect(masterPanel).toBeVisible();
    const masterLayout = await masterPanel.evaluate((node) => {
      const style = window.getComputedStyle(node);
      return {
        clientWidth: node.clientWidth,
        scrollWidth: node.scrollWidth,
        overflowX: style.overflowX,
        overflowY: style.overflowY,
      };
    });
    expect(masterLayout.overflowX).toBe("hidden");
    expect(masterLayout.overflowY).toBe("auto");
    expect(masterLayout.scrollWidth).toBeLessThanOrEqual(masterLayout.clientWidth + 1);

    await page.screenshot({
      path: `test-results/playwright/${testInfo.project.name}-${dialogName}.png`,
      animations: "disabled",
    });
    await page.getByRole("button", { name: "关闭", exact: true }).click();
    await expect(dialog).not.toBeVisible();
  });
}
