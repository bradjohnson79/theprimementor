import { defineConfig, devices } from "@playwright/test";
import { ADMIN_STORAGE_STATE, DEFAULT_ADMIN_BASE } from "./e2e/helpers/adminAuth.ts";

const adminBase = process.env.PLAYWRIGHT_ADMIN_BASE_URL?.trim() || DEFAULT_ADMIN_BASE;
process.env.PLAYWRIGHT_ADMIN_BASE_URL = adminBase;

export default defineConfig({
  testDir: "./e2e",
  testMatch: /admin-ads.*\.spec\.ts/,
  timeout: 200_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  globalSetup: "./e2e/admin.global-setup.ts",
  use: {
    baseURL: adminBase,
    storageState: ADMIN_STORAGE_STATE,
    trace: "off",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: adminBase.includes("theprimementor.com")
    ? undefined
    : {
      command: "pnpm --filter @wisdom/admin exec vite --host 127.0.0.1 --port 5174",
      url: "http://127.0.0.1:5174",
      reuseExistingServer: true,
      timeout: 180_000,
    },
});
