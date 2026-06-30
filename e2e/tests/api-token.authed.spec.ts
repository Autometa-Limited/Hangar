import { test, expect } from "@playwright/test";

/**
 * Authenticated flow: create a personal access token and assert the custom
 * "Connect to Claude Code" (MCP) helper renders the dynamically-built command.
 *
 * This guards the bespoke ConnectAgentCommand feature we added to the token
 * "Key created" screen — it only appears after a token is generated.
 */
test.describe("API token — Connect to Claude Code (authenticated)", () => {
  test.setTimeout(120_000);

  test("generating a token surfaces the MCP connect command", async ({ page }, testInfo) => {
    const tokenLabel = `e2e-mcp-${testInfo.workerIndex}${testInfo.retry}${process.pid % 1000}`;

    // The workspace path redirects to /settings/profile/api-tokens/.
    await page.goto("/settings/profile/api-tokens/");
    await expect(page).not.toHaveURL(/sign-in/);

    // Open the create-token modal.
    await page
      .getByRole("button", { name: /add access token/i })
      .first()
      .click();

    // Fill the token title (the @plane/ui Input doesn't forward name, so target
    // its placeholder — unique to the modal).
    const labelInput = page.getByPlaceholder("Title");
    await expect(labelInput).toBeVisible({ timeout: 15_000 });
    await labelInput.fill(tokenLabel);

    // Avoid the expiry-date dependency: switch the token to never expire. Click
    // the toggle by its switch role (the only switch on the page) — the visible
    // "Never expires" text also appears on existing token rows behind the modal.
    await page.getByRole("switch").first().click();

    // Generate the token.
    await page.getByRole("button", { name: /generate token/i }).click();

    // "Key created" screen with our ConnectAgentCommand.
    await expect(page.getByText(/key created/i)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/connect to claude code/i)).toBeVisible();

    // The built MCP command, scoped to the page so we match the <code> block.
    const body = page.locator("body");
    await expect(body).toContainText("claude mcp add hangar");
    await expect(body).toContainText("uvx plane-mcp-server stdio");
    // Carries the just-created workspace slug, not a hardcoded value.
    await expect(body).toContainText("PLANE_WORKSPACE_SLUG=e2e-workspace");
  });
});
