import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.removeItem("rcodexmanager-profile-sort");
    localStorage.removeItem("rcodexmanager-active-profile");
  });
  await page.reload();
  await expect(page.locator(".profile-card").first()).toBeVisible();
});

test("remembers local profile sorting and selection", async ({ page }, testInfo) => {
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

  await page.reload();
  await expect(page.locator(".profile-card").first()).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Profile 排序" })).toContainText("最近使用");
  await expect(page.locator(".profile-card.selected")).toContainText("codex-g");

});

test("sorts category and usage columns in both directions", async ({ page }) => {
  const categorySort = page.getByRole("button", { name: "分类 升序" });
  await categorySort.click();
  await expect(page.getByRole("button", { name: "分类 升序" })).toBeVisible();
  await expect(page.locator('[role="columnheader"]').filter({ has: page.getByRole("button", { name: "分类 升序" }) }))
    .toHaveAttribute("aria-sort", "ascending");

  await page.getByRole("button", { name: "分类 升序" }).click();
  await expect(page.getByRole("button", { name: "分类 降序" })).toBeVisible();
  await expect(page.locator('[role="columnheader"]').filter({ has: page.getByRole("button", { name: "分类 降序" }) }))
    .toHaveAttribute("aria-sort", "descending");

  await page.getByRole("button", { name: "查询当前列表额度" }).click();
  await expect(page.locator(".profile-quota-values").first()).toBeVisible();
  const usageSort = page.getByRole("button", { name: "额度 升序" });
  await usageSort.click();
  await expect(page.getByRole("button", { name: "额度 升序" })).toBeVisible();
  await expect(page.locator('[role="columnheader"]').filter({ has: page.getByRole("button", { name: "额度 升序" }) }))
    .toHaveAttribute("aria-sort", "ascending");

  await page.getByRole("button", { name: "额度 升序" }).click();
  await expect(page.getByRole("button", { name: "额度 降序" })).toBeVisible();
  await expect(page.locator('[role="columnheader"]').filter({ has: page.getByRole("button", { name: "额度 降序" }) }))
    .toHaveAttribute("aria-sort", "descending");
});
