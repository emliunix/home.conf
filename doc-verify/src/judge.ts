/**
 * The judge client and the outbound-policy error the design-04 engine shares with the checker.
 *
 * The engine asks its keyed batches through `engine/oracles.ts`, which enforces the outbound
 * policy and throws `PolicyViolationError` when evidence carries prohibited data. The checker
 * builds the production JEV backend here; it is BLOCKED, never faked, when no key is available.
 */
import { createJevJudgeBackend, type JudgeBackend } from "deepclause-sdk";

import { hasJudgeBaseUrl, hasJudgeProxy, resolveDocVerifyEnvPath } from "./local-env.js";
import { BlockedError } from "./types.js";

const ENV_FILE = ".env.doc-verify";

function resolveBaseUrl(): string | undefined {
  const raw = process.env.TYPESAFE_BASE_URL?.trim();
  if (raw === undefined || raw.length === 0) {
    return undefined;
  }
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new BlockedError("TYPESAFE_BASE_URL is not a valid http(s) URL");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new BlockedError("TYPESAFE_BASE_URL must use http: or https:");
  }
  return raw;
}

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
  const baseUrl = resolveBaseUrl();
  return createJevJudgeBackend({
    apiKey,
    model,
    maxRetries: 0,
    ...(baseUrl === undefined ? {} : { baseUrl }),
  });
}

/**
 * The prerequisites the judge needs, named individually.
 *
 * #317: the credential file carries the key **and** optional routing (`TYPESAFE_BASE_URL` or a
 * proxy), and the key alone may not reach the origin. When the key is present but the judge still
 * cannot be reached, the reader must be told *which* setting is missing -- otherwise the only
 * symptom is "judge request failed", which names the request and not the absent prerequisite.
 */
export function judgePrerequisiteGap(root: string | undefined): string | undefined {
  if (root === undefined || hasJudgeProxy(root) || hasJudgeBaseUrl(root)) {
    return undefined;
  }
  return (
    `setup: neither TYPESAFE_BASE_URL nor a proxy is set, and neither is in ${ENV_FILE} ` +
    `(TYPESAFE_BASE_URL, HTTPS_PROXY, or HTTP_PROXY). When direct access is blocked, ` +
    `set TYPESAFE_BASE_URL or HTTPS_PROXY, or add one to ${ENV_FILE}. ` +
    `This is not a document finding.`
  );
}

/** Outbound evidence contains a secret or a configured forbidden literal: the verdict is NO-GO. */
export class PolicyViolationError extends Error {
  readonly verdict = "NO-GO" as const;
}
