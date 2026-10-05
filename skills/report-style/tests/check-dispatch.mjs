#!/usr/bin/env node
// check-dispatch -- the guard the dispatcher was missing.
//
// WHY THIS EXISTS. SKILL.md is now a dispatcher: it routes to one template per
// report kind and states every mandatory rule as one line with a reference that
// expands it. Both halves rot silently without a check:
//   * add a kind to the catalog and forget its template -> a reader is routed to
//     nothing;
//   * add a rule to SKILL.md and forget its reference -> the rule is asserted
//     with no reasoning behind it;
//   * delete a reference an anchor still points at -> a dead link nobody notices.
// So the check enforces three reachability properties. It asserts STRUCTURE, not
// prose: it cannot tell whether a rule is a good rule, and it does not try.
//
// Run: node tests/check-dispatch.mjs   (from skills/report-style/)

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SKILL = join(ROOT, "SKILL.md");
const REFS = join(ROOT, "references");
const CATALOG = join(REFS, "catalog.md");

const failures = [];
const fail = (msg) => failures.push(msg);

const skill = readFileSync(SKILL, "utf8");
const catalog = readFileSync(CATALOG, "utf8");

/** Every `[label](target)` in a Markdown string, as targets only. */
function links(text) {
  return [...text.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)].map((m) => m[1]);
}

// 1. Every kind row in the catalog has a template that exists on disk.
const catalogRows = [...catalog.matchAll(/^\|\s*[^|]+\|\s*[^|]+\|\s*\[[^\]]*\]\(([^)]+)\)/gm)]
  .map((m) => m[1]);
if (catalogRows.length === 0) fail("catalog.md: no kind rows found; the parse is blind");
for (const row of catalogRows) {
  const p = join(REFS, row);
  if (!existsSync(p)) fail(`catalog.md routes to a missing template: references/${row}`);
}

// 2. Every catalog template is reachable from the dispatcher (no orphan template).
const skillTargets = new Set(links(skill).map((t) => t.replace(/^\.\//, "")));
for (const row of catalogRows) {
  if (!skillTargets.has(`references/${row}`)) {
    fail(`SKILL.md never routes to references/${row}; a template no dispatcher reaches`);
  }
}

// 3. Every reference file on disk is reachable from SKILL.md (no orphan reference).
for (const entry of readdirSync(REFS)) {
  if (!entry.endsWith(".md")) continue;
  if (entry === "catalog.md") continue; // reached via "Route first"
  if (!skillTargets.has(`references/${entry}`) && !catalog.includes(`(${entry})`)) {
    fail(`references/${entry} is reachable from neither SKILL.md nor catalog.md`);
  }
}

// 4. Every in-page anchor resolves to a heading in the file it points at.
for (const target of links(skill)) {
  const [path, anchor] = target.split("#");
  if (!anchor) continue;
  const p = resolve(ROOT, path);
  if (!existsSync(p)) {
    fail(`SKILL.md links to a missing file: ${path}`);
    continue;
  }
  const text = readFileSync(p, "utf8");
  const slugs = new Set(
    [...text.matchAll(/^#{1,6}\s+(.+)$/gm)].map((m) =>
      m[1].toLowerCase().replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-"),
    ),
  );
  if (!slugs.has(anchor)) fail(`SKILL.md anchor does not resolve: ${target}`);
}

if (failures.length > 0) {
  console.error(`check-dispatch: ${failures.length} failure(s)`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(
  `check-dispatch: ok (${catalogRows.length} kinds, ${skillTargets.size} dispatcher links, all anchors resolve)`,
);
