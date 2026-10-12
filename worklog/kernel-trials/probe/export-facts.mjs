// Export doc-verify core facts for every governed document at the working tree as Prolog facts.
// Output: probe/prolog/corpus-facts.pl. Uses the current engine's fact extractor so the probe
// evaluates the same facts the TypeScript kernel does.
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { documentFacts } from "../../../doc-verify/dist/engine/facts.js";
import { writeTerm } from "../../../doc-verify/dist/engine/terms.js";
import { segmentMarkdown } from "../../../doc-verify/dist/segments.js";
import { titleStatus } from "../../../doc-verify/dist/checker.js";
import YAML from "../../../node_modules/yaml/dist/index.js";
import { minimatch } from "../../../node_modules/minimatch/dist/esm/index.js";

const root = path.resolve(import.meta.dirname, "../../..");
const config = YAML.parse(readFileSync(path.join(root, ".doc-verify.yaml"), "utf8"));
const tracked = execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" }).split("\n").filter(Boolean);
const files = new Set(tracked);
const exists = (p) => files.has(p) || tracked.some((f) => f.startsWith(`${p}/`));

const out = [":- discontiguous section/3, heading/3, depth/3, order/3, meta/3, selected/2, child/3, descendant/3, nests/3, ref/4, resolves/2, dangling/4, spec_unresolved/4.", ""];
let docs = 0, count = 0;
for (const file of tracked) {
  let rule;
  for (const r of config.documents) if (minimatch(file, r.pattern, { dot: true })) rule = r.exclude ? undefined : r;
  if (!rule) continue;
  const markdown = readFileSync(path.join(root, file), "utf8");
  const sections = segmentMarkdown(markdown);
  const statusSection = sections.find((s) => s.id === "status");
  const status = rule.status_from === "title" ? titleStatus(markdown)
    : statusSection?.content.split("\n").slice(1).join("\n").trim().split(/\s+/, 1)[0]?.toLowerCase().replace(/[^a-z-]/g, "");
  const meta = { kind: rule.artifact_kind };
  if (status) { meta.status = status; }
  const line = statusSection?.content.split("\n").slice(1).map((l) => l.trim()).find((l) => l.length > 0);
  if (line && rule.status_from !== "title") meta.status_words = String(line.split(/\s+/).length);
  const facts = documentFacts({ path: file, markdown, meta, exists, files: tracked, gitRefs: [] });
  out.push(`% ${file} (${rule.artifact_kind})`);
  for (const fact of facts.facts) {
    const name = fact.functor.replace("core::", "");
    out.push(`${name}(${fact.args.map(writeTerm).join(", ")}).`);
    count += 1;
  }
  out.push("");
  docs += 1;
}
writeFileSync(path.join(import.meta.dirname, "prolog/corpus-facts.pl"), out.join("\n"));
console.log(`documents ${docs}, facts ${count}`);
