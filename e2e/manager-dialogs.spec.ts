import { expect, test } from "@playwright/test";

const dialogs = ["会话中心", "认证库", "远程渠道", "模型路由", "服务器节点"] as const;

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

    if (dialogName === "服务器节点") {
      await expect(dialog.getByText("可用", { exact: true }).first()).toBeVisible();
      await dialog.getByRole("tab", { name: /Profiles/ }).click();
      await expect(dialog.getByText("服务器默认", { exact: true }).first()).toBeVisible();
      await dialog.getByRole("button", { name: "从本机同步" }).click();
      const syncDialog = page.getByRole("dialog", { name: "从本机同步 Profile" });
      await expect(syncDialog).toBeVisible();
      await expect(syncDialog.getByLabel("本机 Profile")).toBeVisible();
      await syncDialog.getByLabel("服务器 Profile 名称").fill("codex-e2e-sync");
      await expect(syncDialog.getByRole("button", { name: "同步到服务器" })).toBeEnabled();
      await syncDialog.getByRole("button", { name: "取消" }).click();
      await expect(syncDialog).not.toBeVisible();
      await dialog.locator(".server-profile-row").filter({ hasText: "codex-o" }).click();
      await dialog.getByRole("button", { name: "配置模型" }).click();
      const modelDialog = page.getByRole("dialog", { name: "配置服务器模型" });
      await expect(modelDialog).toBeVisible();
      await modelDialog.getByLabel("模型").fill("custom-server-model");
      await modelDialog.getByRole("button", { name: "应用模型" }).click();
      const modelConfirm = page.getByRole("dialog", { name: /更新 codex-/ });
      await expect(modelConfirm).toContainText("custom-server-model");
      await modelConfirm.getByRole("button", { name: "取消" }).click();
      await page.screenshot({
        path: `test-results/playwright/${testInfo.project.name}-服务器模型配置.png`,
        animations: "disabled",
      });
      await modelDialog.getByRole("button", { name: "取消" }).click();
      await dialog.getByRole("tab", { name: "会话", exact: true }).click();
      await expect(dialog.getByText("rTerm", { exact: true }).first()).toBeVisible();
      await dialog.getByRole("tab", { name: "认证", exact: true }).click();
      await expect(dialog.getByText("服务器认证备份", { exact: true })).toBeVisible();
      await dialog.getByRole("tab", { name: "路由", exact: true }).click();
      await expect(dialog.getByLabel("Provider 预设")).toBeVisible();
      await dialog.getByRole("tab", { name: "渠道", exact: true }).click();
      await expect(dialog.getByText("微信桥接", { exact: true })).toBeVisible();
      await dialog.getByRole("tab", { name: "诊断", exact: true }).click();
      await expect(dialog.getByText(/服务器核心功能可用|服务器存在需要处理的问题/)).toBeVisible();
      await expect(dialog.locator(".server-node-task-strip")).toContainText("运行服务器诊断");
      await expect(dialog.locator(".server-node-task-strip code")).toContainText("任务");
      await dialog.getByRole("button", { name: "查看最近任务" }).click();
      await expect(dialog.locator(".server-node-task-history")).toBeVisible();
      await expect(dialog.locator(".server-node-task-row")).toHaveCount(7);
      await expect(dialog.getByRole("button", { name: "重试 运行服务器诊断" })).toBeVisible();
    }

    const layout = await page.locator(".manager-shell-paper").evaluate((node) => {
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
