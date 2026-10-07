import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

import { ChromeSink, TreeSink, configure, event, remark, span } from "../../src/trace.js";
import type { TraceRecord, TraceSink } from "../../src/trace.js";

/**
 * The shared fixture (visflow design/19-tracing-kit.md § Verification). The copy under
 * `tests/fixtures/trace/` is vendored from visflow `tests/fixtures/trace/`; the hash pins below turn
 * red on whichever side drifts.
 */
const FIXTURE = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "trace");

const SOURCE_SHA256: Record<string, string> = {
  "script.md": "3b7ec3170f426e3dd5db0cfdf3c7c5b1156384839c72b51de452d5956c72497e",
  "tree.txt": "7adbd6df9db03f80cc34398bd8c816c5447e38958c893b8057b37e776ebb9968",
  "sink.jsonl": "39df663c7daaa05164236f41c65eeea93093f6472b2fbfde44e6bffaf71e8447",
  "chrome.json": "940794560e87bdb883801b08d0059028346ca2f60a398184745a805637c0700b",
};

/** The sink-protocol dict stream, serialised as the fixture's `sink.jsonl` (timing keys at 0). */
class JsonlSink implements TraceSink {
  readonly lines: string[] = [];

  private add(record: TraceRecord): void {
    const zeroed: TraceRecord = { ...record, ts_us: 0, ...(record.dur_us === undefined ? {} : { dur_us: 0 }) };
    this.lines.push(JSON.stringify(zeroed));
  }

  begin(record: TraceRecord): void { this.add(record); }
  end(record: TraceRecord): void { this.add(record); }
  event(record: TraceRecord): void { this.add(record); }
  remark(record: TraceRecord): void { this.add(record); }
}

const script = (): { tree: string[]; jsonl: string[]; chrome: ChromeSink } => {
  const tree: string[] = [];
  const jsonl = new JsonlSink();
  const chrome = new ChromeSink(chromePath);
  configure(["surface", "interp.turn"], [jsonl, new TreeSink((line) => { tree.push(line); }), chrome]);
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
  return { tree, jsonl: jsonl.lines, chrome };
};

const dirs: string[] = [];
let chromePath = "";
afterEach(() => {
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function newChromePath(): string {
  const dir = mkdtempSync(join(tmpdir(), "dv-trace-conf-"));
  dirs.push(dir);
  return join(dir, "t.json");
}

const fixture = (name: string): string => readFileSync(join(FIXTURE, name), "utf8");

describe("the vendored fixture is pinned to its source revision", () => {
  for (const [name, digest] of Object.entries(SOURCE_SHA256)) {
    it(`${name} matches the recorded sha256`, () => {
      expect(createHash("sha256").update(fixture(name)).digest("hex")).toBe(digest);
    });
  }
});

describe("the TS half reproduces the shared fixture", () => {
  it("tree.txt, timing excepted", () => {
    chromePath = newChromePath();
    const { tree } = script();
    const normalised = tree.map((line) => line.replace(/dur=\d+us/g, "dur=<N>us"));
    expect(normalised.join("\n")).toBe(fixture("tree.txt").trimEnd());
  });

  it("sink.jsonl, byte for byte", () => {
    chromePath = newChromePath();
    const { jsonl } = script();
    expect(jsonl.join("\n")).toBe(fixture("sink.jsonl").trimEnd());
  });

  it("chrome.json, timing excepted", () => {
    chromePath = newChromePath();
    const { chrome } = script();
    chrome.flush();
    const produced = JSON.parse(readFileSync(chromePath, "utf8")) as Array<Record<string, unknown>>;
    const expected = JSON.parse(fixture("chrome.json")) as Array<Record<string, unknown>>;
    const drop = (records: Array<Record<string, unknown>>): Array<Record<string, unknown>> =>
      records.map(({ ts: _ts, dur: _dur, ...rest }) => rest);
    expect(drop(produced)).toEqual(drop(expected));
  });
});
