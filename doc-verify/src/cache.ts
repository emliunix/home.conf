/**
 * The persistent oracle cache: one file per atom answer at `.doc-verify-cache/atoms/<key>.json`
 * under the repository root, keyed by the engine's per-atom cache key (model, question, labels,
 * evidence hash, policy version). Files are written mode 0600 in a 0700 directory; the
 * directory belongs in the consumer's `.gitignore`.
 */
import { chmodSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { OracleCache } from "./engine/index.js";

/** `use` reads and writes; `refresh` writes without reading; `off` does neither. */
export type CacheMode = "use" | "refresh" | "off";

export const CACHE_DIR = ".doc-verify-cache/atoms";

export function fileOracleCache(root: string, mode: Exclude<CacheMode, "off">): OracleCache {
  const directory = path.join(root, CACHE_DIR);
  const file = (key: string): string => {
    if (!/^[a-f0-9]{64}$/.test(key)) {
      throw new Error(`oracle cache key ${key} is not a sha256 digest`);
    }
    return path.join(directory, `${key}.json`);
  };
  return {
    get(key) {
      if (mode === "refresh") {
        return undefined;
      }
      let value: unknown;
      try {
        value = JSON.parse(readFileSync(file(key), "utf8"));
      } catch {
        return undefined;
      }
      const entry = value as { answered?: unknown; distribution?: unknown } | null;
      if (typeof entry?.answered !== "string" || !Array.isArray(entry.distribution)
        || !entry.distribution.every((item) => typeof item === "number")) {
        return undefined;
      }
      return { answered: entry.answered, distribution: entry.distribution };
    },
    set(key, value) {
      mkdirSync(directory, { recursive: true, mode: 0o700 });
      const target = file(key);
      const temporary = `${target}.${String(process.pid)}.tmp`;
      writeFileSync(temporary, `${JSON.stringify({ answered: value.answered, distribution: value.distribution })}\n`, { mode: 0o600 });
      chmodSync(temporary, 0o600);
      renameSync(temporary, target);
    },
  };
}
