#!/usr/bin/env node
import { writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";

import { checkDocuments } from "./checker.js";
import { runMutate } from "./mutate.js";
import { MIGRATION_HINT } from "./config.js";
import { renderText, exitCodeFor } from "./report.js";
import { segmentMarkdown } from "./segments.js";
import {
  BlockedError,
  ConfigNotFoundError,
  ConfigNotStagedError,
  UsageError,
  profileSchema,
} from "./types.js";
import { readFile } from "node:fs/promises";

const USAGE = `usage: doc-verify <segments|check|mutate> [options]

  doc-verify check FILE...              check the named documents
  doc-verify check --paths FILE|GLOB... check named files or configured glob matches
  doc-verify check --staged             check documents staged in Git
  doc-verify check --range A..B         check documents changed in a Git range
  doc-verify check --all                check every configured document
  doc-verify segments DOCUMENT          list a document's sections (--format text|json)
  doc-verify mutate TABLE.yaml          run a mutation table against a live document
  doc-verify mutate TABLE.yaml --judge  include promotion/oracle rows (needs TYPESAFE_API_KEY)

  --profile draft|promotion|auto   which constraints run (default auto)
  --format text|json               output form (default text)
  --section ID                     restrict to a section
  --output FILE                    write the report to a file
  --verbose                        add the proof tree and snapshot (requires --format text)
  --no-cache                       neither read nor write the oracle cache
  -h, --help                       this message
`;

async function main(argv: string[]): Promise<number> {
  const [command, ...rest] = argv;
  if (command === undefined || command === "--help" || command === "-h") {
    process.stdout.write(USAGE);
    return 0;
  }
  if (rest.includes("--help") || rest.includes("-h")) {
    process.stdout.write(USAGE);
    return 0;
  }
  if (command === "segments") {
    return runSegments(rest);
  }
  if (command === "check") {
    return runCheck(rest);
  }
  if (command === "mutate") {
    return runMutateCommand(rest);
  }
  throw new UsageError(`unknown command ${JSON.stringify(command)}; ${USAGE.split("\n")[0] ?? ""}`);
}

/** Runs `parseArgs`, reporting an unknown or malformed option as a usage error (exit 64). */
function parseOptions<T>(argv: string[], parse: () => T): T {
  try {
    return parse();
  } catch (error) {
    if (error instanceof Error && "code" in error && String(error.code).startsWith("ERR_PARSE_ARGS")) {
      if (argv.some((arg) => arg === "--rubric" || arg.startsWith("--rubric="))) {
        throw new UsageError(`--rubric was removed with the v1 rubric reader; ${MIGRATION_HINT}`);
      }
      throw new UsageError(error.message);
    }
    throw error;
  }
}

async function runSegments(argv: string[]): Promise<number> {
  const parsed = parseOptions(argv, () => parseArgs({
    args: argv,
    allowPositionals: true,
    options: { format: { type: "string", default: "text" } },
  }));
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
  const parsed = parseOptions(argv, () => parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      paths: { type: "string", multiple: true },
      staged: { type: "boolean" },
      range: { type: "string" },
      all: { type: "boolean" },
      section: { type: "string", multiple: true },
      profile: { type: "string", default: "auto" },
      format: { type: "string", default: "text" },
      output: { type: "string" },
      verbose: { type: "boolean" },
      "no-cache": { type: "boolean" },
      // ⚠ THE STAGE POLICY MUST LIVE IN THE SHIPPED CLI (#38, @CowBoy's external-hook finding). The
      // wrapper that implements it is `scripts/run-document-contracts.mjs`, which is NOT in
      // `package.json`'s `files` -- so an external consumer installing this hook gets `doc-verify` and
      // nothing else. A hook entry naming `scripts/...` resolves in the CONSUMER's checkout and fails
      // MODULE_NOT_FOUND. `--stage` is therefore part of the CLI's own contract.
      stage: { type: "string" },
    },
  }));
  // A bare positional file is a path: `doc-verify check FILE` works without `--paths`.
  const pathValues = parsed.values.paths === undefined
    ? (parsed.positionals.length > 0 ? [...parsed.positionals] : undefined)
    : [...parsed.values.paths, ...parsed.positionals];
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
    ...(parsed.values["no-cache"] === true ? { cache: "off" as const } : {}),
    ...(parsed.values.section === undefined ? {} : { sections: parsed.values.section }),
  });
  const format = parsed.values.format;
  if (format !== "text" && format !== "json") {
    throw new UsageError("--format must be text or json");
  }
  if (parsed.values.verbose === true && format !== "text") {
    throw new UsageError("--verbose requires --format text");
  }
  const rendered = format === "json"
    ? `${JSON.stringify(report, null, 2)}\n`
    : renderText(report, { verbose: parsed.values.verbose === true });
  if (parsed.values.output !== undefined) {
    await writeFile(parsed.values.output, rendered, "utf8");
  } else {
    process.stdout.write(rendered);
  }
  return applyStagePolicy(exitCodeFor(report.verdict), parsed.values.stage, report.verdict);
}

/**
 * Map the engine's exit status onto a hook stage's policy.
 *
 *   status        pre-commit   pre-push   (no --stage)
 *   0 PASS            0            0            0
 *   1 NO-GO           0            1            1      <- refused only at push
 *   2 NEEDS-REVIEW    0            2            2      <- refused only at push
 *   3 BLOCKED         0            0            3      <- never refused under a stage
 *
 * The owner's decision: contracts WARN on pre-commit and BLOCK on pre-push. A refused verdict still
 * prints, naming its class -- that is the difference between "warns" and "silently passes".
 */
export function applyStagePolicy(status: number, stage: string | undefined, verdict: string): number {
  if (stage === undefined) return status;
  if (stage !== "pre-commit" && stage !== "pre-push" && stage !== "external") {
    throw new UsageError(`--stage must be pre-commit, pre-push or external, got ${stage}`);
  }
  // ⚠ EXTERNAL IS NOT A THIRD POLICY, IT IS THE ABSENCE OF ONE PLUS ONE EXCEPTION (#38). A consumer's
  // hook has always blocked on a real finding, and `remote-hook.sh` asserts that. What changed is that
  // an empty population now returns BLOCKED -- and an empty index is the NORMAL state of a docs-only
  // commit, so blocking there would break every consumer that stages no docs. So: block on findings,
  // report an unevaluable population.
  if (stage === "external") {
    if (status === 3) {
      process.stderr.write(
        `doc-verify: ${verdict} -- no documents were selected, so nothing was evaluated. Not failing ` +
          "the commit: an empty selection is not a finding.\n",
      );
      return 0;
    }
    return status;
  }
  if (stage === "pre-commit") {
    if (status !== 0) {
      process.stderr.write(
        `doc-verify: ${verdict} -- reported, not refused (pre-commit warns; pre-push blocks on NO-GO). ` +
          "This verdict does not stop the commit.\n",
      );
    }
    return 0;
  }
  // pre-push: NO-GO and NEEDS-REVIEW block; BLOCKED reports (it is a "could not evaluate", not a finding).
  return status === 3 ? 0 : status;
}

async function runMutateCommand(argv: string[]): Promise<number> {
  const parsed = parseOptions(argv, () => parseArgs({
    args: argv,
    allowPositionals: true,
    options: { judge: { type: "boolean" } },
  }));
  if (parsed.positionals.length !== 1) {
    throw new UsageError("usage: doc-verify mutate TABLE.yaml [--judge]");
  }
  const table = parsed.positionals[0];
  if (table === undefined) {
    throw new UsageError("missing mutation table path");
  }
  const report = await runMutate(table, { judge: parsed.values.judge === true });
  process.stdout.write(report.text);
  return report.exitCode;
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
    if (error instanceof ConfigNotFoundError || error instanceof ConfigNotStagedError) {
      process.stderr.write(`doc-verify: ${error.message}\n`);
      process.exitCode = error.exitCode;
      return;
    }
    const name = error instanceof Error ? error.name : "UnknownError";
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`doc-verify: internal error (${name}): ${message}\n`);
    if (error instanceof Error) {
      let cause: unknown = error.cause;
      while (cause !== undefined && cause !== null) {
        const causeMessage = cause instanceof Error
          ? cause.message
          : typeof cause === "string" ? cause : "non-Error cause";
        process.stderr.write(`doc-verify: caused by: ${causeMessage}\n`);
        cause = cause instanceof Error ? cause.cause : undefined;
      }
      if (process.env.DOC_VERIFY_DEBUG === "1" && error.stack !== undefined) {
        process.stderr.write(`${error.stack}\n`);
      }
    }
    process.exitCode = 70;
  },
);
