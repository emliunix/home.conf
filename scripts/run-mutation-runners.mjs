#!/usr/bin/env node
// Runs every committed `*mutations.mjs` runner. Exit 0 only if each runner
// exits 0. An empty discovery is a crash (exit 2), not a pass: a pipeline that
// finds no runners is not covering the mutation tables.
//
// Each runner already refuses to score a skip as a pass (BROKEN / HARNESS /
// GREEN / WRONG-CASE are non-zero). This file does not re-parse their tables.
//
// Not claimed: `present.mutations.md`, `union-empty.mutations.md`, and
// `oracles/request-shape.mutations.md` — those tables have no runner.

import { execFileSync, spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

const listed = execFileSync("git", ["ls-files", "-z"], {
  cwd: ROOT,
  encoding: "utf8",
})
  .split("\0")
  .filter((p) => p.endsWith("mutations.mjs"));
listed.sort();

if (listed.length === 0) {
  process.stderr.write(
    "test:mutations: no committed *mutations.mjs runners; discovery is empty\n",
  );
  process.exit(2);
}

let failed = 0;
for (const rel of listed) {
  process.stdout.write(`\n== ${rel} ==\n`);
  const run = spawnSync(process.execPath, [join(ROOT, rel)], {
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
  process.stderr.write(`test:mutations: ${failed}/${listed.length} runners failed\n`);
  process.exit(1);
}
process.stdout.write(
  `\ntest:mutations: ${listed.length}/${listed.length} runners exited 0\n`,
);
