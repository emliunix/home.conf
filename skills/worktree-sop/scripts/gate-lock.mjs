#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import {
  closeSync,
  openSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const EXIT = {
  completed: 0,
  lock_timeout: 75,
  invalid_input: 64,
};

function usage() {
  return [
    "Usage: gate-lock.mjs [options] -- <command> [args...]",
    "",
    "Options:",
    "  --lock-file <path>  Lock path (default: $HOME_CONF_GATE_LOCK or tmp).",
    "  --timeout-ms <n>    Maximum wait for the lock (default: 1200000).",
    "  --stale-ms <n>      Age after which a lock is stale (default: 1800000).",
    "  --poll-ms <n>       Poll interval (default: 250).",
    "  --help              Show this help.",
  ].join("\n");
}

function parseArgs(argv) {
  const options = {
    lockFile:
      process.env.HOME_CONF_GATE_LOCK ||
      join(tmpdir(), "home-conf-heavy-gate.lock"),
    timeoutMs: 20 * 60 * 1000,
    staleMs: 30 * 60 * 1000,
    pollMs: 250,
  };
  let i = 0;
  for (; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--") {
      i += 1;
      break;
    }
    if (arg === "--help" || arg === "-h") options.help = true;
    else if (arg === "--lock-file") options.lockFile = argv[++i];
    else if (arg === "--timeout-ms") options.timeoutMs = Number(argv[++i]);
    else if (arg === "--stale-ms") options.staleMs = Number(argv[++i]);
    else if (arg === "--poll-ms") options.pollMs = Number(argv[++i]);
    else throw new Error(`unknown argument: ${arg}`);
  }
  options.command = argv.slice(i);
  return options;
}

function emit(state, extra, exitCode) {
  process.stdout.write(
    `${JSON.stringify({ wrapper: "gate-lock", state, ...extra })}\n`,
  );
  process.exitCode = exitCode;
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function readLock(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return undefined;
  }
}

function pidIsAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === "EPERM";
  }
}

function lockIsStale(lock, path, staleMs) {
  if (!lock || !pidIsAlive(lock.pid)) return true;
  try {
    return Date.now() - statSync(path).mtimeMs >= staleMs;
  } catch {
    return true;
  }
}

function quarantine(path) {
  const stalePath = `${path}.stale.${process.pid}.${randomUUID()}`;
  try {
    renameSync(path, stalePath);
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
  try {
    unlinkSync(stalePath);
  } catch {
    // The stale holder has already been displaced; an unlink failure is non-fatal.
  }
  return true;
}

function acquire(options) {
  const deadline = Date.now() + options.timeoutMs;
  const token = randomUUID();
  const metadata = {
    token,
    pid: process.pid,
    command: options.command.join(" "),
    startedAt: new Date().toISOString(),
  };
  while (true) {
    try {
      const fd = openSync(options.lockFile, "wx", 0o600);
      writeSync(fd, `${JSON.stringify(metadata)}\n`);
      closeSync(fd);
      return { token };
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
    }

    const current = readLock(options.lockFile);
    if (lockIsStale(current, options.lockFile, options.staleMs)) {
      quarantine(options.lockFile);
      continue;
    }
    if (Date.now() >= deadline) return undefined;
    sleep(Math.min(options.pollMs, Math.max(1, deadline - Date.now())));
  }
}

function release(path, token) {
  const current = readLock(path);
  if (current?.token !== token) return;
  try {
    unlinkSync(path);
  } catch {
    // Another recovering process already displaced this lock.
  }
}

function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    emit("invalid_input", { error: error.message }, EXIT.invalid_input);
    return;
  }
  if (options.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  if (
    !options.command.length ||
    !Number.isFinite(options.timeoutMs) ||
    options.timeoutMs < 0 ||
    !Number.isFinite(options.staleMs) ||
    options.staleMs < 1 ||
    !Number.isFinite(options.pollMs) ||
    options.pollMs < 1
  ) {
    emit(
      "invalid_input",
      { error: "a command is required and all bounds must be positive" },
      EXIT.invalid_input,
    );
    return;
  }
  options.lockFile = resolve(options.lockFile);

  let acquired;
  try {
    acquired = acquire(options);
  } catch (error) {
    emit("invalid_input", { error: error.message }, EXIT.invalid_input);
    return;
  }
  if (!acquired) {
    emit(
      "lock_timeout",
      { lockFile: options.lockFile, timeoutMs: options.timeoutMs },
      EXIT.lock_timeout,
    );
    return;
  }

  const startedAt = new Date().toISOString();
  const result = spawnSync(options.command[0], options.command.slice(1), {
    stdio: "inherit",
    env: process.env,
  });
  const exitCode = result.status ?? 1;
  release(options.lockFile, acquired.token);
  emit(
    "completed",
    {
      pid: process.pid,
      command: options.command.join(" "),
      exitCode,
      acquiredAt: startedAt,
      releasedAt: new Date().toISOString(),
    },
    exitCode,
  );
}

main();
