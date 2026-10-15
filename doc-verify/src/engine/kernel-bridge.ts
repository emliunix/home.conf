/**
 * Build EngineReport constraint rows from a KernelReport (design 06 seam).
 */

import type { Constraint, Program } from "./checker.js";
import type { BindingStatus, Mode } from "./demand.js";
import type { BindingReport, ConstraintReport, ProofNode, ProofOracle } from "./diagnostics.js";
import type { OracleStore } from "./oracles.js";
import { termText, type Term } from "./terms.js";
import { readCanonical } from "./terms.js";
import type { KernelReport, MissingRow, StatusRow } from "../kernel/kernel.js";
import { displayLiteral, hostAtomKey, normalizeAtomKey } from "../kernel/keys.js";

function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (match, name: string) => values[name] ?? match);
}

function paramTexts(params: Record<string, Term>): Record<string, string> {
  return Object.fromEntries(Object.entries(params).map(([name, value]) => [name, termText(value)]));
}

function literalsText(constraint: Constraint, which: "forall" | "goal"): string {
  const text = which === "forall" ? constraint.source.forall : constraint.source.require ?? constraint.source.forbid ?? "";
  return which === "goal" && constraint.mode === "forbid" ? `not (${text})` : text;
}

function valuesKey(values: Record<string, string>): string {
  return Object.keys(values)
    .sort()
    .map((k) => `${k}=${values[k]}`)
    .join("\0");
}

function rowValues(row: StatusRow | MissingRow | Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(row)) {
    if (k === "status" || k === "population" || k === "literal" || k === "path" || k === "passed_u" || k === "atom") continue;
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

function isCertain(report: KernelReport, id: string, values: Record<string, string>): boolean {
  const key = valuesKey(values);
  return (report.certain[id] ?? []).some((r) => valuesKey(r) === key);
}

function proofOracle(store: OracleStore, key: string): ProofOracle | undefined {
  let host: string;
  try {
    host = hostAtomKey(key);
  } catch {
    host = normalizeAtomKey(key);
  }
  const leaf = store.leaves.get(host) ?? store.leaves.get(normalizeAtomKey(key)) ?? store.leaves.get(key);
  if (leaf === undefined) return undefined;
  return {
    key: leaf.key,
    atom: leaf.atom,
    question: leaf.question,
    sections: leaf.sections,
    bytes: leaf.bytes,
    label: leaf.label,
    answered: leaf.answered,
    options: leaf.options,
    distribution: leaf.distribution,
    threshold: leaf.threshold,
    round: leaf.round,
    cacheHit: leaf.cacheHit,
    ...(leaf.finding === undefined ? {} : { finding: leaf.finding }),
    ...(leaf.span === undefined ? {} : { span: leaf.span }),
  };
}

function mapMode(t: Term): Mode {
  return t.kind === "atom" && t.name === "certain" ? "certain" : "possible";
}

function mapKids(term: Term, store: OracleStore): ProofNode[] {
  if (term.kind !== "compound" || term.functor !== "." && term.functor !== "[]") {
    // SWI lists as ./2
  }
  const items: Term[] = [];
  let cursor: Term = term;
  for (;;) {
    if (cursor.kind === "atom" && cursor.name === "[]") break;
    if (cursor.kind === "compound" && cursor.functor === "." && cursor.args.length === 2) {
      items.push(cursor.args[0] as Term);
      cursor = cursor.args[1] as Term;
      continue;
    }
    break;
  }
  return items.map((t) => mapNode(t, store));
}

function atomOf(t: Term): string {
  // Match evaluate's atomText / termText display (core.child, spaced args, unquoted atoms).
  const raw = t.kind === "atom" ? t.name : t.kind === "string" ? t.value : termText(t);
  return displayLiteral(raw);
}

function mapNode(term: Term, store: OracleStore): ProofNode {
  if (term.kind !== "compound") return { kind: "builtin", atom: atomOf(term) };
  switch (term.functor) {
    case "fact":
      return { kind: "fact", atom: atomOf(term.args[0] as Term) };
    case "builtin":
      return { kind: "builtin", atom: atomOf(term.args[0] as Term) };
    case "oracle": {
      const raw = term.args[0] as Term;
      const rawKey = raw.kind === "atom" ? raw.name : raw.kind === "string" ? raw.value : termText(raw);
      const oracle = proofOracle(store, rawKey);
      return oracle === undefined
        ? { kind: "unasked", atom: displayLiteral(rawKey) }
        : { kind: "oracle", atom: oracle.atom, oracle };
    }
    case "unasked":
      return { kind: "unasked", atom: atomOf(term.args[0] as Term) };
    case "not":
      return { kind: "not", atom: `not ${atomOf(term.args[0] as Term)}`, children: [mapNode(term.args[0] as Term, store)] };
    case "missing": {
      const lit = atomOf(term.args[0] as Term);
      const kids = term.args.length >= 2 ? mapKids(term.args[1] as Term, store) : [];
      return kids.length > 0
        ? { kind: "missing", atom: `${lit} is not possible`, mode: "possible", children: kids }
        : { kind: "missing", atom: `${lit} is not possible`, mode: "possible" };
    }
    case "rule": {
      const atom = atomOf(term.args[0] as Term);
      const rule = atomOf(term.args[1] as Term);
      const kids = mapKids(term.args[2] as Term, store);
      return rule === ""
        ? { kind: "rule", atom, children: kids }
        : { kind: "rule", atom, rule, children: kids };
    }
    case "forall":
      return { kind: "forall", atom: "forall", mode: mapMode(term.args[0] as Term), children: mapKids(term.args[1] as Term, store) };
    case "goal":
      return { kind: "goal", atom: "goal", mode: mapMode(term.args[0] as Term), children: mapKids(term.args[1] as Term, store) };
    default:
      return { kind: "builtin", atom: atomOf(term) };
  }
}

function mapProofTree(canon: string, constraint: Constraint, store: OracleStore, status: BindingStatus): ProofNode {
  const empty = (note: string): ProofNode => ({
    kind: "binding",
    atom: `${constraint.id}: ${status}`,
    children: [{ kind: "builtin", atom: note }],
  });
  if (canon === "") {
    return empty("proof could not be built");
  }
  try {
    const term = readCanonical(canon);
    if (term.kind !== "compound" || term.functor !== "tree" || term.args.length < 3) {
      return empty("proof could not be built");
    }
    const forallT = term.args[0] as Term;
    const goalT = term.args[1] as Term;
    const missT = term.args[2] as Term;
    const children: ProofNode[] = [];
    if (forallT.kind === "compound" && forallT.functor === "forall") {
      children.push({
        kind: "forall",
        atom: literalsText(constraint, "forall"),
        mode: mapMode(forallT.args[0] as Term),
        children: mapKids(forallT.args[1] as Term, store),
      });
    }
    if (goalT.kind === "compound" && goalT.functor === "goal") {
      const kids = mapKids(goalT.args[1] as Term, store);
      if (kids.length > 0 || status !== "violated") {
        children.push({
          kind: "goal",
          atom: literalsText(constraint, "goal"),
          mode: mapMode(goalT.args[0] as Term),
          children: kids,
        });
      }
    }
    for (const m of mapKids(missT, store)) {
      children.push(m);
    }
    return { kind: "binding", atom: `${constraint.id}: ${status}`, children };
  } catch {
    return empty("proof could not be built");
  }
}

/** ConstraintReport[] from a finished kernel evaluation. */
export function constraintReportsFromKernel(
  program: Program,
  report: KernelReport,
  store: OracleStore,
): ConstraintReport[] {
  return program.constraints.map((constraint) => {
    const id = constraint.id;
    const statusRows = report.statuses[id] ?? [];
    const bindings: BindingReport[] = [];
    for (const srow of statusRows) {
      if (srow.population !== undefined) {
        // nonempty population row → synthetic violated/undetermined binding (diagnostics shape)
        if (srow.population === "empty" || srow.status === "violated") {
          bindings.push({
            status: "violated",
            certain: true,
            values: {},
            message: `${id}: the population is empty (population: nonempty)`,
            repair: constraint.repair === undefined ? undefined : fill(constraint.repair, paramTexts(program.params)),
            missing: [],
            proof: {
              kind: "binding",
              atom: `${id}: violated`,
              children: [{ kind: "missing", atom: `${literalsText(constraint, "forall")} binds nothing`, mode: "possible" }],
            },
          });
        } else {
          bindings.push({
            status: "undetermined",
            certain: false,
            values: {},
            message: `${id}: the population is undetermined (population: nonempty)`,
            repair: undefined,
            missing: [],
            proof: { kind: "binding", atom: `${id}: undetermined`, children: [] },
          });
        }
        continue;
      }
      const values = rowValues(srow);
      const status = srow.status as BindingStatus;
      const certain = isCertain(report, id, values);
      const miss = (report.missing[id] ?? [])
        .filter((m) => valuesKey(rowValues(m)) === valuesKey(values))
        .map((m) => displayLiteral(m.literal));
      const proofRow = (report.proofs[id] ?? []).find((p) => valuesKey(p.values) === valuesKey(values));
      const templateValues = { ...paramTexts(program.params), ...values };
      const proof = mapProofTree(proofRow?.tree ?? "", constraint, store, status);
      // Attach missing nodes if the tree omitted them
      if (miss.length > 0 && !(proof.children ?? []).some((c) => c.kind === "missing")) {
        proof.children = [
          ...(proof.children ?? []),
          ...miss.map((literal) => ({ kind: "missing" as const, atom: `${literal} is not possible`, mode: "possible" as const })),
        ];
      }
      bindings.push({
        status,
        certain,
        values,
        message:
          constraint.message === undefined
            ? `${id} is ${status} for ${Object.entries(values).map(([n, v]) => `${n}=${v}`).join(", ")}`
            : fill(constraint.message, templateValues),
        repair: constraint.repair === undefined ? undefined : fill(constraint.repair, templateValues),
        missing: miss,
        proof,
      });
    }
    const status: BindingStatus = bindings.some((b) => b.status === "violated")
      ? "violated"
      : bindings.some((b) => b.status === "undetermined")
        ? "undetermined"
        : "satisfied";
    const pop = report.populations[id];
    const realBindings = bindings.filter((b) => Object.keys(b.values).length > 0 || b.message.includes("population"));
    return {
      id,
      status,
      severity: constraint.severity,
      weight: constraint.weight,
      mode: constraint.mode,
      population: pop?.possible ?? statusRows.filter((r) => r.population === undefined).length,
      certainPopulation: pop?.certain ?? bindings.filter((b) => b.certain && Object.keys(b.values).length > 0).length,
      bindings: realBindings.length > 0 ? bindings : bindings,
    };
  });
}
