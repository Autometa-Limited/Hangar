<br /><br />

<p align="center"><b>Hangar</b></p>
<p align="center"><b>Modern project management for all teams</b></p>

Hangar is an open-source project management tool to track work items, run cycles, and manage product roadmaps without the chaos of managing the tool itself. 🧘‍♀️

Hangar is built on top of the open-source [Plane](https://github.com/makeplane/plane) codebase and is maintained by [Autometa Limited](https://github.com/Autometa-Limited).

## 🚀 Running Hangar locally

Hangar runs with a Django REST API in Docker and a pnpm/Vite monorepo for the web apps.

**One-click start (Windows):**
Double-click **`start-hangar.bat`** in the project root. It starts the API container and the web app on <http://localhost:3000>. Keep that window open while you use the app.

**Manual start:**

```bash
# 1) Start the API (Docker)
docker start project-management-setup-api-1

# 2) Start the web frontend (needs Node 22 on PATH)
cd apps/web
pnpm dev            # serves http://localhost:3000
```

To start every frontend app (web:3000, admin:3001, space:3002, live:3100) at once, run `./dev.ps1` from the project root.

## 🌟 Features

- **Work Items** — Create and manage tasks with a rich text editor that supports file uploads, sub-properties, and cross-references.
- **Cycles** — Track team momentum with burn-down charts and other insights.
- **Modules** — Break complex projects into smaller, manageable modules.
- **Views** — Build filters to surface only the most relevant work items; save and share them.
- **Pages** — Capture and organize ideas with a rich text editor, complete with AI capabilities.
- **Analytics** — Real-time insights across your data to visualize trends and remove blockers.
- **AI help** — Built-in "Need help?" assistant powered by an LLM (configurable, incl. OpenRouter/Claude).

## 🛠️ Local development

See [CONTRIBUTING](./CONTRIBUTING.md).

## ⚙️ Built with

[![React Router](https://img.shields.io/badge/-React%20Router-CA4245?logo=react-router&style=for-the-badge&logoColor=white)](https://reactrouter.com/)
[![Django](https://img.shields.io/badge/Django-092E20?style=for-the-badge&logo=django&logoColor=green)](https://www.djangoproject.com/)
[![Node JS](https://img.shields.io/badge/node.js-339933?style=for-the-badge&logo=Node.js&logoColor=white)](https://nodejs.org/en)

## 🙏 Credits

Hangar is a fork of [Plane](https://github.com/makeplane/plane) by Plane Software, Inc. — huge thanks to the Plane team and its contributors for the open-source foundation this project builds on.

## License

This project is licensed under the [GNU Affero General Public License v3.0](./LICENSE.txt).

---

<p align="center">
  <sub>Special thanks to <a href="https://plane.so">Plane (plane.so)</a> — Hangar is built on Plane's open-source codebase. © Plane Software, Inc. Original source used under the terms of the AGPL-3.0 license.</sub>
</p>
