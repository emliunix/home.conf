#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const EXIT = {
  delivered: 0,
  held_then_delivered: 0,
  held_again: 2,
  transport_uncertain: 3,
  invalid_input: 4,
  refused: 5,
  delivered_with_mention_gap: 6,
  wrapper_error: 5,
};

function usage() {
  return [
    "Usage: raft-send.mjs --target <target> [options]",
    "",
    "Reads the message body from stdin unless --body-file is supplied.",
    "",
    "Options:",
    "  --target <target>        Raft channel, DM, or thread target.",
    "  --peer-kind <kind>       agent | human for an ambiguous DM.",
    "  --body-file <path>       Read the body from a file instead of stdin.",
    "  --raft-bin <path>        Raft executable (default: raft).",
    "  --mention <actor>        Bind a mention; repeatable.",
    "  --attachment-id <id>     Attach a file; repeatable.",
    "  --target-confirmed       Confirm an intentional top-level target.",
    "  --help                   Show this help.",
  ].join("\n");
}

function parseArgs(argv) {
  const options = {
    mentions: [],
    attachments: [],
    raftBin: process.env.RAFT_BIN || "raft",
    bodyFile: undefined,
    peerKind: undefined,
    targetConfirmed: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") options.help = true;
    else if (arg === "--target") options.target = argv[++i];
    else if (arg === "--peer-kind") options.peerKind = argv[++i];
    else if (arg === "--body-file") options.bodyFile = argv[++i];
    else if (arg === "--raft-bin") options.raftBin = argv[++i];
    else if (arg === "--mention") options.mentions.push(argv[++i]);
    else if (arg === "--attachment-id") options.attachments.push(argv[++i]);
    else if (arg === "--target-confirmed") options.targetConfirmed = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  return options;
}

function readBody(options) {
  if (options.bodyFile) return readFileSync(options.bodyFile, "utf8");
  return readFileSync(0, "utf8");
}

function runRaft(bin, args, input) {
  const result = spawnSync(bin, args, {
    input,
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  });
  return {
    status: result.status ?? 1,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
    error: result.error,
  };
}

function parseJson(text) {
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  try {
    return JSON.parse(trimmed);
  } catch {
    const first = trimmed.indexOf("{");
    const last = trimmed.lastIndexOf("}");
    if (first === -1 || last <= first) return undefined;
    try {
      return JSON.parse(trimmed.slice(first, last + 1));
    } catch {
      return undefined;
    }
  }
}

function containers(payload) {
  if (!payload || typeof payload !== "object") return [];
  const out = [payload];
  for (const key of ["error", "result", "response", "data"]) {
    if (payload[key] && typeof payload[key] === "object") out.push(payload[key]);
  }
  return out;
}

function pick(payload, keys) {
  for (const container of containers(payload)) {
    for (const key of keys) {
      const value = container[key];
      if (value !== undefined && value !== null) return value;
    }
  }
  return undefined;
}

function namedCode(output, payload) {
  const fromJson = pick(payload, ["code", "statusCode", "status_code"]);
  if (typeof fromJson === "string") return fromJson;
  const match = `${output.stdout}\n${output.stderr}`.match(
    /(?:^|\n)\s*(?:Code|code):\s*([A-Z][A-Z0-9_]*)\s*$/m,
  );
  return match?.[1];
}

function classify(output) {
  const payload = parseJson(output.stdout) ?? parseJson(output.stderr);
  const code = namedCode(output, payload);
  const state = pick(payload, ["state", "send_state", "sendState"]);
  const messageId = pick(payload, ["message_id", "messageId", "id"]);
  const draftKey = pick(payload, [
    "draft_key",
    "draftKey",
    "idempotency_key",
    "idempotencyKey",
  ]);
  const retryable = pick(payload, ["retryable"]);
  const nextAction = pick(payload, ["next_action", "nextAction"]);
  const mentions = containers(payload)
    .flatMap((container) => (Array.isArray(container.mentions) ? container.mentions : []))
    .filter((mention) => mention && typeof mention === "object");
  const mentionGap =
    code === "MENTION_DELIVERY_FAILED" ||
    mentions.some((mention) => {
      const status = String(mention.status || mention.delivery_status || "").toLowerCase();
      return status && !["queued", "delivered", "sent", "ok"].includes(status);
    });
  return {
    status: output.status,
    code,
    state: typeof state === "string" ? state : undefined,
    messageId: typeof messageId === "string" ? messageId : undefined,
    draftKey: typeof draftKey === "string" ? draftKey : undefined,
    retryable: typeof retryable === "boolean" ? retryable : undefined,
    nextAction: typeof nextAction === "string" ? nextAction : undefined,
    mentionGap,
  };
}

function held(result) {
  return result.code === "SEND_HELD_AS_DRAFT" || result.state === "held";
}

function transportUncertain(result) {
  const transportCodes = new Set([
    "PROXY_5XX",
    "ECONNRESET",
    "ECONNREFUSED",
    "ETIMEDOUT",
    "TRANSPORT_REQUEST_FAILED",
    "UNKNOWN",
    "CANNOT_CONFIRM",
  ]);
  if (result.code && transportCodes.has(result.code)) return true;
  return result.status !== 0 && !result.code && !result.mentionGap;
}

function attempt(operation, result) {
  return {
    operation,
    status: result.status,
    ...(result.code ? { code: result.code } : {}),
    ...(result.state ? { state: result.state } : {}),
  };
}

function emit(state, attempts, extra = {}) {
  const result = {
    wrapper: "raft-send",
    state,
    attempts,
    retryable: false,
    nextAction: "none",
    ...extra,
  };
  process.stdout.write(`${JSON.stringify(result)}\n`);
  process.exitCode = EXIT[state] ?? EXIT.wrapper_error;
}

function drainArgs(options) {
  const args = ["message", "read", "--target", options.target, "--limit", "20"];
  if (options.peerKind) args.push("--peer-kind", options.peerKind);
  return args;
}

function sendArgs(options, draft = false, draftKey) {
  const args = ["message", "send", "--target", options.target, "--json"];
  if (options.peerKind) args.push("--peer-kind", options.peerKind);
  if (options.targetConfirmed) args.push("--target-confirmed");
  for (const mention of options.mentions) args.push("--mention", mention);
  for (const attachment of options.attachments) args.push("--attachment-id", attachment);
  if (draft) args.push("--send-draft");
  if (draft && draftKey) args.push("--expected-draft-key", draftKey);
  return args;
}

function bodyDigest(body) {
  return createHash("sha256").update(body).digest("hex");
}

async function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    emit("invalid_input", [], { error: error.message });
    return;
  }
  if (options.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  if (!options.target) {
    emit("invalid_input", [], { error: "--target is required" });
    return;
  }

  let body;
  try {
    body = readBody(options);
  } catch (error) {
    emit("invalid_input", [], { error: `cannot read body: ${error.message}` });
    return;
  }
  if (!body) {
    emit("invalid_input", [], { error: "message body is empty" });
    return;
  }

  const attempts = [];
  const preDrain = classify(runRaft(options.raftBin, drainArgs(options)));
  attempts.push(
    attempt("drain_before_send", {
      ...preDrain,
      code: preDrain.code,
      status: preDrain.status,
    }),
  );

  const firstOutput = runRaft(options.raftBin, sendArgs(options), body);
  const first = classify(firstOutput);
  attempts.push(attempt("send", first));
  const common = {
    bodySha256: bodyDigest(body),
    ...(first.messageId ? { messageId: first.messageId } : {}),
  };

  if (first.status === 0 && first.mentionGap) {
    emit("delivered_with_mention_gap", attempts, {
      ...common,
      code: first.code,
      nextAction: "run `raft mention pending`; do not resend the message",
    });
    return;
  }
  if (first.status === 0) {
    emit("delivered", attempts, common);
    return;
  }
  if (first.mentionGap) {
    emit("delivered_with_mention_gap", attempts, {
      ...common,
      code: first.code,
      nextAction: "run `raft mention pending`; do not resend the message",
    });
    return;
  }
  if (held(first)) {
    const drain = classify(runRaft(options.raftBin, drainArgs(options)));
    attempts.push(attempt("drain_after_hold", drain));
    if (drain.status !== 0) {
      emit("held_again", attempts, {
        ...common,
        code: drain.code,
        nextAction: "resolve the target read failure before replaying the saved draft",
      });
      return;
    }
    const replay = classify(
      runRaft(options.raftBin, sendArgs(options, true, first.draftKey)),
    );
    attempts.push(attempt("send_saved_draft", replay));
    const replayCommon = {
      ...common,
      ...(replay.messageId ? { messageId: replay.messageId } : {}),
    };
    if (replay.status === 0 && !replay.mentionGap) {
      emit("held_then_delivered", attempts, replayCommon);
      return;
    }
    if (replay.mentionGap) {
      emit("delivered_with_mention_gap", attempts, {
        ...replayCommon,
        code: replay.code,
        nextAction: "run `raft mention pending`; do not resend the message",
      });
      return;
    }
    if (held(replay)) {
      emit("held_again", attempts, {
        ...replayCommon,
        code: replay.code,
        nextAction: "read the target and revise deliberately; the one replay budget is spent",
      });
      return;
    }
    if (transportUncertain(replay)) {
      emit("transport_uncertain", attempts, {
        ...replayCommon,
        code: replay.code,
        nextAction: replay.nextAction || "follow the CLI's stable-key recovery result; do not start a new send",
      });
      return;
    }
    emit("refused", attempts, {
      ...replayCommon,
      code: replay.code,
      nextAction: "inspect the named code before acting",
    });
    return;
  }
  if (transportUncertain(first)) {
    emit("transport_uncertain", attempts, {
      ...common,
      code: first.code,
      nextAction: first.nextAction || "follow the CLI's stable-key recovery result; do not start a new send",
    });
    return;
  }
  if (first.code === "INVALID_ARG" || first.code?.startsWith("INVALID_")) {
    emit("invalid_input", attempts, {
      ...common,
      code: first.code,
      nextAction: "correct the input before retrying",
    });
    return;
  }
  emit("refused", attempts, {
    ...common,
    code: first.code,
    nextAction: "inspect the named code before acting",
  });
}

await main();
