#!/usr/bin/env node
// Runs every committed `*.mutations.yaml` table through `doc-verify mutate`.
// Exit 0 only if each table scores. An empty discovery is a crash (exit 2),
// not a pass: a pipeline that finds no tables is not covering the contract.
//
// These tables are the document-constraint form (single edit of a live
// document, JSON ruleIds). Source-level runners such as
// `doc-verify/tests/language/references.mutations.mjs` stay as `*.mutations.mjs`:
// they edit TypeScript and score vitest titles, which this command does not.

import { execFileSync, spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const CLI = join(ROOT, "doc-verify/dist/cli.js");

const listed = execFileSync("git", ["ls-files", "-z"], {
  cwd: ROOT,
  encoding: "utf8",
})
  .split("\0")
  .filter((p) => p.endsWith(".mutations.yaml"));
listed.sort();

if (listed.length === 0) {
  process.stderr.write(
    "mutate: no committed *.mutations.yaml tables; discovery is empty\n",
  );
  process.exit(2);
}

let failed = 0;
for (const rel of listed) {
  process.stdout.write(`\n== ${rel} ==\n`);
  const run = spawnSync(process.execPath, [CLI, "mutate", join(ROOT, rel)], {
    cwd: ROOT,
    encoding: "utf8",
    stdio: "inherit",
  });
  const status = run.status ?? 1;
  if (status !== 0) {
    process.stderr.write(`${rel}: exit ${status}\n`);
    failed += 1;
  }
}

if (failed > 0) {
  process.stderr.write(`mutate: ${failed}/${listed.length} tables failed\n`);
  process.exit(1);
}
process.stdout.write(`\nmutate: ${listed.length}/${listed.length} tables scored\n`);
