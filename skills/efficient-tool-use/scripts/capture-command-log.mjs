#!/usr/bin/env node
// Run a command while writing its combined output to a shareable log file.
// The command's exit status is returned unchanged; only JSON/subprocess-level
// failures are translated.

import { createWriteStream, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawn } from "node:child_process";

function usage() {
  console.error(
    "usage: capture-command-log.mjs --log <path> [--append] -- <command> [args...]",
  );
}

const argv = process.argv.slice(2);
let logPath = null;
let append = false;
let separator = -1;

for (let index = 0; index < argv.length; index += 1) {
  const arg = argv[index];
  if (arg === "--log") {
    logPath = argv[index + 1] ?? null;
    index += 1;
  } else if (arg === "--append") {
    append = true;
  } else if (arg === "--") {
    separator = index;
    break;
  } else if (arg === "--help" || arg === "-h") {
    usage();
    process.exit(0);
  } else {
    console.error(`input: unexpected argument before --: ${arg}`);
    usage();
    process.exit(64);
  }
}

if (logPath === null || separator < 0 || separator === argv.length - 1) {
  usage();
  process.exit(64);
}

const command = argv[separator + 1];
const args = argv.slice(separator + 2);
const absoluteLog = resolve(logPath);
mkdirSync(dirname(absoluteLog), { recursive: true });
const log = createWriteStream(absoluteLog, { flags: append ? "a" : "w" });

const write = (chunk) => {
  log.write(chunk);
  process.stdout.write(chunk);
};
const writeError = (chunk) => {
  log.write(chunk);
  process.stderr.write(chunk);
};

write(`$ ${[command, ...args].map((part) => JSON.stringify(part)).join(" ")}\n`);
write(`[cwd: ${process.cwd()}]\n`);
write(`[started: ${new Date().toISOString()}]\n`);

const child = spawn(command, args, {
  cwd: process.cwd(),
  env: process.env,
  stdio: ["inherit", "pipe", "pipe"],
});

child.stdout.on("data", write);
child.stderr.on("data", writeError);

child.on("error", (error) => {
  writeError(`[spawn-error: ${error.message}]\n`);
});

child.on("close", (code, signal) => {
  const status = code === null ? `signal:${String(signal)}` : String(code);
  write(`[exit: ${status}]\n`);
  log.end(() => {
    process.exit(code === null ? 1 : code);
  });
});
