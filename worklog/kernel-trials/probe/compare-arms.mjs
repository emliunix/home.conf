// Round 12 comparer: module-variant arms (N none, A address, D another row's address, C address +
// claim) on the same cells, from the runner's leaf sidecars (oracle-test.mjs --variants).
//
//   node worklog/kernel-trials/probe/compare-arms.mjs [--mock] <ledger-prefix>...   e.g. round12-E-fix round12-E-der
//   node worklog/kernel-trials/probe/compare-arms.mjs --self-test
//
// Built from compare-shapes.mjs: its statistics (seeded bootstrap), its sidecar loading by prefix
// and its LIVE/MOCK refusal. A prefix is one track (round-12-preregistration.md §Tracks); its runs
// are partitioned by the arm each run recorded (`variant`).
//
// A cell is (source, document, oracle, row id | section | atom). Its label is the fixture's
// `expect`/`expect_cells` (fixtures) or the lead's label (real cells). A cell is RIGHT under an
// arm when both repeats decide it (label not unknown, p >= threshold) on its label's side, WRONG
// when both decide the other side, UNKNOWN when both are unknown; otherwise it is SPLIT and does
// not move (a cell moves only when both repeats agree, §Tracks). Against arm N:
//   right->wrong, wrong->right   moves between N's state and the arm's
//   unknown loss                 N right, and the arm unknown in some repeat
//   flips                        the arm's two repeats disagree on the label
//   base rate                    no-harm cells whose N repeats sit on different sides, + 1 (§Bars)
//   harm                         right->wrong above the base rate, or more than 2 unknown losses
// Probe cells (the gain, B1): the E-fix fixture `defective-wrongrow` (true label `fails`, the
// fixture's `why`, not its `expect`) and every cell of a generated real document (`source` in its
// labels file: E-der). They are excluded from the no-harm counts. An arm CATCHES a probe cell
// whose label is `fails` when it reads `fails` in both repeats; `ambiguous` cells are reported
// apart. Bars: E-der C >= 7 of 11 and A >= 5 of 11; E-fix wrongrow C >= 3 of 5; D control: D's
// wrongrow catches against A's.
// Near-threshold (reported, not a bar; B2): cells whose N repeat-1 P(label) is in [0.4, 0.8]: the
// arm's repeat 2 minus N's repeat 2, against N repeat 2 minus N repeat 1 as the null, each with a
// bootstrap 90% interval.
// Also per arm: context bytes (median, max), key length (median, max) and its growth over N, and C's
// `fallback` count (atoms whose claim input is [] because no section is keyed by the row).
// Real-cells documents marked `counted: false` or `held_out: true` in their labels file are
// reported apart. `complete: false` (exit 1) when a labelled cell lacks a leaf under some arm and
// repeat, or the sidecars mix judges.
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import YAML from "yaml";

const FIXTURES = path.join(import.meta.dirname, "oracle-fixtures");
const BASE = "N";
const NEAR = [0.4, 0.8];
const BARS = { "E-der": { C: 7, A: 5, of: 11 }, wrongrow: { C: 3, of: 5 } };

// ---------------------------------------------------------------- statistics (compare-shapes.mjs)

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const mean = (xs) => (xs.length === 0 ? NaN : xs.reduce((a, b) => a + b, 0) / xs.length);
function quantile(sorted, q) {
  if (sorted.length === 0) return NaN;
  const at = (sorted.length - 1) * q;
  const lo = Math.floor(at), hi = Math.ceil(at);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (at - lo);
}
const median = (xs) => quantile([...xs].sort((a, b) => a - b), 0.5);
function bootstrap(items, stat, b = 2000, seed = 12) {
  if (items.length === 0) return [NaN, NaN];
  const r = rng(seed);
  const out = [];
  for (let i = 0; i < b; i += 1) {
    const sample = items.map(() => items[Math.floor(r() * items.length)]);
    const v = stat(sample);
    if (Number.isFinite(v)) out.push(v);
  }
  out.sort((x, y) => x - y);
  return [quantile(out, 0.05), quantile(out, 0.95)];
}
const f = (x, d = 2) => (x === undefined || x === null || Number.isNaN(x) ? "-" : x.toFixed(d));

// ---------------------------------------------------------------- cells

const pOf = (leaf, label) => {
  const i = leaf.options.indexOf(label);
  return i < 0 || leaf.distribution.length !== leaf.options.length ? 0 : leaf.distribution[i];
};
/** The labels files real-cells runs name, read once (documents' counted / held_out / source). */
const labelsCache = new Map();
function labelsOf(file) {
  if (file === null || file === undefined) return undefined;
  if (!labelsCache.has(file)) {
    try { labelsCache.set(file, YAML.parse(readFileSync(path.resolve(FIXTURES, "real-cells", file), "utf8"))); } catch { labelsCache.set(file, undefined); }
  }
  return labelsCache.get(file);
}

/** Cells from pooled runs: per cell, the leaves per arm by repeat, its label and its role. */
export function buildCells(runs, labelsLoader = labelsOf) {
  const cells = new Map();
  for (const run of runs) {
    const labels = run.mode === "real-cells" ? labelsLoader(run.labelsFile) : undefined;
    for (const leaf of run.leaves) {
      const cellId = leaf.origRowId || leaf.rowId || leaf.section || leaf.atom;
      const source = run.mode === "real-cells" ? `${leaf.source}:${leaf.document}` : leaf.source;
      const id = `${source}|${leaf.oracle}|${cellId}`;
      let cell = cells.get(id);
      if (cell === undefined) {
        const doc = labels?.documents?.[leaf.document];
        const wrongrow = run.mode === "fixtures" && /\/defective-wrongrow$/.test(leaf.source) && leaf.expect !== null;
        const probe = wrongrow || (doc?.source !== undefined && leaf.lead !== null);
        const label = wrongrow ? "fails" : (leaf.expect ?? leaf.lead ?? null);
        const apart = doc !== undefined && (doc.counted === false || doc.held_out === true);
        cell = { id, source, oracle: leaf.oracle, cellId, mode: run.mode, label, probe, track: wrongrow ? "wrongrow" : probe ? "E-der" : "no-harm", apart, by: {} };
        cells.set(id, cell);
      }
      (cell.by[run.variant] ??= []).push(leaf);
    }
  }
  for (const cell of cells.values()) for (const list of Object.values(cell.by)) list.sort((a, b) => a.repeat - b.repeat);
  return [...cells.values()];
}

const side = (leaf, label) => (leaf.label === "unknown" ? "unknown" : leaf.label === label ? "right" : "wrong");
/** right | wrong | unknown when both repeats agree, else split. */
function stateOf(leaves, label) {
  const sides = new Set(leaves.map((l) => side(l, label)));
  return sides.size === 1 ? [...sides][0] : "split";
}

// ---------------------------------------------------------------- analysis

export function analyse(runs, opts = {}) {
  const problems = [];
  let complete = true;
  const arms = [...new Set(runs.map((r) => r.variant))].filter((v) => v !== null && v !== undefined);
  if (!arms.includes(BASE)) { complete = false; problems.push(`no arm ${BASE} in these sidecars`); }
  const repeats = Math.max(0, ...runs.map((r) => r.repeat));
  const cells = buildCells(runs, opts.labelsLoader);
  const labelled = cells.filter((c) => c.label !== null);
  // Labels found per arm: every labelled cell has a leaf under every arm and repeat.
  const found = Object.fromEntries(arms.map((arm) => [arm, { found: 0, of: labelled.length, missing: [] }]));
  for (const cell of labelled) {
    for (const arm of arms) {
      const reps = new Set((cell.by[arm] ?? []).filter((l) => l.key !== "-" || l.finding !== null).map((l) => l.repeat));
      // A cell is asked once per arm and repeat; a second leaf (a document checked twice) is a gap too.
      const ok = Array.from({ length: repeats }, (_, i) => i + 1).every((r) => reps.has(r)) && (cell.by[arm]?.length ?? 0) === repeats;
      if (ok) found[arm].found += 1; else { found[arm].missing.push(cell.id); complete = false; }
    }
  }
  for (const arm of arms) if (found[arm].missing.length > 0) problems.push(`arm ${arm}: labelled cells without a leaf in every repeat: ${found[arm].missing.slice(0, 6).join("; ")}${found[arm].missing.length > 6 ? ` (+${found[arm].missing.length - 6})` : ""}`);

  const oracles = [...new Set(labelled.map((c) => c.oracle))].sort();
  const perOracle = [];
  for (const oracle of oracles) {
    const mine = labelled.filter((c) => c.oracle === oracle && (c.by[BASE]?.length ?? 0) === repeats);
    const noHarm = mine.filter((c) => !c.probe && !c.apart);
    const baseFlips = noHarm.filter((c) => {
      const sides = c.by[BASE].map((l) => side(l, c.label)).filter((s) => s !== "unknown");
      return sides.includes("right") && sides.includes("wrong");
    }).length;
    const baseRate = baseFlips + 1;
    const rows = [];
    for (const arm of arms) {
      const has = mine.filter((c) => (c.by[arm]?.length ?? 0) === repeats);
      let rw = 0, wr = 0, unk = 0, flips = 0;
      const moved = [];
      for (const c of has.filter((x) => !x.probe && !x.apart)) {
        const n = stateOf(c.by[BASE], c.label), a = stateOf(c.by[arm], c.label);
        if (arm !== BASE && n === "right" && a === "wrong") { rw += 1; moved.push(`${c.cellId} right->wrong`); }
        if (arm !== BASE && n === "wrong" && a === "right") { wr += 1; moved.push(`${c.cellId} wrong->right`); }
        if (arm !== BASE && n === "right" && c.by[arm].some((l) => l.label === "unknown")) unk += 1;
        if (new Set(c.by[arm].map((l) => l.label)).size > 1) flips += 1;
      }
      const probes = has.filter((c) => c.probe && !c.apart);
      const isCaught = (c) => c.label === "fails" && c.by[arm].every((l) => l.label === "fails");
      const caught = probes.filter(isCaught).length;
      const probeFails = probes.filter((c) => c.label === "fails").length;
      const tracks = Object.fromEntries(["wrongrow", "E-der"].map((t) => [t, {
        caught: probes.filter((c) => c.track === t && isCaught(c)).length, of: probes.filter((c) => c.track === t && c.label === "fails").length }]));
      const ambiguous = probes.filter((c) => c.label === "ambiguous").map((c) => `${c.cellId}:${c.by[arm].map((l) => l.label).join("/")}`);
      const leaves = has.flatMap((c) => c.by[arm]);
      const ctx = leaves.map((l) => l.contextBytes ?? 0);
      const keys = leaves.map((l) => l.keyLength ?? l.atom.length);
      const fallback = arm === "C" ? new Set(has.filter((c) => c.by[arm].some((l) => l.atom.includes(", [], "))).map((c) => c.id)).size : null;
      const harm = arm !== BASE && (rw > baseRate || unk > 2);
      rows.push({ arm, cells: has.length, noHarm: has.filter((x) => !x.probe && !x.apart).length, rw, wr, unk, flips, caught, probeFails, tracks, ambiguous, harm, moved,
        ctxMedian: median(ctx), ctxMax: Math.max(0, ...ctx), keyMedian: median(keys), keyMax: Math.max(0, ...keys), fallback });
    }
    const baseRow = rows.find((r) => r.arm === BASE);
    for (const r of rows) r.keyGrowth = baseRow === undefined ? NaN : r.keyMedian - baseRow.keyMedian;
    // Near-threshold: N repeat-1 P(label) in [0.4, 0.8], on the no-harm cells with a two-sided label.
    const near = noHarm.filter((c) => c.by[BASE][0] !== undefined && (c.label === "holds" || c.label === "fails")
      && pOf(c.by[BASE][0], c.label) >= NEAR[0] && pOf(c.by[BASE][0], c.label) <= NEAR[1]);
    const nullD = near.filter((c) => c.by[BASE][1] !== undefined).map((c) => pOf(c.by[BASE][1], c.label) - pOf(c.by[BASE][0], c.label));
    const nearRows = arms.filter((a) => a !== BASE).map((arm) => {
      const ds = near.filter((c) => c.by[arm]?.[1] !== undefined && c.by[BASE][1] !== undefined).map((c) => pOf(c.by[arm][1], c.label) - pOf(c.by[BASE][1], c.label));
      return { arm, n: ds.length, mean: mean(ds), ci: bootstrap(ds, mean), up: ds.filter((d) => d > 0).length };
    });
    const apartCells = mine.filter((c) => c.apart).length;
    perOracle.push({ oracle, baseRate, baseFlips, rows, near: { n: near.length, null: { mean: mean(nullD), ci: bootstrap(nullD, mean) }, rows: nearRows }, apartCells });
  }
  return { complete, problems, arms, repeats, found, perOracle };
}

/** The pre-registered bars, read off one analysis (a track's bars apply only where its probes are). */
export function bars(result) {
  const lines = [];
  for (const o of result.perOracle) {
    const row = (arm) => o.rows.find((r) => r.arm === arm);
    const der = row(BASE)?.tracks["E-der"].of ?? 0;
    if (der > 0) {
      for (const arm of ["C", "A"]) if (row(arm) !== undefined) {
        const caught = row(arm).tracks["E-der"].caught;
        lines.push({ oracle: o.oracle, bar: `E-der ${arm} >= ${BARS["E-der"][arm]} of ${der}`, value: caught, met: caught >= BARS["E-der"][arm] });
      }
    }
    const wrong = row(BASE)?.tracks.wrongrow.of ?? 0;
    if (wrong > 0) {
      if (row("C") !== undefined) lines.push({ oracle: o.oracle, bar: `E-fix wrongrow C >= ${BARS.wrongrow.C} of ${wrong}`, value: row("C").tracks.wrongrow.caught, met: row("C").tracks.wrongrow.caught >= BARS.wrongrow.C });
      if (row("D") !== undefined && row("A") !== undefined) {
        const d = row("D").tracks.wrongrow.caught, a = row("A").tracks.wrongrow.caught;
        lines.push({ oracle: o.oracle, bar: "D control: A's wrongrow catches are not matched by D (else length)", value: `D ${d}, A ${a}`, met: !(a > 0 && d >= a) });
      }
    }
  }
  for (const o of result.perOracle) for (const r of o.rows.filter((x) => x.arm !== BASE)) {
    lines.push({ oracle: o.oracle, bar: `no harm ${r.arm}: right->wrong <= base rate ${o.baseRate}, unknown losses <= 2`, value: `${r.rw}, ${r.unk}`, met: !r.harm });
  }
  return lines;
}

// ---------------------------------------------------------------- report

function table(header, rows) {
  const widths = header.map((h, i) => Math.max(String(h).length, ...rows.map((r) => String(r[i]).length)));
  const line = (r) => `  ${r.map((c, i) => String(c).padEnd(widths[i])).join("  ")}`;
  console.log(line(header));
  console.log(line(widths.map((w) => "-".repeat(w))));
  for (const r of rows) console.log(line(r));
}
function report(name, r) {
  console.log(`== ${name}: arms ${r.arms.join(",")}, ${r.repeats} repeats`);
  console.log("labels found per arm (every labelled cell, every repeat)");
  table(["arm", "found"], r.arms.map((a) => [a, `${r.found[a].found}/${r.found[a].of}`]));
  for (const o of r.perOracle) {
    console.log("");
    console.log(`oracle ${o.oracle}: base rate ${o.baseRate} (N repeats on different sides: ${o.baseFlips}, + 1)${o.apartCells > 0 ? `; ${o.apartCells} cells reported apart (counted: false / held_out)` : ""}`);
    table(["arm", "cells", "no-harm", "right->wrong", "wrong->right", "unknown loss", "flips", "caught", "ambiguous", "harm", "ctx bytes med/max", "key len med/max", "key growth", "fallback"],
      o.rows.map((x) => [x.arm, x.cells, x.noHarm, x.rw, x.wr, x.unk, x.flips, Object.entries(x.tracks).filter(([, t]) => t.of > 0).map(([n, t]) => `${n} ${t.caught}/${t.of}`).join(", ") || "-", x.ambiguous.join(" ") || "-",
        x.arm === BASE ? "-" : x.harm ? "HARM" : "no", `${f(x.ctxMedian, 0)}/${x.ctxMax}`, `${f(x.keyMedian, 0)}/${x.keyMax}`, x.arm === BASE ? "-" : f(x.keyGrowth, 0), x.fallback ?? "-"]));
    for (const x of o.rows) if (x.moved.length > 0) console.log(`  moved under ${x.arm}: ${x.moved.join("; ")}`);
    console.log(`  near-threshold (N repeat-1 P in [${NEAR.join(", ")}], n=${o.near.n}; reported, not a bar): null N rep2 - rep1 ${f(o.near.null.mean)} [${f(o.near.null.ci[0])}, ${f(o.near.null.ci[1])}]`);
    for (const x of o.near.rows) console.log(`    ${x.arm} rep2 - N rep2: ${f(x.mean)} [${f(x.ci[0])}, ${f(x.ci[1])}] over ${x.n}, ${x.up} up`);
  }
  console.log("");
  console.log("bars");
  const b = bars(r);
  table(["oracle", "bar", "value", "met"], b.map((x) => [x.oracle, x.bar, x.value, x.met ? "yes" : "NO"]));
  for (const p of r.problems) console.log(`problem: ${p}`);
  console.log(`complete: ${r.complete}`);
}

export function tagProblem(runs, allowMock) {
  const tags = [...new Set(runs.map((r) => r.tag ?? "untagged"))];
  if (tags.includes("MOCK") && tags.some((t) => t !== "MOCK")) return `mixed-tags: sidecars mix ${tags.join("+")} runs; re-run the MOCK entries live or remove them`;
  if (tags.includes("MOCK") && !allowMock) return "mock-without-flag: every run is MOCK; pass --mock to compare mock sidecars (wiring only, not a measurement)";
  return undefined;
}
function loadPrefix(prefix) {
  const files = readdirSync(FIXTURES).filter((n) => n.startsWith(`.leaves-${prefix}`) && n.endsWith(".json")).sort();
  return { files, runs: files.flatMap((n) => JSON.parse(readFileSync(path.join(FIXTURES, n), "utf8")).runs) };
}

// ---------------------------------------------------------------- self-test

/**
 * Synthetic sidecar runs over arms N, A, D, C and two repeats: ten no-harm fixture cells (`holds`),
 * five wrongrow cells (expect holds, true label fails), and a real-cells probe document of 11
 * `fails` cells and one `ambiguous`. Mutations seed what each bar and count must see.
 */
function synthetic(mutate = {}) {
  const arms = ["N", "A", "D", "C"];
  const options = ["holds", "fails", "unknown"];
  const leaf = (o) => ({ order: "normal", key: "k", finding: null, threshold: 0.5, options, contextBytes: o.arm === "N" ? 0 : 120, keyLength: o.arm === "N" ? 60 : 160, ...o,
    distribution: options.map((x) => (x === o.label ? o.p ?? 0.9 : (1 - (o.p ?? 0.9)) / 2)) });
  const runs = [];
  for (const repeat of [1, 2]) {
    for (const arm of arms) {
      const fx = [];
      for (let i = 1; i <= 10; i += 1) {
        let label = "holds", p = i === 7 ? 0.6 : 0.9;
        if (mutate.harm && arm === "A" && (i === 1 || i === 2 || i === 3)) label = "fails";
        if (mutate.split && arm === "A" && i === 4 && repeat === 2) label = "fails";
        if (mutate.baseNoise && arm === "N" && i === 5 && repeat === 2) label = "fails";
        if (mutate.unknown && arm === "C" && i <= 3) label = "unknown";
        if (mutate.missing && arm === "D" && i === 9 && repeat === 2) continue;
        fx.push(leaf({ arm, repeat, source: "evidence_reasons/good", oracle: "evidence_reasons", atom: `g.evidence_reasons(d, ac#row${i}, Evidence)`, rowId: `ac#row${i}`, origRowId: `ac#row${i}`, label, p, expect: "holds", lead: null }));
      }
      for (let i = 1; i <= 5; i += 1) {
        const caught = (arm === "C" && i <= (mutate.weakC ? 2 : 4)) || (arm === "A" && i <= 2) || (arm === "D" && i <= (mutate.dLikeA ? 2 : 0));
        fx.push(leaf({ arm, repeat, source: "evidence_reasons/defective-wrongrow", oracle: "evidence_reasons", atom: `g.evidence_reasons(d, ac#row${i}, ${arm === "C" && i === 5 ? "[], " : ""}Evidence)`, rowId: `ac#row${i}`, origRowId: `ac#row${i}`,
          label: caught ? "fails" : "holds", expect: "holds", lead: null }));
      }
      runs.push({ run: `syn#${arm}`, mode: "fixtures", variant: arm, repeat, tag: "LIVE", labelsFile: null, leaves: fx });
      const der = [];
      for (let i = 1; i <= 12; i += 1) {
        const lead = i === 12 ? "ambiguous" : "fails";
        const caught = (arm === "C" && i <= (mutate.weakDer ? 6 : 8)) || (arm === "A" && i <= 5) || (arm === "N" && i <= 1);
        der.push(leaf({ arm, repeat, source: "deranged.yaml", document: "deranged/g.md", oracle: "evidence_reasons", atom: `g.evidence_reasons(deranged/g.md, ev#row${i}, Evidence)`, rowId: `ev#row${i}`, origRowId: `ev#row${i}`,
          label: caught ? "fails" : "holds", expect: null, lead }));
      }
      runs.push({ run: `syn-der#${arm}`, mode: "real-cells", variant: arm, repeat, tag: "LIVE", labelsFile: "deranged.yaml", leaves: der });
    }
  }
  return runs;
}
const SYN_LABELS = () => ({ documents: { "deranged/g.md": { source: "goals/g.md" } } });

function selfTest() {
  const run = (m) => analyse(synthetic(m), { labelsLoader: SYN_LABELS });
  const ev = (r) => r.perOracle.find((o) => o.oracle === "evidence_reasons");
  const row = (r, arm) => ev(r).rows.find((x) => x.arm === arm);
  const bar = (r, text) => bars(r).find((b) => b.bar.startsWith(text));
  const clean = run({});
  const checks = [
    ["clean: complete, labels found 27/27 under every arm", clean.complete && clean.arms.every((a) => clean.found[a].found === 27 && clean.found[a].of === 27)],
    ["clean: no harm under any arm, base rate 1", ev(clean).baseRate === 1 && ev(clean).rows.every((x) => !x.harm)],
    ["clean: wrongrow C caught 4/5 (bar met), D control met (D 0 < A 2)", row(clean, "C").tracks.wrongrow.caught === 4 && bar(clean, "E-fix wrongrow C").met && bar(clean, "D control").met],
    ["clean: C fallback counted once (wrongrow row5 has Q = [])", row(clean, "C").fallback === 1],
    ["clean: context bytes and key growth per arm", row(clean, "A").ctxMedian === 120 && row(clean, "N").ctxMedian === 0 && row(clean, "A").keyGrowth === 100],
    ["seeded harm: three right->wrong under A above base rate 1 -> HARM", (() => { const r = run({ harm: true }); return row(r, "A").rw === 3 && row(r, "A").harm && !bar(r, "no harm A").met; })()],
    ["seeded split: a cell whose repeats disagree does not move, and counts as a flip", (() => { const r = run({ split: true }); return row(r, "A").rw === 0 && row(r, "A").flips === 1; })()],
    ["seeded N noise: base rate rises to 2", ev(run({ baseNoise: true })).baseRate === 2],
    ["seeded unknowns: 3 unknown losses under C -> HARM", (() => { const r = run({ unknown: true }); return row(r, "C").unk === 3 && row(r, "C").harm; })()],
    ["seeded missing leaf under D: complete false, D found 26/27", (() => { const r = run({ missing: true }); return !r.complete && r.found.D.found === 26; })()],
    ["seeded weak C on wrongrow: bar not met", !bar(run({ weakC: true }), "E-fix wrongrow C").met],
    ["seeded D like A: D control not met", !bar(run({ dLikeA: true }), "D control").met],
    ["seeded weak C on E-der: C >= 7 not met", !bar(run({ weakDer: true }), "E-der C").met],
    ["tags: LIVE+MOCK refused; all-MOCK needs --mock", tagProblem([{ tag: "LIVE" }, { tag: "MOCK" }], true)?.startsWith("mixed") && tagProblem([{ tag: "MOCK" }], false)?.startsWith("mock-without") && tagProblem([{ tag: "MOCK" }], true) === undefined],
  ];
  const derC = bar(clean, "E-der C"), derA = bar(clean, "E-der A");
  checks.push(["clean: E-der C 8 of 11 (met), A 5 of 11 (met), the ambiguous cell reported apart", derC?.value === 8 && derC.met && derA?.value === 5 && derA.met && row(clean, "C").ambiguous.length === 1]);
  report("self-test clean", clean);
  console.log("");
  for (const [name, ok] of checks) console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  const ok = checks.every(([, x]) => x);
  console.log(`self-test: ${ok ? "pass" : "FAIL"}`);
  return ok;
}

// ---------------------------------------------------------------- main

const rawArgv = process.argv.slice(2);
const ALLOW_MOCK = rawArgv.includes("--mock");
const argv = rawArgv.filter((a) => a !== "--mock");
if (argv.includes("--self-test")) {
  process.exitCode = selfTest() ? 0 : 1;
} else if (argv.length === 0) {
  console.log("usage: compare-arms.mjs [--mock] <ledger-prefix>... | --self-test");
  process.exitCode = 2;
} else {
  let all = true;
  for (const prefix of argv) {
    const { files, runs } = loadPrefix(prefix);
    if (runs.length === 0) { console.log(`== ${prefix}: no sidecar .leaves-${prefix}*.json`); console.log("complete: false"); all = false; continue; }
    console.log(`(${files.join(", ")}; tags ${[...new Set(runs.map((r) => r.tag))].join(",")}; models ${[...new Set(runs.map((r) => r.model))].join(",")})`);
    const refused = tagProblem(runs, ALLOW_MOCK);
    if (refused !== undefined) { console.log(`== ${prefix}: refused`); console.log(`problem: ${refused}`); console.log("complete: false"); all = false; console.log(""); continue; }
    const r = analyse(runs);
    report(prefix, r);
    all &&= r.complete;
    console.log("");
  }
  console.log(`complete (all prefixes): ${all}`);
  process.exitCode = all ? 0 : 1;
}
