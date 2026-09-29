/**
 * Oracle atoms as keyed judge questions (design 04 §Oracles and thresholds).
 *
 * Each ground atom is one question. Its evidence entry and its instruction share one
 * key, so an answer binds to its atom by construction; answers are matched by question
 * id, never by position. A threshold reads the argmax distribution value and can only
 * demote an answer to unknown.
 */

import type { JudgeAnswer, JudgeBackend, JudgeQuestion } from "deepclause-sdk";

import { canonicalJson, sha256 } from "../hash.js";
import { PolicyViolationError } from "../semantic.js";
import { BlockedError } from "../types.js";
import type { Oracle } from "./checker.js";
import { UNKNOWN, type Demand, type OracleView } from "./evaluate.js";
import { bodyEvidence, ownEvidence, unionEvidence, type DocumentFacts, type EvidenceText } from "./facts.js";
import { listItems, termText, type Term } from "./terms.js";

/** One answered (or unaskable) oracle atom, as a proof leaf shows it. */
export interface OracleLeaf {
  /** The evidence key the judge saw; `-` when the atom was never sent. */
  key: string;
  /** The atom's inputs as text; the label is the answer. */
  atom: string;
  question: string;
  sections: string[];
  bytes: number;
  /** The label after thresholding: a declared label or `unknown`. */
  label: string;
  /** The judge's argmax label before thresholding. */
  answered: string;
  options: string[];
  distribution: number[];
  threshold: number;
  round: number;
  cacheHit: boolean;
  finding: string | undefined;
}

/** A per-atom answer cache keyed by (model, question, labels, evidence hash, policy version). */
export interface OracleCache {
  get(key: string): Promise<CachedAnswer | undefined> | CachedAnswer | undefined;
  set(key: string, value: CachedAnswer): Promise<void> | void;
}

export interface CachedAnswer {
  answered: string;
  distribution: number[];
}

export function memoryOracleCache(): OracleCache {
  const entries = new Map<string, CachedAnswer>();
  return {
    get: (key) => entries.get(key),
    set: (key, value) => {
      entries.set(key, value);
    },
  };
}

export interface OutboundPolicy {
  maxEvidenceBytes: number;
  forbiddenLiterals: string[];
  version?: number;
}

export interface RequestRecord {
  round: number;
  document: string;
  questions: number;
  keys: string[];
  stateBytes: number;
  id: string;
}

export class OracleStore implements OracleView {
  readonly leaves = new Map<string, OracleLeaf>();

  lookup(key: string): { label: string } | undefined {
    return this.leaves.get(key);
  }
}

interface Prepared {
  demand: Demand;
  key: string;
  question: string;
  options: string[];
  evidence: EvidenceText;
  cacheKey: string;
}

/**
 * Asks one round of demanded atoms: one keyed batch per document. An atom whose
 * evidence does not resolve is unknown and never sent.
 */
export async function askRound(input: {
  round: number;
  demands: Demand[];
  documents: Map<string, DocumentFacts>;
  store: OracleStore;
  backend: JudgeBackend;
  model: string;
  policy: OutboundPolicy;
  cache: OracleCache | undefined;
}): Promise<RequestRecord[]> {
  const byDocument = new Map<string, Prepared[]>();
  const usedKeys = new Map<string, string>();
  for (const demand of [...input.demands].sort((a, b) => a.key.localeCompare(b.key))) {
    const oracle = demand.oracle;
    const documentId = termText(demand.inputs[0] as Term);
    const document = input.documents.get(documentId);
    const evidence = document === undefined ? undefined : resolveEvidence(oracle, demand.inputs, document);
    const question = renderQuestion(oracle, demand.inputs);
    const options = [...oracle.labels, UNKNOWN];
    if (evidence === undefined) {
      input.store.leaves.set(demand.key, unaskedLeaf(demand, question, options, input.round, "its evidence names a section the document does not have"));
      continue;
    }
    const bytes = Buffer.byteLength(evidence.text);
    if (oracle.maxBytes !== undefined && bytes > oracle.maxBytes) {
      throw new BlockedError(`evidence for ${demand.key} is ${String(bytes)} bytes, above max_bytes ${String(oracle.maxBytes)}`);
    }
    const key = evidenceKey(demand.key);
    const clash = usedKeys.get(key);
    if (clash !== undefined && clash !== demand.key) {
      throw new BlockedError(`evidence key ${key} names both ${clash} and ${demand.key}`);
    }
    usedKeys.set(key, demand.key);
    const cacheKey = sha256(canonicalJson({
      model: input.model, question, labels: options, evidence: sha256(evidence.text), policy: input.policy.version ?? 1,
    }));
    const cached = await input.cache?.get(cacheKey);
    if (cached !== undefined) {
      input.store.leaves.set(demand.key, thresholdLeaf({ demand, key, question, options, evidence, cacheKey }, cached, input.round, true));
      continue;
    }
    const list = byDocument.get(documentId) ?? [];
    list.push({ demand, key, question, options, evidence, cacheKey });
    byDocument.set(documentId, list);
  }

  const records: RequestRecord[] = [];
  for (const [document, prepared] of byDocument) {
    const state = {
      schema_version: 2,
      document,
      round: input.round,
      evidence: Object.fromEntries(prepared.map((entry) => [entry.key, { sections: entry.evidence.sections, text: entry.evidence.text }])),
    };
    const stateJson = canonicalJson(state);
    enforceOutboundPolicy(stateJson, input.policy);
    enforceCapabilities(input.backend, prepared, Buffer.byteLength(stateJson));
    const questions: JudgeQuestion[] = prepared.map((entry) => ({
      id: entry.key,
      kind: "choose",
      instruction: `Judge ONLY state.evidence.${entry.key}. ${entry.question}`,
      options: entry.options.map((id) => ({ id })),
    }));
    let answers: JudgeAnswer[];
    try {
      answers = (await input.backend.complete({ state, questions, model: input.model })).answers;
    } catch (error) {
      throw new BlockedError(`judge request for round ${String(input.round)} failed: ${error instanceof Error ? error.name : "unknown error"}`);
    }
    const byId = new Map<string, JudgeAnswer>();
    const duplicated = new Set<string>();
    for (const answer of answers) {
      if (byId.has(answer.id)) {
        duplicated.add(answer.id);
      }
      byId.set(answer.id, answer);
    }
    for (const entry of prepared) {
      const answer = byId.get(entry.key);
      const leaf = answer === undefined || duplicated.has(entry.key)
        ? { ...thresholdLeaf(entry, undefined, input.round, false), finding: answer === undefined ? "the judge returned no answer for this key" : "the judge answered this key twice" }
        : thresholdLeaf(entry, { answered: answer.value ?? UNKNOWN, distribution: answer.distribution ?? [] }, input.round, false);
      input.store.leaves.set(entry.demand.key, leaf);
      if (answer !== undefined && !duplicated.has(entry.key) && leaf.finding === undefined) {
        await input.cache?.set(entry.cacheKey, { answered: leaf.answered, distribution: leaf.distribution });
      }
    }
    records.push({
      round: input.round,
      document,
      questions: questions.length,
      keys: prepared.map((entry) => entry.key),
      stateBytes: Buffer.byteLength(stateJson),
      id: sha256(canonicalJson({ state, questions, model: input.model })),
    });
  }
  return records;
}

/**
 * Let L be the argmax label and p its distribution value. L holds when it is not
 * unknown and p >= threshold; otherwise every label is unknown. A missing or
 * misaligned distribution, or a tie at the top, is unknown with a finding.
 */
export function applyThreshold(options: string[], answer: CachedAnswer | undefined, threshold: number): { label: string; finding: string | undefined } {
  if (answer === undefined) {
    return { label: UNKNOWN, finding: undefined };
  }
  const distribution = answer.distribution;
  if (distribution.length === 0) {
    return { label: UNKNOWN, finding: "the answer has no distribution" };
  }
  if (distribution.length !== options.length) {
    return { label: UNKNOWN, finding: `the distribution has ${String(distribution.length)} values for ${String(options.length)} options` };
  }
  const top = Math.max(...distribution);
  const winners = options.filter((_, index) => distribution[index] === top);
  if (winners.length !== 1) {
    return { label: UNKNOWN, finding: `the distribution ties ${winners.join(", ")}` };
  }
  const argmax = winners[0] as string;
  const finding = argmax === answer.answered ? undefined : `the answer says ${answer.answered} but the distribution's argmax is ${argmax}`;
  return { label: argmax !== UNKNOWN && top >= threshold ? argmax : UNKNOWN, finding };
}

function thresholdLeaf(entry: Prepared, answer: CachedAnswer | undefined, round: number, cacheHit: boolean): OracleLeaf {
  const { label, finding } = applyThreshold(entry.options, answer, entry.demand.oracle.threshold);
  return {
    key: entry.key,
    atom: entry.demand.atom,
    question: entry.question,
    sections: entry.evidence.sections,
    bytes: Buffer.byteLength(entry.evidence.text),
    label,
    answered: answer?.answered ?? UNKNOWN,
    options: entry.options,
    distribution: answer?.distribution ?? [],
    threshold: entry.demand.oracle.threshold,
    round,
    cacheHit,
    finding,
  };
}

function unaskedLeaf(demand: Demand, question: string, options: string[], round: number, finding: string): OracleLeaf {
  return {
    key: "-", atom: demand.atom, question, sections: [], bytes: 0, label: UNKNOWN, answered: UNKNOWN, options,
    distribution: [], threshold: demand.oracle.threshold, round, cacheHit: false, finding,
  };
}

function resolveEvidence(oracle: Oracle, args: Term[], document: DocumentFacts): EvidenceText | undefined {
  const shape = oracle.evidence;
  if (shape.form === "union") {
    const items = listItems(args[shape.sections] as Term);
    return items === undefined ? undefined : unionEvidence(document, items.map(termText));
  }
  const section = termText(args[shape.section] as Term);
  return shape.form === "own" ? ownEvidence(document, section) : bodyEvidence(document, section);
}

/** `{Var}` becomes the input argument's text; the checker allows only input names. */
export function renderQuestion(oracle: Oracle, inputs: Term[]): string {
  return oracle.ask.replace(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (match, name: string) => {
    const position = oracle.params.indexOf(name);
    const value = position < 0 ? undefined : inputs[position];
    return value === undefined ? match : termText(value);
  });
}

/** A readable, collision-checked key that matches `[A-Za-z0-9_-]+`. */
export function evidenceKey(atomKey: string): string {
  const name = atomKey.split("(")[0]?.split("::").at(-1) ?? "q";
  return `${name.replace(/[^A-Za-z0-9_-]/g, "_")}-${sha256(atomKey).slice(0, 12)}`;
}

function enforceOutboundPolicy(state: string, policy: OutboundPolicy): void {
  if (Buffer.byteLength(state) > policy.maxEvidenceBytes) {
    throw new BlockedError(`the round's evidence is ${String(Buffer.byteLength(state))} bytes, above the outbound budget of ${String(policy.maxEvidenceBytes)}; a batch is never split`);
  }
  const lower = state.toLowerCase();
  const generic = ["typesafe_api_key", "api_key=", "-----begin private key-----", "/users/"];
  const match = [...generic, ...policy.forbiddenLiterals.map((value) => value.toLowerCase())].find((value) => value.length > 0 && lower.includes(value));
  if (match !== undefined) {
    throw new PolicyViolationError("semantic evidence contains prohibited data");
  }
}

function enforceCapabilities(backend: JudgeBackend, prepared: Prepared[], stateBytes: number): void {
  const capabilities = backend.capabilities;
  if (!capabilities.batch || prepared.length > capabilities.maxQuestions) {
    throw new BlockedError(`the judge cannot take a batch of ${String(prepared.length)} questions`);
  }
  if (stateBytes > capabilities.stateTokenBudget) {
    throw new BlockedError("the round's evidence exceeds the judge's state budget");
  }
  const widest = Math.max(...prepared.map((entry) => entry.options.length));
  if (widest > capabilities.maxOptions) {
    throw new BlockedError(`the judge cannot take ${String(widest)} options`);
  }
}
