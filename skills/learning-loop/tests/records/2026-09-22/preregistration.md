# learning-loop evaluation pre-registration

Declared: 2026-09-22 before the first subject run.

## Material

- Artifact: `SKILL.md` plus the three direct references.
- Artifact bundle SHA-256: `b172729b4cf84c57210b1e14394708f68aded9860cb295395eacb394fd75d096`.
- Rich fixture SHA-256: `8a907245e301f6810d74f1ce4c669a8c5c30c7159af507188a59012ea77261da`.
- Documentation fixture SHA-256: `cabcaf4de9bb50e2fec60be922483aa133831fbe740e4c59c5408984f4dece07`.
- Low-learning fixture SHA-256: `55de554d77ad97f73461da9ffef640c9d5d823287bc85344b1fa3c9fc02f7a92`.
- Repository file-manifest SHA-256 at freeze: `9721a2eb8e8abfd3da5a249566da3148a314f64874ad21b2e00223a9280d213a`.
- Git porcelain SHA-256 at freeze: `225d61f927add247d4a901391c44c8a7da049e5ad402ce51ea45620434e50023`.
- Loadability: `quick_validate.py` passes and the frontmatter name appears in the checked-in package.

The repository is frozen from first dispatch until all subjects in that batch return. Subjects may
read only their named material and must not read this file, `tests/rubric.yaml`, other arms, or other
subjects' outputs. They make no repository edits.

## Trigger prediction and answer key

One subject receives all skill descriptions plus the nine prompts in `tests/cases/trigger.yaml`.
Expected classification in file order: learning-loop, none, learning-loop, learning-loop, none,
learning-loop, learning-loop, none, learning-loop. Prediction: 9/9 correct. A miss on a paraphrase
shows lexical matching; a false positive on implementation, review, or status shows an over-broad
entry surface.

## Procedure arms

All three subjects receive the same rich fixture and task. Control receives no artifact. Entry-only
receives only the `name` and `description` frontmatter. Full receives the exact artifact bundle.
Model family, effort, tools, and no-edit constraint are held constant.

Score the produced trajectory and report on these eight binary items:

1. P-EVIDENCE: cites message ranges or artifact paths before causal claims.
2. P-SELECT: explicitly selects two to four applicable concerns and omits irrelevant ones.
3. P-SCHEMA: accepted lessons distinguish observation, inference, lesson, destination, mechanism,
   and freshness.
4. P-COST: uses the measured 302.31/303.76 to 2.54 second evidence and separates test defects from
   the blocking-listener product defect.
5. P-ROUTE: names existing strongest owners; it reports the missing authoring-skill owner rather
   than inventing a generic lessons file.
6. P-STRUCTURE: routes valuable recurring service gaps to end-to-end tests and trace/visual checks,
   not only prose.
7. P-PROVENANCE: durable proposals retain source message ranges, scope, and re-check/removal terms.
8. P-SUBTRACT: rejects a universal rule from one transient failure and does not expand unrelated
   project documentation.

Prediction: control scores 3-5, entry-only 4-6, full at least 7 and beats control by at least three
without losing an item. The full output should propose a mechanical walk and at most one bounded
fresh reader for the authoring guidance, not a reader batch.

## Low-learning prediction

The full procedure over `low-learning.md` should select no more than two concerns, retain the result
as one-off evidence or make no durable change, and reject policy based on the transient browser
disconnect. A new skill, architecture rule, or reader batch fails P-SUBTRACT.

## Induction prediction

A fresh maintainer using the full output should answer the shutdown cause, remaining verification
gaps, and owners with at least equal correctness and fewer unresolved ownership decisions than one
using the control output. Count source hops, dead ends, reading words, correct answers, and unresolved
owners. The feature pays for itself only if this transfer gain offsets the extra production words;
otherwise record induction as not demonstrated.

## Ablation predictions

- Remove concern catalog: P-SELECT degrades through an implicit or broad checklist.
- Remove routing: P-ROUTE degrades through generic or implicit destinations.
- Remove structural enforcement: P-STRUCTURE degrades by routing recurring checks to prose.
- Remove transfer checks: the output omits or overprices fresh-agent verification.

Each ablation is scored only on the behavior it exercises. A tie makes the part a deletion candidate;
an unexercised part remains unpriced.

## Walk prediction

The package paths and checks resolve. The taskboard source repository should resolve at
`/Users/ppio/Documents/visflow`; any missing open-work or authoring-skill owner must be reported
BLOCKED with the missing owner named. Every verification proposal must state a command or artifact
and its expected result.

## Pre-registered iteration 2

Declared after all iteration-1 procedure subjects returned and before the iteration-2 full subject.
The only behavioral change is a routing constraint: when the evidence or source tree does not
establish an exact file, the report must name the owner or directory, mark the route `BLOCKED`, and
state the lookup that would resolve it. Artifact bundle SHA-256:
`297adb21fc8d919e455d0d37205e40c5de38b3958511ab80fa2fec83471b7051`.

Prediction: the full arm now passes P-ROUTE and scores 8/8. All other expected outcomes stay fixed.
Iteration-2 repository file-manifest SHA-256: `495b1d51054014d03a4b21c3793c34403cde00b586b41ed3fec0cd0441be2ab2`.

## Pre-registered iteration 3

Declared after the iteration-2 subjects returned. The artifact now requires a compact default
report without repeating the lesson table, and the low-learning fixture no longer contains its
expected disposition. Artifact bundle SHA-256:
`3a6a5da0972669f6ec951de3fb6f9eb2b0e74a6d4255bcc8dd0d0accd4f11cbe`.
Low-learning fixture SHA-256:
`414b458712bf14b682604c92ab020d5ea423274a1478524bb814de56cbf400aa`.

Prediction: the full rich-fixture output remains 8/8 and falls below 10,000 bytes without losing
accepted-lesson fields. The low-learning output still makes no durable policy and uses no fresh
reader. The induction reader reaches the same correct answers from control and full; the full output
has fewer unresolved owners and costs no more than 25 percent extra reading bytes.

## Pre-registered iteration 4

Declared after iteration-3 subjects returned. The artifact now caps the default report at 900 words,
allows one concern for low-learning evidence, and adds `verified existing` for mechanisms already
applied in the source task. Artifact bundle SHA-256:
`1787c10ca0add52981523e875c4c187761e2ffa03add3ef7ec460bb6d4064b83`.

Prediction: rich full remains 8/8 and is no more than 9,750 bytes, which is at most 25 percent over
the 7,811-byte control. Low-learning selects one concern, makes no durable change, and remains below
the 3,720-byte answer-key-contaminated sample.

## Pre-registered iteration 5

Declared after the iteration-4 subjects returned. The only change aligns the concern catalog with
the core procedure's one-to-four bound. Artifact bundle SHA-256:
`b8557ec2b1151cd9110a66e025479274d9612868ff8d232da7810f45a381bc84`.

Prediction: the rich output is unchanged in substance and remains within the iteration-4 size bar;
the low-learning output selects only `outcome.frozen-intent`, makes no durable change, and uses no
fresh reader.

## Final induction and ablation material

Declared before those subjects run. Repository file-manifest SHA-256:
`55331b5629d580bb4b662a32cda8bc87019e95f85387a7d35eea2a9e64cf49a9`.

Induction output A is final full (`3e42f53c141ca52c1ea6c3c68cff830ac264f16da213e51bd97a816cd3bcd329`,
790 words, 5,698 bytes). Output B is control (`166ab0154a0e325eb8d6839505601cc02cba5ffc473c84b69d01b3ace59348a6`,
1,113 words, 7,811 bytes). The subject is not told which arm produced either output.

Ablation variant SHA-256 values:

- minus concern catalog: `dbe0cd6f9a53bc363f7998ed6a0d44d7e607bde40653c9c2b03d36697486e3ac`
- minus routing: `a81743f5efee8a71719479e5f77fbdd4cc7c687cf2063e2eed993770d3242793`
- minus structural check: `399df599869fb9c2bac29d0e712ed92d796cb2aa0b4d255a086210dbdd3d2c16`
- minus transfer check: `bad088cd87370a72825b7bec0893f7ed1d899113f2897416c3c5fadb56df110a`

Each ablation subject receives only one variant and one fixture. The first three use the rich fixture;
the transfer ablation uses the documentation fixture because it exercises a reader-batch decision.

## Transfer ablation rerun

Declared after the first transfer pair exposed an answer-key sentence in the fixture. The sentence
was removed; no skill artifact changed. Clean documentation fixture SHA-256:
`a0d5f239d4e630e91037731ecc9e88f165070d0a3926dbfa1b14a12336ecfdd1`.

Prediction: the full arm selects a level-1 walk for the already-encoded correction and reserves a
reader batch for a future onboarding-cost claim. The minus-transfer arm either omits a proportional
verification decision or proposes an immediate batch; either difference prices the transfer guide.
