#!/usr/bin/env node

import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const WRAPPER = join(ROOT, "scripts", "raft-send.mjs");
const INBOX = join(ROOT, "scripts", "raft-inbox.mjs");
const MOCK = join(ROOT, "tests", "mock-raft.mjs");
const failures = [];

function fail(message) {
  failures.push(message);
}

function read(path) {
  return readFileSync(join(ROOT, path), "utf8");
}

function checkSurface() {
  const skill = read("SKILL.md");
  const frontMatter = skill.match(/^---\n([\s\S]*?)\n---\n/);
  if (!frontMatter) fail("SKILL.md: missing frontmatter");
  else {
    if (!/^name:\s*raft-cookbook\s*$/m.test(frontMatter[1])) {
      fail("SKILL.md: frontmatter name is not raft-cookbook");
    }
    if (!/^description:/m.test(frontMatter[1])) {
      fail("SKILL.md: frontmatter has no description");
    }
  }
  for (const target of ["references/send.md", "references/inbox.md"]) {
    if (!skill.includes(`(${target})`)) fail(`SKILL.md: missing link to ${target}`);
    if (!existsSync(join(ROOT, target))) fail(`missing ${target}`);
  }
  for (const target of ["scripts/raft-send.mjs", "scripts/raft-inbox.mjs"]) {
    if (!skill.includes(target)) fail(`SKILL.md: missing command surface ${target}`);
  }
}

function runFixture(scenario, args, input) {
  const dir = mkdtempSync(join(tmpdir(), "raft-cookbook-"));
  const state = join(dir, "state.json");
  const mockBin = join(dir, "raft");
  writeFileSync(
    mockBin,
    `#!/bin/sh\nexec "${process.execPath}" "${MOCK}" "$@"\n`,
    { mode: 0o755 },
  );
  const result = spawnSync(process.execPath, [WRAPPER, ...args], {
    input,
    encoding: "utf8",
    env: {
      ...process.env,
      RAFT_BIN: mockBin,
      MOCK_RAFT_SCENARIO: scenario,
      MOCK_RAFT_STATE: state,
    },
  });
  const calls = existsSync(state) ? JSON.parse(readFileSync(state, "utf8")) : [];
  rmSync(dir, { recursive: true, force: true });
  return { result, calls, payload: JSON.parse(result.stdout.trim()) };
}

function checkSendFixtures() {
  const base = ["--target", "#test"];
  const delivered = runFixture("delivered", base, "body");
  if (delivered.result.status !== 0 || delivered.payload.state !== "delivered") {
    fail("delivered fixture did not report delivered");
  }

  const held = runFixture("held", base, "body");
  if (held.result.status !== 0 || held.payload.state !== "held_then_delivered") {
    fail(
      `held fixture did not replay the saved draft once: ${held.result.stdout}${held.result.stderr}`,
    );
  }
  if (!held.calls.length) return;
  const replay = held.calls.at(-1);
  if (!replay.args.includes("--send-draft") || replay.args.includes("body")) {
    fail("held fixture did not use the saved draft");
  }
  if (!replay.args.includes("--expected-draft-key") || replay.body !== "") {
    fail("held fixture did not bind the draft key and avoid recomposition");
  }
  if (held.calls.filter((call) => call.args[1] === "send").length !== 2) {
    fail("held fixture did not stop at one saved-draft replay");
  }

  const transport = runFixture("transport", base, "body");
  if (
    transport.result.status !== 3 ||
    transport.payload.state !== "transport_uncertain" ||
    transport.calls.filter((call) => call.args[1] === "send").length !== 1
  ) {
    fail("transport fixture retried an uncertain send");
  }

  const invalid = runFixture("invalid", base, "body");
  if (invalid.result.status !== 4 || invalid.payload.state !== "invalid_input") {
    fail("invalid-input fixture was not classified as invalid input");
  }

  const mention = runFixture("mention-gap", base, "body");
  if (
    mention.result.status !== 6 ||
    mention.payload.state !== "delivered_with_mention_gap" ||
    mention.calls.filter((call) => call.args[1] === "send").length !== 1
  ) {
    fail("partial-mention fixture resent the delivered message");
  }
}

function runInbox(scenario, args) {
  const dir = mkdtempSync(join(tmpdir(), "raft-inbox-"));
  const state = join(dir, "state.json");
  const mockBin = join(dir, "raft");
  writeFileSync(
    mockBin,
    `#!/bin/sh\nexec "${process.execPath}" "${MOCK}" "$@"\n`,
    { mode: 0o755 },
  );
  const result = spawnSync(process.execPath, [INBOX, ...args], {
    encoding: "utf8",
    env: {
      ...process.env,
      RAFT_BIN: mockBin,
      MOCK_RAFT_SCENARIO: scenario,
      MOCK_RAFT_STATE: state,
    },
  });
  const calls = existsSync(state) ? JSON.parse(readFileSync(state, "utf8")) : [];
  rmSync(dir, { recursive: true, force: true });
  return { result, calls, payload: JSON.parse(result.stdout.trim()) };
}

function runMock(args, env) {
  return spawnSync(process.execPath, [MOCK, ...args], {
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
}

function checkMockContract() {
  const dir = mkdtempSync(join(tmpdir(), "raft-mock-"));
  const state = join(dir, "state.json");
  const read = runMock(["message", "read", "--target", "#test"], {
    MOCK_RAFT_STATE: state,
  });
  const check = runMock(["message", "check"], { MOCK_RAFT_STATE: state });
  const calls = JSON.parse(readFileSync(state, "utf8"));
  rmSync(dir, { recursive: true, force: true });
  if (
    read.status !== 0 ||
    check.status !== 0 ||
    calls[0].args[0] !== "message" ||
    calls[0].args[1] !== "read" ||
    calls[1].args[1] !== "check"
  ) {
    fail("mock CLI does not expose the expected Raft command surface");
  }
}

function checkInboxFixtures() {
  const bounded = runInbox("check-nomatch", ["--until", "READY", "--max-checks", "3"]);
  if (
    bounded.result.status !== 2 ||
    bounded.payload.state !== "bound_reached" ||
    bounded.calls.length !== 3
  ) {
    fail("inbox fixture ignored the three-check bound");
  }

  const matched = runInbox("check-match", ["--until", "READY", "--max-checks", "3"]);
  if (
    matched.result.status !== 0 ||
    matched.payload.state !== "matched" ||
    matched.calls.length !== 2
  ) {
    fail("inbox fixture did not stop at its exit condition");
  }
}

checkSurface();
checkMockContract();
checkSendFixtures();
checkInboxFixtures();

if (failures.length) {
  console.error(`check-dispatch: ${failures.length} failure(s)`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log("check-dispatch: ok (surface, send recovery, bounded inbox)");
