// Shared fixtures for the design 04 engine row tests. The judge answers only from the
// evidence entry and the question it receives, never by position.

import { createMockJevJudgeBackend, type JudgeAnswer, type JudgeBackend, type JudgeBackendRequest } from "deepclause-sdk";

import { runProgram, type OracleCache, type RunProgramInput } from "../src/engine/index.js";

export interface SeenQuestion {
  instruction: string;
  key: string;
  text: string;
  options: string[];
}

/** `distribution: "missing"` omits it; an absent distribution is one-hot on `value`. */
export interface ScriptedAnswer {
  value: string;
  distribution?: number[] | "missing";
}

export function scriptedJudge(decide: (question: SeenQuestion) => ScriptedAnswer): { backend: JudgeBackend; requests: JudgeBackendRequest[] } {
  const requests: JudgeBackendRequest[] = [];
  const backend = createMockJevJudgeBackend({
    answers: (request) => {
      requests.push(request);
      const state = request.state as { evidence: Record<string, { text: string }> };
      return request.questions.map((question): JudgeAnswer => {
        const instruction = typeof question.instruction === "string" ? question.instruction : "";
        const key = /state\.evidence\.([A-Za-z0-9_-]+)/.exec(instruction)?.[1] ?? "";
        const options = (question.options ?? []).map((option) => option.id);
        const answer = decide({ instruction, key, text: state.evidence[key]?.text ?? "", options });
        const distribution = answer.distribution ?? options.map((id) => (id === answer.value ? 1 : 0));
        return {
          id: question.id, kind: "choose", value: answer.value, confidence: 1, basis: "mock",
          ...(distribution === "missing" ? {} : { distribution }),
        };
      });
    },
  });
  return { backend, requests };
}

/** Classifies a section by the heading words its evidence contains. */
export function byHeading(table: Record<string, string>, fallback = "other"): (question: SeenQuestion) => ScriptedAnswer {
  return (question) => {
    const firstLine = question.text.split("\n")[0] ?? "";
    const match = Object.entries(table).find(([words]) => firstLine.includes(words));
    const value = match?.[1] ?? fallback;
    return { value: question.options.includes(value) ? value : "unknown" };
  };
}

export const DOC = [
  "# 07 - Fixture",
  "",
  "## Problem statement",
  "",
  "Readers cannot find the owner.",
  "",
  "## Scope",
  "",
  "### Owner index",
  "",
  "An index of owners.",
  "",
  "### Lunch menu",
  "",
  "Soup on Fridays.",
  "",
  "## Rationale",
  "",
  "One index beats three lists.",
  "",
].join("\n");

export const DOC_PATH = "design/07-fixture.md";

export function run(moduleYaml: string, backend: JudgeBackend, extra: { markdown?: string; cache?: OracleCache; policy?: RunProgramInput["policy"]; profile?: string } = {}) {
  return runProgram({
    moduleYaml,
    documents: [{ path: DOC_PATH, markdown: extra.markdown ?? DOC }],
    backend,
    model: "jev-test",
    policy: extra.policy ?? { maxEvidenceBytes: 20_000, forbiddenLiterals: [] },
    ...(extra.cache === undefined ? {} : { cache: extra.cache }),
    ...(extra.profile === undefined ? {} : { profile: extra.profile }),
  });
}

/** A module header plus body lines; keeps each test's program readable. */
export function moduleText(body: string, rounds = 1): string {
  return `schema_version: 2\nkind: verification-module\nmodule: t\nrounds: ${String(rounds)}\n${body}`;
}

export const PURPOSE_ORACLE = `  purpose(D, S, P):
    choose: [problem, scope, rationale, other]
    ask: What is this section for?
    evidence: core.own(D, S)
    threshold: 0.5
`;

export const PURPOSES = { "Problem statement": "problem", "Scope": "scope", "Rationale": "rationale" };
