import { test, expect } from "@playwright/test";
import { WORKSPACE_SLUG } from "./fixtures";

/**
 * Authenticated branding guard for the Help menu. The Hangar rebrand removed the
 * upstream Plane help links (Documentation, Report a bug, Join our Forum) and the
 * GitHub/forum links. This opens the help popover and asserts what remains vs
 * what must stay gone — so a future merge can't quietly bring them back.
 */
test.describe("Help menu — Plane links removed (authenticated)", () => {
  test("popover keeps only the kept items and no Plane links", async ({ page }) => {
    await page.goto(`/${WORKSPACE_SLUG}/projects/`);
    await expect(page).not.toHaveURL(/sign-in/);

    // The trigger is an icon-only button (lucide help-circle). Open the popover.
    const helpButton = page.locator("button:has(svg.lucide-circle-help), button:has(svg.lucide-help-circle)").first();
    await expect(helpButton).toBeVisible({ timeout: 30_000 });
    await helpButton.click();

    // Kept items.
    await expect(page.getByText("Keyboard shortcuts", { exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("What's new?", { exact: true })).toBeVisible();

    // Removed Plane help items must be absent.
    await expect(page.getByText("Documentation", { exact: true })).toHaveCount(0);
    await expect(page.getByText(/report a bug/i)).toHaveCount(0);
    await expect(page.getByText(/forum/i)).toHaveCount(0);
    await expect(page.getByText(/discord/i)).toHaveCount(0);

    // No links to upstream Plane properties anywhere on the page.
    await expect(page.locator('a[href*="forum.plane.so"]')).toHaveCount(0);
    await expect(page.locator('a[href*="github.com/makeplane"]')).toHaveCount(0);
  });
});
