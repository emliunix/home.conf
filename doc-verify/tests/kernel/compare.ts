/**
 * Conformance comparison from worklog/kernel-trials/probe/run-conformance.mjs (S1).
 * Mismatch lines `field: expected X got Y` of one result against one expect.
 */

import type { KernelReport } from "../../src/kernel/index.js";

export type Expect = {
  rejected?: boolean | string;
  statuses?: Record<string, Array<Record<string, unknown>>>;
  demand?: { full?: string[]; prefix?: string[] };
  verdict?: string;
  missing?: Record<string, Array<Record<string, unknown>>>;
  findings?: Array<Record<string, unknown>>;
  unfounded?: Record<string, Array<Record<string, unknown>>>;
};

const canon = (row: Record<string, unknown>, keys?: string[]) =>
  JSON.stringify(
    (keys ?? Object.keys(row))
      .filter((k) => row[k] !== undefined)
      .sort()
      .map((k) => [k, Array.isArray(row[k]) ? (row[k] as unknown[]).map(String) : String(row[k])]),
  );

const sameSet = (
  a: unknown[] = [],
  b: unknown[] = [],
  keysOf?: (r: Record<string, unknown>) => string[],
) => {
  const x = a.map((r) => (typeof r === "string" ? r : canon(r as Record<string, unknown>, keysOf?.(r as Record<string, unknown>)))).sort();
  const y = b.map((r) => (typeof r === "string" ? r : canon(r as Record<string, unknown>, keysOf?.(r as Record<string, unknown>)))).sort();
  return x.length === y.length && x.every((v, i) => v === y[i]);
};

const show = (v: unknown) => JSON.stringify(v);

/** Mismatch lines of one result against one expect (S1). */
export function compare(expect: Expect, got: KernelReport): string[] {
  const out: string[] = [];
  if (expect.rejected !== undefined || got.rejected !== undefined) {
    if (!expect.rejected !== !got.rejected) out.push(`rejected: expected ${show(expect.rejected ?? false)} got ${show(got.rejected ?? false)}`);
    if (expect.rejected || got.rejected) return out;
  }
  for (const id of new Set([...Object.keys(expect.statuses ?? {}), ...Object.keys(got.statuses)])) {
    if (!sameSet(expect.statuses?.[id], got.statuses[id])) {
      out.push(`statuses.${id}: expected ${show(expect.statuses?.[id])} got ${show(got.statuses[id])}`);
    }
  }
  for (const policy of ["full", "prefix"] as const) {
    const expDemand = expect.demand?.[policy];
    if (expDemand === undefined) continue;
    if (!sameSet(expDemand, got.demand[policy])) {
      out.push(`demand.${policy}: expected ${show(expDemand)} got ${show(got.demand[policy])}`);
    }
  }
  if (expect.verdict !== undefined && expect.verdict !== got.verdict) {
    out.push(`verdict: expected ${expect.verdict} got ${got.verdict}`);
  }
  if (expect.missing !== undefined) {
    for (const id of new Set([...Object.keys(expect.missing), ...Object.keys(got.missing)])) {
      const exp = expect.missing[id] ?? [];
      const optional = ["path", "passed_u"].filter((k) => exp.some((r) => r[k] !== undefined));
      const keysOf = (r: Record<string, unknown>) =>
        Object.keys(r).filter((k) => !["note", "status"].includes(k) && (!["path", "passed_u"].includes(k) || optional.includes(k)));
      const gotRows = (got.missing[id] ?? []).map((r) =>
        Object.fromEntries(Object.entries(r).filter(([k]) => !["path", "passed_u"].includes(k) || optional.includes(k))),
      );
      if (!sameSet(exp, gotRows, keysOf)) out.push(`missing.${id}: expected ${show(exp)} got ${show(got.missing[id] ?? [])}`);
    }
  }
  const expUnfounded = Array.isArray(expect.findings)
    ? expect.findings
        .filter((f) => f.kind === "unfounded")
        .reduce<Record<string, Array<Record<string, unknown>>>>((acc, f) => {
          const { kind: _k, constraint, ...rest } = f;
          void _k;
          const id = String(constraint);
          (acc[id] ??= []).push(rest);
          return acc;
        }, {})
    : expect.unfounded;
  if (expUnfounded !== undefined) {
    for (const id of new Set([...Object.keys(expUnfounded), ...Object.keys(got.unfounded)])) {
      if (!sameSet(expUnfounded[id] ?? [], got.unfounded[id] ?? [])) {
        out.push(`unfounded.${id}: expected ${show(expUnfounded[id] ?? [])} got ${show(got.unfounded[id] ?? [])}`);
      }
    }
  }
  return out;
}
