// Minimality neighbourhood (round-7 plan §Minimality), independent of the shrinker: the shrinker
// is fast-check's (raw-record moves, run-property.mjs); this neighbourhood is AST-level and is
// used only to check its output.
import { atomSize, isValid } from "./generator.mjs";

/** The plan's neighbourhood: one deletion, one `not` flipped, one `unknown` weakened, one `choose` narrowed. */
export function* neighbours(g) {
  for (let i = 0; i < g.rules.length; i++) yield { ...g, rules: g.rules.filter((_, j) => j !== i), _via: `delete rule ${i}` };
  for (let i = 0; i < g.oracles.length; i++) yield { ...g, oracles: g.oracles.filter((_, j) => j !== i), _via: `delete oracle ${g.oracles[i]}` };
  if (g.choose) yield { ...g, choose: null, _via: "delete choose oracle" };
  for (let i = 0; i < g.constraints.length; i++) yield { ...g, constraints: g.constraints.filter((_, j) => j !== i), _via: `delete constraint ${g.constraints[i].id}` };
  for (let i = 0; i < g.sections.length; i++) yield { ...g, sections: g.sections.filter((_, j) => j !== i), _via: `delete section ${g.sections[i]}` };
  for (let i = 0; i < g.selected.length; i++) yield { ...g, selected: g.selected.filter((_, j) => j !== i), _via: `delete selected ${g.selected[i]}` };
  for (const a of Object.keys(g.ans)) {
    const ans = { ...g.ans }; delete ans[a];
    yield { ...g, ans, _via: `delete answer ${a}` };
  }
  for (let ri = 0; ri < g.rules.length; ri++) {
    const ru = g.rules[ri];
    if (ru.special) continue;
    for (let li = 0; li < ru.body.length; li++) {
      yield { ...g, rules: g.rules.map((r, i) => (i === ri ? { ...r, body: r.body.filter((_, j) => j !== li) } : r)), _via: `delete literal ${li} of rule ${ri}` };
    }
  }
  for (let ci = 0; ci < g.constraints.length; ci++) {
    const c = g.constraints[ci];
    for (const part of ["forall", "goal"]) {
      for (let li = 0; li < c[part].length; li++) {
        yield { ...g, constraints: g.constraints.map((x, i) => (i === ci ? { ...x, [part]: x[part].filter((_, j) => j !== li) } : x)), _via: `delete ${part} literal ${li} of ${c.id}` };
      }
    }
  }
  for (let ri = 0; ri < g.rules.length; ri++) {
    const ru = g.rules[ri];
    if (ru.special) continue;
    for (let li = 0; li < ru.body.length; li++) {
      if (!ru.body[li].neg) continue;
      yield { ...g, rules: g.rules.map((r, i) => (i === ri ? { ...r, body: r.body.map((l, j) => (j === li ? { ...l, neg: false } : l)) } : r)), _via: `flip not ${li} of rule ${ri}` };
    }
  }
  for (let ci = 0; ci < g.constraints.length; ci++) {
    const c = g.constraints[ci];
    for (let li = 0; li < c.goal.length; li++) {
      if (!c.goal[li].neg) continue;
      yield { ...g, constraints: g.constraints.map((x, i) => (i === ci ? { ...x, goal: x.goal.map((l, j) => (j === li ? { ...l, neg: false } : l)) } : x)), _via: `flip not ${li} of ${c.id}` };
    }
  }
  for (const [a, v] of Object.entries(g.ans)) {
    if (v !== "unknown") continue;
    const ans = { ...g.ans }; delete ans[a];
    yield { ...g, ans, _via: `weaken unknown ${a}` };
  }
  if (g.choose && g.choose.labels.length > 2) {
    yield { ...g, choose: { ...g.choose, labels: g.choose.labels.slice(0, 2) }, _via: "narrow choose to two labels" };
  }
}

/**
 * Minimal iff no VALID neighbour still fails. `fails(g)` -> true | false | "skip" (the subject
 * rejected the neighbour: counted with the invalid ones, never read as "no longer fails").
 */
export async function checkMinimal(g, fails) {
  let skipped = 0, tried = 0;
  for (const n of neighbours(g)) {
    const v = isValid(n);
    if (!v.ok) { skipped += 1; continue; }
    let r;
    try { r = await fails(v.g); } catch { r = "skip"; }
    if (r === "skip") { skipped += 1; continue; }
    tried += 1;
    if (r === true) return { minimal: false, skipped, tried, size: atomSize(g), via: n._via, neighbour: v.g };
  }
  return { minimal: true, skipped, tried, size: atomSize(g) };
}
