/**
 * Oracle atoms as keyed judge questions (design 04 §Oracles and thresholds).
 *
 * Each ground atom is one question. Its evidence entry and its instruction share one
 * key, so an answer binds to its atom by construction; answers are matched by question
 * id, never by position. A threshold reads the argmax distribution value and can only
 * demote an answer to unknown.
 */

import type { JudgeAnswer, JudgeBackend, JudgeQuestion, JsonValue } from "deepclause-sdk";

import { canonicalJson, sha256 } from "../hash.js";
import { PolicyViolationError } from "../judge.js";
import { BlockedError } from "../types.js";
import type { Oracle } from "./checker.js";
import { UNKNOWN, type Demand, type OracleView } from "./evaluate.js";
import { bodyEvidence, ownEvidence, unionEvidence, type DocumentFacts, type EvidenceText } from "./facts.js";
import { listItems, termText, type Term } from "./terms.js";

/**
 * The span a non-passing finding rests on. `sentence` is the judge's chosen span
 * (option B); `section` is the deterministic fallback (option C) and is labelled
 * `not judged` so it never reads as the judge's choice.
 */
export interface OracleSpan {
  kind: "sentence" | "section";
  startLine: number;
  endLine: number;
  quote: string;
  judged: boolean;
}

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
  /** Set for a non-passing atom: the deciding sentence, or the section fallback. */
  span?: OracleSpan;
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
  backend: JudgeBackend | undefined;
  /** Why there is no backend; the round fails BLOCKED with it once a question must be sent. */
  unavailable?: string | undefined;
  model: string;
  policy: OutboundPolicy;
  cache: OracleCache | undefined;
}): Promise<RequestRecord[]> {
  const byDocument = new Map<string, Prepared[]>();
  // Non-passing atoms whose main answer came from the cache still need a span: their follow-up
  // is asked (or replayed from its own cache) in the pass after the fresh batches.
  const cachedCandidates = new Map<string, Array<{ entry: Prepared; spans: OracleSpan[] }>>();
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
      const leaf = thresholdLeaf({ demand, key, question, options, evidence, cacheKey }, cached, input.round, true);
      if (leaf.label === "fails" || leaf.label === UNKNOWN) {
        const spans = sentenceSpans(evidence);
        if (spans.length === 0) {
          leaf.span = sectionSpan(evidence);
        } else {
          const list = cachedCandidates.get(documentId) ?? [];
          list.push({ entry: { demand, key, question, options, evidence, cacheKey }, spans });
          cachedCandidates.set(documentId, list);
        }
      }
      input.store.leaves.set(demand.key, leaf);
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
    if (input.backend === undefined) {
      throw new BlockedError(input.unavailable ?? "no judge is available");
    }
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
    // Option B/C: a non-passing atom gets a span. One follow-up `choose` over the evidence's
    // sentences is asked (B); when that cannot be judged, the section span, labelled
    // `not judged`, is attached (C). The follow-ups are one keyed batch per document.
    const candidates = prepared.flatMap((entry) => {
      const leaf = input.store.leaves.get(entry.demand.key);
      const spans = leaf !== undefined && (leaf.label === "fails" || leaf.label === UNKNOWN)
        ? sentenceSpans(entry.evidence) : [];
      return spans.length === 0 ? [] : [{ entry, spans }];
    });
    const chosen = await askSpans(input, candidates, state);
    for (const entry of prepared) {
      const leaf = input.store.leaves.get(entry.demand.key);
      if (leaf === undefined || (leaf.label !== "fails" && leaf.label !== UNKNOWN) || leaf.span !== undefined) {
        continue;
      }
      const spans = candidates.find((candidate) => candidate.entry.key === entry.key)?.spans;
      const index = spans === undefined ? -1 : spans.findIndex((_span, i) => `s${String(i)}` === chosen.get(entry.key));
      leaf.span = (index >= 0 ? spans?.[index] : undefined) ?? sectionSpan(entry.evidence);
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

  // A cached non-passing atom still gets its span: ask the follow-up (or replay it from the
  // follow-up cache), one keyed batch per document, exactly as for a freshly answered atom.
  for (const [document, candidates] of cachedCandidates) {
    const state = {
      schema_version: 2,
      document,
      round: input.round,
      evidence: Object.fromEntries(candidates.map((candidate) =>
        [candidate.entry.key, { sections: candidate.entry.evidence.sections, text: candidate.entry.evidence.text }])),
    };
    const chosen = await askSpans(input, candidates, state);
    for (const candidate of candidates) {
      const leaf = input.store.leaves.get(candidate.entry.demand.key);
      if (leaf === undefined) {
        continue;
      }
      const index = candidate.spans.findIndex((_span, i) => `s${String(i)}` === chosen.get(candidate.entry.key));
      leaf.span = (index >= 0 ? candidate.spans[index] : undefined) ?? sectionSpan(candidate.entry.evidence);
    }
  }
  return records;
}

/** The follow-up's cache key: model, question, sentence ids, evidence hash, policy, and the span marker. */
function spanCacheKey(model: string, policy: OutboundPolicy, key: string, evidence: EvidenceText, spans: OracleSpan[]): string {
  return sha256(canonicalJson({
    model, question: `Judge ONLY state.evidence.${key}. Which sentence decides it?`,
    labels: spans.map((_span, index) => `s${String(index)}`),
    evidence: sha256(evidence.text), policy: policy.version ?? 1, span: true,
  }));
}

/** The deterministic section span (option C): the evidence's own piece, quoted, `not judged`. */
export function sectionSpan(evidence: EvidenceText): OracleSpan {
  const first = evidence.pieces[0];
  const last = evidence.pieces[evidence.pieces.length - 1];
  const startLine = first?.startLine ?? 1;
  const endLine = last === undefined ? startLine : last.startLine + countNewlines(last.text);
  return { kind: "section", startLine, endLine: Math.max(startLine, endLine), quote: "", judged: false };
}

/**
 * The evidence's sentences as candidate spans, each with its document line range (option B).
 * A sentence ends at `.`, `!` or `?`, or at a blank line, a heading or the start of a list item;
 * a plain line break is a soft wrap and joins the sentence, so a wrapped sentence is one option
 * spanning several lines rather than one fragment per line.
 */
export function sentenceSpans(evidence: EvidenceText): OracleSpan[] {
  const spans: OracleSpan[] = [];
  const emit = (block: { text: string; startLine: number }, from: number, to: number): void => {
    const quote = block.text.slice(from, to).replace(/\s+/g, " ").trim();
    if (quote.length === 0) {
      return;
    }
    const lineAt = (offset: number): number => block.startLine + countNewlines(block.text.slice(0, offset));
    const startLine = lineAt(from);
    const endLine = Math.max(startLine, lineAt(to));
    spans.push({ kind: "sentence", startLine, endLine, quote: quote.slice(0, 400), judged: true });
  };
  for (const piece of evidence.pieces) {
    // Blocks: a blank line, a heading, or the start of a list item ends the previous block.
    const blocks: Array<{ text: string; startLine: number }> = [];
    let parts: string[] = [];
    let blockStart = piece.startLine;
    const flushBlock = (): void => {
      if (parts.length > 0) {
        blocks.push({ text: parts.join("\n"), startLine: blockStart });
        parts = [];
      }
    };
    piece.text.split("\n").forEach((line, index) => {
      const lineNo = piece.startLine + index;
      const trim = line.trim();
      if (trim.length === 0) {
        flushBlock();
      } else if (/^#{1,6}\s/.test(trim)) {
        flushBlock();
        blocks.push({ text: trim, startLine: lineNo });
      } else if (/^([-*+]|\d+[.)])\s/.test(trim)) {
        flushBlock();
        parts = [trim];
        blockStart = lineNo;
      } else {
        if (parts.length === 0) {
          blockStart = lineNo;
        }
        parts.push(trim);
      }
    });
    flushBlock();
    for (const block of blocks) {
      const boundary = /[.!?]["')\]]*(?=\s|$)/g;
      let start = 0;
      let match: RegExpExecArray | null;
      while ((match = boundary.exec(block.text)) !== null) {
        emit(block, start, match.index + match[0].length);
        start = boundary.lastIndex;
      }
      emit(block, start, block.text.length);
    }
  }
  return spans;
}

/**
 * One keyed batch of follow-up `choose` questions, one per non-passing atom, over that atom's
 * evidence sentences. Each answer is cached like any oracle atom. Returns the chosen option id
 * per atom key; an atom with no answer (or `unknown`) is absent, so the caller uses the section
 * span.
 */
async function askSpans(
  input: { backend: JudgeBackend | undefined; model: string; policy: OutboundPolicy; cache: OracleCache | undefined },
  candidates: Array<{ entry: Prepared; spans: OracleSpan[] }>,
  state: JsonValue,
): Promise<Map<string, string>> {
  const chosen = new Map<string, string>();
  if (input.backend === undefined || candidates.length === 0) {
    return chosen;
  }
  const prepared = await Promise.all(candidates.map(async (candidate) => {
    const options = candidate.spans.map((span, index) => ({ id: `s${String(index)}`, description: span.quote }));
    const instruction = `Judge ONLY state.evidence.${candidate.entry.key}. Which sentence decides it?`;
    const cacheKey = spanCacheKey(input.model, input.policy, candidate.entry.key, candidate.entry.evidence, candidate.spans);
    const cached = await input.cache?.get(cacheKey);
    if (cached !== undefined) {
      chosen.set(candidate.entry.key, cached.answered);
      return undefined;
    }
    return { key: candidate.entry.key, cacheKey, question: { id: `${candidate.entry.key}::span`, kind: "choose" as const, instruction, options } };
  }));
  const pending = prepared.filter((entry) => entry !== undefined);
  if (pending.length === 0) {
    return chosen;
  }
  try {
    const answers = (await input.backend.complete({ state, questions: pending.map((entry) => entry.question), model: input.model })).answers;
    const byId = new Map(answers.map((answer) => [answer.id, answer]));
    for (const entry of pending) {
      const answer = byId.get(entry.question.id);
      if (answer?.value !== undefined) {
        chosen.set(entry.key, answer.value);
        await input.cache?.set(entry.cacheKey, { answered: answer.value, distribution: answer.distribution ?? [] });
      }
    }
  } catch {
    // A follow-up that cannot be asked (capabilities, budget) leaves every atom on the C fallback.
  }
  return chosen;
}

function countNewlines(text: string): number {
  let count = 0;
  for (const char of text) {
    if (char === "\n") {
      count += 1;
    }
  }
  return count;
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
