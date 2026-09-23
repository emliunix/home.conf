#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";

import { createJevJudgeBackend } from "deepclause-sdk";
import { z } from "zod";

import { parseConfig } from "./config.js";
import { sha256 } from "./hash.js";
import { repoPath } from "./types.js";

const localResponseSchema = z.object({
  response: z.object({
    answers: z.record(z.string(), z.object({ choice: z.string() }).loose()),
  }).loose(),
}).loose();

async function main(): Promise<void> {
  const root = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
  const configText = await readFile(`${root}/.doc-verify.yaml`, "utf8");
  const config = parseConfig({ path: repoPath(".doc-verify.yaml"), content: configText, hash: sha256(configText) });
  const clientPath = process.env.JEV_PROMPTS_CLIENT?.trim();
  const apiKey = process.env.TYPESAFE_API_KEY?.trim();
  if (clientPath === undefined || clientPath.length === 0 || apiKey === undefined || apiKey.length === 0) {
    throw new Error("BLOCKED: set JEV_PROMPTS_CLIENT and TYPESAFE_API_KEY");
  }
  const client = await readFile(clientPath);
  const clientHash = sha256(client);
  if (clientHash !== config.judge.client_sha256) {
    throw new Error("BLOCKED: configured jev-prompts client hash does not match");
  }

  const state = {
    fixture: "Synthetic parity check, not project evidence",
    claim: "The check was not run.",
  };
  const localRequest = {
    model: config.judge.model,
    state,
    questions: {
      support: {
        type: "choice",
        instructions: "Does the evidence support a claim that the check passed? Use only the supplied state.",
        criteria: {
          supported: "The state explicitly says the check ran and passed.",
          refuted: "The state says the check failed or did not run.",
          unknown: "The state does not resolve whether the check ran and passed.",
        },
      },
    },
  };
  const local = spawnSync("uv", ["run", clientPath, "-"], {
    input: JSON.stringify(localRequest),
    encoding: "utf8",
    env: process.env,
    maxBuffer: 1024 * 1024,
  });
  if (local.status !== 0) {
    throw new Error("BLOCKED: external jev-prompts client failed");
  }
  const localParsed = localResponseSchema.parse(JSON.parse(local.stdout));
  const localChoice = localParsed.response.answers.support?.choice;

  const backend = createJevJudgeBackend({ apiKey, model: config.judge.model, maxRetries: 0 });
  const deepClause = await backend.complete({
    state,
    model: config.judge.model,
    requiredCapabilities: ["batch", "confidence"],
    questions: [{
      id: "support",
      kind: "choose",
      instruction: "Does the evidence support a claim that the check passed? Use only the supplied state.",
      options: [
        { id: "supported", description: "The state explicitly says the check ran and passed." },
        { id: "refuted", description: "The state says the check failed or did not run." },
        { id: "unknown", description: "The state does not resolve whether the check ran and passed." },
      ],
    }],
  });
  const deepClauseChoice = deepClause.answers[0]?.value;
  if (localChoice === undefined || deepClauseChoice === undefined || localChoice !== deepClauseChoice) {
    throw new Error("JEV parity mismatch");
  }
  process.stdout.write(`${JSON.stringify({
    status: "PASS",
    client_sha256: clientHash,
    model: config.judge.model,
    question_ids: ["support"],
    normalized_answers_equal: true,
    answer: localChoice,
  }, null, 2)}\n`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "parity check failed";
  process.stderr.write(`${message}\n`);
  process.exitCode = message.startsWith("BLOCKED:") ? 3 : 1;
});
