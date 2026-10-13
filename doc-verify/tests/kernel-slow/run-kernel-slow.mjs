#!/usr/bin/env node
// Orchestrator for npm run test:kernel-slow.
// Suites: (1) property S1 C5 500×seeds 1,2,3  (2) seeds table  (3) clingo S3 vs enumeration ×500
// Flags: --smoke (seeds apply + property --programs 2), --programs N, --random N, --skip-property,
//        --skip-seeds, --skip-clingo
import path from "node:path";
import { runArm, runSeedsTable, applySeedsOnce } from "./run-property.mjs";
import { runRandomS3 } from "./random-s3.mjs";

const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const opt = (n, d) => {
  const i = args.indexOf(`--${n}`);
  if (i >= 0 && args[i + 1] && !args[i + 1].startsWith("--")) return args[i + 1];
  const eq = args.find((x) => x.startsWith(`--${n}=`));
  return eq ? eq.slice(n.length + 3) : d;
};

const smoke = flag("smoke");
const programs = Number(opt("programs", smoke ? "2" : "500"));
const randomN = Number(opt("random", smoke ? "2" : "500"));
const seeds = opt("seeds", "1,2,3").split(",").map(Number);
const brutePath = path.join(import.meta.dirname, "reference/random-brute.mjs");

let failed = false;
const wall0 = performance.now();

async function suite(name, fn) {
  console.log(`\n=== ${name} ===`);
  const t0 = performance.now();
  const r = await fn();
  const ms = performance.now() - t0;
  const ok = r.complete && (r.refuting ?? 0) === 0 && (r.fail ?? false) === false;
  const detail = [
    r.complete !== undefined ? `complete: ${r.complete}` : null,
    r.refuting !== undefined ? `refuting: ${r.refuting}` : null,
    r.S3 !== undefined ? `S3: ${r.S3}` : null,
    r.programs !== undefined ? `programs: ${r.programs}` : null,
    `wall: ${(ms / 1000).toFixed(1)}s`,
  ].filter(Boolean).join(", ");
  console.log(`${name}: ${ok ? "pass" : "FAIL"} (${detail})`);
  if (!ok) failed = true;
  return r;
}

if (smoke) {
  await suite("seeds-apply", async () => {
    const r = await applySeedsOnce();
    return { complete: r.complete, refuting: r.refuting };
  });
}

if (!flag("skip-property")) {
  await suite("property", async () => {
    const r = await runArm("S1", "C5", programs, seeds, { floors: !smoke });
    return r;
  });
}

if (!flag("skip-seeds") && !smoke) {
  await suite("seeds", async () => {
    const r = await runSeedsTable(programs, seeds);
    return r;
  });
}

if (!flag("skip-clingo")) {
  await suite("clingo", async () => {
    const r = await runRandomS3(brutePath, randomN, { seed: 1 });
    // Kleene/S1 conservatism vs S3 decided-part stats are already logged by runRandomS3.
    // expectedD1 (gate-ledger item 5) is reported by random-s3; S3 is already "pass" then.
    return {
      complete: r.complete,
      refuting: r.S3 === "pass" ? 0 : 1,
      S3: r.S3,
      programs: r.programs,
      fail: r.S3 !== "pass",
    };
  });
}

const wallSec = ((performance.now() - wall0) / 1000).toFixed(1);
console.log(`\nkernel-slow: complete: ${!failed}; wall: ${wallSec}s`);
process.exit(failed ? 1 : 0);
