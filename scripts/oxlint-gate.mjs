#!/usr/bin/env node
// The oxlint gate.
//
// Why this exists rather than a bare `oxlint` invocation:
//
//   oxlint exits 1 for BOTH a finding and a broken run. eslint exits 2 on a
//   crash and 1 on a finding, so replacing eslint with oxlint loses a
//   discrimination the repo had. This wrapper restores it on the output
//   stream: a finding emits parseable JSON on stdout, a broken run emits
//   plain text there (not stderr).
//
//   A second trap, measured: `--type-aware` and `--deny <rule>` are BOTH
//   load-bearing and NEITHER alone is visible in the exit status. With either
//   one missing the run exits 0 on a file with ten real violations, while
//   still printing an unrelated diagnostic to stdout. So "did it exit 0" and
//   "is diagnostics[] non-empty" both certify a red as green. The only
//   assertion that survives is the expected diagnostic CODE being present.
//
// Exit codes: 0 pass, 1 finding, 2 crash / unusable run.

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const CONFIG = join(ROOT, "oxlint.config.json");

// The population. `doc-verify/tests/language/references.mutations.mjs` is
// deliberately ABSENT: it is a mutation runner outside `doc-verify/tsconfig.json`'s
// include, so typed rules cannot run over it and it produced 68 of 70
// diagnostics on an untyped fallback. It is covered by .mjs lint rules and by
// its own check-* case file, not by the typed program. See task #224.
const POPULATION = ["doc-verify/src", "doc-verify/tests"];
const EXCLUDED = ["--ignore-pattern=doc-verify/tests/language/references.mutations.mjs"];

// ⚠ The project is PINNED rather than auto-discovered, and that is load-bearing.
// Measured: with no `--tsconfig`, oxlint walks up from each file and silently
// degrades when it finds no project -- the real population went from 2
// diagnostics to 82 (54 of them `typescript(no-unnecessary-condition)` firing on
// code it could not resolve) purely from the project not being found. Pinning
// the path makes that case LOUD: a missing project writes plain text to stdout
// ("The tsconfig file ... does not exist"), which the JSON-parse arm below
// reports as a BROKEN RUN instead of a clean tree.
const TSCONFIG = "doc-verify/tsconfig.json";

// The rule that must be armed for this gate to mean anything. Asserted by
// CODE, never by count: on the natural probe shape the count is 1 when the
// rule is MISSING (an unrelated no-unused-vars) and 2 when it is present.
const REQUIRED_RULE = "typescript(no-unsafe-assignment)";

function runOxlint(args) {
  return spawnSync("oxlint", ["-c", CONFIG, "--type-aware", "--tsconfig", TSCONFIG, "--format=json", ...args], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
}

function classify(res) {
  // A spawn that never started (oxlint absent from PATH) leaves `stdout`
  // undefined. Measured: without this arm the gate does not report a broken run,
  // it THROWS a TypeError -- and a throw from a hook step reads as a finding, so
  // the failure mode of the gate's own instrument is indistinguishable from the
  // thing the gate exists to detect.
  if (res.error) {
    return { kind: "crash", detail: `could not run oxlint: ${res.error.message}` };
  }
  const out = typeof res.stdout === "string" ? res.stdout : "";
  let report;
  try {
    report = JSON.parse(out);
  } catch {
    return {
      kind: "crash",
      detail: `stdout is not parseable JSON (${out.length} B); first 200: ${JSON.stringify(out.slice(0, 200))}`,
    };
  }
  if (report === null || typeof report !== "object" || !Array.isArray(report.diagnostics)) {
    return {
      kind: "crash",
      detail: `JSON report carries no diagnostics[] (top-level keys: ${Object.keys(report ?? {}).join(", ") || "none"})`,
    };
  }
  // A malformed project is reported as its own diagnostic code. A VALID but
  // non-covering project emits no signal at all, so this is the only project
  // health we can assert -- we cannot assert "a covering tsconfig was found".
  const tsconfigErrors = report.diagnostics.filter((d) => d.code === "typescript(tsconfig-error)");
  if (tsconfigErrors.length > 0) {
    return { kind: "crash", detail: `${tsconfigErrors.length} tsconfig-error diagnostic(s)` };
  }
  if (!(report.number_of_files > 0)) {
    return { kind: "crash", detail: `number_of_files = ${report.number_of_files}; the run covered nothing` };
  }
  return { kind: "ok", report };
}

function main() {
  const selfTest = process.argv.includes("--self-test");
  const res = runOxlint([...EXCLUDED, ...POPULATION]);
  const verdict = classify(res);

  if (verdict.kind === "crash") {
    process.stderr.write(`oxlint gate: BROKEN RUN (not a finding) — ${verdict.detail}\n`);
    return 2;
  }

  const { report } = verdict;
  const errors = report.diagnostics.filter((d) => d.severity === "error");
  const armed = report.diagnostics.some((d) => d.code === REQUIRED_RULE);

  process.stdout.write(
    `oxlint gate: ${report.number_of_files} files, ${report.number_of_rules} rules, ` +
      `${report.diagnostics.length} diagnostic(s)\n`,
  );

  // --self-test proves the rule is ARMED rather than trusting the config.
  // Without it a silent `--deny` loss reads as a clean tree.
  if (selfTest) return selfTestArmed(armed);

  for (const d of errors.length > 0 ? errors : report.diagnostics) {
    const line = d.labels?.[0]?.span?.line ?? "?";
    process.stdout.write(`  ${d.filename}:${line}  ${d.code}\n      ${d.message}\n`);
  }
  return errors.length > 0 ? 1 : 0;
}

// The seeded red. A probe with a real `any` flow must produce the required
// rule. If it does not, the gate is not armed and every future green is
// meaningless -- so this is a crash, not a finding.
function selfTestArmed(armedOnPopulation) {
  const probe = join(ROOT, "scripts", "__gate-probe__", "any-flow.ts");
  // Deliberately NOT passed as `--deny`. Measured: with `--deny`, the rule is
  // enabled for this run regardless of the config, so deleting
  // `typescript/no-unsafe-assignment` from oxlint.config.json left BOTH the
  // normal run and this self-test green (49 files / 68 rules / 0 diagnostics --
  // one rule short, and nobody reading). Going through the config makes the
  // probe track the config: with the rule declared it fires, with the rule
  // absent it does not, so an omission is caught here.
  const res = runOxlint([probe]);
  const verdict = classify(res);
  if (verdict.kind === "crash") {
    process.stderr.write(`oxlint gate: SEEDED RED INCONCLUSIVE — probe run broken: ${verdict.detail}\n`);
    return 2;
  }
  const fired = verdict.report.diagnostics.some((d) => d.code === REQUIRED_RULE);
  if (!fired) {
    process.stderr.write(
      `oxlint gate: NOT ARMED — the seeded probe with a real \`any\` flow did not produce ` +
        `${REQUIRED_RULE}. The typed rule is not engaged, so every green below it is meaningless.\n`,
    );
    return 2;
  }
  process.stdout.write(`oxlint gate: armed — seeded red fired ${REQUIRED_RULE}\n`);
  return armedOnPopulation ? 1 : 0;
}

process.exit(main());
