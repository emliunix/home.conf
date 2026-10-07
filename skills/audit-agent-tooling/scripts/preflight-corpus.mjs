#!/usr/bin/env node
// Refuse a corpus whose selected files contain no conversation records in the
// active window. A zero from telemetry is not evidence that the subject is
// absent; it means the selected corpus never reached the subject.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, resolve } from "node:path";

const EXIT_REFUSED = 1;
const EXIT_INPUT = 64;

function usage() {
  console.error(
    "usage: preflight-corpus.mjs [--since <ISO>] [--until <ISO>] [--allow-empty] <path>...",
  );
}

function parseArgs(argv) {
  const options = {
    since: null,
    sinceSource: "default",
    until: null,
    untilSource: "default",
    allowEmpty: false,
    paths: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--since" || arg === "--until") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error(`${arg} requires an ISO timestamp`);
      }
      options[arg.slice(2)] = value;
      options[`${arg.slice(2)}Source`] = "explicit";
      index += 1;
    } else if (arg === "--allow-empty") {
      options.allowEmpty = true;
    } else if (arg === "--help" || arg === "-h") {
      usage();
      process.exit(0);
    } else if (arg.startsWith("-")) {
      throw new Error(`unknown option: ${arg}`);
    } else {
      options.paths.push(arg);
    }
  }

  if (options.paths.length === 0) {
    throw new Error("at least one file or directory is required");
  }
  return options;
}

function walk(path, output) {
  const info = statSync(path);
  if (info.isDirectory()) {
    for (const entry of readdirSync(path).sort()) {
      walk(resolve(path, entry), output);
    }
  } else if (info.isFile() && extname(path) === ".jsonl") {
    output.push(path);
  }
}

function timestampOf(record) {
  const value = record?.timestamp ?? record?.payload?.timestamp ?? record?.message?.timestamp;
  if (typeof value !== "string") return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function isConversationRecord(record) {
  if (record?.type === "message" && record.message && typeof record.message === "object") {
    return true;
  }
  if (
    ["user", "assistant", "system"].includes(record?.type)
    && record.message
    && typeof record.message === "object"
  ) {
    return true;
  }
  return (
    record?.type === "response_item"
    && record?.payload?.type === "message"
    && ["user", "assistant", "system", "developer"].includes(record.payload.role)
  );
}

function inWindow(timestamp, since, until) {
  if (since !== null && (timestamp === null || timestamp < since)) return false;
  if (until !== null && (timestamp === null || timestamp > until)) return false;
  return true;
}

function readCorpus(files, since, until) {
  const summary = {
    files: [],
    recordTypes: {},
    subjectRecords: 0,
    recognizedInWindow: 0,
    outOfWindow: 0,
    undated: 0,
    parseErrors: 0,
  };

  for (const file of files) {
    const fileSummary = {
      path: file,
      subjectRecords: 0,
      recognizedInWindow: 0,
      outOfWindow: 0,
      undated: 0,
      parseErrors: 0,
    };
    const lines = readFileSync(file, "utf8").split(/\r?\n/);
    for (const line of lines) {
      if (line.trim() === "") continue;
      let record;
      try {
        record = JSON.parse(line);
      } catch {
        fileSummary.parseErrors += 1;
        continue;
      }
      const type = typeof record?.type === "string" ? record.type : "<untyped>";
      summary.recordTypes[type] = (summary.recordTypes[type] ?? 0) + 1;
      if (!isConversationRecord(record)) continue;

      fileSummary.subjectRecords += 1;
      const timestamp = timestampOf(record);
      if (timestamp === null) {
        fileSummary.undated += 1;
        continue;
      }
      if (inWindow(timestamp, since, until)) {
        fileSummary.recognizedInWindow += 1;
      } else {
        fileSummary.outOfWindow += 1;
      }
    }
    summary.files.push(fileSummary);
    summary.subjectRecords += fileSummary.subjectRecords;
    summary.recognizedInWindow += fileSummary.recognizedInWindow;
    summary.outOfWindow += fileSummary.outOfWindow;
    summary.undated += fileSummary.undated;
    summary.parseErrors += fileSummary.parseErrors;
  }

  return summary;
}

function windowLabel(since, sinceSource, until, untilSource) {
  return {
    since: since === null ? "unbounded" : new Date(since).toISOString(),
    sinceSource,
    until: until === null ? "open" : new Date(until).toISOString(),
    untilSource,
  };
}

let options;
try {
  options = parseArgs(process.argv.slice(2));
} catch (error) {
  console.error(`INPUT: ${error.message}`);
  usage();
  process.exit(EXIT_INPUT);
}

const since = options.since === null ? null : Date.parse(options.since);
const until = options.until === null ? null : Date.parse(options.until);
if ((since !== null && Number.isNaN(since)) || (until !== null && Number.isNaN(until))) {
  console.error("INPUT: --since and --until must be valid ISO timestamps");
  process.exit(EXIT_INPUT);
}

const files = [];
for (const path of options.paths) {
  try {
    walk(resolve(path), files);
  } catch (error) {
    console.error(`INPUT: ${path}: ${error.message}`);
    process.exit(EXIT_INPUT);
  }
}

const summary = readCorpus(files, since, until);
const result = {
  subject: "conversation",
  window: windowLabel(since, options.sinceSource, until, options.untilSource),
  ...summary,
  allowEmpty: options.allowEmpty,
};
console.log(JSON.stringify(result, null, 2));

const ignored = Object.values(summary.recordTypes)
  .reduce((total, count) => total + count, 0) - summary.subjectRecords;

if (summary.recognizedInWindow === 0 && !options.allowEmpty) {
  console.error(
    `REFUSED: no conversation records in the active window; `
    + `recognized=0 subjectRecords=${summary.subjectRecords} `
    + `outOfWindow=${summary.outOfWindow} undated=${summary.undated} `
    + `recordTypes=${JSON.stringify(summary.recordTypes)}`,
  );
  process.exit(EXIT_REFUSED);
}

if (summary.recognizedInWindow === 0) {
  console.error("ACCEPTED: empty corpus accepted only by explicit --allow-empty");
} else {
  console.error(`OK: recognized=${summary.recognizedInWindow} ignored=${ignored}`);
}
