import { test, expect } from "@playwright/test";
import { WORKSPACE_SLUG } from "./fixtures";

/**
 * Authenticated smoke test: the workspace shell loads for a logged-in user
 * (reuses the saved auth state; never sees the sign-in page).
 */
test.describe("Workspace shell (authenticated)", () => {
  test("projects page loads the workspace, not the sign-in screen", async ({ page }) => {
    await page.goto(`/${WORKSPACE_SLUG}/projects/`);

    // Must stay authenticated.
    await expect(page).not.toHaveURL(/sign-in/);
    await expect(page.getByText(/sign in with google/i)).toHaveCount(0);

    // Workspace chrome is present.
    await expect(page.getByText("E2E Workspace").first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("button", { name: /add project/i }).first()).toBeVisible();
  });
});
