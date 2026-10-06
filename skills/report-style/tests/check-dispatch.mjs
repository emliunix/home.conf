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
// ⚠ THE PARSE MUST BE TOTAL (GameBoy, 2026-10-05). A row whose link is deleted
// must redden, not vanish. An earlier revision parsed catalog rows by requiring a
// Markdown link in the third cell, so removing the link removed the ROW from the
// population and the check reported `ok` with a smaller count -- a false clean,
// because the instrument's parse defines what can fail. Every table row is now
// counted independently of the link regex and the two counts must agree.
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
//
// The population is counted by SHAPE (a three-cell table row that is not the
// header or the separator), never by whether the row happens to carry a link.
// A row that lost its link is then a named failure instead of a shrinking count.
const tableRows = catalog
  .split("\n")
  .filter((line) => /^\|\s*\S/.test(line))
  .filter((line) => !/^\|\s*-+/.test(line))
  .filter((line) => !/^\|\s*Kind\s*\|/.test(line));

const catalogRows = [];
for (const row of tableRows) {
  const cells = row.split("|").slice(1, -1).map((c) => c.trim());
  if (cells.length < 3) {
    fail(`catalog.md: row has ${cells.length} cells, expected 3: ${row.trim()}`);
    continue;
  }
  const m = cells[2].match(/\]\(([^)]+)\)/);
  if (!m) {
    fail(
      `catalog.md: kind "${cells[0]}" has no template link in its third cell ` +
        `(found "${cells[2]}"); a row without a link is a row that routes nowhere`,
    );
    continue;
  }
  catalogRows.push(m[1]);
}
if (catalogRows.length === 0) fail("catalog.md: no kind rows found; the parse is blind");
for (const row of catalogRows) {
  const p = join(REFS, row);
  if (!existsSync(p)) fail(`catalog.md routes to a missing template: references/${row}`);
}

// 1b. The parse is total: rows seen by shape must equal rows successfully routed.
if (catalogRows.length !== tableRows.length) {
  fail(
    `catalog.md: ${tableRows.length} table rows seen but only ${catalogRows.length} routed; ` +
      `the parse is not total (see the per-row failures above)`,
  );
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

// 3b. Every mandatory rule carries a reference that expands it.
//
// The dispatcher's contract is "one rule per line, with the why behind a
// pointer". A rule added without its pointer breaks that contract silently: the
// rule still reads as mandatory, but nothing carries the reasoning, so the next
// editor has no way to tell whether it is still true. Every `###` under
// `## Mandatory rules` must link to at least one reference file.
const mandatory = skill.split(/^## Mandatory rules\s*$/m)[1];
if (mandatory === undefined) {
  fail("SKILL.md: no '## Mandatory rules' section; the rule check is blind");
} else {
  const body = mandatory.split(/^## /m)[0];
  const rules = [...body.matchAll(/^###\s+(.+)$/gm)];
  if (rules.length === 0) fail("SKILL.md: '## Mandatory rules' has no '###' rules; the check is blind");
  rules.forEach((rule, i) => {
    const start = rule.index;
    const end = i + 1 < rules.length ? rules[i + 1].index : body.length;
    const section = body.slice(start, end);
    if (!/\]\(references\/[^)]+\)/.test(section)) {
      fail(`SKILL.md: mandatory rule "${rule[1]}" has no reference that expands it`);
    }
  });
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
