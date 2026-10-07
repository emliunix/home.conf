#!/usr/bin/env node

import { appendFileSync } from "node:fs";

const args = process.argv.slice(2);
const statePath = args[args.indexOf("--state") + 1];
const holdMs = Number(args[args.indexOf("--hold-ms") + 1]);
const tag = args[args.indexOf("--tag") + 1];

appendFileSync(statePath, `${tag} start ${Date.now()} ${process.pid}\n`);
Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, holdMs);
appendFileSync(statePath, `${tag} end ${Date.now()} ${process.pid}\n`);
