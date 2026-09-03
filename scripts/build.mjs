#!/usr/bin/env node
// @vercel/ncc's ts-loader still relies on the classic TypeScript Compiler API
// (ts.sys, findConfigFile, ...), which TypeScript 7's native/Go port no longer
// ships (see https://github.com/vercel/ncc/issues/1336). ncc's fallback to its
// own bundled compiler is not reliable here: it does a plain, unrestricted
// `require('typescript')` that can still walk up to this repo's real
// typescript@7 depending on npm's hoisting decisions. Instead we point ncc's
// typescript lookup at tools/ncc-ts6-shim, an isolated workspace that installs
// only the TS6-compatible compiler API (@typescript/typescript6, the package
// the TypeScript team publishes for tools needing side-by-side TS7 support).
// The project itself still depends on real TypeScript 7 for editing/type-checking.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const nccCli = fileURLToPath(
  new URL("../node_modules/@vercel/ncc/dist/ncc/cli.js", import.meta.url),
);
const ts6ShimDir = fileURLToPath(
  new URL("../tools/ncc-ts6-shim/", import.meta.url),
);

const result = spawnSync(
  process.execPath,
  [
    "--max-old-space-size=4096",
    nccCli,
    "build",
    "src/index.ts",
    "-o",
    "dist",
    "--source-map",
    "--license",
    "licenses.txt",
  ],
  {
    stdio: "inherit",
    env: { ...process.env, TYPESCRIPT_LOOKUP_PATH: ts6ShimDir },
  },
);

if (result.error) throw result.error;
process.exit(result.status ?? 1);
