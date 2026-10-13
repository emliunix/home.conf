# Round 12 plan review (independent seat: Sonnet; author: Opus), 2026-10-14, verbatim

Review of worklog/kernel-trials/round-12-preregistration.md (read-only; nothing run live).

BLOCKING

B1. The "≥2 right cells" bar is unreachable on evidence_reasons; the E-track expectation for C ("≥2 more right cells") is unreachable. Round 10: 0 wrong-side cells on real (13/13 right at 0.5) and on the seeded set (50/50). The only cells the judge gets "wrong" are the 5 `defective-wrongrow` cells, which carry `expect: holds` (deliberate known-gap label). C is the only arm that could fix wrong-row — and would do so by turning them `fails`, which under the fixed labels counts as right→wrong, triggering decision row 4 and blocking C from shipping. Amend: pre-register `wrongrow` as a separate probe whose true label is the fixture's own `why` ("fails"), excluded from the right→wrong tally, with its own bar for C (e.g. "≥3 of 5 wrongrow cells move to fails, both repeats"); report all other E cells as a no-harm check. The "≥2 right cells" clause, unmodified, should be dropped for E.

B2. The "near-threshold ≥ +0.10" bar is statistically hollow. Stratum size: E-real 1–2 cells (round 10: one cell below 0.7, goals/01 row 8 at 0.63); E-fix ~3–5 cells (good-nopath r3 0.67, good r3 0.55, …). With per-cell total variation up to 0.29 (round 8), a mean over ~5 cells has ±0.1 noise and the bar has no CI. And the stratum is selected on N's first repeat, so regression to the mean pushes any later arm upward — +0.10 can appear with no effect. Amend: compare N rep2 vs arm rep2 (selection repeat excluded) and report N rep2 − N rep1 as the null; require the bootstrap 90% CI to exclude 0 and ≥80% of stratum cells moving up; say outright the bar is weak at n≈5. Also: "round 8's definition (0.45–0.70, first repeat)" does not match compare-shapes.mjs, which uses batched mean P in [0.4, 0.8].

B3. `row_key('Requirement')` fails on goals/01: its evidence table is "## Acceptance evidence" with header `Row` (goals/04 uses `Requirement`). In rules binding the atom, a failed path means the atom disappears — the cell goes unasked, and 8 of 13 E-real cells would silently drop out of A and C. Amend: make the key header a param (`Row`/`Requirement`, as `evidence_headings` already is), add a "every labelled cell found under every arm" test (round 8's "29/29 labels found"), and state what C does when `section_keyed` finds no heading (fall back to A, or the cell visible as unasked). None of the 13 real cells lacks a heading (R1–R6, A7, A8, R1–R5 all have `###` headings), so this is only a contract gap.

B4. The predicate drops `--invariant-base c632a91` for E-fix (round 10 needed it: goals/04 at HEAD no longer matches the fixtures' base), and omits `compare-arms.mjs --self-test` (rounds 8 and 10 ran a self-test with seeded mutations; the new comparer needs one).

SHOULD-FIX

S1. The runner has no arm dimension. `schedule()`/`.shapes/` cloning vary request_shape only; the sidecar's `arm` field already means normal/reversed. Needed: a module-variant override per run, ABBA over arms, a renamed sidecar field; compare-shapes' shape partition can't be reused as is. Reusable: stats, unit pairing by row/section id, the stratum, `complete`. State it as a runner change, not just a new comparer.
S2. E-fix size: 11 documents (50 cells + 5 known-miss), not "13 × 5" (the 13 files include companion.yaml and fixtures.yaml).
S3. No length-matched control: A vs N also differs in prompt length. Add a cheap deranged-context arm D (same address from a different row/document) on E-fix only (~130 questions), or name the confound unmeasured.
S4. "0 right→wrong in both repeats" over ~500 cells has no noise calibration (round 10 saw two seeded cells change side between repeats at 0.6). Define "wrong" as decided-wrong at p ≥ 0.5, `unknown` reported as a separate loss; add an N-vs-N repeat comparison as the base rate for spontaneous flips.
S5. Decision rows inconsistent and gapped: row 1 needs 0 right→wrong anywhere, row 4 is per-oracle. Not covered: C and A both meet with C marginally better; A gains on E but harms W (the table says A ships only where it moved nothing wrong — write it explicitly); neither meets and one right→wrong. Make bar and ship decision per oracle; add "C ≈ A (within CI) ships A, the smaller context"; pre-register the wrongrow bar.
S6. Module pages (M) are pinned `batched` in the shipped libraries, but the plan runs M per-atom, so M is not the production configuration, and the design doesn't say how "Where:" renders in a batch. Either run M per-atom and say so, or drop M to a smoke test. Round 8 found 15 of 28 M units already wrong under both shapes, so M can show wrong→right but little else.
S7. Seeds: seed 3 is stated backwards (design-07 review S7: removing the primitive should make a path module print `rejected`, which turns the "module evaluates" test red — say that). No seed covers `section_keyed` (e.g. `R1` matching `R10`, or first-token-only), the echo rule, the key round-trip or the outbound scan; add at least a section_keyed seed and a key-mismatch seed since C depends on them. The predicate omits `boundary.test.ts` and `npm test`.

NOTES

- C's context is only the requirement's heading text, not its body: a weak "claim"; say so.
- `Where:` for a section subject includes the subject's own heading; the goals/01 title carries the status and date.
- Cost estimate (live questions, two repeats): E-fix 132×3=396, E-real ~60×3=180, W-fix 168×2=336, W-real 104×2=208, M ~170×2=340 → ~1,460 (+130 for D). State per-track caps (132/60/168/104/170 per arm with 30% headroom) rather than "set from a mock run".
- Unmeasured, to be stated: the production judge only; E-real labels are judge-exposed on 8 of 13 cells (goals/04 is the never-exposed check); per-cell flips.

Run after amendments.
