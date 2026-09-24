import path from "node:path";

import YAML from "yaml";
import { z } from "zod";

import { CompanionProfile, VerificationStrategy, verificationStrategySchema } from "./config.js";
import { RepoPath, TextBlob, UsageError, repoPath } from "./types.js";

export interface StrategyRubricRoot {
  reference: string;
}

export interface StrategySource {
  path: RepoPath;
  fragment: string;
}

export interface EffectiveVerificationStrategy {
  defaultProfile: "draft" | "promotion";
  profiles: {
    draft: CompanionProfile;
    promotion: CompanionProfile;
  };
  rubricRoots: StrategyRubricRoot[];
  chain: StrategySource[];
}

export type StrategyInput =
  | { kind: "reference"; reference: string }
  | { kind: "inline"; strategy: VerificationStrategy; declaringPath: RepoPath };

const strategyFileSchema = z.object({
  schema_version: z.literal(1),
  kind: z.literal("verification-strategy"),
  verification: verificationStrategySchema,
}).strict();

export async function resolveVerificationStrategy(input: {
  root: string;
  source: StrategyInput;
  readBlob: (path: RepoPath) => Promise<TextBlob>;
}): Promise<EffectiveVerificationStrategy> {
  const active = new Set<string>();
  const rubricRoots: StrategyRubricRoot[] = [];
  const chain: StrategySource[] = [];
  let defaultProfile: "draft" | "promotion" | undefined;
  let draft: CompanionProfile = {};
  let promotion: CompanionProfile = {};

  const apply = async (strategy: VerificationStrategy, declaringPath: RepoPath, fragment: string): Promise<void> => {
    if (strategy.inherits !== undefined) {
      const target = parseReference(input.root, strategy.inherits, declaringPath);
      const key = `${target.path}#${target.fragment}`;
      if (active.has(key)) {
        throw new UsageError(`verification inheritance cycle at ${key}`);
      }
      active.add(key);
      const blob = await input.readBlob(target.path);
      let value: unknown;
      try {
        value = YAML.parse(blob.content);
      } catch {
        throw new UsageError(`invalid ${target.path}: malformed YAML`);
      }
      const file = strategyFileSchema.safeParse(value);
      if (!file.success) {
        throw new UsageError(`invalid ${target.path}: ${z.prettifyError(file.error)}`);
      }
      const parent = verificationStrategySchema.safeParse(resolveFragment(file.data, target.fragment));
      if (!parent.success) {
        throw new UsageError(`invalid ${key}: ${z.prettifyError(parent.error)}`);
      }
      await apply(parent.data, target.path, target.fragment);
      active.delete(key);
    }
    if (strategy.rubrics !== undefined) {
      rubricRoots.push({ reference: `${declaringPath}#/verification/rubrics` });
    }
    if (strategy.default_profile !== undefined) {
      defaultProfile = strategy.default_profile;
    }
    if (strategy.profiles?.draft !== undefined) {
      draft = { ...draft, ...strategy.profiles.draft };
    }
    if (strategy.profiles?.promotion !== undefined) {
      promotion = { ...promotion, ...strategy.profiles.promotion };
    }
    chain.push({ path: declaringPath, fragment });
  };

  if (input.source.kind === "reference") {
    const target = parseReference(input.root, input.source.reference);
    const blob = await input.readBlob(target.path);
    let value: unknown;
    try {
      value = YAML.parse(blob.content);
    } catch {
      throw new UsageError(`invalid ${target.path}: malformed YAML`);
    }
    const file = strategyFileSchema.safeParse(value);
    if (!file.success) {
      throw new UsageError(`invalid ${target.path}: ${z.prettifyError(file.error)}`);
    }
    const strategy = verificationStrategySchema.safeParse(resolveFragment(file.data, target.fragment));
    if (!strategy.success) {
      throw new UsageError(`invalid ${target.path}#${target.fragment}: ${z.prettifyError(strategy.error)}`);
    }
    await apply(strategy.data, target.path, target.fragment);
  } else {
    await apply(input.source.strategy, input.source.declaringPath, "/verification");
  }

  if (rubricRoots.length === 0) {
    throw new UsageError("resolved verification strategy has no rubrics");
  }
  if (defaultProfile === undefined) {
    throw new UsageError("resolved verification strategy has no default_profile");
  }
  return { defaultProfile, profiles: { draft, promotion }, rubricRoots, chain };
}

function parseReference(root: string, reference: string, declaringPath?: RepoPath): {
  path: RepoPath;
  fragment: string;
} {
  const hashIndex = reference.indexOf("#");
  if (hashIndex < 1 || hashIndex === reference.length - 1) {
    throw new UsageError(`verification reference must be PATH#FRAGMENT: ${reference}`);
  }
  const filePart = reference.slice(0, hashIndex);
  const fragment = reference.slice(hashIndex + 1);
  if (path.isAbsolute(filePart)) {
    throw new UsageError(`absolute verification path is not allowed: ${filePart}`);
  }
  const base = declaringPath === undefined ? "" : path.posix.dirname(declaringPath);
  const relative = path.posix.normalize(path.posix.join(base, filePart));
  if (relative === ".." || relative.startsWith("../")) {
    throw new UsageError(`verification path escapes repository: ${reference}`);
  }
  const absolute = path.resolve(root, relative);
  const relativeCheck = path.relative(root, absolute);
  if (relativeCheck === ".." || relativeCheck.startsWith(`..${path.sep}`) || path.isAbsolute(relativeCheck)) {
    throw new UsageError(`verification path escapes repository: ${reference}`);
  }
  return { path: repoPath(relative.split(path.sep).join(path.posix.sep)), fragment };
}

function resolveFragment(document: unknown, fragment: string): unknown {
  const rawParts = fragment.startsWith("/") ? fragment.slice(1).split("/") : [fragment];
  if (rawParts.some((part) => part.length === 0)) {
    throw new UsageError(`invalid verification fragment: #${fragment}`);
  }
  let value = document;
  for (const rawPart of rawParts) {
    const part = rawPart.replaceAll("~1", "/").replaceAll("~0", "~");
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      throw new UsageError(`verification fragment is not a mapping path: #${fragment}`);
    }
    const record = z.record(z.string(), z.unknown()).parse(value);
    if (!(part in record)) {
      throw new UsageError(`verification fragment does not exist: #${fragment}`);
    }
    value = record[part];
  }
  return value;
}
