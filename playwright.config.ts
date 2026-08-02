import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./test-results/playwright",
  timeout: 45_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:1438",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop-light", use: { viewport: { width: 1440, height: 900 }, colorScheme: "light" } },
    { name: "default-light", use: { viewport: { width: 1000, height: 800 }, colorScheme: "light" } },
    { name: "default-dark", use: { viewport: { width: 1000, height: 800 }, colorScheme: "dark" } },
    { name: "minimum-system", use: { viewport: { width: 1000, height: 800 }, colorScheme: "light" } },
  ],
  webServer: {
    command: "npm run web:dev -- --host 127.0.0.1",
    url: "http://127.0.0.1:1438",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
