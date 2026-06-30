import { defineConfig, devices } from "@playwright/test";
import { STORAGE_STATE } from "./tests/fixtures";

/**
 * Hangar E2E config. Targets the locally-running web app (pnpm dev on :3000).
 * Override the target with BASE_URL when needed.
 *
 * Projects:
 *  - setup    : logs in once, saves the authenticated state.
 *  - branding : public sign-in page checks (no auth).
 *  - authed   : logged-in flows, reuse the saved state (depend on setup).
 */
export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.BASE_URL || "http://localhost:3000",
    headless: true,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "branding",
      testMatch: /branding\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "authed",
      testMatch: /\.authed\.spec\.ts/,
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"], storageState: STORAGE_STATE },
    },
  ],
});
