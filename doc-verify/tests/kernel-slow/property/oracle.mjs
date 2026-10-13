// Independent oracles for round 7 (share no code with reference.mjs, core.pl, subject-clingo.mjs).
//   - two-valued evaluation of one total completion: stratified (anc by least fixpoint, then
//     p1 < p2 < p3; the loop atoms, if any, fixed by the caller);
//   - enumeration over completions (loop-free programs) and stable models (loop programs): every
//     completion of the leaves x every stable assignment of the loop atoms; no stable assignment
//     is UNSAT;
//   - the well-founded model of the ground program by Van Gelder's alternating fixpoint, with an
//     undecided leaf read as `u` (false in the under-estimate, true in the over-estimate, which is
//     the WFS of the leaf written as `x :- not x`).

/** Restricted pattern matcher (literals, ^/$, |). */
export function jsMatch(text, pattern) {
  const esc = (s) => s.replace(/[.+*?()[\]{}\\]/g, "\\$&");
  let s = "", i = 0;
  if (pattern.startsWith("^")) { s += "^"; i = 1; }
  const end = pattern.endsWith("$");
  const body = end ? pattern.slice(i, -1) : pattern.slice(i);
  s += body.split("|").map(esc).join("|");
  if (end) s += "$";
  return new RegExp(s).test(String(text));
}

/** Syntactic: some `matches` operand is not bound by an earlier positive literal (the explicit mode). */
export function unboundMatches(g) {
  return [...g.rules.flatMap((r) => r.body), ...g.constraints.flatMap((c) => [...c.forall, ...c.goal])]
    .some((l) => l.kind === "matches" && l.unbound);
}

/** Every total extension of `base` over `atoms` (unanswered or `unknown` atoms are free). */
export function completions(atoms, base, choose) {
  const free = atoms.filter((a) => base[a] === undefined || base[a] === "unknown");
  const options = free.map((a) => (choose && a.includes(`::${choose.name}(`) ? choose.labels : ["holds", "fails"]));
  const total = options.reduce((n, o) => n * o.length, 1);
  const out = [];
  for (let m = 0; m < total; m++) {
    const c = { ...base };
    let x = m;
    for (let i = free.length - 1; i >= 0; i--) {
      c[free[i]] = options[i][x % options[i].length];
      x = Math.floor(x / options[i].length);
    }
    out.push(c);
  }
  return out;
}

const holdsOp = (op, n, K) => (op === ">=" ? n >= K : op === "<" ? n < K : op === "=:=" ? n === K : false);
const cmpDepth = (l, d) => (l.op === "<" ? d < l.K : l.op === ">=" ? d >= l.K : d === l.K);

// ---- two-valued ------------------------------------------------------------------------------

/**
 * Two-valued statuses of one total completion. `loopSet`: the true loop atoms (`loop/a`), for a
 * loop program; it is required there.
 */
export function twoValued(g, comp, loopSet = null) {
  if (g.loopOn && !loopSet) throw new Error("twoValued: a loop program needs a loop assignment");
  const val = new Map(); // "p/s" -> boolean
  const leaf = (name, s, label) => {
    if (g.oracles.includes(name)) return comp[`w::${name}(d,${s})`] === "holds";
    if (g.choose && name === g.choose.name) return comp[`w::${name}(d,${s})`] === label;
    return null;
  };
  const atomVal = (name, s, label) => {
    const lv = leaf(name, s, label);
    if (lv !== null) return lv;
    if (name === "loop" || name === "loop2") return loopSet.has(`${name}/${s}`);
    return val.get(`${name}/${s}`) === true;
  };
  const countOf = (l) => g.sections.filter((s2) => (l.over === "pred" ? atomVal(l.target, s2) : leaf(l.target, s2))).length;
  const lit = (l, s) => {
    switch (l.kind) {
      case "atom": { const v = atomVal(l.name, s); return l.neg ? !v : v; }
      case "choose": { const v = atomVal(l.name, s, l.label); return l.neg ? !v : v; }
      case "in": return g.headings[s] === l.word;
      case "matches": return jsMatch(g.headings[s], l.pattern);
      case "cmp": return cmpDepth(l, g.depths[s]);
      case "count": { const n = countOf(l); return l.bind === "const" ? n === l.K : holdsOp(l.op, n, l.K); }
      default: throw new Error(`twoValued: literal ${l.kind}`);
    }
  };
  const ruleBody = (ru, s) => {
    const parent = g.parents[s];
    const parentIsSection = !!parent && parent !== "root" && g.sections.includes(parent);
    switch (ru.special) {
      case "recursion-base": return parentIsSection;
      case "recursion-step": return parentIsSection && val.get(`anc/${parent}`) === true;
      case "odd-loop": case "even-loop-a": case "even-loop-b": return null; // fixed by loopSet
      default: break;
    }
    if (ru.base === "selected" && !g.selected.includes(s)) return false;
    return ru.body.every((l) => lit(l, s));
  };
  // strata: anc (positive recursion, least fixpoint), then p1 < p2 < p3
  const order = ["anc", ...g.preds.filter((p) => /^p\d+$/.test(p)).sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)))];
  for (const p of order) {
    const rules = g.rules.filter((r) => r.head === p);
    if (!rules.length) continue;
    for (const s of g.sections) val.set(`${p}/${s}`, false);
    let changed = true;
    while (changed) {
      changed = false;
      for (const s of g.sections) {
        if (val.get(`${p}/${s}`)) continue;
        if (rules.some((ru) => ruleBody(ru, s))) { val.set(`${p}/${s}`, true); changed = true; }
      }
    }
  }
  const statuses = {};
  for (const c of g.constraints) {
    const rows = [];
    for (const s of g.sections) {
      if (!c.forall.every((l) => lit(l, s))) continue;
      const goal = c.goal.every((l) => lit(l, s));
      rows.push({ D: "d", S: s, status: (c.mode === "require") === goal ? "satisfied" : "violated" });
    }
    if (c.nonempty && rows.length === 0) rows.push({ population: "empty", status: "violated" });
    statuses[c.id] = rows;
  }
  return { statuses, verdict: verdictOf(statuses), val };
}

function verdictOf(statuses) {
  const flat = Object.values(statuses).flat();
  return flat.some((r) => r.status === "violated") ? "NO-GO"
    : flat.some((r) => r.status === "undetermined") ? "NEEDS-REVIEW" : "PASS";
}

/** Stable assignments of the loop atoms (the loop rules depend on loop atoms only; tight). */
export function stableLoopSets(g) {
  if (!g.loopOn) return [null];
  const loopRules = g.rules.filter((r) => r.special === "odd-loop" || r.special === "even-loop-a" || r.special === "even-loop-b");
  const atoms = [...new Set(loopRules.flatMap((r) => g.sections.map((s) => `${r.head}/${s}`)))];
  const negOf = { "odd-loop": "loop", "even-loop-a": "loop2", "even-loop-b": "loop" };
  const out = [];
  for (let m = 0; m < 1 << atoms.length; m++) {
    const L = new Set(atoms.filter((_, i) => (m >> i) & 1));
    const ok = atoms.every((a) => {
      const [h, s] = a.split("/");
      const supported = loopRules.some((r) => r.head === h && !L.has(`${negOf[r.special]}/${s}`));
      return L.has(a) === supported;
    });
    if (ok) out.push(L);
  }
  return out;
}

/** Aggregate per-model statuses: satisfied iff absent-or-satisfied in all; violated iff violated in all. */
export function aggregate(g, models) {
  const statuses = {};
  for (const c of g.constraints) {
    const rows = [];
    for (const s of g.sections) {
      const at = models.map((x) => x.statuses[c.id].find((r) => r.S === s));
      if (at.every((r) => !r)) continue;
      const status = at.every((r) => !r || r.status === "satisfied") ? "satisfied"
        : at.every((r) => r?.status === "violated") ? "violated" : "undetermined";
      rows.push({ D: "d", S: s, status });
    }
    const empty = models.map((x) => x.statuses[c.id].some((r) => r.population === "empty"));
    if (empty.length && empty.every(Boolean)) rows.push({ population: "empty", status: "violated" });
    else if (empty.some(Boolean)) rows.push({ population: "undetermined", status: "undetermined" });
    statuses[c.id] = rows;
  }
  return { statuses, verdict: verdictOf(statuses) };
}

/**
 * Enumeration oracle: every completion of the leaves x every stable loop assignment. Loop-free
 * programs: the plain enumeration. `unsat` when no stable loop assignment exists.
 */
export function enumerateStatuses(g, ans) {
  const Ls = stableLoopSets(g);
  if (!Ls.length) return { unsat: true, statuses: {}, verdict: "NEEDS-REVIEW", all: [] };
  const comps = completions(g.atoms, ans, g.choose);
  const all = [];
  for (const comp of comps) for (const L of Ls) all.push({ comp, ...twoValued(g, comp, L) });
  return { unsat: false, ...aggregate(g, all), all };
}

// ---- well-founded model ------------------------------------------------------------------------

const neg3 = (v) => (v === "t" ? "f" : v === "f" ? "t" : "u");
const and3 = (vs) => (vs.includes("f") ? "f" : vs.includes("u") ? "u" : "t");

function leaf3(g, ans, name, s, label = "holds") {
  const key = `w::${name}(d,${s})`;
  if (g.oracles.includes(name)) {
    const v = ans[key];
    return v === undefined || v === "unknown" ? "u" : v === "holds" ? "t" : "f";
  }
  if (g.choose && name === g.choose.name) {
    const v = ans[key];
    return v === undefined || v === "unknown" ? "u" : v === label ? "t" : "f";
  }
  return null;
}

/** A comparison over an interval [c, p]: t if it holds for every value, f for none, else u. */
function interval3(l, c, p) {
  const test = (n) => (l.bind === "const" ? n === l.K : holdsOp(l.op, n, l.K));
  let any = false, every = true;
  for (let n = c; n <= p; n++) { if (test(n)) any = true; else every = false; }
  return every ? "t" : any ? "u" : "f";
}

/** Three-valued value of a literal whose atoms are leaves or built-ins (no derived atom). */
function static3(g, ans, l, s) {
  switch (l.kind) {
    case "in": return g.headings[s] === l.word ? "t" : "f";
    case "matches": return jsMatch(g.headings[s], l.pattern) ? "t" : "f";
    case "cmp": return cmpDepth(l, g.depths[s]) ? "t" : "f";
    case "count": {
      let c = 0, p = 0;
      for (const s2 of g.sections) { const v = leaf3(g, ans, l.target, s2); if (v === "t") c++; if (v !== "f") p++; }
      return interval3(l, c, p);
    }
    default: return null;
  }
}

/** Ground program: { head, pos: [atom], neg: [atom], k: t|u (body constants; f-bodies dropped) }. */
function ground(g, ans) {
  const out = [];
  for (const ru of g.rules) {
    for (const s of g.sections) {
      const parent = g.parents[s];
      const parentIsSection = !!parent && parent !== "root" && g.sections.includes(parent);
      const r = { head: `${ru.head}/${s}`, pos: [], neg: [], k: [] };
      switch (ru.special) {
        case "recursion-base": if (!parentIsSection) continue; out.push({ ...r, k: "t" }); continue;
        case "recursion-step": if (!parentIsSection) continue; out.push({ ...r, pos: [`anc/${parent}`], k: "t" }); continue;
        case "odd-loop": out.push({ ...r, neg: [`loop/${s}`], k: "t" }); continue;
        case "even-loop-a": out.push({ ...r, neg: [`loop2/${s}`], k: "t" }); continue;
        case "even-loop-b": out.push({ ...r, neg: [`loop/${s}`], k: "t" }); continue;
        default: break;
      }
      if (ru.base === "selected" && !g.selected.includes(s)) continue;
      for (const l of ru.body) {
        if (l.kind === "atom" || l.kind === "choose") {
          const lv = leaf3(g, ans, l.name, s, l.kind === "choose" ? l.label : "holds");
          if (lv !== null) r.k.push(l.neg ? neg3(lv) : lv);
          else (l.neg ? r.neg : r.pos).push(`${l.name}/${s}`);
        } else {
          r.k.push(static3(g, ans, l, s));
        }
      }
      const k = and3(r.k);
      if (k === "f") continue;
      out.push({ ...r, k });
    }
  }
  return out;
}

/** Least model of the rules usable under `kOk`, negation read against the fixed set J. */
function lfp(rules, kOk, J) {
  const S = new Set();
  let changed = true;
  while (changed) {
    changed = false;
    for (const r of rules) {
      if (S.has(r.head) || !kOk(r.k)) continue;
      if (r.neg.some((a) => J.has(a))) continue;
      if (!r.pos.every((a) => S.has(a))) continue;
      S.add(r.head); changed = true;
    }
  }
  return S;
}

/** The well-founded model: { T, O } with T the true atoms and O the not-false atoms. */
export function wellFounded(g, ans) {
  const rules = ground(g, ans);
  let T = new Set();
  for (let guard = 0; guard < 1000; guard++) {
    const O = lfp(rules, (k) => k === "t" || k === "u", T);
    const T2 = lfp(rules, (k) => k === "t", O);
    if (T2.size === T.size && [...T2].every((a) => T.has(a))) return { T, O };
    T = T2;
  }
  throw new Error("wellFounded: no fixpoint");
}

/** WFS statuses (the kernel's §4 status table over the three-valued model). */
export function wfs(g, ans) {
  const { T, O } = wellFounded(g, ans);
  const derived = (name, s) => (T.has(`${name}/${s}`) ? "t" : O.has(`${name}/${s}`) ? "u" : "f");
  const lit = (l, s) => {
    if (l.kind === "atom" || l.kind === "choose") {
      const lv = leaf3(g, ans, l.name, s, l.kind === "choose" ? l.label : "holds");
      const v = lv !== null ? lv : derived(l.name, s);
      return l.neg ? neg3(v) : v;
    }
    if (l.kind === "count" && l.over === "pred") {
      let c = 0, p = 0;
      for (const s2 of g.sections) { const v = derived(l.target, s2); if (v === "t") c++; if (v !== "f") p++; }
      return interval3(l, c, p);
    }
    return static3(g, ans, l, s);
  };
  const statuses = {};
  for (const c of g.constraints) {
    const rows = [];
    let anyT = false;
    for (const s of g.sections) {
      const B = and3(c.forall.map((l) => lit(l, s)));
      if (B === "f") continue;
      if (B === "t") anyT = true;
      const G = and3(c.goal.map((l) => lit(l, s)));
      const status = c.mode === "require"
        ? (G === "t" ? "satisfied" : B === "t" && G === "f" ? "violated" : "undetermined")
        : (G === "f" ? "satisfied" : B === "t" && G === "t" ? "violated" : "undetermined");
      rows.push({ D: "d", S: s, status });
    }
    if (c.nonempty && rows.length === 0) rows.push({ population: "empty", status: "violated" });
    else if (c.nonempty && !anyT) rows.push({ population: "undetermined", status: "undetermined" });
    statuses[c.id] = rows;
  }
  return { statuses, verdict: verdictOf(statuses) };
}

/**
 * Bindings that rest on a loop: undetermined under the WFS of `ans` and present-and-undetermined
 * under the WFS of every total completion of the leaves (no answer can decide them).
 */
export function restingOnLoop(g, ans) {
  const here = wfs(g, ans);
  const open = Object.entries(here.statuses).flatMap(([id, rows]) => rows.filter((r) => r.S && r.status === "undetermined").map((r) => `${id}/${r.S}`));
  if (!open.length) return new Set();
  const still = new Set(open);
  for (const comp of completions(g.atoms, ans, g.choose)) {
    const w = wfs(g, comp);
    for (const k of [...still]) {
      const [id, S] = k.split("/");
      const r = w.statuses[id].find((x) => x.S === S);
      if (!r || r.status !== "undetermined") still.delete(k);
    }
    if (!still.size) break;
  }
  return still;
}

// ---- status vocabulary -------------------------------------------------------------------------

/** One vocabulary: per section {satisfied, violated, undetermined} with an absent binding read as satisfied. */
export function statusOf(rows, S) {
  const r = (rows ?? []).find((x) => x.S === S);
  if (!r) return "satisfied";
  if (r.status === "satisfied" || r.status === "violated" || r.status === "undetermined") return r.status;
  return `?${r.status}`;
}
function populationOf(rows) {
  const r = (rows ?? []).find((x) => x.population !== undefined);
  return r ? r.status : "none";
}
/** The comparable vector of a result: constraint/section -> status, constraint/population -> status. */
export function statusVector(statuses, g) {
  const v = {};
  for (const c of g.constraints) {
    for (const s of g.sections) v[`${c.id}/${s}`] = statusOf(statuses?.[c.id], s);
    v[`${c.id}/population`] = populationOf(statuses?.[c.id]);
  }
  return v;
}
export function vectorDiff(a, b) {
  return Object.keys(a).filter((k) => a[k] !== b[k]).map((k) => `${k} ${a[k]}/${b[k]}`);
}

export const canon = (st) => JSON.stringify(Object.keys(st).sort().map((c) => [c, st[c].filter((r) => r.status !== "satisfied").map((r) => JSON.stringify(Object.keys(r).sort().map((k) => [k, r[k]]))).sort()]));
