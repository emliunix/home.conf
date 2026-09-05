/**
 * Regenerate frozen-prefix.lock.json from the current checked-in skill content.
 * Run after an intentional skill edit: `vp exec tsx scripts/update-lock.ts`
 * (or `node --experimental-strip-types scripts/update-lock.ts`).
 */
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { FROZEN_EVALUATION_CONTEXT, createFrozenPrompt } from "../src/eval/prompt.ts";

const frozen = createFrozenPrompt(FROZEN_EVALUATION_CONTEXT);
const lockPath = resolve(dirname(fileURLToPath(import.meta.url)), "../frozen-prefix.lock.json");

const lock = {
  version: 1,
  role: frozen.role,
  task: frozen.task,
  skillNames: frozen.skillNames,
  skillHashes: frozen.skillHashes,
  promptHash: frozen.hash,
};

writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`);
console.log(`lock updated: ${frozen.hash}`);
