#!/usr/bin/env node
// Round 11 predicate, corpus track: score a `check --all --format json` report against the
// `corpus` labels in labels.yaml. One line per labelled reference (found/silent and its label),
// every `fragments-resolve` finding no label claims printed as `unlabelled`, then the counts.
// Exit non-zero on a false finding, a miss, an unlabelled finding, or an incomplete label set.
//
// A finding is keyed by (path, line, target as written, backticks stripped); the target is read
// from the message (`<D>:<Line> cites <T>, which names ...`). A finding names a label when its
// target is the label's target or extends it by further words (the label may stop short of the
// citation's written text, e.g. before `pointing at`).
//
// usage: node score.mjs <report.json>
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import YAML from "yaml";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "../../../..");
const reportPath = process.argv[2];
if (reportPath === undefined) {
  console.error("usage: node score.mjs <report.json>");
  process.exit(2);
}
const labels = YAML.parse(readFileSync(path.join(here, "labels.yaml"), "utf8")).corpus;
const report = JSON.parse(readFileSync(reportPath, "utf8"));
const strip = (text) => text.replaceAll("`", "");

const findings = [];
for (const artifact of report.artifacts) {
  for (const finding of artifact.findings) {
    if (finding.ruleId !== "module.fragments-resolve") continue;
    const match = / cites (.*), which names no section of that document$/.exec(finding.message);
    findings.push({ path: finding.path, line: finding.line, target: strip(match?.[1] ?? finding.message), claimed: false });
  }
}
const names = (finding, file, line, target) =>
  finding.path === file && finding.line === line
  && (finding.target === strip(target) || finding.target.startsWith(`${strip(target)} `));

// Whether the labelled line holds the reference at all (a `§` label: its citation part).
const lines = new Map();
const holds = (file, line, target) => {
  if (!lines.has(file)) lines.set(file, readFileSync(path.join(repo, file), "utf8").split("\n"));
  const text = strip(lines.get(file)[line - 1] ?? "");
  const section = strip(target).indexOf("§");
  return text.includes(section < 0 ? strip(target) : strip(target).slice(section));
};

let falseFindings = 0;
let missed = 0;
let complete = true;
for (const label of ["dangling", "resolves", "skipped", "known_misses"]) {
  for (const [file, line, target] of labels[label] ?? []) {
    if (!holds(file, line, target)) complete = false;
    const hits = findings.filter((finding) => names(finding, file, line, target));
    for (const hit of hits) hit.claimed = true;
    const outcome = hits.length === 0 ? "silent" : hits.length === 1 ? "found" : `found x${hits.length}`;
    console.log(`${outcome.padEnd(8)} ${label.padEnd(12)} ${file}:${line} ${target}`);
    if (label === "dangling" && hits.length !== 1) missed += 1;
    if ((label === "resolves" || label === "skipped") && hits.length > 0) falseFindings += 1;
  }
}
const unlabelled = findings.filter((finding) => !finding.claimed);
for (const finding of unlabelled) {
  console.log(`unlabelled ${finding.path}:${finding.line} ${finding.target}`);
}
// `everything_else: silent`: an unlabelled finding is a false finding.
falseFindings += unlabelled.length;
console.log(`false findings ${falseFindings}`);
console.log(`missed ${missed}`);
console.log(`complete: ${complete}`);
process.exit(falseFindings > 0 || missed > 0 || unlabelled.length > 0 || !complete ? 1 : 0);
