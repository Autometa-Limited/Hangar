# Hangar E2E Tests (Playwright)

End-to-end tests for the Hangar web app, written with [Playwright](https://playwright.dev).

This folder is **intentionally isolated from the pnpm workspace** — it has its own
`package.json` and `node_modules`, so installing Playwright never touches the
monorepo's lockfile or dependency graph.

## Prerequisites

The web app must be running locally before you run the tests:

```bash
# from the repo root
pnpm dev          # serves the web app on http://localhost:3000
```

> **Use `localhost`, not `127.0.0.1`.**
> The API only whitelists the `localhost:3000` origin (CORS). Opening the app via
> `127.0.0.1:3000` makes the `/api/instances/` request fail and the UI falls back
> to the "Looks like Hangar didn't start up correctly!" error screen.

## Setup

Run these once (from this `e2e/` folder):

```bash
cd e2e
npm install                     # installs @playwright/test
npx playwright install chromium # downloads the Chromium browser
```

## Seeding the test user

The **authenticated** tests log in as a seeded local user. Create it once against
the dev database with the helper script (idempotent — safe to re-run):

```bash
# from the repo root
docker exec -i project-management-setup-api-1 \
    python manage.py shell < e2e/seed-test-user.py
```

It creates:

| Field     | Value                                               |
| --------- | --------------------------------------------------- |
| email     | `e2e-tester@hangar.test`                            |
| password  | `E2eTest!Pass2026`                                  |
| workspace | `e2e-workspace` ("E2E Workspace"), admin, onboarded |

These match the defaults in `tests/fixtures.ts`. Override them via the `E2E_EMAIL`,
`E2E_PASSWORD`, and `E2E_WORKSPACE_SLUG` environment variables (and edit the script
to match) if you need different credentials.

## Running the tests

```bash
npm test            # run all tests, headless
npm run test:headed # run with a visible browser
npm run report      # open the HTML report from the last run
```

Target a different host with the `BASE_URL` environment variable:

```bash
BASE_URL=http://localhost:3000 npm test
```

## Project structure

```
e2e/
├── package.json               # isolated deps + npm scripts
├── playwright.config.ts       # baseURL, timeouts, projects (setup/branding/authed)
├── seed-test-user.py          # creates the seeded user/workspace for authed tests
├── tests/
│   ├── fixtures.ts            # shared test user / workspace slug / storage-state path
│   ├── auth.setup.ts          # logs in once, saves the authenticated state
│   ├── branding.spec.ts       # Hangar rebrand checks (public sign-in page)
│   ├── workspace.authed.spec.ts  # workspace shell loads for a logged-in user
│   └── project.authed.spec.ts    # create a project, then a work item in it
└── README.md
```

The suite is split into three Playwright **projects**:

- **setup** — runs `auth.setup.ts` once and saves the logged-in browser state.
- **branding** — public sign-in checks, no auth.
- **authed** — logged-in flows that reuse the saved state (depend on `setup`).

Run a subset with `--project`, e.g. `npx playwright test --project=branding`.

## What is covered

### Branding — `tests/branding.spec.ts` (public sign-in page, no login)

Guards against any Plane branding creeping back in:

| Test                                      | Asserts                                                          |
| ----------------------------------------- | ---------------------------------------------------------------- |
| document title is Hangar                  | `<title>` contains "Hangar"                                      |
| shows Hangar branding and no 'Plane' text | page body contains "Hangar", never "Plane"                       |
| Hangar lockup logo renders                | the header `<svg>` wordmark reads "Hangar"                       |
| no Terms of Service / Privacy Policy line | the removed legal copy is absent                                 |
| no '10,000+ teams' marketing footer       | the removed marketing footer is absent                           |
| favicon is the Hangar SVG                 | `<link rel="icon" type="image/svg+xml">` points to `favicon.svg` |

### Authenticated flows (require the seeded user)

| Test                                           | Asserts                                                                                                                                                   |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `workspace.authed.spec.ts` — workspace shell   | the projects page loads for a logged-in user (not the sign-in page)                                                                                       |
| `project.authed.spec.ts` — project + work item | create a project, open it, create a work item, see the success toast and the item in the list                                                             |
| `api-token.authed.spec.ts` — Connect to Claude | generating a personal access token surfaces the MCP "Connect to Claude Code" command (`claude mcp add hangar …`) built from the current workspace         |
| `help-menu.authed.spec.ts` — Plane links gone  | the help popover keeps Keyboard shortcuts / What's new? and drops Documentation, Report a bug, Forum, and `forum.plane.so` / `github.com/makeplane` links |

## Adding a new test

Create a `*.spec.ts` file under `tests/`:

```ts
import { test, expect } from "@playwright/test";

test("my new check", async ({ page }) => {
  await page.goto("/sign-in");
  await expect(page.getByText("Hangar").first()).toBeVisible();
});
```

Paths in `page.goto()` are resolved against `baseURL` (default
`http://localhost:3000`), so use app-relative paths like `/sign-in`.

## Troubleshooting

- **"Looks like Hangar didn't start up correctly!"** — the web app cannot reach
  the API. Confirm the backend is up (`curl http://localhost:8000/api/instances/`)
  and that you are testing against `localhost`, not `127.0.0.1`.
- **Timeouts waiting for "Hangar"** — make sure `pnpm dev` is running and the page
  finished its first compile (the very first load can take a couple of minutes).
