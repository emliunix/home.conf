#!/usr/bin/env node
// memory-migrate.mjs -- move the overflow of a memory index into linked notes, without losing bytes.
//
// WHY THIS EXISTS. The lint says "17,091 B, 707 B over the cap" and names the largest sections. A
// human then does the surgery by hand, which is where a hand-edited index gets truncated. This
// script performs that surgery mechanically, and -- more importantly -- it can prove it lost
// nothing before it writes anything.
//
// THE MODEL. A section is either KEPT in the index or MOVED to `notes/<slug>.md`. A moved section is
// replaced by a one-line pointer, which is the route back. So the two invariants are:
//
//   1. PRESERVATION. Every byte of a moved section appears in its note. The note is the only copy
//      once the index stops carrying the text, so if this is violated the content is gone.
//   2. THE CAP. After the move the index is under the cap, or the script refuses and says by how
//      much it fell short -- it never keeps cutting to "make the number work".
//
// BOUNDED means three concrete limits, all of which can refuse rather than proceed:
//   - only sections the spine does NOT require may move (a required heading is the index's shape);
//   - at most `--max-moves` sections move (default 4), so one run cannot gut the file;
//   - `--apply` runs the same plan the `--plan` printed, so what was reviewed is what is written.
//
// DRY RUN BY DEFAULT. With no flag the script PRINTS the plan and writes nothing. `--apply` is the
// only way to write, and it writes the index through the same atomic publish as memory-append.
//
// EXIT CODES. 0 planned/applied; 1 refused (over cap and cannot fix within the bound); 64 bad input.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";
import { publishIndex } from "./memory-append.mjs";

/** The spine headings a memory index must keep. Duplicated from memory-lint by intent: the lint is
 * the gate, this is the planner, and a planner that silently disagreed with the gate would plan a
 * migration the gate then rejects. Both are asserted equal by the skill's own test. */
export const REQUIRED_HEADINGS = ["# ", "## Role", "## Key Knowledge", "## Active Context"];

const DEFAULT_CAP_BYTES = 16_384;

export function bytes(text) {
  return Buffer.byteLength(text, "utf8");
}

/**
 * Split an index into its leading preamble and its `## ` sections, in document order.
 * A section's `text` includes its heading and runs to the next `## ` heading (or EOF).
 */
export function splitSections(text) {
  const lines = text.split("\n");
  const sections = [];
  let preamble = [];
  let current = null;
  for (const line of lines) {
    if (line.startsWith("## ")) {
      if (current !== null) sections.push(current);
      current = { heading: line.trim(), lines: [line] };
    } else if (current === null) {
      preamble.push(line);
    } else {
      current.lines.push(line);
    }
  }
  if (current !== null) sections.push(current);
  return { preamble, sections };
}

export function joinSections(preamble, sections) {
  return [...preamble, ...sections.map((s) => s.lines.join("\n"))].join("\n");
}

/** A stable, readable note filename for a section heading: `## Open threads` -> `open-threads.md`. */
export function noteFileName(heading) {
  const slug = heading
    .replace(/^#+\s*/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${slug === "" ? "section" : slug}.md`;
}

/**
 * Plan a migration. Pure: it reads the index text and returns what it WOULD do, including the
 * projected size. It never writes, so a caller can print it, test it, or refuse it.
 */
export function planMigration(text, options = {}) {
  const cap = options.cap ?? DEFAULT_CAP_BYTES;
  const maxMoves = options.maxMoves ?? 4;
  const notesDirName = options.notesDirName ?? "notes";
  const before = bytes(text);
  if (before <= cap) {
    return { needed: false, bytesBefore: before, bytesAfter: before, cap, moves: [], refused: null };
  }

  const { preamble, sections } = splitSections(text);
  // A required heading is the index's shape, so it stays whatever its size. A section is eligible
  // only if it is not required AND actually has a body worth moving.
  const movable = sections.filter(
    (s) => !REQUIRED_HEADINGS.includes(s.heading) && s.lines.length > 1,
  );
  const bySize = [...movable].sort((a, b) => bytes(b.lines.join("\n")) - bytes(a.lines.join("\n")));

  const moves = [];
  let working = sections;
  let projected = before;
  for (const section of bySize) {
    if (projected <= cap || moves.length >= maxMoves) break;
    const sectionText = section.lines.join("\n");
    const fileName = noteFileName(section.heading);
    const pointer = `- ${section.heading.replace(/^#+\s*/, "")}: see \`${notesDirName}/${fileName}\``;
    // The replacement is the pointer line only; the heading is preserved inside the note.
    const replacement = { heading: section.heading, lines: [pointer], movedTo: fileName };
    working = working.map((s) => (s === section ? replacement : s));
    const saved = bytes(sectionText) - bytes(pointer);
    projected -= saved;
    moves.push({ heading: section.heading, fileName, sectionText, pointer, savedBytes: saved });
  }

  // The refusal must say WHICH limit stopped it. "All N eligible" is wrong when the bound -- not
  // the supply of eligible sections -- is what halted the greedy, and a reader acts differently:
  // one case means "there is nothing left to move", the other means "raise --max-moves if you mean it".
  const hitBound = moves.length >= maxMoves && projected > cap;
  const refused =
    projected > cap
      ? hitBound
        ? `still ${String(projected - cap)} B over the ${String(cap)} B cap, and the ${String(maxMoves)}-move bound stopped the plan; ${String(movable.length)} section(s) were eligible`
        : `still ${String(projected - cap)} B over the ${String(cap)} B cap after moving every eligible section (${String(moves.length)}); nothing left to move but a required heading or a single-line section`
      : null;
  return {
    needed: true,
    cap,
    bytesBefore: before,
    bytesAfter: projected,
    moves,
    refused,
    indexText: refused === null ? joinSections(preamble, working) : null,
  };
}

/**
 * Verify a plan's PRESERVATION invariant against the notes it will write: every moved section's
 * body must appear verbatim in its note. Returns the list of violations; empty means nothing is lost.
 * This is the check that must fail when a migration drops content, so it is a separate function and
 * NOT inlined into the writer where "it must have worked because we wrote it" would stand in.
 */
export function verifyPreservation(plan, notesDir) {
  const violations = [];
  for (const move of plan.moves) {
    const notePath = join(notesDir, move.fileName);
    if (!existsSync(notePath)) {
      violations.push(`note missing for ${move.heading}: ${notePath}`);
      continue;
    }
    const note = readFileSync(notePath, "utf8");
    const body = move.sectionText.replace(/^##\s+.*\n?/, "");
    if (body.trim().length > 0 && !note.includes(body.trim())) {
      violations.push(`note ${notePath} does not contain the body of ${move.heading}`);
    }
  }
  return violations;
}

/** Write the notes a plan calls for. Idempotent: a note whose content already matches is left alone. */
export function writeNotes(plan, indexDir, notesDirName = "notes") {
  const notesDir = join(indexDir, notesDirName);
  mkdirSync(notesDir, { recursive: true });
  for (const move of plan.moves) {
    const notePath = join(notesDir, move.fileName);
    const content = `${move.heading}\n${move.sectionText.replace(/^##\s+.*\n?/, "")}`;
    if (existsSync(notePath) && readFileSync(notePath, "utf8") === content) continue;
    writeFileSync(notePath, content);
  }
  return notesDir;
}

function main(argv) {
  const apply = argv.includes("--apply");
  const rest = argv.filter((a) => a !== "--apply");
  const indexPath = rest[0];
  if (indexPath === undefined) {
    console.error("usage: memory-migrate.mjs <index-path> [--apply]");
    process.exit(64);
  }
  const maxFlag = rest.indexOf("--max-moves");
  const maxMoves = maxFlag === -1 ? 4 : Number(rest[maxFlag + 1]);
  if (!Number.isInteger(maxMoves) || maxMoves < 1) {
    console.error("--max-moves must be a positive integer");
    process.exit(64);
  }

  const text = readFileSync(indexPath, "utf8");
  const plan = planMigration(text, { maxMoves });
  if (!plan.needed) {
    console.log(`OK: ${indexPath} is ${String(plan.bytesBefore)} B, already within the ${String(plan.cap)} B cap; nothing to migrate.`);
    process.exit(0);
  }
  if (plan.refused !== null) {
    console.error(`REFUSED: ${plan.refused}.`);
    console.error("Nothing was written. Subdivide a section by hand or raise --max-moves deliberately.");
    process.exit(1);
  }

  console.log(`PLAN for ${indexPath}: ${String(plan.bytesBefore)} B -> ${String(plan.bytesAfter)} B (cap ${String(plan.cap)} B), ${String(plan.moves.length)} section(s) move.`);
  for (const move of plan.moves) {
    console.log(`  - ${move.heading} -> notes/${move.fileName} (saves ${String(move.savedBytes)} B)`);
  }
  if (!apply) {
    console.log("Dry run. Re-run with --apply to write (notes first, then the index atomically).");
    process.exit(0);
  }

  const indexDir = dirname(indexPath);
  const notesDir = writeNotes(plan, indexDir);
  const violations = verifyPreservation(plan, notesDir);
  if (violations.length > 0) {
    for (const v of violations) console.error(`FAIL: ${v}`);
    console.error("Preservation violated: notes were written but the index was NOT changed.");
    process.exit(1);
  }
  const result = publishIndex(indexPath, plan.indexText);
  console.log(`APPLIED: ${relative(process.cwd(), indexPath)} ${String(result.bytesBefore)} B -> ${String(result.bytesAfter)} B; notes in ${relative(process.cwd(), notesDir)}.`);
  process.exit(0);
}

if (process.argv[1] !== undefined && basename(process.argv[1]) === "memory-migrate.mjs") main(process.argv.slice(2));
