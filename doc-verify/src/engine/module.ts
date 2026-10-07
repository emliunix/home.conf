/**
 * Loads a `verification-module` (design 04 §Modules and references) and has the
 * runtime's Prolog reader parse every head and body.
 */

import { parse as parseYaml } from "yaml";
import { z } from "zod";

import { sha256 } from "../hash.js";
import { runPureDml } from "./prolog.js";
import { prologString, readCanonical, type Term } from "./terms.js";

const paramValue = z.union([z.string(), z.number(), z.array(z.union([z.string(), z.number()]))]);

const oracleSchema = z.object({
  choose: z.array(z.string().regex(/^[a-z][a-z0-9_]*$/)).min(2).optional(),
  ask: z.string().min(1),
  evidence: z.string().min(1),
  threshold: z.number().min(0).max(1).optional(),
  max_bytes: z.number().int().positive().optional(),
}).strict();

const constraintSchema = z.object({
  forall: z.string().min(1),
  require: z.string().min(1).optional(),
  forbid: z.string().min(1).optional(),
  severity: z.enum(["error", "warning"]),
  weight: z.number().positive().optional(),
  message: z.string().optional(),
  repair: z.string().optional(),
  profiles: z.array(z.string()).optional(),
  /**
   * `nonempty`: a forall that binds nothing violates the constraint. By default an empty
   * population is vacuously satisfied and silent.
   */
  population: z.literal("nonempty").optional(),
}).strict();

const importSchema = z.union([z.string(), z.object({ module: z.string(), params: z.record(z.string(), paramValue).optional() }).strict()]);

export const moduleSchema = z.object({
  schema_version: z.literal(2),
  kind: z.literal("verification-module"),
  module: z.string().min(1),
  imports: z.record(z.string().regex(/^[a-z][a-z0-9_]*$/), importSchema).optional(),
  params: z.record(z.string().regex(/^[a-z][a-z0-9_]*$/), paramValue).optional(),
  extends: z.array(z.string()).optional(),
  exports: z.array(z.string()).optional(),
  rounds: z.number().int().min(1).optional(),
  warning_threshold: z.number().min(0).max(1).optional(),
  oracles: z.record(z.string(), oracleSchema).optional(),
  rules: z.record(z.string(), z.string().min(1)).optional(),
  constraints: z.record(z.string().regex(/^[a-z][a-z0-9-]*$/), constraintSchema).optional(),
  waive: z.record(z.string(), z.string()).optional(),
}).strict();

export type ModuleSource = z.infer<typeof moduleSchema>;
export type OracleSource = z.infer<typeof oracleSchema>;
export type ConstraintSource = z.infer<typeof constraintSchema>;

export class ModuleError extends Error {
  constructor(readonly issues: string[]) {
    super(issues.join("; "));
  }
}

/** A module whose texts the Prolog reader has parsed; the checker consumes it. */
export interface ParsedModule {
  source: ModuleSource;
  hash: string;
  rounds: number;
  params: Record<string, Term>;
  oracles: Array<{ name: string; head: Term; source: OracleSource; evidence: Term }>;
  rules: Array<{ head: Term; body: Term; text: string }>;
  constraints: Array<{ id: string; forall: Term; goal: Term; mode: "require" | "forbid"; source: ConstraintSource }>;
}

export async function loadModule(yamlText: string): Promise<ParsedModule> {
  const parsed = moduleSchema.safeParse(parseYaml(yamlText));
  if (!parsed.success) {
    throw new ModuleError(parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`));
  }
  const source = parsed.data;
  const issues: string[] = [];
  for (const [alias, reference] of Object.entries(source.imports ?? {})) {
    if (!(alias === "core" && reference === "doc-verify:core")) {
      issues.push(`imports.${alias}: only \`core: doc-verify:core\` is available in this engine`);
    }
  }
  if ((source.extends ?? []).length > 0 || Object.keys(source.waive ?? {}).length > 0) {
    issues.push("extends and waive are not available in this engine");
  }
  for (const [id, constraint] of Object.entries(source.constraints ?? {})) {
    if ((constraint.require === undefined) === (constraint.forbid === undefined)) {
      issues.push(`constraints.${id}: exactly one of require or forbid is needed`);
    }
  }
  if (issues.length > 0) {
    throw new ModuleError(issues);
  }

  const params = Object.fromEntries(Object.entries(source.params ?? {}).map(([name, value]) => [name, paramTerm(value)]));
  const texts: Array<{ label: string; text: string }> = [];
  const oracleEntries = Object.entries(source.oracles ?? {});
  const ruleEntries = Object.entries(source.rules ?? {});
  const constraintEntries = Object.entries(source.constraints ?? {});
  for (const [head, oracle] of oracleEntries) {
    texts.push({ label: `oracles.${head}`, text: head }, { label: `oracles.${head}.evidence`, text: oracle.evidence });
  }
  for (const [head, body] of ruleEntries) {
    texts.push({ label: `rules.${head}`, text: head }, { label: `rules.${head}.body`, text: body });
  }
  for (const [id, constraint] of constraintEntries) {
    texts.push({ label: `constraints.${id}.forall`, text: constraint.forall });
    texts.push({ label: `constraints.${id}.goal`, text: constraint.require ?? constraint.forbid ?? "" });
  }
  const terms = await readTexts(texts.map((entry) => ({ ...entry, text: substitute(entry.text, source.params ?? {}, issues, entry.label) })));
  if (issues.length > 0) {
    throw new ModuleError(issues);
  }
  let cursor = 0;
  const next = (): Term => {
    const term = terms[cursor];
    cursor += 1;
    if (term === undefined) {
      throw new ModuleError(["the reader returned fewer terms than requested"]);
    }
    return term;
  };
  const oracles = oracleEntries.map(([name, oracle]) => {
    const head = next();
    const evidence = next();
    return { name: head.kind === "compound" ? head.functor : name, head, source: oracle, evidence };
  });
  const rules = ruleEntries.map(([, text]) => ({ head: next(), body: next(), text }));
  const constraints = constraintEntries.map(([id, constraint]) => ({
    id,
    forall: next(),
    goal: next(),
    mode: constraint.require === undefined ? "forbid" as const : "require" as const,
    source: constraint,
  }));
  return { source, hash: sha256(yamlText), rounds: source.rounds ?? 1, params, oracles, rules, constraints };
}

function paramTerm(value: string | number | Array<string | number>): Term {
  if (Array.isArray(value)) {
    return value.map(paramTerm).reduceRight<Term>((tail, head) => ({ kind: "compound", functor: ".", args: [head, tail] }), { kind: "atom", name: "[]" });
  }
  return typeof value === "number" ? { kind: "number", value } : { kind: "atom", name: value };
}

function paramText(value: string | number | Array<string | number>): string {
  if (Array.isArray(value)) {
    return `[${value.map(paramText).join(",")}]`;
  }
  return typeof value === "number" ? String(value) : quotedAtom(value);
}

function quotedAtom(value: string): string {
  return /^[a-z][A-Za-z0-9_]*$/.test(value) ? value : `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

/** `$name` becomes the param's term text; `alias.name(` becomes `alias:name(` for the reader. */
function substitute(text: string, params: Record<string, string | number | Array<string | number>>, issues: string[], label: string): string {
  const withParams = text.replace(/\$([a-z][a-z0-9_]*)/g, (_match, name: string) => {
    const value = params[name];
    if (value === undefined) {
      issues.push(`${label}: unknown param $${name}`);
      return "[]";
    }
    return paramText(value);
  });
  return withParams.replace(/\b([a-z][a-z0-9_]*)\.([a-z][a-z0-9_]*)\(/g, "$1:$2(");
}

const SEPARATOR = "\u001e";

/** The runtime's reader parses each text; a syntax error names the text that failed. */
async function readTexts(texts: Array<{ label: string; text: string }>): Promise<Term[]> {
  if (texts.length === 0) {
    return [];
  }
  const program = [
    "agent_main :-",
    "    op(700, xfx, in), op(900, fy, not),",
    `    dv_read_all([${texts.map((entry) => prologString(entry.text)).join(", ")}], Parts),`,
    `    atomic_list_concat(Parts, ${prologString(SEPARATOR)}, Out),`,
    "    answer(Out).",
    "",
    "dv_read_all([], []).",
    "dv_read_all([Text|Texts], [Part|Parts]) :- dv_read(Text, Part), dv_read_all(Texts, Parts).",
    "",
    "dv_read(Text, Part) :-",
    "    catch(term_string(Term, Text, [variable_names(Names)]), _, fail),",
    "    !,",
    "    dv_bind_names(Names),",
    "    with_output_to(string(Part), write_canonical(Term)).",
    "dv_read(_, \"dv_syntax_error\").",
    "",
    "dv_bind_names([]).",
    "dv_bind_names([Name=Var|Rest]) :- Var = '$VAR'(Name), dv_bind_names(Rest).",
    "",
  ].join("\n");
  const output = await runPureDml(program);
  const parts = output.split(SEPARATOR);
  if (parts.length !== texts.length) {
    throw new ModuleError([`the reader returned ${String(parts.length)} terms for ${String(texts.length)} texts`]);
  }
  const issues: string[] = [];
  const terms: Term[] = [];
  for (const [index, part] of parts.entries()) {
    const entry = texts[index] as { label: string; text: string };
    if (part === "dv_syntax_error") {
      issues.push(`${entry.label}: syntax error in ${JSON.stringify(entry.text)}`);
      continue;
    }
    try {
      terms.push(readCanonical(part));
    } catch (error) {
      issues.push(`${entry.label}: ${error instanceof Error ? error.message : "unreadable term"}`);
    }
  }
  if (issues.length > 0) {
    throw new ModuleError(issues);
  }
  return terms;
}
