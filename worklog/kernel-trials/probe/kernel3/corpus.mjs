// corpus.mjs - `run-conformance.mjs --s3 --corpus`: S3 over corpus-draft.yaml. Programs and facts
// come from the reference's corpus side (reference/corpus.mjs: composeModules + loadProgram, facts
// from prolog/corpus-facts.pl); constraints filtered by the step's profile, as kernel2/corpus.mjs
// does for S1/S2. Before the run, a census of documents whose program uses a feature S3 refuses
// (present/3, an in/matches operand not bound by a base fact); those are skipped as listed
// expected failures.
import path from "node:path";
import { programFor, corpusFacts } from "../reference/corpus.mjs";
import { prepareS3Program } from "./subject-clingo.mjs";

const probe = path.resolve(import.meta.dirname, "..");

export async function runCorpusS3(witness, { compareS3, causeOf, log = console.log }) {
  const facts = corpusFacts(witness.facts_file ? path.join(probe, witness.facts_file) : undefined);
  const out = { S3: "pass", refined: 0, fails: 0, skipped: [], timings: [], complete: true };
  // census
  const census = new Map();
  for (const doc of witness.documents) {
    let program;
    try { program = await programFor(witness.modules[doc]); } catch (e) { census.set(doc, `reference refuses the program: ${e.message}`); continue; }
    const p = await prepareS3Program(program, facts[doc] ?? []);
    if (p.rejected) census.set(doc, p.rejected);
  }
  log(`corpus S3 census: ${census.size} of ${witness.documents.length} documents use a feature S3 does not support${census.size ? ":" : ""}`);
  for (const [doc, why] of census) log(`  ${doc}: ${why}`);
  for (const [n, step] of witness.steps.entries()) {
    for (const doc of witness.documents) {
      const head = `corpus ${doc} step ${n + 1} S3:`;
      if (census.has(doc)) { log(`${head} expected-failure (census) ${census.get(doc)}`); out.skipped.push(doc); continue; }
      const program = await programFor(witness.modules[doc]);
      const inProfile = (c) => c.profiles === undefined || step.profile === undefined || c.profiles.includes(step.profile);
      const p3 = { ...program, constraints: program.constraints.filter(inProfile) };
      const t0 = performance.now();
      const prepared = await prepareS3Program(p3, facts[doc] ?? []);
      const got = prepared.rejected ? { rejected: prepared.rejected } : prepared.step(step.answers ?? {});
      out.timings.push(performance.now() - t0);
      const exp = step.expect.documents[doc];
      if (!exp) { log(`${head} FAIL document: expected nothing for this document`); out.S3 = "FAIL"; out.fails += 1; continue; }
      const { mismatches, refined } = compareS3(exp, got);
      for (const r of refined) log(`${head} refined ${r.line} [${causeOf(prepared, step.answers ?? {}, got, r)}]`);
      for (const l of mismatches) log(`${head} FAIL ${l}`);
      if (got.unsat) log(`${head} finding unsat (no answer set)`);
      if (!mismatches.length && !refined.length) log(`${head} ok`);
      out.refined += refined.length;
      if (mismatches.length) { out.S3 = "FAIL"; out.fails += 1; }
    }
  }
  const t = out.timings;
  if (t.length) log(`corpus S3 per-document (prepare + translate + step incl. demand): min ${Math.min(...t).toFixed(1)} ms, max ${Math.max(...t).toFixed(1)} ms, total ${t.reduce((a, b) => a + b, 0).toFixed(0)} ms`);
  if (out.S3 === "pass" && out.refined) out.S3 = "refined";
  return out;
}
