#!/usr/bin/env node
// Property-test runner (ported from round 7; against doc-verify/dist/kernel).
// Usage:
//   node doc-verify/tests/kernel-slow/run-property.mjs --subject S1|S3 --arm C5|C5-features|C5-shrink --programs N --seeds 1,2,3
//   node doc-verify/tests/kernel-slow/run-property.mjs --seeds-table --programs N --seeds 1,2,3
//   node doc-verify/tests/kernel-slow/run-property.mjs --seeds-apply-only
//
// Open classes (do not fail the suite): loop-shape (gate-ledger 8), same-instance nondet (9).
// Count-bound is fixed (no longer expected red). Fresh-instance nondet still fails.
//
// Exit: 1 on a refuting cell or when `complete` is false; 0 otherwise.
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import fc from "fast-check";
import { programArbitrary, render, atomSize, WEIGHTS, freeAtoms, isValid, unboundTwin } from "./property/generator.mjs";
import { checkMinimal } from "./property/minimal.mjs";
import { checkProgram, propertyOf, EXPECTED_FAILURES, expectedRejection } from "./property/properties.mjs";
import { makeSubject, counters } from "./property/subjects.mjs";
import { S1_SEEDS, S3_SEEDS, seedTriggered, propMatch, seedKinds } from "./property/seeds.mjs";

const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const opt = (n, d) => {
  const i = args.indexOf(`--${n}`);
  if (i >= 0 && args[i + 1] && !args[i + 1].startsWith("--")) return args[i + 1];
  const eq = args.find((x) => x.startsWith(`--${n}=`));
  return eq ? eq.slice(n.length + 3) : d;
};
const subjectArg = opt("subject", null);
const armArg = opt("arm", "C5");
const programs = Number(opt("programs", "500"));
const seedList = opt("seeds", "1,2,3").split(",").map(Number);
const PROPERTY_TIMEOUT_MS = 10 * 60 * 1000; // checking time per arm (shrinking reported separately)
const SHRINK_LIMIT_MS = Number(opt("shrink-limit-ms", "60000"));
const resultsDir = path.resolve(import.meta.dirname, ".results");
mkdirSync(resultsDir, { recursive: true });

const ARMS = {
  C5: { featuresOn: true, shrink: true },
  "C5-features": { featuresOn: false, shrink: true },
  "C5-shrink": { featuresOn: true, shrink: false },
};
const NAMED_FEATURES = ["choose", "count", "matches", "in", "cmp", "recursion", "negativeLoop", "unknown"];
const TRIGGER_FLOORS = { choosePair: 0.10, countBoundary: 0.10, oddReachable: 0.07 };
const SEED_WITNESS_MAX_ATOMS = 8;

const logLines = [];
const log = (s) => { console.log(s); logLines.push(s); };

const tripleKey = (module, facts, ans) => `${module}\n---\n${facts.join("\n")}\n---\n${JSON.stringify(ans)}`;
const evalKey = (r) => JSON.stringify({ v: r?.verdict, s: r?.statuses ?? {}, d: r?.demand ?? null, u: r?.unfounded ?? null, x: r?.rejected ?? null });

// ---- evaluation with a memo (shrink steps often re-render the same program) ---------------------

const memo = new Map();
/** Does `kind` fail on g? true | false | "skip" (invalid, or rejected by the subject unexpectedly). */
async function failsKind(subject, g0, kind, opts = {}) {
  const v = isValid(g0);
  if (!v.ok) return "skip";
  const g = v.g;
  const { module, facts } = render(g);
  const key = `${subject}|${opts.patch ?? ""}|${opts.defect ?? ""}|${kind}|${g.totalMask}|${g.midMask}|${tripleKey(module, facts, g.ans)}`;
  if (memo.has(key)) return memo.get(key);
  let r;
  try {
    const inst = await makeSubject(subject, module, facts, opts);
    const res = checkProgram(g, inst.evaluate, { subject, only: kind });
    if (inst.rejected && res.problems.some((p) => propertyOf(p) === "rejected")) r = "skip";
    else r = res.problems.some((p) => propertyOf(p) === kind);
  } catch { r = "skip"; }
  if (memo.size > 200000) memo.clear();
  memo.set(key, r);
  return r;
}

/** S1 count-bound class: g has a bound count and its unbound twin passes the same kind. */
async function isCountBoundClass(subject, g, kind) {
  if (subject !== "S1" || !g.features.countBound) return false;
  return (await failsKind(subject, unboundTwin(g), kind)) === false;
}

/** The predicate a shrink step and a neighbour must keep: the same kind, the same class. */
function classPredicate(subject, kind, cls, opts = {}) {
  return async (g0) => {
    const v = isValid(g0);
    if (!v.ok) return "skip";
    const g = v.g;
    if (cls === "count-bound" && !g.features.countBound) return false;
    const f = await failsKind(subject, g, kind, opts);
    if (f !== true) return f;
    if (subject !== "S1" || cls === "any") return true;
    const twin = g.features.countBound ? await failsKind(subject, unboundTwin(g), kind, opts) : true;
    return cls === "count-bound" ? twin === false : twin === true;
  };
}

/**
 * Non-determinism predicates. "same": on one instance, some evaluate() input returns a different
 * result than the same input on a brand-new instance as its first call (history dependence).
 * "fresh": two brand-new instances running the same check sequence disagree.
 */
async function historyDivergence(subject, g) {
  const { module, facts } = render(g);
  const inst = await makeSubject(subject, module, facts);
  if (inst.rejected) return null;
  const calls = [];
  // the input is snapshotted at call time (the policy loop mutates its state object afterwards)
  checkProgram(g, (x) => { const kx = JSON.stringify(x); const r = inst.evaluate(JSON.parse(kx)); calls.push([kx, evalKey(r)]); return r; }, { subject });
  const lone = new Map();
  for (let i = 0; i < calls.length; i++) {
    const [kx, k] = calls[i];
    if (!lone.has(kx)) lone.set(kx, evalKey((await makeSubject(subject, module, facts)).evaluate(JSON.parse(kx))));
    if (lone.get(kx) !== k) return { input: kx, call: i + 1, calls: calls.length, inSequence: k, alone: lone.get(kx) };
  }
  return null;
}
function nondetPredicate(subject, kind) {
  return async (g0) => {
    const v = isValid(g0);
    if (!v.ok) return "skip";
    try {
      if (kind === "same") {
        // one instance, the check sequence run twice: the same input answered two ways
        const { module, facts } = render(v.g);
        const inst = await makeSubject(subject, module, facts);
        if (inst.rejected) return "skip";
        const seen = new Map();
        let diverged = false;
        const ev = (x) => { const kx = JSON.stringify(x); const r = inst.evaluate(JSON.parse(kx)); const k = evalKey(r); if (seen.has(kx) && seen.get(kx) !== k) diverged = true; if (!seen.has(kx)) seen.set(kx, k); return r; };
        checkProgram(v.g, ev, { subject });
        checkProgram(v.g, ev, { subject });
        return diverged;
      }
      // fresh: the first call on two brand-new instances disagrees
      const { module, facts } = render(v.g);
      const a = await makeSubject(subject, module, facts), b = await makeSubject(subject, module, facts);
      if (a.rejected || b.rejected) return "skip";
      return evalKey(a.evaluate(v.g.ans)) !== evalKey(b.evaluate(v.g.ans));
    } catch { return "skip"; }
  };
}
async function nondetDetail(subject, g, kind) {
  if (kind !== "same") return [];
  const d = await historyDivergence(subject, g);
  if (!d) return ["(divergence did not reproduce on the recorded triple)"];
  return [`input ${d.input}`, `as call ${d.call} of ${d.calls} in the check sequence on one instance: ${d.inSequence.slice(0, 300)}`, `as the first call on a new instance: ${d.alone.slice(0, 300)}`];
}

/** fast-check's shrinker on the raw record: replay (seed, path) with "pred holds" as the failure. */
async function fcShrink(arb, seed, index, pred, limitMs = SHRINK_LIMIT_MS) {
  const t0 = performance.now();
  const res = await fc.check(fc.asyncProperty(arb, async (g) => (await pred(g)) !== true), {
    seed, path: String(index), numRuns: 1, interruptAfterTimeLimit: limitMs, markInterruptAsFailure: false,
  });
  const ms = performance.now() - t0;
  if (!res.failed) return { g: null, ms, shrinks: 0, interrupted: !!res.interrupted };
  return { g: isValid(res.counterexample[0]).g, ms, shrinks: res.numShrinks, interrupted: !!res.interrupted };
}

function logRecord(head, g, problems, min) {
  const { module, facts } = render(g);
  log(head);
  log(`--- module\n${module}--- facts\n${facts.join("\n")}\n--- ans\n${JSON.stringify(g.ans)}\n--- problems\n${problems.slice(0, 8).join("\n")}`);
  if (min && !min.minimal) {
    const n = render(min.neighbour);
    log(`--- non-minimal: the neighbour "${min.via}" still fails\n${n.module}--- neighbour facts\n${n.facts.join("\n")}\n--- neighbour ans\n${JSON.stringify(min.neighbour.ans)}`);
  }
}

// ---- one arm -------------------------------------------------------------------------------------

async function runArm(subject, armName, n, seeds) {
  const { featuresOn, shrink } = ARMS[armName];
  const t0 = performance.now();
  let checkMs = 0, shrinkMs = 0, minimalMs = 0, timedOut = false;
  const reasons = []; // why `complete` is false
  const featureHits = {}, triggerHits = { choosePair: 0, countBoundary: 0, oddReachable: 0 };
  let programsRun = 0, invalidSkipped = 0, capSkipped = 0, undetermined = 0, d1Weak = 0, exemptN = 0;
  const skips = {}; // reason -> count
  const kindHits = {}; // kind -> programs (pre-dedupe)
  const recorded = new Map(); // `${kind}|${cls}` -> Set(tripleKey)
  let expectedRed = 0, refuting = 0, nonMinimal = 0, interruptedShrinks = 0, replayMissed = 0;
  const nondet = { fresh: [], same: [] };
  const recordedSummary = {};
  const s3d1Sizes = [];

  for (const seed of seeds) {
    const arb = programArbitrary({ featuresOn });
    const values = fc.sample(arb, { seed, numRuns: n });
    for (let index = 0; index < values.length; index++) {
      if (checkMs > PROPERTY_TIMEOUT_MS) { timedOut = true; break; }
      const v0 = isValid(values[index]);
      if (!v0.ok) { invalidSkipped += 1; skips[`invalid: ${v0.reason}`] = (skips[`invalid: ${v0.reason}`] ?? 0) + 1; continue; }
      const g = v0.g;
      if (freeAtoms(g).length > 10) { capSkipped += 1; continue; } // generator enforces it; never hit
      programsRun += 1;
      for (const [k, v] of Object.entries(g.features)) if (v) featureHits[k] = (featureHits[k] ?? 0) + 1;
      for (const [k, v] of Object.entries(g.triggers)) if (v) triggerHits[k] += 1;
      const { module, facts } = render(g);

      const tc = performance.now();
      const inst = await makeSubject(subject, module, facts);
      if (inst.rejected && !checkProgramExpectsRejection(g, subject)) {
        const reason = `${subject} rejected: ${classifyRejection(inst.rejected)}`;
        skips[reason] = (skips[reason] ?? 0) + 1;
        checkMs += performance.now() - tc;
        continue;
      }
      const r1 = checkProgram(g, inst.evaluate, { subject });
      d1Weak += r1.d1Weak; exemptN += r1.exemptN;
      try { if (Object.values(inst.evaluate(g.ans).statuses ?? {}).flat().some((x) => x.status === "undetermined")) undetermined += 1; } catch { /* rejected */ }
      checkMs += performance.now() - tc;
      if (!r1.problems.length) continue;

      // reproduce before shrinking. fresh: the FIRST call on two brand-new instances (no history
      // on either side). same: anything that depends on an instance's history -- the check rerun
      // on the same instance, a repeated call, a history-loaded instance against a first call,
      // or the check sequence replayed on another instance.
      const sig = (r) => JSON.stringify([...r.problems].sort());
      const freshA = await makeSubject(subject, module, facts), freshB = await makeSubject(subject, module, facts);
      const fa = freshA.evaluate(g.ans), fb = freshB.evaluate(g.ans);
      const same = checkProgram(g, inst.evaluate, { subject });
      const replay = checkProgram(g, freshB.evaluate, { subject });
      const e1 = inst.evaluate(g.ans), e2 = inst.evaluate(g.ans);
      const ndKind = evalKey(fa) !== evalKey(fb) ? "fresh"
        : sig(same) !== sig(r1) || sig(replay) !== sig(r1) || evalKey(e1) !== evalKey(e2) || evalKey(e1) !== evalKey(fa) ? "same" : null;
      if (ndKind) {
        nondet[ndKind].push({ g, seed, index });
        const pred = nondetPredicate(subject, ndKind);
        const t1 = performance.now();
        const sh = shrink ? await fcShrink(arb, seed, index, pred, 5 * SHRINK_LIMIT_MS) : { g: null, shrinks: 0, interrupted: false };
        shrinkMs += performance.now() - t1;
        const shrunk = sh.g ?? g;
        const missedNd = shrink && !sh.g;
        if (missedNd) replayMissed += 1;
        const min = await checkMinimal(shrunk, pred);
        const detail = await nondetDetail(subject, shrunk, ndKind);
        const ndTag = ndKind === "fresh"
          ? "REFUTING (fresh-instance nondet)"
          : "report-not-failing (same-instance history, gate-ledger item 9)";
        logRecord(`counterexample nondet-${ndKind} ${ndTag}: seed ${seed} program ${index} size ${atomSize(g)}->${atomSize(shrunk)}${missedNd ? " (shrink: replay-missed, recorded unshrunk)" : shrink ? ` (fast-check shrinks ${sh.shrinks}${sh.interrupted ? ", interrupted at the limit" : ""})` : " (not shrunk)"} minimal=${min.minimal} (neighbours tried ${min.tried}, skipped ${min.skipped})`, shrunk, ndKind === "fresh" ? [`first call, new instance A: ${evalKey(fa).slice(0, 300)}`, `first call, new instance B: ${evalKey(fb).slice(0, 300)}`] : [`first run ${sig(r1)}`, `same instance again ${sig(same)}`, `sequence replayed on another instance ${sig(replay)}`, ...detail], min);
        continue;
      }

      for (const kind of [...new Set(r1.problems.map(propertyOf))]) {
        kindHits[kind] = (kindHits[kind] ?? 0) + 1;
        // count-bound class is still labelled for shrink predicates / logging, but is no longer expected red
        const cls = (await isCountBoundClass(subject, g, kind)) ? "count-bound" : subject === "S1" ? "other" : "any";
        const pred = classPredicate(subject, kind, cls);
        let shrunk = g, sh = { ms: 0, shrinks: 0, interrupted: false };
        if (shrink) {
          sh = await fcShrink(arb, seed, index, pred);
          shrinkMs += sh.ms;
          if (sh.g) shrunk = sh.g; else replayMissed += 1;
          if (sh.interrupted) interruptedShrinks += 1;
        }
        const { module: m2, facts: f2 } = render(shrunk);
        const key = tripleKey(m2, f2, shrunk.ans);
        const rk = `${kind}|${cls}`;
        if (!recorded.has(rk)) recorded.set(rk, new Set());
        if (recorded.get(rk).has(key)) continue; // dedupe by rendered triple
        recorded.get(rk).add(key);
        const tm = performance.now();
        const min = await checkMinimal(shrunk, pred);
        minimalMs += performance.now() - tm;
        if (!min.minimal) nonMinimal += 1;
        // re-evaluate the recorded triple so its problems are the triple's own
        const sInst = await makeSubject(subject, m2, f2);
        const rr = checkProgram(shrunk, sInst.evaluate, { subject });
        const hit = rr.problems.filter((p) => propertyOf(p) === kind);
        let verdict;
        if (kind === "loop-shape") {
          // gate-ledger item 8: open precision; treat as expected (like former count-bound)
          verdict = "expected (loop-shape, gate-ledger item 8)";
          expectedRed += 1;
        } else if (subject === "S3" && kind === "D1") {
          const ok = rr.d1Shape === EXPECTED_FAILURES["S3:D1"].shape;
          verdict = ok ? `expected (S3 x D1, gate-ledger item 5: decided only jointly, ${atomSize(shrunk)} atoms)` : `REFUTING (S3 x D1 outside the pre-registered class: shape ${rr.d1Shape})`;
          if (ok) { expectedRed += 1; s3d1Sizes.push(atomSize(shrunk)); } else refuting += 1;
        } else { verdict = "REFUTING (new finding)"; refuting += 1; }
        const chk = subject === "S1" && sInst.checkerRejected ? ` (design-04 checker refuses it: ${sInst.checkerRejected.slice(0, 90)}; S1 runs it)` : "";
        logRecord(`counterexample ${kind} class=${cls} ${verdict}: seed ${seed} program ${index} size ${atomSize(g)}->${atomSize(shrunk)}${shrink && !sh.g ? " (shrink: replay-missed, recorded unshrunk)" : shrink ? ` (fast-check shrinks ${sh.shrinks}${sh.interrupted ? ", interrupted at the limit" : ""})` : " (not shrunk)"} minimal=${min.minimal} (neighbours tried ${min.tried}, skipped ${min.skipped})${chk}`, shrunk, hit.length ? hit : [`(kind no longer reproduces on the recorded triple)`], min);
        recordedSummary[rk] = (recordedSummary[rk] ?? 0) + 1;
      }
    }
    if (timedOut) break;
  }

  const ms = performance.now() - t0;
  const share = (v) => (programsRun ? +(v / programsRun).toFixed(3) : 0);
  const cov = Object.fromEntries([...NAMED_FEATURES, "countBound", "countCorrelated", "unboundMatches", "loopReachable"].map((k) => [k, share(featureHits[k] ?? 0)]));
  const trig = Object.fromEntries(Object.entries(triggerHits).map(([k, v]) => [k, share(v)]));
  if (featuresOn) {
    for (const k of NAMED_FEATURES) if (cov[k] < 0.05) reasons.push(`coverage narrowed: ${k}=${cov[k]}`);
    for (const [k, floor] of Object.entries(TRIGGER_FLOORS)) if (trig[k] < floor) reasons.push(`trigger floor missed: ${k}=${trig[k]} < ${floor}`);
  }
  if (timedOut) reasons.push("timeout (10 min of checking)");
  // Fresh-instance nondet is refuting. Same-instance history dependence (gate-ledger item 9) is
  // reported but does not fail the suite (production uses a fresh Kernel per check).
  if (nondet.fresh.length) refuting += nondet.fresh.length;
  if (nondet.same.length) {
    log(`report-not-failing: same-instance nondet ${nondet.same.length} (gate-ledger item 9; not counted in refuting)`);
  }
  // invalid programs are never evaluated (counted with their reason); a subject rejection is
  // covered only by the plan's out-of-scope list (present/3, matches over a count)
  const uncovered = Object.entries(skips).filter(([r]) => !r.startsWith("invalid") && !r.includes("(out of scope)"));
  for (const [r, c] of uncovered) reasons.push(`skip not covered by the expected-failure table: ${r} (${c})`);
  if (shrink && interruptedShrinks) log(`note: ${interruptedShrinks} shrinks stopped at the ${SHRINK_LIMIT_MS} ms limit (their shrunk program is the best found)`);
  if (s3d1Sizes.length) {
    // the cell's bound (plan: "witness <= 6 atoms") is on its smallest shrunk witness; every
    // recorded witness size is printed (DECISION in the builder report)
    const bound = EXPECTED_FAILURES["S3:D1"].maxAtoms, smallest = Math.min(...s3d1Sizes);
    const over = s3d1Sizes.filter((x) => x > bound).length;
    log(`S3 x D1 (expected red): ${s3d1Sizes.length} recorded witnesses, smallest ${smallest} atoms (bound ${bound}), ${over} larger than the bound; sizes ${JSON.stringify(s3d1Sizes.sort((a, b) => a - b))}`);
    if (smallest > bound) { log(`REFUTING: S3 x D1 smallest witness ${smallest} > ${bound}`); refuting += 1; }
  }
  const complete = reasons.length === 0;

  log(`arm ${armName} subject ${subject}: programs ${programsRun}, failing-program kinds ${JSON.stringify(kindHits)}, invalidSkipped ${invalidSkipped}, capSkipped ${capSkipped}, shrinkReplayMissed ${replayMissed}, d1Weak ${d1Weak}, exempt ${exemptN}`);
  log(`skips (reason: count): ${JSON.stringify(skips)}`);
  log(`recorded distinct shrunk triples per kind|class: ${JSON.stringify(recordedSummary)}; non-minimal ${nonMinimal}`);
  log(`expected (pre-registered red): ${expectedRed}; refuting: ${refuting}`);
  log(`nondet: freshInstance=${nondet.fresh.length} sameInstance=${nondet.same.length}`);
  log(`coverage: ${JSON.stringify(cov)} triggers: ${JSON.stringify(trig)} undeterminedShare ${share(undetermined)}`);
  log(`weights: ${JSON.stringify(WEIGHTS)}`);
  log(`cost: wall ${ms.toFixed(0)} ms, checking ${checkMs.toFixed(0)} ms, shrinker ${shrinkMs.toFixed(0)} ms, minimality ${minimalMs.toFixed(0)} ms, evaluations S1 ${counters.S1} S3 ${counters.S3}, instances ${counters.instances}`);
  log(`complete: ${complete}${reasons.length ? ` (${reasons.join("; ")})` : ""}`);
  writeFileSync(path.join(resultsDir, `round-7-${subject}-${armName}.txt`), logLines.join("\n") + "\n");
  return { complete, refuting };
}

function checkProgramExpectsRejection(g, subject) {
  return expectedRejection(g, subject) !== null;
}
function classifyRejection(msg) {
  const m = String(msg ?? "");
  if (/present\/3/.test(m)) return "present/3 (out of scope)";
  if (/count operand|derived or count operand/.test(m)) return "matches over a count (out of scope)";
  return m.slice(0, 120);
}

// ---- seeds table -----------------------------------------------------------------------------------

async function runSeedsTable(n, seeds) {
  const t0 = performance.now();
  const reasons = [];
  let refuting = 0;
  // every S1 patch applied once before the loop (a site that drifted throws here)
  for (const seed of S1_SEEDS) {
    try {
      await makeSubject("S1", "schema_version: 2\nkind: verification-module\nmodule: w\nrounds: 1\nimports: {core: doc-verify:core}\noracles:\n  o1(D, S):\n    ask: q\n    evidence: core.own(D, S)\nrules: {}\nconstraints:\n  c1:\n    forall: \"core.section(D, S, _)\"\n    require: \"o1(D, S)\"\n    severity: error\n", ["section(d, a, root)"], { patch: seed.id });
      log(`seed ${seed.id}: core.pl patch applies`);
    } catch (e) {
      log(`REFUTING: seed ${seed.id} could not be applied: ${e.message}`);
      reasons.push(`seed ${seed.id} not applied`); refuting += 1;
    }
  }
  const sigOf = (r) => JSON.stringify({ s: r.statuses, v: r.verdict, u: r.unsat ?? false, x: r.rejected ?? null });
  const c5rows = new Map();
  for (const armName of ["C5", "C5-features"]) {
    const { featuresOn } = ARMS[armName];
    for (const seed of [...S1_SEEDS, ...S3_SEEDS]) {
      const subj = seed.subject;
      const opts = subj === "S1" ? { patch: seed.id } : { defect: seed.defect };
      let triggers = 0, flips = 0, otherFlips = 0, diffs = 0, greenStill = 0, skipped = 0;
      const otherKinds = {};
      let witness = null;
      for (const fcSeed of seeds) {
        const arb = programArbitrary({ featuresOn });
        const values = fc.sample(arb, { seed: fcSeed, numRuns: n });
        for (let index = 0; index < values.length; index++) {
          const vv = isValid(values[index]);
          if (!vv.ok) continue;
          const g = vv.g;
          if (!seedTriggered(seed.id, g)) continue;
          triggers += 1;
          const { module, facts } = render(g);
          const red = await makeSubject(subj, module, facts, opts);
          const green = await makeSubject(subj, module, facts);
          if ((red.rejected || green.rejected) && !checkProgramExpectsRejection(g, subj)) { skipped += 1; continue; }
          const rp = checkProgram(g, red.evaluate, { subject: subj }).problems;
          const gp = checkProgram(g, green.evaluate, { subject: subj }).problems;
          const redHit = rp.some((p) => propMatch(seed.property, p));
          const greenHit = gp.some((p) => propMatch(seed.property, p));
          if (redHit && greenHit) greenStill += 1;
          const flipped = redHit && !greenHit;
          if (flipped) flips += 1;
          else {
            const gk = new Set(gp.map(propertyOf));
            const extra = [...new Set(rp.map(propertyOf).filter((k) => !gk.has(k)))];
            if (extra.length) { otherFlips += 1; for (const k of extra) otherKinds[k] = (otherKinds[k] ?? 0) + 1; }
            else if (sigOf(red.evaluate(g.ans)) !== sigOf(green.evaluate(g.ans))) diffs += 1;
          }
          if (flipped && !witness) {
            // the seed's own flip: some predicted kind fails under the seed and none fails restored
            const pred = async (gg) => {
              const v = isValid(gg);
              if (!v.ok) return "skip";
              let redAny = false;
              for (const k of seedKinds(seed.property)) {
                const r = await failsKind(subj, v.g, k, opts);
                if (r === "skip") return "skip";
                if (r) redAny = true;
              }
              if (!redAny) return false;
              for (const k of seedKinds(seed.property)) {
                const r = await failsKind(subj, v.g, k);
                if (r === "skip") return "skip";
                if (r) return false;
              }
              return true;
            };
            const sh = await fcShrink(arb, fcSeed, index, pred);
            const sg = sh.g ?? g;
            const min = await checkMinimal(sg, pred);
            witness = { before: atomSize(g), after: atomSize(sg), min, g: sg, shrinks: sh.shrinks, interrupted: sh.interrupted };
          }
        }
      }
      const per500 = triggers / Math.max(1, seeds.length) * (500 / n);
      const expectTriggers = seed.kind === "control" || armName !== "C5-features";
      const narrowed = expectTriggers && per500 < 20;
      const w = witness ? `${witness.before}->${witness.after} minimal=${witness.min.minimal}${witness.min.minimal ? "" : ` (non-minimal via ${witness.min.via})`}${witness.interrupted ? " (shrink interrupted)" : ""}` : "none";
      log(`seed ${seed.id} (${seed.kind}, predicted ${seed.property}) arm ${armName}: triggers ${triggers} (per 500: ${per500.toFixed(1)})${narrowed ? " NARROWED" : ""}, flips ${flips}, other-kind flips ${otherFlips} ${JSON.stringify(otherKinds)}, signature-only diffs ${diffs}, green-still ${greenStill}, skipped ${skipped}, witness ${w}`);
      if (witness) logRecord(`  witness ${seed.id} ${armName}`, witness.g, [`flip of ${seed.property}`], witness.min);
      if (narrowed) reasons.push(`seed ${seed.id} ${armName} narrowed (${per500.toFixed(1)} < 20)`);
      const refute = (msg) => { log(`REFUTING: ${msg}`); refuting += 1; };
      if (seed.kind === "axis" && armName === "C5" && flips < 5) refute(`axis seed ${seed.id} flips ${flips} < 5 on C5`);
      if (seed.kind === "axis" && armName === "C5-features" && flips > 0) refute(`axis seed ${seed.id} flipped ${flips} on C5-features`);
      if (seed.kind === "control" && flips === 0) refute(`control seed ${seed.id} not flipped on ${armName}`);
      if (witness && !witness.min.minimal) refute(`seed ${seed.id} ${armName} witness not minimal (${witness.min.via})`);
      if (witness && witness.after > SEED_WITNESS_MAX_ATOMS) refute(`seed ${seed.id} ${armName} witness ${witness.after} atoms > ${SEED_WITNESS_MAX_ATOMS}`);
      if (armName === "C5") c5rows.set(seed.id, { flips, witness });
    }
  }
  // C5-shrink: the same programs as C5 (flips are computed before shrinking, so they are C5's by
  // construction); the witness is the first flipping program unshrunk.
  for (const [id, r] of c5rows) log(`seed ${id} arm C5-shrink: flips ${r.flips} (= C5, same programs), witness unshrunk ${r.witness ? r.witness.before : "none"}`);
  log(`seeds-table wall ${(performance.now() - t0).toFixed(0)} ms, evaluations S1 ${counters.S1} S3 ${counters.S3}, instances ${counters.instances}`);
  const complete = reasons.length === 0;
  log(`refuting cells: ${refuting}`);
  log(`complete: ${complete}${reasons.length ? ` (${reasons.join("; ")})` : ""}`);
  writeFileSync(path.join(resultsDir, "round-7-seeds.txt"), logLines.join("\n") + "\n");
  return { complete, refuting };
}



/** Apply every S1 core.pl patch once (smoke / seeds-table prelude). */
export async function applySeedsOnce(logFn = console.log) {
  const reasons = [];
  let refuting = 0;
  for (const seed of S1_SEEDS) {
    try {
      await makeSubject("S1", "schema_version: 2\nkind: verification-module\nmodule: w\nrounds: 1\nimports: {core: doc-verify:core}\noracles:\n  o1(D, S):\n    ask: q\n    evidence: core.own(D, S)\nrules: {}\nconstraints:\n  c1:\n    forall: \"core.section(D, S, _)\"\n    require: \"o1(D, S)\"\n    severity: error\n", ["section(d, a, root)"], { patch: seed.id });
      logFn(`seed ${seed.id}: core.pl patch applies`);
    } catch (e) {
      logFn(`REFUTING: seed ${seed.id} could not be applied: ${e.message}`);
      reasons.push(`seed ${seed.id} not applied`);
      refuting += 1;
    }
  }
  return { complete: reasons.length === 0, refuting, reasons };
}

export { runArm, runSeedsTable, ARMS };

// ---- main (CLI entry only; skipped when imported by the orchestrator) ----------------------------
const isMain = process.argv[1] != null && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  let result;
  if (flag("seeds-apply-only")) {
    result = await applySeedsOnce(log);
    log(`complete: ${result.complete}`);
  } else if (flag("seeds-table")) {
    result = await runSeedsTable(programs, seedList);
  } else if ((subjectArg === "S1" || subjectArg === "S3") && ARMS[armArg]) {
    result = await runArm(subjectArg, armArg, programs, seedList);
  } else {
    console.error("usage: --subject S1|S3 --arm C5|C5-features|C5-shrink --programs N --seeds 1,2,3 | --seeds-table | --seeds-apply-only");
    process.exit(2);
  }
  process.exit(result.refuting === 0 && result.complete ? 0 : 1);
}
