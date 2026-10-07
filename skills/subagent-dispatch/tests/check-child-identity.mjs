#!/usr/bin/env node
// Focused cases for the child identity mutation boundary. The mutation removes
// the identity comparison from a copy and proves the mismatch path is the guard
// that prevents the command from running.

import {
  existsSync,
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
const script = join(root, "scripts", "assert-child-identity.mjs");
const dir = mkdtempSync(join(tmpdir(), "subagent-identity-"));
const failures = [];
const parentId = "parent-agent";
const childId = "child-agent";

function check(condition, message) {
  if (!condition) failures.push(message);
}

function markerPath(name) {
  return join(dir, name);
}

function markerCommand(path) {
  return [
    process.execPath,
    "-e",
    `require("node:fs").writeFileSync(${JSON.stringify(path)}, "ran\\n")`,
  ];
}

function run(identity, marker, executable = script) {
  const env = { ...process.env };
  if (identity === null) delete env.SLOCK_AGENT_ID;
  else env.SLOCK_AGENT_ID = identity;
  return spawnSync(
    process.execPath,
    [executable, "--expected", childId, "--channel", "git-push", "--", ...markerCommand(marker)],
    { encoding: "utf8", env },
  );
}

const goodMarker = markerPath("good");
const good = run(childId, goodMarker);
check(good.status === 0, `matching child identity must pass, got ${good.status}`);
check(readFileSync(goodMarker, "utf8") === "ran\n", "matching identity must execute the command");

const mismatchMarker = markerPath("mismatch");
const mismatch = run(parentId, mismatchMarker);
check(mismatch.status === 1, `parent identity must refuse, got ${mismatch.status}`);
check(/REFUSED: child identity mismatch/.test(mismatch.stderr), "mismatch must be refused by name");
check(!existsSync(mismatchMarker), "mismatch must not execute the command");

const missingMarker = markerPath("missing");
const missing = run(null, missingMarker);
check(missing.status === 1, `missing identity must refuse, got ${missing.status}`);
check(/<missing>/.test(missing.stderr), "missing identity must be named");
check(!existsSync(missingMarker), "missing identity must not execute the command");

const mutated = join(dir, "assert-child-identity-mutated.mjs");
const source = readFileSync(script, "utf8");
const marker = "if (actual === \"\" || actual !== expected) {";
check(source.includes(marker), "mutation marker must exist");
writeFileSync(mutated, source.replace(marker, "if (false) {"));
const mutatedMarker = markerPath("mutated");
const mutatedRun = run(parentId, mutatedMarker, mutated);
check(mutatedRun.status === 0, "removing the identity check must let the command run");
check(readFileSync(mutatedMarker, "utf8") === "ran\n", "mutation must prove the red is the guard");

rmSync(dir, { recursive: true, force: true });
if (failures.length > 0) {
  for (const failure of failures) console.error(`FAIL: ${failure}`);
  process.exit(1);
}
console.log("child-identity: 5 cases pass; mismatch mutation red");
