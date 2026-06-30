import { test as setup, expect } from "@playwright/test";
import { TEST_USER, WORKSPACE_SLUG, STORAGE_STATE } from "./fixtures";

/**
 * Logs in once via the email/password flow and saves the authenticated browser
 * state to STORAGE_STATE. Authed test projects reuse it instead of re-logging in.
 *
 * Requires the seeded test user (see README → "Seeding the test user").
 */
setup("authenticate", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Hangar").first()).toBeVisible({ timeout: 20_000 });

  // Step 1 — email
  await page.getByRole("textbox").first().fill(TEST_USER.email);
  await page
    .getByRole("button", { name: /continue/i })
    .first()
    .click();

  // Step 2 — password
  await page.locator('input[type="password"]').first().fill(TEST_USER.password);
  await page
    .getByRole("button", { name: /continue|sign in|log in/i })
    .first()
    .click();

  // Land on the workspace once authenticated.
  await page.waitForURL(new RegExp(`/${WORKSPACE_SLUG}`), { timeout: 25_000 });

  await page.context().storageState({ path: STORAGE_STATE });
});
