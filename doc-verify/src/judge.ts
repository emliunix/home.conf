/**
 * The judge client and the outbound-policy error the design-04 engine shares with the checker.
 *
 * The engine asks its keyed batches through `engine/oracles.ts`, which enforces the outbound
 * policy and throws `PolicyViolationError` when evidence carries prohibited data. The checker
 * builds the production JEV backend here; it is BLOCKED, never faked, when no key is available.
 */
import { existsSync } from "node:fs";
import path from "node:path";

import { createJevJudgeBackend, type JudgeBackend } from "deepclause-sdk";

import { BlockedError } from "./types.js";

const ENV_FILE = ".env.doc-verify";

export function productionBackend(model: string, root?: string): JudgeBackend {
  const apiKey = process.env.TYPESAFE_API_KEY?.trim();
  if (apiKey === undefined || apiKey.length === 0) {
    // #310 / LAW 738: a fresh linked worktree often lacks the gitignored credential
    // symlink. Naming that file beats "TYPESAFE_API_KEY is unavailable", which sends
    // authors hunting credentials that were never the defect.
    if (root !== undefined && !existsSync(path.join(root, ENV_FILE))) {
      throw new BlockedError(
        `setup: ${ENV_FILE} is absent in this worktree (canonical checkout symlinks it ` +
          `to notes/common/creds/env-jev). Link or copy it here, or export TYPESAFE_API_KEY. ` +
          `This is not a document finding.`,
      );
    }
    throw new BlockedError("TYPESAFE_API_KEY is unavailable");
  }
  return createJevJudgeBackend({ apiKey, model, maxRetries: 0 });
}

/** Outbound evidence contains a secret or a configured forbidden literal: the verdict is NO-GO. */
export class PolicyViolationError extends Error {
  readonly verdict = "NO-GO" as const;
}
