// Round 3 oracle fixture runner: a prototype of `doc-verify oracle test` (design 05 §Oracle toolkit).
//
//   node worklog/kernel-trials/probe/oracle-test.mjs --fixtures [--oracle NAME] [--cap 300] [--repeat N] [--ledger NAME] [--show-evidence] [--reversed]
//   node worklog/kernel-trials/probe/oracle-test.mjs --corpus --repeat N [--cap 300]
//   node worklog/kernel-trials/probe/oracle-test.mjs --real-cells [--labels FILE] [--repeat N] [--cap N] [--ledger NAME]
//
// Round 6 additions: `--request-shape batched|per-atom|both` (fixtures and real cells) sets the
// module-level `request_shape` of every module the run's rule names. A repository module (a
// fixture-local one written through `extra_files`, or any other repository path) is rewritten in
// the scratch clone; a shipped library `doc-verify:NAME` is copied from doc-verify/lib into the
// scratch clone under oracle-fixtures/.shapes/NAME.yaml with the field set, the rule names the
// copy, and every `extends: [doc-verify:NAME]` of a module in the run that names a copied library
// is pointed at the copy, so no library is composed twice. Libraries reached only through
// `extends` stay shipped: composition takes `per-atom` from any module in the chain (compose.ts)
// and the shipped libraries declare no shape, so the top modules decide. `both` interleaves the
// shapes per fixture in ABBA order (batched 1, per-atom 1, per-atom 2, batched 2 for --repeat 2).
// `--no-spans` (the default whenever a shape is set; `--spans` keeps them) refuses the span
// follow-ups before they reach the judge; the engine then attaches the section span.
// Every promotion run writes its leaves to oracle-fixtures/.leaves-<ledger>.json: full options and
// distribution, label, answered, threshold, shape, repeat, the main request and the actual position
// in it, batch size, stateBytes, evidence text hash, judge model and SDK version, wall time per
// request and per run. A batched run whose main round takes more than one request per document is
// marked `split` (not a pass). `--reversed` adds the permuted arm (batched only): per chosen
// fixture, `<name>-reversed` with the column's table data rows in reverse order, `expect_cells`
// remapped, checked by the `row-permutation` invariant against its source fixture; the generated
// files are kept in oracle-fixtures/.reversed/. `--invariant-base REV` checks
// `evidence-column-only` against REV instead of HEAD. `--positions` prints each batched atom's
// actual position. `compare-shapes.mjs` reads the sidecars.
//
// Round 8 additions (module pages, round-8-preregistration.md §Runner extension): a set with
// `atom.per_section: true` and per-fixture `expect_sections: {<section-id>: label}` matches one leaf
// of its oracle per section by the atom's last argument (`oracle(D, S)`), and checks the leaf count
// per page equals the page's section count (engine slugger); `expect-rule` recomputes the
// pre-registered rule (`fails` iff the section's body contains the edit; `seeded: false` = all
// holds) and refuses a mismatch; `draft:` pre-registers each fixture's draft verdict; `judged:
// false` marks a structure-only control (a structural NO-GO returns before the judge, so no leaf);
// `sources:` pins fixture files to repository files at HEAD. A directory may hold `fixtures-<x>.yaml`
// beside `fixtures.yaml` (one set per oracle over the same pages); `set:` names a set (default its
// oracle) and `ledger_suffix:` gives it its own ledger `<--ledger>-<suffix>` (question count and
// leaves sidecar), projected per ledger. `--real-cells`: a document may carry its own `rule`, a
// label keyed by a section id matches the atom whose last argument is that section, `commit:` runs
// the pages in a clone at that commit, and every label without an atom (or atom without a label) is
// a problem. `--labels` may be an absolute path.
//
// Round 9 additions (round-9-preregistration.md §Builder notes): `invariant: column-permutation`,
// set-wide or on one fixture (a fixture's `invariant` overrides the set's): the fixture equals the
// governed document at the invariant base except in the cells of `atom.column`, which are a
// multiset permutation of the base's, and row i carries base row `from[i]`'s cell when the fixture
// lists `from` (the lead's fixed permutation); a fixture's `base: <file>` makes that file of the set
// the base instead (defective-swapped: round 4c's good.md). A real-cells label/atom gap is named
// once per request shape (round 8 review, should-fix 1). `--real-cells`: a document naming `source` is a
// generated file (the real derangement arm), written from the working tree into the clone and
// checked by the same invariant against `source` at the labels' `commit`, `from` read from its
// row labels and checked against `rotation` when the labels file names one.
//
// DOC_VERIFY_MOCK_JUDGE=1 wires the SDK's mock judge (it answers the first option, so every oracle
// says its first label): good for wiring and for the exact question count, meaningless as a
// measurement. Without it the checker builds the production backend from TYPESAFE_API_KEY or the
// repository's .env.doc-verify (live mode only; the mock path never reads that file).
//
// Fixture mode: one scratch clone of the repository per oracle (so every link, path and revision
// the document names still resolves, and the repository's own .doc-verify.yaml governs it); each
// fixture is written over its governed path and committed under a .doc-verify.yaml holding only the
// fixture's rule narrowed to that path, then checked twice: `draft` with a
// judge that refuses every call (structure only), and `promotion` with the cache off.
// Corpus mode: `checkDocuments({kind: "all"})` at promotion, cache off, N times. Live runs at the
// repository root; the mock run uses a snapshot of the working tree (HEAD plus modified and
// untracked files, minus ignored files) so it never touches the root's .env.doc-verify.
//
// Question accounting: main questions = sum of request.questions over engine.report.requests with
// round > 0; span follow-ups are the round-0 records. The worst case for a live run is the main
// questions plus one follow-up per asked leaf (every leaf non-passing). Mock runs record that
// projection per run key in oracle-fixtures/.question-count; live runs are charged against --cap,
// and a live run whose projection would cross the cap is not started (complete: false).
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import YAML from "yaml";
import { createHash } from "node:crypto";

const here = import.meta.dirname;
const REPO = path.resolve(here, "../../..");
const FIXTURES = path.join(here, "oracle-fixtures");
const { checkDocuments, mockSupportedBackend } = await import(path.join(REPO, "doc-verify/dist/checker.js"));
const { documentFacts, cellEvidence, splitCells } = await import(path.join(REPO, "doc-verify/dist/engine/facts.js"));

const MOCK = process.env.DOC_VERIFY_MOCK_JUDGE === "1";
const TAG = MOCK ? "MOCK" : "LIVE";
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const value = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : fallback;
};
const CAP = Number(value("--cap", "300"));
const REPEAT = Math.max(1, Number(value("--repeat", "1")));
const ONLY = value("--oracle", undefined);
const LEDGER_NAME = value("--ledger", undefined);
/**
 * Round 8: a fixture set may name `ledger_suffix` (one per module-page kind), and its runs then go
 * to the ledger `<--ledger>-<suffix>` (or `<suffix>` without --ledger): its own question count and
 * leaves sidecar, so one invocation over four kinds keeps four ledgers. `undefined` is the default.
 */
const ledgerNameFor = (suffix) => (suffix === undefined ? LEDGER_NAME : LEDGER_NAME === undefined ? suffix : `${LEDGER_NAME}-${suffix}`);
const countFileOf = (name) => path.join(FIXTURES, name === undefined ? ".question-count" : `.question-count-${name}`);
const SHOW_EVIDENCE = flag("--show-evidence");
const SHAPE_ARG = value("--request-shape", undefined);
if (SHAPE_ARG !== undefined && !["batched", "per-atom", "both"].includes(SHAPE_ARG)) {
  console.log(`--request-shape must be batched, per-atom or both, not ${SHAPE_ARG}`);
  process.exit(2);
}
/** The shapes this invocation runs; `undefined` leaves every module as written. */
const SHAPES = SHAPE_ARG === undefined ? [undefined] : SHAPE_ARG === "both" ? ["batched", "per-atom"] : [SHAPE_ARG];
/** Span follow-ups are skipped by default whenever a shape is set (round 6); `--spans` keeps them. */
const NO_SPANS = flag("--no-spans") || (SHAPE_ARG !== undefined && !flag("--spans"));
const POSITIONS = flag("--positions");
const REVERSED = flag("--reversed");
const REVERSED_ONLY = value("--reversed-only", undefined)?.split(",");
const REVERSED_DEFAULT = { evidence_reasons: ["good", "defective-pointers", "controls", "mixed-one-pointer"] };
const INVARIANT_BASE = value("--invariant-base", "HEAD");
const SEED_SPLIT_BYTES = value("--seed-split-bytes", undefined) === undefined ? undefined : Number(value("--seed-split-bytes"));
const ONLY_FIXTURE = value("--fixture", undefined);
const leavesFileOf = (name) => path.join(FIXTURES, name === undefined ? ".leaves.json" : `.leaves-${name}.json`);
const LIB = path.join(REPO, "doc-verify/lib");
const SHAPES_DIR = "worklog/kernel-trials/probe/oracle-fixtures/.shapes";
const SEP_P = 0.6;
const STABILITY_MIN_ATOMS = 5;
const sha = (text) => createHash("sha256").update(text).digest("hex").slice(0, 16);
const SDK_VERSION = (() => {
  try { return JSON.parse(readFileSync(path.join(REPO, "node_modules/deepclause-sdk/package.json"), "utf8")).version; } catch { return "unknown"; }
})();

/**
 * The ABBA schedule: repeat r runs batched then per-atom when r is odd, per-atom then batched when
 * even, so `--repeat 2` is batched 1, per-atom 1, per-atom 2, batched 2 and drift lands evenly.
 */
function schedule(shapes, repeat) {
  const steps = [];
  for (let r = 1; r <= repeat; r += 1) {
    const order = shapes.length === 2 && r % 2 === 0 ? [...shapes].reverse() : shapes;
    for (const shape of order) steps.push({ shape, repeat: r });
  }
  return steps;
}
const shapeKey = (runKey, shape) => (shape === undefined ? runKey : `${runKey}@${shape}`);

// ---------------------------------------------------------------- question ledger

/** The question ledgers this invocation touches, by name (`undefined` = the default ledger). */
const ledgers = new Map();
function ledgerOf(name) {
  if (!ledgers.has(name)) {
    let data;
    try {
      data = JSON.parse(readFileSync(countFileOf(name), "utf8"));
    } catch {
      data = { cap: CAP, live: { questions: 0, followups: 0, requests: 0, runs: [] }, mock: { projections: {} } };
    }
    ledgers.set(name, data);
  }
  return ledgers.get(name);
}
function saveLedger(name) {
  mkdirSync(FIXTURES, { recursive: true });
  writeFileSync(countFileOf(name), `${JSON.stringify(ledgerOf(name), null, 2)}\n`);
}
/** Live questions spent over every ledger this invocation touches: --cap bounds the invocation. */
const liveSpent = () => [...ledgers.values()].reduce((a, l) => a + l.live.questions + l.live.followups, 0);

/** Costs of one checkDocuments report. */
function costOf(report) {
  let main = 0, followups = 0, requests = 0, asked = 0, bytes = 0;
  for (const artifact of report.artifacts) {
    const engine = artifact.engine?.report;
    if (engine === undefined) continue;
    for (const record of engine.requests) {
      requests += 1;
      if (record.round === 0) followups += record.questions; else main += record.questions;
    }
    for (const leaf of engine.oracles) {
      if (leaf.key !== "-" && !leaf.cacheHit) asked += 1;
      bytes += leaf.bytes;
    }
  }
  // With the span follow-ups skipped, the live worst case is the main questions alone.
  return { main, followups, requests, asked, worst: NO_SPANS ? main : main + asked, bytes };
}

/** Whether a live run of these (run key, runs) may start; mock runs are never charged. */
function mayStart(runKeys, name = LEDGER_NAME) {
  if (MOCK) return true;
  const ledger = ledgerOf(name);
  const list = Array.isArray(runKeys) ? runKeys : [[runKeys, 1]];
  let projected = 0;
  let unknown = false;
  for (const [key, runs] of list) {
    const one = ledger.mock.projections[key]?.worst;
    if (one === undefined) unknown = true; else projected += one * runs;
  }
  const spent = liveSpent();
  if (spent >= CAP || spent + projected > CAP) {
    console.log(`CAP  refusing ${list.map(([k]) => k).join(", ")}: spent ${spent} + projected ${projected}${unknown ? "+?" : ""} > cap ${CAP}`);
    return false;
  }
  return true;
}
function charge(runKey, cost, name = LEDGER_NAME) {
  const ledger = ledgerOf(name);
  if (MOCK) {
    ledger.mock.projections[runKey] = { main: cost.main, asked: cost.asked, worst: cost.worst, requests: cost.requests };
  } else {
    ledger.live.questions += cost.main;
    ledger.live.followups += cost.followups;
    ledger.live.requests += cost.requests;
    ledger.live.runs.push({ run: runKey, ...cost, at: new Date().toISOString() });
  }
  saveLedger(name);
}

// ---------------------------------------------------------------- backends

function backendForPromotion() {
  return MOCK ? mockSupportedBackend() : undefined;
}
/**
 * The promotion judge wrapped with a timer: one entry per `complete` call, with its question ids
 * and a hash of each key's evidence text, so each engine request record gets its wall time and
 * each leaf its text identity. Live, the judge is built exactly as the checker would
 * (`productionBackend(config.judge.model)`); without a key it stays undefined and the checker
 * reports BLOCKED as before. `--no-spans`: a span follow-up (every id `KEY::span`) is refused
 * before it reaches the judge; the engine then attaches the section span (option C), exactly as
 * when a follow-up cannot be asked, and records no request for it.
 */
async function timedBackend(repo) {
  const model = YAML.parse(readFileSync(path.join(repo, ".doc-verify.yaml"), "utf8")).judge?.model ?? "unknown";
  let base = backendForPromotion();
  if (base === undefined) {
    const { productionBackend } = await import(path.join(REPO, "doc-verify/dist/judge.js"));
    try { base = productionBackend(model); } catch { return { backend: undefined, calls: [], model }; }
  }
  const calls = [];
  const backend = {
    ...base,
    capabilities: base.capabilities,
    complete: async (request) => {
      const ids = request.questions.map((q) => q.id);
      if (NO_SPANS && ids.length > 0 && ids.every((id) => id.endsWith("::span"))) {
        calls.push({ ids, ms: 0, skipped: true });
        throw new Error("span follow-ups disabled (--no-spans)");
      }
      const evidence = Object.fromEntries(Object.entries(request.state?.evidence ?? {}).map(([k, v]) => [k, sha(v.text ?? "")]));
      const started = performance.now();
      try {
        return await base.complete(request);
      } finally {
        calls.push({ ids, ms: performance.now() - started, evidence });
      }
    },
  };
  return { backend, calls, model };
}
/** Draft runs ask nothing; this judge makes sure of it. */
function refusingBackend() {
  const mock = mockSupportedBackend();
  return { ...mock, capabilities: mock.capabilities, complete: async () => { throw new Error("draft run asked the judge"); } };
}
if (!MOCK) {
  // Live only: the fixture scratch repositories carry no .env.doc-verify, so load the root's.
  const { loadDocVerifyEnv } = await import(path.join(REPO, "doc-verify/dist/local-env.js"));
  loadDocVerifyEnv(REPO);
}

// ---------------------------------------------------------------- scratch repositories

const GIT_ENV = { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_SYSTEM: "/dev/null" };
function git(cwd, gitArgs, encoding) {
  return execFileSync("git", gitArgs, { cwd, env: GIT_ENV, encoding, stdio: ["ignore", encoding ? "pipe" : "ignore", "ignore"] });
}
function cloneRepo() {
  const dir = mkdtempSync(path.join(tmpdir(), "oracle-test-"));
  git(tmpdir(), ["clone", "-q", "--shared", REPO, dir]);
  git(dir, ["config", "user.email", "oracle-test@example.invalid"]);
  git(dir, ["config", "user.name", "oracle-test"]);
  git(dir, ["config", "commit.gpgsign", "false"]);
  return dir;
}
function commitAll(repo, message) {
  git(repo, ["add", "-A"]);
  try { git(repo, ["commit", "-qm", message]); } catch { /* unchanged content */ }
}
/** HEAD plus the working tree's modified and untracked (not ignored) files, uncommitted as at the root. */
function snapshotWorkingTree() {
  const dir = cloneRepo();
  const listed = git(REPO, ["ls-files", "-m", "-o", "--exclude-standard", "-z"], "utf8").split("\0").filter(Boolean);
  for (const file of listed) {
    if (file.includes("node_modules/") || path.basename(file).startsWith(".env")) continue;
    const from = path.join(REPO, file);
    if (!existsSync(from)) continue;
    mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    cpSync(from, path.join(dir, file));
  }
  return dir;
}

// ---------------------------------------------------------------- request shape

const isLib = (ref) => ref.startsWith("doc-verify:");
const libName = (ref) => ref.slice("doc-verify:".length);
const shapeCopy = (ref) => `${SHAPES_DIR}/${libName(ref)}.yaml`;
/** The rule's module list with each shipped library replaced by its shaped copy (when a shape is set). */
function shapedModules(modules) {
  return SHAPE_ARG === undefined ? modules : modules.map((ref) => (isLib(ref) ? shapeCopy(ref) : ref));
}
/** `request_shape: SHAPE` set at the module's top level, one line changed or added. */
function withShape(text, file, shape) {
  const lines = text.split("\n");
  const at = lines.findIndex((line) => /^request_shape:/.test(line));
  if (at >= 0) lines[at] = `request_shape: ${shape}`;
  else {
    let after = lines.findIndex((line) => /^rounds:/.test(line));
    if (after < 0) after = lines.findIndex((line) => /^kind:/.test(line));
    if (after < 0) throw new Error(`${file}: no top-level kind: line to place request_shape after`);
    lines.splice(after + 1, 0, `request_shape: ${shape}`);
  }
  const out = lines.join("\n");
  if (YAML.parse(out).request_shape !== shape) throw new Error(`${file}: request_shape did not take`);
  return out;
}
/** `extends: [doc-verify:NAME]` entries that name a copied library, pointed at the copy (flow style only). */
function withCopiedExtends(text, file, copied) {
  const parsed = YAML.parse(text);
  const parents = parsed.extends ?? [];
  if (!parents.some((ref) => copied.has(ref))) return text;
  const lines = text.split("\n");
  const at = lines.findIndex((line) => /^extends:\s*\[/.test(line));
  if (at < 0) throw new Error(`${file}: extends names a copied library but is not a one-line flow list`);
  const dir = path.posix.dirname(file);
  const mapped = parents.map((ref) => (copied.has(ref) ? path.posix.relative(dir, shapeCopy(ref)) : ref));
  lines[at] = `extends: [${mapped.join(", ")}]`;
  const out = lines.join("\n");
  if (JSON.stringify(YAML.parse(out).extends) !== JSON.stringify(mapped)) throw new Error(`${file}: extends rewrite did not take`);
  return out;
}
/** The shape every library a module reaches through `extends` declares, for the record. */
function libraryShapes(ref, seen = new Map()) {
  if (seen.has(ref)) return seen;
  const parsed = YAML.parse(readFileSync(path.join(LIB, `${libName(ref)}.yaml`), "utf8"));
  seen.set(ref, parsed.request_shape ?? "(none: batched)");
  for (const parent of parsed.extends ?? []) if (isLib(parent)) libraryShapes(parent, seen);
  return seen;
}
/**
 * Writes `shape` into every module the rule names, in the scratch clone: shipped libraries are
 * copied to .shapes/ (fresh from doc-verify/lib each time), repository modules (and the repository
 * modules they extend) are rewritten in place; an `extends` naming a copied library points at the
 * copy. Returns what each module of the run declares, for the sidecar.
 */
function applyShape(repo, modules, shape) {
  if (shape === undefined) return [];
  const copied = new Set(modules.filter(isLib));
  const declared = [];
  const done = new Set();
  const rewrite = (file) => {
    if (done.has(file)) return;
    done.add(file);
    const full = path.join(repo, file);
    const text = withShape(withCopiedExtends(readFileSync(full, "utf8"), file, copied), file, shape);
    writeFileSync(full, text);
    const parsed = YAML.parse(text);
    declared.push({ module: file, request_shape: parsed.request_shape });
    for (const parent of parsed.extends ?? []) {
      if (isLib(parent)) for (const [lib, s] of libraryShapes(parent)) declared.push({ module: lib, request_shape: s, via: "extends (shipped)" });
      else rewrite(path.posix.normalize(path.posix.join(path.posix.dirname(file), parent)));
    }
  };
  for (const ref of copied) {
    mkdirSync(path.join(repo, SHAPES_DIR, path.dirname(libName(ref))), { recursive: true });
    cpSync(path.join(LIB, `${libName(ref)}.yaml`), path.join(repo, shapeCopy(ref)));
  }
  for (const ref of modules) rewrite(isLib(ref) ? shapeCopy(ref) : ref);
  const seen = new Set();
  return declared.filter((d) => !seen.has(d.module) && seen.add(d.module));
}

// ---------------------------------------------------------------- leaves

const oracleOf = (leaf) => leaf.atom.split("(")[0].split(/::|\./).at(-1);
const peak = (leaf) => (leaf.distribution.length === 0 ? undefined : Math.max(...leaf.distribution));
/** decides | judge-unknown | threshold-demoted | tie-or-malformed (unasked leaves count as malformed). */
function shapeOf(leaf) {
  if (leaf.key === "-" || leaf.finding !== undefined) return "tie-or-malformed";
  if (leaf.answered === "unknown") return "judge-unknown";
  if (leaf.label === "unknown") return "threshold-demoted";
  return "decides";
}
const fmt = (x, digits = 2) => (x === undefined || x === null || Number.isNaN(x) ? "-" : x.toFixed(digits));
function table(header, rows) {
  const widths = header.map((h, i) => Math.max(String(h).length, ...rows.map((r) => String(r[i]).length)));
  const line = (r) => `  ${r.map((c, i) => String(c).padEnd(widths[i])).join("  ")}`;
  console.log(line(header));
  console.log(line(widths.map((w) => "-".repeat(w))));
  for (const r of rows) console.log(line(r));
}
/** The `rowN` of a per-row atom (`...#rowN, ...`), or "" for a section atom. */
const rowOf = (leaf) => /#(row\d+)/.exec(leaf.atom)?.[1] ?? "";
const rowIdOf = (atom) => /([a-z0-9-]+#row\d+)/.exec(atom)?.[1] ?? "";
/**
 * Round 8: the section an atom names as its last argument (`oracle(D, S)`), or "" when the last
 * argument is a list, a row, or absent. A section-keyed atom (`current_not_history(D, S)`) is
 * matched, expected and labelled by this id, exactly as the engine's slugger emits it.
 */
function sectionArg(atom) {
  const open = atom.indexOf("(");
  if (open < 0 || !atom.endsWith(")")) return "";
  const args = atom.slice(open + 1, -1);
  if (args.endsWith("]")) return "";
  const last = args.split(", ").at(-1).trim();
  return last.includes("#") ? "" : last;
}

// ---------------------------------------------------------------- leaves sidecar

const sidecars = new Map();
function sidecarOf(name) {
  if (!sidecars.has(name)) {
    let data;
    try {
      data = JSON.parse(readFileSync(leavesFileOf(name), "utf8"));
    } catch {
      data = { ledger: name ?? null, runs: [] };
    }
    sidecars.set(name, data);
  }
  return sidecars.get(name);
}
/**
 * One promotion report as a sidecar run entry; a re-run of the same (run, shape, repeat) replaces
 * it. Per request: index, kind, round, questions (the batch size), stateBytes, wall time, the
 * distinct oracles it carries. Per leaf: the full options and distribution, label, answered,
 * threshold, the main request it went in and its actual 0-based position there (the engine orders
 * a batch by key), the batch size, the request's stateBytes, a hash of the evidence text the judge
 * was sent. `split`: a batched run whose main round took more than one request for a document.
 */
function recordRun({ runKey, mode, fixture, source, arm, repeat, shape, report, calls, model, wall, modules, labelsFile, expect, lead, origRow, ledgerName = LEDGER_NAME, set }) {
  const requests = [];
  const leaves = [];
  const splits = [];
  let atomic = true;
  for (const artifact of report.artifacts) {
    const engine = artifact.engine?.report;
    if (engine === undefined) continue;
    const pending = calls.filter((c) => !c.skipped);
    const callOf = (keys, round) => {
      const ids = round === 0 ? keys.map((k) => `${k}::span`) : keys;
      const i = pending.findIndex((c) => c.ids.length === ids.length && c.ids.every((id, j) => id === ids[j]));
      return i < 0 ? undefined : pending.splice(i, 1)[0];
    };
    const mainOf = new Map();
    const followed = new Set();
    const textOf = new Map();
    const perRound = new Map();
    const first = requests.length;
    for (const record of engine.requests) {
      const index = requests.length;
      const call = callOf(record.keys, record.round);
      for (const [k, h] of Object.entries(call?.evidence ?? {})) if (record.round !== 0) textOf.set(k, h);
      requests.push({ index, document: artifact.path, round: record.round, kind: record.round === 0 ? "follow-up" : "main",
        questions: record.questions, stateBytes: record.stateBytes, ms: call?.ms ?? null, keys: record.keys, oracles: [] });
      if (record.round !== 0) {
        perRound.set(record.round, (perRound.get(record.round) ?? 0) + 1);
        if (record.questions !== 1) atomic = false;
      }
      record.keys.forEach((key, position) => {
        if (record.round === 0) followed.add(key);
        else mainOf.set(key, { request: index, position, size: record.keys.length, stateBytes: record.stateBytes });
      });
    }
    for (const [round, count] of perRound) if (count > 1) splits.push({ document: artifact.path, round, requests: count });
    for (const leaf of engine.oracles) {
      const at = mainOf.get(leaf.key);
      const rowId = rowIdOf(leaf.atom);
      const section = rowId === "" ? sectionArg(leaf.atom) : "";
      if (at !== undefined) {
        const list = requests[at.request].oracles;
        if (!list.includes(oracleOf(leaf))) list.push(oracleOf(leaf));
      }
      leaves.push({
        run: runKey, mode, fixture, source: source ?? fixture, arm: arm ?? "normal", repeat, shape: shape ?? "module-default",
        document: artifact.path, verdict: artifact.verdict, oracle: oracleOf(leaf), atom: leaf.atom, row: rowOf(leaf), rowId, section,
        origRowId: origRow?.(rowId) ?? rowId,
        key: leaf.key, label: leaf.label, answered: leaf.answered, options: leaf.options, distribution: leaf.distribution, p: peak(leaf) ?? null,
        threshold: leaf.threshold, leafShape: shapeOf(leaf), finding: leaf.finding ?? null,
        request: at?.request ?? null, position: at?.position ?? null, requestSize: at?.size ?? null, requestStateBytes: at?.stateBytes ?? null,
        followup: followed.has(leaf.key), bytes: leaf.bytes, cacheHit: leaf.cacheHit,
        textHash: textOf.get(leaf.key) ?? null, questionHash: sha(leaf.question ?? ""),
        expect: expect?.(leaf) ?? null, lead: lead?.(artifact.path, rowId || section) ?? null,
      });
    }
    void first;
  }
  for (const r of requests) r.mixed = r.oracles.length > 1;
  const cost = costOf(report);
  const split = shape === "batched" && splits.length > 0;
  const entry = { run: runKey, mode, fixture, source: source ?? fixture, set: set ?? null, ledger: ledgerName ?? null, arm: arm ?? "normal", repeat, shape: shape ?? "module-default", tag: TAG,
    model, sdk: SDK_VERSION, spans: NO_SPANS ? "skipped" : "asked", labelsFile: labelsFile ?? null, modules,
    wall_ms: wall, cost, split, splits, atomic: shape === "per-atom" ? atomic : null,
    verdicts: Object.fromEntries(report.artifacts.map((a) => [a.path, a.verdict])), requests, leaves, at: new Date().toISOString() };
  const sidecar = sidecarOf(ledgerName);
  sidecar.runs = sidecar.runs.filter((r) => !(r.run === runKey && r.repeat === repeat && r.shape === entry.shape));
  sidecar.runs.push(entry);
  mkdirSync(FIXTURES, { recursive: true });
  writeFileSync(leavesFileOf(ledgerName), `${JSON.stringify(sidecar, null, 1)}\n`);
  if (split) console.log(`SPLIT ${runKey}@batched rep ${repeat}: ${splits.map((s) => `${s.document} round ${s.round} in ${s.requests} requests`).join("; ")} -- not a pass`);
  if (shape === "per-atom" && !atomic) console.log(`NOT-ATOMIC ${runKey}@per-atom rep ${repeat}: a main request carried more than one question`);
  return entry;
}
/** `--positions`: each atom's main request and its actual place in it. */
function printPositions(entries) {
  const list = entries.filter((e) => e.shape === "batched" || SHAPE_ARG === undefined);
  console.log("");
  console.log("positions (batched; request = main request index in the run, pos = actual 0-based place / batch size; the engine orders a batch by key)");
  table(["run", "arm", "rep", "atom", "orig", "label", "p", "request", "pos/size", "oracles in request"],
    list.flatMap((e) => e.leaves.filter((l) => l.request !== null).map((l) => [e.fixture, e.arm, e.repeat, l.rowId || l.atom.slice(0, 50), l.origRowId || "-", l.label, fmt(l.p),
      l.request, `${l.position}/${l.requestSize}`, e.requests[l.request].oracles.join("+")])));
}
/** Request counts per shape, the split check, and the live projection (for one ledger's entries). */
function printRequests(entries, ledgerName = entries[0]?.ledger ?? LEDGER_NAME) {
  console.log("");
  console.log(`${ledgerName === undefined || ledgerName === null ? "" : `ledger ${ledgerName}: `}requests per shape (spans ${NO_SPANS ? "skipped (--no-spans)" : "asked"}; model ${entries[0]?.model ?? "-"}, deepclause-sdk ${SDK_VERSION})`);
  const shapes = [...new Set(entries.map((e) => e.shape))];
  const rows = [];
  for (const shape of shapes) {
    for (const arm of [...new Set(entries.map((e) => e.arm))]) {
      const list = entries.filter((e) => e.shape === shape && e.arm === arm);
      if (list.length === 0) continue;
      const reqs = list.flatMap((e) => e.requests);
      const main = reqs.filter((r) => r.kind === "main");
      const timed = reqs.filter((r) => r.ms !== null);
      const repeats = Math.max(...list.map((e) => e.repeat));
      const first = list.filter((e) => e.repeat === 1);
      const mainQ = first.reduce((a, e) => a + e.cost.main, 0);
      const worst = first.reduce((a, e) => a + e.cost.worst, 0);
      rows.push([shape, arm, list.length, main.length, main.reduce((a, r) => a + r.questions, 0), reqs.length - main.length,
        `[${[...new Set(first.map((e) => e.requests.filter((r) => r.kind === "main").length))].join(",")}]`,
        main.reduce((a, r) => a + r.stateBytes, 0), (timed.reduce((a, r) => a + r.ms, 0) / 1000).toFixed(2),
        list.filter((e) => e.split).length, mainQ, repeats, mainQ * repeats, worst * repeats]);
    }
  }
  table(["shape", "arm", "runs", "main req", "main q", "follow-up req", "main req/run (distinct)", "stateBytes", "judge s", "split runs",
    "main q/repeat", "repeats", "projected main", "projected worst"], rows);
  const totalWorst = rows.reduce((a, r) => a + r[13], 0);
  console.log(`projection (live, ${ledgerName === undefined || ledgerName === null ? "this invocation" : `ledger ${ledgerName}`}): main ${rows.reduce((a, r) => a + r[12], 0)}, worst ${totalWorst}; cap at 1.5x worst = ${Math.ceil(totalWorst * 1.5)}; sidecar ${path.relative(REPO, leavesFileOf(ledgerName ?? undefined))}`);
}

// ---------------------------------------------------------------- --fixtures

/**
 * Every `fixtures.yaml` (and, round 8, every `fixtures-<name>.yaml` beside it: one directory may
 * hold one set per oracle over the same pages). A set's label is its `set` field, else its oracle;
 * its ledger is `ledgerNameFor(ledger_suffix)`.
 */
function loadFixtureSets() {
  return readdirSync(FIXTURES, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .flatMap((entry) => readdirSync(path.join(FIXTURES, entry.name)).filter((n) => /^fixtures(-[a-z0-9-]+)?\.yaml$/.test(n)).sort()
      .map((n) => ({ dir: path.join(FIXTURES, entry.name), specFile: n, spec: YAML.parse(readFileSync(path.join(FIXTURES, entry.name, n), "utf8")) })))
    .map((set) => ({ ...set, label: set.spec.set ?? set.spec.oracle, ledgerName: ledgerNameFor(set.spec.ledger_suffix) }))
    .filter((set) => ONLY === undefined || set.spec.oracle === ONLY);
}

// ---------------------------------------------------------------- per-section sets (round 8)

const perSection = (set) => set.spec.atom?.per_section === true;
/** The fixture's sections as the engine's slugger emits them. */
const sectionsOf = (set, markdown) => documentFacts({ path: set.spec.document, markdown }).sections;
/**
 * The byte span [s, e) of the fixture that its edit changed: the replaced text, with what `from`
 * and `to` share at either end trimmed off. Pure deletion gives s === e.
 */
function editSpan(set, fixture, text) {
  if (fixture.edit === undefined) return undefined;
  const { from, to } = fixture.edit;
  const at = fixtureText(set, "good.md").indexOf(from);
  if (at < 0) return undefined;
  let pre = 0;
  while (pre < from.length && pre < to.length && from[pre] === to[pre]) pre += 1;
  let suf = 0;
  while (suf < from.length - pre && suf < to.length - pre && from[from.length - 1 - suf] === to[to.length - 1 - suf]) suf += 1;
  const bytes = (n) => Buffer.byteLength(text.slice(0, n));
  return [bytes(at + pre), bytes(at + to.length - suf)];
}
/**
 * The pre-registered rule, checked: a section's expected label is `fails` iff its body (heading
 * plus subtree, `core.body`) contains the edit, else `holds`; `expect_sections` must name exactly
 * the fixture's sections. A fixture marked `seeded: false` (the margin page, good-near) carries an
 * edit that is not a defect: every section `holds`. Returns "ok" or what differs.
 */
function expectRuleIntegrity(set, fixture, text) {
  const sections = sectionsOf(set, text);
  const span = fixture.seeded === false ? undefined : editSpan(set, fixture, text);
  const want = Object.fromEntries(sections.map((sec) => {
    if (span === undefined) return [sec.id, "holds"];
    const [s, e] = span;
    const hit = e > s ? sec.startByte < e && sec.endByte > s : sec.startByte <= s && s <= sec.endByte;
    return [sec.id, hit ? "fails" : "holds"];
  }));
  const got = fixture.expect_sections ?? {};
  const diffs = [];
  for (const id of new Set([...Object.keys(want), ...Object.keys(got)])) {
    if (want[id] !== got[id]) diffs.push(`${id}: listed ${got[id] ?? "(missing)"}, rule ${want[id] ?? "(no such section)"}`);
  }
  return diffs.length === 0 ? "ok" : `MISMATCH ${diffs.join("; ")}`;
}
/** `sources: {file: repo path}`: each named fixture file equals that path at HEAD. */
function sourceIntegrity(set) {
  return Object.entries(set.spec.sources ?? {}).map(([file, repoPath]) => {
    let head;
    try { head = git(REPO, ["show", `HEAD:${repoPath}`], "utf8"); } catch { return `${file}: ${repoPath} not at HEAD`; }
    return fixtureText(set, file) === head ? "ok" : `${file}: differs from ${repoPath} at HEAD`;
  }).filter((x) => x !== "ok");
}

/** Where a set's Markdown files live: its own directory, or the sibling set it names in `files_from`. */
function filesDir(set) {
  return set.spec.files_from === undefined ? set.dir : path.resolve(set.dir, set.spec.files_from);
}
function fixtureText(set, file) {
  return readFileSync(path.join(filesDir(set), file), "utf8");
}
const baseText = (repoPath) => git(REPO, ["show", `${INVARIANT_BASE}:${repoPath}`], "utf8");

/**
 * `invariant: evidence-column-only`: the fixture equals the governed document at the invariant
 * base (HEAD unless `--invariant-base REV`) line for line, except that a table data row may differ
 * in the cells under `atom.column` alone.
 */
function columnOnlyIntegrity(set, text0) {
  const column = set.spec.atom.column;
  const head = baseText(set.spec.document).split("\n");
  const text = text0.split("\n");
  if (head.length !== text.length) return `line count ${text.length} != ${INVARIANT_BASE} ${head.length}`;
  let header;
  for (let i = 0; i < head.length; i += 1) {
    if (head[i] === text[i]) {
      if (/^\s*\|/.test(head[i]) && /^\s*\|?\s*:?-+/.test(head[i + 1] ?? "")) header = splitCells(head[i]);
      continue;
    }
    if (!/^\s*\|/.test(head[i]) || header === undefined) return `line ${i + 1} differs outside a table`;
    const a = splitCells(head[i]), b = splitCells(text[i]);
    if (a.length !== b.length) return `line ${i + 1}: cell count differs`;
    for (let c = 0; c < a.length; c += 1) {
      if (header[c] !== column && a[c] !== b[c]) return `line ${i + 1}: column '${header[c]}' differs`;
    }
  }
  return "ok";
}

/** The one table whose header names `column`: header line index and its data row line indexes. */
function columnTable(lines, column) {
  const found = [];
  for (let i = 0; i + 1 < lines.length; i += 1) {
    if (!/^\s*\|/.test(lines[i]) || !/^\s*\|?\s*:?-+/.test(lines[i + 1])) continue;
    if (!splitCells(lines[i]).includes(column)) continue;
    const rows = [];
    for (let j = i + 2; j < lines.length && /^\s*\|/.test(lines[j]); j += 1) rows.push(j);
    found.push({ header: i, rows });
  }
  if (found.length !== 1) throw new Error(`${found.length} tables have a '${column}' column; the reversed arm needs exactly one`);
  return found[0];
}
/** The fixture with its table's data rows in reverse order (row ids renumber by document order). */
function reverseRows(markdown, column) {
  const lines = markdown.split("\n");
  const { rows } = columnTable(lines, column);
  const reversed = rows.map((i) => lines[i]).reverse();
  rows.forEach((i, k) => { lines[i] = reversed[k]; });
  return { text: lines.join("\n"), n: rows.length };
}
/**
 * `invariant: row-permutation`: against its source fixture, every data row of the column's table
 * appears exactly once and nothing else differs.
 */
function rowPermutationIntegrity(sourceText, text, column) {
  const a = sourceText.split("\n"), b = text.split("\n");
  if (a.length !== b.length) return `line count ${b.length} != source ${a.length}`;
  const { rows } = columnTable(a, column);
  const inTable = new Set(rows);
  for (let i = 0; i < a.length; i += 1) if (!inTable.has(i) && a[i] !== b[i]) return `line ${i + 1} differs outside the table's data rows`;
  const want = rows.map((i) => a[i]);
  const got = rows.map((i) => b[i]);
  if (new Set(want).size !== want.length) return "source has duplicate data rows";
  const left = [...want];
  for (const row of got) {
    const k = left.indexOf(row);
    if (k < 0) return "a data row is not a source row";
    left.splice(k, 1);
  }
  return left.length === 0 ? "ok" : "a source row is missing";
}

/**
 * Round 9 `invariant: column-permutation` (a fixture's own `invariant`, overriding the set's):
 * against `baseMarkdown` (the governed document at the invariant base, or a labels file's source
 * at its commit) the text is equal line for line outside the data rows of the one table naming
 * `column`; in those rows every other cell is equal; the column's cells are a multiset permutation
 * of the base's; and, when `from` is given (1-based, per row), row i carries exactly base row
 * from[i]'s cell. Any other difference is a MISMATCH naming the first one found.
 */
function columnPermutationIntegrity(baseMarkdown, text0, column, from) {
  const head = baseMarkdown.split("\n"), text = text0.split("\n");
  if (head.length !== text.length) return `MISMATCH line count ${text.length} != base ${head.length}`;
  let table;
  try { table = columnTable(head, column); } catch (error) { return `MISMATCH ${error.message}`; }
  const col = splitCells(head[table.header]).indexOf(column);
  const inRows = new Set(table.rows);
  for (let i = 0; i < head.length; i += 1) {
    if (!inRows.has(i) && head[i] !== text[i]) return `MISMATCH line ${i + 1} differs outside the '${column}' table's data rows`;
  }
  const want = [], got = [];
  for (const i of table.rows) {
    const a = splitCells(head[i]), b = splitCells(text[i]);
    if (!/^\s*\|/.test(text[i]) || a.length !== b.length) return `MISMATCH line ${i + 1}: not a row of the same width`;
    for (let c = 0; c < a.length; c += 1) if (c !== col && a[c] !== b[c]) return `MISMATCH line ${i + 1}: cell ${c + 1} differs outside '${column}'`;
    want.push(a[col]);
    got.push(b[col]);
  }
  const sorted = (list) => [...list].sort().join("\u0000");
  if (sorted(want) !== sorted(got)) return `MISMATCH the '${column}' cells are not a permutation of the base's`;
  if (from !== undefined) {
    if (from.length !== want.length) return `MISMATCH from lists ${from.length} rows, the table has ${want.length}`;
    for (let k = 0; k < want.length; k += 1) {
      if (got[k] !== want[from[k] - 1]) return `MISMATCH row${k + 1} does not carry base row${from[k]}'s '${column}' cell`;
    }
  }
  return "ok";
}

/** A defective fixture must be good.md with exactly its recorded edit applied. */
function editIntegrity(set, fixture) {
  if (fixture.arm === "reversed") return rowPermutationIntegrity(fixtureText(set, fixture.sourceFile), fixture.text, set.spec.atom.column);
  const invariant = fixture.invariant ?? set.spec.invariant;
  if (invariant === "column-permutation") {
    // Round 9: a fixture's `base:` names a file of the set (e.g. good.md, the 4c base) as the
    // permutation base instead of the governed document at the invariant base.
    const base = fixture.base === undefined ? baseText(set.spec.document) : fixtureText(set, fixture.base);
    return columnPermutationIntegrity(base, fixtureText(set, fixture.file), set.spec.atom.column, fixture.from);
  }
  if (invariant === "evidence-column-only") return columnOnlyIntegrity(set, fixtureText(set, fixture.file));
  if (fixture.edit === undefined) return "base";
  const good = fixtureText(set, "good.md");
  const text = fixtureText(set, fixture.file);
  const { from, to } = fixture.edit;
  const at = good.indexOf(from);
  if (at < 0 || good.indexOf(from, at + 1) >= 0) return "from-not-unique";
  return good.slice(0, at) + to + good.slice(at + from.length) === text ? "ok" : "MISMATCH";
}

/** The reversed arm's generated fixtures: `<name>-reversed`, `expect_cells` remapped to the new row ids. */
function reversedFixtures(set, problems) {
  if (!REVERSED) return [];
  if (!set.spec.atom.per_row) return [];
  const names = REVERSED_ONLY ?? REVERSED_DEFAULT[set.spec.oracle] ?? set.spec.fixtures.map((f) => f.name);
  const out = [];
  for (const name of names) {
    const fixture = set.spec.fixtures.find((f) => f.name === name);
    if (fixture === undefined) { problems.push(`reversed arm: ${set.spec.oracle} has no fixture '${name}' (skipped)`); continue; }
    const { text, n } = reverseRows(fixtureText(set, fixture.file), set.spec.atom.column);
    const map = (row) => { const k = Number(/row(\d+)/.exec(row)?.[1]); return Number.isFinite(k) && k >= 1 && k <= n ? `row${n + 1 - k}` : row; };
    const expectCells = fixture.expect_cells === undefined ? undefined
      : Object.fromEntries(Object.entries(fixture.expect_cells).map(([row, label]) => [map(row), label]));
    const dir = path.join(FIXTURES, ".reversed", set.spec.oracle);
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, `${name}-reversed.md`), text);
    out.push({ name: `${name}-reversed`, file: null, text, arm: "reversed", source: name, sourceFile: fixture.file, n, expect: fixture.expect,
      ...(expectCells === undefined ? {} : { expect_cells: expectCells }), mapRow: map });
  }
  return out;
}

function findLeaf(report, set, fixture) {
  const artifact = report.artifacts.find((a) => a.path === set.spec.document);
  const leaves = artifact?.engine?.report?.oracles ?? [];
  if (perSection(set)) {
    // Round 8: one leaf per section, matched by the atom's last argument; document order.
    const order = sectionsOf(set, fixture.text ?? fixtureText(set, fixture.file)).map((sec) => sec.id);
    const hits = leaves.filter((leaf) => oracleOf(leaf) === set.spec.oracle && sectionArg(leaf.atom) !== "")
      .sort((a, b) => order.indexOf(sectionArg(a.atom)) - order.indexOf(sectionArg(b.atom)));
    return { artifact, hits, asked: leaves.map((leaf) => `${leaf.atom} [${leaf.sections.join(",")}]`), order };
  }
  // A fixture that renames its section (the receipt's gross rewrite) names its own atom sections.
  const want = [...(fixture.sections ?? set.spec.atom.sections)].sort().join(",");
  const hits = leaves.filter((leaf) => oracleOf(leaf) === set.spec.oracle && [...leaf.sections].sort().join(",") === want)
    .sort((a, b) => rowOf(a).localeCompare(rowOf(b), undefined, { numeric: true }));
  return { artifact, hits, asked: leaves.map((leaf) => `${leaf.atom} [${leaf.sections.join(",")}]`) };
}
/** The expected label of one leaf: per row when the fixture says so, else the fixture's. */
const expectedOf = (fixture, leaf) => fixture.expect_sections?.[sectionArg(leaf.atom)] ?? fixture.expect_cells?.[rowOf(leaf)] ?? fixture.expect;
/** The parsed table rows and the cell text each per-row atom is sent, for the eye. */
function showEvidence(set, fixture, markdown) {
  const facts = documentFacts({ path: set.spec.document, markdown });
  const rows = [...facts.rows.values()].filter((row) => set.spec.atom.sections.includes(row.section));
  console.log(`  parsed ${rows.length} rows in ${set.spec.atom.sections.join(",")}`);
  for (const row of rows) {
    const text = cellEvidence(facts, row.id, set.spec.atom.column)?.text ?? "(empty)";
    console.log(`  ${row.id} L${row.line} ${JSON.stringify(text.length > 160 ? `${text.slice(0, 157)}...` : text)}`);
  }
}

async function runFixtures() {
  console.log(`oracle-test --fixtures (${TAG}; shapes ${SHAPES.map((s) => s ?? "module-default").join(",")}; repeat ${REPEAT}${REVERSED ? "; reversed arm (batched)" : ""}; spans ${NO_SPANS ? "skipped" : "asked"})`);
  const sets = loadFixtureSets();
  if (sets.length === 0) {
    console.log(`no fixture set${ONLY === undefined ? "" : ` for oracle ${ONLY}`}`);
    console.log("complete: false");
    return false;
  }
  // Every ledger this invocation charges is loaded before the first run, so --cap sees them all.
  for (const set of sets) ledgerOf(set.ledgerName);
  const rows = [];
  const problems = [];
  /** Round 8: one line per (per-section set, fixture): sections, leaves per shape, the checks. */
  const pageRows = [];
  let complete = true;
  const totals = { main: 0, followups: 0, asked: 0, worst: 0, requests: 0 };
  let stopped = false;
  const entries = [];
  for (const set of sets) {
    const repo = cloneRepo();
    for (const bad of sourceIntegrity(set)) { complete = false; problems.push(`${set.label}: source integrity ${bad}`); }
    try {
      // The repository's config with one rule: the fixture's own, narrowed to its governed path, so
      // the run checks this document alone (no dependent artifact is pulled into the closure).
      const config = YAML.parse(readFileSync(path.join(repo, ".doc-verify.yaml"), "utf8"));
      config.documents = [{ ...set.spec.rule, modules: shapedModules(set.spec.rule.modules), pattern: set.spec.document }];
      config.invalidation_patterns = [];
      // Seeded defect for the split check only: a byte budget small enough to force sub-batching.
      if (SEED_SPLIT_BYTES !== undefined) config.policy = { ...config.policy, max_evidence_bytes: SEED_SPLIT_BYTES };
      writeFileSync(path.join(repo, ".doc-verify.yaml"), YAML.stringify(config));
      const fixtures = [...set.spec.fixtures, ...reversedFixtures(set, problems)].filter((f) => ONLY_FIXTURE === undefined || f.name === ONLY_FIXTURE);
      for (const fixture of fixtures) {
        const runKey = `fixtures:${set.label}/${fixture.name}`;
        const integrity = editIntegrity(set, fixture);
        if (integrity !== "ok" && integrity !== "base") {
          complete = false;
          problems.push(`${runKey}: ${fixture.arm === "reversed" ? "row-permutation" : (fixture.invariant ?? set.spec.invariant) === "column-permutation" ? "column-permutation" : "edit"} integrity ${integrity}`);
        } else if (fixture.arm === "reversed") {
          console.log(`row-permutation ${runKey}: ok (${fixture.n} data rows reversed against ${fixture.sourceFile})`);
        } else if ((fixture.invariant ?? set.spec.invariant) === "column-permutation") {
          console.log(`column-permutation ${runKey}: ok ('${set.spec.atom.column}' against ${fixture.base === undefined ? `${INVARIANT_BASE}:${set.spec.document}` : `${path.relative(FIXTURES, path.join(filesDir(set), fixture.base))}`}${fixture.from === undefined ? "" : `, from [${fixture.from.join(", ")}]`}${fixture.seed === undefined ? "" : `, seed ${fixture.seed}`})`);
        }
        const markdown = fixture.text ?? fixtureText(set, fixture.file);
        let expectRule = "-";
        if (perSection(set)) {
          expectRule = expectRuleIntegrity(set, fixture, markdown);
          if (expectRule !== "ok") { complete = false; problems.push(`${runKey}: expect rule ${expectRule}`); }
        }
        mkdirSync(path.dirname(path.join(repo, set.spec.document)), { recursive: true });
        writeFileSync(path.join(repo, set.spec.document), markdown);
        if (set.spec.companion !== undefined) {
          writeFileSync(path.join(repo, set.spec.companion.path), fixtureText(set, set.spec.companion.file));
        }
        for (const [repoPath, file] of Object.entries(set.spec.extra_files ?? {})) {
          mkdirSync(path.dirname(path.join(repo, repoPath)), { recursive: true });
          writeFileSync(path.join(repo, repoPath), readFileSync(path.join(set.dir, file), "utf8"));
        }
        // The reversed arm is batched only.
        const shapes = fixture.arm === "reversed" ? (SHAPE_ARG === undefined ? [undefined] : ["batched"]) : SHAPES;
        const steps = schedule(shapes, REPEAT);
        let current = steps[0].shape;
        let modules = applyShape(repo, set.spec.rule.modules, current);
        if (SHOW_EVIDENCE && set.spec.atom.per_row) showEvidence(set, fixture, markdown);
        commitAll(repo, fixture.name);
        const mode = { kind: "paths", paths: [set.spec.document] };
        // Structure only: the draft profile with a judge that refuses every call.
        let draft;
        try {
          const report = await checkDocuments({ root: repo, mode, profile: "draft", cache: "off", backend: refusingBackend() });
          draft = report.artifacts[0]?.verdict ?? "none";
          const draftFindings = report.artifacts[0]?.findings.filter((f) => f.verdict !== "WARN").map((f) => f.ruleId) ?? [];
          if (fixture.draft !== undefined) {
            // Round 8: every fixture's draft status is pre-registered (NO-GO only for the gross control).
            if (draft !== fixture.draft) { complete = false; problems.push(`${runKey}: draft ${draft} (${draftFindings.join(", ") || "no finding"}), pre-registered ${fixture.draft}`); }
          } else {
            if (fixture.expect === "holds" && draft !== "PASS") problems.push(`${runKey}: good fixture fails structure (${draftFindings.join(", ")})`);
            if (fixture.expect !== "holds" && draft !== "PASS") problems.push(`${runKey}: structure already catches it (${draftFindings.join(", ")}) -- fixture defect`);
          }
        } catch (error) {
          draft = `ERROR ${error.message}`;
          complete = false;
        }
        if (!mayStart(shapes.map((s) => [shapeKey(runKey, s), REPEAT]), set.ledgerName)) {
          complete = false;
          stopped = true;
          break;
        }
        const reportsBy = new Map(shapes.map((s) => [s, []]));
        const wallBy = new Map(shapes.map((s) => [s, 0]));
        let threw = false;
        for (const step of steps) {
          if (step.shape !== current) {
            current = step.shape;
            modules = applyShape(repo, set.spec.rule.modules, current);
            commitAll(repo, `${fixture.name} ${current}`);
          }
          try {
            const { backend, calls, model } = await timedBackend(repo);
            const t0 = performance.now();
            const report = await checkDocuments({ root: repo, mode, profile: "promotion", cache: "off", backend });
            const wall = performance.now() - t0;
            reportsBy.get(step.shape).push(report);
            wallBy.set(step.shape, wallBy.get(step.shape) + wall);
            const cost = costOf(report);
            charge(shapeKey(runKey, step.shape), cost, set.ledgerName);
            for (const key of Object.keys(totals)) totals[key] += cost[key];
            const entry = recordRun({ runKey, mode: "fixtures", fixture: `${set.label}/${fixture.name}`, source: `${set.label}/${fixture.source ?? fixture.name}`,
              ledgerName: set.ledgerName, set: set.label,
              arm: fixture.arm ?? "normal", repeat: step.repeat, shape: step.shape, report, calls, model, wall, modules,
              expect: (leaf) => (oracleOf(leaf) === set.spec.oracle ? expectedOf(fixture, leaf) : null),
              origRow: fixture.mapRow === undefined ? undefined : (rowId) => {
                const [section, row] = rowId.split("#");
                return row !== undefined && set.spec.atom.sections.includes(section) ? `${section}#${fixture.mapRow(row)}` : rowId;
              } });
            entries.push(entry);
            if (entry.split) { complete = false; problems.push(`${runKey}@batched rep ${step.repeat}: split (${entry.splits.map((s) => s.requests).join(",")} requests)`); }
            if (entry.atomic === false) { complete = false; problems.push(`${runKey}@per-atom rep ${step.repeat}: a main request carried more than one question`); }
          } catch (error) {
            complete = false;
            threw = true;
            problems.push(`${runKey}@${step.shape}: check threw ${error.message}`);
            break;
          }
        }
        if (threw) continue;
        const page = perSection(set) ? { set: set.label, ledger: set.ledgerName ?? "-", fixture: fixture.name, sections: sectionsOf(set, markdown).map((sec) => sec.id),
          leaves: {}, edit: integrity, expectRule, draft, draftWant: fixture.draft ?? "-" } : undefined;
        if (page !== undefined) pageRows.push(page);
        for (const shape of shapes) {
          const reports = reportsBy.get(shape);
          if (reports.length === 0) continue;
          const wall = wallBy.get(shape) / reports.length;
          const cost = costOf(reports[0]);
          const { artifact, hits, asked } = findLeaf(reports[0], set, fixture);
          if (artifact?.verdict === "BLOCKED") { complete = false; problems.push(`${runKey}@${shape}: BLOCKED ${(artifact.findings ?? []).filter((f) => f.verdict === "BLOCKED").map((f) => f.reason ?? f.message ?? "").join("; ")}`); }
          const perRow = set.spec.atom.per_row === true;
          if (page !== undefined) {
            // One leaf per section, each section once: the leaf count per page is its section count.
            const got = hits.map((leaf) => sectionArg(leaf.atom));
            // `judged: false` (the gross control): a structural NO-GO returns before the judge
            // (checker.ts: findings before the engine), so the page has no leaf and must be NO-GO.
            const same = fixture.judged === false
              ? got.length === 0 && artifact?.verdict === "NO-GO"
              : got.length === page.sections.length && page.sections.every((id) => got.filter((g) => g === id).length === 1);
            page.leaves[shape ?? "default"] = `${hits.length}/${page.sections.length}${fixture.judged === false ? ` (structure, ${artifact?.verdict ?? "-"})` : ""}${same ? "" : " MISMATCH"}`;
            if (!same) {
              complete = false;
              problems.push(`${runKey}@${shape}: ${set.spec.oracle} leaves on sections [${got.join(", ")}], page sections [${page.sections.join(", ")}]; asked: ${asked.join("; ") || "none"}`);
            }
          } else {
            const wantHits = perRow ? (set.spec.atom.rows ?? hits.length) : 1;
            if (hits.length !== wantHits || hits.length === 0) {
              complete = false;
              problems.push(`${runKey}: ${hits.length} leaves match ${set.spec.oracle}[${(fixture.sections ?? set.spec.atom.sections).join(",")}]; asked: ${asked.join("; ") || "none"}`);
            }
          }
          const warnings = artifact?.findings.filter((f) => f.ruleId.endsWith("paths-resolve")).length ?? 0;
          const stable = (leaf) => reports.slice(1).every((report) => findLeaf(report, set, fixture).hits.find((other) => other.atom === leaf.atom)?.label === leaf.label);
          for (const leaf of (hits.length === 0 ? (fixture.judged === false ? [] : [undefined]) : hits)) {
            const p = leaf === undefined ? undefined : peak(leaf);
            const expectSide = leaf === undefined ? fixture.expect : expectedOf(fixture, leaf);
            const separates = leaf !== undefined && leaf.label === expectSide && (p ?? 0) >= SEP_P;
            rows.push({
              oracle: set.label, fixture: fixture.name, shape: shape ?? "default", row: leaf === undefined ? "" : rowOf(leaf) || (perSection(set) ? sectionArg(leaf.atom) : ""), expect: expectSide, got: leaf?.label ?? "NOT-FOUND",
              answered: leaf?.answered ?? "-", p, threshold: leaf?.threshold, leafShape: leaf === undefined ? "-" : shapeOf(leaf),
              verdict: artifact?.verdict ?? "-", draft, bytes: leaf?.bytes, questions: cost.main, worst: cost.worst,
              separates, wall, edit: integrity, sections: leaf?.sections.join(",") ?? "-",
              atomsAsked: asked.length, warnings, stable: leaf === undefined ? "-" : reports.length < 2 ? "n/a" : stable(leaf) ? "same" : "FLIPS",
            });
          }
        }
      }
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
    if (stopped) break;
  }

  console.log("");
  console.log(`fixture leaves, repeat 1 per shape (${TAG}${MOCK ? ": every label is the mock's first option, not a measurement" : ""})`);
  table(
    ["oracle", "fixture", "shape", "row", "expect", "got", "answered", "p", "thr", "leaf", "VERDICT", "draft-only", "bytes", "q", "worst-q", "sep@0.6", "edit", "paths-warn", REPEAT > 1 ? `stable×${REPEAT}` : "stable"],
    rows.map((r) => [r.oracle, r.fixture, r.shape, r.row || "-", r.expect, r.got, r.answered, fmt(r.p), fmt(r.threshold, 1), r.leafShape, r.verdict,
      r.expect === "holds" ? r.draft : r.draft === "NO-GO" ? "NO-GO (caught)" : `${r.draft} (not caught)`,
      r.bytes ?? "-", r.questions, r.worst, r.separates ? "yes" : "no", r.edit, r.warnings, r.stable]),
  );
  const perRowSets = [...new Set(rows.filter((r) => r.row).map((r) => `${r.oracle}/${r.fixture}@${r.shape}`))];
  if (perRowSets.length > 0) {
    console.log("");
    console.log(`per fixture and shape (per-row oracles): cells on their expected side at p >= ${SEP_P}`);
    table(["oracle/fixture@shape", "expected side(s)", "k/n", "separates", "VERDICT"], perRowSets.map((key) => {
      const cells = rows.filter((r) => `${r.oracle}/${r.fixture}@${r.shape}` === key);
      const k = cells.filter((r) => r.separates).length;
      return [key, [...new Set(cells.map((r) => r.expect))].join("+"), `${k}/${cells.length}`, k === cells.length ? "yes" : "no", cells[0].verdict];
    }));
  }

  console.log("");
  console.log("false pass (defective fixtures whose document VERDICT is PASS)");
  const falsePass = [...new Set(rows.filter((r) => r.expect !== "holds" && r.verdict === "PASS").map((r) => `${r.oracle}/${r.fixture}@${r.shape}`))];
  console.log(falsePass.length === 0 ? "  none" : falsePass.map((key) => `  ${key} PASS`).join("\n"));

  if (pageRows.length > 0) {
    console.log("");
    console.log("per-section sets, per page: leaves of the set's oracle / the page's sections (engine slugger), per shape (repeat 1); edit and expect-rule integrity; draft as pre-registered");
    const shapeNames = SHAPES.map((x) => x ?? "default");
    table(["set", "ledger", "fixture", "sections", ...shapeNames.map((x) => `leaves@${x}`), "edit", "expect-rule", "draft", "draft pre-reg", "draft ok"],
      pageRows.map((r) => [r.set, r.ledger, r.fixture, r.sections.join(" "), ...shapeNames.map((x) => r.leaves[x] ?? "-"), r.edit, r.expectRule === "ok" ? "ok" : "MISMATCH", r.draft, r.draftWant,
        r.draftWant === "-" ? "-" : r.draft === r.draftWant ? "ok" : "MISMATCH"]));
  }
  if (POSITIONS) printPositions(entries);
  console.log("");
  console.log(`questions: main ${totals.main}, follow-ups ${totals.followups}, requests ${totals.requests}; worst case live ${totals.worst}${NO_SPANS ? " (spans skipped: main only)" : " (one follow-up per asked leaf)"}`);
  // One projection per ledger (round 8: per-kind sets keep distinct ledgers), then the invocation's.
  const byLedger = [...new Set(entries.map((e) => e.ledger))];
  for (const name of byLedger) printRequests(entries.filter((e) => e.ledger === name), name ?? undefined);
  if (byLedger.length > 1) {
    const worst = byLedger.reduce((a, name) => a + entries.filter((e) => e.ledger === name && e.repeat === 1).reduce((x, e) => x + e.cost.worst, 0), 0) * REPEAT;
    console.log("");
    console.log(`projection (live, all ${byLedger.length} ledgers of this invocation): worst ${worst} (repeat 1 worst x ${REPEAT}); --cap at 1.5x worst = ${Math.ceil(worst * 1.5)}`);
  }
  if (!MOCK) console.log(`ledger: live spent ${liveSpent()} / cap ${CAP}`);
  for (const problem of problems) console.log(`problem: ${problem}`);
  console.log(`complete: ${complete && !stopped}`);
  return complete && !stopped;
}

// ---------------------------------------------------------------- --corpus

async function runCorpus() {
  console.log(`oracle-test --corpus --repeat ${REPEAT} (${TAG})`);
  const root = MOCK ? snapshotWorkingTree() : REPO;
  const runs = [];
  let complete = true;
  try {
    for (let i = 1; i <= REPEAT; i += 1) {
      const runKey = `corpus:run`;
      if (!mayStart(runKey)) { complete = false; break; }
      const started = performance.now();
      let report;
      try {
        report = await checkDocuments({ root, mode: { kind: "all" }, profile: "promotion", cache: "off", backend: backendForPromotion() });
      } catch (error) {
        console.log(`run ${i}: check threw ${error.message}`);
        complete = false;
        break;
      }
      const wall = performance.now() - started;
      const cost = costOf(report);
      charge(runKey, cost);
      const leaves = new Map();
      for (const artifact of report.artifacts) {
        if (artifact.verdict === "BLOCKED") {
          complete = false;
          console.log(`run ${i}: BLOCKED ${artifact.path}: ${artifact.findings.filter((f) => f.verdict === "BLOCKED").map((f) => f.reason ?? f.message).join("; ")}`);
        }
        for (const leaf of artifact.engine?.report?.oracles ?? []) {
          leaves.set(`${artifact.path} :: ${leaf.atom}`, { path: artifact.path, oracle: oracleOf(leaf), leaf });
        }
      }
      const verdicts = {};
      for (const artifact of report.artifacts) verdicts[artifact.verdict] = (verdicts[artifact.verdict] ?? 0) + 1;
      console.log(`run ${i}: ${report.artifacts.length} artifacts (${Object.entries(verdicts).map(([k, v]) => `${k} ${v}`).join(", ")}), ` +
        `${leaves.size} oracle leaves, main questions ${cost.main}, follow-ups ${cost.followups}, requests ${cost.requests}, ` +
        `evidence ${cost.bytes} bytes, wall ${(wall / 1000).toFixed(1)} s; worst case live ${cost.worst}`);
      runs.push({ leaves, cost });
    }
  } finally {
    if (MOCK) rmSync(root, { recursive: true, force: true });
  }
  if (runs.length === 0) {
    console.log("complete: false");
    return false;
  }

  const first = runs[0].leaves;
  const byOracle = new Map();
  for (const [key, entry] of first) {
    const list = byOracle.get(entry.oracle) ?? [];
    list.push(key);
    byOracle.set(entry.oracle, list);
  }
  console.log("");
  console.log(`per oracle, run 1 (${TAG}${MOCK ? ": decisiveness is the mock's, not a measurement" : ""}); shares of the oracle's leaves`);
  table(["oracle", "n", "decides", "judge-unknown", "thr-demoted", "tie/malformed", "threshold", "stability", "mean |dp|"],
    [...byOracle.entries()].sort().map(([oracle, keys]) => {
      const share = (shape) => keys.filter((k) => shapeOf(first.get(k).leaf) === shape).length / keys.length;
      const thresholds = [...new Set(keys.map((k) => first.get(k).leaf.threshold))].join("/");
      let stability = "-", dp = "-";
      if (runs.length >= 2) {
        const present = keys.filter((k) => runs.every((run) => run.leaves.has(k)));
        const same = present.filter((k) => runs.every((run) => run.leaves.get(k).leaf.label === first.get(k).leaf.label)).length;
        const deltas = present.flatMap((k) => runs.slice(1).map((run) => Math.abs((peak(run.leaves.get(k).leaf) ?? 0) - (peak(first.get(k).leaf) ?? 0))));
        const raw = `${fmt(same / Math.max(1, present.length))} (${same}/${present.length})`;
        stability = keys.length < STABILITY_MIN_ATOMS ? `not assessable, n=${keys.length} [${raw}]` : raw;
        dp = fmt(deltas.reduce((a, b) => a + b, 0) / Math.max(1, deltas.length), 3);
      }
      return [oracle, keys.length, fmt(share("decides")), fmt(share("judge-unknown")), fmt(share("threshold-demoted")), fmt(share("tie-or-malformed")), thresholds, stability, dp];
    }));
  console.log("");
  console.log("leaves (run 1)");
  table(["oracle", "document", "sections", "label", "answered", "p", "bytes"],
    [...first.values()].sort((a, b) => a.oracle.localeCompare(b.oracle) || a.path.localeCompare(b.path))
      .map(({ oracle, path: p, leaf }) => [oracle, p, leaf.sections.join(","), leaf.label, leaf.answered, fmt(peak(leaf)), leaf.bytes]));
  const sum = (field) => runs.reduce((a, run) => a + run.cost[field], 0);
  console.log("");
  console.log(`questions over ${runs.length} run(s): main ${sum("main")}, follow-ups ${sum("followups")}, requests ${sum("requests")}; worst case live ${sum("worst")}`);
  if (!MOCK) console.log(`ledger: live spent ${liveSpent()} / cap ${CAP}`);
  const finished = complete && runs.length === REPEAT;
  console.log(`complete: ${finished}`);
  return finished;
}


// ---------------------------------------------------------------- --real-cells

async function runRealCells() {
  const labelsFile = value("--labels", "labels.yaml");
  console.log(`oracle-test --real-cells --labels ${labelsFile} (${TAG}; shapes ${SHAPES.map((s) => s ?? "module-default").join(",")}; repeat ${REPEAT}; spans ${NO_SPANS ? "skipped" : "asked"})`);
  const dir = path.join(FIXTURES, "real-cells");
  const labels = YAML.parse(readFileSync(path.resolve(dir, labelsFile), "utf8"));
  // Round 8: a labels file naming `commit` is checked in a clone at that commit (live and mock
  // alike), so a page edited mid-programme does not move under its labels.
  let repo;
  if (labels.commit !== undefined) {
    repo = cloneRepo();
    git(repo, ["checkout", "-q", "--detach", String(labels.commit)]);
    console.log(`clone at ${labels.commit} (${git(repo, ["rev-parse", "HEAD"], "utf8").trim()})`);
  } else {
    repo = MOCK ? snapshotWorkingTree() : cloneRepo();
  }
  const rows = [];
  const problems = [];
  let complete = true;
  try {
    const config = YAML.parse(readFileSync(path.join(repo, ".doc-verify.yaml"), "utf8"));
    // The default labels file (goals) carries no rule: the shipped goal module plus this
    // directory's control module. A labels file may name its own rule and the files it needs.
    const files = labels.extra_files ?? { "worklog/kernel-trials/probe/oracle-fixtures/real-cells/module.yaml": "module.yaml" };
    for (const [repoPath, file] of Object.entries(files)) {
      mkdirSync(path.dirname(path.join(repo, repoPath)), { recursive: true });
      writeFileSync(path.join(repo, repoPath), readFileSync(path.resolve(dir, file), "utf8"));
    }
    const paths = Object.keys(labels.documents);
    // Round 9: a document naming `source` is generated (the real derangement arm): the working
    // tree's file is written into the clone and must be `source` at the labels' commit (HEAD
    // without one) under the column-permutation invariant, row i carrying source row `from` of its
    // label, and, when the labels file names `rotation`, from = ((i - 1 + rotation) mod n) + 1.
    for (const [docPath, spec] of Object.entries(labels.documents)) {
      if (spec.source === undefined) continue;
      const text = readFileSync(path.join(REPO, docPath), "utf8");
      const base = git(REPO, ["show", `${labels.commit ?? "HEAD"}:${spec.source}`], "utf8");
      const n = columnTable(base.split("\n"), spec.column).rows.length;
      const from = Array.from({ length: n }, (_, k) => Object.entries(spec.rows ?? {}).find(([id]) => id.endsWith(`#row${k + 1}`))?.[1]?.from);
      let integrity = from.some((f) => f === undefined) ? `MISMATCH a row of the ${n} has no label with 'from'` : columnPermutationIntegrity(base, text, spec.column, from);
      if (integrity === "ok" && labels.rotation !== undefined) {
        const bad = from.findIndex((f, k) => f !== ((k + labels.rotation) % n) + 1);
        if (bad >= 0) integrity = `MISMATCH row${bad + 1} from ${from[bad]}, rotation ${labels.rotation} gives ${((bad + labels.rotation) % n) + 1}`;
      }
      if (integrity !== "ok") { complete = false; problems.push(`${docPath}: column-permutation integrity ${integrity}`); }
      else console.log(`column-permutation ${docPath}: ok ('${spec.column}' against ${labels.commit ?? "HEAD"}:${spec.source}, from [${from.join(", ")}]${labels.rotation === undefined ? "" : `, rotation ${labels.rotation}`})`);
      mkdirSync(path.dirname(path.join(repo, docPath)), { recursive: true });
      writeFileSync(path.join(repo, docPath), text);
    }
    const defaultRule = labels.rule ?? { artifact_kind: "goal", modules: ["doc-verify:goal", Object.keys(files)[0]], status_from: "title" };
    // Round 8: a document may carry its own `rule` (the module pages are four kinds, four libraries).
    const ruleOf = (p) => { const { pattern: _drop, ...r } = labels.documents[p]?.rule ?? defaultRule; return r; };
    config.documents = paths.map((p) => ({ ...ruleOf(p), modules: shapedModules(ruleOf(p).modules), pattern: p }));
    config.invalidation_patterns = [];
    writeFileSync(path.join(repo, ".doc-verify.yaml"), YAML.stringify(config));
    const allModules = [...new Set(paths.flatMap((p) => ruleOf(p).modules))];
    const steps = schedule(SHAPES, REPEAT);
    let current = steps[0].shape;
    let modules = applyShape(repo, allModules, current);
    commitAll(repo, "real-cells");
    const runKey = `real-cells:${labelsFile}`;
    if (!mayStart(SHAPES.map((s) => [shapeKey(runKey, s), REPEAT]))) { console.log("complete: false"); return false; }
    const entries = [];
    const firstReport = new Map();
    const lead = (docPath, rowId) => labels.documents[docPath]?.rows?.[rowId]?.label ?? null;
    for (const step of steps) {
      if (step.shape !== current) {
        current = step.shape;
        modules = applyShape(repo, allModules, current);
        commitAll(repo, `real-cells ${current}`);
      }
      const { backend, calls, model } = await timedBackend(repo);
      const t0 = performance.now();
      const report = await checkDocuments({ root: repo, mode: { kind: "paths", paths }, profile: "promotion", cache: "off", backend });
      const wall = performance.now() - t0;
      charge(shapeKey(runKey, step.shape), costOf(report));
      if (!firstReport.has(step.shape)) firstReport.set(step.shape, report);
      const entry = recordRun({ runKey, mode: "real-cells", fixture: labelsFile, repeat: step.repeat, shape: step.shape, report, calls, model, wall, modules, labelsFile, lead });
      entries.push(entry);
      if (entry.split) { complete = false; problems.push(`${runKey}@batched rep ${step.repeat}: split`); }
      if (entry.atomic === false) { complete = false; problems.push(`${runKey}@per-atom rep ${step.repeat}: a main request carried more than one question`); }
    }
    for (const [shape, report] of firstReport) {
      for (const [docPath, spec] of Object.entries(labels.documents)) {
        const artifact = report.artifacts.find((a) => a.path === docPath);
        if (artifact !== undefined && artifact.verdict === "BLOCKED") problems.push(`${docPath}@${shape ?? "default"}: BLOCKED ${(artifact.findings ?? []).filter((f) => f.verdict === "BLOCKED").map((f) => f.reason ?? f.message ?? "").join("; ")}`);
        if (artifact === undefined || artifact.verdict === "BLOCKED") { complete = false; rows.push([shape ?? "default", docPath, "-", "-", "-", artifact?.verdict ?? "missing", "-", "-"]); continue; }
        const prefix = labels.oracle ?? "evidence_reasons";
        const leaves = (artifact.engine?.report?.oracles ?? []).filter((leaf) => oracleOf(leaf).startsWith(prefix));
        // A row label (`section#rowN`) matches the atom naming that row; a section label (round 8,
        // `current_not_history(D, S)`) matches the atom whose last argument is that section.
        const missing = [];
        for (const [rowId, expected] of Object.entries(spec.rows ?? {})) {
          const leaf = rowId.includes("#") ? leaves.find((entry) => entry.atom.includes(`${rowId},`)) : leaves.find((entry) => sectionArg(entry.atom) === rowId);
          if (leaf === undefined) { complete = false; missing.push(rowId); rows.push([shape ?? "default", docPath, rowId, expected.label, "NOT-FOUND", artifact.verdict, "-", "-"]); continue; }
          rows.push([shape ?? "default", docPath, rowId, expected.label, leaf.label, artifact.verdict, fmt(peak(leaf)), leaf.label === expected.label ? "agree" : `DISAGREE (${expected.confidence})`]);
        }
        // Atoms of the oracle the labels do not name, and labels no atom carries: both are gaps.
        const labelled = new Set(Object.keys(spec.rows ?? {}));
        const unlabelled = leaves.filter((leaf) => !labelled.has(sectionArg(leaf.atom)) && !labelled.has(rowIdOf(leaf.atom)));
        if (missing.length > 0 || unlabelled.length > 0) {
          complete = false;
          // Round 9 (round 8 review, should-fix 1): named once per shape with a gap, so a gap that
          // exists only under a non-first shape has its own problem line.
          problems.push(`${docPath}@${shape ?? "default"}: labels with no atom [${missing.join(", ")}]; ${prefix} atoms the labels do not name [${unlabelled.map((l) => sectionArg(l.atom) || l.atom).join(", ")}]`);
        }
      }
    }
    console.log("");
    console.log(labels.commit !== undefined
      ? `run 1 per shape; agreement with the lead's blind labels (${labelsFile}, pages at ${labels.commit})`
      : "run 1 per shape; agreement with the lead's labels is informational only (the labelled cells were rewritten after the labels)");
    table(["shape", "document", "row", "lead", "judge", "VERDICT", "p", "agreement"], rows);
    for (const shape of firstReport.keys()) {
      const all = rows.filter((r) => r[0] === (shape ?? "default"));
      console.log(`${shape ?? "default"}: ${all.filter((r) => r[4] !== "NOT-FOUND").length}/${all.length} labelled atoms found over ${Object.keys(labels.documents).length} documents`);
      const judged = rows.filter((r) => r[0] === (shape ?? "default") && r[7] !== "-");
      const cost = costOf(firstReport.get(shape));
      console.log(`${shape ?? "default"}: agreement (informational) ${judged.filter((r) => r[7] === "agree").length}/${judged.length}; per run: main ${cost.main}, follow-ups ${cost.followups}, requests ${cost.requests}, worst ${cost.worst}`);
    }
    if (POSITIONS) printPositions(entries);
    printRequests(entries);
    if (!MOCK) console.log(`ledger: live spent ${liveSpent()} / cap ${CAP}`);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
  for (const problem of problems) console.log(`problem: ${problem}`);
  console.log(`complete: ${complete}`);
  return complete;
}

// ---------------------------------------------------------------- main

if (flag("--fixtures")) {
  process.exitCode = (await runFixtures()) ? 0 : 1;
} else if (flag("--corpus")) {
  process.exitCode = (await runCorpus()) ? 0 : 1;
} else if (flag("--real-cells")) {
  process.exitCode = (await runRealCells()) ? 0 : 1;
} else {
  console.log("usage: oracle-test.mjs --fixtures [--oracle NAME] [--repeat N] [--show-evidence] [--reversed [--reversed-only a,b]] [--invariant-base REV]" +
    " | --corpus --repeat N | --real-cells [--labels FILE] [--repeat N]" +
    "   [--request-shape batched|per-atom|both] [--no-spans|--spans] [--positions] [--cap 300] [--ledger NAME]");
  process.exitCode = 2;
}
