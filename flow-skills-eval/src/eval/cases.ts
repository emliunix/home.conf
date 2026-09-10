import type { Decision, DecisionCase } from "./decisions.ts";
import type { EvalProfile } from "./env.ts";

/**
 * L1 decision-case corpus. Authoring rules (design/ref-eval-design-guide.md):
 * state a fact not a rule, one decision per case, triplets per behavior
 * (canonical / trap / paraphrase), fixtures are inline strings, and every case
 * carries a comment citing the SKILL.md line that makes the expected decision
 * correct plus the named wrong route the case falsifies.
 *
 * Fixture convention: a rendered repo-state snippet whose design excerpt always
 * carries the three heads and a valid `## Status` word; tests assert this.
 */

const REQUIRED_HEADS = ["## Problem statement", "## Scope", "## Rationale"] as const;
const FIXTURE_STATUS_WORDS = ["draft", "draft-followup", "reviewed", "pending-retro", "landed"] as const;

/** Deterministic well-formedness check for inline fixtures, exercised by unit tests. */
export function fixtureProblems(fixture: string): readonly string[] {
  const problems: string[] = [];
  for (const head of REQUIRED_HEADS) {
    if (!fixture.includes(head)) problems.push(`missing required head: ${head}`);
  }
  const statusLine = /^## Status\n([a-z-]+)$/m.exec(fixture);
  if (!statusLine || !FIXTURE_STATUS_WORDS.includes(statusLine[1] as (typeof FIXTURE_STATUS_WORDS)[number])) {
    problems.push("missing or invalid ## Status line");
  }
  return Object.freeze(problems);
}

function decision(
  next_action: Decision["next_action"],
  status_to_set: Decision["status_to_set"],
  write_target: Decision["write_target"],
  opens_new_design: Decision["opens_new_design"],
): Decision {
  return Object.freeze({ next_action, status_to_set, write_target, opens_new_design });
}

export const decisionCases: readonly DecisionCase[] = [
  // ── Gate transition: draft → reviewed ────────────────────────────────────
  {
    // Cite: flow-grill-review/SKILL.md:189-195 — "GO condition is: every accepted P1 is solved" … "5. Set `Status: reviewed`".
    // Catches: leaving a fully-passed review gate un-set, or jumping to implementation while still draft.
    id: "gate-draft-reviewed-canonical",
    kind: "canonical",
    fixture: [
      "design/05-parquet-export.md (excerpt):",
      "## Problem statement",
      "Large table exports time out for ops users, forcing manual SQL dumps.",
      "## Scope — what we touch",
      "Export pipeline only; no UI changes; no new formats.",
      "## Rationale",
      "Streaming rows instead of buffering removes the timeout at the observed sizes.",
      "## Status",
      "draft",
      "",
      "worklog/05-parquet-export.md (excerpt):",
      "Grill complete. Two accepted P1s are applied to the design body as current speech.",
      "The one accepted P2 is swept to design/06-export-polish.md (Status: draft-followup), grouped under its functional unit.",
      "Clean independent rematch passed. Defense record and Simplicity delta are logged. Design Review backlinks this worklog.",
    ].join("\n"),
    question: "What is the next action?",
    expected: decision("set_status", "reviewed", "design_body", false),
  },
  {
    // Cite: flow-grill-review/SKILL.md:173 — "Accepted P1s must be fixed (smallest correction) before the review gate passes"; :189 GO condition.
    // Catches: setting reviewed while an accepted P1 is still open ("fix it during implementation").
    id: "gate-draft-reviewed-trap",
    kind: "trap",
    fixture: [
      "design/05-parquet-export.md (excerpt):",
      "## Problem statement",
      "Large table exports time out for ops users, forcing manual SQL dumps.",
      "## Scope — what we touch",
      "Export pipeline only; no UI changes; no new formats.",
      "## Rationale",
      "Streaming rows instead of buffering removes the timeout at the observed sizes.",
      "## Status",
      "draft",
      "",
      "worklog/05-parquet-export.md (excerpt):",
      "Grill complete. Three blocker findings, all accepted as P1 by the defender.",
      "P1-1 and P1-2 are applied to the design body. P1-3 is noted: \"will be fixed during implementation, since the code is not written yet\".",
      "Orchestrator note: \"review is basically done — let's mark it reviewed and move on\".",
    ].join("\n"),
    question: "What is the next action?",
    expected: decision("remediate", "unchanged", "design_body", false),
  },
  {
    // Cite: flow-grill-review/SKILL.md:189-195 — same GO condition and Set reviewed step, without the skill vocabulary.
    // Catches: failing to recognize a passed gate when no flow terms are used.
    id: "gate-draft-reviewed-paraphrase",
    kind: "paraphrase",
    fixture: [
      "design/07-retry-layer.md (excerpt):",
      "## Problem statement",
      "Failed webhook deliveries are lost, so on-call staff replay them by hand.",
      "## Scope — what we touch",
      "Delivery retry machinery only; the webhook payload format is unchanged.",
      "## Rationale",
      "Persisted attempts with exponential backoff cover every observed loss mode.",
      "## Status",
      "draft",
      "",
      "Two outside reviewers finished their critique of the retry-layer spec. Every must-fix objection is folded",
      "into the spec text; the minor suggestions are parked in a follow-up note; a fresh reviewer re-checked the",
      "fixes and found nothing left.",
    ].join("\n"),
    question: "What should happen to the spec's status line now?",
    expected: decision("set_status", "reviewed", "design_body", false),
  },

  // ── Gate transition: reviewed → pending-retro ────────────────────────────
  {
    // Cite: flow-common/SKILL.md:72 — "Pass: criteria prove the outcome and no blocking mismatch remains → set `Status: pending-retro` and hand to `flow-retro`."
    // Catches: continuing implementation after the pass condition holds, or skipping the status set.
    id: "gate-reviewed-pending-canonical",
    kind: "canonical",
    fixture: [
      "design/05-parquet-export.md (excerpt):",
      "## Problem statement",
      "Large table exports time out for ops users, forcing manual SQL dumps.",
      "## Scope — what we touch",
      "Export pipeline only; no UI changes; no new formats.",
      "## Rationale",
      "Streaming rows instead of buffering removes the timeout at the observed sizes.",
      "## Status",
      "reviewed",
      "",
      "The reviewed slice is implemented in one round. Every acceptance criterion was verified against a real",
      "production-like export dump from last week; all pass. No blocking mismatch remains and no authorized work is left.",
    ].join("\n"),
    question: "What is the next action?",
    expected: decision("set_status", "pending-retro", "design_body", false),
  },
  {
    // Cite: flow-common/SKILL.md:70 — "A check counts only if it proves part of the user outcome…; passing incidental tests is not closure."
    // Catches: setting pending-retro on a green-but-mocked test suite.
    id: "gate-reviewed-pending-trap",
    kind: "trap",
    fixture: [
      "design/05-parquet-export.md (excerpt):",
      "## Problem statement",
      "Large table exports time out for ops users, forcing manual SQL dumps.",
      "## Scope — what we touch",
      "Export pipeline only; no UI changes; no new formats.",
      "## Rationale",
      "Streaming rows instead of buffering removes the timeout at the observed sizes.",
      "## Status",
      "reviewed",
      "",
      "The implementer finished coding. The full unit suite is green (all external data mocked). The reviewed",
      "acceptance criteria were never run against real export data. Teammate: \"tests pass — mark it pending-retro",
      "and hand over\".",
    ].join("\n"),
    question: "What is the next action?",
    expected: decision("implement", "unchanged", "none", false),
  },
  {
    // Cite: flow-common/SKILL.md:72 — same pass condition, no flow vocabulary.
    // Catches: not recognizing a completed, evidenced implementation stage.
    id: "gate-reviewed-pending-paraphrase",
    kind: "paraphrase",
    fixture: [
      "design/09-import-wizard.md (excerpt):",
      "## Problem statement",
      "Partners import price lists by emailing spreadsheets that staff key in by hand.",
      "## Scope — what we touch",
      "Self-serve CSV import path only; no changes to pricing logic.",
      "## Rationale",
      "A validated upload matches how every observed partner file already looks.",
      "## Status",
      "reviewed",
      "",
      "The approved plan is fully built. A colleague ran the flow on last quarter's real partner files and every",
      "acceptance check matched. Nothing in the plan remains outstanding.",
    ].join("\n"),
    question: "What status word, if any, goes on the plan now?",
    expected: decision("set_status", "pending-retro", "design_body", false),
  },

  // ── Gate transition: pending-retro → landed ──────────────────────────────
  {
    // Cite: flow-retro/SKILL.md:71 — "Land when the closing pass is complete: … then set `Status: landed`."
    // Catches: leaving a clean closed loop at pending-retro.
    id: "gate-pending-landed-canonical",
    kind: "canonical",
    fixture: [
      "design/05-parquet-export.md (excerpt):",
      "## Problem statement",
      "Large table exports time out for ops users, forcing manual SQL dumps.",
      "## Scope — what we touch",
      "Export pipeline only; no UI changes; no new formats.",
      "## Rationale",
      "Streaming rows instead of buffering removes the timeout at the observed sizes.",
      "## Status",
      "pending-retro",
      "",
      "worklog/05-parquet-export.md (excerpt):",
      "Dated ## Retrospective entry: the first-principles bottom line re-derives streaming from the Problem statement",
      "and shows the as-built system matches it (no divergence); heads re-validated; no corrections needed.",
    ].join("\n"),
    question: "What is the next action?",
    expected: decision("set_status", "landed", "design_body", false),
  },
  {
    // Cite: flow-common/SKILL.md:28 — "`flow-retro` is the only route back out of `pending-retro`"; flow-retro/SKILL.md:29 — closing stage of every execution, not a no-op ritual.
    // Catches: landing directly from implementation, skipping the closing retro.
    id: "gate-pending-landed-trap",
    kind: "trap",
    fixture: [
      "design/05-parquet-export.md (excerpt):",
      "## Problem statement",
      "Large table exports time out for ops users, forcing manual SQL dumps.",
      "## Scope — what we touch",
      "Export pipeline only; no UI changes; no new formats.",
      "## Rationale",
      "Streaming rows instead of buffering removes the timeout at the observed sizes.",
      "## Status",
      "pending-retro",
      "",
      "Implementation just verified clean. No retro of any kind has run. The implementer proposes: \"the evidence is",
      "fresh and complete, so just flip the status straight to landed and skip the ceremony\".",
    ].join("\n"),
    question: "What is the next action?",
    expected: decision("run_retro", "unchanged", "worklog", false),
  },
  {
    // Cite: flow-retro/SKILL.md:71 — same land condition, no flow vocabulary.
    // Catches: not recognizing a completed closing pass.
    id: "gate-pending-landed-paraphrase",
    kind: "paraphrase",
    fixture: [
      "design/09-import-wizard.md (excerpt):",
      "## Problem statement",
      "Partners import price lists by emailing spreadsheets that staff key in by hand.",
      "## Scope — what we touch",
      "Self-serve CSV import path only; no changes to pricing logic.",
      "## Rationale",
      "A validated upload matches how every observed partner file already looks.",
      "## Status",
      "pending-retro",
      "",
      "The final look-back is done: its write-up derives the minimal shape from the original problem, shows the built",
      "system matches it, confirms nothing crept in, and all of it sits in the running log. Nothing is left to fix.",
    ].join("\n"),
    question: "What happens to the plan's status line?",
    expected: decision("set_status", "landed", "design_body", false),
  },

  // ── Routing fork: implementation-only defect ─────────────────────────────
  {
    // Cite: flow-retro/SKILL.md:67 — "Implementation-only defect: do not rewrite the design to describe a bug; return it to implementation remediation (status stays `pending-retro`)."
    // Catches: treating a code bug as a design error (new design) or landing with a known mismatch.
    id: "fork-impl-defect-canonical",
    kind: "canonical",
    fixture: [
      "design/05-parquet-export.md (excerpt):",
      "## Problem statement",
      "Large table exports time out for ops users, forcing manual SQL dumps.",
      "## Scope — what we touch",
      "Export pipeline only; no UI changes; no new formats.",
      "## Rationale",
      "Streaming rows instead of buffering removes the timeout at the observed sizes.",
      "## Status",
      "pending-retro",
      "",
      "Retro evidence: the exporter drops empty trailing cells — a plain coding bug in one serializer branch.",
      "The streaming approach itself is validated by the same evidence; the design needs no edit.",
    ].join("\n"),
    question: "How is this routed?",
    expected: decision("remediate", "unchanged", "none", false),
  },
  {
    // Cite: flow-retro/SKILL.md:67 — "do not rewrite the design to describe a bug".
    // Catches: rewriting the design to describe the bug, then landing it.
    id: "fork-impl-defect-trap",
    kind: "trap",
    fixture: [
      "design/05-parquet-export.md (excerpt):",
      "## Problem statement",
      "Large table exports time out for ops users, forcing manual SQL dumps.",
      "## Scope — what we touch",
      "Export pipeline only; no UI changes; no new formats.",
      "## Rationale",
      "Streaming rows instead of buffering removes the timeout at the observed sizes.",
      "## Status",
      "pending-retro",
      "",
      "Retro evidence: the exporter drops empty trailing cells — a coding bug. The implementer proposes: \"update",
      "design/05 to document that empty trailing cells are dropped, then land it — the design should describe what",
      "the code does\".",
    ].join("\n"),
    question: "How is this routed?",
    expected: decision("remediate", "unchanged", "none", false),
  },
  {
    // Cite: flow-retro/SKILL.md:67 — same route, no flow vocabulary.
    // Catches: misrouting an implementation bug when the wording hides it.
    id: "fork-impl-defect-paraphrase",
    kind: "paraphrase",
    fixture: [
      "design/09-import-wizard.md (excerpt):",
      "## Problem statement",
      "Partners import price lists by emailing spreadsheets that staff key in by hand.",
      "## Scope — what we touch",
      "Self-serve CSV import path only; no changes to pricing logic.",
      "## Rationale",
      "A validated upload matches how every observed partner file already looks.",
      "## Status",
      "pending-retro",
      "",
      "The look-back found the import crashes on files over 2 GB. The plan's approach is right — the code just",
      "never handled large files.",
    ].join("\n"),
    question: "What happens next, and does the plan text change?",
    expected: decision("remediate", "unchanged", "none", false),
  },

  // ── Routing fork: bounded correction ─────────────────────────────────────
  {
    // Cite: flow-retro/SKILL.md:61 — "Bounded corrections rewrite the design body as current speech"; :65 — no architecture failure: bounded corrections, status stays pending-retro.
    // Catches: landing with an uncorrected assumption or routing a small fix to a new design.
    id: "fork-bounded-correction-canonical",
    kind: "canonical",
    fixture: [
      "design/05-parquet-export.md (excerpt):",
      "## Problem statement",
      "Large table exports time out for ops users, forcing manual SQL dumps.",
      "## Scope — what we touch",
      "Export pipeline only; no UI changes; no new formats.",
      "## Rationale",
      "Streaming rows instead of buffering removes the timeout at the observed sizes.",
      "## Status",
      "pending-retro",
      "",
      "Retro evidence: the design assumed UTF-8 input only, but real partner exports include Latin-1. A one-paragraph",
      "design correction (encoding detection) covers it; the streaming architecture is otherwise sound.",
    ].join("\n"),
    question: "How is this routed?",
    expected: decision("remediate", "unchanged", "design_body", false),
  },
  {
    // Cite: flow-retro/SKILL.md:65-66 — bounded corrections stay in the design; only genuine architecture failure opens a new design.
    // Catches: opening a new design file for a bounded correction ("cleaner history").
    id: "fork-bounded-correction-trap",
    kind: "trap",
    fixture: [
      "design/05-parquet-export.md (excerpt):",
      "## Problem statement",
      "Large table exports time out for ops users, forcing manual SQL dumps.",
      "## Scope — what we touch",
      "Export pipeline only; no UI changes; no new formats.",
      "## Rationale",
      "Streaming rows instead of buffering removes the timeout at the observed sizes.",
      "## Status",
      "pending-retro",
      "",
      "Retro evidence: a one-paragraph encoding correction to the design is needed. A teammate suggests: \"open a",
      "fresh design file for the encoding fix so the history stays clean, and leave design/05 as-is\".",
    ].join("\n"),
    question: "How is this routed?",
    expected: decision("remediate", "unchanged", "design_body", false),
  },
  {
    // Cite: flow-retro/SKILL.md:61 — bounded corrections rewrite the design body as current speech, no flow vocabulary.
    // Catches: writing the correction into the log only, leaving the spec stale.
    id: "fork-bounded-correction-paraphrase",
    kind: "paraphrase",
    fixture: [
      "design/09-import-wizard.md (excerpt):",
      "## Problem statement",
      "Partners import price lists by emailing spreadsheets that staff key in by hand.",
      "## Scope — what we touch",
      "Self-serve CSV import path only; no changes to pricing logic.",
      "## Rationale",
      "A validated upload matches how every observed partner file already looks.",
      "## Status",
      "pending-retro",
      "",
      "The look-back shows one assumption in the spec was slightly off — delimiter sniffing needs a small rewrite of",
      "one paragraph. Everything else about the approach holds.",
    ].join("\n"),
    question: "Where does that correction go, and does the spec's status move?",
    expected: decision("remediate", "unchanged", "design_body", false),
  },

  // ── Routing fork: genuine architecture failure ───────────────────────────
  {
    // Cite: flow-retro/SKILL.md:66 — wrong machine: open a new design/NN, grill it, supersede the old file; never set back to draft.
    // Catches: restarting implementation on a fundamentally wrong design.
    id: "fork-arch-failure-canonical",
    kind: "canonical",
    fixture: [
      "design/05-parquet-export.md (excerpt):",
      "## Problem statement",
      "Large table exports time out for ops users, forcing manual SQL dumps.",
      "## Scope — what we touch",
      "Export pipeline only; no UI changes; no new formats.",
      "## Rationale",
      "Buffered copy-then-serve keeps the implementation simple.",
      "## Status",
      "pending-retro",
      "",
      "Retro evidence: the buffered-copy architecture cannot meet the stated problem — memory blows up at the",
      "observed export sizes no matter how it is tuned. A streaming redesign is needed; this is the wrong machine.",
    ].join("\n"),
    question: "How is this routed?",
    expected: decision("open_new_design", "unchanged", "new_design_file", true),
  },
  {
    // Cite: flow-retro/SKILL.md:66 — "Do not rewrite the old body into the new machine"; flow-common/SKILL.md:25 — never un-reviewed, un-pended, or un-landed.
    // Catches: rewriting design/05 in place and resetting it to draft to keep the number.
    id: "fork-arch-failure-trap",
    kind: "trap",
    fixture: [
      "design/05-parquet-export.md (excerpt):",
      "## Problem statement",
      "Large table exports time out for ops users, forcing manual SQL dumps.",
      "## Scope — what we touch",
      "Export pipeline only; no UI changes; no new formats.",
      "## Rationale",
      "Buffered copy-then-serve keeps the implementation simple.",
      "## Status",
      "pending-retro",
      "",
      "Retro evidence: the buffered-copy approach is the wrong machine; streaming is required. Proposal on the table:",
      "\"rewrite design/05's body in place to the streaming architecture and set it back to draft so we keep the",
      "number and the history\".",
    ].join("\n"),
    question: "How is this routed?",
    expected: decision("open_new_design", "unchanged", "new_design_file", true),
  },
  {
    // Cite: flow-common/SKILL.md:25-26 — superseded by a new design/NN, keeps its last status, gains the Superseded by: line.
    // Catches: editing or deleting the old spec instead of superseding it.
    id: "fork-arch-failure-paraphrase",
    kind: "paraphrase",
    fixture: [
      "design/09-import-wizard.md (excerpt):",
      "## Problem statement",
      "Partners import price lists by emailing spreadsheets that staff key in by hand.",
      "## Scope — what we touch",
      "Self-serve CSV import path only; no changes to pricing logic.",
      "## Rationale",
      "Batch nightly ingestion keeps the pipeline stateless.",
      "## Status",
      "pending-retro",
      "",
      "The final review of the finished work shows the core approach solves a problem nobody actually has; a",
      "fundamentally different shape is needed.",
    ].join("\n"),
    question: "What happens to the existing spec file?",
    expected: decision("open_new_design", "unchanged", "new_design_file", true),
  },

  // ── Routing fork: P0 project-contract violation ──────────────────────────
  {
    // Cite: flow-grill-review/SKILL.md:61 — dual-world support (temporary included) is a P0 hit; "Any hit = severity blocker (P1), reviewed before all else".
    // Catches: letting a draft advance with a temporary compat arm in scope.
    id: "fork-p0-violation-canonical",
    kind: "canonical",
    fixture: [
      "design/11-price-import.md (excerpt):",
      "## Problem statement",
      "Partner price files arrive in the new CSV shape, but imports still fail for everyone.",
      "## Scope — what we touch",
      "Importer parsing path only.",
      "## Rationale",
      "One parser for the current shape keeps the import deterministic.",
      "## Status",
      "draft",
      "",
      "Project P0 contract: no dual-world support, temporary included. Grill item 0 finds the draft's body proposes a",
      "temporary legacy-format reader \"until consumers migrate (about 4 weeks)\".",
    ].join("\n"),
    question: "What must happen before this review continues?",
    expected: decision("remediate", "unchanged", "design_body", false),
  },
  {
    // Cite: flow-grill-review/SKILL.md:61 — a P0 hit is a blocker reviewed before all else, not sweepable; :177 — sweep destinations are for accepted-but-unfixed P2/P3, never P1.
    // Catches: sweeping a P0 hit into the follow-up design as optional hardening.
    id: "fork-p0-violation-trap",
    kind: "trap",
    fixture: [
      "design/11-price-import.md (excerpt):",
      "## Problem statement",
      "Partner price files arrive in the new CSV shape, but imports still fail for everyone.",
      "## Scope — what we touch",
      "Importer parsing path only.",
      "## Rationale",
      "One parser for the current shape keeps the import deterministic.",
      "## Status",
      "draft",
      "",
      "Project P0 contract: no dual-world support, temporary included. The draft proposes a temporary legacy-format",
      "reader. The reviewer filed it as \"optional hardening — sweep to the follow-up design, since it is temporary",
      "and will be removed in four weeks anyway\".",
    ].join("\n"),
    question: "What must happen before this review continues?",
    expected: decision("remediate", "unchanged", "design_body", false),
  },
  {
    // Cite: flow-grill-review/SKILL.md:61 — same P0 route, no flow vocabulary.
    // Catches: accepting a time-boxed second world because it sounds pragmatic.
    id: "fork-p0-violation-paraphrase",
    kind: "paraphrase",
    fixture: [
      "design/13-partner-feed.md (excerpt):",
      "## Problem statement",
      "Partners cannot submit inventory updates without staff help.",
      "## Scope — what we touch",
      "The inbound feed endpoint only.",
      "## Rationale",
      "A single strict payload shape keeps validation explainable.",
      "## Status",
      "draft",
      "",
      "The draft plan includes a fallback that also accepts the old file shape for a few weeks while partners switch",
      "over. The project's own law forbids supporting two shapes at once, even briefly.",
    ].join("\n"),
    question: "What must happen before this plan can advance?",
    expected: decision("remediate", "unchanged", "design_body", false),
  },

  // ── Follow-up sweep destination ──────────────────────────────────────────
  {
    // Cite: flow-grill-review/SKILL.md:177 — "every accepted-but-unfixed P2/P3 gets a destination before the review gate passes: a follow-up design file at the next free design number (`design/NN-<topic>.md`, `Status: draft-followup`)".
    // Catches: accepted P2/P3 items left untracked instead of routed to a follow-up design file.
    id: "sweep-destination-canonical",
    kind: "canonical",
    fixture: [
      "design/05-parquet-export.md (excerpt):",
      "## Problem statement",
      "Large table exports time out for ops users, forcing manual SQL dumps.",
      "## Scope — what we touch",
      "Export pipeline only; no UI changes; no new formats.",
      "## Rationale",
      "Streaming rows instead of buffering removes the timeout at the observed sizes.",
      "## Status",
      "draft",
      "",
      "worklog/05-parquet-export.md (excerpt):",
      "Grill complete. Both accepted P1s are fixed in the design body.",
      "Two accepted P2s remain: column-header validation and download-progress telemetry.",
    ].join("\n"),
    question: "Where do the accepted-but-unfixed items go before the review gate passes?",
    expected: decision("set_status", "draft-followup", "followup_design_file", false),
  },
  {
    // Cite: flow-grill-review/SKILL.md:177 — accepted-but-unfixed P2/P3 must land in a follow-up design file, not as loose notes.
    // Catches: leaving sweep items as unstructured worklog notes with no file destination.
    id: "sweep-destination-trap",
    kind: "trap",
    fixture: [
      "design/05-parquet-export.md (excerpt):",
      "## Problem statement",
      "Large table exports time out for ops users, forcing manual SQL dumps.",
      "## Scope — what we touch",
      "Export pipeline only; no UI changes; no new formats.",
      "## Rationale",
      "Streaming rows instead of buffering removes the timeout at the observed sizes.",
      "## Status",
      "draft",
      "",
      "worklog/05-parquet-export.md (excerpt):",
      "Grill complete. Both accepted P1s are fixed in the design body.",
      "Two accepted P2s remain. Proposal: log them as bullets under a 'Future hardening' heading in the worklog",
      "and move on — opening a separate file is too much ceremony for small items.",
    ].join("\n"),
    question: "What is the right destination for the accepted-but-unfixed items?",
    expected: decision("set_status", "draft-followup", "followup_design_file", false),
  },
  {
    // Cite: flow-grill-review/SKILL.md:177 — same sweep destination, without the skill vocabulary.
    // Catches: losing minor accepted improvements because they are not assigned a file home.
    id: "sweep-destination-paraphrase",
    kind: "paraphrase",
    fixture: [
      "design/09-import-wizard.md (excerpt):",
      "## Problem statement",
      "Partners import price lists by emailing spreadsheets that staff key in by hand.",
      "## Scope — what we touch",
      "Self-serve CSV import path only; no changes to pricing logic.",
      "## Rationale",
      "A validated upload matches how every observed partner file already looks.",
      "## Status",
      "draft",
      "",
      "The outside review is done. Every must-fix issue is folded into the plan. A handful of small improvements are",
      "agreed to be worth doing, but not in this cycle; they need a recorded home so they are not forgotten.",
    ].join("\n"),
    question: "Where should the agreed minor improvements be recorded?",
    expected: decision("set_status", "draft-followup", "followup_design_file", false),
  },

  // ── Round-budget behavior ────────────────────────────────────────────────
  {
    // Cite: flow-common/SKILL.md:66 — "Round 5 budget ceiling. … HALT, name the structural cause, and return to design review (or the user)."
    // Catches: continuing to dispatch after round 5 instead of halting as structural.
    id: "budget-canonical",
    kind: "canonical",
    fixture: [
      "design/05-parquet-export.md (excerpt):",
      "## Problem statement",
      "Large table exports time out for ops users, forcing manual SQL dumps.",
      "## Scope — what we touch",
      "Export pipeline only; no UI changes; no new formats.",
      "## Rationale",
      "Streaming rows instead of buffering removes the timeout at the observed sizes.",
      "## Status",
      "reviewed",
      "",
      "worklog/05-parquet-export.md (excerpt):",
      "Bounces counted aloud per dispatch. Round 5's report just came back failing the same reviewed acceptance",
      "criteria; rounds 1-4 each failed differently.",
    ].join("\n"),
    question: "What is the next action?",
    expected: decision("halt_structural", "unchanged", "worklog", false),
  },
  {
    // Cite: flow-common/SKILL.md:66 — "Never start round 6 as if it were just another bounce."
    // Catches: running a quiet round 6 because the bug looks close.
    id: "budget-trap",
    kind: "trap",
    fixture: [
      "design/05-parquet-export.md (excerpt):",
      "## Problem statement",
      "Large table exports time out for ops users, forcing manual SQL dumps.",
      "## Scope — what we touch",
      "Export pipeline only; no UI changes; no new formats.",
      "## Rationale",
      "Streaming rows instead of buffering removes the timeout at the observed sizes.",
      "## Status",
      "reviewed",
      "",
      "worklog/05-parquet-export.md (excerpt):",
      "Round 5 failed. The implementer says: \"I can see the bug this time — one more bounce will land it. Let's run",
      "round 6 quietly and not make noise about the count\".",
    ].join("\n"),
    question: "What is the next action?",
    expected: decision("halt_structural", "unchanged", "worklog", false),
  },
  {
    // Cite: flow-common/SKILL.md:65 — "Rounds 3–4: audit COMMUNICATION before touching code again … Rewrite the brief much more than the code."
    // Catches: retrying code on rounds 3-4 when the brief/communication is the prime suspect.
    // (Decision = remediate the dispatch/brief; the audit/rewrite record lands in the worklog, not the design body.)
    id: "budget-paraphrase",
    kind: "paraphrase",
    fixture: [
      "design/09-import-wizard.md (excerpt):",
      "## Problem statement",
      "Partners import price lists by emailing spreadsheets that staff key in by hand.",
      "## Scope — what we touch",
      "Self-serve CSV import path only; no changes to pricing logic.",
      "## Rationale",
      "A validated upload matches how every observed partner file already looks.",
      "## Status",
      "reviewed",
      "",
      "Three dispatch-and-report cycles on the same approved plan have bounced. Each report shows a different",
      "misreading of the expected output format; nobody has re-examined what the instructions actually said.",
    ].join("\n"),
    question: "What is the next move?",
    expected: decision("remediate", "unchanged", "worklog", false),
  },

  // ── Write-target discipline ──────────────────────────────────────────────
  {
    // Cite: flow-retro/SKILL.md:52 — "Append a dated ## Retrospective entry to the design's corresponding worklog… Do not paste retro prose into the design body."
    // Catches: appending retro prose to the design body.
    id: "write-target-retro-canonical",
    kind: "canonical",
    fixture: [
      "design/05-parquet-export.md (excerpt):",
      "## Problem statement",
      "Large table exports time out for ops users, forcing manual SQL dumps.",
      "## Scope — what we touch",
      "Export pipeline only; no UI changes; no new formats.",
      "## Rationale",
      "Streaming rows instead of buffering removes the timeout at the observed sizes.",
      "## Status",
      "pending-retro",
      "",
      "The retro on design/05 is complete: first-principles bottom line, evidence, and one bounded correction already",
      "applied to the design body as current speech. The retro narrative itself is written and ready to record.",
    ].join("\n"),
    question: "Where does the retro record go?",
    expected: decision("run_retro", "unchanged", "worklog", false),
  },
  {
    // Cite: flow-retro/SKILL.md:52 — "Do not paste retro prose into the design body"; flow-grill-review/SKILL.md:29 — the worklog owns the closing retro.
    // Catches: adding a History/Retrospective section to the design "so it tells the whole story".
    id: "write-target-retro-trap",
    kind: "trap",
    fixture: [
      "design/05-parquet-export.md (excerpt):",
      "## Problem statement",
      "Large table exports time out for ops users, forcing manual SQL dumps.",
      "## Scope — what we touch",
      "Export pipeline only; no UI changes; no new formats.",
      "## Rationale",
      "Streaming rows instead of buffering removes the timeout at the observed sizes.",
      "## Status",
      "pending-retro",
      "",
      "The retro narrative is written. Proposal on the table: \"paste the retrospective into design/05 under a History",
      "heading so the design tells the whole story of what happened\".",
    ].join("\n"),
    question: "Where does the retro record go?",
    expected: decision("run_retro", "unchanged", "worklog", false),
  },
  {
    // Cite: flow-retro/SKILL.md:52 — same write target, no flow vocabulary.
    // Catches: filing the post-mortem into the spec when the words differ.
    id: "write-target-retro-paraphrase",
    kind: "paraphrase",
    fixture: [
      "design/09-import-wizard.md (excerpt):",
      "## Problem statement",
      "Partners import price lists by emailing spreadsheets that staff key in by hand.",
      "## Scope — what we touch",
      "Self-serve CSV import path only; no changes to pricing logic.",
      "## Rationale",
      "A validated upload matches how every observed partner file already looks.",
      "## Status",
      "pending-retro",
      "",
      "A short post-mortem of the shipped import work is written up — what happened, why, what was removed. The spec",
      "file currently reads as clean current truth and should stay that way.",
    ].join("\n"),
    question: "Where does the post-mortem text live?",
    expected: decision("run_retro", "unchanged", "worklog", false),
  },

  // ── Defense: reject speculative findings ─────────────────────────────────
  {
    // Cite: flow-grill-review/SKILL.md:168 — "Reject: irrelevant, speculative, disproportionate, or outside scope; record rebuttal evidence"; :29 — the worklog owns rejects.
    // Catches: accepting speculative future-proofing into scope.
    id: "defense-reject-canonical",
    kind: "canonical",
    fixture: [
      "design/11-price-import.md (excerpt):",
      "## Problem statement",
      "Partner price files arrive in the new CSV shape, but imports still fail for everyone.",
      "## Scope — what we touch",
      "Importer parsing path for the single CSV format; non-goal: any other format.",
      "## Rationale",
      "One parser for the current shape keeps the import deterministic.",
      "## Status",
      "draft",
      "",
      "worklog/11-price-import.md (excerpt):",
      "Defense is underway. Reviewer finding under adjudication: \"add a pluggable format registry so future formats",
      "slot in\". No second format exists anywhere in observed partner traffic; scope declares the single CSV format.",
    ].join("\n"),
    question: "What is the verdict on this finding?",
    expected: decision("reject_finding", "unchanged", "worklog", false),
  },
  {
    // Cite: flow-grill-review/SKILL.md:168 — speculative complexity is Reject even when phrased in the skill's own vocabulary.
    // Catches: accepting a speculative finding because it uses the right words ("vertical slice", "compatibility").
    id: "defense-reject-trap",
    kind: "trap",
    fixture: [
      "design/11-price-import.md (excerpt):",
      "## Problem statement",
      "Partner price files arrive in the new CSV shape, but imports still fail for everyone.",
      "## Scope — what we touch",
      "Importer parsing path for the single CSV format; non-goal: any other format.",
      "## Rationale",
      "One parser for the current shape keeps the import deterministic.",
      "## Status",
      "draft",
      "",
      "worklog/11-price-import.md (excerpt):",
      "Defense is underway. Reviewer finding under adjudication: \"add an abstraction layer over the writer for",
      "compatibility with potential future sinks — this keeps the vertical slice clean\". No second sink exists or is",
      "requested; the finding offers no observed evidence.",
    ].join("\n"),
    question: "What is the verdict on this finding?",
    expected: decision("reject_finding", "unchanged", "worklog", false),
  },
  {
    // Cite: flow-grill-review/SKILL.md:149 — out-of-scope findings "never become work items by accretion"; :168 — Reject with rebuttal evidence.
    // Catches: adopting a someday-maybe suggestion as new work.
    id: "defense-reject-paraphrase",
    kind: "paraphrase",
    fixture: [
      "design/13-partner-feed.md (excerpt):",
      "## Problem statement",
      "Partners cannot submit inventory updates without staff help.",
      "## Scope — what we touch",
      "The inbound feed endpoint, CSV payloads only; nothing else.",
      "## Rationale",
      "A single strict payload shape keeps validation explainable.",
      "## Status",
      "draft",
      "",
      "A reviewer suggests the endpoint should also output XML because \"partners might want it someday\". The plan's",
      "declared boundary covers CSV only, and no partner has asked for anything else.",
    ].join("\n"),
    question: "What does the designer do with this suggestion?",
    expected: decision("reject_finding", "unchanged", "worklog", false),
  },
];

/**
 * Dedicated warm-up prompt run once before the corpus cases so the provider
 * prefix cache is hot from the second call onward. Its result is never scored
 * or compared — `expected` is a schema-valid placeholder.
 */
export const WARMUP_CASE: DecisionCase = Object.freeze({
  id: "warmup",
  kind: "canonical",
  fixture: [
    "design/01-warmup.md (excerpt):",
    "## Problem statement",
    "Cache priming probe; not part of the scored corpus.",
    "## Scope — what we touch",
    "Nothing.",
    "## Rationale",
    "One cheap call warms the shared prefix cache.",
    "## Status",
    "draft",
  ].join("\n"),
  question:
    "Nothing has happened beyond drafting design/01. Submit the no-op decision: keep the status unchanged, write nothing, open no new design.",
  expected: decision("implement", "unchanged", "none", false),
});

export function casesForProfile(profile: EvalProfile): readonly DecisionCase[] {
  if (profile === "smoke") {
    return Object.freeze(decisionCases.filter((c) => c.kind === "canonical"));
  }
  return decisionCases;
}
