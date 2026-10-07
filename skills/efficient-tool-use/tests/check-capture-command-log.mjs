#!/usr/bin/env node
// The wrapper must preserve stdout, stderr, and the checked command's exit code
// while producing one shareable log file.

import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const script = join(root, "scripts", "capture-command-log.mjs");
const dir = mkdtempSync(join(tmpdir(), "capture-command-log-"));
const log = join(dir, "run.log");
const failures = [];

function check(condition, message) {
  if (!condition) failures.push(message);
}

const childCode = [
  "console.log('stdout marker');",
  "console.error('stderr marker');",
  "process.exit(7);",
].join(" ");
const run = spawnSync(
  process.execPath,
  [script, "--log", log, "--", process.execPath, "-e", childCode],
  { encoding: "utf8" },
);

check(run.status === 7, `wrapper must return the checked command's exit 7, got ${run.status}`);
check(existsSync(log), "wrapper must create the log file");
const text = readFileSync(log, "utf8");
check(text.includes("stdout marker"), "log must contain stdout");
check(text.includes("stderr marker"), "log must contain stderr");
check(text.startsWith("$ "), "log must begin with the checked command");
check(/\[exit: 7\]/.test(text), "log must record the checked command's exit status");

rmSync(dir, { recursive: true, force: true });
if (failures.length > 0) {
  for (const failure of failures) console.error(`FAIL: ${failure}`);
  process.exit(1);
}
console.log("capture-command-log: output and exit status preserved");
