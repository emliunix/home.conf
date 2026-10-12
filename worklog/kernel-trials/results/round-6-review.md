# Round 6 plan: independent review (verbatim)

The independent seat (a sonnet subagent) read `round-6-preregistration.md` as first written on
2026-10-13, the round 4 and 4c verdicts, the 4c review, the engine's batching code and module
schema, the fixture runner and the method. It ran nothing and edited nothing. Its review follows
unedited; the plan's `## Review` section records how each finding was taken.

---

# Round 6 plan: independent review

I read the plan, the round 4 and 4c verdicts, the 4c review, `oracles.ts` (`partitionBatches`, the batch loop, `askSpans`), `module.ts` and `compose.ts` (`request_shape`), `oracle-test.mjs` and the experiment-round skill. I ran nothing and edited nothing. Findings are ordered by how much each one threatens the decision.

## 1. The decision rule keys on difference, not on correctness, and it is one-sided

**What is wrong.** "Any confident flip" selects per-atom whichever shape was right. A flip where batched is on the labelled side and per-atom is wrong is a per-atom regression, yet the rule flips the default to per-atom anyway. The "seeded cell per-atom catches and batched missed" trigger is better, but nothing handles the reverse: per-atom missing a defect batched catches, which is plausible, because batched shows sibling cells as a contrast set. The same goes for a position trend and for per-atom being stricter on genuine cells. The plan's own text says "chosen by the seeded cells, not by strictness", but the confident-flip trigger does not respect that.

**Why it matters.** "Accuracy is the priority" justifies per-atom only if per-atom is more accurate against the fixed labels. A bare disagreement says nothing about which shape is closer to the truth. A `fails` p=0.6 versus `holds` p=0.6 flip on a cell already at the threshold is noise. The batched arm already shows one such cell: gross row13 at 0.51 flips on repeat.

**Amendment.**
- Score each shape against the fixed expected labels. Report the cell-level 2x2 (batched right/wrong against per-atom right/wrong) and apply an exact McNemar or sign test to the discordant cells.
- Rewrite the rule on discordant cells and signed margins. Per-atom becomes the default only if it is correct where batched is wrong on at least k labelled cells, with no more than m opposite discordants. Choose k and m before the run, and also require that the effect exceeds the batched-vs-batched flip rate (finding 2).
- Add the missing branches: batched right and per-atom wrong; mixed results (declare "no shipping change, measure a larger batch"); a per-atom-better result confined to unlabelled or controversial cells.

## 2. No noise floor, and mean |Δp| is the wrong statistic

**What is wrong.**
- Δp on the peak value `p` loses direction. `peak(leaf)` is the max of the distribution, so a label flip at 0.6/0.6 gives Δp = 0. Take Δ on P(holds), or on P(expected side), per cell.
- Mean |Δp| over all cells is dominated by ceiling cells. Rounds 4 and 4c had most cells at 0.98 to 1.00, with about 8 to 12 cells inside [0.4, 0.8]. The statistic is diluted by about 140 cells that cannot move, and it can only fail to reach 0.05.
- Mean |Δp| is positively biased by pure sampling noise. The plan never states the batched-vs-batched |Δp| across the two repeats, and that is the floor. Rounds 4 and 4c recorded label stability only, never the p drift. If the floor is 0.03, a 0.05 threshold means nothing.
- The test "confirms the null" with low power. It is meant to show that nothing differs, yet no equivalence margin is stated.

**Amendment.**
- Primary statistic, paired per cell: d = mean of the two per-atom repeats minus mean of the two batched repeats, on logit(P(expected side)), or P(holds) if logit is not wanted. Report the mean signed shift with a bootstrap or paired t interval, and a Wilcoxon signed-rank p, over (a) all cells and (b) the near-threshold stratum, defined from round 4 and 4c batched p in [0.4, 0.8], about 10 to 12 cells.
- Noise floor: the same d computed between batched repeat 1 and repeat 2, and between per-atom repeat 1 and repeat 2. Interpret the shape effect only net of that floor.
- Pre-register an equivalence bound, for example 90% CI of the mean signed shift on the near-threshold stratum inside ±0.05, as the condition for "batched stays". Without it, "no confident flips" is absence of evidence.
- Replace the "mean |Δp| ≥ 0.05" refuting cell with "the CI of the signed shift excludes ±0.05, or exceeds the floor".

## 3. Request shape is not isolated: the comparison also changes context, and the plan misdescribes the follow-ups

**What the code shows.**
- The real axis is "the judge sees sibling cells and one shared prompt" against "one cell alone". Round 4 already found that context, not grain, decided the A vs A2 contrast. That is a legitimate axis, but the plan should name it as such. Batched also shows the judge 4 to 13 other evidence cells and other questions.
- **Follow-ups.** `askSpans` is called once per document, as one keyed batch, after the main labels are cached. It does this under both shapes: the `per-atom` branch only changes `partitionBatches`. So the plan's "one request per non-passing atom under both shapes" and the 6 and 14 request counts in the candidates table are wrong for follow-ups. Follow-ups do not feed back into the main label, so they do not confound accuracy. They do inflate cost for no information.
- **Byte-budget sub-batching.** `partitionBatches` splits batched requests by `maxEvidenceBytes`, `stateTokenBudget` and `maxQuestions`. The plan asserts "batched = 1 request" without checking. If the production judge splits design/04's 14 rows, "batched" is not one batch and the arms differ in batch size by fixture. Row 4c's `defective-subtle3` and `controls` could be split differently.
- **Cache.** The cache key is `model + question + labels + evidence hash + policy` and carries no shape. The runner uses `cache: "off"`, so this round is safe. But once the default changes, an enabled cache will serve a batched answer to a per-atom request. Add the shape, or a batch-context marker, to the cache key if the shipped default flips, or the flip silently changes nothing.
- **Order.** Atoms are sorted by `demand.key.localeCompare` (no `numeric`), so the order is row1, row10, row11, row12, row13, row14, row2, and so on, not row order. This matters for finding 4.
- **Sticky shape.** `compose.ts` makes `per-atom` sticky once any module in the chain sets it, so a runner that "rewrites one line" must do so in the one control module. A fixture whose rule composes a shipped module cannot be set to batched afterwards.

**Amendment.**
- Record `report.requests` per run (keys, `stateBytes`, question count) for both shapes. Add a pre-run check that every batched fixture is one request (or state its split), and fail the run if it is not.
- Add a probe-only `--no-spans` flag that skips the follow-ups. It saves about 30 to 40% of calls and removes a source of wall-time noise.
- Correct the candidates table and the axis paragraph.
- State in the verdict that the axis is "context plus prompt sharing", not request count alone.

## 4. The position measure is confounded as designed; add a permuted arm

**What is wrong.**
- Position is a deterministic function of row id (lexicographic), and the same 14 rows sit at the same sorted positions in all 6 fixtures. So there are 14 row-position pairs, not 84 independent observations. "Later third worse" is indistinguishable from "those rows' content is harder".
- The plan says "batch order equals row order". That is false here (finding 3), but the confound is as bad: the order is fixed per row.
- Thirds of 5 (goals) are 1 or 2 cells, with no stated test.
- The refuting cell "later third worse by ≥ 0.05 mean Δp" is undefined: |Δp| cannot be "worse", and there is no multiple-comparison control. Position is a decision trigger, so noise here could flip the default.

**Amendment.** Add a third arm, batched with reversed order, and ideally one seeded shuffle, on the 6 witness fixtures plus 4 of the 11 evidence fixtures. The engine sorts by key, so reverse the physical rows in the fixture markdown (new ids by document order) and remap `expect_cells`. This relaxes the `evidence-column-only` invariant, so write a row-permutation invariant instead. Test position as a regression of signed shift on position, with row as a fixed effect, using the permuted arm to identify it. If an engine hook is acceptable, a test-only `DOC_VERIFY_BATCH_ORDER` is cheaper. Do not make position a decision trigger unless the test passes under the permuted arm.

## 5. Judge drift: a same-day rerun is not enough as scheduled

**What is wrong.** The commands run batched ×2 and then per-atom ×2 in sequence. Any within-day drift, provider load, or alias change lands entirely on one arm. The "rerun batched the same day" improves on reusing rounds 4 and 4c, but runs of the same shape back to back measure noise, not drift.

**Amendment.**
- Interleave per fixture (batched run 1, per-atom run 1, batched run 2, per-atom run 2) in one runner invocation, with the arm order alternating (ABBA).
- Log the model id and the backend's reported version or fingerprint per run.
- Compare the first and the last batched repeat as the drift check. If batched-vs-batched across a time gap exceeds the within-pair floor, flag the run as drifted and rerun.
- Also compare the new batched run with the round 4 and 4c batched labels per cell. Reusing them for that is free. A mismatch there means the judge moved since.

## 6. The runner and comparer the predicate names do not exist

`--request-shape`, `--positions` and `compare-shapes.mjs` are not in `oracle-test.mjs`, and `probe/compare-shapes.mjs` is absent. Only the first predicate line is described as mock "wiring", and the rest cannot run. The plan says the comparer reads "the ledgers' recorded leaves", but the ledger stores only counts. `rows` in `runFixtures` are printed and never persisted. `--real-cells` prints a table and persists nothing.

**Amendment.** Before the run, add the flags, make each track write a per-leaf JSON (atom, row, shape, repeat, label, full distribution, answered, position, request id, batch size), and write and test the comparer on the mock output. A mock-only check cannot show the comparer is right, because the mock always answers the first option. Seed it with a synthetic JSON where a known flip exists and confirm the comparer reports it.

## 7. The real-cell track is stale and one-armed

**What is wrong.**
- `labels.yaml` was written blind on the pre-rewrite text and has not changed since round 4. Commit 5658273 rewrote goals/01's R1 to R4, R6 and A7 as chains, and the plan's own "goals/01 rows 2–3 near-threshold" cells no longer exist at HEAD. goals/04 was also rewritten. The round 4c verdict rewrote the design/05 and design/03 cells. The runner clones HEAD, so the "agreement with blind labels" and "three near-threshold cells" expectations cannot be measured on the same text.
- Real cells run per-atom only. The batched comparison is against rounds 4 and 4c from earlier, so the same-day control (finding 5) is dropped exactly where the shipped corpus lives.

**Amendment.** Either run both arms on the real cells, with labels re-derived on the current text or the clone checked out at the round 4 and 4c commits, or drop the claim of "agreement with the blind labels" and say the real track measures shape disagreement only.

## 8. Mixed oracles in one batch: the shipped case is not measured

**What is wrong.** Fixtures narrow the rule to a single oracle, so each batched request carries one question template. Real goal and design documents demand several oracles in the same document (goals/04 is listed as "5 cells + coverage"). A real batch has different questions and different evidence kinds in one prompt, each prefixed "Judge ONLY state.evidence.<key>". This is the case where batching is most likely to hurt. The plan lists "mixed shapes within a document" as unmeasured, but that is a different thing.

**Amendment.** Add a mixed-document track: run `--corpus` or `--real-cells` with the full shipped modules over a few documents (goals/04, goals/01, design/04, design/05) in both shapes, with `--repeat 2`. Record per request the number of distinct oracles. Make a first-class "mixed batch" stratum in the comparison.

## 9. Batch size scaling is not measured, though the decision generalises beyond it

The batch is 5 cells (goals) and 14 (design), and the hypothesis is stated for "the two shapes". Any claim that batched is safe must carry the bound it was measured at. Cheap extension: replicate the witness fixtures into 28-row and 42-row tables by concatenating rows from the 6 fixtures (label known), batched only, plus per-atom for a 14-row subset. That gives a size trend for about 100 more main questions. If not run, the verdict must say "tested at ≤ 14 only".

## 10. The `unknown` label is unaccounted for

`options` always includes `unknown`, and the leaf shapes include `judge-unknown` and `threshold-demoted`. The plan's confident-flip definition (p ≥ 0.6 on each side) and Δp ignore these. A shape could trade `holds` for `unknown` with no flip and little Δp on the peak. Report, per shape, the shares of the four `shapeOf` values, and treat `unknown` versus a labelled side as a transition. Use total variation over the full distribution as a second Δ.

## 11. Expectations table

- Refuting cells are blank for "seeded cells batched missed" and for "cost". Fill them: the first as "per-atom holds on gross row13 at ≥ 0.6, or controls row1 flips to fails"; the second as the same "no decision depends on it" line.
- "confident flips: 0, medium" is over-confident given about 280 comparisons and a known batched self-flip. State the expected number under noise (it is nonzero) and require a flip to reproduce on both repeats.
- "per-atom ≤ batched (1) repeat flips, refuting > 2" is asymmetric, and with n ≈ 140 cells the counts are too small to distinguish 1 from 2. Use the flip rate with an interval.
- "position: medium-low" is fine as confidence, but see finding 4 for the refuting cell.
- "per-atom 6–14× the requests, 2–5× the wall time": requests will be 14× on design; a plain estimate. Per-atom wall time is sequential in `complete` calls, so expect roughly equal to the request ratio, not 2–5×, unless the judge's latency is dominated by fixed overhead. The prediction is not falsifiable as stated; record tokens or `stateBytes` sent, not just requests.

## 12. Cost and caps

- Main questions from the plan: 55×2 + 84×2 = 278 per shape for fixtures, plus about 49 real-cell questions, so about 605 main in all (the plan says "about 280 per shape plus 60"). With follow-ups bounded by main it is ≤ 1210, not "about 1000", unless the follow-up share is as low as in rounds 4 and 4c (about 45%).
- The proposed additions (reversed arm ≈ +170 main, mixed-document track, size scaling ≈ +100) raise it to about 900 main. Re-project, then set caps per track at 1.5× worst. Caps are per ledger name, so each of the 5 ledgers is capped separately, and the total is unconstrained.
- `mayStart` checks the projection of a single run, charged per `runKey`, and `--repeat` rewrites the same mock key rather than summing, so a live `--repeat 2` can overshoot the cap by one run before the next check. Project `worst × repeat`.
- Report bytes (the sum of `stateBytes` across `report.requests`) and wall time per shape. Requests alone understate per-atom's real cost.

## 13. Smaller points

- The batched arm is rerun now, so the "known batched labels" in the Atoms section are stale priors, not controls. Say so.
- Duplicate cell texts (subtle row 1 and row 11) are independent in the cache-off arms; fine, but exclude duplicates from the paired statistic or count them once.
- The "threshold ledger item" for strictness is a good outlet; keep it.
- A seeded-defect flip for the comparer (finding 6) belongs under `seeded-defect-gate`.
- Do not label the permuted arm a fixture edit of `good.md`; give it its own `edit` integrity check.

**Verdict: run after amendments.** The question is the right one and the batched/per-atom pairing is a clean contrast, but as written the comparer does not exist, the statistic cannot see small shifts or separate them from noise, position is confounded, and the decision rule would flip the default on a bare disagreement. Findings 1, 2, 4, 5 and 6 are blocking; 3, 7, 8 and 10 should go into the same revision.
