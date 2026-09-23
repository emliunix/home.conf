#!/usr/bin/env node
import { writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";

import { checkDocuments } from "./checker.js";
import { renderText, exitCodeFor } from "./report.js";
import { segmentMarkdown } from "./segments.js";
import { BlockedError, UsageError, profileSchema } from "./types.js";
import { readFile } from "node:fs/promises";

async function main(argv: string[]): Promise<number> {
  const [command, ...rest] = argv;
  if (command === "segments") {
    return runSegments(rest);
  }
  if (command === "check") {
    return runCheck(rest);
  }
  throw new UsageError("usage: doc-verify <segments|check> [options]");
}

async function runSegments(argv: string[]): Promise<number> {
  const parsed = parseArgs({
    args: argv,
    allowPositionals: true,
    options: { format: { type: "string", default: "text" } },
  });
  if (parsed.positionals.length !== 1) {
    throw new UsageError("usage: doc-verify segments DOCUMENT [--format text|json]");
  }
  const file = parsed.positionals[0];
  if (file === undefined) {
    throw new UsageError("missing document path");
  }
  const sections = segmentMarkdown(await readFile(file, "utf8"));
  if (parsed.values.format === "json") {
    process.stdout.write(`${JSON.stringify(sections.map(({ content: _content, ...section }) => section), null, 2)}\n`);
  } else if (parsed.values.format === "text") {
    for (const section of sections) {
      process.stdout.write(`${section.id}\t${String(section.startLine)}:${String(section.endLine)}\t${section.contentHash}\n`);
    }
  } else {
    throw new UsageError("--format must be text or json");
  }
  return 0;
}

async function runCheck(argv: string[]): Promise<number> {
  const parsed = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      paths: { type: "string", multiple: true },
      staged: { type: "boolean" },
      range: { type: "string" },
      all: { type: "boolean" },
      section: { type: "string", multiple: true },
      rubric: { type: "string" },
      profile: { type: "string", default: "auto" },
      format: { type: "string", default: "text" },
      output: { type: "string" },
      refresh: { type: "boolean" },
    },
  });
  const pathValues = parsed.values.paths === undefined
    ? undefined
    : [...parsed.values.paths, ...parsed.positionals];
  if (parsed.values.paths === undefined && parsed.positionals.length > 0) {
    throw new UsageError("positional paths require --paths");
  }
  const modes = [pathValues !== undefined, parsed.values.staged === true, parsed.values.range !== undefined, parsed.values.all === true];
  if (modes.filter(Boolean).length !== 1) {
    throw new UsageError("choose exactly one of --paths, --staged, --range, or --all");
  }
  const profileResult = profileSchema.safeParse(parsed.values.profile);
  if (!profileResult.success) {
    throw new UsageError("--profile must be draft, promotion, or auto");
  }
  const mode = pathValues !== undefined
    ? { kind: "paths" as const, paths: pathValues }
    : parsed.values.staged === true
      ? { kind: "staged" as const }
      : parsed.values.range !== undefined
        ? { kind: "range" as const, range: parsed.values.range }
        : { kind: "all" as const };
  const report = await checkDocuments({
    mode,
    profile: profileResult.data,
    ...(parsed.values.section === undefined ? {} : { sections: parsed.values.section }),
    ...(parsed.values.rubric === undefined ? {} : { rubric: parsed.values.rubric }),
    ...(parsed.values.refresh === true ? { useCache: false } : {}),
  });
  const format = parsed.values.format;
  if (format !== "text" && format !== "json") {
    throw new UsageError("--format must be text or json");
  }
  const rendered = format === "json" ? `${JSON.stringify(report, null, 2)}\n` : renderText(report);
  if (parsed.values.output !== undefined) {
    await writeFile(parsed.values.output, rendered, "utf8");
  } else {
    process.stdout.write(rendered);
  }
  return exitCodeFor(report.verdict);
}

main(process.argv.slice(2)).then(
  (code) => { process.exitCode = code; },
  (error: unknown) => {
    if (error instanceof UsageError) {
      process.stderr.write(`doc-verify: ${error.message}\n`);
      process.exitCode = error.exitCode;
      return;
    }
    if (error instanceof BlockedError) {
      process.stderr.write(`doc-verify: BLOCKED ${error.message}\n`);
      process.exitCode = 3;
      return;
    }
    const name = error instanceof Error ? error.name : "UnknownError";
    process.stderr.write(`doc-verify: internal error (${name})\n`);
    process.exitCode = 70;
  },
);
