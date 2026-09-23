# Evaluation summary

Date: 2026-09-22. This is a sample, not a population estimate. Fresh subjects were separated from
the scorer, the pre-registration stayed outside the tested tree until all subjects returned, and
the repository was unchanged within each batch. Raw subject reports in this directory preserve
their trajectories and outputs.

## Material

- Final artifact bundle: `b8557ec2b1151cd9110a66e025479274d9612868ff8d232da7810f45a381bc84`.
- Rich fixture: `8a907245e301f6810d74f1ce4c669a8c5c30c7159af507188a59012ea77261da`.
- Low-learning fixture: `414b458712bf14b682604c92ab020d5ea423274a1478524bb814de56cbf400aa`.
- Documentation-transfer fixture: `a0d5f239d4e630e91037731ecc9e88f165070d0a3926dbfa1b14a12336ecfdd1`.
- The pre-registration records the per-iteration tree manifests, predictions, and ablation bytes.

## Trigger

The entry-only subject scored **9/9**. It selected `learning-loop` for all explicit and paraphrased
completed-work learning requests and stayed silent for implementation, pull-request review, and
status prompts.

## Procedure

| Item | Control | Entry-only | Full v5 |
| --- | --- | --- | --- |
| P-EVIDENCE | pass | pass | pass |
| P-SELECT | fail | fail | pass |
| P-SCHEMA | fail | fail | pass |
| P-COST | pass | pass | pass |
| P-ROUTE | pass | pass | pass |
| P-STRUCTURE | pass | pass | pass |
| P-PROVENANCE | fail | fail | pass |
| P-SUBTRACT | pass | pass | pass |
| **Total** | **5/8** | **5/8** | **8/8** |

Delta against control: **+3 items**. The full arm alone named scenario concerns, carried every
lesson field including freshness, and preserved source scope throughout. Iteration 1 exposed
invented exact test paths. The v2 routing rule fixed that. Iterations 2 and 3 exposed report
repetition; the final 900-word limit reduced the full arm from 15,436 bytes to **5,698 bytes / 790
words**, below the control's **7,811 bytes / 1,113 words**.

The clean low-learning trial selected one concern, rejected the single transient tool failure,
created no policy or mechanism, and requested no fresh reader. **P-SUBTRACT passes.**

## Induction

Both anonymized outputs transferred the product cause and the two test defects correctly. The full
output was 29 percent shorter. It exposed two real governance gaps and three discovery hops; control
reported one unresolved owner and two hops by placing open verification work in the API contract or
worklog instead of an explicit open-work register. Because the outcomes were not equally correct on
routing, the strict equal-outcome cost claim is **not established**. The sample still supports the
900-word cap: the more complete output cost fewer reading words.

## Ablation

| Removed part | Observed change | Disposition |
| --- | --- | --- |
| Concern catalog | The output no longer named scenario-specific concern packs. | **Keep.** P-SELECT degraded. |
| Routing step | Open verification work moved to a temporary worklog destination and lost the explicit register blocker. | **Keep.** P-ROUTE degraded. |
| Structural enforcement check | The rich fixture itself asked for end-to-end tests, so the output still selected mechanisms. | **Unpriced.** Keep provisionally; use a fixture where the user does not prescribe the mechanism before promotion. |
| Transfer checks | The ablated output required a fresh reader batch for every authority change; full used a mechanical check now, one reader for a future authority edit, and a batch only for a reader-cost claim. | **Keep.** Proportionality degraded. |

## Walk

The final walk resolved the package references, lint, and all fixture-established taskboard
destinations. It reported concrete blockers for the missing authoring-skill owner, open-work
register, source repository for the documentation fixture, and unavailable live-test prerequisites.
It ran `python3 tests/l0.py` successfully. One wording defect remains in the raw walk: it called the
current repository HEAD the package commit even though the new skill was untracked. The byte digests
are the valid pin; the skill already permits a digest instead of a revision, so no duplicate rule was
added.

## Finding dispositions

- **Fixed:** unsupported exact paths now become owner-level `BLOCKED` routes.
- **Fixed:** the default report is capped at 900 words and cannot repeat its lesson table.
- **Fixed:** sparse cases may select one concern; both fixture answer-key leaks were removed.
- **Fixed:** `verified existing` now distinguishes an already-encoded mechanism from a new edit.
- **Retained:** concern catalog, routing, and proportional transfer guidance earned measurable
  differences against their ablations.
- **Unpriced:** the separate structural-enforcement reminder. The current rich fixture states the
  desired test mechanism itself, so this batch cannot isolate the reminder's contribution.
- **Open:** a second induction trial with equally correct control and full outputs is needed before
  claiming fewer future source hops. The current result supports lower reading volume, not that
  stronger claim.
- **Rejected:** coupling the skill to flow lifecycle status or requiring a reader batch on every
  invocation.
