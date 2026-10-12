// subject-ts.mjs - subject S2: the TypeScript evaluator of design 04, driven over a witness.
//
// Route: the DIRECT one. `evaluate(program, facts, view)` from doc-verify/dist/engine/evaluate.js
// is called with the witness's facts as Terms (functor `core::section`, ...) and an OracleView
// whose lookup returns the witness's answer for `oracleAtomKey(predicate, inputs)`. No markdown is
// synthesised and runProgram/askRound are not used, so no judge request is built; the demand set
// is `evaluation.demands` (the atoms the evaluator would ask this round: its prefix `settled`
// rule). Statuses come from `evaluation.constraints[].bindings[].status`; the verdict from the
// evaluator's own `decideVerdict` over its own constraint-level aggregation (violated >
// undetermined > satisfied, nonempty empty population = violated, as diagnostics.ts does).
// The program is compiled by the evaluator's own `compileModule` (with its checker): a module the
// checker refuses is S2's `rejected`.
import { compileModule } from "../../../../doc-verify/dist/engine/index.js";
import { evaluate, oracleAtomKey } from "../../../../doc-verify/dist/engine/evaluate.js";
import { decideVerdict } from "../../../../doc-verify/dist/engine/diagnostics.js";
import { readCanonical, writeTerm, termText, listItems } from "../../../../doc-verify/dist/engine/terms.js";
import { parseFactText } from "./translate.mjs";

/** `w::o(d,a)` -> the evaluator's canonical key (predicate + writeTerm'd inputs). */
export function canonicalKey(key) {
  const open = key.indexOf("(");
  if (open < 0) return key;
  const args = readCanonical(`x${key.slice(open)}`).args;
  return oracleAtomKey(key.slice(0, open), args);
}

/** Compiles once per witness; returns a step function, or { rejected } when the checker refuses. */
export async function prepareS2(moduleText, factTexts) {
  let program;
  try {
    program = await compileModule(moduleText);
  } catch (error) {
    return { rejected: String(error.message ?? error) };
  }
  const facts = (factTexts ?? []).map(parseFactText);
  return { program, step: (answers) => evaluateS2(program, facts, answers) };
}

export function evaluateS2(program, facts, answers) {
  const table = new Map(Object.entries(answers ?? {}).map(([k, v]) => [canonicalKey(k), { label: String(v) }]));
  const view = { lookup: (key) => table.get(key) };
  let evaluation;
  try {
    evaluation = evaluate(program, facts, view);
  } catch (error) {
    return { rejected: `evaluate threw: ${String(error.message ?? error)}` };
  }
  const statuses = {}, missing = {};
  const levels = [];
  for (const result of evaluation.constraints) {
    const c = result.constraint;
    const rows = result.bindings.map((b) => ({ ...Object.fromEntries([...b.env].map(([n, v]) => [n, plainText(v)])), status: b.status }));
    if (c.nonempty && rows.length === 0) rows.push({ population: "empty", status: "violated" });
    statuses[c.id] = rows;
    for (const b of result.bindings) {
      if (b.status === "violated" && c.mode === "require") {
        (missing[c.id] ??= []).push(...b.missing.map((m) => ({
          ...Object.fromEntries([...b.env].map(([n, v]) => [n, plainText(v)])),
          literal: modelText(m.literal),
        })));
      }
    }
    const level = rows.some((r) => r.status === "violated") ? "violated" : rows.some((r) => r.status === "undetermined") ? "undetermined" : "satisfied";
    levels.push({ id: c.id, status: level, severity: c.severity, weight: c.weight });
  }
  const { verdict } = decideVerdict(levels, undefined, program.warningThreshold);
  const asked = [...evaluation.demands.keys()].sort();
  return { statuses, demand: { prefix: asked, full: undefined }, verdict, missing };
}

/** The evaluator's literal text (`w.o(d, b)`) in the witness syntax (`w::o(d,b)`). */
function modelText(text) {
  return text.replace(/\b([a-z][\w-]*)\.([a-z]\w*)\(/g, "$1::$2(").replace(/,\s+/g, ",")
    .replace(/dv_interval\((-?\d+),(-?\d+)\)/g, "$1..$2")
    .replace(/^(\S+) (<|>|=<|>=|=:=|=\\=) (\S+)$/, "$1$2$3");
}
void writeTerm;

/** A binding value as the witness writes it: atom name, number, list `[a,b]` without spaces. */
function plainText(t) {
  const items = listItems(t);
  if (t.kind === "compound" && items !== undefined) return `[${items.map(plainText).join(",")}]`;
  return termText(t);
}
