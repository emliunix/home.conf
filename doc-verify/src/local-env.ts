import { readFileSync } from "node:fs";
import path from "node:path";

import { BlockedError } from "./types.js";

const fileName = ".env.doc-verify";

/** Read the gitignored repo dotenv file. An existing TYPESAFE_API_KEY wins. */
export function loadDocVerifyEnv(root: string): void {
  if ((process.env.TYPESAFE_API_KEY ?? "").trim().length > 0) {
    return;
  }
  const filePath = path.join(root, fileName);
  let text: string;
  try {
    text = readFileSync(filePath, "utf8");
  } catch (error) {
    if (errorCode(error) === "ENOENT") {
      return;
    }
    const code = errorCode(error);
    throw new BlockedError(`cannot read ${fileName}${code === undefined ? "" : ` (${code})`}`);
  }
  const apiKey = dotenvValue(text, "API_KEY")?.trim();
  if (apiKey === undefined || apiKey.length === 0) {
    return;
  }
  process.env.TYPESAFE_API_KEY = apiKey;
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
