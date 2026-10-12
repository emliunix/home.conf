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

// Round 5, T1 (the gate, as amended). Every kernel primitive a module-derived clause body may
// call, declared by its KIND (preregistration §"The gate (T1), as amended"):
//   safe_primitive  a leaf; sandbox does not look at its arguments (data / answer-state / pcre /
//                   ground arithmetic). memberchk/2 is a library builtin already in sandbox's
//                   default safe set, so it is never declared here (declaring it raises
//                   "No permission to declare safe_goal").
//   safe_meta       a meta-predicate that CALLS its goal argument; sandbox recurses into that
//                   argument. core_naf/1, core_tnot/1, core_count/3. Declared as primitives they
//                   would let E9/E10 through (a raw goal in the argument never checked).
// The base facts are core.pl's `core_base/1` set plus the read-state and comparison primitives.
export const SANDBOX_PRIMITIVES = [
  // base facts of the dump (data)
  "core_section(_,_,_)", "core_heading(_,_,_)", "core_depth(_,_,_)", "core_order(_,_,_)", "core_meta(_,_,_)",
  "core_selected(_,_)", "core_ref(_,_,_,_)", "core_resolves(_,_)", "core_child(_,_,_)", "core_descendant(_,_,_)",
  "core_table(_,_,_)", "core_header(_,_,_)", "core_row(_,_,_)", "core_cell(_,_,_)", "core_nests(_,_,_)",
  "core_dangling(_,_,_,_)", "core_spec_unresolved(_,_,_,_)",
  // read the answer state
  "core_label(_,_)", "core_not_label(_,_)", "core_choose(_,_,_)",
  // pcre with its own match limit (seed E5); arithmetic on ground operands; data
  "core_matches(_,_)", "core_not_matches(_,_)", "core_cmp(_,_,_)", "core_present(_,_,_)",
];
export const SANDBOX_META = [
  ["core_naf(G)", "[G]"], ["core_tnot(G)", "[G]"], ["core_count(_,G,_)", "[G]"],
];

/**
 * The declarations consulted AFTER core.pl (they name predicates core.pl must already define;
 * declaring an undefined predicate raises "No permission to declare safe_goal"). Options:
 *   countPrimitive  declare core_count/3 as safe_primitive, not safe_meta (mutation R6: E9 runs)
 *   dropPrimitive   a primitive to omit (mutation R6: a false refusal on a real program)
 *   catchSkip       skip the catch/3 refusal in clause bodies (mutation R6: E17 under T2 runs)
 */
function sandboxDecl({ countPrimitive = false, dropPrimitive = null } = {}) {
  const prims = SANDBOX_PRIMITIVES.filter((p) => p !== dropPrimitive);
  const metas = SANDBOX_META.filter(([g]) => !(countPrimitive && g.startsWith("core_count")));
  const lines = ["", ":- use_module(library(sandbox)).", ":- multifile sandbox:safe_primitive/1.", ":- multifile sandbox:safe_meta/2."];
  for (const p of prims) lines.push(`sandbox:safe_primitive(user:${p}).`);
  if (countPrimitive) lines.push("sandbox:safe_primitive(user:core_count(_,_,_)).");
  for (const [g, called] of metas) lines.push(`sandbox:safe_meta(user:${g},${called}).`);
  return lines.join("\n");
}

// The census: predicates core.pl alone defines (module `user`), computed once and cached. A
// module-derived predicate is any user predicate present after the full consult that is NOT in
// this set; each such predicate's clause bodies are checked with safe_goal/1 (finding 1). System
// hook predicates (goal_expansion, message_hook, ...) and tabling wrappers ($wrap$...) appear in
// both sets and cancel out, so they are never miscounted as module-derived.
const ENUM_PREDS = "findall(F/N,(current_predicate(F/N),functor(H,F,N),predicate_property(user:H,defined),\\+predicate_property(user:H,built_in),\\+predicate_property(user:H,imported_from(_)),\\+predicate_property(user:H,foreign),\\+sub_atom(F,0,1,_,'$')),Ps0),sort(Ps0,Ps)";
// The core predicate set, computed once from core.pl alone and kept as the TEXT of a Prolog list
// (F/N terms, their names quoted as Prolog requires), to inject verbatim into each load instance
// so the gate runs in Prolog without round-tripping names through JS.
let CORE_LIST = null;
async function corePredicates() {
  if (CORE_LIST) return CORE_LIST;
  const swipl = await SWIPL({ arguments: ["-q"] });
  swipl.FS.writeFile("/core-alone.pl", readFileSync(CORE_PL, "utf8"));
  swipl.prolog.query("consult('/core-alone.pl')").once();
  const r = swipl.prolog.query(`(${ENUM_PREDS}),with_output_to(string(S),write_term(Ps,[quoted(true)]))`).once();
  CORE_LIST = String(r.S).replace(/^\[|\]$/g, "");   // the list body, injectable as [ ... ]
  return CORE_LIST;
}

// A directive the program text carries (outside core.pl) runs at consult before any gate (finding
// 4). The translator emits only these directive functors; any other directive in the program text
// is refused at load (seed E13). The scan is textual: a line beginning `:-`/`?-`.
const ALLOWED_DIRECTIVES = new Set(["table", "style_check", "discontiguous", "dynamic", "multifile", "use_module", "set_prolog_flag"]);
function disallowedDirective(programText) {
  for (const raw of programText.split("\n")) {
    const m = /^\s*[:?]-\s*(?:initialization\s*\(\s*)?([a-z][A-Za-z0-9_]*)/.exec(raw);
    if (!m) continue;
    if (/^\s*[:?]-\s*initialization/.test(raw)) return raw.trim().slice(0, 80);
    if (!ALLOWED_DIRECTIVES.has(m[1])) return raw.trim().slice(0, 80);
  }
  return null;
}

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

  /**
   * Consults core.pl and the program as ONE file (shared dynamic declarations). With `sandbox`
   * (round 5, T1) the module-derived predicates and constraint goals are checked with
   * library(sandbox)'s safe_goal/1 after consult, the kernel's own primitives declared safe; a
   * refusal is thrown as `core_rejected(unsafe, Goal)` so the host reports `rejected`.
   */
  async load(programText, opts = {}) {
    const { countMode = "interval", sandbox = false, gateSkip = false, directiveSkip = false,
            countPrimitive = false, dropPrimitive = null, censusWiden = [], catchSkip = false } = opts;
    // Load refusal (finding 4): a directive runs at consult before the gate, so the program text
    // is scanned for a disallowed directive BEFORE it is written and consulted.
    if (sandbox && !directiveSkip) {
      const bad = disallowedDirective(programText);
      if (bad) {
        const err = new Error(`core_rejected(directive,${bad})`);
        err.prolog = `core_rejected(directive,${bad})`;
        err.detail = `directive in program text: ${bad}`;
        throw err;
      }
    }
    const name = `/k${fileCounter += 1}.pl`;
    const decl = sandbox ? `\n% ======== gate\n${sandboxDecl({ countPrimitive, dropPrimitive })}\n` : "";
    this.swipl.FS.writeFile(name, `${readFileSync(CORE_PL, "utf8")}${decl}\n\n% ======== program\n${programText}\n`);
    const t0 = performance.now();
    this.run(`consult('${name}')`);
    this.consultMs = performance.now() - t0;
    this.run(`retractall(core_count_mode(_)), assertz(core_count_mode(${countMode}))`);
    this.sandboxMs = 0;
    if (sandbox && !gateSkip) {
      const t1 = performance.now();
      const coreList = await corePredicates();
      const widen = `[${censusWiden.join(",")}]`;          // mutation R6: widen the EXCLUSION only
      // The census and gate, in Prolog: module-derived = user predicates after the full consult
      // minus core.pl's own set; toCheck = those minus the widened exclusion; each predicate's
      // clause bodies are checked with safe_goal/1. Returns Defined, Checked, the unchecked list,
      // and the first failing predicate (or '-' if none). Names never leave Prolog.
      const goal = `(${ENUM_PREDS}),` +
        `CoreL = [${coreList}], WidenL = ${widen},` +
        `subtract(Ps, CoreL, Derived),` +
        `subtract(Derived, WidenL, ToCheck),` +
        `intersection(Derived, WidenL, Unchecked),` +
        `length(Derived, NDef),` +
        // safe_goal/1 THROWS on an unsafe (or unknown) clause body rather than failing, so the
        // check is wrapped: any throw or failure on a clause body makes the predicate unsafe.
        // Round 5 E17: a program-level catch/3 (or a cleanup wrapper) swallows the inference
        // limit's exception, so the budget alone cannot stop a wrapped loop. The translator never
        // emits these control constructs; a module-derived clause body that carries one is refused.
        `( member(F/N, ToCheck), functor(H, F, N),` +
        `  \\+ forall(clause(user:H, B), ( catch(safe_goal(user:B), _, fail)` +
        (catchSkip ? "" : `, \\+ ( sub_term(T, B), nonvar(T), compound(T), functor(T, CF, CA), memberchk(CF/CA, [catch/3, catch_with_backtrace/3, setup_call_cleanup/3, call_cleanup/2]) )`) +
        ` ))` +
        `  -> Bad = F/N ; Bad = '-' ),` +
        `length(ToCheck, NChk),` +
        `R = census(NDef,NChk,Unchecked,Bad)`;
      const out = this.q(goal, "~w");
      const m = /census\((\d+),(\d+),(\[.*?\]),(.+)\)$/.exec(out);
      const unchecked = m[3] === "[]" ? [] : m[3].replace(/^\[|\]$/g, "").split(",").map((s) => s.trim());
      this.sandboxMs = performance.now() - t1;
      this.sandboxGoals = Number(m[2]);
      this.sandboxCensus = { defined: Number(m[1]), checked: Number(m[2]), unchecked };
      if (m[4] !== "'-'" && m[4] !== "-") {
        const err = new Error(`core_rejected(unsafe,${m[4]})`);
        err.prolog = `core_rejected(unsafe,${m[4]})`;
        err.detail = `safe_goal rejected a clause body of ${m[4]}`;
        throw err;
      }
    }
  }

  /** Writes the answer state (cumulative). `incremental` keeps the tables; else abolish them. */
  setAnswers(answers, { incremental = false } = {}) {
    const pairs = Object.entries(answers ?? {}).map(([key, label]) => `${atomTerm(key)}-${quoteAtom(String(label))}`);
    this.run(`core_set_answers([${pairs.join(",")}])`);
    if (!incremental) this.run("abolish_all_tables");
  }

  /**
   * One evaluation: { statuses, demand: {full, prefix}, verdict, missing, unfounded } or
   * { rejected }. With `budget` (round 5, T2) the evaluation runs under
   * call_with_inference_limit/3 and an exceeded limit is { blocked: "budget" } (model §8).
   */
  evaluate(program, { budget } = {}) {
    let text;
    try {
      if (budget === undefined) {
        text = this.q("core_report(R)", "~w");
      } else {
        const out = this.q(`call_with_inference_limit(core_report(R0), ${Number(budget)}, Res), (Res == inference_limit_exceeded -> R = '$budget' ; R = R0)`, "~w");
        if (out === "$budget") return { blocked: "budget", budget };
        text = out;
      }
    } catch (e) {
      const m = /core_rejected\(([^,]+),(.*)\)$/.exec(e.prolog ?? "");
      if (m) return { rejected: `${m[1]}: ${m[2]}` };
      // A library/instance limit (pcre match_limit, stack) is a `resource` outcome (finding 13),
      // distinct from a static `rejected`.
      const r = /resource_error\((\w+)\)/.exec(e.prolog ?? "");
      if (r) return { resource: r[1] };
      throw e;
    }
    return parseReport(text, program);
  }

  /** Inferences one evaluation needs (statistics/2), for calibrating a budget. */
  inferencesOf() {
    return Number(this.q("statistics(inferences, I0), core_report(_), statistics(inferences, I1), R is I1 - I0"));
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
