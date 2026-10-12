// kernel.mjs - host for subject S1 (the WFS kernel: core.pl + a translated program under
// swipl-wasm). The host's only channel into the kernel is the program text and the answer
// state (model §8); results come back as report lines (core_report/1).
//
// Loading as round 1 (F1, F2, F4, F5): createRequire of swipl-node.js, FS.writeFile + consult,
// results formatted with ~q / ~w into an atom.
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";
import { quoteAtom } from "../../../../doc-verify/dist/engine/terms.js";
import { CORE_PL } from "./translate.mjs";

const require = createRequire(import.meta.url);
const SWIPL = require("../vendor/node_modules/swipl-wasm/dist/swipl-node.js");
const SEP = "\x1f";
let fileCounter = 0;

export class Kernel {
  static async create() {
    const t0 = performance.now();
    const swipl = await SWIPL({ arguments: ["-q"] });
    const k = new Kernel(swipl);
    k.startupMs = performance.now() - t0;
    return k;
  }
  constructor(swipl) { this.swipl = swipl; }

  /** q(goal binding R) -> printed R, or throws with the Prolog exception text. */
  q(goal, fmt = "~q") {
    const r = this.swipl.prolog.query(`catch(((${goal}) -> format(atom(Out), '${fmt}', [R]) ; Out = '$false'), E, format(atom(Out), '$error ~q', [E]))`).once();
    const out = r && r.Out !== undefined ? String(r.Out) : `$error ${JSON.stringify(r)}`;
    if (out.startsWith("$error ")) { const e = new Error(out.slice(7)); e.prolog = out.slice(7); throw e; }
    return out;
  }
  run(goal) { return this.q(`(${goal}), R = ok`); }

  /** Consults core.pl and the program as ONE file (shared dynamic declarations). */
  load(programText, { countMode = "interval" } = {}) {
    const name = `/k${fileCounter += 1}.pl`;
    this.swipl.FS.writeFile(name, `${readFileSync(CORE_PL, "utf8")}\n\n% ======== program\n${programText}\n`);
    const t0 = performance.now();
    this.run(`consult('${name}')`);
    this.consultMs = performance.now() - t0;
    this.run(`retractall(core_count_mode(_)), assertz(core_count_mode(${countMode}))`);
  }

  /** Writes the answer state (cumulative). `incremental` keeps the tables; else abolish them. */
  setAnswers(answers, { incremental = false } = {}) {
    const pairs = Object.entries(answers ?? {}).map(([key, label]) => `${atomTerm(key)}-${quoteAtom(String(label))}`);
    this.run(`core_set_answers([${pairs.join(",")}])`);
    if (!incremental) this.run("abolish_all_tables");
  }

  /** One evaluation: { statuses, demand: {full, prefix}, verdict, missing, unfounded } or { rejected }. */
  evaluate(program) {
    let text;
    try {
      text = this.q("core_report(R)", "~w");
    } catch (e) {
      const m = /core_rejected\(([^,]+),(.*)\)$/.exec(e.prolog ?? "");
      if (m) return { rejected: `${m[1]}: ${m[2]}` };
      throw e;
    }
    return parseReport(text, program);
  }

  /**
   * D3 (model §6, a measure): for each demanded atom, whether some labelling of it changes some
   * binding status, by trying every label and re-evaluating from scratch.
   */
  d3(program, answers, demand) {
    const base = statusKey(this.evaluate(program));
    const relevant = [];
    for (const key of demand.full) {
      const labels = this.q(`core_atom_labels(${atomTerm(key)}, R)`).replace(/^\[|\]$/g, "").split(",");
      let changes = false;
      for (const label of labels) {
        this.setAnswers({ ...answers, [key]: label });
        const r = this.evaluate(program);
        if (statusKey(r) !== base) { changes = true; break; }
      }
      if (changes) relevant.push(key);
    }
    this.setAnswers(answers);
    const share = (set) => set.length === 0 ? null : set.filter((a) => relevant.includes(a)).length / set.length;
    return { relevant, full: share(demand.full), prefix: share(demand.prefix) };
  }
}

/** `w::o(d,a)` -> `'w::o'(d,a)` (the oracle atom as a Prolog term; args are Prolog syntax). */
export function atomTerm(key) {
  const open = key.indexOf("(");
  if (open < 0) return quoteAtom(key);
  return `${quoteAtom(key.slice(0, open))}${key.slice(open)}`;
}

function constraintVarNames(program) {
  const names = new Map();
  for (const c of program.constraints) {
    const ns = [];
    const visit = (t) => {
      if (t.kind === "var" && t.name !== "_" && !ns.includes(t.name)) ns.push(t.name);
      if (t.kind === "compound") t.args.forEach(visit);
    };
    for (const l of c.forall) {
      if (l.kind === "pos" || l.kind === "neg") l.args.forEach(visit);
      else if (l.kind === "in") { visit(l.item); visit(l.list); }
      else if (l.kind === "matches") visit(l.item);
      else if (l.kind === "cmp") { visit(l.left); visit(l.right); }
      else if (l.kind === "present") { visit(l.document); visit(l.candidates); visit(l.present); }
      else if (l.kind === "count") { visit(l.variable); l.goal.forEach((g) => g.args?.forEach(visit)); visit(l.result); }
    }
    names.set(c.id, ns);
  }
  return names;
}

function parseReport(text, program) {
  const names = constraintVarNames(program);
  const res = { statuses: {}, demand: { full: [], prefix: [] }, verdict: undefined, missing: {}, unfounded: {} };
  for (const c of program.constraints) res.statuses[c.id] = [];
  const row = (id, vals, status) => {
    // population row of a nonempty constraint (§4): empty when violated, undetermined when every binding has B = u
    if (vals.length === 1 && vals[0] === "\x1dpopulation") return { population: status === "violated" ? "empty" : "undetermined" };
    return Object.fromEntries((names.get(id) ?? []).map((n, i) => [n, vals[i]]));
  };
  for (const line of text.split("\n").filter(Boolean)) {
    const f = line.split(SEP);
    switch (f[0]) {
      case "status": res.statuses[f[1]].push({ ...row(f[1], f.slice(3), f[2]), status: f[2] }); break;
      case "demand": res.demand[f[1]].push(f[2]); break;
      case "missing": (res.missing[f[1]] ??= []).push({ ...row(f[1], f.slice(5)), literal: f[2], path: f[3] === "" ? [] : f[3].split("\x1e"), passed_u: f[4] === "" ? [] : f[4].split("\x1e") }); break;
      case "unresolvable": (res.unresolvable ??= {}, res.unresolvable[f[1]] ??= []).push(row(f[1], f.slice(2))); break;
      case "unfounded": (res.unfounded[f[1]] ??= []).push({ ...row(f[1], f.slice(3)), atom: f[2] }); break;
      case "verdict": res.verdict = f[1]; break;
    }
  }
  res.demand.full = [...new Set(res.demand.full)].sort();
  res.demand.prefix = [...new Set(res.demand.prefix)].sort();
  return res;
}

const statusKey = (r) => r.rejected ? `rejected ${r.rejected}`
  : JSON.stringify(Object.entries(r.statuses).sort().map(([id, rows]) => [id, rows.map((x) => JSON.stringify(Object.entries(x).sort())).sort()]));

export const kernelDir = path.dirname(CORE_PL);
