/**
 * Host for the WFS kernel: core.pl + a translated program under swipl-wasm.
 * The host's only channel into the kernel is the program text and the answer state
 * (model §8); results come back as report lines (core_report/1).
 *
 * Loading follows round 1 (F1, F2, F4, F5) and round 5's gate + inference budget.
 */

import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { quoteAtom } from "../engine/terms.js";
import type { TranslateProgram } from "./translate.js";

const require = createRequire(import.meta.url);
const SWIPL = require("swipl-wasm/dist/swipl-node.js") as (opts: { arguments: string[] }) => Promise<SwiplInstance>;

const SEP = "\x1f";
let fileCounter = 0;

/** core.pl beside this module (src/kernel in tests; dist/kernel after build). */
export const CORE_PL = path.join(path.dirname(fileURLToPath(import.meta.url)), "core.pl");

interface SwiplInstance {
  FS: { writeFile: (name: string, data: string) => void };
  prolog: { query: (goal: string) => { once: () => Record<string, unknown> } };
}

export class PrologError extends Error {
  prolog: string;
  detail?: string;
  constructor(message: string, opts?: { prolog?: string; detail?: string }) {
    super(message);
    this.prolog = opts?.prolog ?? message;
    if (opts?.detail !== undefined) this.detail = opts.detail;
  }
}

// Round 5, T1 (the gate). Every kernel primitive a module-derived clause body may call.
export const SANDBOX_PRIMITIVES = [
  "core_section(_,_,_)", "core_heading(_,_,_)", "core_depth(_,_,_)", "core_order(_,_,_)", "core_meta(_,_,_)",
  "core_selected(_,_)", "core_ref(_,_,_,_)", "core_resolves(_,_)", "core_child(_,_,_)", "core_descendant(_,_,_)",
  "core_table(_,_,_)", "core_header(_,_,_)", "core_row(_,_,_)", "core_cell(_,_,_)", "core_nests(_,_,_)",
  "core_dangling(_,_,_,_)", "core_spec_unresolved(_,_,_,_)", "core_section_ref(_,_,_,_,_)",
  "core_label(_,_)", "core_not_label(_,_)", "core_choose(_,_,_)",
  "core_matches(_,_)", "core_not_matches(_,_)", "core_cmp(_,_,_)", "core_present(_,_,_)",
];
export const SANDBOX_META: Array<[string, string]> = [
  ["core_naf(G)", "[G]"], ["core_tnot(G)", "[G]"], ["core_count(_,G,_)", "[G]"],
];

function sandboxDecl(): string {
  const lines = ["", ":- use_module(library(sandbox)).", ":- multifile sandbox:safe_primitive/1.", ":- multifile sandbox:safe_meta/2."];
  for (const p of SANDBOX_PRIMITIVES) lines.push(`sandbox:safe_primitive(user:${p}).`);
  for (const [g, called] of SANDBOX_META) lines.push(`sandbox:safe_meta(user:${g},${called}).`);
  return lines.join("\n");
}

const ENUM_PREDS =
  "findall(F/N,(current_predicate(F/N),functor(H,F,N),predicate_property(user:H,defined),\\+predicate_property(user:H,built_in),\\+predicate_property(user:H,imported_from(_)),\\+predicate_property(user:H,foreign),\\+sub_atom(F,0,1,_,'$')),Ps0),sort(Ps0,Ps)";

let CORE_LIST: string | null = null;

async function corePredicates(): Promise<string> {
  if (CORE_LIST) return CORE_LIST;
  const swipl = await SWIPL({ arguments: ["-q"] });
  swipl.FS.writeFile("/core-alone.pl", readFileSync(CORE_PL, "utf8"));
  swipl.prolog.query("consult('/core-alone.pl')").once();
  const r = swipl.prolog.query(`(${ENUM_PREDS}),with_output_to(string(S),write_term(Ps,[quoted(true)]))`).once();
  CORE_LIST = String(r.S).replace(/^\[|\]$/g, "");
  return CORE_LIST;
}

const ALLOWED_DIRECTIVES = new Set(["table", "style_check", "discontiguous", "dynamic", "multifile", "use_module", "set_prolog_flag"]);

function disallowedDirective(programText: string): string | null {
  for (const raw of programText.split("\n")) {
    const m = /^\s*[:?]-\s*(?:initialization\s*\(\s*)?([a-z][A-Za-z0-9_]*)/.exec(raw);
    if (!m) continue;
    if (/^\s*[:?]-\s*initialization/.test(raw)) return raw.trim().slice(0, 80);
    const name = m[1] as string;
    if (!ALLOWED_DIRECTIVES.has(name)) return raw.trim().slice(0, 80);
  }
  return null;
}

export interface KernelLoadOptions {
  countMode?: "interval" | "naive";
  sandbox?: boolean;
  /** In-memory rewrite of core.pl for seeded defects; the committed file is untouched. */
  corePatch?: ((text: string) => string) | string;
}

export interface KernelEvaluateOptions {
  budget?: number;
}

export interface StatusRow {
  status: string;
  population?: "empty" | "undetermined";
  [key: string]: string | undefined;
}

export interface MissingRow {
  literal: string;
  path: string[];
  passed_u: string[];
  [key: string]: string | string[] | undefined;
}

export interface UnfoundedRow {
  atom: string;
  [key: string]: string | undefined;
}

export interface KernelPopulation {
  possible: number;
  certain: number;
}

export interface KernelProofRow {
  values: Record<string, string>;
  /** write_canonical text of the proof term */
  tree: string;
}

export interface KernelReport {
  statuses: Record<string, StatusRow[]>;
  /** Bindings whose forall is certain (TB = t), keyed by constraint id. */
  certain: Record<string, Array<Record<string, string>>>;
  populations: Record<string, KernelPopulation>;
  proofs: Record<string, KernelProofRow[]>;
  demand: { full: string[]; prefix: string[] };
  verdict?: string;
  missing: Record<string, MissingRow[]>;
  unfounded: Record<string, UnfoundedRow[]>;
  unresolvable?: Record<string, Array<Record<string, string>>>;
  rejected?: string;
  blocked?: string;
  budget?: number;
  resource?: string;
}

export interface SandboxCensus {
  defined: number;
  checked: number;
  unchecked: string[];
}

export class Kernel {
  swipl: SwiplInstance;
  startupMs = 0;
  consultMs = 0;
  sandboxMs = 0;
  sandboxGoals = 0;
  sandboxCensus: SandboxCensus | undefined;

  static async create(): Promise<Kernel> {
    const t0 = performance.now();
    const swipl = await SWIPL({ arguments: ["-q"] });
    const k = new Kernel(swipl);
    k.startupMs = performance.now() - t0;
    return k;
  }

  constructor(swipl: SwiplInstance) {
    this.swipl = swipl;
  }

  /** q(goal binding R) -> printed R, or throws with the Prolog exception text. */
  q(goal: string, fmt = "~q"): string {
    const r = this.swipl.prolog
      .query(`catch(((${goal}) -> format(atom(Out), '${fmt}', [R]) ; Out = '$false'), E, format(atom(Out), '$error ~q', [E]))`)
      .once();
    let out: string;
    if (typeof r.Out === "string") out = r.Out;
    else if (typeof r.Out === "number" || typeof r.Out === "boolean") out = String(r.Out);
    else out = `$error ${JSON.stringify(r)}`;
    if (out.startsWith("$error ")) {
      throw new PrologError(out.slice(7), { prolog: out.slice(7) });
    }
    return out;
  }

  run(goal: string): string {
    return this.q(`(${goal}), R = ok`);
  }

  /**
   * Consults core.pl and the program as one file. With `sandbox` the module-derived
   * predicates and constraint goals are checked with library(sandbox)'s safe_goal/1.
   */
  async load(programText: string, opts: KernelLoadOptions = {}): Promise<void> {
    const { countMode = "interval", sandbox = false, corePatch = null } = opts;
    if (sandbox) {
      const bad = disallowedDirective(programText);
      if (bad) {
        throw new PrologError(`core_rejected(directive,${bad})`, {
          prolog: `core_rejected(directive,${bad})`,
          detail: `directive in program text: ${bad}`,
        });
      }
    }
    const name = `/k${(fileCounter += 1)}.pl`;
    const decl = sandbox ? `\n% ======== gate\n${sandboxDecl()}\n` : "";
    let coreText = readFileSync(CORE_PL, "utf8");
    if (typeof corePatch === "function") coreText = corePatch(coreText);
    else if (typeof corePatch === "string") coreText = corePatch;
    this.swipl.FS.writeFile(name, `${coreText}${decl}\n\n% ======== program\n${programText}\n`);
    const t0 = performance.now();
    this.run(`consult('${name}')`);
    this.consultMs = performance.now() - t0;
    this.run(`retractall(core_count_mode(_)), assertz(core_count_mode(${countMode}))`);
    this.sandboxMs = 0;
    if (sandbox) {
      const t1 = performance.now();
      const coreList = await corePredicates();
      const goal =
        `(${ENUM_PREDS}),` +
        `CoreL = [${coreList}], WidenL = [],` +
        `subtract(Ps, CoreL, Derived),` +
        `subtract(Derived, WidenL, ToCheck),` +
        `intersection(Derived, WidenL, Unchecked),` +
        `length(Derived, NDef),` +
        `( member(F/N, ToCheck), functor(H, F, N),` +
        `  \\+ forall(clause(user:H, B), ( catch(safe_goal(user:B), _, fail)` +
        `, \\+ ( sub_term(T, B), nonvar(T), compound(T), functor(T, CF, CA), memberchk(CF/CA, [catch/3, catch_with_backtrace/3, setup_call_cleanup/3, call_cleanup/2]) )` +
        ` ))` +
        `  -> Bad = F/N ; Bad = '-' ),` +
        `length(ToCheck, NChk),` +
        `R = census(NDef,NChk,Unchecked,Bad)`;
      const out = this.q(goal, "~w");
      const m = /census\((\d+),(\d+),(\[.*?\]),(.+)\)$/.exec(out);
      if (!m) throw new Error(`sandbox census parse failed: ${out}`);
      const uncheckedText = m[3] as string;
      const unchecked = uncheckedText === "[]" ? [] : uncheckedText.replace(/^\[|\]$/g, "").split(",").map((s) => s.trim());
      this.sandboxMs = performance.now() - t1;
      this.sandboxGoals = Number(m[2]);
      this.sandboxCensus = { defined: Number(m[1]), checked: Number(m[2]), unchecked };
      const bad = m[4] as string;
      if (bad !== "'-'" && bad !== "-") {
        throw new PrologError(`core_rejected(unsafe,${bad})`, {
          prolog: `core_rejected(unsafe,${bad})`,
          detail: `safe_goal rejected a clause body of ${bad}`,
        });
      }
    }
  }

  /** Writes the answer state. `incremental` keeps the tables; else abolish them. */
  setAnswers(answers: Record<string, string> | undefined, opts: { incremental?: boolean } = {}): void {
    const pairs = Object.entries(answers ?? {}).map(([key, label]) => `${atomTerm(key)}-${quoteAtom(label)}`);
    this.run(`core_set_answers([${pairs.join(",")}])`);
    if (!opts.incremental) this.run("abolish_all_tables");
  }

  /**
   * One evaluation: report fields, or `{ rejected }`, `{ blocked: "budget" }`, `{ resource }`.
   */
  evaluate(program: TranslateProgram, opts: KernelEvaluateOptions = {}): KernelReport {
    let text: string;
    try {
      if (opts.budget === undefined) {
        text = this.q("core_report(R)", "~w");
      } else {
        const out = this.q(
          `call_with_inference_limit(core_report(R0), ${opts.budget}, Res), (Res == inference_limit_exceeded -> R = '$budget' ; R = R0)`,
          "~w",
        );
        if (out === "$budget") {
          return emptyReport({ blocked: "budget", budget: opts.budget });
        }
        text = out;
      }
    } catch (e) {
      const prolog = e instanceof PrologError ? e.prolog : "";
      const m = /core_rejected\(([^,]+),(.*)\)$/.exec(prolog);
      if (m) return emptyReport({ rejected: `${m[1]}: ${m[2]}` });
      const r = /resource_error\((\w+)\)/.exec(prolog);
      if (r && r[1] !== undefined) {
        return emptyReport({ resource: r[1] });
      }
      throw e;
    }
    return parseReport(text, program);
  }

  /** Inferences one evaluation needs (statistics/2), for calibrating a budget. */
  inferencesOf(): number {
    return Number(this.q("statistics(inferences, I0), core_report(_), statistics(inferences, I1), R is I1 - I0"));
  }
}

/** `w::o(d,a)` -> `'w::o'(d,a)` (the oracle atom as a Prolog term; args are Prolog syntax). */
export function atomTerm(key: string): string {
  const open = key.indexOf("(");
  if (open < 0) return quoteAtom(key);
  return `${quoteAtom(key.slice(0, open))}${key.slice(open)}`;
}

function constraintVarNames(program: TranslateProgram): Map<string, string[]> {
  const names = new Map<string, string[]>();
  for (const c of program.constraints) {
    const ns: string[] = [];
    const visit = (t: import("../engine/terms.js").Term) => {
      if (t.kind === "var" && t.name !== "_" && !ns.includes(t.name)) ns.push(t.name);
      if (t.kind === "compound") t.args.forEach(visit);
    };
    for (const l of c.forall) {
      if (l.kind === "pos" || l.kind === "neg") l.args.forEach(visit);
      else if (l.kind === "in") {
        visit(l.item);
        visit(l.list);
      } else if (l.kind === "matches") visit(l.item);
      else if (l.kind === "cmp") {
        visit(l.left);
        visit(l.right);
      } else if (l.kind === "present") {
        visit(l.document);
        visit(l.candidates);
        visit(l.present);
      } else {
        visit(l.variable);
        for (const g of l.goal) {
          if (g.kind === "pos" || g.kind === "neg") g.args.forEach(visit);
        }
        visit(l.result);
      }
    }
    names.set(c.id, ns);
  }
  return names;
}

function emptyReport(extra: Partial<KernelReport> = {}): KernelReport {
  return {
    statuses: {},
    certain: {},
    populations: {},
    proofs: {},
    demand: { full: [], prefix: [] },
    missing: {},
    unfounded: {},
    ...extra,
  };
}

function parseReport(text: string, program: TranslateProgram): KernelReport {
  const names = constraintVarNames(program);
  const res = emptyReport();
  for (const c of program.constraints) res.statuses[c.id] = [];
  const row = (id: string, vals: string[], status?: string): Record<string, string> => {
    if (vals.length === 1 && vals[0] === "\x1dpopulation") {
      return { population: status === "violated" ? "empty" : "undetermined" };
    }
    return Object.fromEntries((names.get(id) ?? []).map((n, i) => [n, vals[i] as string]));
  };
  const nVars = (id: string) => (names.get(id) ?? []).length;
  for (const line of text.split("\n").filter(Boolean)) {
    const f = line.split(SEP);
    const kind = f[0];
    const id = f[1] as string;
    switch (kind) {
      case "status": {
        const status = f[2] as string;
        const rows = res.statuses[id] ?? (res.statuses[id] = []);
        rows.push({ ...row(id, f.slice(3), status), status });
        break;
      }
      case "certain":
        (res.certain[id] ??= []).push(row(id, f.slice(2)));
        break;
      case "population":
        res.populations[id] = { possible: Number(f[2]), certain: Number(f[3]) };
        break;
      case "proof": {
        const nv = nVars(id);
        const vals = f.slice(2, 2 + nv);
        const tree = f[2 + nv] ?? "";
        (res.proofs[id] ??= []).push({ values: row(id, vals), tree });
        break;
      }
      case "demand": {
        const policy = f[1] as "full" | "prefix";
        const atom = f[2] as string;
        res.demand[policy].push(atom);
        break;
      }
      case "missing": {
        const pathText = f[3] as string;
        const passed = f[4] as string;
        (res.missing[id] ??= []).push({
          ...row(id, f.slice(5)),
          literal: f[2] as string,
          path: pathText === "" ? [] : pathText.split("\x1e"),
          passed_u: passed === "" ? [] : passed.split("\x1e"),
        });
        break;
      }
      case "unresolvable":
        res.unresolvable ??= {};
        (res.unresolvable[id] ??= []).push(row(id, f.slice(2)));
        break;
      case "unfounded":
        (res.unfounded[id] ??= []).push({ ...row(id, f.slice(3)), atom: f[2] as string });
        break;
      case "verdict":
        if (f[1] !== undefined) res.verdict = f[1];
        break;
    }
  }
  res.demand.full = [...new Set(res.demand.full)].sort();
  res.demand.prefix = [...new Set(res.demand.prefix)].sort();
  return res;
}
