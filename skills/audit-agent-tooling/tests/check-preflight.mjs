#!/usr/bin/env node
// Focused cases for the corpus-subject boundary, including a mutation that
// removes the refusal and turns telemetry-only input into a clean zero.

import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const script = join(root, "scripts", "preflight-corpus.mjs");
const dir = mkdtempSync(join(tmpdir(), "audit-preflight-"));
const failures = [];

function check(condition, message) {
  if (!condition) failures.push(message);
}

function run(args) {
  return spawnSync(process.execPath, [script, ...args], { encoding: "utf8" });
}

function fixture(name, records) {
  const path = join(dir, name);
  writeFileSync(path, `${records.map((record) => JSON.stringify(record)).join("\n")}\n`);
  return path;
}

const telemetry = fixture("telemetry.jsonl", [
  { type: "runtime_lifecycle", timestamp: "2026-10-08T00:00:00Z" },
  { type: "runtime_terminal_cause", timestamp: "2026-10-08T00:00:01Z" },
]);
const conversation = fixture("conversation.jsonl", [
  {
    type: "message",
    timestamp: "2026-10-08T00:00:00Z",
    message: { role: "user", content: "hello" },
  },
  { type: "model_change", timestamp: "2026-10-08T00:00:01Z" },
]);
const oldConversation = fixture("old.jsonl", [
  {
    type: "message",
    timestamp: "2026-10-01T00:00:00Z",
    message: { role: "user", content: "old" },
  },
]);

const telemetryRun = run(["--since", "2026-10-08T00:00:00Z", telemetry]);
check(telemetryRun.status === 1, `telemetry-only corpus must exit 1, got ${telemetryRun.status}`);
check(/REFUSED/.test(telemetryRun.stderr), "telemetry refusal must say REFUSED");
check(/runtime_lifecycle/.test(telemetryRun.stderr), "refusal must name the observed record types");
check(
  /"since": "2026-10-08T00:00:00.000Z"/.test(telemetryRun.stdout),
  "output must name the active since",
);

const allowRun = run(["--since", "2026-10-08T00:00:00Z", "--allow-empty", telemetry]);
check(allowRun.status === 0, `--allow-empty must pass, got ${allowRun.status}`);
check(/explicit --allow-empty/.test(allowRun.stderr), "--allow-empty must be named in the receipt");

const conversationRun = run(["--since", "2026-10-08T00:00:00Z", conversation]);
check(conversationRun.status === 0, `conversation corpus must pass, got ${conversationRun.status}`);
check(/"recognizedInWindow": 1/.test(conversationRun.stdout), "conversation count must be reported");
check(/"model_change": 1/.test(conversationRun.stdout), "ignored record types must remain visible");

const oldRun = run(["--since", "2026-10-08T00:00:00Z", oldConversation]);
check(oldRun.status === 1, `out-of-window conversation must refuse, got ${oldRun.status}`);
check(/"outOfWindow": 1/.test(oldRun.stdout), "out-of-window count must be reported");

const mutated = join(dir, "preflight-mutated.mjs");
const source = readFileSync(script, "utf8");
const marker = "if (summary.recognizedInWindow === 0 && !options.allowEmpty) {";
check(source.includes(marker), "mutation marker must exist");
writeFileSync(mutated, source.replace(marker, "if (false) {"));
const mutatedRun = spawnSync(
  process.execPath,
  [mutated, "--since", "2026-10-08T00:00:00Z", telemetry],
  { encoding: "utf8" },
);
check(mutatedRun.status === 0, "removing the refusal must turn telemetry-only input green");

rmSync(dir, { recursive: true, force: true });
if (failures.length > 0) {
  for (const failure of failures) console.error(`FAIL: ${failure}`);
  process.exit(1);
}
console.log("preflight-corpus: 5 cases pass; refusal mutation red");
