/**
 * The judge client and the outbound-policy error the design-04 engine shares with the checker.
 *
 * The engine asks its keyed batches through `engine/oracles.ts`, which enforces the outbound
 * policy and throws `PolicyViolationError` when evidence carries prohibited data. The checker
 * builds the production JEV backend here; it is BLOCKED, never faked, when no key is available.
 */
import { createJevJudgeBackend, type JudgeBackend } from "deepclause-sdk";

import { BlockedError } from "./types.js";

export function productionBackend(model: string): JudgeBackend {
  const apiKey = process.env.TYPESAFE_API_KEY?.trim();
  if (apiKey === undefined || apiKey.length === 0) {
    throw new BlockedError("TYPESAFE_API_KEY is unavailable");
  }
  return createJevJudgeBackend({ apiKey, model, maxRetries: 0 });
}

/** Outbound evidence contains a secret or a configured forbidden literal: the verdict is NO-GO. */
export class PolicyViolationError extends Error {
  readonly verdict = "NO-GO" as const;
}
