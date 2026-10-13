/**
 * Corpus draft profile: every document in corpus-draft.yaml against its frozen expect
 * (design/06 §Verification; round 2 / 4b).
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";
import YAML from "yaml";

import { composeModules } from "../../src/engine/index.js";
import { Kernel, compileWitnessModule, parseFactText, translateProgram } from "../../src/kernel/index.js";
import { compare, type Expect } from "./compare.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../..");
const WITNESS = YAML.parse(readFileSync(path.join(HERE, "witnesses/corpus-draft.yaml"), "utf8")) as {
  documents: string[];
  modules: Record<string, string[]>;
  steps: Array<{
    profile?: string;
    answers?: Record<string, string>;
    expect: { documents: Record<string, Expect> };
  }>;
};

function corpusFacts() {
  const byDoc: Record<string, ReturnType<typeof parseFactText>[]> = {};
  let doc: string | undefined;
  for (const line of readFileSync(path.join(HERE, "corpus-facts.pl"), "utf8").split("\n")) {
    const header = /^% (.+) \([^)]*\)$/.exec(line);
    if (header) {
      const name = header[1];
      if (name === undefined) continue;
      doc = name;
      byDoc[name] = [];
      continue;
    }
    if (doc !== undefined && line.trim() && !line.startsWith(":-") && !line.startsWith("%")) {
      (byDoc[doc] ??= []).push(parseFactText(line.trim().replace(/\.$/, "")));
    }
  }
  return byDoc;
}

describe("kernel corpus (S1)", () => {
  it("matches expect on every document-step", async () => {
    const facts = corpusFacts();
    const composed = new Map<string, Awaited<ReturnType<typeof compileWitnessModule>>["program"]>();
    const mismatches: string[] = [];
    for (const [n, step] of WITNESS.steps.entries()) {
      for (const doc of WITNESS.documents) {
        const mods = WITNESS.modules[doc] as string[];
        const key = mods.join(" ");
        if (!composed.has(key)) {
          const c = await composeModules(mods, (file) => Promise.resolve({
            path: file,
            content: readFileSync(path.join(ROOT, file), "utf8"),
            hash: "",
          }));
          composed.set(key, (await compileWitnessModule(c.yaml)).program);
        }
        const program = composed.get(key) as Awaited<ReturnType<typeof compileWitnessModule>>["program"];
        const inProfile = (c: { profiles?: string[] }) =>
          c.profiles === undefined || step.profile === undefined || c.profiles.includes(step.profile);
        const p1 = { ...program, constraints: program.constraints.filter(inProfile) };
        const kernel = await Kernel.create();
        await kernel.load(translateProgram(p1, facts[doc] ?? []));
        kernel.setAnswers(step.answers ?? {});
        const result = kernel.evaluate(p1);
        const exp = step.expect.documents[doc];
        const lines = exp ? compare(exp, result) : ["document: expected nothing for this document"];
        for (const l of lines) mismatches.push(`corpus ${doc} step ${n + 1}: ${l}`);
      }
    }
    expect(mismatches).toEqual([]);
  }, 180_000);
});
