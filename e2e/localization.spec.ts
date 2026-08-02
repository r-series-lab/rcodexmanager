import { expect, test } from "@playwright/test";

test("language preference updates key workflows and persists", async ({ page }, testInfo) => {
  const preference = testInfo.project.name.endsWith("-dark") ? "dark" : "light";
  await page.addInitScript((value) => localStorage.setItem("rcodexmanager-style", value), preference);
  await page.goto("/");

  await page.getByRole("button", { name: "打开设置" }).click();
  const settings = page.getByRole("dialog", { name: /设置/ });
  await expect(settings.getByText("外观", { exact: true })).toBeVisible();
  await expect(settings.getByText("语言", { exact: true })).toBeVisible();

  await settings.getByRole("button", { name: "English" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en-US");

  const englishSettings = page.getByRole("dialog", { name: /Settings/ });
  await expect(englishSettings.getByText("Appearance", { exact: true })).toBeVisible();
  await expect(englishSettings.getByText("Language", { exact: true })).toBeVisible();
  await expect(englishSettings.getByText("Diagnostics", { exact: true })).toBeVisible();
  await expect(page.getByText("Codex profile workspace", { exact: true })).toBeVisible();
  await expect(page.getByText("Sessions", { exact: true })).toBeVisible();

  await page.screenshot({
    path: `test-results/playwright/${testInfo.project.name}-settings-en.png`,
    animations: "disabled",
  });

  await englishSettings.getByRole("button", { name: "Close" }).click();
  await expect(page.locator(".profile-list-header").getByText("Usage", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Query usage for this list" })).toBeVisible();
  await page.getByRole("button", { name: "New profile" }).click();
  const createProfile = page.getByRole("dialog", { name: /New profile/ });
  await expect(createProfile.getByText("Identity & category", { exact: true })).toBeVisible();
  await expect(createProfile.getByText("Model & reasoning", { exact: true })).toBeVisible();
  await expect(createProfile.getByRole("button", { name: "Create & sign in" })).toBeVisible();
  await createProfile.getByRole("button", { name: "Close" }).click();

  await page.locator(".profile-card-main").first().dblclick();
  const editProfile = page.getByRole("dialog", { name: /Edit profile/ });
  await expect(editProfile.getByText("Basic information", { exact: true })).toBeVisible();
  await expect(editProfile.getByText("Paths & runtime settings", { exact: true })).toBeVisible();
  await editProfile.getByRole("button", { name: "Close" }).click();

  await page.getByRole("button", { name: "Sessions", exact: true }).click();
  const sessions = page.getByRole("dialog", { name: /Sessions/ });
  await expect(sessions.getByPlaceholder("Search session titles or summaries")).toBeVisible();
  await sessions.getByRole("button", { name: "Close" }).click();

  await page.getByRole("button", { name: "Auth vault", exact: true }).click();
  const authVault = page.getByRole("dialog", { name: /Auth vault/ });
  await expect(authVault.getByPlaceholder("Search backups, accounts, or sources")).toBeVisible();
  await authVault.getByRole("button", { name: "Close" }).click();

  await page.getByRole("button", { name: "Remote channels", exact: true }).click();
  const remoteChannels = page.getByRole("dialog", { name: /Remote channels/ });
  await expect(remoteChannels.getByPlaceholder("Search profiles, instances, or accounts")).toBeVisible();
  await remoteChannels.getByRole("button", { name: "Close" }).click();

  await page.getByRole("button", { name: "Model routing", exact: true }).click();
  const modelRouting = page.getByRole("dialog", { name: /Model routing/ });
  await expect(modelRouting.getByPlaceholder("Search profiles, models, or route status")).toBeVisible();
  await modelRouting.getByRole("button", { name: "Close" }).click();

  await page.getByRole("button", { name: "Open server nodes" }).click();
  const serverNodes = page.getByRole("dialog", { name: /Server nodes/ });
  await expect(serverNodes.getByPlaceholder("Search server nodes")).toBeVisible();
  await serverNodes.getByRole("button", { name: "Close" }).click();

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en-US");
  await expect(page.getByRole("button", { name: "Open settings" })).toBeVisible();
});
