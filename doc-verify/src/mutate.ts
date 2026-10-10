import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { checkDocuments } from "./checker.js";
import { compileModule, composeModules, ModuleError, readEngineLibrary } from "./engine/index.js";
import { sha256 } from "./hash.js";
import { applyEdit, loadMutationTable, ownConstraintIds, type MutationRow, type MutationTable } from "./mutate-table.js";
import { UsageError, type RepoPath, type TextBlob, type Verdict } from "./types.js";

const SCORED = new Set(["RED", "KEPT", "GAP-CONFIRMED", "SKIPPED"]);

export type MutateStatus =
  | "RED"
  | "KEPT"
  | "GAP-CONFIRMED"
  | "SKIPPED"
  | "GREEN"
  | "WRONG-CASE"
  | "BROKEN"
  | "HARNESS"
  | "FALSE-ALARM"
  | "GAP-CLOSED"
  | "UNKNOWN-EXPECT"
  | "CONSTRAINT-DRIFT"
  | "NO-KILL";

export interface MutateRowResult {
  id: string;
  kind: MutationRow["kind"];
  status: MutateStatus | "SKIPPED";
  detail: string;
  expect?: string | undefined;
}

export interface MutateReport {
  results: MutateRowResult[];
  census: Array<{ id: string; tag: string; why?: string | undefined }>;
  liveConstraints: string[];
  exitCode: number;
  text: string;
}

export interface CheckOutcome {
  error?: string;
  verdict?: Verdict;
  failed: Set<string>;
}

/** Failed module-constraint ids from a check report. `module.has-title` → `has-title`. */
export function failedConstraintIds(findings: Array<{ verdict: string; ruleId: string }>): Set<string> {
  return new Set(
    findings
      .filter((finding) => finding.verdict === "NO-GO" && finding.ruleId.startsWith("module."))
      .map((finding) => finding.ruleId.slice("module.".length)),
  );
}

export function scoreKill(failed: Set<string>, expect: string): { status: MutateStatus; detail: string } {
  const fired = [...failed].sort();
  if (fired.length === 0) {
    return { status: "GREEN", detail: `${expect} did not fire` };
  }
  if (!failed.has(expect)) {
    return { status: "WRONG-CASE", detail: `fired ${fired.join(", ")} -- not ${expect}` };
  }
  const collateral = fired.filter((id) => id !== expect);
  return {
    status: "RED",
    detail: collateral.length > 0 ? `${expect}  (+ ${collateral.join(", ")})` : expect,
  };
}

export function scoreKeep(verdict: Verdict, failed: Set<string>, note: string | undefined): { status: MutateStatus; detail: string } {
  if (verdict === "PASS") return { status: "KEPT", detail: note ?? "stayed PASS" };
  return { status: "FALSE-ALARM", detail: `${note ?? "keep"}; fired ${[...failed].sort().join(", ") || verdict}` };
}

export function scoreGap(failed: Set<string>, expect: string, note: string | undefined): { status: MutateStatus; detail: string } {
  if (failed.has(expect)) {
    return { status: "GAP-CLOSED", detail: `${note ?? expect}: hole closed, promote to kill` };
  }
  const fired = [...failed].sort();
  return {
    status: "GAP-CONFIRMED",
    detail: `${note ?? expect}${fired.length > 0 ? ` (fired ${fired.join(", ")})` : ""}`,
  };
}

export function censusCoverage(input: {
  /** Constraint ids declared on the named module file (not its `extends` chain). */
  live: string[];
  pin: string[];
  killed: Set<string>;
  uncovered: Record<string, string>;
  judgeLeg: Set<string>;
  judgeRan: boolean;
}): Array<{ id: string; ok: boolean; tag: string; why?: string | undefined }> {
  const liveSet = new Set(input.live);
  const pinSet = new Set(input.pin);
  const rows: Array<{ id: string; ok: boolean; tag: string; why?: string | undefined }> = [];
  const extra = input.pin.filter((id) => !liveSet.has(id));
  const missing = input.live.filter((id) => !pinSet.has(id));
  const staleUncovered = Object.keys(input.uncovered).filter((id) => !liveSet.has(id));
  if (extra.length > 0 || missing.length > 0 || staleUncovered.length > 0) {
    rows.push({
      id: "(lock)",
      ok: false,
      tag: "CONSTRAINT-DRIFT",
      why: [
        extra.length > 0 ? `pinned but absent from module: ${extra.join(", ")}` : "",
        missing.length > 0 ? `in module but not pinned: ${missing.join(", ")}` : "",
        staleUncovered.length > 0 ? `uncovered but absent from module: ${staleUncovered.join(", ")}` : "",
      ].filter(Boolean).join("; "),
    });
  }
  for (const id of input.live) {
    if (input.killed.has(id)) {
      rows.push({ id, ok: true, tag: "covered" });
      continue;
    }
    if (id in input.uncovered) {
      rows.push({ id, ok: true, tag: "UNCOVERED", why: input.uncovered[id] });
      continue;
    }
    if (!input.judgeRan && input.judgeLeg.has(id)) {
      rows.push({
        id,
        ok: true,
        tag: "JUDGE-LEG",
        why: "covered only by the judge leg, which did not run (use --judge)",
      });
      continue;
    }
    rows.push({ id, ok: false, tag: "NO-KILL" });
  }
  return rows;
}

const JUDGE_STUB = `schema_version: 1
kind: document-verification
documents:
  - pattern: PLACEHOLDER
    artifact_kind: KIND
    modules: [MODULE]
invalidation_patterns: []
judge:
  kind: jev
  model: jev-1.13.0
  client_sha256: ce983f8de97d5b30d527a7116f0c49ad3d17e098d2c3f17c9600041260c65dcb
  attestation_max_age_seconds: 86400
policy:
  kind: semantic-boundary
  version: 1
  max_evidence_bytes: 24000
  forbidden_literals: []
`;

function git(cwd: string, args: string[]): void {
  execFileSync("git", args, {
    cwd,
    stdio: "ignore",
    env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_SYSTEM: "/dev/null" },
  });
}

function writeScratch(dir: string, input: {
  documentName: string;
  documentText: string;
  artifactKind: string;
  moduleRef: string;
  moduleText: string | undefined;
}): void {
  const config = JUDGE_STUB
    .replace("PLACEHOLDER", input.documentName)
    .replace("KIND", input.artifactKind)
    .replace("MODULE", input.moduleRef);
  writeFileSync(join(dir, ".doc-verify.yaml"), config);
  writeFileSync(join(dir, input.documentName), input.documentText);
  if (input.moduleText !== undefined) {
    const dest = join(dir, input.moduleRef);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, input.moduleText);
  }
  git(dir, ["init", "-q"]);
  git(dir, ["config", "user.email", "mutate@example.invalid"]);
  git(dir, ["config", "user.name", "mutate"]);
  git(dir, ["config", "commit.gpgsign", "false"]);
  git(dir, ["add", "-A"]);
  git(dir, ["-c", "commit.gpgsign=false", "commit", "-qm", "fixture"]);
}

async function checkScratch(dir: string, documentName: string, profile: "draft" | "promotion"): Promise<CheckOutcome> {
  try {
    const report = await checkDocuments({
      root: dir,
      mode: { kind: "paths", paths: [documentName] },
      profile,
      cache: profile === "promotion" ? "off" : "use",
    });
    const artifact = report.artifacts[0];
    if (artifact === undefined) return { error: "report has no artifact", failed: new Set() };
    return {
      verdict: artifact.verdict,
      failed: failedConstraintIds(artifact.findings),
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error), failed: new Set() };
  }
}

async function composedConstraintIds(moduleRef: string, tableDir: string): Promise<string[]> {
  const readBlob = async (file: RepoPath): Promise<TextBlob> => {
    const content = readFileSync(join(tableDir, file), "utf8");
    return { path: file, content, hash: sha256(content) };
  };
  try {
    const composed = await composeModules([moduleRef], readBlob);
    const program = await compileModule(composed.yaml);
    return program.constraints.map((constraint) => constraint.id).sort();
  } catch (error) {
    const message = error instanceof ModuleError || error instanceof Error ? error.message : String(error);
    throw new UsageError(`mutate: cannot load constraints from ${moduleRef}: ${message}`);
  }
}

export async function runMutate(tablePath: string, options: { judge?: boolean } = {}): Promise<MutateReport> {
  const judge = options.judge === true;
  if (judge && process.env.TYPESAFE_API_KEY === undefined && process.env.API_KEY === undefined) {
    const text = "HARNESS     --judge needs TYPESAFE_API_KEY in the environment\n";
    return { results: [], census: [], liveConstraints: [], exitCode: 2, text };
  }
  const table: MutationTable = loadMutationTable(tablePath);
  const tableDir = dirname(resolve(tablePath));
  const documentName = table.document.split("/").pop() ?? "doc.md";
  const baseText = readFileSync(join(tableDir, table.document), "utf8");
  const library = table.module.startsWith("doc-verify:");
  const moduleRef = table.module;
  let ownYaml: string;
  try {
    ownYaml = library ? readEngineLibrary(table.module).content : readFileSync(join(tableDir, table.module), "utf8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new UsageError(`mutate: cannot read module ${table.module}: ${message}`);
  }
  const moduleText = library ? undefined : ownYaml;
  const own = ownConstraintIds(ownYaml, table.module);
  const composed = await composedConstraintIds(moduleRef, tableDir);

  const runCheck = async (text: string, profile: "draft" | "promotion"): Promise<CheckOutcome> => {
    const dir = mkdtempSync(join(tmpdir(), "mutate-row-"));
    try {
      writeScratch(dir, { documentName, documentText: text, artifactKind: table.artifact_kind, moduleRef, moduleText });
      return await checkScratch(dir, documentName, profile);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  };

  const lines: string[] = [];
  const control = await runCheck(baseText, "draft");
  if (control.error !== undefined || control.verdict !== "PASS") {
    const text = `HARNESS     base  the unmutated ${table.document} is not PASS (${control.error ?? control.verdict}); no row can be scored\n`;
    return { results: [], census: [], liveConstraints: own, exitCode: 2, text };
  }
  lines.push(`  PASS        base  unmutated ${table.document}`);
  if (judge) {
    const judged = await runCheck(baseText, "promotion");
    if (judged.error !== undefined || judged.verdict !== "PASS") {
      const text = `HARNESS     base  promotion verdict ${judged.error ?? judged.verdict}; fired ${[...judged.failed].join(", ")}\n`;
      return { results: [], census: [], liveConstraints: own, exitCode: 2, text };
    }
    lines.push("  PASS        base  promotion profile");
  }

  const composedSet = new Set(composed);
  const results: MutateRowResult[] = [];
  for (const row of table.rows) {
    const edited = applyEdit(baseText, row);
    if (!edited.ok) {
      results.push({ id: row.id, kind: row.kind, expect: row.expect, status: "BROKEN", detail: edited.detail });
      continue;
    }
    if (row.leg === "judge" && !judge) {
      results.push({
        id: row.id, kind: row.kind, expect: row.expect, status: "SKIPPED",
        detail: `judge leg (run with --judge): ${row.expect ?? row.note ?? ""}`,
      });
      continue;
    }
    if ((row.kind === "kill" || row.kind === "gap") && row.expect !== undefined && !composedSet.has(row.expect)) {
      results.push({
        id: row.id, kind: row.kind, expect: row.expect, status: "UNKNOWN-EXPECT",
        detail: `${row.expect} is not a constraint of ${table.module}`,
      });
      continue;
    }
    const outcome = await runCheck(edited.text, row.leg === "judge" ? "promotion" : "draft");
    if (outcome.error !== undefined) {
      results.push({ id: row.id, kind: row.kind, expect: row.expect, status: "HARNESS", detail: outcome.error });
      continue;
    }
    if (row.kind === "keep") {
      const scored = scoreKeep(outcome.verdict ?? "NO-GO", outcome.failed, row.note);
      results.push({ id: row.id, kind: row.kind, status: scored.status, detail: scored.detail });
    } else if (row.kind === "gap") {
      const scored = scoreGap(outcome.failed, row.expect ?? "", row.note);
      results.push({ id: row.id, kind: row.kind, expect: row.expect, status: scored.status, detail: scored.detail });
    } else {
      const scored = scoreKill(outcome.failed, row.expect ?? "");
      results.push({ id: row.id, kind: row.kind, expect: row.expect, status: scored.status, detail: scored.detail });
    }
  }

  const killed = new Set(results.filter((row) => row.status === "RED").map((row) => row.expect).filter((id): id is string => id !== undefined));
  const judgeLeg = new Set(table.rows.filter((row) => row.kind === "kill" && row.leg === "judge").map((row) => row.expect).filter((id): id is string => id !== undefined));
  const census = censusCoverage({
    live: own, pin: table.constraints, killed, uncovered: table.uncovered, judgeLeg, judgeRan: judge,
  });

  let unscored = 0;
  for (const result of results) {
    if (!SCORED.has(result.status)) unscored += 1;
    lines.push(`  ${result.status.padEnd(16)} ${result.id.padEnd(4)} ${result.detail}`);
  }
  lines.push("", "census:");
  for (const row of census) {
    if (!row.ok) unscored += 1;
    lines.push(`  ${row.tag.padEnd(16)} ${row.id}${row.why !== undefined ? `  -- ${row.why}` : ""}`);
  }
  const kills = results.filter((row) => row.kind === "kill" && row.status !== "SKIPPED");
  const keeps = results.filter((row) => row.kind === "keep" && row.status !== "SKIPPED");
  lines.push(
    "",
    `${String(kills.filter((row) => row.status === "RED").length)}/${String(kills.length)} kill rows redden their named constraint; ` +
    `${String(keeps.filter((row) => row.status === "KEPT").length)}/${String(keeps.length)} keep rows stay PASS; ` +
    `${String(results.filter((row) => row.status === "GAP-CONFIRMED").length)} known gaps confirmed; ` +
    `${String(census.filter((row) => row.tag === "covered").length)}/${String(own.length)} constraints killed` +
    (judge ? "" : `; ${String(results.filter((row) => row.status === "SKIPPED").length)} judge-leg rows skipped (use --judge)`),
  );
  const text = `${lines.join("\n")}\n`;
  const harness = results.length === 0;
  return { results, census, liveConstraints: own, exitCode: harness ? 2 : unscored === 0 ? 0 : 1, text };
}
