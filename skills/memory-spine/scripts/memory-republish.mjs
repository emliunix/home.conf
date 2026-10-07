#!/usr/bin/env node
// memory-republish -- bring an index back onto its log.
//
// The index is a fold of the log, so an index left behind by an interrupted publish (or by two
// writers racing) is repaired by folding again. Folding is idempotent: when the index is already
// current this is a no-op and reports as much.
//
// EXIT CODES. 0 republished or already current; 1 refused (the fold would exceed the cap); 64 usage.

import { resolve } from "node:path";
import { basename } from "node:path";
import { republish } from "./memory-append.mjs";

function main(argv) {
  const indexPath = resolve(argv[0] ?? "MEMORY.md");
  try {
    const result = republish(indexPath);
    if (!result.republished) {
      console.log(`OK (already current): ${indexPath} is ${result.bytesAfter} B over ${result.facts} logged fact(s)`);
    } else {
      console.log(`OK: ${indexPath} republished ${result.bytesBefore} -> ${result.bytesAfter} B over ${result.facts} logged fact(s)`);
    }
    process.exit(0);
  } catch (error) {
    console.error(`REFUSED: ${error.message}`);
    process.exit(1);
  }
}

if (process.argv[1] !== undefined && basename(process.argv[1]) === "memory-republish.mjs") main(process.argv.slice(2));
