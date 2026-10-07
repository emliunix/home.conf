#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const EXIT = {
  matched: 0,
  bound_reached: 2,
  check_failed: 3,
  invalid_input: 4,
};

function parseArgs(argv) {
  const options = {
    maxChecks: 3,
    intervalMs: 0,
    raftBin: process.env.RAFT_BIN || "raft",
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--until") options.until = argv[++i];
    else if (arg === "--max-checks") options.maxChecks = Number(argv[++i]);
    else if (arg === "--interval-ms") options.intervalMs = Number(argv[++i]);
    else if (arg === "--raft-bin") options.raftBin = argv[++i];
    else throw new Error(`unknown argument: ${arg}`);
  }
  return options;
}

function emit(state, checks, extra = {}) {
  process.stdout.write(
    `${JSON.stringify({ wrapper: "raft-inbox", state, checks, ...extra })}\n`,
  );
  process.exitCode = EXIT[state] ?? EXIT.check_failed;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    emit("invalid_input", 0, { error: error.message });
    return;
  }
  if (
    !options.until ||
    !Number.isInteger(options.maxChecks) ||
    options.maxChecks < 1 ||
    options.maxChecks > 3 ||
    !Number.isInteger(options.intervalMs) ||
    options.intervalMs < 0
  ) {
    emit("invalid_input", 0, {
      error: "--until is required; --max-checks must be an integer from 1 to 3",
    });
    return;
  }

  let matcher;
  try {
    matcher = new RegExp(options.until, "m");
  } catch (error) {
    emit("invalid_input", 0, { error: `--until is not a valid regular expression: ${error.message}` });
    return;
  }

  let checks = 0;
  while (checks < options.maxChecks) {
    checks += 1;
    const result = spawnSync(options.raftBin, ["message", "check"], {
      encoding: "utf8",
      maxBuffer: 8 * 1024 * 1024,
    });
    const output = `${result.stdout || ""}${result.stderr || ""}`;
    if (output) process.stderr.write(output);
    if (result.error || result.status !== 0) {
      emit("check_failed", checks, {
        status: result.status ?? 1,
        error: result.error?.message,
      });
      return;
    }
    if (matcher.test(output)) {
      emit("matched", checks);
      return;
    }
    if (checks < options.maxChecks && options.intervalMs > 0) {
      await sleep(options.intervalMs);
    }
  }
  emit("bound_reached", checks);
}

await main();
