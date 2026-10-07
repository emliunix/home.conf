#!/usr/bin/env node
// Run a mutation command only when the inherited credential belongs to the
// expected child. A read-only child should not invoke this at all; a child
// with a named write path uses it as the last guard before every write.

import { spawnSync } from "node:child_process";

const EXIT_REFUSED = 1;
const EXIT_INPUT = 64;

function usage() {
  console.error(
    "usage: assert-child-identity.mjs --expected <agent-id> [--channel <name>] -- <command> [args...]",
  );
}

const argv = process.argv.slice(2);
let expected = null;
let channel = "unspecified";
let separator = -1;

for (let index = 0; index < argv.length; index += 1) {
  const arg = argv[index];
  if (arg === "--expected") {
    expected = argv[index + 1] ?? null;
    index += 1;
  } else if (arg === "--channel") {
    channel = argv[index + 1] ?? null;
    index += 1;
  } else if (arg === "--") {
    separator = index;
    break;
  } else if (arg === "--help" || arg === "-h") {
    usage();
    process.exit(0);
  } else {
    console.error(`INPUT: unexpected argument before --: ${arg}`);
    usage();
    process.exit(EXIT_INPUT);
  }
}

if (!expected || separator < 0 || separator === argv.length - 1) {
  usage();
  process.exit(EXIT_INPUT);
}

const actual = process.env.SLOCK_AGENT_ID ?? "";
if (actual === "" || actual !== expected) {
  console.error(
    `REFUSED: child identity mismatch on ${channel}; expected=${expected} actual=${actual || "<missing>"}`,
  );
  process.exit(EXIT_REFUSED);
}

console.error(`IDENTITY OK: child=${actual} channel=${channel}`);
const command = argv[separator + 1];
const args = argv.slice(separator + 2);
const result = spawnSync(command, args, { stdio: "inherit", env: process.env });
if (result.error) {
  console.error(`EXEC: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
