/**
 * Round 5 trust-boundary seeds (run-boundary.mjs --gate --budget).
 * Expect columns are the recorded outcomes after the 2026-10-13 corrections.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import YAML from "yaml";

import {
  compileWitnessModule,
  parseFactText,
  translateProgram,
  translateWitness,
  type FactTerm,
  type TranslateProgram,
} from "../../src/kernel/index.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WITNESS_DIR = path.join(HERE, "witnesses");

export type Outcome = "ran" | "error" | "rejected" | "BLOCKED" | "resource" | "hang";
export type Candidate = "T1" | "T2b" | "T2";

export const SEEDS: Array<{
  id: string;
  expect: Record<Candidate, Outcome>;
}> = [
  { id: "E1", expect: { T1: "rejected", T2b: "ran", T2: "rejected" } },
  { id: "E2", expect: { T1: "rejected", T2b: "error", T2: "rejected" } },
  { id: "E3", expect: { T1: "rejected", T2b: "error", T2: "rejected" } },
  { id: "E4", expect: { T1: "rejected", T2b: "ran", T2: "rejected" } },
  { id: "E8", expect: { T1: "rejected", T2b: "error", T2: "rejected" } },
  { id: "E9", expect: { T1: "rejected", T2b: "ran", T2: "rejected" } },
  { id: "E10", expect: { T1: "rejected", T2b: "rejected", T2: "rejected" } },
  { id: "E13", expect: { T1: "rejected", T2b: "ran", T2: "rejected" } },
  { id: "E14", expect: { T1: "rejected", T2b: "ran", T2: "rejected" } },
  { id: "E5", expect: { T1: "resource", T2b: "resource", T2: "resource" } },
  { id: "E6", expect: { T1: "ran", T2b: "ran", T2: "ran" } },
  { id: "E15", expect: { T1: "hang", T2b: "BLOCKED", T2: "BLOCKED" } },
  { id: "E16", expect: { T1: "ran", T2b: "ran", T2: "ran" } },
  { id: "E17", expect: { T1: "rejected", T2b: "ran", T2: "rejected" } },
  { id: "E18", expect: { T1: "ran", T2b: "BLOCKED", T2: "BLOCKED" } },
  { id: "E19", expect: { T1: "resource", T2b: "BLOCKED", T2: "BLOCKED" } },
];

export const CANDIDATES: Record<Candidate, { sandbox: boolean; budget: boolean }> = {
  T1: { sandbox: true, budget: false },
  T2b: { sandbox: false, budget: true },
  T2: { sandbox: true, budget: true },
};

/** Recorded B from round-5-budget.txt (K=20 × corpus max 43847). */
export const BUDGET = 876_940;
export const ESCAPE = "/tmp/dv-escape";
// A loop with no budget that has not returned in 4 s is classified `hang` (round 5 used 20 s; the
// verdict does not depend on the length, and every bounded cell finishes in under 2.5 s).
export const HANG_TIMEOUT_MS = 4_000;

const MATCH_MODULE = `schema_version: 2
kind: verification-module
module: w
rounds: 1
imports: {core: doc-verify:core}
rules:
  bad(D, S): core.section(D, S, _), core.heading(D, S, H), matches(H, '^(a+)+$')
constraints:
  c1: {forall: "core.section(D, S, _)", forbid: "bad(D, S)", severity: error}
`;
const MATCH_FACTS = ["section(d, a, root)", `heading(d, a, '${"a".repeat(30)}b')`, "depth(d, a, 1)"].map(parseFactText);

const countModule = (nested: boolean) => `schema_version: 2
kind: verification-module
module: w
rounds: 1
imports: {core: doc-verify:core}
rules:
  big(D, N): core.section(D, _, _), count(S, (core.section(D, S, _), core.section(D, T, _), core.section(D, U, _), core.section(D, V, _)), N)
${nested ? "  big2(D, M): core.section(D, _, _), count(W, (big(D, _), core.section(D, W, _), core.section(D, X, _)), M)" : ""}
constraints:
  c1: {forall: "core.section(D, S, _)", require: "${nested ? "big2(D, M), M > 0" : "big(D, N), N > 0"}", severity: error}
`;

export function loadCorpusFacts(): Record<string, FactTerm[]> {
  const byDoc: Record<string, FactTerm[]> = {};
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

function sectionCount(facts: FactTerm[]) {
  return facts.filter((f) => f.functor === "core::section").length;
}

function biggestCorpusDoc(byDoc: Record<string, FactTerm[]>): [string, number] {
  const ranked = Object.entries(byDoc)
    .map(([d, f]) => [d, sectionCount(f)] as const)
    .sort((a, b) => b[1] - a[1]);
  const top = ranked[0];
  if (top === undefined) throw new Error("corpus facts empty");
  return [top[0], top[1]];
}

export const SEED_SUFFIX: Record<string, string> = {
  E15: "\n'w::loopx' :- 'w::loopx'.\n",
  E17: "\n'w::loopx' :- 'w::loopx'.\n",
  E19: "\n'w::deep'(0).\n'w::deep'(N) :- N > 0, N1 is N - 1, 'w::deep'(N1), true.\n",
};

export async function buildSeed(
  id: string,
  byDoc: Record<string, FactTerm[]>,
): Promise<{ text: string; program: TranslateProgram; answers: Record<string, string> }> {
  const base = await translateWitness(
    YAML.parse(readFileSync(path.join(WITNESS_DIR, "policy-invariance.yaml"), "utf8")) as {
      module: string;
      facts?: string[];
    },
  );
  const reach = (payload: string) => ({
    text: `${base.text}\n'w::first'(_V_D,_V_S) :- core_section(_V_D,_V_S,_), ${payload}.\n`,
    program: base.program,
    answers: {},
  });
  switch (id) {
    case "E1":
      return reach("open('/tmp/dv-escape', write, St), close(St)");
    case "E2":
      return reach("shell('touch /tmp/dv-escape')");
    case "E3":
      return reach("http_open('http://example.invalid/', St, [])");
    case "E4":
      return reach("getenv('HOME', _)");
    case "E8": {
      const text = `${base.text}\n:- use_module(library(wasm)).\n'w::first'(_V_D,_V_S) :- core_section(_V_D,_V_S,_), (_ := eval("require('fs').writeFileSync('/tmp/dv-escape','x')") ; true).\n`;
      return { text, program: base.program, answers: {} };
    }
    case "E9":
      return reach("core_count(_V, open('/tmp/dv-escape', write, _), _N)");
    case "E10":
      return {
        text: `${base.text}\n'w::first'(_V_D,_V_S) :- core_section(_V_D,_V_S,_), core_naf(open('/tmp/dv-escape', write, _)).\n'w::first'(_V_D,_V_S) :- core_section(_V_D,_V_S,_), core_tnot(open('/tmp/dv-escape', write, _)).\n`,
        program: base.program,
        answers: {},
      };
    case "E13":
      return { text: `${base.text}\n:- open('/tmp/dv-escape', write, _).\n`, program: base.program, answers: {} };
    case "E14": {
      const text = base.text.replace(
        /(core_forall\([^\n]*?:- )(.*?)(\.\n)/,
        `$1$2, open('/tmp/dv-escape', write, _)$3`,
      );
      return { text, program: base.program, answers: {} };
    }
    case "E5": {
      const m = await compileWitnessModule(MATCH_MODULE);
      return { text: translateProgram(m.program, MATCH_FACTS), program: m.program, answers: {} };
    }
    case "E6": {
      const [doc] = biggestCorpusDoc(byDoc);
      const m = await compileWitnessModule(countModule(false));
      return { text: translateProgram(m.program, byDoc[doc] as FactTerm[]), program: m.program, answers: {} };
    }
    case "E15":
      return reach("'w::loopx'");
    case "E16": {
      const [doc] = biggestCorpusDoc(byDoc);
      const m = await compileWitnessModule(countModule(true));
      return { text: translateProgram(m.program, byDoc[doc] as FactTerm[]), program: m.program, answers: {} };
    }
    case "E17":
      return reach("catch('w::loopx', _, true)");
    case "E18":
      return reach("numlist(1, 20000000, L), length(L, _)");
    case "E19":
      return reach("'w::deep'(10000000)");
    default:
      throw new Error(`unknown seed ${id}`);
  }
}
