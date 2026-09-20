# report-style — furniture design, r2 (2026-09-20)

**What this is.** The package `report-style` is a `SKILL.md` and nothing else. This design gives it the
furniture the eleven `visflow-*` packages carry, per `flow-skills-eval/design/03-skill-package-format.md`.
**r2 is the round-1 review's output**: two seats, ten findings, every one reproduced by the lead
(`worklog/report-style-review/{kimi-k3,glm-5.3,round-1-adjudication}.md`). A design is the cheap place to
lose an unscoreable trial; two of the ten would have done exactly that.

## Why this skill is not the same as the eleven

The `visflow-*` skills produce **records**: files whose acceptance is structural (a path, a row, a cell).
`report-style` produces **prose in two shapes** — a `record` and a `brief` — so its hardest problem is the
**production oracle**: what counts as a written artifact being *accepted*, when a checklist over prose is
close to self-grading.

## What gets added

```
skills/report-style/
  SKILL.md            # exists (two variants, one rule); unchanged
  README.md           # NEW - philosophy + the dimensions this skill is tested on + maintenance
  CHANGELOG.md        # NEW - one row per change, with the finding behind it
  tests/
    DESIGN.md         # this file
    rubric.yaml       # NEW - dimensions -> rubrics -> items, each naming its flipping defect
    cases/
      trigger.yaml    # NEW - canonical / trap / paraphrase triplets, each citing a SKILL.md line
      production.yaml # NEW - the brief and record tasks as triplets, with the oracle's patterns
    frozen.lock.json  # NEW - SHA-256 of SKILL.md, README.md, CHANGELOG.md and every case file
```

**Mode 644 on every file**, `tests/DESIGN.md` included (it shipped 600; the same class `5e6e296` fixed for
`SKILL.md`).

## Profiles (from the spec)

- **smoke — L0 + trigger.** L0 is the lint, one command: `python3 tests/l0.py` (the frontmatter parses;
  every rubric item names a flipping defect; every case cites a `SKILL.md` line; the pinned sources exist).
  Then the trigger triplets. Runs on any edit to the package.
- **full — all dimensions**, all triplets, plus the frozen-lock assertion and the production case.

## The pinned source material (production case) — r2, corrected

**r1 claimed the material "contains every element the brief demands". That was overstated**: `grep` over
`taskboard-v3/` finds no *per-region state* framing (the correction in the material is
*"the frontier is a scheduling width, not an in-flight set"*, `evaluate/parallelism-1.md:30-33`), and
`obligation` / `contrast` appear **zero times** in the four evaluates. r2 pins a set and names which file
carries which element; an element with no home is **cut from the rubric**, not assumed.

| element | carried by |
|---|---|
| frame / premise correction | `taskboard-v3/evaluate/parallelism-1.md:30-33` |
| the formal object (σ, `R`, `O`, P8) | `graph-ir-v3.md` — *Configuration*, *Properties that change* |
| the mechanism | `taskboard-v3/src/taskboard_v3/runner.py` (`start_effects`, per-landing `barrier_check`, `run_one_control`) |
| measurements / status tags | the four `evaluate/parallelism-*.md` headline verdicts |
| obligations | `theory.md` §3 (T1–T3 with their obligations separated) and §4 |
| contrasts | `architecture.md` §15 (*"child workflows per arm are the outer relation"*); the batch model as the alternative in `parallelism-1.md` |
| boundary / residuals | `parallelism-3.md` and `parallelism-4.md`, *What it does not establish* |

**Not in the set, and therefore not tested**: the conversation-level framing *"does a region fork the
world?"* — it is not citable from the tree, so no rubric item turns on it.

## The production oracle — r2, specified

- **The mechanical half** is scored by a script over the produced text (`production.yaml` names the
  patterns): a status tag per claim, a contrast pair, a closing **boundary** paragraph, the nine elements in
  order, and for the record resolving keys. A **word count** is recorded here too (the induction arm reads
  it) rather than scored as transfer.
- **The prose half** is scored by **two blinded judges**, each seeing the two arms anonymised and order
  **swapped** between them, with a **pre-registered** rubric (per axis: *A better / tie / B worse* — three
  axes: warrant visibility, contrast usefulness, boundary honesty). The fence covers greps: a judge given
  the answer key is not a judge.
- **Aggregation and pass bar**: full must be **strictly better on ≥2 of 3 axes and never worse on any**; a
  tie is decoration; judges who disagree on a **fact** go to the lead to reproduce, not to an average
  (**never averaged**, the `visflow-evaluate` rule).
- **No self-grading**: a subject that writes and scores its own brief measures nothing.

## Items — r2

| dimension | rubric | arms | items (id — the defect that flips it) |
|---|---|---|---|
| **trigger** | selection | entry-only | `T-SELECT` (a distractor is selected instead); `T-SILENT` (an excluded shape fires); `T-VARIANT` (a **brief** request fails to select the skill because the vocabulary says "report") |
| **trigger** | generalisation | entry-only | `T-TRAP` (the *review* case dressed in this skill's vocabulary fires); `T-PARA` (the same case without the vocabulary stays silent — **red when silence depends on the clause wording appearing in the task**) |
| **procedure** | record | full | `P-RECORD-ORDER` (abstract written last; description keyed; legend's three tables; links verified); `P-RECORD-KEY` (a fact without a resolving key) |
| **procedure** | brief | full | `P-BRIEF-ELEMENTS` (the nine elements in order); `P-BRIEF-BOUNDARY` (the closing paragraph is a summary, not a boundary) |
| **procedure** | subtraction | full | `P-SUBTRACT` (an element that restates a neighbour survives) |
| **comprehension** | warrant | full | `C-WARRANT` (**mechanical**: the full arm's output carries a status tag for every claim — a rule the skill prints, so it is checked on the output, not re-taught); `C-VARIANT` (a reader picks the wrong shape for a task) |
| **production** | brief / record acceptance | control, full, full-minus-boundary | `R-BRIEF` (a brief from the pinned set lacks a status tag, a contrast pair, or a boundary paragraph); `R-RECORD` (a record whose keys do not resolve) |
| **induction** | cost | control, full, full-minus-boundary | `I-COST` (the full arm produces no shorter, no more warrant-visible brief for the same material — the word count is mechanical, the transfer judgment is the judges') |
| **ablation** | brief elements | full, full-minus-one-element | `A-ELEMENT` (an element whose removal changes nothing is decoration and is deleted); `A-UNPRICED` (an element the trial never exercised is recorded unpriced, not deleted) |

## Trigger cases — r2

| kind | task | expected | cites |
|---|---|---|---|
| canonical | write a peer brief explaining how parallelism is achieved in `taskboard-v3` | fires | `SKILL.md:3-7` (the Use clause names both shapes) |
| canonical | write the record for this round from the decisions log | fires | `SKILL.md:4-5` |
| trap | *"polish this paragraph for me and cut the AI tells"* | silent | `SKILL.md:8` (*"Not for prose polish"*) |
| trap | *"review this report and tell me what is wrong with it"* | silent | `SKILL.md:8` — the clause *"not for reviewing someone else's report"* was **added after the trigger trial**, where route 2 fired `visflow-evaluate` and route 1 stayed silent; the exclusion is now explicit rather than incidental |
| trap | *"the evidence is already in `decisions.tsv` — write me a record of it"* | silent | `SKILL.md:8-9` (*"not for a record whose evidence is already enumerated elsewhere"*) |
| paraphrase | *"turn my notes into a write-up a colleague can follow"* | fires | `SKILL.md:3-7` without the vocabulary |
| distractor probe | *"teach me how the frontier works"* / *"unslop this"* | those skills, not this one | — (moved out of the trap set: they test other surfaces' territory, not this skill's exclusions) |

## Flag decision (settled by the trial)

`report-style` is model-invocable today — verified: it has **no** `disable-model-invocation`, while
`teach`, `technical-writing` and `unslop` (all at `pstack/pstack/skills/`, not in home.conf) each carry it;
**no home.conf package carries the flag**.

**Settled 2026-09-20 by the trigger trial** (`worklog/report-style-trials/round-1.md`, two routes): prose
polish stayed silent on both routes, so the flag is not needed for `T1`; the review case **fired
`visflow-evaluate` on route 2 and stayed silent on route 1**, so the description gained the explicit clause
*"not for reviewing someone else's report"* rather than the surface being hidden. **No flag is added** — the
defect was a missing exclusion, not excessive visibility, and hiding the surface would have removed the six
must-fire tasks that passed on both routes. The review trap is re-run on both routes after this clause
lands, as the confirmation.

## Review dispositions (r1 → r2)

| r1 defect | disposition |
|---|---|
| source census overstated (glm F1) | fixed: a named set with a carrier per element; the uncitable framing is excluded from the test |
| oracle underspecified (kimi F2, glm F5) | fixed: judges, axes, order-swap, fence on greps, aggregation, pass bar, no averaging |
| `C-WARRANT` re-tests the printed rule (kimi F3) | rewritten as a mechanical check on the full arm's output |
| `T-PARA` unparseable (glm F2) | claim and red condition separated |
| traps uncitable (kimi Q4, glm F3) | re-scoped with citations; two demoted to a distractor probe; one made explicit by a description edit after the trigger trial |
| L0 lint missing (kimi Q6, glm F4) | added as the smoke profile's first half, and it is the landing check |
| `production.yaml` not triplets; no citations (glm F4) | rewritten as triplets with `SKILL.md` lines |
| `I-COST` mis-grounded (glm Q1) | word count mechanical; transfer judged |
| flag citations, mode 600 (kimi F1, glm F4) | pstack paths named; every file 644 |
