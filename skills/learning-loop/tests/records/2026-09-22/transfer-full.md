# Learning-loop disposition: reader-batch work

## Outcome against intent

The first reader batch did not produce comparable transfer evidence: documentation changed while readers were still working, and one reader observed two files changing during its read. The next round corrected the demonstrated failure mode by pinning `reader-batch-3` at commit `63800aa`, freezing the tree, waiting for five readers, preserving trajectories, and treating feedback as leads pending reproduction. This supports the narrower claim that the rerun restored a single-state measurement; it does not, from this fixture alone, establish improved onboarding or lower reader cost.

Evidence window: `docs-transfer.md`, SHA-256 `a0d5f239d4e630e91037731ecc9e88f165070d0a3926dbfa1b14a12336ecfdd1`. Missing evidence: the fixture does not show an external preregistered rubric and answer key, byte digests for all tested material, scorer separation, or the five individual outcomes.

Applicable concern packs: `collaboration.handoff` (the batch crossed agent and revision boundaries), `docs.fresh-agent-authority` (readers tested documentation authority), and `process.trap-path` (editing during measurement made a plausible experiment unable to answer its question). `verification.false-green` was not selected because the evidence reports invalidation rather than a passing check that concealed failure.

## Lessons learned

| Disposition | Observation | Inference | Lesson | Destination | Mechanism | Freshness |
| --- | --- | --- | --- | --- | --- | --- |
| **verified existing** | The parent edited documentation before all first-round readers returned; a reader saw `method.md` and `worklog/next.md` change. The rerun pinned commit `63800aa` and froze the tree for five readers. | High confidence: readers exposed to different bytes cannot form one comparable batch. Competing explanations may affect individual conclusions, but cannot repair the revision mismatch. | For a reader batch, pin the tested bytes and keep the tree frozen until every reader returns; a changed revision is a separate trial. | The learning-loop skill's transfer protocol, specifically `references/transfer-checks.md`. | SHA-256 pins, independent bounded readers, external answer key, wait-for-all barrier, and a new pin/new batch after edits. | Re-check when the reader-trial runner or evidence-storage workflow changes; remove only if an equivalent structural harness enforces these invariants. |
| **verified existing** | The corrected round retained file-reading trajectories and treated reader feedback as leads until reproduced. | High confidence: a reader's conclusion is evidence about transfer behavior, not direct proof that its diagnosis is correct. | Score the recorded trajectory and required decision; reproduce feedback before promoting it into authority. | The learning-loop procedure and `references/transfer-checks.md`. | Record trajectories before feedback, separate subjects from scorers, score observable outcomes, then reproduce claimed defects against the pinned tree. | Re-check when scoring criteria or the authority under test changes.

## Verification consequences

**Required now:** Level 1, a mechanical walk, plus direct integrity checks. The owning instructions and transfer-check reference resolve and contain the freeze, byte-pin, wait-for-all, trajectory, and scorer-separation rules. No fresh reader is warranted because this read-only run changes no instruction or authority and makes no reader-cost claim.

**For any future documentation-authority change:** require Level 2 with one fresh reader given a bounded scenario without the answer key. Pin the tested bytes, keep the answer key outside the tree, and record files opened, dead ends, authority accepted, steps, and decision. Escalate to Level 3 only for an explicit onboarding experiment or a claim of lower reader cost or broad transfer; then preregister topics and scoring, dispatch independent readers against one SHA-256 pin, freeze until all return, and score outputs and trajectories before editing.

## Unresolved and rejected

- **Unresolved:** The fixture is insufficient to certify the corrected round against every current Level 3 requirement or to quantify reader-cost improvement.
- **Rejected:** Requiring a reader batch for every documentation edit. The proportional rule is one fresh reader for authority or judgment changes; a batch is reserved for explicit high-cost claims.
- **Rejected:** Adding another repository policy. The reusable rule already has an owner and mechanism, and this invocation is read-only.

## Short trajectory

1. Read the learning-loop skill, then its concern catalog, routing rules, and transfer checks.
2. Read the sole fixture and pinned its bytes.
3. Compared the invalidated first batch with the frozen five-reader rerun.
4. Routed both lessons to the already-existing transfer protocol and selected proportional verification.
5. Made no repository edits.
