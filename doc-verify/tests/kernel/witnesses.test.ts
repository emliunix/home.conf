/**
 * Model conformance: every witness step of tests/kernel/witnesses/*.yaml (S1 only)
 * against the hand-derived `expect` (design/06 §Verification; rounds 2 and 4b).
 */

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";
import YAML from "yaml";

import { Kernel, translateWitness } from "../../src/kernel/index.js";
import { compare, type Expect } from "./compare.js";

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "witnesses");
const files = readdirSync(DIR)
  .filter((f) => f.endsWith(".yaml") && f !== "corpus-draft.yaml")
  .sort();

describe("kernel witnesses (S1)", () => {
  for (const file of files) {
    const witness = YAML.parse(readFileSync(path.join(DIR, file), "utf8")) as {
      id: string;
      gate: string;
      module: string;
      facts?: string[];
      steps: Array<{ answers?: Record<string, string>; expect?: Expect }>;
    };
    if (witness.gate === "corpus") continue;

    describe(`${witness.gate} ${witness.id}`, () => {
      it(`matches expect on every step (${witness.steps.length})`, async () => {
        const tr = await translateWitness(witness);
        const kernel = await Kernel.create();
        await kernel.load(tr.text, { sandbox: true });
        for (const [i, step] of witness.steps.entries()) {
          kernel.setAnswers(step.answers ?? {});
          const result = kernel.evaluate(tr.program);
          const lines = compare(step.expect ?? {}, result);
          expect(lines, `step ${i + 1}: ${lines.join("; ")}`).toEqual([]);
        }
      }, 60_000);
    });
  }
});
