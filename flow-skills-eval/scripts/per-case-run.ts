/**
 * Per-case L1 run (design 11 unit 5, interim): every full-profile case, `k/n` per case,
 * graded as the eval grades (design 10's status rule), first miss shown. The committed
 * TSVs under worklog/ were made by this script. Usage:
 *   CASES=<id-prefix,...> node scripts/per-case-run.ts <repeats>
 */
import { runDecisionCase } from "../src/eval/agent.ts";
import { readApiConfig } from "../src/eval/env.ts";
import { casesForProfile, fixtureStatus } from "../src/eval/cases.ts";
import { compareDecision, normalizeDecision } from "../src/eval/decisions.ts";
import { FROZEN_EVALUATION_CONTEXT, createFrozenPrompt } from "../src/eval/prompt.ts";

const frozen = createFrozenPrompt(FROZEN_EVALUATION_CONTEXT);
const config = readApiConfig(process.env as Record<string, string>);
const only = (process.env.CASES ?? "").split(",").filter(Boolean);
const cases = casesForProfile("full").filter((c) => only.length === 0 || only.some((o) => c.id.startsWith(o)));
const repeats = Number(process.argv[2] ?? "1");
const rows = await Promise.all(
  cases.flatMap((c) =>
    Array.from({ length: repeats }, async () => {
      try {
        const r = await runDecisionCase(frozen, c, config);
        const g = normalizeDecision(r.decision, fixtureStatus(c.fixture)); const diff = compareDecision(c.expected, g);
        return { id: c.id, ok: diff.matched, diff: [...diff.divergedFields], got: g };
      } catch (e) {
        return { id: c.id, ok: false, diff: ["error"], got: String(e).slice(0, 100) };
      }
    }),
  ),
);
const byId = new Map<string, { pass: number; n: number; samples: unknown[] }>();
for (const r of rows) {
  const e = byId.get(r.id) ?? { pass: 0, n: 0, samples: [] };
  e.n++; if (r.ok) e.pass++; else e.samples.push({ diff: r.diff, got: r.got });
  byId.set(r.id, e);
}
for (const c of cases) {
  const e = byId.get(c.id)!;
  const exp = c.expected;
  const s = e.samples[0] as { diff: string[]; got: Record<string, unknown> } | undefined;
  console.log(`${e.pass}/${e.n}\t${c.id}\texp=${exp.next_action},${exp.status_to_set},${exp.write_target},${exp.opens_new_design}` +
    (s ? `\tgot=${typeof s.got === "string" ? s.got : [s.got.next_action, s.got.status_to_set, s.got.write_target, s.got.opens_new_design].join(",")}` : ""));
}
const total = rows.filter((r) => r.ok).length;
console.log(`TOTAL ${total}/${rows.length}`);
