# report-style v2 - checkpoint trial (2026-09-23)

## Scope

One `eval-prompt` production/procedure trial of **report-style v2** on one curated
task-svc transcript checkpoint. The reviewed artifact is the skill; the task-svc
report the arms produced is evidence only, not the deliverable.

- Artifact: `SKILL.md` sha256 `0090d006c201716293fab10a727e51bceabffa2ad4d1e6a4d81f5f7bc47b5040`
  (5574 B), `references/catalog.md` `271ef756...` (2712 B),
  `references/change-report.md` `809da389...` (2119 B).
- Fixture: checkpoint `e1f19470...` (ordinals 19384, 19390, 19410 verbatim) plus a
  frozen source bundle `b6c7d288...` (baseline + Goals 09-12 / Designs 24-36 facts).
- Arms: control = framing + bundle; full = framing + bundle + the three skill files.
  Identical conversation messages, model, effort, temperature, and cap.
- Model: `openai/deepseek/deepseek-v4.1-flash-dogfooding`, `reasoning_effort=max`,
  `temperature=0`, `max_tokens=96000`, streaming. One scored run per arm.

## Verdict

**INCONCLUSIVE for the skill's broad production effect; GO on the narrow observed
contributions.** The full arm produced a conformant record and beat the control on
three dimensions with no dimension worse, but the checkpoint's assistant turn
(ordinal 19390) pre-commits both arms to a source-keyed, model/policy-separated,
process-suppressed report, so this replay cannot isolate the skill's overall effect.
One checkpoint, one run per arm, one model.

## Harness finding

Native mid-session resume is **unsupported**. `flow-skills-eval` is a single-shot
decision runner (`src/eval/agent.ts`: one chat completion, tool-forced
`submit_decision`). Codex `exec resume`/`exec fork` and OpenCode `run --session
[--fork]` resume or fork from a session's recorded end state; none selects an
arbitrary mid-session turn. The trial therefore used an **exact multi-turn checkpoint
replay** through the smallest valid direct chat/API runner (Bifrost
`/v1/chat/completions`), labeled checkpoint replay, not resume. No real session was
mutated. Non-streaming hits Bifrost's upstream timeout on this prompt; streaming with
`stream_options.include_usage` is required.

## What the skill changes vs control

| # | Dimension | Control | Full | Delta | Basis |
| --- | --- | --- | --- | --- | --- |
| 1 | Primary kind selection | 2 | 2 | 0 | both read as a change report; the request names "changes", so routing was easy |
| 2 | No universal feature-list default | 2 | 2 | 0 | neither used a feature list |
| 3 | Work-history suppression | 2 | 2 | 0 | neither narrated process; induced by 19390 |
| 4 | Before/after behavior | 1 | 2 | +1 | control states a baseline then changes; full pairs them in a before/after table |
| 5 | Model vs policy separation | 2 | 2 | 0 | both separate; induced by 19390 |
| 6 | Opaque ID vs human-readable name | 2 | 2 | 0 | both state the distinction |
| 7 | Current/target availability | 2 | 2 | 0 | both label landed/reviewed/draft/blocked |
| 8 | Self-contained explanation | 1 | 2 | +1 | control is self-contained prose with 0 source keys; full carries 267 keys and a resolving three-table legend |
| 9 | Honest claim boundary | 1 | 2 | +1 | control lists open items; full splits established / designed-not-observed / unresolved / not claimed |
| 10 | Chronology guidance | 2 | 2 | 0 | both avoid an activity ledger; full adds integration order where it changes correctness |
| | **Total** | **17** | **20** | **+3** | |

Mechanical: control 3066 words, 0 source keys, 0 legend tables, 0 diagrams; full 3522
words, 267 source keys, 3 legend tables, 2 diagrams. The full arm is 456 words longer;
the increase is the legend and keying, not padding. The v1 induction claim (full
shorter) is not reproduced, but the full arm carries a clear warrant gain.

The strongest clean signal is dimension 8: ordinal 19390 told both arms the report
would be "source-keyed", and the control still produced zero source keys; the full arm
produced 267 keys and a legend where every key resolves. The skill converted an
intent into the record machinery.

## Contamination disposition

Ordinal 19390 commits both arms to "a source-keyed worklog report ... separate
domain-model changes from policy changes, distinguish added/removed/deferred policy,
and keep rubric/process material out". Dimensions 3, 5, and the intent behind 8 are
therefore induced before the artifact is applied. This replay tests **incremental
routing, chronology, and self-containment after that commitment**; it cannot cleanly
establish the skill's broader production effect. The fixture was not changed
mid-batch.

## Defects and observations in the artifact

1. **Material integrity - stale lock.** `tests/frozen.lock.json` records `SKILL.md` as
   `36b8560b...`; the current v2 bytes are `0090d006...`. The lock was not refreshed
   (instruction) and the trial used the current bytes. A consumer that trusts the lock
   would pin the wrong artifact. Disposition: recorded; fix belongs to the skill owner.
2. **Aspect overlap in `change-report.md`.** The file lists nine aspects; the full arm
   selected eight and skipped "Reader-visible behavior" as a named section, covering it
   inside the before/after table. The aspect file does not say which aspects are
   load-bearing for a record versus a brief, so selection is left to the subject.
   Disposition: recorded; candidate edit is to mark the record's minimum aspect set.
3. **Diagram rule is not self-enforcing.** `SKILL.md` says to cut any diagram that only
   repeats adjacent prose; the full arm kept two diagrams that largely restate the
   adjacent lists. The rule has no test, and the record template invites diagrams.
   Disposition: recorded; candidate edit is a one-line test ("name the relationship the
   prose cannot show as cheaply").
4. **"Write the abstract last" is a process claim.** It is unobservable from the
   output; the observable proxy (the abstract introduces no claim the description does
   not expand) held in the full arm. Disposition: recorded as unpriced, not a defect.
5. **Routing was not cleanly tested.** The request names "domain model changes and the
   policies change", so the Change kind was signalled by the fixture. The catalog's
   change/system and change/status routing rules were not exercised. Disposition:
   recorded; needs a fixture whose kind is ambiguous.
6. **Record furniture versus subtraction.** The record's mandatory legend and per-fact
   keys add length; for a self-contained worklog report this is the intended trade, but
   the skill's "subtract before adding" rule and the mandatory legend pull in opposite
   directions. Disposition: recorded; the induction claim needs a fixture that prices
   the legend.

## Chronology guidance

Worked in this fixture. Both arms avoided an activity ledger; the full arm used
before/after comparison and included order only where it changes correctness (the
serial `(service, implementation)` integration). The result is contaminated by 19390's
"keep rubric/process material out", so it is a positive signal, not proof.

## Evidence

- Pre-registration: `/tmp/report-style-v2-eval/pre-registration.md`
- Checkpoint: `/tmp/report-style-v2-eval/checkpoint.md` (`e1f19470...`)
- Source bundle: `/tmp/report-style-v2-eval/source-bundle.md` (`b6c7d288...`)
- Arm outputs: `/tmp/report-style-v2-eval/arm-control.md` (23092 chars),
  `/tmp/report-style-v2-eval/arm-full.md` (24977 chars)
- Raw records with usage: `/tmp/report-style-v2-eval/outputs/control.json`,
  `/tmp/report-style-v2-eval/outputs/full.json`
- Trajectory: `/tmp/report-style-v2-eval/trajectory.md`
- Scored usage: control 2446 prompt / 19691 completion (14232 reasoning), 268.2 s;
  full 4725 prompt / 54482 completion (47947 reasoning), 695.2 s.

## Limitations

- One checkpoint, one run per arm, one model: a sample, not a batch.
- The bundle is an evaluator abridgement; the verdict is scoped to it.
- The original trajectory read report-style v1; the artifact under test is v2.
- The full arm received only catalog + change-report, not the other six kind
  references.
- No post-trial feedback was collected: the subjects are single-shot API calls with no
  tools or feedback channel.

## Next step

A clean production trial whose checkpoint does not pre-commit the output shape, or an
ablation of the record furniture (legend, diagrams, open capture list) on a fixture
that prices it. Until then the skill's broad production claim stays open; the narrow
record-shape and keying contributions are established.
