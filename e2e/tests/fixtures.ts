/**
 * Shared test data. These reference a seeded local user — NOT a real credential.
 * Create it once against the dev DB (see e2e/README.md → "Seeding the test user").
 */
export const TEST_USER = {
  email: process.env.E2E_EMAIL || "e2e-tester@hangar.test",
  password: process.env.E2E_PASSWORD || "E2eTest!Pass2026",
};

export const WORKSPACE_SLUG = process.env.E2E_WORKSPACE_SLUG || "e2e-workspace";

/** Where the authenticated browser state is persisted by the setup project. */
export const STORAGE_STATE = ".auth/user.json";
