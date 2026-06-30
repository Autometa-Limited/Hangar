# Hangar E2E (Playwright)

End-to-end tests for the Hangar web app. This folder is **isolated from the pnpm
workspace** (its own `package.json` / `node_modules`) so it never touches the
monorepo lockfile.

## Prerequisites

The web app must be running locally:

```bash
# from the repo root
pnpm dev        # serves web on http://localhost:3000
```

> Use **`localhost`**, not `127.0.0.1` — the API only allows the `localhost:3000`
> origin (CORS), so `127.0.0.1:3000` renders the "didn't start up correctly" page.

## Setup

```bash
cd e2e
npm install
npx playwright install chromium
```

## Run

```bash
npm test                 # headless
npm run test:headed      # watch it in a browser
npm run report           # open the last HTML report
```

Override the target with `BASE_URL`:

```bash
BASE_URL=http://localhost:3000 npm test
```

## Tests

- `tests/branding.spec.ts` — verifies the Hangar rebrand on the public sign-in
  page (title, lockup wordmark, favicon, and the absence of any Plane branding,
  the legal Terms/Privacy line, and the "10,000+ teams" marketing footer).
