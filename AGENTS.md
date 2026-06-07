# AI Agent Developer Guide (AGENTS.md)

Welcome, AI Agent! This guide outlines the essential details of this repository to help you understand the architecture, commands, and development workflows.

---

## 1. Project Context
* **Purpose:** Sync crash and ANR errors from Google Play Console to GitHub Issues (one issue per unique problem).
* **Type:** JavaScript/TypeScript GitHub Action.
* **Runtime:** Node.js 24 (configured in [action.yml](./action.yml)).
* **Bundling:** Uses `@vercel/ncc` to compile and bundle the TypeScript code in [src/](./src) into [dist/](./dist) (which contains the entrypoint `dist/index.js`).

---

## 2. Key Commands
Run these commands from the repository root:
* **Build:** `npm run build` (compiles TS to bundled JS in `dist/`).
* **Test:** `npm test` (runs Vitest unit tests).
* **Lint:** `npm run lint` (runs ESLint).
* **Install:** `npm ci` (clean dependency install).

---

## 3. Important Quirks & Rules

> [!IMPORTANT]
> Keep the following constraints in mind when writing or modifying code:

1. **ESM Imports:** The project is configured as `"type": "module"` in [package.json](./package.json). When importing local files, you **must use the `.js` extension** (e.g., `import { parseConfig } from "./config.js"` instead of `./config`).
2. **CI and `dist/` handling:** 
   * The CI workflow in [.github/workflows/ci.yml](./.github/workflows/ci.yml) will **automatically compile and push** changes to `dist/` back to the branch for pushes to `main` and branch PRs in the same repository.
   * If a PR comes from a fork, the CI falls back to a verification check. In this case, the developer (or fork PR creator) must build and commit `dist/` locally.
3. **No ad-hoc label checks:** Be mindful of API rate limits. Refer to [docs/technical_analysis.md](./docs/technical_analysis.md) for architectural status and planned optimizations (like label caching).

---

## 4. Code Structure
* **[src/index.ts](./src/index.ts):** Application entry point and orchestrator.
* **[src/config.ts](./src/config.ts):** Input reading and configuration parsing.
* **[src/play-client.ts](./src/play-client.ts):** Google Play Developer Reporting API client.
* **[src/github-client.ts](./src/github-client.ts):** Octokit/GitHub API client.
* **[src/sync.ts](./src/sync.ts):** Synchronization logic (deduplication & closing of resolved issues).
* **[tests/](./tests):** Unit tests using Vitest (highly mocked API layers).
