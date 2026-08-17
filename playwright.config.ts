import { join } from "node:path";
import { defineConfig } from "@playwright/test";

const webPort = 5273;
const apiPort = 3101;

export default defineConfig({
  testDir: "tests/e2e",
  testMatch: "**/*.e2e.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${webPort}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm start -- --no-open",
    url: `http://localhost:${webPort}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      GCA_WEB_PORT: String(webPort),
      GCA_API_PORT: String(apiPort),
      GCA_DATABASE_PATH: join(process.cwd(), "apps/server/data/playwright.sqlite"),
    },
  },
});
