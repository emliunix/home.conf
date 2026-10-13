// Round 6 comparer: batched against per-atom on the same atoms, from the runner's leaf sidecars.
//
//   node worklog/kernel-trials/probe/compare-shapes.mjs <ledger-prefix>...   e.g. round6-B round6-C2 round6-real
//   node worklog/kernel-trials/probe/compare-shapes.mjs --self-test
//
// A prefix P reads every oracle-fixtures/.leaves-P*.json (one ABBA invocation's `.leaves-P.json`, or
// the split `.leaves-P-batched.json` / `.leaves-P-atom.json`, or `.leaves-P-goal.json` ...), pools
// their runs and partitions them by the shape each run recorded.
//
// Units. A cell is (arm, source fixture, oracle, original row id or atom); the normal arm pairs
// batched with per-atom over every repeat. Cells whose evidence text, question and expected label
// are identical (column-only fixtures share most rows with HEAD) are one unit: their values are
// averaged before any statistic, so duplicate cell texts count once.
//
// P(expected side) is the distribution's mass on the cell's expected label (the fixture's
// `expect`/`expect_cells`); a cell without one (real cells, atoms of other oracles in the same
// document) uses P(first label). The primary statistic is the signed shift
// d = mean over repeats of per-atom P(expected) - mean over repeats of batched P(expected),
// over all units and over the near-threshold stratum (batched mean P(expected) in [0.4, 0.8]),
// with a bootstrap 90% CI and a Wilcoxon signed-rank p. The noise floor is the same d between
// repeat 1 and 2 of one shape. A cell's label per shape is its majority label over repeats (ties:
// repeat 1); correctness is that label against the expected one; McNemar is exact (binomial).
// A confident flip: some batched repeat and some per-atom repeat label the cell differently with
// p >= 0.6 on both. Position: the signed shift regressed on the batched atom's relative position
// (actual position / (batch size - 1)), with the cell as a fixed effect, identified by the
// reversed arm (the same cell at a different position; the per-atom side is the cell's normal-arm
// value); a trend is reported when the 90% CI of the slope excludes 0 and |slope| >= 0.05.
// The real cells' agreement with the lead's labels is printed as informational only.
// Round 8: a section-keyed atom (`current_not_history(D, S)`; the runner records `section`, the
// atom's last argument) is keyed by its section id, so a cell pairs batched with per-atom by
// (source, oracle, section) and not by the atom's text; a row atom keeps its original row id.
// `complete: false` when a cell lacks a shape or a repeat, or any batched run split.
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const FIXTURES = path.join(import.meta.dirname, "oracle-fixtures");
const CONF = 0.6;
const TREND = 0.05;
const BATCHED = "batched";
const ATOM = "per-atom";

// ---------------------------------------------------------------- statistics

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
/** Percentile bootstrap 90% CI of `stat` over resampled items. */
function bootstrap(items, stat, b = 2000, seed = 6) {
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
/** Two-sided Wilcoxon signed-rank p: exact (doubled ranks, DP) up to n = 60, normal approximation above. */
function wilcoxon(values) {
  const d = values.filter((v) => Math.abs(v) > 1e-12);
  const n = d.length;
  if (n === 0) return { n, p: 1 };
  const order = d.map((v, i) => [Math.abs(v), i]).sort((a, b) => a[0] - b[0]);
  const rank = new Array(n);
  for (let i = 0; i < n;) {
    let j = i;
    while (j + 1 < n && Math.abs(order[j + 1][0] - order[i][0]) < 1e-12) j += 1;
    for (let k = i; k <= j; k += 1) rank[order[k][1]] = (i + j + 2) / 2;
    i = j + 1;
  }
  const wPlus = d.reduce((a, v, i) => a + (v > 0 ? rank[i] : 0), 0);
  if (n <= 60) {
    const r2 = rank.map((x) => Math.round(2 * x));
    const total = r2.reduce((a, b) => a + b, 0);
    let dist = new Float64Array(total + 1);
    dist[0] = 1;
    for (const r of r2) {
      const next = new Float64Array(total + 1);
      for (let s = 0; s <= total; s += 1) if (dist[s] > 0) { next[s] += dist[s] / 2; if (s + r <= total) next[s + r] += dist[s] / 2; }
      dist = next;
    }
    const w = Math.round(2 * wPlus);
    const mid = total / 2;
    const dev = Math.abs(w - mid);
    let p = 0;
    for (let s = 0; s <= total; s += 1) if (Math.abs(s - mid) >= dev - 1e-9) p += dist[s];
    return { n, p: Math.min(1, p), wPlus };
  }
  const mu = (n * (n + 1)) / 4;
  const sigma = Math.sqrt((n * (n + 1) * (2 * n + 1)) / 24);
  const z = (Math.abs(wPlus - mu) - 0.5) / sigma;
  return { n, p: Math.min(1, 2 * (1 - normalCdf(z))), wPlus };
}
function normalCdf(z) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}
/** Exact two-sided McNemar: binomial(b + c, 1/2) on the discordant counts. */
function mcnemar(b, c) {
  const n = b + c;
  if (n === 0) return 1;
  let tail = 0;
  let coef = 1;
  for (let k = 0; k <= Math.min(b, c); k += 1) {
    tail += coef;
    coef = (coef * (n - k)) / (k + 1);
  }
  return Math.min(1, (2 * tail) / 2 ** n);
}
/** Within-cell (fixed effect) slope of y on x, with a bootstrap over cells. */
function fixedEffectSlope(groups) {
  const usable = groups.filter((g) => g.length >= 2 && new Set(g.map((o) => o.x)).size >= 2);
  const slope = (gs) => {
    let sxy = 0, sxx = 0;
    for (const g of gs) {
      const mx = mean(g.map((o) => o.x)), my = mean(g.map((o) => o.y));
      for (const o of g) { sxy += (o.x - mx) * (o.y - my); sxx += (o.x - mx) ** 2; }
    }
    return sxx === 0 ? NaN : sxy / sxx;
  };
  const beta = slope(usable);
  const ci = bootstrap(usable, slope);
  return { cells: usable.length, beta, ci, trend: Number.isFinite(beta) && (ci[0] > 0 || ci[1] < 0) && Math.abs(beta) >= TREND };
}

// ---------------------------------------------------------------- cells

const pOf = (leaf, label) => {
  const i = leaf.options.indexOf(label);
  return i < 0 || leaf.distribution.length !== leaf.options.length ? 0 : leaf.distribution[i];
};
const expectedLabel = (leaf) => leaf.expect ?? leaf.options[0];
const majority = (labels) => {
  const counts = new Map();
  for (const l of labels) counts.set(l, (counts.get(l) ?? 0) + 1);
  const top = Math.max(...counts.values());
  const winners = [...counts].filter(([, c]) => c === top).map(([l]) => l);
  return winners.length === 1 ? winners[0] : labels[0];
};
function meanDistribution(leaves) {
  const options = leaves[0].options;
  return options.map((o) => mean(leaves.map((l) => pOf(l, o))));
}

/** Cells from pooled runs: per (arm, source, oracle, cell id), the leaves per shape by repeat. */
function buildCells(runs) {
  const cells = new Map();
  for (const run of runs) {
    for (const leaf of run.leaves) {
      if (leaf.key === "-") continue;
      const cellId = leaf.origRowId || leaf.section || leaf.atom;
      // A real-cells run checks several documents under one source (the labels file): the document is part of the cell.
      const source = run.mode === "real-cells" ? `${leaf.source}:${leaf.document}` : leaf.source;
      const id = `${leaf.arm}|${source}|${leaf.oracle}|${cellId}`;
      const cell = cells.get(id) ?? { id, arm: leaf.arm, source, oracle: leaf.oracle, cellId, mode: run.mode, labelsFile: run.labelsFile, by: {} };
      (cell.by[leaf.shape] ??= []).push({ ...leaf, mixed: run.requests[leaf.request]?.mixed ?? false });
      cells.set(id, cell);
    }
  }
  for (const cell of cells.values()) for (const list of Object.values(cell.by)) list.sort((a, b) => a.repeat - b.repeat);
  return cells;
}

function summarise(cell, shape) {
  const leaves = cell.by[shape] ?? [];
  if (leaves.length === 0) return undefined;
  const expected = expectedLabel(leaves[0]);
  const label = majority(leaves.map((l) => l.label));
  const position = leaves[0].request === null || leaves[0].requestSize === null ? null
    : leaves[0].requestSize > 1 ? leaves[0].position / (leaves[0].requestSize - 1) : 0;
  return {
    leaves, expected, label, correct: label === expected,
    pExp: mean(leaves.map((l) => pOf(l, expected))), pExpByRepeat: leaves.map((l) => pOf(l, expected)),
    dist: meanDistribution(leaves), options: leaves[0].options, position, rawPosition: leaves[0].position, size: leaves[0].requestSize,
    textHash: leaves[0].textHash, questionHash: leaves[0].questionHash, mixed: leaves.some((l) => l.mixed),
    hasExpect: leaves[0].expect !== null && leaves[0].expect !== undefined, lead: leaves[0].lead,
  };
}

// ---------------------------------------------------------------- analysis

export function analyse(runs) {
  const problems = [];
  let complete = true;
  for (const run of runs) if (run.split) { complete = false; problems.push(`split: ${run.run} rep ${run.repeat}`); }
  const cells = [...buildCells(runs).values()];
  const normal = cells.filter((c) => c.arm === "normal");
  const reversed = cells.filter((c) => c.arm === "reversed");
  const repeatsOf = (shape) => Math.max(0, ...runs.filter((r) => r.shape === shape).map((r) => r.repeat));
  const wantRep = { [BATCHED]: repeatsOf(BATCHED), [ATOM]: repeatsOf(ATOM) };
  const pairs = [];
  for (const cell of normal) {
    const b = summarise(cell, BATCHED), a = summarise(cell, ATOM);
    if (b === undefined || a === undefined || b.leaves.length !== wantRep[BATCHED] || a.leaves.length !== wantRep[ATOM]) {
      complete = false;
      problems.push(`missing pair: ${cell.id} (batched ${b?.leaves.length ?? 0}/${wantRep[BATCHED]}, per-atom ${a?.leaves.length ?? 0}/${wantRep[ATOM]})`);
      continue;
    }
    const tv = 0.5 * b.dist.reduce((s, x, i) => s + Math.abs(x - a.dist[i]), 0);
    pairs.push({ cell, b, a, d: a.pExp - b.pExp, tv });
  }

  // Confident flips first.
  const flips = [];
  for (const pr of pairs) {
    const hits = [];
    for (const lb of pr.b.leaves) for (const la of pr.a.leaves) {
      if (lb.label !== la.label && (lb.p ?? 0) >= CONF && (la.p ?? 0) >= CONF) hits.push(`b${lb.repeat}/a${la.repeat}`);
    }
    if (hits.length > 0) {
      flips.push({ id: pr.cell.id, combos: hits.join(","), batched: pr.b.leaves.map((l) => `${l.label} ${f(l.p, 2)}`).join(" | "), perAtom: pr.a.leaves.map((l) => `${l.label} ${f(l.p, 2)}`).join(" | ") });
    }
  }

  // Duplicate cell texts collapse into one unit.
  const unitsMap = new Map();
  for (const pr of pairs) {
    const key = pr.b.textHash === null ? pr.cell.id : `${pr.cell.oracle}|${pr.b.questionHash}|${pr.b.textHash}|${pr.b.expected}|${pr.cell.mode}`;
    (unitsMap.get(key) ?? unitsMap.set(key, []).get(key)).push(pr);
  }
  const units = [...unitsMap.values()].map((members) => ({
    members, id: members[0].cell.id, dup: members.length,
    d: mean(members.map((m) => m.d)), bP: mean(members.map((m) => m.b.pExp)), tv: mean(members.map((m) => m.tv)),
    // The stratum's defining value (round 8 plan): the FIRST batched repeat's P(expected), not the repeats' mean.
    bP1: mean(members.map((m) => m.b.pExpByRepeat[0])), bRep1: members[0].b.leaves[0].repeat,
    hasExpect: members[0].b.hasExpect, mode: members[0].cell.mode,
    noiseB: members[0].b.pExpByRepeat.length >= 2 ? mean(members.map((m) => m.b.pExpByRepeat[1] - m.b.pExpByRepeat[0])) : undefined,
    noiseA: members[0].a.pExpByRepeat.length >= 2 ? mean(members.map((m) => m.a.pExpByRepeat[1] - m.a.pExpByRepeat[0])) : undefined,
    mixed: members.some((m) => m.b.mixed), position: mean(members.map((m) => m.b.position ?? 0)),
  }));
  const shift = (list, field = "d") => {
    const xs = list.map((u) => u[field]).filter((x) => x !== undefined);
    return { n: xs.length, mean: mean(xs), meanAbs: mean(xs.map(Math.abs)), maxAbs: xs.length ? Math.max(...xs.map(Math.abs)) : NaN, ci: bootstrap(xs, mean), p: wilcoxon(xs).p };
  };
  const primary = {
    all: shift(units),
    expected: shift(units.filter((u) => u.hasExpect)),
    near: shift(units.filter((u) => u.bP1 >= 0.4 && u.bP1 <= 0.8)),
    mixed: shift(units.filter((u) => u.mixed)),
    pure: shift(units.filter((u) => !u.mixed)),
    noiseB: shift(units, "noiseB"),
    noiseA: shift(units, "noiseA"),
  };

  // Correctness 2x2 over units with an expected label (one representative per duplicate group).
  const twoByTwo = { bothRight: 0, bRightAWrong: 0, bWrongARight: 0, bothWrong: 0 };
  const discordant = [];
  for (const u of units.filter((x) => x.hasExpect && x.mode === "fixtures")) {
    const m = u.members[0];
    if (m.b.correct && m.a.correct) twoByTwo.bothRight += 1;
    else if (!m.b.correct && !m.a.correct) twoByTwo.bothWrong += 1;
    else {
      if (m.b.correct) twoByTwo.bRightAWrong += 1; else twoByTwo.bWrongARight += 1;
      discordant.push({ id: u.id, dup: u.dup, expected: m.b.expected, batched: `${m.b.label} P(exp) ${m.b.pExp.toFixed(2)}`, perAtom: `${m.a.label} P(exp) ${m.a.pExp.toFixed(2)}`, who: m.b.correct ? "batched right" : "per-atom right" });
    }
  }
  const mcnemarP = mcnemar(twoByTwo.bRightAWrong, twoByTwo.bWrongARight);

  // Seeded defects each shape catches the other misses (p >= 0.6 on the fails side).
  const catches = (s) => s.label === "fails" && s.leaves.filter((l) => l.label === "fails" && (l.p ?? 0) >= CONF).length * 2 > s.leaves.length;
  const seeded = pairs.filter((p) => p.cell.mode === "fixtures" && p.b.expected === "fails");
  const missedByBatched = seeded.filter((p) => catches(p.a) && !catches(p.b)).map((p) => p.cell.id);
  const missedByAtom = seeded.filter((p) => catches(p.b) && !catches(p.a)).map((p) => p.cell.id);
  const stricter = pairs.filter((p) => p.cell.mode === "fixtures" && p.b.expected === "holds" && p.a.label === "fails" && p.b.label === "holds").map((p) => p.cell.id);

  // Unknown shares and transitions (repeat 1).
  const shapesOf = (s) => {
    const counts = {};
    for (const p of pairs) for (const l of p[s].leaves) counts[l.leafShape] = (counts[l.leafShape] ?? 0) + 1;
    return counts;
  };
  const transitions = {};
  for (const p of pairs) {
    const key = `${p.b.leaves[0].leafShape} -> ${p.a.leaves[0].leafShape}`;
    transitions[key] = (transitions[key] ?? 0) + 1;
  }

  // Repeat flips per shape.
  const repeatFlips = (s) => pairs.filter((p) => new Set(p[s].leaves.map((l) => l.label)).size > 1).map((p) => p.cell.id);

  // Position: thirds (normal arm, batched) and the fixed-effect slope with the reversed arm.
  const buckets = ["first", "middle", "last"].map((name, k) => {
    const inB = pairs.filter((p) => p.b.size > 1 && Math.min(2, Math.floor(p.b.position * 3 - 1e-9)) === k);
    const fixedK = k === 0 ? pairs.filter((p) => p.b.size === 1) : [];
    const list = [...inB, ...fixedK];
    return { name, n: list.length, meanAbs: mean(list.map((p) => Math.abs(p.d))), disagree: list.length ? list.filter((p) => p.b.label !== p.a.label).length / list.length : NaN };
  });
  const groups = [];
  const pairBy = new Map(pairs.map((p) => [`${p.cell.source}|${p.cell.oracle}|${p.cell.cellId}`, p]));
  for (const rc of reversed) {
    const p = pairBy.get(`${rc.source}|${rc.oracle}|${rc.cellId}`);
    const rb = summarise(rc, BATCHED);
    if (p === undefined || rb === undefined || rb.position === null || p.b.position === null) continue;
    groups.push([{ x: p.b.position, y: p.a.pExp - p.b.pExp }, { x: rb.position, y: p.a.pExp - rb.pExp }]);
  }
  const position = reversed.length === 0 ? { identified: false } : { identified: true, ...fixedEffectSlope(groups) };

  // Cost per shape.
  const cost = {};
  for (const [name, shape, arm] of [[BATCHED, BATCHED, "normal"], [ATOM, ATOM, "normal"], [`${BATCHED} (reversed arm)`, BATCHED, "reversed"]]) {
    const list = runs.filter((r) => r.shape === shape && (r.arm ?? "normal") === arm);
    if (list.length === 0) continue;
    const reqs = list.flatMap((r) => r.requests);
    const main = reqs.filter((r) => r.kind === "main");
    cost[name] = {
      runs: list.length, mainRequests: main.length, questions: main.reduce((a, r) => a + r.questions, 0), followups: reqs.length - main.length,
      stateBytes: main.reduce((a, r) => a + r.stateBytes, 0), wallS: list.reduce((a, r) => a + r.wall_ms, 0) / 1000,
      judgeS: reqs.reduce((a, r) => a + (r.ms ?? 0), 0) / 1000, mixedRequests: main.filter((r) => r.mixed).length,
    };
  }

  // Real cells, informational.
  const real = {};
  for (const p of pairs.filter((x) => x.cell.mode === "real-cells" && x.b.lead !== null)) {
    const k = p.cell.labelsFile;
    real[k] ??= { n: 0, [BATCHED]: 0, [ATOM]: 0, shapeDisagree: 0 };
    real[k].n += 1;
    if (p.b.label === p.b.lead) real[k][BATCHED] += 1;
    if (p.a.label === p.a.lead) real[k][ATOM] += 1;
    if (p.b.label !== p.a.label) real[k].shapeDisagree += 1;
  }

  const nearRepeats = [...new Set(units.map((u) => u.bRep1))];
  return {
    nearDefinedBy: `batched repeat ${nearRepeats.join(",") || "-"} P(expected) in [0.4, 0.8]`,
    complete, problems, cells: cells.length, pairs, units, flips, primary, twoByTwo, discordant, mcnemarP, missedByBatched, missedByAtom, stricter,
    leafShapes: { [BATCHED]: shapesOf("b"), [ATOM]: shapesOf("a") }, transitions,
    repeatFlips: { [BATCHED]: repeatFlips("b"), [ATOM]: repeatFlips("a") }, buckets, position, cost, real, reversedCells: reversed.length,
    tv: { mean: mean(units.map((u) => u.tv)), max: units.length ? Math.max(...units.map((u) => u.tv)) : NaN, top: [...pairs].sort((x, y) => y.tv - x.tv).slice(0, 5).map((p) => [p.cell.id, p.tv]) },
  };
}

// ---------------------------------------------------------------- printing

const f = (x, d = 3) => (x === undefined || x === null || Number.isNaN(x) ? "-" : x.toFixed(d));
function table(header, rows) {
  const widths = header.map((h, i) => Math.max(String(h).length, ...rows.map((r) => String(r[i]).length)));
  const line = (r) => `  ${r.map((c, i) => String(c).padEnd(widths[i])).join("  ")}`;
  console.log(line(header));
  console.log(line(widths.map((w) => "-".repeat(w))));
  for (const r of rows) console.log(line(r));
}
function report(name, r, { cellsTable = true } = {}) {
  console.log(`== ${name}: ${r.cells} cells, ${r.pairs.length} normal-arm pairs, ${r.units.length} units after collapsing duplicate texts, ${r.reversedCells} reversed-arm cells`);
  console.log(`confident flips (cells; p >= ${CONF} on both sides, different labels, any repeat pair): ${r.flips.length}`);
  for (const x of r.flips) console.log(`  FLIP ${x.id} [repeat pairs ${x.combos}]: batched ${x.batched}; per-atom ${x.perAtom}`);
  console.log("");
  console.log("signed shift d = per-atom P(expected) - batched P(expected), units (duplicates once)");
  table(["stratum", "n", "mean d", "90% CI", "Wilcoxon p", "mean |d|", "max |d|"],
    [["all", r.primary.all], ["with expected label", r.primary.expected], [`near threshold (${r.nearDefinedBy})`, r.primary.near], ["mixed-oracle batch", r.primary.mixed], ["single-oracle batch", r.primary.pure],
      ["noise: batched rep2 - rep1", r.primary.noiseB], ["noise: per-atom rep2 - rep1", r.primary.noiseA]]
      .map(([k, s]) => [k, s.n, f(s.mean), `[${f(s.ci[0])}, ${f(s.ci[1])}]`, f(s.p), f(s.meanAbs), f(s.maxAbs)]));
  console.log("");
  const t = r.twoByTwo;
  console.log(`correctness vs expected labels (fixture units): both right ${t.bothRight}, batched right/per-atom wrong ${t.bRightAWrong}, batched wrong/per-atom right ${t.bWrongARight}, both wrong ${t.bothWrong}; exact McNemar p ${f(r.mcnemarP)}`);
  for (const x of r.discordant) console.log(`  DISCORDANT ${x.id}${x.dup > 1 ? ` (x${x.dup} dup)` : ""}: expected ${x.expected}; batched ${x.batched}; per-atom ${x.perAtom} -> ${x.who}`);
  console.log(`seeded cells per-atom catches and batched misses: ${r.missedByBatched.join(", ") || "none"}`);
  console.log(`seeded cells batched catches and per-atom misses: ${r.missedByAtom.join(", ") || "none"}`);
  console.log(`genuine cells per-atom fails where batched holds (stricter): ${r.stricter.join(", ") || "none"}`);
  console.log(`leaf shapes: batched ${JSON.stringify(r.leafShapes[BATCHED])}; per-atom ${JSON.stringify(r.leafShapes[ATOM])}; transitions (rep 1) ${JSON.stringify(r.transitions)}`);
  console.log(`repeat flips: batched ${r.repeatFlips[BATCHED].length} [${r.repeatFlips[BATCHED].join(", ")}]; per-atom ${r.repeatFlips[ATOM].length} [${r.repeatFlips[ATOM].join(", ")}]`);
  console.log(`total variation per unit: mean ${f(r.tv.mean)}, max ${f(r.tv.max)}; top ${r.tv.top.map(([id, v]) => `${id} ${f(v)}`).join("; ")}`);
  console.log("position buckets (normal arm, batched relative position; size-1 batches count as first)");
  table(["third", "n", "mean |d|", "disagreement"], r.buckets.map((b) => [b.name, b.n, f(b.meanAbs), f(b.disagree)]));
  console.log(r.position.identified
    ? `position slope (d on relative position, cell fixed effect, reversed arm): beta ${f(r.position.beta)} over ${r.position.cells} cells, 90% CI [${f(r.position.ci[0])}, ${f(r.position.ci[1])}] -> ${r.position.trend ? "POSITION TREND" : "no trend"}`
    : "position slope: not identified (no reversed arm in these sidecars)");
  console.log("cost per shape");
  table(["shape", "runs", "main requests", "questions", "follow-ups", "stateBytes", "wall s", "judge s", "mixed-oracle requests"],
    Object.keys(r.cost).map((s) => { const c = r.cost[s]; return [s, c.runs, c.mainRequests, c.questions, c.followups, c.stateBytes, f(c.wallS, 2), f(c.judgeS, 2), c.mixedRequests]; }));
  for (const [file, x] of Object.entries(r.real)) {
    console.log(`real cells ${file} (INFORMATIONAL, not a decision input): lead agreement batched ${x[BATCHED]}/${x.n}, per-atom ${x[ATOM]}/${x.n}; shapes disagree on ${x.shapeDisagree}/${x.n}`);
  }
  if (cellsTable) {
    console.log("per cell (normal arm)");
    table(["cell", "expect", "batched labels", "per-atom labels", "b P(exp)", "a P(exp)", "d", "TV", "b pos", "agree"],
      r.pairs.map((p) => [p.cell.id, p.b.expected, p.b.leaves.map((l) => `${l.label}:${f(l.p, 2)}`).join(" "), p.a.leaves.map((l) => `${l.label}:${f(l.p, 2)}`).join(" "),
        f(p.b.pExp, 2), f(p.a.pExp, 2), f(p.d), f(p.tv), p.b.rawPosition === null ? "-" : `${p.b.rawPosition}/${p.b.size}`, p.b.label === p.a.label ? "yes" : "NO"]));
  }
  for (const problem of r.problems) console.log(`problem: ${problem}`);
  console.log(`complete: ${r.complete}`);
}

/**
 * Round 8 (review): a measurement never mixes judges. Sidecars whose runs carry both LIVE and MOCK
 * tags are refused (a dead mid-way live run would otherwise leave mock cells in it), and MOCK runs
 * are compared only under an explicit --mock. Returns the problem, or undefined.
 */
export function tagProblem(runs, allowMock) {
  const tags = [...new Set(runs.map((r) => r.tag ?? "untagged"))];
  if (tags.includes("MOCK") && tags.some((t) => t !== "MOCK")) {
    const mock = runs.filter((r) => r.tag === "MOCK").map((r) => `${r.run}@${r.shape} rep ${r.repeat}`);
    return `mixed-tags: sidecars mix ${tags.join("+")} runs (MOCK: ${mock.slice(0, 5).join("; ")}${mock.length > 5 ? `; +${mock.length - 5} more` : ""}); re-run the MOCK entries live or remove them`;
  }
  if (tags.includes("MOCK") && !allowMock) return "mock-without-flag: every run is MOCK; pass --mock to compare mock sidecars (wiring only, not a measurement)";
  return undefined;
}
function loadPrefix(prefix) {
  const files = readdirSync(FIXTURES).filter((n) => n.startsWith(`.leaves-${prefix}`) && n.endsWith(".json")).sort();
  return { files, runs: files.flatMap((n) => JSON.parse(readFileSync(path.join(FIXTURES, n), "utf8")).runs) };
}

// ---------------------------------------------------------------- self-test

/** A synthetic run list: 12 cells x 2 shapes x 2 repeats, plus a batched reversed arm. */
function synthetic(planted) {
  const n = 12;
  const options = ["holds", "fails", "unknown"];
  const runs = [];
  const expect = (i) => (i === 5 ? "fails" : "holds");
  const leafFor = (shape, arm, repeat, i, posIndex) => {
    const exp = expect(i);
    const rel = posIndex / (n - 1);
    // Deterministic small noise per (cell, shape, arm, repeat), no trend.
    const jitter = ((i * 7919 + repeat * 104729 + (shape === ATOM ? 13 : 0) + (arm === "reversed" ? 31 : 0)) % 21 - 10) / 1000;
    let pe = 0.92 + jitter;
    if (planted && shape === BATCHED) pe -= 0.3 * rel;
    let label = exp, p = pe;
    if (planted && i === 3) { if (shape === BATCHED) { label = "holds"; p = 0.9; } else { label = "fails"; p = 0.9; } }
    if (planted && i === 5) { if (shape === BATCHED) { label = "holds"; p = 0.55; } else { label = "fails"; p = 0.7; } }
    const dist = options.map((o) => (o === label ? p : (1 - p) / 2));
    if (label !== exp && !(planted && (i === 3 || i === 5))) throw new Error("synthetic");
    return { arm, source: "syn/fx", shape, repeat, oracle: "o", atom: `o(d, s#row${i})`, rowId: `s#row${i}`, origRowId: `s#row${i}`, key: `k${i}`,
      label, answered: label, options, distribution: dist, p, threshold: 0.5, leafShape: "decides", request: 0, position: posIndex, requestSize: shape === ATOM ? 1 : n,
      textHash: `t${i}`, questionHash: "q", expect: exp, lead: null };
  };
  for (const [shape, arm] of [[BATCHED, "normal"], [ATOM, "normal"], [BATCHED, "reversed"]]) {
    for (const repeat of [1, 2]) {
      const leaves = [];
      for (let i = 1; i <= n; i += 1) {
        const posIndex = shape === ATOM ? 0 : arm === "reversed" ? n - i : i - 1;
        const leaf = leafFor(shape, arm, repeat, i, posIndex);
        if (shape === ATOM) leaf.position = 0;
        // per-atom: relative position is 0 by construction (size 1); the planted trend lives on batched only.
        leaves.push(leaf);
      }
      runs.push({ run: `syn@${shape}@${arm}`, mode: "fixtures", repeat, shape, arm, split: false, wall_ms: 1, labelsFile: null,
        requests: [{ index: 0, kind: "main", questions: shape === ATOM ? 1 : n, stateBytes: 100, ms: 1, oracles: ["o"], mixed: false }], leaves });
    }
  }
  return runs;
}
/**
 * Round 8: section-keyed synthetic runs: one page of n sections under `current_not_history`, two
 * shapes x two repeats. The two shapes write the atom text differently (a different module prefix)
 * so pairing can only succeed through the section key. Planted: section s2 (expected holds) is
 * `holds` 0.9 batched and `fails` 0.9 per-atom on both repeats, a confident flip, batched right.
 */
function syntheticSections(planted) {
  const n = 5;
  const options = ["holds", "fails", "unknown"];
  const runs = [];
  for (const shape of [BATCHED, ATOM]) {
    for (const repeat of [1, 2]) {
      const leaves = [];
      for (let i = 1; i <= n; i += 1) {
        const section = i === 1 ? "pkg--model" : `s${i}`;
        const exp = i === 4 ? "fails" : "holds";
        const jitter = ((i * 31 + repeat * 17 + (shape === ATOM ? 5 : 0)) % 11 - 5) / 1000;
        let label = exp, p = 0.9 + jitter;
        if (planted && i === 2 && shape === ATOM) { label = "fails"; p = 0.9; }
        const prefix = shape === ATOM ? "copy.module-model" : "doc-verify.module-model";
        leaves.push({ arm: "normal", source: "syn/page", shape, repeat, oracle: "current_not_history", atom: `${prefix}.current_not_history(docs/x.md, ${section})`,
          rowId: "", origRowId: "", section, key: `k${i}`, label, answered: label, options, distribution: options.map((o) => (o === label ? p : (1 - p) / 2)), p,
          threshold: 0.5, leafShape: "decides", request: shape === ATOM ? i - 1 : 0, position: shape === ATOM ? 0 : i - 1, requestSize: shape === ATOM ? 1 : n,
          textHash: `t${i}`, questionHash: "q", expect: exp, lead: null });
      }
      const requests = shape === ATOM
        ? leaves.map((_, i) => ({ index: i, kind: "main", questions: 1, stateBytes: 50, ms: 1, oracles: ["current_not_history"], mixed: false }))
        : [{ index: 0, kind: "main", questions: n, stateBytes: 200, ms: 1, oracles: ["current_not_history"], mixed: false }];
      runs.push({ run: `syn-sections@${shape}`, mode: "fixtures", repeat, shape, arm: "normal", split: false, wall_ms: 1, labelsFile: null, requests, leaves });
    }
  }
  return runs;
}
function selfTest() {
  const clean = analyse(synthetic(false));
  const planted = analyse(synthetic(true));
  const sectionsClean = analyse(syntheticSections(false));
  const sectionsPlanted = analyse(syntheticSections(true));
  const tagOf = (tags, allow) => tagProblem(tags.map((tag, i) => ({ run: `t${i}`, shape: BATCHED, repeat: i + 1, tag })), allow);
  // One section whose batched P(expected) is 0.7 on repeat 1 and 0.95 on repeat 2 (mean 0.825,
  // outside [0.4, 0.8]): it is in the stratum only when repeat 1 defines it.
  const nearRuns = syntheticSections(false);
  for (const run of nearRuns) for (const leaf of run.leaves) {
    if (leaf.section !== "s3" || run.shape !== BATCHED) continue;
    const p = run.repeat === 1 ? 0.7 : 0.95;
    leaf.p = p; leaf.distribution = leaf.options.map((o) => (o === "holds" ? p : (1 - p) / 2));
  }
  const nearRep1 = analyse(nearRuns);
  const checks = [
    ["planted: one confident flip", planted.flips.some((x) => x.id.endsWith("s#row3"))],
    ["planted: McNemar-discordant cell (row5, per-atom right)", planted.discordant.some((x) => x.id.endsWith("s#row5") && x.who === "per-atom right")],
    ["planted: position trend", planted.position.trend === true],
    ["clean: no confident flip", clean.flips.length === 0],
    ["clean: no discordant cell", clean.discordant.length === 0],
    ["clean: no position trend", clean.position.trend === false],
    ["clean: complete", clean.complete === true],
    ["sections: every cell paired by section across differing atom texts (5 pairs, complete)", sectionsClean.pairs.length === 5 && sectionsClean.complete === true && sectionsPlanted.pairs.length === 5],
    ["sections planted: one confident flip, on section s2", sectionsPlanted.flips.length === 1 && sectionsPlanted.flips[0].id === "normal|syn/page|current_not_history|s2"],
    ["sections planted: s2 discordant, batched right", sectionsPlanted.discordant.length === 1 && sectionsPlanted.discordant[0].id.endsWith("|s2") && sectionsPlanted.discordant[0].who === "batched right"],
    ["sections clean: no confident flip, no discordant cell", sectionsClean.flips.length === 0 && sectionsClean.discordant.length === 0],
    ["tags: LIVE+MOCK sidecars refused (even with --mock)", tagOf(["LIVE", "MOCK"], true)?.startsWith("mixed-tags") === true && tagOf(["LIVE", "MOCK"], false)?.startsWith("mixed-tags") === true],
    ["tags: all-MOCK refused without --mock, accepted with it", tagOf(["MOCK", "MOCK"], false)?.startsWith("mock-without-flag") === true && tagOf(["MOCK", "MOCK"], true) === undefined],
    ["tags: all-LIVE accepted", tagOf(["LIVE", "LIVE"], false) === undefined],
    ["near stratum from batched repeat 1, not the mean (unit in [0.4,0.8] on rep 1 only)", nearRep1.primary.near.n === 1 && nearRep1.nearDefinedBy === "batched repeat 1 P(expected) in [0.4, 0.8]"],
  ];
  report("self-test planted", planted, { cellsTable: false });
  console.log("");
  report("self-test clean", clean, { cellsTable: false });
  console.log("");
  report("self-test section-keyed planted", sectionsPlanted);
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
  console.log("usage: compare-shapes.mjs [--mock] <ledger-prefix>... | --self-test");
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
