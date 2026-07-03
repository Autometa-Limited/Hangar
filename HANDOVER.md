# Hangar — Project Handover & Context

A single place that explains **what this project is, how to run it, what's been customized, and how to work on it** — for a new teammate or an AI agent picking this up.

> Hangar is a self-hosted fork of the open-source [Plane](https://github.com/makeplane/plane) project-management tool, maintained by **Autometa Limited**. All work lives in **`Autometa-Limited/Hangar`** — never push to the upstream `makeplane/plane`.

---

## 1. Quick start — run the whole app

**Prerequisites (Windows dev machine):**
- **Docker Desktop** running (hosts the API + database).
- Portable **Node 22** at `D:\dev-ledger\node22` (must be on PATH for pnpm/dev).

**Easiest way — one click:**
1. Open **Docker Desktop**, wait until it's running.
2. Double-click **`start-hangar.bat`** in the repo root (only once).
3. Wait ~30–60s for the first compile. When you see `Local: http://localhost:3000/`, open **http://localhost:3000**.
4. Keep that window open while using the app. Close it (or Ctrl+C) to stop.

> The `.bat` guards against double-launch: if it says "already running", the app is already up — just open the URL.

**Manual way:**
```bash
# 1) API (Docker)
docker start project-management-setup-api-1

# 2) Web frontend (needs Node 22 on PATH)
cd apps/web
pnpm dev            # serves http://localhost:3000
```
`./dev.ps1` from the root starts every frontend app at once (web:3000, admin:3001, space:3002, live:3100).

**Always use `localhost`, not `127.0.0.1`** (CORS / auth cookies depend on it).

---

## 2. Architecture

| Part | Tech | Where |
|------|------|-------|
| **API** | Django REST, runs in Docker | `apps/api` (bind-mounted into container `project-management-setup-api-1`) |
| **Web** | React Router v7 + Vite + MobX + TS | `apps/web` — port **3000** |
| **Admin / god-mode** | React Router | `apps/admin` — port **3001** (`/god-mode`) |
| **Space** (public views) | React Router | `apps/space` — port **3002** |
| **Live** (realtime) | Node | `apps/live` — port **3100** |
| **Shared packages** | ui, propel (charts/buttons), i18n, types, constants | `packages/*` |

**Docker containers:** `...-api-1`, `-worker-1`, `-beat-worker-1`, `-plane-mq-1`, `-plane-db-1` (Postgres :5432), `-plane-minio-1` (files), `-plane-redis-1` (:6379). The API takes ~30s on boot to serve 200 (runs entrypoint → cache clear → runserver).

**Routing note (frontend):** routes are registered **explicitly** in `apps/web/app/routes/core.ts` (the parenthesized folders like `(all)`, `(detail)` are just grouping — they do NOT auto-route). To add a page you must add a `route(...)` entry there.

---

## 3. Workspace, instance & deployment

- The workspace URL slug is **`autometa`** → `http://localhost:3000/autometa/...`
  - (It was renamed from `maryam-workspace` directly in the DB — `workspaces.slug`. The display name is "Autometa workspace".)
- **"Instance"** = the whole deployment (server) hosting Hangar. Right now the instance is the local dev machine. One instance can host many workspaces.
- **On deploy:** `localhost:3000` becomes a real domain (suggested: **`hangar.autometa.dev`** or a function-name like `delivery.autometa.dev`). The `/autometa/...` part stays; only the host changes. Point a DNS A/CNAME record at the server. Data moves from the local Docker Postgres/MinIO to the server's.

---

## 4. Access model (roles) — built-in, no custom code

**Workspace level:** Owner (1, the creator) · Admin (many, near-Owner powers) · Member (sees only their projects) · Guest (very limited).
- Only the Owner can delete the workspace or transfer ownership. Multiple Admins are allowed; **only one Owner**.

**Project level:** each project has its own members and its own roles — **Admin** (project lead: manage members, settings, assign work) · **Member** (create/edit work items) · **Commenter** (view + comment) · **Guest** (view only).
- **Private** project → only its members see it. **Public** → all workspace members see it.

**Typical setup:** You = Workspace **Owner**. Each project has a **lead = project Admin** + **Members**. Invite people as workspace **Members** (not Admin, or they'd see everything), then make the lead a project Admin inside their project.

**MCP / API access** follows the token owner's role — a member's API token only exposes what their role allows. Never share an admin token.

---

## 5. What's been customized in this fork

- **Branding:** Plane → Hangar across web/admin/space, emails, README, API metadata. Plane credited (AGPL) in README footer.
- **Auth:** sign-up is **Google-only** (email/password form hidden).
- **Standup feature (custom):** project-level daily standup — see §7.
- **`start-hangar.bat`:** one-click launcher (machine-specific absolute paths, mirrors `dev.ps1`).
- **Removed:** an earlier in-app "Ask AI for help" widget/endpoint was added then removed per request.
- **AI editor:** supports OpenRouter/Claude via base_url routing (editor completions), gated on instance LLM config.

**Not present (Plane paid/EE features, absent from this community fork):** workspace-level **Wiki**, **OKRs/KPIs**, **Retros**. Their code lives in Plane's private `ee/` repo and cannot be unlocked here — they'd have to be custom-built. (Project-level **Pages** is the CE equivalent of a wiki.)

---

## 6. How to work on this repo (workflow rules)

1. **Never commit directly to `preview`.** Create a feature branch first: `git checkout -b feature/<short-desc>`.
2. Commit + push to that branch.
3. Open a PR into `preview`: `gh pr create --base preview --head <branch> --repo Autometa-Limited/Hangar`.
4. Merge via the PR.
5. **Only** push to `origin` = `Autometa-Limited/Hangar`. Never the upstream `makeplane/plane`.
6. **No AI attribution** in commit messages or PR bodies (no "Generated with Claude Code", no `Co-Authored-By: Claude`).

**Pre-commit hook** needs `pnpm` on PATH (Node 22), or it fails with `pnpm: command not found`. Type-check the frontend with `pnpm --dir apps/web check:types`.

---

## 7. Standup feature (custom) — reference

- **UI:** each project has a **Standups** tab (sidebar). A member picks work items ("Add tasks"), toggles **Worked yesterday** / **Working today** per task, and Saves. Shows a team board + a bar chart of who's working on what today.
- **Backend:** models `StandupUpdate` + `StandupTask` (`apps/api/plane/db/models/standup.py`), endpoint `GET/POST /api/workspaces/<slug>/projects/<project_id>/standup/`, migration `0122_standupupdate_standuptask_and_more`.
- **Frontend:** route `apps/web/app/(all)/[workspaceSlug]/(projects)/projects/(detail)/[projectId]/standups/`, component `apps/web/core/components/standup/standup-view.tsx`, service `apps/web/core/services/standup.service.ts`, nav item in `project-navigation.tsx`, i18n key `sidebar.standups`.

---

## 8. MCP (Claude Code ↔ Hangar)

Configured in `~/.claude.json` under an MCP server named `hangar`, using env: `PLANE_API_KEY`, `PLANE_BASE_URL`, `PLANE_WORKSPACE_SLUG` (= **`autometa`**). If the slug changes, update all three occurrences there and restart Claude Code.

---

## 9. Secrets — where they live (never commit)

- API secrets: `apps/api/.env` (gitignored) — Postgres creds, LLM keys, SMTP, etc.
- Web local env: `apps/web/.env.local` (gitignored).
- Do **not** print secrets in chat or commit them. If a credential leaks, rotate it.

---

## 10. Handy commands

```bash
# API logs / shell
docker logs -f project-management-setup-api-1
docker exec -it project-management-setup-api-1 python manage.py shell

# DB
docker exec -it project-management-setup-plane-db-1 psql -U plane -d plane

# migrations
docker exec project-management-setup-api-1 python manage.py makemigrations
docker exec project-management-setup-api-1 python manage.py migrate

# frontend
cd apps/web && pnpm dev              # run
cd apps/web && pnpm check:types      # typecheck
```

---

## 11. Notes for the next AI agent (gotchas & conventions)

Read this before making changes — these are the things that cost time to learn.

### Running the app from an agent shell
- **Processes spawned from a tool shell die when the tool call ends** (job-object teardown). A foreground `pnpm dev` will not survive.
  - Use a **background** run (persists across turns) to bring the web server up, then poll `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/` until `200`.
  - Do **not** launch via WMI `Win32_Process.Create` — it runs in Windows session 0 and `pnpm dev` misbehaves there.
  - For the human user, the durable path is double-clicking `start-hangar.bat` in their own desktop session.
- **Node 22 must be on PATH:** `export PATH="/d/dev-ledger/node22:$PATH"`. `pnpm` (11.3.0) lives at `D:\dev-ledger\node22\pnpm.cmd` — NOT in `node_modules`.
- Set `HUSKY=0` and `npm_config_verify_deps_before_run=false` for dev/commits to avoid hook/reinstall friction.
- The API container reloads Python changes automatically (bind mount). After boot it takes ~30s before it serves 200.

### Adding a BACKEND feature (Django) — the pattern (see the Standup feature as a worked example)
1. **Model** in `apps/api/plane/db/models/<name>.py` — extend `ProjectBaseModel` (gives `project`, `workspace` auto-set on save, uuid `id`, timestamps, soft-delete `deleted_at`). Register it in `apps/api/plane/db/models/__init__.py`.
2. **Serializer** in `apps/api/plane/app/serializers/<name>.py`, extend `BaseSerializer`; register in that package's `__init__.py`.
3. **View** in `apps/api/plane/app/views/<name>/base.py` — `from .. import BaseAPIView` / `BaseViewSet`; gate methods with `@allow_permission(allowed_roles=[ROLE.ADMIN, ROLE.MEMBER], level="PROJECT")`. Register in `apps/api/plane/app/views/__init__.py`.
4. **URL** in `apps/api/plane/app/urls/<name>.py`, and wire it into `apps/api/plane/app/urls/__init__.py` (both the import and the `*<name>_urls` spread).
5. **Migration:** `docker exec project-management-setup-api-1 python manage.py makemigrations db` then `... migrate db`. `bulk_create` bypasses `save()`, so set `workspace_id` manually on ProjectBaseModel rows.
6. **Verify at runtime** via Django shell (`manage.py shell`) — create → serialize → cleanup — because `manage.py check` won't catch serializer/method runtime errors.

### Adding a FRONTEND page (React Router v7)
- Routes are **explicit** in `apps/web/app/routes/core.ts` — add a `layout(...)` + `route(...)` entry. The `(all)`/`(detail)` folders are just grouping.
- A route folder typically has `layout.tsx` (AppHeader + ContentWrapper + `<Outlet/>`), `page.tsx` (default export wrapped in `observer()`, params typed via `import type { Route } from "./+types/page"`), `header.tsx`, `mobile-header.tsx`. The `+types/*` are **auto-generated** by `react-router typegen` (runs inside `check:types`) — don't hand-write them.
- **Sidebar nav:** project items live in `apps/web/core/components/workspace/sidebar/project-navigation.tsx` (`baseNavigation`). Each item needs an `i18n_key` whose value must exist in `packages/i18n/src/locales/en/navigation.json` under `sidebar` (else the raw key shows). `shouldRender` gates visibility; `sortOrder` orders it (floats like `3.5` are fine to slot between existing items).
- **Services:** extend `APIService` (`apps/web/core/services/api.service.ts`), `super(API_BASE_URL)`, methods return `response?.data` and rethrow `error?.response?.data`.
- **Current user:** `const { data: currentUser } = useUser();` from `@/hooks/store/user`.
- **Charts:** use `@plane/propel/charts/{bar,area,line,pie}-chart` — do NOT import `recharts` directly. Copy an existing usage (e.g. `apps/web/core/components/analytics/work-items/priority-chart.tsx`). `TBarItem` requires `key,label,stackId,fill,textClassName`.
- **Buttons:** `@plane/propel/button` variants are only `primary | secondary | tertiary | ghost | link | error-fill | error-outline` (there is **no** `neutral-primary`). Props include `loading`, `prependIcon`, `appendIcon`; sizes `sm|base|lg|xl`.
- **Toasts/UI:** `import { TOAST_TYPE, setToast } from "@plane/propel/toast";`, `import { Avatar } from "@plane/ui";`.
- **Work-item picker (reusable):** `ExistingIssuesListModal` (`@/components/core/modals/existing-issues-list-modal`) — search & multi-select issues; `handleOnSubmit(data: ISearchIssueResponse[])`.
- **Always run `pnpm --dir apps/web check:types`** — the Vite dev server uses esbuild and does NOT type-check, so type errors only surface here.

### Community-vs-Enterprise split
- Files under `apps/web/ce/...` are Community stubs; Plane's private repo has parallel `ee/...` implementations. Seeing a name/route referenced (e.g. `wiki`, `isWikiPath`) does **not** mean the feature exists — the real code may be EE-only. Verify a route actually exists in `routes/core.ts` and a backend model/endpoint exists before assuming a feature is present.

### Open items / TODO (as of this handover, 2026-07)
- **Rotate** any leaked Gmail app password; keep `OpenRouter` credits topped up if using AI editor completions.
- **Not built (optional future work):** workspace-level **Wiki**, **OKRs + KPI contributions** (the Standup reference screenshot showed KPI Contributions — intentionally omitted since no OKR system exists), **Retros**.
- The Standup feature is an MVP (project-level, manual task selection). Possible follow-ups: reminders, history/trend charts, per-task status editing inline.

