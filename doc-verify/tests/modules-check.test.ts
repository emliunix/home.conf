// `doc-verify check` on design-04 modules (doc-verify-v2): a document rule names `modules`, the
// checker composes them (with `extends`), derives the document's facts, and runs the engine.
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { checkDocuments, titleStatus } from "../src/checker.js";
import { renderText } from "../src/report.js";
import { scriptedJudge } from "./engine-helpers.js";

const BASE = `schema_version: 2
kind: verification-module
module: base
params:
  statuses: [draft, reviewed, landed]
rules:
  top(D, S): core.section(D, S, _), core.depth(D, S, 2)
  goal_section(D, S): top(D, S), core.heading(D, S, 'Goal')
constraints:
  has-goal:
    forall: core.meta(D, kind, _)
    require: goal_section(D, S)
    severity: error
    message: "{D} has no Goal"
  status-in-vocabulary:
    forall: core.meta(D, status, W)
    require: W in $statuses
    severity: error
    message: "{D}: status {W} is not one of {statuses}"
`;

const DESIGN = `schema_version: 2
kind: verification-module
module: design
extends: [base.yaml]
oracles:
  falsifies(D, S):
    ask: The verification names a check that would fail if its claim were false.
    evidence: core.body(D, S)
    threshold: 0.5
rules:
  verification_section(D, S): top(D, S), core.heading(D, S, 'Verification')
constraints:
  verification-falsifies:
    forall: verification_section(D, S)
    require: falsifies(D, S)
    severity: error
    profiles: [promotion]
    message: "{S} names no failing check"
`;

const GOOD = "# D\n\n## Status\n\nreviewed\n\n## Goal\n\nShip it.\n\n## Verification\n\n`pytest -q` fails when the parser drops a field.\n";

async function repository(files: Record<string, string>, rule: string): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "doc-verify-modules-"));
  for (const [file, content] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await writeFile(path.join(root, file), content);
  }
  await writeFile(path.join(root, ".doc-verify.yaml"), `schema_version: 1
kind: document-verification
documents:
${rule}
invalidation_patterns: [.doc-verify.yaml]
judge:
  kind: jev
  model: jev-1.13.0
  client_sha256: ce983f8de97d5b30d527a7116f0c49ad3d17e098d2c3f17c9600041260c65dcb
  attestation_max_age_seconds: 3600
policy:
  kind: semantic-boundary
  version: 1
  max_evidence_bytes: 12000
  forbidden_literals: []
`);
  execFileSync("git", ["init"], { cwd: root, stdio: "ignore" });
  return root;
}

const DESIGN_RULE = `  - pattern: design/*.md
    artifact_kind: design
    modules: [modules/design.yaml]`;

const holds = scriptedJudge(() => ({ value: "holds" }));

/** The single artifact a one-path check reports. */
function only(report: Awaited<ReturnType<typeof checkDocuments>>): (typeof report.artifacts)[number] {
  const artifact = report.artifacts[0];
  if (artifact === undefined) {
    throw new Error("the check reported no artifact");
  }
  return artifact;
}

describe("doc-verify check on design-04 modules", () => {
  it("composes extends, judges on promotion, and passes a conforming document", async () => {
    const root = await repository({ "modules/base.yaml": BASE, "modules/design.yaml": DESIGN, "design/a.md": GOOD }, DESIGN_RULE);
    const judge = scriptedJudge(() => ({ value: "holds" }));
    const report = await checkDocuments({ root, mode: { kind: "paths", paths: ["design/a.md"] }, profile: "auto", backend: judge.backend });
    const artifact = only(report);
    expect(artifact.verdict).toBe("PASS");
    expect(artifact.findings).toEqual([]);
    expect(artifact.profile).toBe("promotion");
    expect(artifact.engine?.modules).toEqual(["modules/base.yaml", "modules/design.yaml"]);
    expect(artifact.engine?.requests).toBeGreaterThan(0);
    expect(renderText(report, { verbose: true })).toContain("modules: modules/base.yaml + modules/design.yaml");
  });

  it("fails a violated constraint with the module's message", async () => {
    const bad = GOOD.replace("## Goal\n\nShip it.\n\n", "");
    const root = await repository({ "modules/base.yaml": BASE, "modules/design.yaml": DESIGN, "design/a.md": bad }, DESIGN_RULE);
    const report = await checkDocuments({ root, mode: { kind: "paths", paths: ["design/a.md"] }, profile: "auto", backend: holds.backend });
    expect(only(report).verdict).toBe("NO-GO");
    expect(only(report).findings.map((item) => item.message).join("\n")).toContain("design/a.md has no Goal");
  });

  it("reads the status meta from the Status section and refuses one outside the vocabulary", async () => {
    const odd = GOOD.replace("reviewed", "selected");
    const root = await repository({ "modules/base.yaml": BASE, "modules/design.yaml": DESIGN, "design/a.md": odd }, DESIGN_RULE);
    const report = await checkDocuments({ root, mode: { kind: "paths", paths: ["design/a.md"] }, profile: "auto", backend: holds.backend });
    expect(only(report).findings.map((item) => item.message).join("\n")).toContain("status selected is not one of");
  });

  it("reports how many words the Status line holds, so a module can require exactly one", async () => {
    const oneWord = BASE.replace("constraints:\n", `constraints:
  status-is-one-word:
    forall: core.meta(D, status, _)
    require: core.meta(D, status_words, '1')
    severity: error
    message: "{D}: the status line is not one word"
`);
    const prose = GOOD.replace("reviewed", "Reviewed — nearly done, pending one more look");
    const files = { "modules/base.yaml": oneWord, "modules/design.yaml": DESIGN };
    const bad = await checkDocuments({ root: await repository({ ...files, "design/a.md": prose }, DESIGN_RULE),
      mode: { kind: "paths", paths: ["design/a.md"] }, profile: "auto", backend: holds.backend });
    expect(only(bad).verdict).toBe("NO-GO");
    expect(only(bad).findings.map((item) => item.message).join("\n")).toContain("the status line is not one word");
    const good = await checkDocuments({ root: await repository({ ...files, "design/a.md": GOOD }, DESIGN_RULE),
      mode: { kind: "paths", paths: ["design/a.md"] }, profile: "auto", backend: holds.backend });
    expect(only(good).verdict).toBe("PASS");
  });

  it("runs a draft on structural constraints only: no judge request", async () => {
    const draft = GOOD.replace("reviewed", "draft");
    const root = await repository({ "modules/base.yaml": BASE, "modules/design.yaml": DESIGN, "design/a.md": draft }, DESIGN_RULE);
    const judge = scriptedJudge(() => ({ value: "fails" }));
    const report = await checkDocuments({ root, mode: { kind: "paths", paths: ["design/a.md"] }, profile: "auto", backend: judge.backend });
    expect(only(report).profile).toBe("draft");
    expect(only(report).verdict).toBe("PASS");
    expect(judge.requests).toHaveLength(0);
  });

  it("refuses a name defined twice across the extends chain", async () => {
    const clash = DESIGN.replace("  verification_section(D, S)", "  top(D, S): core.section(D, S, _)\n  verification_section(D, S)");
    const root = await repository({ "modules/base.yaml": BASE, "modules/design.yaml": clash, "design/a.md": GOOD }, DESIGN_RULE);
    await expect(checkDocuments({ root, mode: { kind: "paths", paths: ["design/a.md"] }, profile: "auto", backend: holds.backend }))
      .rejects.toThrow(/rules\.top\(D, S\) is already defined by modules\/base\.yaml/);
  });

  it("reads a goal's status from its title when the rule says status_from: title", async () => {
    expect(titleStatus("# v4 service API — OPEN (2026-09-21)\n")).toBe("open");
    expect(titleStatus("# Routing - CLOSED-GREEN (2026-09-24)\n")).toBe("closed-green");
    const goalModule = BASE.replace("statuses: [draft, reviewed, landed]", "statuses: [open, blocked, closed-green]");
    const root = await repository(
      { "modules/goal.yaml": goalModule, "goals/a.md": "# A goal — OPEN (2026-10-01)\n\n## Goal\n\nOne.\n" },
      `  - pattern: goals/*.md
    artifact_kind: goal
    modules: [modules/goal.yaml]
    status_from: title`,
    );
    const report = await checkDocuments({ root, mode: { kind: "paths", paths: ["goals/a.md"] }, profile: "auto", backend: holds.backend });
    expect(only(report).verdict).toBe("PASS");
  });

  it("refuses a rule that names both a v1 strategy and modules", async () => {
    const root = await repository({ "modules/base.yaml": BASE, "design/a.md": GOOD },
      `  - pattern: design/*.md
    artifact_kind: design
    verification: strategies/design.yaml#verification
    modules: [modules/base.yaml]`);
    await expect(checkDocuments({ root, mode: { kind: "paths", paths: ["design/a.md"] }, profile: "auto", backend: holds.backend }))
      .rejects.toThrow(/exactly one of verification/);
  });
});
