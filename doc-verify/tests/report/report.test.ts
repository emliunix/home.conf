// CLI reporting (owner priority 4, 2026-10-05): a non-satisfied constraint prints its message,
// its repair hint and what decided it; sections replace the evidence hash (kept under
// --verbose, which adds the proof tree); JSON carries the engine report; engine failures are
// findings.
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { checkDocuments } from "../../src/checker.js";
import { renderText } from "../../src/report.js";
import { scriptedJudge } from "../engine-helpers.js";

const MODULE = `schema_version: 2
kind: verification-module
module: sample
oracles:
  falsifies(D, S):
    ask: The verification names a check that would fail if its claim were false.
    evidence: core.body(D, S)
    threshold: 0.8
rules:
  top(D, S): core.section(D, S, _), core.depth(D, S, 2)
  verification_section(D, S): top(D, S), core.heading(D, S, 'Verification')
constraints:
  has-goal:
    forall: core.meta(D, kind, design)
    require: top(D, S), core.heading(D, S, 'Goal')
    severity: error
    message: "{D} has no '## Goal' section"
    repair: "Add '## Goal'."
  verification-falsifies:
    forall: verification_section(D, S)
    require: falsifies(D, S)
    severity: error
    message: "{S} in {D} names no failing check"
    repair: "Name the test and what it observes."
`;

const GOOD = "# D\n\n## Goal\n\nShip it.\n\n## Verification\n\n`pytest -q` fails when the parser drops a field.\n";

async function repository(markdown: string, budget = 12000): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "doc-verify-report-"));
  await mkdir(path.join(root, "design"));
  await mkdir(path.join(root, "modules"));
  await writeFile(path.join(root, "modules/design.yaml"), MODULE);
  await writeFile(path.join(root, "design/a.md"), markdown);
  await writeFile(path.join(root, ".doc-verify.yaml"), `schema_version: 1
kind: document-verification
documents:
  - pattern: design/*.md
    artifact_kind: design
    modules: [modules/design.yaml]
invalidation_patterns: [.doc-verify.yaml]
judge: {kind: jev, model: jev-1.13.0, client_sha256: ce983f8de97d5b30d527a7116f0c49ad3d17e098d2c3f17c9600041260c65dcb, attestation_max_age_seconds: 3600}
policy: {kind: semantic-boundary, version: 1, max_evidence_bytes: ${String(budget)}, forbidden_literals: [forbidden-word]}
`);
  execFileSync("git", ["init"], { cwd: root, stdio: "ignore" });
  return root;
}

const atP = (p: number) => scriptedJudge((question) => ({
  value: "holds", distribution: question.options.map((id) => (id === "holds" ? p : id === "fails" ? 1 - p : 0)),
}));

async function check(markdown: string, p: number, budget?: number) {
  return checkDocuments({ root: await repository(markdown, budget), mode: { kind: "paths", paths: ["design/a.md"] }, profile: "promotion", backend: atP(p).backend });
}

describe("text report", () => {
  it("prints an oracle-decided NEEDS-REVIEW with its repair and the deciding answer", async () => {
    const report = await check(GOOD, 0.6);
    const text = renderText(report);
    expect(text).toContain("design/a.md:7-10 [verification] module.verification-falsifies NEEDS-REVIEW undetermined: verification in design/a.md names no failing check (sections: verification)\n"
      + "  span: section (not judged) — lines 7-10\n"
      + "  reason: below the oracle's threshold\n"
      + "  repair: Name the test and what it observes.\n"
      + "  answered holds (p=0.6 < threshold 0.8) over verification\n");
    expect(text).not.toContain("evidence:");
    expect(text).toMatch(/^NEEDS-REVIEW: 1 artifact\(s\), 3 section\(s\), 1 warning\(s\), 2 semantic call\(s\), 0 cache hit\(s\)$/m);
  });

  it("prints a structural NO-GO with the literal that is missing", async () => {
    const report = await check(GOOD.replace("## Goal\n\nShip it.\n\n", ""), 0.9);
    const text = renderText(report);
    expect(text).toContain("module.has-goal NO-GO violated: design/a.md has no '## Goal' section\n  repair: Add '## Goal'.\n  structural: missing core.heading(design/a.md, verification, Goal)\n");
  });

  it("keeps the evidence hash and adds the proof tree under --verbose", async () => {
    const report = await check(GOOD, 0.6);
    const text = renderText(report, { verbose: true });
    expect(text).toMatch(/finding: design\/a\.md:7-10 \[verification\] module\.verification-falsifies NEEDS-REVIEW .*\(evidence: [0-9a-f]{64}\)/);
    expect(text).toContain("    proof:\n      binding verification-falsifies: undetermined\n");
    expect(text).toContain("oracle sample.falsifies(design/a.md, verification) -> unknown (answered holds, distribution [0.6, 0.4, 0]");
  });

  it("carries the full engine report in JSON", async () => {
    const report = await check(GOOD, 0.9);
    const parsed = JSON.parse(JSON.stringify(report)) as { artifacts: Array<{ engine: { report: { verdict: string; constraints: Array<{ id: string }>; oracles: unknown[] } } }> };
    const engine = parsed.artifacts[0]?.engine;
    if (engine === undefined) {
      throw new Error("no engine report");
    }
    expect(engine.report.verdict).toBe("PASS");
    expect(engine.report.constraints.map((constraint) => constraint.id)).toEqual(["has-goal", "verification-falsifies"]);
    expect(engine.report.oracles).toHaveLength(1);
  });

  it("lists an over-budget round and a policy violation as findings", async () => {
    const over = await check(GOOD, 0.9, 50);
    const blocked = over.artifacts[0]?.findings.find((item) => item.ruleId === "module.engine");
    expect(blocked?.verdict).toBe("BLOCKED");
    expect(blocked?.message).toMatch(/above the outbound budget of 50/);
    expect(renderText(over)).toContain("module.engine BLOCKED evidence for");
    const leak = await check(GOOD.replace("drops a field", "drops a forbidden-word"), 0.9);
    const refused = leak.artifacts[0]?.findings.find((item) => item.ruleId === "module.engine");
    expect(refused).toMatchObject({ verdict: "NO-GO", message: "semantic evidence contains prohibited data" });
  });
});
