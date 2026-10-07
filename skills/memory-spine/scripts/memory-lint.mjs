#!/usr/bin/env node
// memory-lint -- the gate for a workspace MEMORY.md index.
//
// WHY THIS EXISTS. MEMORY.md is an agent's recovery point after context compression: it is read
// first and must stay small enough to be read in full. Left to anchored hand-edits it grows
// without a hard bound (one workspace measured 26,948 B against a 16,384 B budget) and a
// partially-applied edit can leave it unreadable. This check makes the bound and the pointer
// set explicit and fails CLOSED.
//
// THE THREE CHECKS, in the order they matter:
//   1. SIZE      -- hard cap, reported as the exact number of bytes OVER, never "too big".
//   2. SECTIONS  -- the index spine's required headings must be present.
//   3. POINTERS  -- every explicit `notes/...md` pointer must resolve on disk.
//
// EXIT CODES. 0 pass; 1 a check failed; 64 invalid input (a gate that could not run is not a
// gate that passed). Over-cap is exit 1, not a warning: the whole point is that it cannot be
// ignored.

import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

export const CAP_BYTES = 16_384;

/** The index spine: headings every MEMORY.md must carry. Order is not enforced, presence is. */
export const REQUIRED_HEADINGS = [
  "# ",              // the agent's own name, as the H1
  "## Role",
  "## Key Knowledge",
  "## Active Context",
];

/**
 * Pointers are written as backticked relative paths that look like notes/docs. Only explicit
 * `notes/...` references are checked; a bare filename is prose, not a pointer, and calling it
 * broken would be a false red.
 */
const POINTER = /`(notes\/[A-Za-z0-9._/-]+\.(?:md|ya?ml|json))`/g;

export function measure(text) {
  return Buffer.byteLength(text, "utf8");
}

/** Largest sections by byte size, largest first -- so a trim has a target, not an adjective. */
export function largestSections(text, limit = 3) {
  const lines = text.split("\n");
  const sections = [];
  let current = { heading: "(preamble)", bytes: 0 };
  for (const line of lines) {
    if (/^#{1,3} /.test(line)) {
      sections.push(current);
      current = { heading: line.trim(), bytes: 0 };
    }
    current.bytes += Buffer.byteLength(`${line}\n`, "utf8");
  }
  sections.push(current);
  return sections
    .filter((s) => s.heading !== "(preamble)")
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, limit);
}

export function findPointers(text) {
  const found = new Set();
  for (const match of text.matchAll(POINTER)) found.add(match[1]);
  return [...found];
}

/**
 * @param {string} indexPath absolute path to MEMORY.md
 * @param {{cap?: number, root?: string}} [options] root defaults to the index's own directory
 * @returns {{ok: boolean, problems: string[], measured: number, over: number, largest: Array}}
 */
export function lint(indexPath, options = {}) {
  const cap = options.cap ?? CAP_BYTES;
  const problems = [];
  if (!existsSync(indexPath) || !statSync(indexPath).isFile()) {
    return { ok: false, problems: [`no index at ${indexPath}`], measured: 0, over: 0, largest: [] };
  }
  const text = readFileSync(indexPath, "utf8");
  const measured = measure(text);
  const root = options.root ?? dirname(indexPath);

  // 1. SIZE -- the exact bytes over, because "over cap" is not actionable and "537 over" is.
  const over = Math.max(0, measured - cap);
  if (over > 0) {
    const largest = largestSections(text);
    problems.push(
      `index is ${measured} B, ${over} B over the ${cap} B cap; largest sections: ` +
        largest.map((s) => `${s.heading} (${s.bytes} B)`).join(", "),
    );
  }

  // 2. SECTIONS -- a missing spine heading means the recovery index lost a part of its shape.
  for (const heading of REQUIRED_HEADINGS) {
    const present = heading === "# " ? /^# \S/.test(text) : text.includes(`\n${heading}`) || text.startsWith(heading);
    if (!present) problems.push(`missing required index heading: ${heading.trim() || "# <name>"}`);
  }

  // 3. POINTERS -- a pointer that does not resolve sends the next reader nowhere.
  for (const pointer of findPointers(text)) {
    const target = isAbsolute(pointer) ? pointer : resolve(root, pointer);
    if (!existsSync(target)) {
      problems.push(`pointer does not resolve: ${pointer} (looked at ${relative(root, target) || target})`);
    }
  }

  return { ok: problems.length === 0, problems, measured, over, largest: largestSections(text) };
}

function main(argv) {
  const index = argv[0] ?? "MEMORY.md";
  const capFlag = argv.indexOf("--cap");
  const cap = capFlag === -1 ? CAP_BYTES : Number(argv[capFlag + 1]);
  if (Number.isNaN(cap) || cap <= 0) {
    console.error("memory-lint: --cap must be a positive integer");
    process.exit(64);
  }
  const result = lint(index, { cap });
  if (result.ok) {
    console.log(`OK: ${index} is ${result.measured} B (cap ${cap} B), headings present, all pointers resolve.`);
    process.exit(0);
  }
  for (const problem of result.problems) console.error(`FAIL: ${problem}`);
  process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) main(process.argv.slice(2));
