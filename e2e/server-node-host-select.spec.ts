import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Profiles", { exact: true })).toBeVisible();
});

test("server node form discovers SSH aliases and keeps manual input", async ({ page }) => {
  await page.getByRole("button", { name: /服务器节点/ }).click();
  const managerDialog = page.getByRole("dialog", { name: /服务器节点/ });
  await managerDialog.getByRole("button", { name: "新增服务器节点" }).click();

  const formDialog = page.getByRole("dialog", { name: "新增服务器节点" });
  const hostInput = formDialog.getByLabel("SSH 主机");
  await expect(hostInput).toBeVisible();
  await expect(formDialog.getByLabel("远端 CLI")).not.toBeVisible();

  await hostInput.click();
  await expect(page.getByRole("option", { name: /demo-server/ })).toContainText("admin@203.0.113.10");
  await page.getByRole("option", { name: /demo-server/ }).click();
  await expect(hostInput).toHaveValue("demo-server");
  await expect(formDialog.getByLabel("名称")).toHaveValue("demo-server");

  await formDialog.getByRole("button", { name: "高级设置" }).click();
  await expect(formDialog.getByLabel("远端 CLI")).toHaveValue("rcodexmanager");

  await hostInput.fill("admin@example.com");
  await expect(hostInput).toHaveValue("admin@example.com");
  await expect(formDialog.getByRole("button", { name: "保存并检查" })).toBeEnabled();

  const layout = await formDialog.evaluate((node) => ({
    clientWidth: node.clientWidth,
    scrollWidth: node.scrollWidth,
  }));
  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth + 1);
});
