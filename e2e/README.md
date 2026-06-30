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
├── package.json          # isolated deps + npm scripts
├── playwright.config.ts  # baseURL, timeouts, chromium project
├── tests/
│   └── branding.spec.ts  # Hangar rebrand checks (sign-in page)
└── README.md
```

## What is covered

`tests/branding.spec.ts` runs against the **public sign-in page** (no login
required) and asserts the Hangar rebrand, guarding against any Plane branding
creeping back in:

| Test                                      | Asserts                                                          |
| ----------------------------------------- | ---------------------------------------------------------------- |
| document title is Hangar                  | `<title>` contains "Hangar"                                      |
| shows Hangar branding and no 'Plane' text | page body contains "Hangar", never "Plane"                       |
| Hangar lockup logo renders                | the header `<svg>` wordmark reads "Hangar"                       |
| no Terms of Service / Privacy Policy line | the removed legal copy is absent                                 |
| no '10,000+ teams' marketing footer       | the removed marketing footer is absent                           |
| favicon is the Hangar SVG                 | `<link rel="icon" type="image/svg+xml">` points to `favicon.svg` |

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
