# Agent Plan: `android-vitals-issues` – GitHub Marketplace Action

## Oppgave

Bygg og publiser en gjenbrukbar GitHub Action som automatisk synkroniserer krasj- og ANR-feil
fra Google Play Developer Reporting API til GitHub Issues. Én issue per unikt problem, med
deduplicering via labels. Publiseres til GitHub Marketplace.

---

## Kontekst og designbeslutninger

| Parameter       | Valg                                                |
|-----------------|-----------------------------------------------------|
| Action-type     | Node.js action (`node20`)                           |
| Språk           | TypeScript, bundlet med `@vercel/ncc`               |
| Tester          | Vitest + mocked API-klienter                        |
| Versjonering    | Semantic versioning + flytende major-tag (`v1`)     |
| Deduplicering   | GitHub-labels som kilde til sannhet (ingen DB)      |
| Publisering     | GitHub Marketplace via `action.yml`-metadata        |

---

## Fase 1 – Scaffold repo

### Oppgaver

1. Opprett følgende katalogstruktur:

```
android-vitals-issues/
├── action.yml
├── package.json
├── tsconfig.json
├── .eslintrc.json
├── .gitignore
├── LICENSE              (MIT)
├── README.md            (placeholder, fylles ut i Fase 5)
├── CHANGELOG.md
├── src/
│   ├── index.ts         (entry point – kalles av action runtime)
│   ├── config.ts        (input-parsing og validering)
│   ├── play-client.ts   (Google Play Developer Reporting API)
│   ├── github-client.ts (GitHub REST API via @octokit/rest)
│   ├── sync.ts          (orkestreringslogikk)
│   └── types.ts         (delte TypeScript-typer)
├── tests/
│   ├── config.test.ts
│   ├── sync.test.ts
│   └── fixtures/
│       ├── error-issues.json
│       └── github-issues.json
└── .github/
    └── workflows/
        ├── ci.yml       (bygg + test på PR og push)
        └── release.yml  (auto-bygg dist/ og tag ved ny release)
```

2. Initialiser `package.json` med følgende avhengigheter:

```json
{
  "name": "android-vitals-issues",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "build": "ncc build src/index.ts -o dist --source-map --license licenses.txt",
    "test": "vitest run",
    "lint": "eslint src tests",
    "prepare": "npm run build"
  },
  "dependencies": {
    "@actions/core": "^1.10.1",
    "@actions/github": "^6.0.0",
    "googleapis": "^144.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@vercel/ncc": "^0.38.1",
    "typescript": "^5.4.0",
    "vitest": "^1.6.0"
  }
}
```

3. `tsconfig.json` med `"target": "ES2022"`, `"module": "commonjs"`, `"strict": true`.

### Suksesskriterier
- [ ] `npm install` kjører uten feil
- [ ] `npm run build` produserer `dist/index.js`

---

## Fase 2 – `action.yml`

Lag filen med følgende spesifikasjon:

```yaml
name: "Android Vitals → GitHub Issues"
description: "Sync crash and ANR errors from Google Play Console to GitHub Issues. One issue per unique problem."
author: "<DITT_GITHUB_BRUKERNAVN>"

branding:
  icon: "alert-triangle"
  color: "red"

inputs:
  service-account-json:
    description: "Google service account JSON key with Play Developer Reporting access"
    required: true

  package-names:
    description: "Comma-separated list of Android package names to monitor"
    required: true

  github-token:
    description: "GitHub token with issues:write permission"
    required: false
    default: ${{ github.token }}

  target-repo:
    description: "Target repo for issues (owner/repo). Defaults to the repo running the action."
    required: false
    default: ""

  package-repo-map:
    description: |
      JSON map from package name to GitHub repo (owner/repo).
      Used when monitoring multiple apps with different repos.
      Example: {"com.example.app1": "owner/repo1", "com.example.app2": "owner/repo2"}
    required: false
    default: "{}"

  label-prefix:
    description: "Prefix for deduplication labels"
    required: false
    default: "play-error:"

  extra-labels:
    description: "Comma-separated list of additional labels to add to created issues"
    required: false
    default: "play-console,crash"

  close-resolved:
    description: "Automatically close GitHub issues when Play Console marks the error as resolved"
    required: false
    default: "false"

  error-types:
    description: "Which error types to sync: CRASH, ANR, or ALL"
    required: false
    default: "ALL"

  min-affected-users:
    description: "Only create issues for errors affecting at least this many users"
    required: false
    default: "1"

outputs:
  issues-created:
    description: "Number of new GitHub issues created"
  issues-closed:
    description: "Number of GitHub issues closed (if close-resolved is true)"

runs:
  using: "node20"
  main: "dist/index.js"
```

---

## Fase 3 – Kjernekode

### `src/types.ts`

Definer typer for:
- `ActionConfig` – parsede inputs
- `ErrorIssue` – normalisert Play Console-problem
- `SyncResult` – resultat fra én sync-kjøring

```typescript
export interface ActionConfig {
  serviceAccountJson: object;
  packageNames: string[];
  packageRepoMap: Record<string, string>;
  defaultRepo: { owner: string; repo: string };
  githubToken: string;
  labelPrefix: string;
  extraLabels: string[];
  closeResolved: boolean;
  errorTypes: "CRASH" | "ANR" | "ALL";
  minAffectedUsers: number;
}

export interface ErrorIssue {
  id: string;           // Stabil ID fra Play Console
  packageName: string;
  type: "CRASH" | "ANR";
  cause: string;        // f.eks. "java.lang.IllegalStateException"
  location: string;     // f.eks. "com.example.MainActivity.onCreate"
  affectedUsers: number;
  eventCount: number;
  firstSeenVersion: string;
  lastSeenVersion: string;
  isResolved: boolean;
  playConsoleUrl: string;
}

export interface SyncResult {
  issuesCreated: number;
  issuesClosed: number;
  errors: string[];
}
```

### `src/config.ts`

- Les alle inputs via `@actions/core` (`core.getInput`)
- Parser `package-names` (split på komma, trim)
- Parser `package-repo-map` (JSON.parse med try/catch)
- Bestem `defaultRepo` fra `GITHUB_REPOSITORY`-env
- Kast `Error` med forklarende melding ved ugyldig input
- Eksporter `parseConfig(): ActionConfig`

### `src/play-client.ts`

Implementer `PlayReportingClient`-klasse:

```typescript
export class PlayReportingClient {
  constructor(serviceAccountJson: object) { /* ... */ }

  async fetchErrorIssues(packageName: string, filter: string): Promise<ErrorIssue[]>
  // Kaller: playdeveloperreporting.v1beta1.vitals.errors.issues.search
  // Paginerer automatisk (håndterer nextPageToken)
  // Mapper API-respons til ErrorIssue-typen
  // filter-eksempel: "errorIssueType = CRASH"

  private mapApiResponse(raw: any, packageName: string): ErrorIssue
  // Bygger playConsoleUrl:
  // https://play.google.com/console/developers/app/{packageName}/crashes
  // Trekker ut issue-ID fra resource name: apps/{pkg}/errorIssues/{id}
}
```

**Viktige detaljer:**
- Bruk `google.auth.GoogleAuth` med `credentials`-objekt (ikke fil)
- Scope: `https://www.googleapis.com/auth/playdeveloperreporting`
- Håndter 404 (app ikke funnet) og 403 (manglende tilgang) med forklarende feilmeldinger

### `src/github-client.ts`

Implementer `GitHubClient`-klasse:

```typescript
export class GitHubClient {
  constructor(token: string, owner: string, repo: string) { /* ... */ }

  async ensureLabel(name: string, color?: string): Promise<void>
  // Oppretter label hvis den ikke finnes, ignorerer "already exists"-feil

  async findIssueByLabel(label: string): Promise<{ number: number; state: string } | null>
  // Søker etter issues med state: "all" for å finne både åpne og lukkede

  async createIssue(issue: ErrorIssue, labels: string[]): Promise<number>
  // Returnerer issue-nummer
  // Tittel: "[CRASH] java.lang.IllegalStateException i MainActivity.onCreate"
  // Body: se mal under

  async closeIssue(issueNumber: number, comment: string): Promise<void>
  // Poster kommentar + setter state: "closed"
}
```

**Issue-body-mal** (Markdown):

```markdown
## {{type}} registrert i Google Play Console

| | |
|---|---|
| **Årsak** | `{{cause}}` |
| **Lokasjon** | `{{location}}` |
| **Berørte brukere** | {{affectedUsers}} |
| **Totale eventer** | {{eventCount}} |
| **Første sett i** | `{{firstSeenVersion}}` |
| **Sist sett i** | `{{lastSeenVersion}}` |
| **Pakkenavn** | `{{packageName}}` |

[🔗 Åpne i Play Console]({{playConsoleUrl}})

---
> *Automatisk opprettet av [android-vitals-issues](https://github.com/marketplace/actions/android-vitals-issues)*
> Play Console problem-ID: `{{id}}`
```

### `src/sync.ts`

Kjernefunksjonen:

```typescript
export async function syncApp(
  playClient: PlayReportingClient,
  githubClient: GitHubClient,
  packageName: string,
  config: ActionConfig
): Promise<{ created: number; closed: number }>
```

Algoritme:
1. Bygg filter-streng basert på `config.errorTypes`
2. Hent alle `ErrorIssue`s fra Play Console
3. Filtrer på `minAffectedUsers`
4. For hvert problem:
   a. Bygg deduplicerings-label: `${labelPrefix}${issue.id}`
   b. Sjekk om GitHub-issue allerede finnes med `findIssueByLabel`
   c. Hvis ikke: kall `createIssue` med alle labels
   d. Hvis `closeResolved` og issue er løst og GitHub-issue er åpen: lukk og kommenter
5. Returner teller

### `src/index.ts`

Entry point:

```typescript
import * as core from "@actions/core";
import { parseConfig } from "./config";
import { PlayReportingClient } from "./play-client";
import { GitHubClient } from "./github-client";
import { syncApp } from "./sync";

async function run(): Promise<void> {
  try {
    const config = parseConfig();
    const playClient = new PlayReportingClient(config.serviceAccountJson);

    let totalCreated = 0;
    let totalClosed = 0;

    for (const packageName of config.packageNames) {
      const repo = config.packageRepoMap[packageName] ?? null;
      const target = repo
        ? { owner: repo.split("/")[0], repo: repo.split("/")[1] }
        : config.defaultRepo;

      core.info(`🔍 Synkroniserer ${packageName} → ${target.owner}/${target.repo}`);

      const githubClient = new GitHubClient(config.githubToken, target.owner, target.repo);
      const result = await syncApp(playClient, githubClient, packageName, config);

      totalCreated += result.created;
      totalClosed += result.closed;

      core.info(`   ✅ ${result.created} opprettet, ${result.closed} lukket`);
    }

    core.setOutput("issues-created", totalCreated.toString());
    core.setOutput("issues-closed", totalClosed.toString());
  } catch (error) {
    core.setFailed(`Action feilet: ${(error as Error).message}`);
  }
}

run();
```

---

## Fase 4 – Tester

### `tests/fixtures/error-issues.json`

Lag 3 mock-feil: én CRASH, én ANR, én CRASH som er resolved.

### `tests/config.test.ts`

Test:
- Gyldig konfigurasjon parses korrekt
- Ugyldig JSON i `package-repo-map` kaster Error
- `package-names` splittes og trimmes riktig

### `tests/sync.test.ts`

Mock både `PlayReportingClient` og `GitHubClient`. Test:
- Ny feil → `createIssue` kalles én gang
- Eksisterende feil → `createIssue` kalles ikke
- Resolved feil + `closeResolved: true` + åpen issue → `closeIssue` kalles
- `minAffectedUsers` filtrerer riktig

Suksess: `npm test` – alle tester grønne.

---

## Fase 5 – CI/CD-workflows

### `.github/workflows/ci.yml`

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"
      - run: npm ci
      - run: npm test
      - run: npm run lint

  build:
    runs-on: ubuntu-latest
    needs: test
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"
      - run: npm ci
      - run: npm run build
      - name: Verify dist/ is up to date
        run: |
          if [[ -n $(git status --porcelain dist/) ]]; then
            echo "dist/ is stale – run 'npm run build' and commit"
            exit 1
          fi
```

### `.github/workflows/release.yml`

```yaml
name: Release
on:
  push:
    tags:
      - "v*"

jobs:
  release:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      - run: npm ci
      - run: npm run build

      - name: Commit dist/ to tag
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add dist/
          git diff --cached --quiet || git commit -m "chore: build dist for ${GITHUB_REF_NAME}"
          git tag -f ${GITHUB_REF_NAME}
          git push origin ${GITHUB_REF_NAME} --force

      - name: Update floating major tag (v1, v2, ...)
        run: |
          MAJOR=$(echo ${GITHUB_REF_NAME} | cut -d. -f1)
          git tag -f ${MAJOR}
          git push origin ${MAJOR} --force

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v2
        with:
          generate_release_notes: true
```

---

## Fase 6 – README.md

Skriv en komplett README med følgende seksjoner:

### Innhold
1. **Tittel + badges** (CI-status, Marketplace-link, versjon)
2. **Kort beskrivelse** (1 avsnitt)
3. **Eksempel-workflow** – det vanligste use case:

```yaml
# .github/workflows/play-sync.yml
name: Sync Play Console crashes
on:
  schedule:
    - cron: "0 */2 * * *"
  workflow_dispatch:

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: <DITT_BRUKERNAVN>/android-vitals-issues@v1
        with:
          service-account-json: ${{ secrets.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON }}
          package-names: "com.example.myapp"
          extra-labels: "android,crash"
```

4. **Flerapp-eksempel** med `package-repo-map`
5. **Inputs-referanse** (tabellformat)
6. **Oppsettguide** med 4 steg:
   - Aktiver Play Developer Reporting API
   - Opprett service account + nøkkel
   - Gi tilgang i Play Console
   - Legg JSON-nøkkel som GitHub Secret
7. **Deduplicering** – forklar label-strategien
8. **Bidrag**

---

## Fase 7 – Marketplace-klargjøring

### Sjekkliste å verifisere

- [ ] `action.yml` har `name`, `description`, `author`, `branding` (icon + color)
- [ ] Repo er **public**
- [ ] `dist/index.js` er committet
- [ ] Har `LICENSE`-fil (MIT)
- [ ] README har minst ett workflow-eksempel
- [ ] Versjonert med `v1.0.0`-tag

### Publiseringssteg (manuell del – ikke agent)

1. Push tag: `git tag v1.0.0 && git push origin v1.0.0`
2. Gå til GitHub Releases → `Draft a new release`
3. Huk av **"Publish this Action to the GitHub Marketplace"**
4. Velg primær kategori: **Utilities**
5. Publiser

---

## Fase 8 – Selvtest med live-konfigurasjon

Opprett `.github/workflows/test-action.yml` i selve action-repoet:

```yaml
name: Integration test (dry-run)
on:
  workflow_dispatch:
    inputs:
      package-name:
        description: "Package name to test against"
        required: true

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ./   # Bruk lokal versjon av action
        with:
          service-account-json: ${{ secrets.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON }}
          package-names: ${{ inputs.package-name }}
          github-token: ${{ secrets.GITHUB_TOKEN }}
          min-affected-users: "999999"  # Forhindrer faktiske issue-opprettelser
```

---

## Komplett filiste å produsere

```
action.yml
package.json
tsconfig.json
.eslintrc.json
.gitignore
LICENSE
README.md
CHANGELOG.md
src/types.ts
src/config.ts
src/play-client.ts
src/github-client.ts
src/sync.ts
src/index.ts
tests/config.test.ts
tests/sync.test.ts
tests/fixtures/error-issues.json
tests/fixtures/github-issues.json
.github/workflows/ci.yml
.github/workflows/release.yml
.github/workflows/test-action.yml
```

---

## Suksesskriterier for hele oppgaven

| Test | Kommando | Forventet |
|---|---|---|
| Bygg | `npm run build` | `dist/index.js` produsert |
| Tester | `npm test` | Alle grønne |
| Lint | `npm run lint` | 0 feil |
| Action-validering | Push til GitHub | CI-workflow grønn |
| Marketplace | Manuell publish | Action synlig på marketplace |
