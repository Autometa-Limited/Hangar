import { test, expect } from "@playwright/test";

/**
 * Verifies the Hangar rebrand on the public sign-in page (no auth required).
 * Guards against any Plane branding regressing back into the auth screens.
 */
test.describe("Hangar branding — sign-in page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/sign-in", { waitUntil: "domcontentloaded" });
    // Wait until the client-rendered content shows up (any "Hangar" text).
    await expect(page.getByText("Hangar").first()).toBeVisible({ timeout: 20_000 });
  });

  test("document title is Hangar", async ({ page }) => {
    await expect(page).toHaveTitle(/Hangar/);
  });

  test("shows Hangar branding and no 'Plane' text", async ({ page }) => {
    const body = await page.locator("body").innerText();
    expect(body).toContain("Hangar");
    expect(body).not.toContain("Plane");
  });

  test("Hangar lockup logo renders (SVG wordmark)", async ({ page }) => {
    // PlaneLockup now renders an inline <svg> containing the text "Hangar".
    const svgTexts = await page.locator("svg text").allTextContents();
    expect(svgTexts).toContain("Hangar");
  });

  test("no Terms of Service / Privacy Policy legal line", async ({ page }) => {
    const body = await page.locator("body").innerText();
    expect(body).not.toMatch(/Terms of Service/i);
    expect(body).not.toMatch(/Privacy Policy/i);
  });

  test("no '10,000+ teams' marketing footer", async ({ page }) => {
    const body = await page.locator("body").innerText();
    expect(body).not.toMatch(/10,?000\+?\s*teams/i);
  });

  test("favicon is the Hangar SVG", async ({ page }) => {
    const href = await page.locator('link[rel="icon"][type="image/svg+xml"]').getAttribute("href");
    expect(href).toContain("favicon.svg");
  });
});
