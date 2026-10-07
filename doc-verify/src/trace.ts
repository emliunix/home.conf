/**
 * The tracing kit's TypeScript half (visflow design/19-tracing-kit.md §1-§3).
 *
 * `span(name, fields)`, `event(name, fields)` and `remark(code, at, why, fields)`; `enabled(name)`
 * is the filter for guarding field construction. Names are dot-separated class paths. The filter
 * is `DOC_VERIFY_TRACE` (a comma list of class globs), parsed once at first use; unset or empty
 * means off, and a disabled call allocates nothing of the kit's own. Sinks are chosen by
 * `DOC_VERIFY_TRACE_OUT`: `tree` (indented, on stderr) and `chrome:<path>` (Chrome trace-event
 * JSON). `configure(classes, sinks)` sets both directly, never by mutating the environment.
 */

import { writeFileSync } from "node:fs";

export type TraceFields = Record<string, unknown>;
export type TraceAt = { path: string; line: number; end_line?: number };

export interface TraceRecord {
  kind: "begin" | "end" | "event" | "remark";
  id?: string | undefined;
  parent?: string | null | undefined;
  span?: string | undefined;
  name?: string | undefined;
  cls?: string | undefined;
  code?: string | undefined;
  at?: TraceAt | undefined;
  why?: string | undefined;
  fields: TraceFields;
  ts_us: number;
  dur_us?: number | undefined;
}

export interface TraceSink {
  begin(record: TraceRecord): void;
  end(record: TraceRecord): void;
  event(record: TraceRecord): void;
  remark(record: TraceRecord): void;
}

const NOOP_SPAN: TraceSpan = { name: "", id: null, end(): void {} };

export interface TraceSpan {
  readonly name: string;
  readonly id: string | null;
  end(): void;
}

/** Whether any glob enables `name` or one of its dot-prefixes. */
function classEnabled(globs: string[], name: string): boolean {
  if (globs.length === 0) {
    return false;
  }
  const parts = name.split(".");
  const prefixes = parts.map((_part, index) => parts.slice(0, index + 1).join("."));
  return globs.some((glob) => prefixes.some((prefix) => globMatch(glob, prefix)));
}

function globMatch(glob: string, name: string): boolean {
  if (glob === "*") {
    return true;
  }
  const pattern = glob.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${pattern}$`).test(name);
}

class Kit {
  private globs: string[] | undefined;
  private sinks: TraceSink[] | undefined;
  private readonly cache = new Map<string, boolean>();
  private readonly stack: TraceSpan[] = [];
  private counter = 0;

  constructor(private readonly env: () => string | undefined) {}

  configure(classes: string[], sinks: TraceSink[]): void {
    this.globs = classes;
    this.sinks = sinks;
    this.cache.clear();
    this.counter = 0;
    this.stack.length = 0;
  }

  enabled(name: string): boolean {
    const known = this.cache.get(name);
    if (known !== undefined) {
      return known;
    }
    const value = classEnabled(this.globs ?? parseClasses(this.env() ?? ""), name);
    this.cache.set(name, value);
    return value;
  }

  span(name: string, fields: TraceFields = {}): TraceSpan {
    if (!this.enabled(name)) {
      return NOOP_SPAN;
    }
    const parent = this.stack[this.stack.length - 1] ?? null;
    const id = `s${(this.counter += 1)}`;
    const ts = nowMicros();
    const span: TraceSpan = { name, id, end: () => this.end(name, id, parent, fields, ts) };
    this.emit({ kind: "begin", id, parent: parent?.id ?? null, name, cls: firstSegment(name), fields, ts_us: ts });
    this.stack.push(span);
    return span;
  }

  private end(name: string, id: string, parent: TraceSpan | null, fields: TraceFields, ts: number): void {
    const index = this.stack.findIndex((entry) => entry.id === id);
    if (index >= 0) {
      this.stack.splice(index, 1);
    }
    this.emit({ kind: "end", id, parent: parent?.id ?? null, name, cls: firstSegment(name), fields,
      ts_us: ts, dur_us: nowMicros() - ts });
  }

  event(name: string, fields: TraceFields = {}): void {
    if (!this.enabled(name)) {
      return;
    }
    this.emit({ kind: "event", span: this.stack[this.stack.length - 1]?.id ?? undefined, name,
      cls: firstSegment(name), fields, ts_us: nowMicros() });
  }

  remark(code: string, at: TraceAt, why: string, fields: TraceFields = {}): void {
    if (!this.enabled(code)) {
      return;
    }
    this.emit({ kind: "remark", span: this.stack[this.stack.length - 1]?.id ?? undefined, code, at, why,
      fields, ts_us: nowMicros() });
  }

  private emit(record: TraceRecord): void {
    for (const sink of this.sinks ?? []) {
      sink[record.kind](record);
    }
  }
}

/** The indented tree on stderr: one line per span end, event and remark (design 19 §3). */
export class TreeSink implements TraceSink {
  private depth = 0;
  constructor(private readonly write: (line: string) => void = (line) => { process.stderr.write(`${line}\n`); }) {}

  private fieldsText(fields: TraceFields): string {
    const keys = Object.keys(fields).sort();
    return keys.map((key) => ` ${key}=${JSON.stringify(fields[key])}`).join("");
  }

  begin(): void {
    this.depth += 1;
  }

  end(record: TraceRecord): void {
    this.depth = Math.max(0, this.depth - 1);
    this.write(`${"  ".repeat(this.depth)}${record.name ?? ""} dur=${String(record.dur_us ?? 0)}us${this.fieldsText(record.fields)}`);
  }

  event(record: TraceRecord): void {
    this.write(`${"  ".repeat(this.depth)}${record.name ?? ""}${this.fieldsText(record.fields)}`);
  }

  remark(record: TraceRecord): void {
    const at = record.at;
    const where = at === undefined ? "" : ` at=${at.path}:${String(at.line)}${at.end_line === undefined ? "" : `-${String(at.end_line)}`}`;
    this.write(`${"  ".repeat(this.depth)}remark ${record.code ?? ""}${where} why=${JSON.stringify(record.why ?? "")}${this.fieldsText(record.fields)}`);
  }
}

/** Chrome trace-event JSON, written on process exit (design 19 §3). */
export class ChromeSink implements TraceSink {
  private readonly events: unknown[] = [];
  private readonly spans = new Map<string, number>();

  constructor(private readonly path: string) {
    process.on("exit", () => { this.flush(); });
  }

  private static args(record: TraceRecord): TraceFields {
    return { ...record.fields, ...(record.code === undefined ? {} : { code: record.code }),
      ...(record.at === undefined ? {} : { at: record.at }), ...(record.why === undefined ? {} : { why: record.why }) };
  }

  begin(record: TraceRecord): void {
    this.spans.set(record.id ?? "", record.ts_us);
  }

  end(record: TraceRecord): void {
    this.events.push({ ph: "X", ts: record.ts_us, dur: record.dur_us ?? 0, pid: 1, tid: 0,
      name: record.name ?? "", cat: record.cls ?? "", args: ChromeSink.args(record) });
  }

  event(record: TraceRecord): void {
    this.events.push({ ph: "i", ts: record.ts_us, pid: 1, tid: 0, name: record.name ?? "", cat: record.cls ?? "", args: ChromeSink.args(record) });
  }

  remark(record: TraceRecord): void {
    this.events.push({ ph: "i", ts: record.ts_us, pid: 1, tid: 0, name: "remark", cat: firstSegment(record.code ?? ""), args: ChromeSink.args(record) });
  }

  flush(): void {
    writeFileSync(this.path, `${JSON.stringify(this.events)}\n`, "utf8");
  }
}

function firstSegment(name: string): string {
  return name.split(".")[0] ?? name;
}

export function parseClasses(value: string): string[] {
  return value.split(",").map((part) => part.trim()).filter((part) => part.length > 0);
}

/** The sinks for an environment pair: off (none) unless a class is on, `tree` when OUT is unset. */
export function sinksFor(classes: string, out: string | undefined): TraceSink[] {
  if (parseClasses(classes).length === 0) {
    return [];
  }
  return out !== undefined && out.length > 0 ? sinksFromEnv(out) : [new TreeSink()];
}

function nowMicros(): number {
  return Date.now() * 1000;
}

/** The sinks `DOC_VERIFY_TRACE_OUT` names: `tree`, `chrome:<path>`, comma-separated (design 19 §3). */
export function sinksFromEnv(value: string, write: (line: string) => void = (line) => { process.stderr.write(`${line}\n`); }): TraceSink[] {
  const sinks: TraceSink[] = [];
  for (const part of value.split(",").map((entry) => entry.trim()).filter((entry) => entry.length > 0)) {
    if (part === "tree") {
      sinks.push(new TreeSink(write));
    } else if (part.startsWith("chrome:")) {
      sinks.push(new ChromeSink(part.slice("chrome:".length)));
    }
  }
  return sinks;
}

export const trace = new Kit(() => process.env["DOC_VERIFY_TRACE"]);

const rawClasses = process.env["DOC_VERIFY_TRACE"] ?? "";
const envSinks = sinksFor(rawClasses, process.env["DOC_VERIFY_TRACE_OUT"]);
if (envSinks.length > 0) {
  trace.configure(parseClasses(rawClasses), envSinks);
}
export const span = (name: string, fields?: TraceFields): TraceSpan => trace.span(name, fields ?? {});
export const event = (name: string, fields?: TraceFields): void => trace.event(name, fields ?? {});
export const remark = (code: string, at: TraceAt, why: string, fields?: TraceFields): void =>
  trace.remark(code, at, why, fields ?? {});
export const enabled = (name: string): boolean => trace.enabled(name);
export const configure = (classes: string[], sinks: TraceSink[]): void => trace.configure(classes, sinks);
