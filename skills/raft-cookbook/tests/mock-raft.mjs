#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from "node:fs";

const statePath = process.env.MOCK_RAFT_STATE;
const scenario = process.env.MOCK_RAFT_SCENARIO || "delivered";
const calls = statePath && existsSync(statePath)
  ? JSON.parse(readFileSync(statePath, "utf8"))
  : [];
const args = process.argv.slice(2);
const body = readFileSync(0, "utf8");
calls.push({ args, body });
writeFileSync(statePath, JSON.stringify(calls, null, 2));

function finish(status, payload = "") {
  if (payload) process.stdout.write(`${JSON.stringify(payload)}\n`);
  process.exit(status);
}

if (args[0] !== "message") finish(2, { error: { code: "INVALID_ARG" } });

if (args[1] === "read") {
  finish(0, { state: "read" });
}

if (args[1] === "check") {
  if (scenario === "check-match") {
    const checkCalls = calls.filter((call) => call.args[1] === "check").length;
    finish(0, { text: checkCalls >= 2 ? "READY" : "PENDING" });
  }
  finish(0, { text: "No pending messages" });
}

if (args[1] === "send") {
  const draft = args.includes("--send-draft");
  if (scenario === "held") {
    if (!draft) {
      finish(1, {
        error: {
          code: "SEND_HELD_AS_DRAFT",
          message: "held",
          draft_key: "draft-1",
          retryable: false,
        },
      });
    }
    finish(0, { state: "delivered", message_id: "message-1" });
  }
  if (scenario === "transport") {
    finish(75, {
      error: {
        code: "PROXY_5XX",
        message: "transport request failed",
        draft_saved: true,
      },
    });
  }
  if (scenario === "invalid") {
    finish(2, { error: { code: "INVALID_ARG", message: "bad target" } });
  }
  if (scenario === "mention-gap") {
    finish(1, {
      code: "MENTION_DELIVERY_FAILED",
      message_id: "message-1",
      message_status: "queued",
      mentions: [{ actor: "@missing", status: "not_queued" }],
    });
  }
  finish(0, { state: "delivered", message_id: "message-1" });
}

finish(2, { error: { code: "INVALID_ARG" } });
