// Round 10 threshold sweep: reads the leaves sidecars a promotion run wrote and re-reads each
// cell at t in {0.5, 0.6, 0.7}. It never calls the judge (no checker import, no backend).
//
//   node worklog/kernel-trials/probe/threshold-sweep.mjs [--mock] [--shape per-atom] [--repeats N]
//        [--batched-ledger NAME]... [--fixtures-dir DIR] <ledger>...
//   node worklog/kernel-trials/probe/threshold-sweep.mjs --self-test
//
// Input: oracle-fixtures/.leaves-<ledger>.json (written by oracle-test.mjs). Only entries of the
// chosen shape (default per-atom) and the normal arm are read.
//
// Join. A real-cell ledger (mode real-cells) joins each leaf of the labels file's oracle (prefix
// match, as the runner does) on (document, rowId) to the labels file the sidecar names
// (`labelsFile`, under oracle-fixtures/real-cells/). Per document `counted: false` makes a
// control and `held_out: true` a held-out document; per cell `rewritten:` marks a cell rewritten
// after judge exposure and `since:` an unchanged one (a cell may also carry `counted`/`held_out`).
// A fixture ledger (mode fixtures) joins each leaf of the set's oracle to the set's fixtures.yaml:
// `expect_cells[row] ?? expect`; `evidence_reasons/defective-wrongrow` is the known miss.
//
// Aggregation. Per cell: p = the minimum over repeats of the peak of the judge's distribution;
// the cell's side is the answer of that minimum repeat. Decided at t iff the side is holds or
// fails and p >= t, compared exactly on p rounded to 6 decimals; otherwise unknown (symmetric demotion;
// a judge-answered `unknown` or an empty distribution is unknown at every t). A cell whose
// repeats answer differently is a label flip (printed); a cell whose per-repeat sides at t differ
// "moves on one repeat only" and is classed `flip` at that t, neither gain nor loss.
//
// Classification against the 0.5 side: right-side decided -> unknown is a loss (a review on a
// correct answer); wrong-side decided -> unknown is a gain (an error turned into a review).
// Populations print apart: real `counted` (never rewritten), `rewritten`, their union (the plan's
// n), `control` (counted: false) and `held-out`; seeded `genuine` (expect holds), `defective`
// (expect fails) and `known-miss`. The document verdict per t is oracle-local: NO-GO if a cell is
// decided fails, else NEEDS-REVIEW if a cell is unknown, else PASS (docs/doc-verify-model.md §5).
//
// Old batched p per seeded cell: from .leaves-round4-*.json and .leaves-round4c-*.json if present
// (batched or module-default shape), plus any --batched-ledger; blank otherwise.
//
// Repeats expected: 2 (the plan's --repeat 2) unless --repeats N; never inferred from the data.
// MOCK-tagged entries are a problem unless --mock is passed (the mock-check run).
//
// complete: false (a missing sidecar, a missing repeat, a labelled cell with no leaf, a leaf with
// no label, a cell with no expectation, a fixture expectation mismatch, MOCK data without --mock) prints the offending cells and exits 1; complete: true
// exits 0; a usage error exits 2.
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import YAML from "yaml";

const here = import.meta.dirname;
const THRESHOLDS = [0.5, 0.6, 0.7];
const DEFAULT_REPEATS = 2; // the plan runs every command with --repeat 2
/** p rounded to 6 decimals: the comparison is p >= t exactly, free of float noise, with no slack. */
const r6 = (x) => Math.round(x * 1e6) / 1e6;
const KNOWN_MISS = new Set(["evidence_reasons/defective-wrongrow"]);
const BAND = [0.5, 0.7];

// ---------------------------------------------------------------- helpers

const fmt = (x, digits = 2) => (x === undefined || x === null || Number.isNaN(x) ? "-" : x.toFixed(digits));
const short = (side) => ({ holds: "h", fails: "f", unknown: "u" })[side] ?? "?";
function table(say, header, rows) {
  const widths = header.map((h, i) => Math.max(String(h).length, ...rows.map((r) => String(r[i]).length)));
  const line = (r) => `  ${r.map((c, i) => String(c).padEnd(widths[i])).join("  ")}`.trimEnd();
  say(line(header));
  say(line(widths.map((w) => "-".repeat(w))));
  for (const r of rows) say(line(r));
}
const pct = (k, n) => (n === 0 ? "-" : `${((100 * k) / n).toFixed(0)}%`);

/** One repeat's reading of a leaf: the judge's answer and the peak of its distribution. */
function readingOf(leaf, repeat) {
  const dist = Array.isArray(leaf.distribution) ? leaf.distribution : [];
  const p = dist.length === 0 ? null : (typeof leaf.p === "number" ? leaf.p : Math.max(...dist));
  const answer = dist.length === 0 ? "unknown" : leaf.answered;
  return { repeat, p, answer: answer === "holds" || answer === "fails" ? answer : "unknown", verdict: leaf.verdict };
}
const sideAt = (reading, t) => (reading.answer !== "unknown" && reading.p !== null && r6(reading.p) >= t ? reading.answer : "unknown");

/** Aggregate a cell's repeats: the minimum peak and the answer of that repeat. */
function aggregate(readings) {
  const sorted = [...readings].sort((a, b) => (a.p ?? -1) - (b.p ?? -1) || a.repeat - b.repeat);
  const min = sorted[0];
  const answers = new Set(readings.map((r) => r.answer));
  const sides = Object.fromEntries(THRESHOLDS.map((t) => [t, sideAt(min, t)]));
  const repSides = Object.fromEntries(THRESHOLDS.map((t) => [t, readings.map((r) => sideAt(r, t))]));
  const oneRepeat = Object.fromEntries(THRESHOLDS.map((t) => [t, new Set(repSides[t]).size > 1]));
  return { p: min.p, answer: min.answer, sides, repSides, labelFlip: answers.size > 1, oneRepeat };
}

/** right | wrong | unknown, against the expected label. */
const judgement = (side, expected) => (side === "unknown" ? "unknown" : side === expected ? "right" : "wrong");
/** The cell's move from 0.5 to t: gain | LOSS | flip | - . */
function moveAt(cell, t) {
  if (t === THRESHOLDS[0]) return "";
  const at05 = judgement(cell.agg.sides[THRESHOLDS[0]], cell.expected);
  const atT = judgement(cell.agg.sides[t], cell.expected);
  if (at05 === atT) return cell.agg.oneRepeat[t] ? "flip" : "-";
  if (cell.agg.oneRepeat[t]) return "flip";
  if (at05 === "wrong" && atT === "unknown") return "gain";
  if (at05 === "right" && atT === "unknown") return "LOSS";
  return `${at05}->${atT}`;
}

function loadJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

// ---------------------------------------------------------------- collection

/**
 * Leaves of the chosen entries grouped by cell id; problems for duplicates. `want(leaf)` selects
 * the oracle's leaves; `id(entry, leaf)` names the cell.
 */
function collect(entries, want, id) {
  const cells = new Map();
  const problems = [];
  for (const entry of entries) {
    for (const leaf of entry.leaves) {
      if (!want(entry, leaf)) continue;
      const key = id(entry, leaf);
      if (!cells.has(key)) cells.set(key, new Map());
      const byRepeat = cells.get(key);
      if (byRepeat.has(entry.repeat)) problems.push(`${key}: two leaves in repeat ${entry.repeat}`);
      byRepeat.set(entry.repeat, { leaf, entry });
    }
  }
  return { cells, problems };
}

/** The repeats a ledger must carry: --repeats, else the plan's 2. Never inferred from the data. */
const expectedRepeats = (opt) => opt ?? DEFAULT_REPEATS;

function batchedSources(dir, extra) {
  const names = existsSync(dir) ? readdirSync(dir).filter((f) => /^\.leaves-round4c?-.*\.json$/.test(f)) : [];
  const files = [...names.map((f) => path.join(dir, f)), ...extra.map((n) => path.join(dir, `.leaves-${n}.json`))];
  const map = new Map();
  const used = [];
  for (const file of files) {
    if (!existsSync(file)) continue;
    used.push(path.basename(file));
    for (const entry of loadJson(file).runs ?? []) {
      if (entry.mode !== "fixtures" || (entry.arm ?? "normal") !== "normal") continue;
      if (!["batched", "module-default"].includes(entry.shape)) continue;
      for (const leaf of entry.leaves) {
        if (!leaf.row) continue;
        const key = `${entry.fixture} ${leaf.row}`;
        const r = readingOf(leaf, entry.repeat);
        const prev = map.get(key);
        if (prev === undefined || (r.p ?? -1) < (prev.p ?? -1)) map.set(key, r);
      }
    }
  }
  return { map, used };
}

// ---------------------------------------------------------------- one ledger

function sweepLedger(dir, ledger, opts, say) {
  const file = path.join(dir, `.leaves-${ledger}.json`);
  const problems = [];
  say(`== ledger ${ledger}`);
  if (!existsSync(file)) {
    problems.push(`${ledger}: no sidecar ${path.basename(file)}`);
    return { ledger, complete: false, problems, kind: "none" };
  }
  const sidecar = loadJson(file);
  const entries = (sidecar.runs ?? []).filter((e) => e.shape === opts.shape && (e.arm ?? "normal") === "normal");
  if (entries.length === 0) {
    problems.push(`${ledger}: no ${opts.shape} normal-arm entries`);
    return { ledger, complete: false, problems, kind: "none" };
  }
  const modes = [...new Set(entries.map((e) => e.mode))];
  if (modes.length !== 1) problems.push(`${ledger}: mixed modes ${modes.join(",")}`);
  const tags = [...new Set(entries.map((e) => e.tag))];
  const repeats = expectedRepeats(opts.repeats);
  say(`   REPEATS EXPECTED ${repeats} (${opts.repeats === undefined ? "the plan's default" : "--repeats override"}; never inferred from the sidecar)`);
  const beyond = [...new Set(entries.filter((e) => e.repeat > repeats).map((e) => e.repeat))];
  if (beyond.length > 0) problems.push(`${ledger}: repeat ${beyond.join(",")} beyond the ${repeats} expected (pass --repeats)`);
  if (tags.includes("MOCK") && !opts.mock) problems.push(`${ledger}: MOCK-tagged entries swept as data (pass --mock for a mock-check run)`);
  say(`   mode ${modes.join(",")}; shape ${opts.shape}; tag ${tags.join(",")}${tags.includes("MOCK") ? ` (MOCK: every p is the mock's, not a measurement${opts.mock ? "; --mock given" : ""})` : ""}; models ${[...new Set(entries.map((e) => e.model))].join(",")}`);
  const result = modes[0] === "real-cells" ? realCells(dir, ledger, entries, repeats, problems, say) : fixtures(dir, ledger, entries, repeats, problems, opts, say);
  for (const problem of problems) say(`   problem: ${problem}`);
  say(`   ${ledger} complete: ${problems.length === 0}`);
  say("");
  return { ...result, ledger, complete: problems.length === 0, problems };
}

/** Per-repeat readings for a cell; a missing repeat is a problem naming the cell. */
function readingsFor(name, byRepeat, repeats, problems) {
  const readings = [];
  for (let r = 1; r <= repeats; r += 1) {
    const hit = byRepeat?.get(r);
    if (hit === undefined) problems.push(`${name}: missing repeat ${r}`);
    else readings.push(readingOf(hit.leaf, r));
  }
  return readings;
}

function printCells(say, cells, extraHeader, extraCols) {
  table(say, ["population", ...extraHeader, "expect", ...Array.from({ length: Math.max(0, ...cells.map((c) => c.readings.length)) }, (_, i) => `rep${i + 1}`),
    "p(min)", ...THRESHOLDS.map((t) => `@${t}`), ...THRESHOLDS.slice(1).map((t) => `move@${t}`), "label-flip"],
  cells.map((c) => [c.population, ...extraCols(c), c.expectShown ?? c.expected,
    ...Array.from({ length: Math.max(0, ...cells.map((x) => x.readings.length)) }, (_, i) => (c.readings[i] ? `${fmt(c.readings[i].p)}${short(c.readings[i].answer)}` : "MISSING")),
    `${fmt(c.agg.p)}${short(c.agg.answer)}`, ...THRESHOLDS.map((t) => c.agg.sides[t]), ...THRESHOLDS.slice(1).map((t) => moveAt(c, t)), c.agg.labelFlip ? "FLIP" : "-"]));
}

/** Per-population, per-t counts. */
function printSweep(say, populations, cells) {
  const rows = [];
  for (const [name, pick] of populations) {
    const list = cells.filter(pick);
    for (const t of THRESHOLDS) {
      const j = list.map((c) => judgement(c.agg.sides[t], c.expected));
      const moves = list.map((c) => moveAt(c, t));
      rows.push([name, list.length, t, j.filter((x) => x === "wrong").length, j.filter((x) => x === "right").length, j.filter((x) => x === "unknown").length,
        t === THRESHOLDS[0] ? "-" : moves.filter((m) => m === "gain").length, t === THRESHOLDS[0] ? "-" : moves.filter((m) => m === "LOSS").length,
        t === THRESHOLDS[0] ? "-" : moves.filter((m) => m === "flip").length]);
    }
  }
  table(say, ["population", "n", "t", "wrong-side decided", "right-side decided", "unknown", "gain", "loss", "flip"], rows);
  return rows;
}

function printSortedP(say, label, list) {
  const sorted = [...list].sort((a, b) => (a.agg.p ?? -1) - (b.agg.p ?? -1));
  const inBand = list.filter((c) => c.agg.p !== null && r6(c.agg.p) >= BAND[0] && r6(c.agg.p) < BAND[1]).length;
  say(`   sorted p, ${label} (n=${list.length}): ${sorted.map((c) => `${fmt(c.agg.p)}${short(c.agg.answer)}`).join(" ") || "none"}`);
  say(`   share in [${BAND[0]}, ${BAND[1]}): ${inBand}/${list.length} (${pct(inBand, list.length)})`);
  return { inBand, n: list.length };
}

function printFlips(say, list, name) {
  const labelFlips = list.filter((c) => c.agg.labelFlip);
  say(`   repeat flips (${name}): label flips ${labelFlips.length}${labelFlips.length ? ` [${labelFlips.map((c) => c.name).join("; ")}]` : ""}`);
  for (const t of THRESHOLDS) {
    const moved = list.filter((c) => c.agg.oneRepeat[t]);
    say(`     sides differ between repeats at ${t}: ${moved.length}${moved.length ? ` [${moved.map((c) => `${c.name} ${c.agg.repSides[t].join("/")}`).join("; ")}]` : ""}`);
  }
}

// ---------------------------------------------------------------- real cells

function realCells(dir, ledger, entries, repeats, problems, say) {
  const files = [...new Set(entries.map((e) => e.labelsFile))];
  const cellsOut = [];
  let oracleName;
  for (const labelsFile of files) {
    const labelsPath = path.join(dir, "real-cells", labelsFile ?? "(none)");
    if (labelsFile === null || !existsSync(labelsPath)) { problems.push(`${ledger}: labels file ${labelsFile} not found`); continue; }
    const labels = YAML.parse(readFileSync(labelsPath, "utf8"));
    // Prefix match on purpose, as the runner does: it pulls the fixture-local
    // `evidence_reasons_required` controls in with `evidence_reasons`. A future oracle sharing the
    // prefix would be swept in too; its leaves would then surface as unlabelled cells.
    const prefix = labels.oracle ?? "evidence_reasons";
    oracleName = prefix;
    say(`   labels ${labelsFile} (oracle ${prefix}, commit ${labels.commit ?? "-"})`);
    const mine = entries.filter((e) => e.labelsFile === labelsFile);
    const { cells, problems: dup } = collect(mine, (_, leaf) => leaf.oracle.startsWith(prefix), (_, leaf) => `${leaf.document} ${leaf.rowId || "(no row)"}`);
    problems.push(...dup);
    const labelled = new Set();
    for (const [doc, spec] of Object.entries(labels.documents ?? {})) {
      for (const [rowId, cell] of Object.entries(spec.rows ?? {})) {
        const name = `${doc} ${rowId}`;
        labelled.add(name);
        if (cell?.label !== "holds" && cell?.label !== "fails") { problems.push(`${name}: no expectation (label ${cell?.label}) in ${labelsFile}`); continue; }
        const readings = readingsFor(name, cells.get(name), repeats, problems);
        if (readings.length === 0) continue;
        const heldOut = cell.held_out ?? spec.held_out ?? false;
        const counted = cell.counted ?? spec.counted ?? true;
        const population = heldOut ? "held-out" : counted === false ? "control" : cell.rewritten !== undefined ? "rewritten" : "counted";
        cellsOut.push({ name, doc, rowId, expected: cell.label, population, status: cell.rewritten !== undefined ? `rewritten ${cell.rewritten}` : `since ${cell.since ?? "-"}`,
          confidence: cell.confidence ?? "-", readings, agg: aggregate(readings), verdict05: readings[0].verdict });
      }
    }
    for (const name of cells.keys()) if (!labelled.has(name)) problems.push(`${name}: unlabelled cell (a ${prefix} leaf with no label in ${labelsFile})`);
  }
  const plan = (c) => c.population === "counted" || c.population === "rewritten";
  say("   cells (p = min of the repeats' peaks; side = the min-peak repeat's answer; h/f/u)");
  printCells(say, cellsOut, ["document", "row", "status", "conf"], (c) => [c.doc.replace(/^([^/]+\/\d+)-.*$/, "$1"), c.rowId, c.status, c.confidence]);
  say("");
  say("   per t (populations apart; 'counted+rewritten' is the plan's n)");
  const populations = [
    ["counted", (c) => c.population === "counted"],
    ["rewritten", (c) => c.population === "rewritten"],
    ["counted+rewritten", plan],
    ["control", (c) => c.population === "control"],
    ["held-out", (c) => c.population === "held-out"],
  ];
  const rows = printSweep(say, populations, cellsOut);
  say("");
  say("   documents, oracle-local verdict per t (NO-GO if a cell is decided fails, else NEEDS-REVIEW if one is unknown, else PASS); run verdict at 0.5 from rep 1");
  const docs = [...new Set(cellsOut.map((c) => c.doc))];
  table(say, ["population", "document", "run@0.5", ...THRESHOLDS.map((t) => `@${t}`), "unknown rows at 0.7"], docs.map((doc) => {
    const list = cellsOut.filter((c) => c.doc === doc);
    const v = (t) => (list.some((c) => c.agg.sides[t] === "fails") ? "NO-GO" : list.some((c) => c.agg.sides[t] === "unknown") ? "NEEDS-REVIEW" : "PASS");
    return [[...new Set(list.map((c) => c.population))].join("+"), doc, list[0].verdict05 ?? "-", ...THRESHOLDS.map(v),
      list.filter((c) => c.agg.sides[0.7] === "unknown").map((c) => c.rowId.split("#")[1]).join(",") || "-"];
  }));
  for (const t of THRESHOLDS) {
    const nr = docs.filter((doc) => { const l = cellsOut.filter((c) => c.doc === doc); return !l.some((c) => c.agg.sides[t] === "fails") && l.some((c) => c.agg.sides[t] === "unknown"); });
    say(`   NEEDS-REVIEW at ${t}: ${nr.join(", ") || "none"}`);
  }
  say("");
  const band = printSortedP(say, "counted+rewritten", cellsOut.filter(plan));
  for (const [name, pick] of populations.filter(([n]) => n !== "counted+rewritten")) {
    const list = cellsOut.filter(pick);
    if (list.length > 0) say(`   sorted p, ${name} (apart, n=${list.length}): ${[...list].sort((a, b) => (a.agg.p ?? -1) - (b.agg.p ?? -1)).map((c) => `${fmt(c.agg.p)}${short(c.agg.answer)}`).join(" ")}`);
  }
  const planCells = cellsOut.filter(plan);
  const wrong05 = planCells.filter((c) => judgement(c.agg.sides[0.5], c.expected) === "wrong").length;
  say(`   30% rule: wrong-side decided at 0.5 = ${wrong05}/${planCells.length} (${pct(wrong05, planCells.length)}) -> ${planCells.length > 0 && wrong05 / planCells.length > 0.3 ? "ABOVE 30%: the question, not the threshold" : "not above 30%"}`);
  printFlips(say, planCells, "counted+rewritten");
  return { kind: "real", oracle: oracleName, cells: cellsOut, rows, band };
}

// ---------------------------------------------------------------- seeded fixtures

function fixtureSets(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(path.join(dir, d.name, "fixtures.yaml")))
    .map((d) => YAML.parse(readFileSync(path.join(dir, d.name, "fixtures.yaml"), "utf8")));
}

function fixtures(dir, ledger, entries, repeats, problems, opts, say) {
  const sets = fixtureSets(dir);
  const { map: batched, used } = batchedSources(dir, opts.batchedLedgers);
  say(`   old batched p from: ${used.join(", ") || "none present (column blank)"}`);
  const oracles = [...new Set(entries.map((e) => e.fixture.split("/")[0]))];
  const cellsOut = [];
  let oracleName;
  for (const oracle of oracles) {
    oracleName = oracle;
    const spec = sets.find((s) => s.oracle === oracle);
    if (spec === undefined) { problems.push(`${ledger}: no fixtures.yaml for ${oracle}`); continue; }
    const mine = entries.filter((e) => e.fixture.startsWith(`${oracle}/`));
    const ran = new Set(mine.map((e) => e.fixture.split("/").slice(1).join("/")));
    for (const name of ran) if (!spec.fixtures.some((f) => f.name === name)) problems.push(`${oracle}/${name}: in the sidecar, not in fixtures.yaml`);
    for (const fixture of spec.fixtures) {
      const fx = `${oracle}/${fixture.name}`;
      if (!ran.has(fixture.name)) { problems.push(`${fx}: no ${opts.shape} entry in the sidecar`); continue; }
      const sections = fixture.sections ?? spec.atom.sections;
      const { cells, problems: dup } = collect(mine.filter((e) => e.fixture === fx),
        (_, leaf) => leaf.oracle === oracle && (!spec.atom.per_row || sections.includes((leaf.rowId || "").split("#")[0])),
        (_, leaf) => leaf.row || "-");
      problems.push(...dup);
      const rowNames = spec.atom.per_row ? Array.from({ length: spec.atom.rows }, (_, i) => `row${i + 1}`) : ["-"];
      for (const name of cells.keys()) if (!rowNames.includes(name)) problems.push(`${fx} ${name}: unlabelled cell (no row of fixtures.yaml)`);
      for (const row of rowNames) {
        const expected = fixture.expect_cells?.[row] ?? fixture.expect;
        const name = `${fx} ${row}`;
        if (expected !== "holds" && expected !== "fails") { problems.push(`${name}: no expectation (expect ${expected}) in fixtures.yaml`); continue; }
        const byRepeat = cells.get(row);
        const readings = readingsFor(name, byRepeat, repeats, problems);
        if (readings.length === 0) continue;
        for (const { leaf } of byRepeat.values()) if (leaf.expect !== null && leaf.expect !== undefined && leaf.expect !== expected) problems.push(`${name}: sidecar expect ${leaf.expect} != fixtures.yaml ${expected}`);
        const miss = KNOWN_MISS.has(fx);
        const old = batched.get(`${fx} ${row}`);
        cellsOut.push({ name, fixture: fixture.name, row, expected, expectShown: miss ? `miss(${expected})` : expected,
          population: miss ? "known-miss" : expected === "holds" ? "genuine" : "defective", readings, agg: aggregate(readings),
          batched: old === undefined ? "" : `${fmt(old.p)}${short(old.answer)}` });
      }
    }
  }
  say("   seeded cells (p = min of the repeats' peaks; batched = the old batched p of rounds 4/4c, blank if absent)");
  printCells(say, cellsOut, ["fixture", "row", "batched"], (c) => [c.fixture, c.row, c.batched || " "]);
  say("");
  say("   per t (a genuine cell to unknown is a loss; a defective wrong holds to unknown a gain; a one-repeat move a flip)");
  const populations = [
    ["genuine", (c) => c.population === "genuine"],
    ["defective", (c) => c.population === "defective"],
    ["seeded (genuine+defective)", (c) => c.population !== "known-miss"],
    ["known-miss (apart)", (c) => c.population === "known-miss"],
  ];
  const rows = printSweep(say, populations, cellsOut);
  for (const t of THRESHOLDS.slice(1)) {
    const lost = cellsOut.filter((c) => c.population === "genuine" && c.agg.sides[t] === "unknown" && moveAt(c, t) !== "flip");
    say(`   genuine cells to unknown at ${t}: ${lost.length}${lost.length ? ` [${lost.map((c) => c.name).join("; ")}]` : ""}`);
  }
  printFlips(say, cellsOut.filter((c) => c.population !== "known-miss"), "seeded");
  return { kind: "seeded", oracle: oracleName, cells: cellsOut, rows };
}

// ---------------------------------------------------------------- the bar, per oracle

/** Informational: the plan's bar per oracle and t when a real and a seeded ledger of it ran. */
function printBar(say, results) {
  const real = results.filter((r) => r.kind === "real");
  const seeded = results.filter((r) => r.kind === "seeded");
  const oracles = [...new Set(real.map((r) => r.oracle))];
  if (oracles.length === 0) return;
  say("== the plan's bar per oracle (informational; the verdict decides): wrong-side falls by >= 2, right-side by <= 1 on counted+rewritten, no genuine seeded cell to unknown");
  const rows = [];
  for (const oracle of oracles) {
    const cells = real.filter((r) => r.oracle === oracle).flatMap((r) => r.cells).filter((c) => c.population === "counted" || c.population === "rewritten");
    const seed = seeded.filter((r) => r.oracle.startsWith(oracle) || oracle.startsWith(r.oracle)).flatMap((r) => r.cells).filter((c) => c.population === "genuine");
    const count = (t, j) => cells.filter((c) => judgement(c.agg.sides[t], c.expected) === j).length;
    for (const t of THRESHOLDS.slice(1)) {
      const wrongFall = count(0.5, "wrong") - count(t, "wrong");
      const rightFall = count(0.5, "right") - count(t, "right");
      const lost = seed.filter((c) => c.agg.sides[t] === "unknown" && moveAt(c, t) !== "flip").length;
      const share = cells.length === 0 ? 0 : count(0.5, "wrong") / cells.length;
      rows.push([oracle, t, cells.length, wrongFall, rightFall, seed.length === 0 ? "no seeded ledger" : lost,
        share > 0.3 ? "no (30% rule)" : wrongFall >= 2 && rightFall <= 1 && seed.length > 0 && lost === 0 ? "yes" : "no"]);
    }
  }
  table(say, ["oracle", "t", "n", "wrong-side fall", "right-side fall", "genuine seeded to unknown", "meets"], rows);
  say("");
}

// ---------------------------------------------------------------- driver

function sweep(dir, ledgers, opts) {
  const lines = [];
  const say = (s = "") => lines.push(s);
  say(`threshold-sweep (no judge calls); t in {${THRESHOLDS.join(", ")}}, decided iff p >= t; sidecars in ${dir}`);
  say("");
  const results = ledgers.map((ledger) => sweepLedger(dir, ledger, opts, say));
  printBar(say, results);
  const problems = results.flatMap((r) => r.problems);
  for (const problem of problems) say(`offending: ${problem}`);
  const complete = problems.length === 0;
  say(`complete: ${complete}`);
  return { complete, problems, results, text: lines.join("\n") };
}

function parseArgs(argv) {
  const opts = { shape: "per-atom", repeats: undefined, mock: false, batchedLedgers: [], dir: path.join(here, "oracle-fixtures"), ledgers: [], selfTest: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--self-test") opts.selfTest = true;
    else if (a === "--shape") opts.shape = argv[++i];
    else if (a === "--mock") opts.mock = true;
    else if (a === "--repeats") opts.repeats = Number(argv[++i]);
    else if (a === "--batched-ledger") opts.batchedLedgers.push(argv[++i]);
    else if (a === "--fixtures-dir") opts.dir = path.resolve(argv[++i]);
    else if (a.startsWith("--")) return { error: `unknown flag ${a}` };
    else opts.ledgers.push(a);
  }
  if (opts.shape === undefined || (opts.repeats !== undefined && !(opts.repeats >= 1))) return { error: "bad --shape or --repeats" };
  return opts;
}

// ---------------------------------------------------------------- self-test

function leaf(document, rowId, answered, p, extra = {}) {
  const dist = answered === "unknown" ? [0, 0, p] : answered === "holds" ? [p, +(1 - p).toFixed(4), 0] : [+(1 - p).toFixed(4), p, 0];
  return { document, rowId, row: rowId.split("#")[1] ?? "", oracle: extra.oracle ?? "evidence_reasons", answered, label: p >= 0.5 ? answered : "unknown",
    options: ["holds", "fails", "unknown"], distribution: dist, p, verdict: extra.verdict ?? "PASS", expect: extra.expect ?? null, lead: null };
}

function writeFixture(dir, mutate) {
  mkdirSync(path.join(dir, "real-cells"), { recursive: true });
  mkdirSync(path.join(dir, "st_oracle"), { recursive: true });
  const labels = {
    oracle: "evidence_reasons",
    documents: {
      "goals/91-a.md": { rows: {
        "ac#row1": { label: "holds", since: "round-10" },
        "ac#row2": { label: "fails", since: "round-10" },
        "ac#row3": { label: "fails", rewritten: "round-6" },
      } },
      "goals/92-control.md": { counted: false, rows: { "ac#row1": { label: "fails", since: "round-4" } } },
      "goals/93-held.md": { held_out: true, rows: { "ac#row1": { label: "holds", since: "round-10" } } },
    },
  };
  const spec = {
    oracle: "st_oracle", atom: { sections: ["ac"], per_row: true, rows: 2 },
    fixtures: [{ name: "good", expect: "holds" }, { name: "bad", expect: "fails", expect_cells: { row2: "fails" } }],
  };
  // Real cells: row1 p exactly 0.6 (defect 1), row2 wrong-side at 0.9, row3 right-side 0.8.
  const real = (r) => [
    leaf("goals/91-a.md", "ac#row1", "holds", 0.6),
    leaf("goals/91-a.md", "ac#row2", "holds", 0.9),
    leaf("goals/91-a.md", "ac#row3", "fails", 0.8),
    leaf("goals/92-control.md", "ac#row1", "holds", 0.7, { oracle: "evidence_reasons_required" }),
    leaf("goals/93-held.md", "ac#row1", "holds", 0.95),
    leaf("goals/91-a.md", "", "holds", 0.9, { oracle: "coverage_complete" }),
  ].map((l) => ({ ...l, repeat: r }));
  const realRuns = [1, 2].map((r) => ({ run: "real-cells:labels-st.yaml", mode: "real-cells", fixture: "labels-st.yaml", arm: "normal", repeat: r, shape: "per-atom",
    tag: "SELFTEST", model: "none", labelsFile: "labels-st.yaml", leaves: real(r) }));
  const seed = (name, r) => (name === "good"
    ? [leaf("d.md", "ac#row1", "holds", 0.65, { oracle: "st_oracle", expect: "holds" }), leaf("d.md", "ac#row2", "holds", 0.9, { oracle: "st_oracle", expect: "holds" })]
    : [leaf("d.md", "ac#row1", "holds", 0.55, { oracle: "st_oracle", expect: "fails" }), leaf("d.md", "ac#row2", "fails", 0.95, { oracle: "st_oracle", expect: "fails" })])
    .map((l) => ({ ...l, repeat: r }));
  const seedRuns = ["good", "bad"].flatMap((name) => [1, 2].map((r) => ({ run: `fixtures:st_oracle/${name}`, mode: "fixtures", fixture: `st_oracle/${name}`, arm: "normal",
    repeat: r, shape: "per-atom", tag: "SELFTEST", model: "none", labelsFile: null, leaves: seed(name, r) })));
  const sidecars = { "st-real": { ledger: "st-real", runs: realRuns }, "st-seed": { ledger: "st-seed", runs: seedRuns },
    "round4c-st": { ledger: "round4c-st", runs: [{ run: "fixtures:st_oracle/bad", mode: "fixtures", fixture: "st_oracle/bad", arm: "normal", repeat: 1, shape: "batched",
      tag: "SELFTEST", leaves: [leaf("d.md", "ac#row1", "holds", 0.51, { oracle: "st_oracle" })] }] } };
  mutate?.(sidecars);
  sidecars.__labels?.(labels);
  sidecars.__fixtures?.(spec);
  delete sidecars.__labels;
  delete sidecars.__fixtures;
  writeFileSync(path.join(dir, "real-cells", "labels-st.yaml"), YAML.stringify(labels));
  writeFileSync(path.join(dir, "st_oracle", "fixtures.yaml"), YAML.stringify(spec));
  for (const [name, sc] of Object.entries(sidecars)) writeFileSync(path.join(dir, `.leaves-${name}.json`), JSON.stringify(sc));
}

function selfTest() {
  const opts = { shape: "per-atom", repeats: undefined, mock: false, batchedLedgers: [] };
  const cases = [];
  const run = (name, mutate, check) => {
    const dir = mkdtempSync(path.join(tmpdir(), "threshold-sweep-"));
    try {
      writeFixture(dir, mutate);
      const res = sweep(dir, ["st-real", "st-seed"], opts);
      const failures = check(res);
      cases.push({ name, ok: failures.length === 0, failures, res });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  };
  const cell = (res, name) => res.results.flatMap((r) => r.cells ?? []).find((c) => c.name === name);
  const expectAll = (pairs) => pairs.filter(([ok]) => !ok).map(([, msg]) => msg);

  run("baseline (clean sidecar)", undefined, (res) => {
    const a = cell(res, "goals/91-a.md ac#row1");
    const w = cell(res, "goals/91-a.md ac#row2");
    const g = cell(res, "st_oracle/good row1");
    const b = cell(res, "st_oracle/bad row1");
    return expectAll([
      [res.complete === true, "baseline not complete"],
      [w && judgement(w.agg.sides[0.5], w.expected) === "wrong", "row2 not wrong-side at 0.5"],
      [cell(res, "goals/92-control.md ac#row1")?.population === "control", "control not apart"],
      [cell(res, "goals/93-held.md ac#row1")?.population === "held-out", "held-out not apart"],
      [cell(res, "goals/91-a.md ac#row3")?.population === "rewritten", "rewritten not apart"],
      [g && moveAt(g, 0.7) === "LOSS" && moveAt(g, 0.6) === "-", "genuine 0.65 not a loss at 0.7 only"],
      [b && moveAt(b, 0.6) === "gain" && b.batched === "0.51h", "defective wrong holds 0.55 not a gain at 0.6, or batched p not joined"],
      [!res.results.flatMap((r) => r.cells ?? []).some((c) => c.agg.labelFlip), "a flip in the clean sidecar"],
      [a !== undefined, "row1 missing"],
    ]);
  });
  run("defect 1: p exactly 0.6 -> decided at 0.6, unknown at 0.7", undefined, (res) => {
    const a = cell(res, "goals/91-a.md ac#row1");
    return expectAll([
      [a?.agg.p === 0.6, "row1 p is not 0.6"],
      [sideAt({ answer: "holds", p: 0.7 - 0.4 + 0.3 }, 0.6) === "holds", "float 0.7-0.4+0.3 (0.5999999999999999, a 0.6 in float noise) not decided at 0.6"],
      [sideAt({ answer: "holds", p: 0.599999 }, 0.6) === "unknown", "0.599999 decided at 0.6 (slack)"],
      [a?.agg.sides[0.6] === "holds", "row1 not decided at 0.6"],
      [a?.agg.sides[0.7] === "unknown", "row1 not unknown at 0.7"],
      [/@0\.6/.test(res.text) && /0\.60h/.test(res.text), "row1 not printed"],
    ]);
  });
  run("defect 2: repeats disagree -> printed as a flip, minimum taken", (sc) => {
    const l = sc["st-real"].runs[1].leaves.find((x) => x.rowId === "ac#row3");
    Object.assign(l, leaf("goals/91-a.md", "ac#row3", "holds", 0.7), { repeat: 2 });
  }, (res) => {
    const c = cell(res, "goals/91-a.md ac#row3");
    return expectAll([
      [c?.agg.labelFlip === true, "no label flip recorded"],
      [c?.agg.p === 0.7 && c?.agg.answer === "holds", `minimum not taken (p ${c?.agg.p}, answer ${c?.agg.answer})`],
      [/label flips 1 \[goals\/91-a\.md ac#row3\]/.test(res.text) && /FLIP/.test(res.text), "flip not printed"],
      [res.complete === true, "a flip must not make the run incomplete"],
    ]);
  });
  run("defect 3: a missing repeat -> complete: false, named", (sc) => {
    const r2 = sc["st-real"].runs[1];
    r2.leaves = r2.leaves.filter((x) => x.rowId !== "ac#row2");
  }, (res) => expectAll([
    [res.complete === false, "complete is not false"],
    [res.problems.some((p) => p === "goals/91-a.md ac#row2: missing repeat 2"), "missing repeat not named"],
    [/offending: goals\/91-a\.md ac#row2: missing repeat 2/.test(res.text), "offending cell not printed"],
  ]));
  run("defect 4: an unlabelled cell -> complete: false, named", (sc) => {
    for (const r of sc["st-real"].runs) r.leaves.push({ ...leaf("goals/91-a.md", "ac#row9", "holds", 0.9), repeat: r.repeat });
  }, (res) => expectAll([
    [res.complete === false, "complete is not false"],
    [res.problems.some((p) => p.startsWith("goals/91-a.md ac#row9: unlabelled cell")), "unlabelled cell not named"],
    [/offending: goals\/91-a\.md ac#row9: unlabelled cell/.test(res.text), "offending cell not printed"],
  ]));

  run("defect 5: a repeat-1-only ledger -> complete: false, missing repeat 2 named", (sc) => {
    sc["st-real"].runs = sc["st-real"].runs.filter((r) => r.repeat === 1);
  }, (res) => expectAll([
    [res.complete === false, "complete is not false"],
    [res.problems.some((p) => p === "goals/91-a.md ac#row1: missing repeat 2"), "missing repeat 2 not named"],
  ]));
  run("defect 6: MOCK-tagged entries without --mock -> complete: false, named", (sc) => {
    for (const r of sc["st-real"].runs) r.tag = "MOCK";
  }, (res) => expectAll([
    [res.complete === false, "complete is not false"],
    [res.problems.some((p) => p.startsWith("st-real: MOCK-tagged entries")), "MOCK not named"],
  ]));
  run("defect 7: a missing expectation -> complete: false, named, not wrong-side", (sc) => {
    sc.__labels = (labels) => { delete labels.documents["goals/91-a.md"].rows["ac#row2"].label; };
    sc.__fixtures = (spec) => { delete spec.fixtures[0].expect; };
  }, (res) => expectAll([
    [res.complete === false, "complete is not false"],
    [res.problems.some((p) => p.startsWith("goals/91-a.md ac#row2: no expectation")), "real cell without a label not named"],
    [res.problems.some((p) => p.startsWith("st_oracle/good row1: no expectation")), "fixture cell without expect not named"],
    [cell(res, "goals/91-a.md ac#row2") === undefined, "the cell without a label was counted"],
  ]));

  console.log("threshold-sweep --self-test (synthetic sidecars in a temp dir; no judge)");
  for (const c of cases) {
    console.log(`  ${c.ok ? "PASS" : "FAIL"}  ${c.name}  (sweep complete: ${c.res.complete})`);
    for (const f of c.failures) console.log(`        ${f}`);
  }
  const ok = cases.every((c) => c.ok);
  console.log(`self-test: ${ok ? "pass" : "FAIL"} (${cases.filter((c) => c.ok).length}/${cases.length})`);
  return ok;
}

// ---------------------------------------------------------------- main

const opts = parseArgs(process.argv.slice(2));
if (opts.error !== undefined || (!opts.selfTest && opts.ledgers.length === 0)) {
  console.log(`${opts.error ?? "no ledger given"}\nusage: threshold-sweep.mjs [--mock] [--shape per-atom] [--repeats N] [--batched-ledger NAME]... [--fixtures-dir DIR] <ledger>... | --self-test`);
  process.exitCode = 2;
} else if (opts.selfTest) {
  process.exitCode = selfTest() ? 0 : 1;
} else {
  const res = sweep(opts.dir, opts.ledgers, opts);
  console.log(res.text);
  process.exitCode = res.complete ? 0 : 1;
}
