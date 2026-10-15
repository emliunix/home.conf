import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import * as http from "node:http";
import path from "node:path";

import { BlockedError } from "./types.js";

const fileName = ".env.doc-verify";

/**
 * The proxy names the file may carry, in the order they are tried. `ALL_PROXY` is deliberately
 * absent: it is the conventional name elsewhere in this repo, but Node's own resolver does not
 * honor it, so accepting it here would promise a route that does not exist.
 */
const proxyNames = ["HTTPS_PROXY", "HTTP_PROXY"] as const;

/** Node's proxy resolver, which the shipped types do not declare yet. */
type ProxyFromEnv = (env?: NodeJS.ProcessEnv) => (() => void) | undefined;

/**
 * Resolve which `.env.doc-verify` file to read (#312).
 * 1. `<root>/.env.doc-verify` wins when present.
 * 2. Otherwise the canonical checkout for this shared repository (first
 *    `git worktree list --porcelain` path), when it has the file.
 * 3. Otherwise `undefined` — caller refuses.
 *
 * Reads only; never copies secret bytes into another worktree.
 */
export function resolveDocVerifyEnvPath(root: string): string | undefined {  const local = path.join(root, fileName);
  if (existsSync(local)) {
    return local;
  }
  const canonical = canonicalCheckoutRoot(root);
  if (canonical === undefined) {
    return undefined;
  }
  const resolvedRoot = path.resolve(root);
  const resolvedCanonical = path.resolve(canonical);
  if (resolvedCanonical === resolvedRoot) {
    return undefined;
  }
  const fallback = path.join(resolvedCanonical, fileName);
  return existsSync(fallback) ? fallback : undefined;
}

/** Absolute path of the repository's main worktree, or `undefined` if Git cannot say. */
export function canonicalCheckoutRoot(root: string): string | undefined {
  try {
    const out = execFileSync("git", ["-C", root, "worktree", "list", "--porcelain"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    for (const line of out.split(/\r?\n/)) {
      if (line.startsWith("worktree ")) {
        const candidate = line.slice("worktree ".length).trim();
        if (candidate.length > 0) {
          return candidate;
        }
      }
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/** Read the gitignored repo dotenv file. An existing TYPESAFE_API_KEY wins. */
export function loadDocVerifyEnv(root: string): void {
  const keyMissing = (process.env.TYPESAFE_API_KEY ?? "").trim().length === 0;
  const proxyMissing = processProxy() === undefined;
  if (keyMissing || proxyMissing) {
    let text: string | undefined;
    try {
      text = credentialText(root);
    } catch (error) {
      // The key is required to run; the proxy is not. An unreadable file stays fatal for the
      // key, as it always was, and must not fail a run that already has one -- otherwise a
      // broken credential symlink would redden a commit that the key alone was sufficient for.
      if (keyMissing) {
        throw error;
      }
      text = undefined;
    }
    if (text !== undefined) {
      if (keyMissing) {
        const apiKey = dotenvValue(text, "API_KEY")?.trim();
        if (apiKey !== undefined && apiKey.length > 0) {
          process.env.TYPESAFE_API_KEY = apiKey;
        }
      }
      if (proxyMissing) {
        const fromFile = fileProxy(text);
        if (fromFile !== undefined) {
          process.env.HTTPS_PROXY = fromFile;
          process.env.HTTP_PROXY = fromFile;
        }
      }
    }
  }
  // Routing is the CALL, not the variables: Node resolves these names only when this runs, and
  // resolving them at process start is not available to us because the values may come from the
  // file above. It is a no-op when no proxy is configured, so an unconfigured host is unchanged.
  const resolveProxy = proxyFromEnv();
  if (resolveProxy === undefined) {
    // A configured route that cannot be applied must not look like no route at all: the judge
    // would then fail with the same bare error a host without a proxy fails with, and nothing
    // would name the reason. The resolver needs Node 24; `engines` here allows older runtimes.
    if (processProxy() !== undefined) {
      throw new BlockedError(
        "HTTPS_PROXY is configured but this Node runtime has no proxy resolver "
          + "(setGlobalProxyFromEnv), so the judge would be dialed directly",
      );
    }
    return;
  }
  resolveProxy(process.env);
}

/** Node's shipped proxy resolver, or `undefined` on a runtime that predates it. */
function proxyFromEnv(): ProxyFromEnv | undefined {
  const candidate = (http as typeof http & { setGlobalProxyFromEnv?: ProxyFromEnv })
    .setGlobalProxyFromEnv;
  return typeof candidate === "function" ? candidate : undefined;
}

/** The proxy already set in the process environment, if any. */
function processProxy(): string | undefined {
  for (const name of proxyNames) {
    const value = (process.env[name] ?? "").trim();
    if (value.length > 0) {
      return value;
    }
  }
  return undefined;
}

/**
 * Whether a proxy is available to the judge, from the process or from the credential file.
 *
 * `productionBackend` names a missing credential *file*, and the credential file carries **two**
 * settings: the API key and a proxy. The key alone is not sufficient -- a run with the key and no
 * proxy fails at the judge request, which names the failed request rather than the absent setting.
 * This is exported so the failure can name the second prerequisite the way #310/#312 name the first.
 */
export function hasJudgeProxy(root: string): boolean {
  if (processProxy() !== undefined) {
    return true;
  }
  const text = credentialText(root);
  return text !== undefined && fileProxy(text) !== undefined;
}

/** The proxy named by the credential file, if any. */
function fileProxy(text: string): string | undefined {
  for (const name of proxyNames) {
    const value = dotenvValue(text, name)?.trim();
    if (value !== undefined && value.length > 0) {
      return value;
    }
  }
  return undefined;
}

/** The credential file's text, or `undefined` when local and canonical are both absent. */
function credentialText(root: string): string | undefined {
  const filePath = resolveDocVerifyEnvPath(root);
  if (filePath === undefined) {
    return undefined;
  }
  try {
    return readFileSync(filePath, "utf8");
  } catch (error) {
    if (errorCode(error) === "ENOENT") {
      return undefined;
    }
    const code = errorCode(error);
    throw new BlockedError(`cannot read ${fileName}${code === undefined ? "" : ` (${code})`}`);
  }
}

function dotenvValue(text: string, key: string): string | undefined {
  let found: string | undefined;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith("#")) {
      continue;
    }
    const assignment = line.startsWith("export ") ? line.slice("export ".length).trim() : line;
    const separator = assignment.indexOf("=");
    if (separator <= 0) {
      continue;
    }
    const name = assignment.slice(0, separator).trim();
    if (name !== key) {
      continue;
    }
    found = unquote(assignment.slice(separator + 1).trim());
  }
  return found;
}

function unquote(value: string): string {
  if (value.length < 2) {
    return value;
  }
  const first = value[0];
  const last = value[value.length - 1];
  if ((first === "\"" && last === "\"") || (first === "'" && last === "'")) {
    return value.slice(1, -1);
  }
  return value;
}

function errorCode(error: unknown): string | undefined {
  if (typeof error === "object" && error !== null && "code" in error && typeof error.code === "string") {
    return error.code;
  }
  return undefined;
}
