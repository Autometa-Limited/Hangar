import { test, expect } from "@playwright/test";
import { WORKSPACE_SLUG } from "./fixtures";

/**
 * Authenticated flow: create a project, then create a work item inside it.
 *
 * Reuses the saved auth state (see auth.setup.ts). Names are made unique per run
 * from the worker-injected timestamp so reruns don't collide on the project
 * identifier. Selectors lean on stable form `name` attributes (locale-proof);
 * button names come from the English UI.
 */

// Unique-ish suffix without Date.now() (kept deterministic per worker index).
function uniqueSuffix(testInfo: { workerIndex: number; retry: number }) {
  return `${testInfo.workerIndex}${testInfo.retry}${process.pid % 1000}`;
}

test.describe("Project & work item (authenticated)", () => {
  // Multi-step flow against a dev server: give it room beyond the 60s default.
  test.setTimeout(120_000);

  test("creates a project and a work item in it", async ({ page }, testInfo) => {
    const suffix = uniqueSuffix(testInfo);
    const projectName = `E2E Project ${suffix}`;
    // Identifier is auto-uppercased, max 10 chars, letters/digits only.
    const identifier = `E2E${suffix}`.toUpperCase().slice(0, 10);
    const itemTitle = `E2E work item ${suffix}`;

    await page.goto(`/${WORKSPACE_SLUG}/projects/`);
    await expect(page).not.toHaveURL(/sign-in/);

    // --- Create project -----------------------------------------------------
    await page
      .getByRole("button", { name: /add project|create new project/i })
      .first()
      .click();

    // The create-project modal: target fields by their stable name attributes.
    const nameInput = page.locator('input[name="name"]');
    await expect(nameInput.first()).toBeVisible({ timeout: 15_000 });
    await nameInput.first().fill(projectName);

    // Filling the name auto-fills the identifier; overwrite it to keep it unique.
    const identifierInput = page.locator('input[name="identifier"]');
    await identifierInput.fill(identifier);

    await page.getByRole("button", { name: /^create project$/i }).click();

    // Land on (or be able to open) the new project. The project name shows up in
    // the sidebar / header once created.
    await expect(page.getByText(projectName).first()).toBeVisible({ timeout: 30_000 });

    // Creation pops a "Projects and work items" feature modal. "Open project" is
    // a link (not a button); following it lands on the project's issues view,
    // which sets the project context the create-work-item modal needs.
    await page.getByRole("link", { name: /open project/i }).click();
    await page.waitForURL(/\/projects\/.*\/issues/, { timeout: 30_000 });
    // Let the project context settle before opening the modal, otherwise it can
    // open at workspace scope with no project pre-selected and the save no-ops.
    // (A fixed wait, not "networkidle" — the app holds live connections open.)
    await page.waitForTimeout(2500);

    // --- Create work item ---------------------------------------------------
    // Use the project-scoped CTA (not the workspace sidebar one) so the item is
    // created in THIS project — the empty state guarantees it for a fresh project.
    await page
      .getByRole("button", { name: /create your first work item|add work item/i })
      .first()
      .click();

    // Issue title input also uses name="name"; scope to the now-open issue modal.
    const titleInput = page.locator('input[name="name"]');
    await expect(titleInput.first()).toBeVisible({ timeout: 15_000 });
    await titleInput.first().fill(itemTitle);

    // Create-issue submit button reads "Save".
    await page
      .getByRole("button", { name: /^save$/i })
      .first()
      .click();

    // Authoritative success signal, then the item itself surfacing in the list.
    await expect(page.getByText(/work item created successfully/i)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(itemTitle).first()).toBeVisible({ timeout: 30_000 });
  });
});
