/**
 * The judge client and the outbound-policy error the design-04 engine shares with the checker.
 *
 * The engine asks its keyed batches through `engine/oracles.ts`, which enforces the outbound
 * policy and throws `PolicyViolationError` when evidence carries prohibited data. The checker
 * builds the production JEV backend here; it is BLOCKED, never faked, when no key is available.
 */
import { createJevJudgeBackend, type JudgeBackend } from "deepclause-sdk";

import { hasJudgeProxy, resolveDocVerifyEnvPath } from "./local-env.js";
import { BlockedError } from "./types.js";

const ENV_FILE = ".env.doc-verify";

export function productionBackend(model: string, root?: string): JudgeBackend {
  const apiKey = process.env.TYPESAFE_API_KEY?.trim();
  if (apiKey === undefined || apiKey.length === 0) {
    // #310 / #312: name a missing credential *file* (local and canonical) rather than
    // "TYPESAFE_API_KEY is unavailable", which sends authors hunting the wrong thing.
    if (root !== undefined && resolveDocVerifyEnvPath(root) === undefined) {
      throw new BlockedError(
        `setup: ${ENV_FILE} is absent in this worktree and in the canonical checkout ` +
          `(main worktree usually symlinks it to notes/common/creds/env-jev). ` +
          `Export TYPESAFE_API_KEY, or add the file. This is not a document finding.`,
      );
    }
    throw new BlockedError("TYPESAFE_API_KEY is unavailable");
  }
    return createJevJudgeBackend({ apiKey, model, maxRetries: 0 });
  }

  /**
   * The prerequisites the judge needs, named individually.
   *
   * #317: the credential file carries the key **and** a proxy, and the key alone is not
   * sufficient. When the key is present but the judge still cannot be reached, the reader must be
   * told *which* setting is missing -- otherwise the only symptom is "judge request failed",
   * which names the request and not the absent prerequisite.
   */
  export function judgePrerequisiteGap(root: string | undefined): string | undefined {
    if (root === undefined || hasJudgeProxy(root)) {
      return undefined;
    }
    return (
      `setup: no proxy is set and none is in ${ENV_FILE} ` +
      `(HTTPS_PROXY or HTTP_PROXY). The judge needs both the key and a proxy; ` +
      `with the key alone the judge request fails. Set HTTPS_PROXY, or add it to the file. ` +
      `This is not a document finding.`
    );
  }

/** Outbound evidence contains a secret or a configured forbidden literal: the verdict is NO-GO. */
export class PolicyViolationError extends Error {
  readonly verdict = "NO-GO" as const;
}
