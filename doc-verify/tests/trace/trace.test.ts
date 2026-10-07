import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { ChromeSink, TreeSink, configure, enabled, event, parseClasses, remark, sinksFor, span } from "../../src/trace.js";
import type { TraceRecord, TraceSink } from "../../src/trace.js";

function runScript(lines: string[]): void {
  const tree = new TreeSink((line) => { lines.push(line); });
  configure(["surface", "interp.turn"], [tree]);
  const outer = span("surface.elab.lower");
  event("surface.elab.step", { n: 1 });
  remark("surface.elab.lower.edge", { path: "x.flow.md", line: 3 }, "edge lowered to filter");
  const inner = span("interp.turn");
  event("interp.turn.step");
  inner.end();
  const off = span("dv.oracles.ask");
  event("dv.oracles.ask.step");
  off.end();
  outer.end();
}

describe("trace filter", () => {
  it("enables a class and its prefixes, not siblings", () => {
    configure(["surface"], []);
    expect(enabled("surface.elab.lower")).toBe(true);
    expect(enabled("interp.turn")).toBe(false);
  });

  it("treats a disabled span as a shared no-op that emits nothing", () => {
    const lines: string[] = [];
    configure(["surface"], [new TreeSink((line) => { lines.push(line); })]);
    span("interp.turn").end();
    event("interp.turn.step");
    expect(lines).toEqual([]);
  });
});

describe("trace record shape", () => {
  it("emits span: null for an event outside any span, as the Python half does", () => {
    const records: TraceRecord[] = [];
    const sink: TraceSink = {
      begin: (record) => { records.push(record); }, end: (record) => { records.push(record); },
      event: (record) => { records.push(record); }, remark: (record) => { records.push(record); },
    };
    configure(["dv"], [sink]);
    event("dv.oracles.ask.step");
    expect(Object.keys(records[0] ?? {})).toContain("span");
    expect(records[0]?.["span"]).toBeNull();
    expect(JSON.stringify(records[0])).toContain('"span":null');
  });
});

describe("trace environment wiring", () => {
  it("strips spaces around the comma list", () => {
    expect(parseClasses("surface, interp.turn")).toEqual(["surface", "interp.turn"]);
    expect(parseClasses("")).toEqual([]);
  });

  it("defaults to the tree sink when classes are on and OUT is unset", () => {
    expect(sinksFor("surface", undefined)).toEqual([expect.any(TreeSink)]);
  });

  it("is off (no sinks) when no class is on, whatever OUT says", () => {
    expect(sinksFor("", "tree")).toEqual([]);
  });
});

describe("trace tree sink", () => {
  it("prints the scripted sequence, timing excepted", () => {
    const lines: string[] = [];
    runScript(lines);
    const timed = lines.map((line) => line.replace(/dur=\d+us/g, "dur=<N>us"));
    expect(timed).toEqual([
      "  surface.elab.step n=1",
      '  remark surface.elab.lower.edge at=x.flow.md:3 why="edge lowered to filter"',
      "    interp.turn.step",
      "  interp.turn dur=<N>us",
      "surface.elab.lower dur=<N>us",
    ]);
  });
});

describe("trace chrome sink", () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("writes parseable trace-event JSON with the required keys", () => {
    const dir = mkdtempSync(join(tmpdir(), "dv-trace-"));
    dirs.push(dir);
    const path = join(dir, "t.json");
    const chrome = new ChromeSink(path);
    configure(["surface", "interp.turn"], [chrome]);
    const outer = span("surface.elab.lower");
    const inner = span("interp.turn");
    inner.end();
    outer.end();
    chrome.flush();
    const events = JSON.parse(readFileSync(path, "utf8")) as Array<Record<string, unknown>>;
    expect(events).toHaveLength(2);
    for (const record of events) {
      expect(record).toMatchObject({ ph: "X", pid: 1, tid: 0 });
      expect(typeof record["ts"]).toBe("number");
      expect(typeof record["dur"]).toBe("number");
    }
    expect(events.map((record) => [record["name"], record["cat"]])).toEqual([
      ["interp.turn", "interp"],
      ["surface.elab.lower", "surface"],
    ]);
  });
});
