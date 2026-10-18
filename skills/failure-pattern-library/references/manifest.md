# Failure-analysis manifest — version 1

**Source.** `#357` semantic process study, attachment `2cbb66b3` (`sha256 965b3cf4…`, 17,595 B).
**Supersedes nothing.** This is the evaluable form of that report's §5, extended for the library study
in `#42`. The report remains the evidence; this file is the procedure and the criteria a later seat can
rerun.

⚠ **The split is the whole instrument.** A criterion is either **executable** — a script decides it and
its exit code may gate — or **semantic** — a reader decides it and it has **no exit-code authority**.
A semantic criterion never inherits an executable label because a proxy can be scripted. Where a proxy
exists it is named *as a proxy*, beside the criterion, and never substituted for it.

---

## 1. The unit of work, and the denominator

**The unit is a `task_id` or a `run_id` — not a message, not a card, not a write-up, and not a session
turn.** A task contains many turns; a turn is an event joined to the unit, never the unit itself.

A task class contains many Raft messages, retries, gate runs and card amendments. Counting any of those
as the population inflates every recurrence figure, because the thing being counted is the
communication about the work rather than the work.

| term | definition | included | excluded |
|---|---|---|---|
| **work unit** | one unit of work with its own identity — a `task_id` or a `run_id` | actions taken, failures observed within it | the messages that announced, retried or amended it |
| **within-unit event** | something that happened *inside* a work unit — a session turn, a gate run, a retry | joined to its unit by the join key | **never a denominator**: a task contains many turns |
| **communication event** | a Raft message, a card amendment, a gate receipt | — | **never a denominator unless the finding is explicitly about communication** |
| **join key** | the task/run identity that lets an event be attached to its unit | transcript IDs where the record carries one | — |

⚠ **A record that cannot be joined is `not-joinable` and is reported as such.** It is not silently
folded into a class, and it is not dropped: dropping unjoinable events would make the population look
cleaner than the record allows.

⚠ **The `role == "user"` trap, measured in the source report, is this rule's justification — and the
count is NOT reportable.** There, 4,500 records read `role == "user"`: **4,199 harness-injected inbox
notices** + **60** other injected notices + **237** other injected envelopes = **4,496**, leaving **4**
records unaccounted for by that classification (the report's own arithmetic does not close, and I am
recording that rather than rounding it away).

⚠ **Do not rehabilitate any single human-turn count as "the denominator".** The source report measured
the same quantity **three ways and got 39, then 28, then 14** (§4 failure #7: a message is re-delivered
in several envelopes, so a regex counts *deliveries*, not messages; deduped by `msg=` id the answer is
**14**). **Three values for one quantity mean the quantity is not currently measurable from this
record**, and publishing the middle one as "honest" would launder a 2.8× spread into a point estimate.

**The valid finding is the mechanism, not the number:** `role == "user"` classifies the **envelope**,
not the author. Any denominator this manifest publishes must name which envelope it counts inside, and
**must state its spread when the quantity was measured more than once.**

⚠ **AND THE INSTRUMENT THAT PRODUCED THE NUMBER STILL CARRIES THE DEFECT.** The shipped
`tools/transcript-timecost.py` prints `human records` for `role == "user"` and divides the assistant and
tool-result counts by it — so **rerunning the tool reproduces the exact misreading this section
forbids**, and it does so silently, in a label a reader has no reason to doubt. `S3` (real artifact, not
a proxy) applies to **the tool as much as to its output**: a number whose label asserts a different
subject than its filter selected is a proxy wearing the artifact's name.

⇒ **Rule for #42 and for any rerun:** before quoting a count from a tool, read the predicate that
produced it, not the label it printed. Where a tool's label and its filter disagree, **the filter is the
truth and the label is a defect to report** — not a value to inherit.

### The corpus census this manifest is applied to

```text
entry directories   119
metadata.md         118     (1 directory carries README.md instead — see §5)
index rows          120
```

⚠ **These three numbers disagree, and the disagreement is itself a finding.** A population stated as
one number without the other two is a claim about a different set than the reader assumes.

---

## 2. Executable checks

⚠ **Every row here is implemented in `tests/corpus_checks.py`, and each is seeded.** A row that names a
predicate no code evaluates is a wish wearing an exit code — the first version of this manifest listed
six and implemented none, and a copy of the corpus with `99 / 1` in it stayed green. That is why the
implementation and the table are now the same claim.

| id | check | predicate (implemented) | failure mode it catches | evaluated from |
|---|---|---|---|---|
| **E3** | additivity | a stated `partition` of the form `a+b = total` or `sum / total` sums **exactly** | buckets that silently lose members | `partition` |
| **E6** | shape-not-content | a `classification_basis` naming `role`/`type`/`field name` is rejected | `role == "user"` read as "a human spoke" | `classification_basis` |

**What these two decide, and what they do not.** They decide **what the field says**. They cannot decide
whether the field was filled in truthfully, or whether the chosen basis was the right one — those are
`S-basis-choice` and the §7 limits.

⚠ **`corpus_checks.py` refuses when it evaluates nothing.** No entry currently carries these fields, so
it exits **2 — `NOT EVALUABLE` — not 0.** A green line over a population nothing examined is #38's
defect in a different place, and the script says so in its own output.

## 2b. Reclassified from executable to semantic

⚠ **E1, E2, E4, E5 and E7 appeared in the source report's executable table. They are semantic here, and
this is a deliberate change, made after trying to implement each one.**

| source id | here | why it moved |
|---|---|---|
| **E2** unit-scaling | **S-proxy-shape** (§3) | "if a gap scales with an unrelated quantity, the process name is wrong" is **a judgement about whether a correlation is spurious**. A script can compute a correlation; it cannot decide whether the process name is wrong. **The number is executable; the verdict is not.** |
| **E7** seed-moves-the-number | **P1** (§4) | The *operation* is executable — mutate, rerun, diff. **The claim it supports is not**: "the figure moving proves the check discriminates" is a reader's inference about what the movement means. It is retained as a **mandatory control** rather than as a criterion that can gate on its own. |
| **E1** twin-clock | **S-clock-named** (§3) | ⚠ **I implemented this and withdrew it after running it.** The presence half ("a duration must name its clock") flagged **9 durations across 3 entries — all of them thresholds**: `>60 s`, `a 120 s bound`, the `300–600 s bucket`. A regex cannot separate *"the gap was 120 s"* from *"an idle bound of 120 s would not have cut it"*, because that difference is whether the sentence **asserts a measurement**, which a reader decides. The second half ("the one matching the claimed process") needs a clock→process mapping that no entry supplies. |
| **E4** no-cutoff-hides-work | **S-dropped-reported** (§3) | "Never drop a bucket by size threshold without printing what it dropped" is decidable **only once an entry states `buckets_dropped`/`bucket_threshold`**; no entry does, and inventing a parse format for a field nobody writes would let the check pass vacuously. |
| **E5** body-not-command | **S-heredoc-stripped** (§3) | The *operation* (strip heredocs before classifying) is executable, but the **subject** — the command a record invoked — is not a field any entry carries. Deciding it over prose would be a check answering about a different object. |

**The distinction that decides it:** an executable check's exit code is the *answer*. For E2 and E7 the
exit code is *an input to an argument*. **A number that needs a sentence to become a verdict is not a
gate.** The source report labelled both executable; that label is what this manifest corrects.

---

## 3. Semantic criteria — **no exit-code authority**

A reader decides each of these. **No script's exit code may stand in for the reader's answer**, and a
passing proxy is not a satisfied criterion. Each names the proxy where one exists — the proxy is
evidence the reader may weigh, never a verdict.

| id | criterion | source | question it forces | **authority** | available proxy (not a verdict) |
|---|---|---|---|---|---|
| **S1** | not-double, name the limiter | `principle-explain-the-number` | why is this not 2× — what bounds it? | **no exit code** | ratio computed; the *explanation* is the criterion |
| **S2** | evidence lives with the number | `principle-explain-the-number` | run count, spread, limiter — present? | **no exit code** | fields present; whether they are *sufficient* is judgement |
| **S3** | real artifact, not a proxy | `principle-prove-it-works` | did I read the value, or a representation of it? | **no exit code** | none |
| **S4** | did it even happen / did it error | `benchmark-checklist` q4, q7 | did the work run inside the region I timed? | **no exit code** | exit codes present; whether they cover the region is judgement |
| **S5** | root cause, not symptom | `principle-fix-root-causes` | is the guard at the state that caused it? | **no exit code** | none |
| **S6** | premise, before the third fix | `principle-attack-the-premise` | two fixes failed the same gate — write the shared premise down | **no exit code** | fix count is executable; the *shared premise* is not |
| **S7** | guard vs defect | `principle-fix-root-causes` | is this refusal the system working? | **no exit code** | none |
| **S8** | negotiate the shared target | `principle-separate-before-serializing-shared-state` | two seats, one repo, no protocol — who owns it? | **no exit code** | none |
| **S9** | encode, don't instruct | `principle-encode-lessons-in-structure` | would a lint or field enforce this better than prose? | **no exit code** | none |
| **S-proxy-shape** | scale test, read as judgement | source **E2** | does this gap track a quantity it should not? | **no exit code** | correlation is executable; **"the process name is wrong" is not** |
| **S-clock-named** | a duration names the clock it claims | source **E1** | is this 120 s a measurement, or a threshold in a sentence about one? | **no exit code** | grep for a duration is executable; whether its sentence asserts a measurement is not |
| **S-dropped-reported** | what a threshold dropped is printed | source **E4** | what was excluded, and how much? | **no exit code** | none until entries carry the field |
| **S-heredoc-stripped** | heredoc bodies are not commands | source **E5** | is this line the command, or text inside one? | **no exit code** | none — the invoked head is not a field any entry carries |
| **S-basis-choice** | the classification basis is the right one | source **E6** half | payload, or shape? — and is that the right key for this claim? | **no exit code** | E6 decides naming a role; it cannot decide the better key |
| **S-presence** | presence is not validity | owner seed, `c9559b36` | does the artifact *behave*, or merely *contain the token*? | **no exit code** | token search is executable and **is the defect**: three `mermaid` fences all matched, one failed to render |

### ⚠ S-presence, stated at its full width

A 26,624 B architecture artifact contained **three** `mermaid` fences. Two rendered. The third failed at
`N3` because escaped double quotes are invalid inside a quoted Mermaid label. **A presence search for
`mermaid` passed all three.**

⇒ **Where the criterion is "this artifact is well-formed", the only honest control renders it.** A
search over shape answers a different question and passes. This is why S-presence is semantic with a
named proxy: the renderer is required evidence, and **a render failure is the criterion failing**, not a
proxy disagreeing with it.

---

## 4. Controls — required beside every published figure

**P1 — seed moves the number (mandatory).** Every published figure is accompanied by a run in which a
deliberately wrong input is supplied and the figure is shown to move. **A figure that does not move has
not been shown to be a measurement**; it may be a constant wearing the shape of one.

**P1c — no-op control.** A seed that changes nothing must leave the figure unchanged. Together, P1 and
P1c separate "the instrument responds" from "the instrument responds to *this* input".

⚠ Both are **controls, not criteria**: they cannot gate on their own (§2, E7). A control that passes
proves the instrument moved; **only a reader can say the movement is the right one**.

**P2 — healthy control per criterion.** Every criterion is demonstrated against an instance that
*satisfies* it, so a check that fails everything is distinguishable from a check that discriminates.

---

## 5. Admission, linking, and disposition

| disposition | when | requirement |
|---|---|---|
| **admit** | a mechanism is stated, a falsifier is named, and a control has moved | the entry carries all template fields or an explicit `not-captured` / `not-recoverable` |
| **link** | it is the same mechanism as an existing entry under a different name | the existing entry is named; **no duplicate entry is created** |
| **reject** | proposed but unevaluable, or a restatement of an outcome rather than a mechanism | the reason is recorded, so a future seat does not re-propose it |

⚠ **No pattern is admitted because it was proposed.** A proposal is a candidate; admission is this rule.

⚠ **Measured example: `2026-10-05-legacy-config-not-loaded/`** carries a `README.md` with
`## Observed` and **no criteria block at all** — it predates the template, and the index lists it as an
entry. **It is not currently template-evaluable**, so it cannot be counted among the 118 `metadata.md`
entries. **This is a structural observation, not a verdict on its merit, and not a classification of
the 118** — none of the 118 has been examined for admission yet; that is #42's work.

### Field-level status vocabulary

| value | means |
|---|---|
| `not-captured` | the field exists and the record never held a value for it |
| `not-recoverable` | **the source cannot support the value** — reconstruction would be a guess |
| `not-applicable` | the field does not apply to this entry's kind |

⚠ `attempts_before_success` is `not-recoverable` wherever the transcript did not record attempts.
**Back-filling it from a reconstruction is worse than leaving it empty**, because the empty value is
honest and the reconstructed one is indistinguishable from a measurement.

---

## 6. The procedure, in order

```text
1. NAME the unit and the denominator; print all three census numbers.     (§1)
2. SPLIT designed refusals from defects BEFORE ranking anything.         (S7)
3. DECOMPOSE by transition kind, not by gap size.                        (S-dropped-reported)
4. For every duration, name its clock.                                   (S-clock-named)
5. Check each figure against a quantity it should not track.             (S-proxy-shape)
6. Re-run with a seeded error AND a no-op control.                       (P1, P1c)
7. State what the corpus CANNOT show.                                    (§1, §5)
8. Only then extract a pattern.                                          (admission)
```

---

## 7. What this manifest cannot decide

- **Whether an entry was filled in truthfully.** That is a reader's judgement; the lint says so rather
  than implying otherwise.
- **Whether a mechanism is the right one.** **E3 and E6** — the only two checks that exist — catch a
  specific arithmetic error and a specific classification error. They say nothing about a plausible
  mechanism that happens to be false, and the checks withdrawn in §2b catch nothing at all.
- **Whether the population is the right population.** §1 pins the *definition*; whether the corpus is a
  good sample is not decidable here.
- **Anything about the 120 index rows against 118 metadata files** beyond the fact that they disagree.

---

## 8. Versioning

**Version 1.** The version changes when a criterion is added, removed, or **moved between executable and
semantic** — the last of which is the change most likely to be made silently and is the one with the
most consequence, since it moves a judgement onto an exit code.
