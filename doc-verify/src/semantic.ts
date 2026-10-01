import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  createDeepClause,
  createJevJudgeBackend,
  type JudgeAnswer,
  type JudgeBackend,
  type JudgeBackendRequest,
  type JudgeBackendResponse,
} from "deepclause-sdk";
import { z } from "zod";

import { buildDml, DmlOutcome, parseDmlOutcome } from "./dml.js";
import { canonicalJson, sha256 } from "./hash.js";
import { EvidenceSegment, ExpandedQuestion, ResolvedRubric } from "./rubric.js";
import { BlockedError } from "./types.js";

const cacheSchema = z.object({
  schemaVersion: z.literal(1),
  requestId: z.string().regex(/^[a-f0-9]{64}$/),
  dmlHash: z.string().regex(/^[a-f0-9]{64}$/),
  createdAt: z.number().int().nonnegative(),
  outcome: z.object({
    verdict: z.enum(["PASS", "NO-GO", "NEEDS-REVIEW", "BLOCKED"]),
    ruleId: z.string(),
    answers: z.array(z.enum(["supported", "refuted", "unknown"])),
  }),
  details: z.array(z.object({
    confidence: z.number().optional(),
    distribution: z.array(z.number()).optional(),
  })).optional(),
});

/** The judge's own numbers for one answer; JEV returns no rationale text. */
export interface AnswerDetail {
  confidence?: number;
  distribution?: number[];
}

export interface SemanticEvaluation {
  requestId: string;
  dmlHash: string;
  outcome: DmlOutcome;
  calls: number;
  cacheHits: number;
  rawAnswers: JudgeAnswer[];
  /** Aligned to the questions; empty when a cached entry predates details. */
  details: AnswerDetail[];
}

/** The serialized evidence state sent to the judge. */
export interface EvidenceState {
  schema_version: 2;
  artifact_kind: string;
  segments: EvidenceSegment[];
  questions: Array<{ question_id: string; segment_ids: string[] }>;
}

/**
 * One canonical segment store, addressed by questions. A segment read by three
 * questions is serialized once and referenced three times, so the outbound state
 * is bounded by the document's distinct segments rather than by questions x bodies.
 */
export function buildEvidenceState(input: {
  artifactKind: string;
  questions: ExpandedQuestion[];
}): EvidenceState {
  const store = new Map<string, EvidenceSegment>();
  for (const question of input.questions) {
    for (const segment of question.segments) {
      if (!store.has(segment.id)) {
        store.set(segment.id, segment);
      }
    }
  }
  return {
    schema_version: 2,
    artifact_kind: input.artifactKind,
    segments: [...store.values()].sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0)),
    questions: input.questions.map((question) => ({
      question_id: question.id,
      segment_ids: question.segments.map((segment) => segment.id),
    })),
  };
}

export async function evaluateSemantic(input: {
  root: string;
  artifactKind: string;
  questions: ExpandedQuestion[];
  rubric: ResolvedRubric;
  model: string;
  policyVersion: number;
  maxEvidenceBytes: number;
  forbiddenLiterals: string[];
  maxAgeSeconds: number;
  backend?: JudgeBackend;
  useCache?: boolean;
}): Promise<SemanticEvaluation> {
  const state = buildEvidenceState({ artifactKind: input.artifactKind, questions: input.questions });
  const stateJson = canonicalJson(state);
  enforceOutboundPolicy(stateJson, input.maxEvidenceBytes, input.forbiddenLiterals);
  const program = buildDml({ state, questions: input.questions, threshold: input.rubric.threshold });
  const requestId = sha256(canonicalJson({
    state,
    questions: input.questions.map((question) => ({
      id: question.id,
      item: question.item,
      sections: question.sectionIds,
    })),
    rubricChain: input.rubric.chain,
    dmlHash: program.hash,
    model: input.model,
    policyVersion: input.policyVersion,
    adapter: "deepclause-jev-0.0.89",
  }));
  const cachePath = path.join(input.root, ".doc-verify-cache", `${requestId}.json`);
  if (input.useCache !== false) {
    const cached = await readCache(cachePath, requestId, input.maxAgeSeconds);
    if (cached !== undefined) {
      return {
        requestId, dmlHash: program.hash, outcome: cached.outcome,
        calls: 0, cacheHits: 1, rawAnswers: [], details: cached.details,
      };
    }
  }

  const backend = input.backend ?? productionBackend(input.model);
  enforceCapabilities(backend, input.questions.length, Buffer.byteLength(stateJson));
  const recording = new RecordingBackend(backend);
  const rejectingLlm = {
    complete: (): Promise<never> => Promise.reject(new Error("LLM fallback is disabled")),
  };
  const sdk = await createDeepClause({
    model: "disabled",
    llmBackend: rejectingLlm,
    judgeBackend: recording,
    judgeBackends: { jev: recording },
    defaultJudge: "jev",
  });
  sdk.setToolPolicy({ mode: "whitelist", tools: [] });
  let answerContent: string | undefined;
  try {
    for await (const event of sdk.runDML(program.source, { judgeBackend: "jev", gasLimit: 10_000 })) {
      if (event.type === "answer") {
        answerContent = event.content;
      }
      if (event.type === "tool_call") {
        throw new Error("generated DML attempted tool execution");
      }
      if (event.type === "error") {
        throw new Error("DeepClause DML evaluation failed");
      }
    }
  } catch (error) {
    throw new BlockedError(classifyProviderError(error));
  } finally {
    await sdk.dispose();
  }
  if (answerContent === undefined) {
    throw new BlockedError("DeepClause DML returned no answer");
  }
  const outcome = parseDmlOutcome(answerContent);
  if (outcome.answers.length !== input.questions.length) {
    throw new BlockedError("DeepClause DML returned the wrong answer count");
  }
  if (recording.responses.length !== 1) {
    throw new BlockedError(`expected one JEV call, observed ${String(recording.responses.length)}`);
  }
  const response = recording.responses[0];
  if (response === undefined) {
    throw new BlockedError("JEV response is unavailable");
  }
  const details = answerDetails(response.answers, input.questions.length);
  await mkdir(path.dirname(cachePath), { recursive: true });
  await writeFile(cachePath, `${JSON.stringify({ schemaVersion: 1, requestId, dmlHash: program.hash, createdAt: Date.now(), outcome, details })}\n`, { mode: 0o600 });
  return { requestId, dmlHash: program.hash, outcome, calls: 1, cacheHits: 0, rawAnswers: response.answers, details };
}

function answerDetails(answers: JudgeAnswer[], questionCount: number): AnswerDetail[] {
  // The DML asks every question in one batch, so answers align by position.
  if (answers.length !== questionCount) {
    return [];
  }
  return answers.map((answer) => ({
    ...(answer.confidence === undefined ? {} : { confidence: answer.confidence }),
    ...(answer.distribution === undefined ? {} : { distribution: answer.distribution }),
  }));
}

function productionBackend(model: string): JudgeBackend {
  const apiKey = process.env.TYPESAFE_API_KEY?.trim();
  if (apiKey === undefined || apiKey.length === 0) {
    throw new BlockedError("TYPESAFE_API_KEY is unavailable");
  }
  return createJevJudgeBackend({ apiKey, model, maxRetries: 0 });
}

function enforceCapabilities(backend: JudgeBackend, questionCount: number, stateBytes: number): void {
  const capabilities = backend.capabilities;
  if (!capabilities.batch || !capabilities.confidence || questionCount > capabilities.maxQuestions) {
    throw new BlockedError("JEV backend does not satisfy the required batch capabilities");
  }
  if (stateBytes > capabilities.stateTokenBudget) {
    throw new BlockedError("semantic state exceeds the JEV token budget");
  }
  if (capabilities.maxOptions < 3) {
    throw new BlockedError("JEV backend cannot represent the three answer choices");
  }
}

function enforceOutboundPolicy(state: string, maxBytes: number, forbidden: string[]): void {
  if (Buffer.byteLength(state) > maxBytes) {
    throw new BlockedError(
      `the round's evidence is ${String(Buffer.byteLength(state))} bytes, above the outbound budget of ${String(maxBytes)}; a batch is never split`,
    );
  }
  const lower = state.toLowerCase();
  const generic = ["typesafe_api_key", "api_key=", "-----begin private key-----", "/users/"];
  const match = [...generic, ...forbidden.map((value) => value.toLowerCase())].find((value) => value.length > 0 && lower.includes(value));
  if (match !== undefined) {
    throw new PolicyViolationError("semantic evidence contains prohibited data");
  }
}

export class PolicyViolationError extends Error {
  readonly verdict = "NO-GO" as const;
}

class RecordingBackend implements JudgeBackend {
  readonly id: string;
  readonly capabilities;
  readonly responses: JudgeBackendResponse[] = [];

  constructor(private readonly inner: JudgeBackend) {
    this.id = inner.id;
    this.capabilities = inner.capabilities;
  }

  async complete(request: JudgeBackendRequest): Promise<JudgeBackendResponse> {
    const response = await this.inner.complete(request);
    this.responses.push(response);
    return response;
  }
}

async function readCache(
  cachePath: string,
  requestId: string,
  maxAgeSeconds: number,
): Promise<{ outcome: DmlOutcome; details: AnswerDetail[] } | undefined> {
  try {
    const parsed = cacheSchema.safeParse(JSON.parse(await readFile(cachePath, "utf8")));
    const fresh = parsed.success && Date.now() - parsed.data.createdAt <= maxAgeSeconds * 1000;
    if (!fresh || parsed.data.requestId !== requestId) {
      return undefined;
    }
    return { outcome: parsed.data.outcome, details: (parsed.data.details ?? []).map(stripUndefined) };
  } catch {
    return undefined;
  }
}

function classifyProviderError(error: unknown): string {
  if (error instanceof BlockedError) {
    return error.message;
  }
  if (error instanceof Error) {
    return `JEV call failed: ${error.name}`;
  }
  return "JEV call failed";
}

function stripUndefined(detail: { confidence?: number | undefined; distribution?: number[] | undefined }): AnswerDetail {
  return {
    ...(detail.confidence === undefined ? {} : { confidence: detail.confidence }),
    ...(detail.distribution === undefined ? {} : { distribution: detail.distribution }),
  };
}
