#!/usr/bin/env node
// Seeded mutations: each reintroduces a specific defect and MUST redden the case that targets
// it. A case that cannot be made to fail is not a test, so this file is the evidence that the
// cases in check-lock.mjs measure something.
//
// Usage: node skills/worktree-sop/tests/check-lock-mutations.mjs

import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCE = join(HERE, "../scripts/gate-lock.mjs");
const CASES = join(HERE, "check-lock.mjs");
const PRELOAD = join(HERE, "preloads/pause-before-publish.cjs");

/** Each mutation: a source edit and the failure text that edit must produce. */
const MUTATIONS = [
  {
    name: "non-atomic publish (the landed defect's shape)",
    // Revert publishLock to create-the-file-then-write: the lock path is briefly EMPTY, which
    // is the state the "no observable empty window" case exists to forbid.
    apply: (source) =>
      source.replace(
        `function publishLock(staging, path) {
  try {
    linkSync(staging, path);
    return true;
  } catch (error) {
    if (error?.code === "EEXIST") return false;
    throw error;
  }
}`,
        `function publishLock(staging, path) {
  try {
    const fd = openSync(path, "wx", 0o600);
    writeSync(fd, readFileSync(staging, "utf8"));
    closeSync(fd);
    return true;
  } catch (error) {
    if (error?.code === "EEXIST") return false;
    throw error;
  }
}`,
      ),
    expects: ["empty lock was observable"],
  },
  {
    name: "unparseable-lock-treated-as-stale (the landed classifier)",
    apply: (source) =>
      source.replace(
        `    case LOCK_STATE.unparseable:
      return now - observed.mtimeMs >= staleMs;`,
        `    case LOCK_STATE.unparseable:
      return true;`,
      ),
    expects: ["fresh malformed lock must be honoured"],
  },
  {
    name: "missing-lock-treated-as-reclaimable",
    apply: (source) =>
      source.replace(
        `    default:
      return false;`,
        `    default:
      return true;`,
      ),
    expects: ["missing lock must not be reclaimable"],
  },
  {
    name: "quarantine-drops-the-identity-check",
    apply: (source) =>
      source.replace(
        `  const measuredIdentity = measured?.identity;
  const isMeasured =
    measuredIdentity !== undefined &&
    moved.dev === measuredIdentity.dev &&
    moved.ino === measuredIdentity.ino;`,
        `  const isMeasured = true;`,
      ),
    expects: ["successor"],
  },
  {
    name: "release-ignores-the-token",
    apply: (source) =>
      source.replace(
        `    if (current?.token !== token) return;`,
        `    if (false) return;`,
      ),
    expects: ["another holder's lock"],
  },
  {
    name: "release-skips-the-identity-check",
    apply: (source) =>
      source.replace(
        `    if (sameIdentity(moved, fstatSync(fd))) {`,
        `    if (true) {`,
      ),
    // Token match is read from the fd opened on OUR inode. renameSync(path)
    // then moves whatever inode currently occupies `path`. Without the
    // identity check, that unlinks a successor that replaced the path
    // between open and rename. The aged-claim cases observe that deletion.
    // Recorded GREEN (token check "enough") was stale once those cases existed.
    expects: ["successor's claim was deleted from the path"],
  },
  {
    // Review F1: release previously did statSync(path) then unlinkSync(path). Restoring the
    // shared-path unlink reintroduces the window in which a successor is deleted.
    name: "release-unlinks-the-shared-path (review F1)",
    apply: (source) =>
      source.replace(
        `    if (sameIdentity(moved, fstatSync(fd))) {`,
        `    if (true) {
      try {
        unlinkSync(path);
      } catch {
        // Restored defect: the shared path is removed directly.
      }`,
      ),
    expects: ["release unlinked the shared lock path"],
  },
  {
    // Review F2: restoring the lock with renameSync clobbers a third successor.
    name: "quarantine-restores-with-rename (review F2)",
    apply: (source) =>
      source.replace(
        `  try {
    linkSync(tombstone, path);
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;`,
        `  try {
    renameSync(tombstone, path);
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;`,
      ),
    expects: ["overwritten"],
  },
  {
    // Review F3: any JSON object counted as a valid lock, so a schema-invalid one is reclaimed.
    name: "schema-invalid-lock-treated-as-parsed (review F3)",
    apply: (source) =>
      source.replace(
        `    if (!isLockShape(lock)) {`,
        `    if (lock === null || lock === undefined || typeof lock !== "object") {`,
      ),
    expects: ["schema-invalid lock"],
  },
  {
    // Review F4: acting on a stale snapshot outside the recovery claim. Restoring the
    // observe-then-displace shape reintroduces the window in which a live successor is displaced.
    name: "stale-recovery-without-the-claim (review F4)",
    apply: (source) =>
      source
        .replace(
          `      const decision = withRecoveryClaim(
        options.lockFile,
        options.staleMs,
        () => {`,
          `      const decision = (() => {
        return (() => {`,
        )
        .replace(
          `          return quarantine(options.lockFile, fresh) ? "retry" : "wait";
        },
      );`,
          `          return quarantine(options.lockFile, fresh) ? "retry" : "wait";
        })();
      })();`,
        ),
    expects: ["second holder started"],
  },
  {
    // Review F5: an EMPTY recovery claim is removable by path, so a successor's fresh claim can
    // be deleted. The claim is published by renaming a staging dir that already holds an owner
    // file; stripping the owner file reintroduces exactly that.
    name: "empty-recovery-claim (review F5)",
    apply: (source) =>
      source.replace(
        `    writeFileSync(
      join(staging, "owner"),
      \`\${JSON.stringify({ token, pid: process.pid })}\\n\`,
      { mode: 0o600 },
    );`,
        `    // Restored defect: publish an EMPTY claim.`,
      ),
    expects: ["recovery claim is empty while held"],
  },
  {
    // Review F5b, CowBoy's exact regression: path-based cleanup of an aged claim, which deletes a
    // successor's claim installed between the age check and the displacement.
    name: "aged-claim-removed-by-path (review F5b)",
    apply: (source) =>
      source.replace(
        `  if (Date.now() - measured.mtimeMs < staleMs) return false; // Fresh: another reclaimer is live.`,
        `  if (Date.now() - measured.mtimeMs < staleMs) return false; // Fresh: another reclaimer is live.
  // Restored defect: remove the aged claim by path, with no identity check.
  rmSync(claim, { recursive: true, force: true });
  return true;`,
      ),
    expects: ["successor's claim was deleted from the path"],
  },
];

let red = 0;
let green = 0;
const unexpected = [];

for (const mutation of MUTATIONS) {
  const original = readFileSync(SOURCE, "utf8");
  const mutated = mutation.apply(original);
  if (mutated === original) {
    unexpected.push(
      `${mutation.name}: the mutation did not apply (anchor drifted)`,
    );
    continue;
  }
  const dir = mkdtempSync(join(tmpdir(), "gate-lock-mut-"));
  const target = join(dir, "gate-lock.mjs");
  // A mutation may reference a primitive the corrected source no longer imports; make sure the
  // seeded copy has whatever it needs, or the seed would throw instead of exercising the case.
  const seeded = mutated.includes("writeSync(")
    ? mutated.replace(
        `  writeFileSync,\n} from "node:fs";`,
        `  writeFileSync,\n  writeSync,\n} from "node:fs";`,
      )
    : mutated;
  writeFileSync(target, seeded);

  // The case file reads both the module under test and the preload from env, so a seeded copy
  // is exercised without rewriting the test source.
  const result = spawnSync(process.execPath, [CASES], {
    encoding: "utf8",
    env: {
      ...process.env,
      GATE_LOCK_SCRIPT: target,
      GATE_LOCK_PRELOAD: PRELOAD,
    },
  });
  const output = `${result.stdout}\n${result.stderr}`;
  const isRed = result.status !== 0;
  const matched = mutation.expectsAny
    ? mutation.expects.some((needle) => output.includes(needle))
    : mutation.expects.every((needle) => output.includes(needle));
  const tail = output.trim().split("\n").slice(-4).join(" | ");

  if (mutation.expects.length === 0) {
    if (isRed) {
      unexpected.push(
        `${mutation.name}: expected to stay GREEN but reddened (${tail})`,
      );
    } else {
      green += 1;
      console.log(
        `  ~ ${mutation.name}: green, as recorded (does not redden on its own)`,
      );
    }
  } else if (isRed && matched) {
    red += 1;
    console.log(
      `  ✓ ${mutation.name}: RED on "${mutation.expects.join('", "')}"`,
    );
  } else if (isRed) {
    unexpected.push(
      `${mutation.name}: reddened, but not on the expected case text (wanted ${JSON.stringify(mutation.expects)}; got ${tail})`,
    );
  } else {
    unexpected.push(
      `${mutation.name}: SEED NOT CAUGHT — the case stayed green`,
    );
  }
  rmSync(dir, { recursive: true, force: true });
}

console.log(
  `\nseeded mutations: ${red} reddened on target, ${green} recorded green`,
);
if (unexpected.length) {
  console.error(`${unexpected.length} problem(s):`);
  for (const problem of unexpected) console.error(`  - ${problem}`);
  process.exit(1);
}
console.log(
  "check-lock-mutations: ok (every seeded defect reddens the case that targets it)",
);
