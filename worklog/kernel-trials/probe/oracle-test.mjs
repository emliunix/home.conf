// Round 3 oracle fixture runner: a prototype of `doc-verify oracle test` (design 05 §Oracle toolkit).
//
//   node worklog/kernel-trials/probe/oracle-test.mjs --fixtures [--oracle NAME] [--cap 300] [--repeat N] [--ledger NAME] [--show-evidence]
//   node worklog/kernel-trials/probe/oracle-test.mjs --corpus --repeat N [--cap 300]
//   node worklog/kernel-trials/probe/oracle-test.mjs --real-cells [--cap N] [--ledger NAME]
//
// Round 4 additions: a fixture set may name `files_from` (a sibling set whose Markdown files it
// reuses), `extra_files` (repository path -> file in the set, copied into the scratch clone: a
// fixture-local module), `invariant: evidence-column-only` (every fixture is the governed document
// at HEAD except the cells under `atom.column`; checked before the run), and `atom.per_row: true`
// (the oracle is asked once per table row; a fixture's `expect` is every cell's expected label,
// overridden per row by `expect_cells`). `--repeat N` runs each fixture's promotion check N times
// with the cache off and reports label stability per leaf. `--ledger NAME` keeps a separate
// question ledger (`.question-count-NAME`). `--show-evidence` prints the parsed rows and the cell
// text each per-row atom is sent. `--real-cells` runs the shipped oracle and a fixture-local
// control over goals/01-03's coverage cells and compares the labels with
// `oracle-fixtures/real-cells/labels.yaml`, written blind before the run.
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
const COUNT_FILE = path.join(FIXTURES, LEDGER_NAME === undefined ? ".question-count" : `.question-count-${LEDGER_NAME}`);
const SHOW_EVIDENCE = flag("--show-evidence");
const SEP_P = 0.6;
const STABILITY_MIN_ATOMS = 5;

// ---------------------------------------------------------------- question ledger

function loadLedger() {
  try {
    return JSON.parse(readFileSync(COUNT_FILE, "utf8"));
  } catch {
    return { cap: CAP, live: { questions: 0, followups: 0, requests: 0, runs: [] }, mock: { projections: {} } };
  }
}
function saveLedger(ledger) {
  mkdirSync(FIXTURES, { recursive: true });
  writeFileSync(COUNT_FILE, `${JSON.stringify(ledger, null, 2)}\n`);
}
const ledger = loadLedger();

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
  return { main, followups, requests, asked, worst: main + asked, bytes };
}

/** Whether a live run may start; mock runs are never charged. */
function mayStart(runKey) {
  if (MOCK) return true;
  const projected = ledger.mock.projections[runKey]?.worst;
  const spent = ledger.live.questions + ledger.live.followups;
  if (spent >= CAP || (projected !== undefined && spent + projected > CAP)) {
    console.log(`CAP  refusing ${runKey}: spent ${spent} + projected ${projected ?? "?"} > cap ${CAP}`);
    return false;
  }
  return true;
}
function charge(runKey, cost) {
  if (MOCK) {
    ledger.mock.projections[runKey] = { main: cost.main, asked: cost.asked, worst: cost.worst, requests: cost.requests };
  } else {
    ledger.live.questions += cost.main;
    ledger.live.followups += cost.followups;
    ledger.live.requests += cost.requests;
    ledger.live.runs.push({ run: runKey, ...cost, at: new Date().toISOString() });
  }
  saveLedger(ledger);
}

// ---------------------------------------------------------------- backends

function backendForPromotion() {
  return MOCK ? mockSupportedBackend() : undefined;
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
const fmt = (x, digits = 2) => (x === undefined || Number.isNaN(x) ? "-" : x.toFixed(digits));
function table(header, rows) {
  const widths = header.map((h, i) => Math.max(String(h).length, ...rows.map((r) => String(r[i]).length)));
  const line = (r) => `  ${r.map((c, i) => String(c).padEnd(widths[i])).join("  ")}`;
  console.log(line(header));
  console.log(line(widths.map((w) => "-".repeat(w))));
  for (const r of rows) console.log(line(r));
}

// ---------------------------------------------------------------- --fixtures

function loadFixtureSets() {
  return readdirSync(FIXTURES, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(path.join(FIXTURES, entry.name, "fixtures.yaml")))
    .map((entry) => ({ dir: path.join(FIXTURES, entry.name), spec: YAML.parse(readFileSync(path.join(FIXTURES, entry.name, "fixtures.yaml"), "utf8")) }))
    .filter((set) => ONLY === undefined || set.spec.oracle === ONLY);
}

/** Where a set's Markdown files live: its own directory, or the sibling set it names in `files_from`. */
function filesDir(set) {
  return set.spec.files_from === undefined ? set.dir : path.resolve(set.dir, set.spec.files_from);
}
function fixtureText(set, file) {
  return readFileSync(path.join(filesDir(set), file), "utf8");
}
const headText = (repoPath) => git(REPO, ["show", `HEAD:${repoPath}`], "utf8");

/**
 * `invariant: evidence-column-only`: the fixture equals the governed document at HEAD line for
 * line, except that a table data row may differ in the cells under `atom.column` alone.
 */
function columnOnlyIntegrity(set, fixture) {
  const column = set.spec.atom.column;
  const head = headText(set.spec.document).split("\n");
  const text = fixtureText(set, fixture.file).split("\n");
  if (head.length !== text.length) return `line count ${text.length} != HEAD ${head.length}`;
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

/** A defective fixture must be good.md with exactly its recorded edit applied. */
function editIntegrity(set, fixture) {
  if (set.spec.invariant === "evidence-column-only") return columnOnlyIntegrity(set, fixture);
  if (fixture.edit === undefined) return "base";
  const good = fixtureText(set, "good.md");
  const text = fixtureText(set, fixture.file);
  const { from, to } = fixture.edit;
  const at = good.indexOf(from);
  if (at < 0 || good.indexOf(from, at + 1) >= 0) return "from-not-unique";
  return good.slice(0, at) + to + good.slice(at + from.length) === text ? "ok" : "MISMATCH";
}

function findLeaf(report, set, fixture) {
  const artifact = report.artifacts.find((a) => a.path === set.spec.document);
  const leaves = artifact?.engine?.report?.oracles ?? [];
  // A fixture that renames its section (the receipt's gross rewrite) names its own atom sections.
  const want = [...(fixture.sections ?? set.spec.atom.sections)].sort().join(",");
  const hits = leaves.filter((leaf) => oracleOf(leaf) === set.spec.oracle && [...leaf.sections].sort().join(",") === want)
    .sort((a, b) => rowOf(a).localeCompare(rowOf(b), undefined, { numeric: true }));
  return { artifact, hits, asked: leaves.map((leaf) => `${leaf.atom} [${leaf.sections.join(",")}]`) };
}
/** The `rowN` of a per-row atom (`...#rowN, ...`), or "" for a section atom. */
const rowOf = (leaf) => /#(row\d+)/.exec(leaf.atom)?.[1] ?? "";
/** The expected label of one leaf: per row when the fixture says so, else the fixture's. */
const expectedOf = (fixture, leaf) => fixture.expect_cells?.[rowOf(leaf)] ?? fixture.expect;
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
  console.log(`oracle-test --fixtures (${TAG})`);
  const sets = loadFixtureSets();
  const rows = [];
  const problems = [];
  let complete = true;
  const totals = { main: 0, followups: 0, asked: 0, worst: 0, requests: 0 };
  let stopped = false;
  for (const set of sets) {
    const repo = cloneRepo();
    try {
      // The repository's config with one rule: the fixture's own, narrowed to its governed path, so
      // the run checks this document alone (no dependent artifact is pulled into the closure).
      const config = YAML.parse(readFileSync(path.join(repo, ".doc-verify.yaml"), "utf8"));
      config.documents = [{ ...set.spec.rule, pattern: set.spec.document }];
      config.invalidation_patterns = [];
      writeFileSync(path.join(repo, ".doc-verify.yaml"), YAML.stringify(config));
      for (const fixture of set.spec.fixtures) {
        const runKey = `fixtures:${set.spec.oracle}/${fixture.name}`;
        const integrity = editIntegrity(set, fixture);
        if (integrity !== "ok" && integrity !== "base") {
          complete = false;
          problems.push(`${runKey}: edit integrity ${integrity}`);
        }
        const markdown = fixtureText(set, fixture.file);
        writeFileSync(path.join(repo, set.spec.document), markdown);
        if (set.spec.companion !== undefined) {
          writeFileSync(path.join(repo, set.spec.companion.path), fixtureText(set, set.spec.companion.file));
        }
        for (const [repoPath, file] of Object.entries(set.spec.extra_files ?? {})) {
          mkdirSync(path.dirname(path.join(repo, repoPath)), { recursive: true });
          writeFileSync(path.join(repo, repoPath), readFileSync(path.join(set.dir, file), "utf8"));
        }
        if (SHOW_EVIDENCE && set.spec.atom.per_row) showEvidence(set, fixture, markdown);
        git(repo, ["add", "-A"]);
        try { git(repo, ["commit", "-qm", fixture.name]); } catch { /* unchanged content */ }
        const mode = { kind: "paths", paths: [set.spec.document] };
        // Structure only: the draft profile with a judge that refuses every call.
        let draft;
        try {
          const report = await checkDocuments({ root: repo, mode, profile: "draft", cache: "off", backend: refusingBackend() });
          draft = report.artifacts[0]?.verdict ?? "none";
          const draftFindings = report.artifacts[0]?.findings.filter((f) => f.verdict !== "WARN").map((f) => f.ruleId) ?? [];
          if (fixture.expect === "holds" && draft !== "PASS") problems.push(`${runKey}: good fixture fails structure (${draftFindings.join(", ")})`);
          if (fixture.expect !== "holds" && draft !== "PASS") problems.push(`${runKey}: structure already catches it (${draftFindings.join(", ")}) -- fixture defect`);
        } catch (error) {
          draft = `ERROR ${error.message}`;
          complete = false;
        }
        if (!mayStart(runKey)) {
          complete = false;
          stopped = true;
          break;
        }
        const started = performance.now();
        const reports = [];
        let threw = false;
        for (let run = 1; run <= REPEAT; run += 1) {
          try {
            reports.push(await checkDocuments({ root: repo, mode, profile: "promotion", cache: "off", backend: backendForPromotion() }));
          } catch (error) {
            complete = false;
            threw = true;
            problems.push(`${runKey}: check threw ${error.message}`);
            break;
          }
        }
        if (threw || reports.length === 0) continue;
        const wall = (performance.now() - started) / reports.length;
        const cost = costOf(reports[0]);
        for (const report of reports) charge(runKey, costOf(report));
        for (const key of Object.keys(totals)) totals[key] += cost[key] * reports.length;
        const { artifact, hits, asked } = findLeaf(reports[0], set, fixture);
        if (artifact?.verdict === "BLOCKED") { complete = false; problems.push(`${runKey}: BLOCKED`); }
        const perRow = set.spec.atom.per_row === true;
        const wantHits = perRow ? (set.spec.atom.rows ?? hits.length) : 1;
        if (hits.length !== wantHits || hits.length === 0) {
          complete = false;
          problems.push(`${runKey}: ${hits.length} leaves match ${set.spec.oracle}[${(fixture.sections ?? set.spec.atom.sections).join(",")}]; asked: ${asked.join("; ") || "none"}`);
        }
        const warnings = artifact?.findings.filter((f) => f.ruleId.endsWith("paths-resolve")).length ?? 0;
        const stable = (leaf) => reports.slice(1).every((report) => findLeaf(report, set, fixture).hits.find((other) => other.atom === leaf.atom)?.label === leaf.label);
        for (const leaf of (hits.length === 0 ? [undefined] : hits)) {
          const p = leaf === undefined ? undefined : peak(leaf);
          const expectSide = leaf === undefined ? fixture.expect : expectedOf(fixture, leaf);
          const separates = leaf !== undefined && leaf.label === expectSide && (p ?? 0) >= SEP_P;
          rows.push({
            oracle: set.spec.oracle, fixture: fixture.name, row: leaf === undefined ? "" : rowOf(leaf), expect: expectSide, got: leaf?.label ?? "NOT-FOUND",
            answered: leaf?.answered ?? "-", p, threshold: leaf?.threshold, shape: leaf === undefined ? "-" : shapeOf(leaf),
            verdict: artifact?.verdict ?? "-", draft, bytes: leaf?.bytes, questions: cost.main, worst: cost.worst,
            separates, wall, edit: integrity, sections: leaf?.sections.join(",") ?? "-",
            atomsAsked: asked.length, warnings, stable: leaf === undefined ? "-" : reports.length < 2 ? "n/a" : stable(leaf) ? "same" : "FLIPS",
          });
        }
      }
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
    if (stopped) break;
  }

  console.log("");
  console.log(`fixture leaves (${TAG}${MOCK ? ": every label is the mock's first option, not a measurement" : ""})`);
  table(
    ["oracle", "fixture", "row", "expect", "got", "answered", "p", "thr", "shape", "VERDICT", "draft-only", "bytes", "q", "worst-q", "sep@0.6", "edit", "paths-warn", REPEAT > 1 ? `stable×${REPEAT}` : "stable"],
    rows.map((r) => [r.oracle, r.fixture, r.row || "-", r.expect, r.got, r.answered, fmt(r.p), fmt(r.threshold, 1), r.shape, r.verdict,
      r.expect === "holds" ? r.draft : r.draft === "NO-GO" ? "NO-GO (caught)" : `${r.draft} (not caught)`,
      r.bytes ?? "-", r.questions, r.worst, r.separates ? "yes" : "no", r.edit, r.warnings, r.stable]),
  );
  const perRowSets = [...new Set(rows.filter((r) => r.row).map((r) => `${r.oracle}/${r.fixture}`))];
  if (perRowSets.length > 0) {
    console.log("");
    console.log(`per fixture (per-row oracles): cells on their expected side at p >= ${SEP_P}`);
    table(["oracle/fixture", "expected side(s)", "k/n", "separates", "VERDICT"], perRowSets.map((key) => {
      const cells = rows.filter((r) => `${r.oracle}/${r.fixture}` === key);
      const k = cells.filter((r) => r.separates).length;
      return [key, [...new Set(cells.map((r) => r.expect))].join("+"), `${k}/${cells.length}`, k === cells.length ? "yes" : "no", cells[0].verdict];
    }));
  }

  console.log("");
  console.log("false pass (defective fixtures whose document VERDICT is PASS)");
  const falsePass = [...new Set(rows.filter((r) => r.expect !== "holds" && r.verdict === "PASS").map((r) => `${r.oracle}/${r.fixture}`))];
  console.log(falsePass.length === 0 ? "  none" : falsePass.map((key) => `  ${key} PASS`).join("\n"));

  console.log("");
  console.log(`per oracle (separation: good holds and the defective fails, each with p >= ${SEP_P})`);
  const oracles = [...new Set(rows.map((r) => r.oracle))];
  table(["oracle", "good p", "gross", "subtle", "atom sections", "atoms in doc"],
    oracles.map((name) => {
      const of = (fx) => rows.find((r) => r.oracle === name && r.fixture === fx);
      const good = of("good");
      const sep = (fx) => {
        const r = of(fx);
        if (r === undefined) return "-";
        return `${good?.separates && r.separates ? "separates" : "no"} (${r.got} p=${fmt(r.p)})`;
      };
      return [name, `${good?.got ?? "-"} p=${fmt(good?.p)}`, sep("defective-gross"), sep("defective-subtle"), good?.sections ?? "-", good?.atomsAsked ?? "-"];
    }));

  console.log("");
  console.log(`questions: main ${totals.main}, follow-ups ${totals.followups}, requests ${totals.requests}; worst case live (one follow-up per asked leaf) ${totals.worst}`);
  if (!MOCK) console.log(`ledger: live spent ${ledger.live.questions + ledger.live.followups} / cap ${CAP}`);
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
  if (!MOCK) console.log(`ledger: live spent ${ledger.live.questions + ledger.live.followups} / cap ${CAP}`);
  const finished = complete && runs.length === REPEAT;
  console.log(`complete: ${finished}`);
  return finished;
}

// ---------------------------------------------------------------- --real-cells

async function runRealCells() {
  console.log(`oracle-test --real-cells (${TAG})`);
  const dir = path.join(FIXTURES, "real-cells");
  const labels = YAML.parse(readFileSync(path.join(dir, "labels.yaml"), "utf8"));
  const repo = MOCK ? snapshotWorkingTree() : cloneRepo();
  const rows = [];
  let complete = true;
  try {
    const config = YAML.parse(readFileSync(path.join(repo, ".doc-verify.yaml"), "utf8"));
    const modulePath = "worklog/kernel-trials/probe/oracle-fixtures/real-cells/module.yaml";
    mkdirSync(path.dirname(path.join(repo, modulePath)), { recursive: true });
    writeFileSync(path.join(repo, modulePath), readFileSync(path.join(dir, "module.yaml"), "utf8"));
    const paths = Object.keys(labels.documents);
    config.documents = paths.map((p) => ({ pattern: p, artifact_kind: "goal", modules: ["doc-verify:goal", modulePath], status_from: "title" }));
    config.invalidation_patterns = [];
    writeFileSync(path.join(repo, ".doc-verify.yaml"), YAML.stringify(config));
    git(repo, ["add", "-A"]);
    try { git(repo, ["commit", "-qm", "real-cells"]); } catch { /* unchanged */ }
    const runKey = "real-cells";
    if (!mayStart(runKey)) { console.log("complete: false"); return false; }
    const report = await checkDocuments({ root: repo, mode: { kind: "paths", paths }, profile: "promotion", cache: "off", backend: backendForPromotion() });
    const cost = costOf(report);
    charge(runKey, cost);
    for (const [docPath, spec] of Object.entries(labels.documents)) {
      const artifact = report.artifacts.find((a) => a.path === docPath);
      if (artifact === undefined || artifact.verdict === "BLOCKED") { complete = false; rows.push([docPath, "-", "-", "-", artifact?.verdict ?? "missing", "-", "-"]); continue; }
      const leaves = (artifact.engine?.report?.oracles ?? []).filter((leaf) => oracleOf(leaf).startsWith("evidence_reasons"));
      for (const [rowId, expected] of Object.entries(spec.rows)) {
        const leaf = leaves.find((entry) => entry.atom.includes(`${rowId},`));
        if (leaf === undefined) { complete = false; rows.push([docPath, rowId, expected.label, "NOT-FOUND", artifact.verdict, "-", "-"]); continue; }
        rows.push([docPath, rowId, expected.label, leaf.label, artifact.verdict, fmt(peak(leaf)), leaf.label === expected.label ? "agree" : `DISAGREE (${expected.confidence})`]);
      }
    }
    console.log("");
    table(["document", "row", "lead", "judge", "VERDICT", "p", "agreement"], rows);
    const judged = rows.filter((r) => r[6] !== "-");
    console.log(`agreement: ${judged.filter((r) => r[6] === "agree").length}/${judged.length}; questions: main ${cost.main}, follow-ups ${cost.followups}, worst case ${cost.worst}`);
    if (!MOCK) console.log(`ledger: live spent ${ledger.live.questions + ledger.live.followups} / cap ${CAP}`);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
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
  console.log("usage: oracle-test.mjs --fixtures [--oracle NAME] [--repeat N] [--show-evidence] | --corpus --repeat N | --real-cells   [--cap 300] [--ledger NAME]");
  process.exitCode = 2;
}
