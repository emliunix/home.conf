import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  censusCoverage,
  failedConstraintIds,
  runMutate,
  scoreGap,
  scoreKeep,
  scoreKill,
} from "../../src/mutate.js";
import { applyEdit, loadMutationTable, ownConstraintIds } from "../../src/mutate-table.js";

const FIXTURES = fileURLToPath(new URL("./fixtures/", import.meta.url));
const TABLE = join(FIXTURES, "note.mutations.yaml");
const CONTRACT = fileURLToPath(new URL("./module-contract.mutations.yaml", import.meta.url));

describe("mutate scoring", () => {
  it("a kill is RED only when the named constraint fires", () => {
    expect(scoreKill(new Set(["has-title"]), "has-title").status).toBe("RED");
    expect(scoreKill(new Set(["has-title", "has-status"]), "has-title").status).toBe("RED");
    expect(scoreKill(new Set(), "has-title").status).toBe("GREEN");
    expect(scoreKill(new Set(["has-status"]), "has-title").status).toBe("WRONG-CASE");
  });

  it("a keep is KEPT on PASS and FALSE-ALARM otherwise", () => {
    expect(scoreKeep("PASS", new Set(), "ok").status).toBe("KEPT");
    expect(scoreKeep("NO-GO", new Set(["has-title"]), "ok").status).toBe("FALSE-ALARM");
  });

  it("a gap is CONFIRMED until the named constraint fires", () => {
    expect(scoreGap(new Set(), "has-title", "hole").status).toBe("GAP-CONFIRMED");
    expect(scoreGap(new Set(["has-status"]), "has-title", "hole").status).toBe("GAP-CONFIRMED");
    expect(scoreGap(new Set(["has-title"]), "has-title", "hole").status).toBe("GAP-CLOSED");
  });

  it("failedConstraintIds reads module.* NO-GO rule ids", () => {
    expect([...failedConstraintIds([
      { verdict: "NO-GO", ruleId: "module.has-title" },
      { verdict: "WARN", ruleId: "module.paths-resolve" },
      { verdict: "NO-GO", ruleId: "required-sections" },
    ])]).toEqual(["has-title"]);
  });

  it("census flags a pin that does not match the live module", () => {
    const drift = censusCoverage({
      live: ["has-title"],
      pin: ["has-title", "known-fields"],
      killed: new Set(["has-title"]),
      uncovered: {},
      judgeLeg: new Set(),
      judgeRan: false,
    });
    expect(drift.some((row) => row.tag === "CONSTRAINT-DRIFT" && row.why?.includes("known-fields"))).toBe(true);
  });

  it("census flags an uncovered id the module no longer has", () => {
    const drift = censusCoverage({
      live: ["has-title"],
      pin: ["has-title"],
      killed: new Set(["has-title"]),
      uncovered: { "known-fields": "stale" },
      judgeLeg: new Set(),
      judgeRan: false,
    });
    expect(drift.some((row) => row.tag === "CONSTRAINT-DRIFT" && row.why?.includes("uncovered but absent"))).toBe(true);
  });

  it("census flags a live constraint with no kill, uncover, or judge-leg", () => {
    const rows = censusCoverage({
      live: ["has-title", "has-status"],
      pin: ["has-title", "has-status"],
      killed: new Set(["has-title"]),
      uncovered: {},
      judgeLeg: new Set(),
      judgeRan: false,
    });
    expect(rows.find((row) => row.id === "has-status")?.tag).toBe("NO-KILL");
  });

  it("census does not treat inherited constraints as this module's lock", () => {
    const rows = censusCoverage({
      live: ["module-contract-has-surface"],
      pin: ["module-contract-has-surface"],
      killed: new Set(["module-contract-has-surface"]),
      uncovered: {},
      judgeLeg: new Set(),
      judgeRan: false,
    });
    expect(rows.some((row) => row.tag === "CONSTRAINT-DRIFT")).toBe(false);
    expect(rows.every((row) => row.ok)).toBe(true);
  });
});

describe("applyEdit", () => {
  const base = readFileSync(join(FIXTURES, "note.md"), "utf8");
  it("replaces a unique from/to", () => {
    const row = loadMutationTable(TABLE).rows[0];
    if (row === undefined) throw new Error("M1");
    const edited = applyEdit(base, row);
    expect(edited.ok).toBe(true);
    if (edited.ok) expect(edited.text).not.toContain("## Title\n");
  });
  it("is BROKEN when the anchor is absent or duplicated", () => {
    expect(applyEdit(base, { id: "X", kind: "kill", from: "## Missing\n", to: "x" }).ok).toBe(false);
    const duplicated = applyEdit("aa", { id: "X", kind: "kill", from: "a", to: "b" });
    expect(duplicated.ok).toBe(false);
    if (!duplicated.ok) expect(duplicated.detail).toContain("2x");
  });
  it("cut_from drops the needle and everything after it", () => {
    const edited = applyEdit(base, { id: "C", kind: "kill", expect: "has-status", cut_from: "## Status\n" });
    expect(edited.ok).toBe(true);
    if (edited.ok) {
      expect(edited.text).toContain("## Title\n");
      expect(edited.text).not.toContain("## Status\n");
    }
  });
});

describe("loadMutationTable", () => {
  it("loads the note table and reads own constraint ids from the module YAML", () => {
    const table = loadMutationTable(TABLE);
    expect(table.rows.map((row) => row.id)).toEqual(["M1", "M2", "K1", "G1"]);
    expect(ownConstraintIds(readFileSync(join(FIXTURES, "note.module.yaml"), "utf8"), "note.module.yaml")).toEqual([
      "has-status", "has-title",
    ]);
  });
});

describe("runMutate on the note fixture", () => {
  it("scores the shipped table: two kills RED, one keep, one gap", async () => {
    const report = await runMutate(TABLE);
    expect(report.exitCode).toBe(0);
    expect(report.results.map((row) => `${row.id}:${row.status}`)).toEqual([
      "M1:RED", "M2:RED", "K1:KEPT", "G1:GAP-CONFIRMED",
    ]);
  });
});

describe("runMutate seeded statuses", () => {
  function tableWith(rewrite: (text: string) => string): string {
    const dir = mkdtempSync(join(tmpdir(), "mutate-seed-"));
    writeFileSync(join(dir, "note.module.yaml"), readFileSync(join(FIXTURES, "note.module.yaml"), "utf8"));
    writeFileSync(join(dir, "note.md"), readFileSync(join(FIXTURES, "note.md"), "utf8"));
    writeFileSync(join(dir, "note.mutations.yaml"), rewrite(readFileSync(TABLE, "utf8")));
    return join(dir, "note.mutations.yaml");
  }

  it("BROKEN: absent from-anchor", async () => {
    const path = tableWith((text) => text.replace("from: \"## Title\\n\"", "from: \"## Does-Not-Exist\\n\""));
    try {
      const report = await runMutate(path);
      expect(report.results.find((row) => row.id === "M1")?.status).toBe("BROKEN");
      expect(report.exitCode).toBe(1);
    } finally {
      rmSync(dirnameOf(path), { recursive: true, force: true });
    }
  });

  it("GREEN: kill edit that does not fire the named constraint", async () => {
    const path = tableWith((text) => text
      .replace("from: \"## Title\\n\"", "from: \"# Fixture note\\n\"")
      .replace("to: \"## Name\\n\"", "to: \"# Other note\\n\""));
    try {
      const report = await runMutate(path);
      expect(report.results.find((row) => row.id === "M1")?.status).toBe("GREEN");
      expect(report.exitCode).toBe(1);
    } finally {
      rmSync(dirnameOf(path), { recursive: true, force: true });
    }
  });

  it("WRONG-CASE: named constraint is not the one that fired", async () => {
    const path = tableWith((text) => text.replace(
      "id: M1\n    kind: kill\n    expect: has-title",
      "id: M1\n    kind: kill\n    expect: has-status",
    ));
    try {
      const report = await runMutate(path);
      expect(report.results.find((row) => row.id === "M1")?.status).toBe("WRONG-CASE");
      expect(report.exitCode).toBe(1);
    } finally {
      rmSync(dirnameOf(path), { recursive: true, force: true });
    }
  });

  it("FALSE-ALARM: keep row that removes a required heading", async () => {
    const path = tableWith((text) => text.replace(
      "id: K1\n    kind: keep",
      "id: K1\n    kind: keep",
    ).replace("from: \"A title body.\\n\"", "from: \"## Title\\n\"").replace("to: \"A different title body.\\n\"", "to: \"## Name\\n\""));
    try {
      const report = await runMutate(path);
      expect(report.results.find((row) => row.id === "K1")?.status).toBe("FALSE-ALARM");
      expect(report.exitCode).toBe(1);
    } finally {
      rmSync(dirnameOf(path), { recursive: true, force: true });
    }
  });

  it("GAP-CLOSED: gap row whose named constraint now fires", async () => {
    const path = tableWith((text) => text.replace(
      "id: G1\n    kind: gap\n    expect: has-title",
      "id: G1\n    kind: gap\n    expect: has-title",
    ).replace("from: \"# Fixture note\\n\"", "from: \"## Title\\n\"").replace("to: \"# Other note\\n\"", "to: \"## Name\\n\""));
    try {
      const report = await runMutate(path);
      expect(report.results.find((row) => row.id === "G1")?.status).toBe("GAP-CLOSED");
      expect(report.exitCode).toBe(1);
    } finally {
      rmSync(dirnameOf(path), { recursive: true, force: true });
    }
  });

  it("UNKNOWN-EXPECT: row names a constraint the module does not have", async () => {
    const path = tableWith((text) => text.replace("expect: has-title", "expect: known-fields"));
    try {
      const report = await runMutate(path);
      expect(report.results.find((row) => row.id === "M1")?.status).toBe("UNKNOWN-EXPECT");
      expect(report.exitCode).toBe(1);
    } finally {
      rmSync(dirnameOf(path), { recursive: true, force: true });
    }
  });

  it("CONSTRAINT-DRIFT: pin names a constraint deleted from the module", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mutate-drift-"));
    const module = readFileSync(join(FIXTURES, "note.module.yaml"), "utf8").replace(
      `  has-status:
    forall: core.meta(D, kind, note)
    require: top(D, S), core.heading(D, S, 'Status')
    severity: error
    message: "{D} has no Status"
`,
      "",
    );
    writeFileSync(join(dir, "note.module.yaml"), module);
    writeFileSync(join(dir, "note.md"), readFileSync(join(FIXTURES, "note.md"), "utf8"));
    writeFileSync(join(dir, "note.mutations.yaml"), readFileSync(TABLE, "utf8"));
    try {
      const report = await runMutate(join(dir, "note.mutations.yaml"));
      expect(report.census.some((row) => row.tag === "CONSTRAINT-DRIFT" && row.why?.includes("has-status"))).toBe(true);
      expect(report.results.find((row) => row.id === "M2")?.status).toBe("UNKNOWN-EXPECT");
      expect(report.exitCode).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("HARNESS: unmutated document is not PASS", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mutate-harness-"));
    writeFileSync(join(dir, "note.module.yaml"), readFileSync(join(FIXTURES, "note.module.yaml"), "utf8"));
    writeFileSync(join(dir, "note.md"), "# Fixture note\n\n## Status\n\ndraft\n");
    writeFileSync(join(dir, "note.mutations.yaml"), readFileSync(TABLE, "utf8"));
    try {
      const report = await runMutate(join(dir, "note.mutations.yaml"));
      expect(report.exitCode).toBe(2);
      expect(report.text).toContain("HARNESS");
      expect(report.results).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("NO-KILL: a live pinned constraint has no kill row", async () => {
    const path = tableWith((text) => text.replace(
      `  - id: M2
    kind: kill
    expect: has-status
    from: "## Status\\n"
    to: "## State\\n"
`,
      "",
    ));
    try {
      const report = await runMutate(path);
      expect(report.census.find((row) => row.id === "has-status")?.tag).toBe("NO-KILL");
      expect(report.exitCode).toBe(1);
    } finally {
      rmSync(dirnameOf(path), { recursive: true, force: true });
    }
  });

  it("SKIPPED: judge-leg row without --judge is not scored as a pass of the constraint", async () => {
    const path = tableWith((text) => `${text}  - id: J1\n    kind: kill\n    leg: judge\n    expect: has-title\n    from: "## Title\\n"\n    to: "## Name\\n"\n`);
    try {
      const report = await runMutate(path);
      expect(report.results.find((row) => row.id === "J1")?.status).toBe("SKIPPED");
      expect(report.census.find((row) => row.id === "has-title")?.tag).toBe("covered");
    } finally {
      rmSync(dirnameOf(path), { recursive: true, force: true });
    }
  });

  it("HARNESS: --judge without a key", async () => {
    const hadType = Object.hasOwn(process.env, "TYPESAFE_API_KEY");
    const hadApi = Object.hasOwn(process.env, "API_KEY");
    const type = process.env.TYPESAFE_API_KEY;
    const api = process.env.API_KEY;
    delete process.env.TYPESAFE_API_KEY;
    delete process.env.API_KEY;
    try {
      const report = await runMutate(TABLE, { judge: true });
      expect(report.exitCode).toBe(2);
      expect(report.text).toContain("HARNESS");
      expect(report.results).toEqual([]);
    } finally {
      if (hadType && type !== undefined) process.env.TYPESAFE_API_KEY = type;
      if (hadApi && api !== undefined) process.env.API_KEY = api;
    }
  });
});

describe("native library table", () => {
  it("kills module-contract-has-surface on the worked example without drifting on extends", async () => {
    const report = await runMutate(CONTRACT);
    expect(report.exitCode, report.text).toBe(0);
    expect(report.results.find((row) => row.id === "M1")?.status).toBe("RED");
    expect(report.results.find((row) => row.id === "K1")?.status).toBe("KEPT");
    expect(report.liveConstraints).toEqual(["module-contract-has-surface", "module-contract-is-current"]);
    expect(report.census.find((row) => row.id === "module-contract-is-current")?.tag).toBe("UNCOVERED");
    expect(report.census.some((row) => row.tag === "CONSTRAINT-DRIFT")).toBe(false);
  });
});

describe("CLI mutate", () => {
  it("scores the note table through the built CLI", () => {
    const result = spawnSync(process.execPath, ["doc-verify/dist/cli.js", "mutate", TABLE], {
      encoding: "utf8",
      cwd: process.cwd(),
    });
    expect(result.status, result.stdout + result.stderr).toBe(0);
    expect(result.stdout).toMatch(/M1\s+has-title/);
    expect(result.stdout).toContain("KEPT");
    expect(result.stdout).toContain("GAP-CONFIRMED");
  });

  it("refuses mutate with no table", () => {
    const result = spawnSync(process.execPath, ["doc-verify/dist/cli.js", "mutate"], {
      encoding: "utf8",
      cwd: process.cwd(),
    });
    expect(result.status).toBe(64);
    expect(result.stderr).toContain("usage: doc-verify mutate");
  });
});

function dirnameOf(file: string): string {
  return file.slice(0, file.lastIndexOf("/"));
}
