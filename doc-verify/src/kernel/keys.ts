/**
 * One place that reconciles kernel atom keys with OracleStore / Demand keys.
 */

import type { Oracle, Program } from "../engine/checker.js";
import type { Demand } from "../engine/demand.js";
import { atomText, oracleAtomKey } from "../engine/demand.js";
import type { OracleStore } from "../engine/oracles.js";
import { readCanonical, termText, type Term } from "../engine/terms.js";

/** Strip a '~w'-quoted functor so kernel keys match `oracleAtomKey`. */
export function normalizeAtomKey(key: string): string {
  const m = /^'((?:\\'|[^'])*)'\((.*)\)$/s.exec(key);
  if (m) return `${(m[1] as string).replace(/\\'/g, "'")}(${m[2]})`;
  return key;
}

/** `mod.pred` display form → `mod::pred` (one module/name split). */
function predicateKey(functor: string): string {
  if (functor.includes("::")) return functor;
  const dot = functor.indexOf(".");
  return dot < 0 ? functor : `${functor.slice(0, dot)}::${functor.slice(dot + 1)}`;
}

/**
 * Rebuild the host OracleStore key from a kernel demand / proof key
 * (`mod::pred(args)` or display `mod.pred(args)`, any quoting the reader accepts).
 */
export function hostAtomKey(key: string): string {
  const k = normalizeAtomKey(key);
  const open = k.indexOf("(");
  if (open < 0) return predicateKey(k);
  const pred = predicateKey(k.slice(0, open));
  const { inputs } = parseAtomKey(`${pred}${k.slice(open)}`);
  return oracleAtomKey(pred, inputs);
}

/** Host diagnostics form: `mod.pred(a, b)` with termText args (design 04 atomText). */
export function displayAtomKey(key: string): string {
  const k = normalizeAtomKey(key);
  try {
    const open = k.indexOf("(");
    if (open < 0) return predicateKey(k).replace("::", ".");
    const pred = predicateKey(k.slice(0, open));
    const { inputs } = parseAtomKey(`${pred}${k.slice(open)}`);
    return atomText(pred, inputs);
  } catch {
    return k.replaceAll("::", ".");
  }
}

/** Kernel literal text → host display (`core.heading(...)`, `x in [y, z]`, …). */
export function displayLiteral(text: string): string {
  const t = text.trim();
  if (t.startsWith("not ")) return `not ${displayLiteral(t.slice(4))}`;
  const inn = /^(.+) in (.+)$/s.exec(t);
  if (inn) {
    try {
      const item = readCanonical(inn[1] as string);
      const list = readCanonical(inn[2] as string);
      return `${termText(item)} in ${termText(list)}`;
    } catch {
      return `${(inn[1] as string).replaceAll("::", ".")} in ${(inn[2] as string).replaceAll("::", ".")}`;
    }
  }
  if (/^[A-Za-z_][\w:.]*/.test(t) && t.includes("(")) return displayAtomKey(t);
  return t.replaceAll("::", ".");
}

/** OracleStore leaves → kernel answer state (label includes `unknown`). */
export function answersFromStore(store: OracleStore): Record<string, string> {
  const answers: Record<string, string> = {};
  for (const [key, leaf] of store.leaves) {
    answers[key] = leaf.label;
  }
  return answers;
}

/**
 * Parse a kernel demand key `mod::pred(args)` into predicate + input Terms.
 * Args are Prolog canonical text (the same shape writeTerm / core_arg_text emit).
 */
export function parseAtomKey(key: string): { predicate: string; inputs: Term[] } {
  const open = key.indexOf("(");
  if (open < 0) return { predicate: key, inputs: [] };
  const predicate = key.slice(0, open);
  const inner = key.slice(open + 1, key.endsWith(")") ? -1 : key.length);
  if (inner === "") return { predicate, inputs: [] };
  const wrapped = readCanonical(`x(${inner})`);
  if (wrapped.kind !== "compound") throw new Error(`atom key args: ${key}`);
  return { predicate, inputs: wrapped.args };
}

/** Kernel demand keys → Demand objects for askRound (prefix policy by default). */
export function demandsFromKeys(keys: string[], program: Program): Demand[] {
  const byPred = new Map(program.oracles.map((o) => [o.predicate, o]));
  const out: Demand[] = [];
  for (const raw of keys) {
    const key = normalizeAtomKey(raw);
    const { predicate, inputs } = parseAtomKey(key);
    const oracle = byPred.get(predicate);
    if (oracle === undefined) continue;
    // Prefer the host key so store.lookup and setAnswers stay aligned.
    const hostKey = oracleAtomKey(oracle.predicate, inputs);
    out.push({
      key: hostKey,
      atom: atomText(oracle.predicate, inputs),
      oracle,
      inputs,
    });
  }
  return out;
}

export function findOracle(program: Program, predicate: string): Oracle | undefined {
  return program.oracles.find((o) => o.predicate === predicate);
}
