#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const PI_LENS_ROOT =
  process.env.PI_LENS_ROOT ?? "/Users/ppio/.pi/agent/npm/node_modules/pi-lens";
const MARKER = path.join(PI_LENS_ROOT, "LOCAL-PATCH-pi-lens-lsp-limit.md");
const revert = process.argv.includes("--revert");

const targets = [
  {
    file: "dist/index.js",
    from: revert ? "lspMaxFileLines: 1e4," : "lspMaxFileLines: 5e3,",
    to: revert ? "lspMaxFileLines: 5e3," : "lspMaxFileLines: 1e4,",
  },
  {
    file: "dist/clients/runtime-config.js",
    from: revert ? "lspMaxFileLines: 10000," : "lspMaxFileLines: 5000,",
    to: revert ? "lspMaxFileLines: 5000," : "lspMaxFileLines: 10000,",
  },
];

for (const target of targets) {
  const absolute = path.join(PI_LENS_ROOT, target.file);
  const before = fs.readFileSync(absolute, "utf8");
  const occurrences = before.split(target.from).length - 1;
  if (occurrences === 0 && before.split(target.to).length - 1 === 1) {
    // IDEMPOTENT: already at the target value (a re-run, or a previous revert).
    // The first version threw here, which contradicted this script's own
    // documented contract -- re-running must be safe, because the flow it
    // supports is "re-run after reinstalling pi-lens".
    console.log(`already ${revert ? "reverted" : "patched"} ${absolute}`);
    continue;
  }
  if (occurrences !== 1) {
    throw new Error(
      `${absolute}: expected one ${JSON.stringify(target.from)} occurrence, found ${occurrences} ` +
        `(and ${before.split(target.to).length - 1} of ${JSON.stringify(target.to)}) -- refusing rather than guessing`,
    );
  }
  const after = before.replace(target.from, target.to);
  fs.writeFileSync(absolute, after);
  console.log(`${revert ? "reverted" : "patched"} ${absolute}`);
}

// A locally patched install is otherwise indistinguishable from upstream: the
// file is unversioned and carries no marker, so a reader who finds 10000 in the
// dist cannot tell whether that is the package's contract or someone's edit.
// AstraBoy measured that exact confusion on 2026-10-03. The marker is the fix.
if (revert) {
  fs.rmSync(MARKER, { force: true });
  console.log(`removed ${MARKER}`);
} else {
  fs.writeFileSync(
    MARKER,
    [
      "# LOCAL PATCH — pi-lens LSP line bound",
      "",
      "This install is not stock pi-lens. `RUNTIME_CONFIG.pipeline.lspMaxFileLines`",
      "was changed from `5000` to `10000` by",
      "`code-analysis-cookbook/scripts/patch-pi-lens-lsp-limit.mjs`.",
      "",
      "Stock 4.3.0 hardcodes 5000 and exposes no config key or env var for it.",
      "Run the script with `--revert` before comparing this install to upstream.",
      "",
      `Patched at: ${new Date().toISOString()}`,
      "",
    ].join("\n"),
  );
  console.log(`wrote ${MARKER}`);
}
