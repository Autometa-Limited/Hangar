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

  // Step 1 — email. The sign-in brand is an SVG wordmark (not selectable as
  // text), so gate on the email input being ready instead.
  const emailInput = page.getByRole("textbox").first();
  await expect(emailInput).toBeVisible({ timeout: 30_000 });
  await emailInput.fill(TEST_USER.email);
  await page
    .getByRole("button", { name: /continue/i })
    .first()
    .click();

  // Step 2 — password
  const passwordInput = page.locator('input[type="password"]').first();
  await expect(passwordInput).toBeVisible({ timeout: 20_000 });
  await passwordInput.fill(TEST_USER.password);
  await page
    .getByRole("button", { name: /continue|sign in|log in/i })
    .first()
    .click();

  // A successful login sets the session cookie immediately. The app's own
  // client-side redirect to the workspace can lag well behind that, so gate on
  // the cookie rather than racing the SPA navigation.
  await expect
    .poll(async () => (await page.context().cookies()).some((c) => c.name === "session-id"), {
      timeout: 30_000,
      message: "session-id cookie was never set — login failed",
    })
    .toBe(true);

  // With the session established, go straight to the workspace and confirm we
  // are authenticated (not bounced back to sign-in). Use "domcontentloaded" —
  // the app holds live connections open, so "networkidle" never settles.
  await page.goto(`/${WORKSPACE_SLUG}/projects/`, { waitUntil: "domcontentloaded" });
  await expect(page).not.toHaveURL(/sign-in/, { timeout: 30_000 });

  await page.context().storageState({ path: STORAGE_STATE });
});
