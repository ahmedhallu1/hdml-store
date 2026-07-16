import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests. Require a configured .env.local (real Supabase project
 * with migrations + imported catalog). Run with: npm run e2e
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false, // order flow tests share state intentionally
  retries: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["iPhone 13"] } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:3000",
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
