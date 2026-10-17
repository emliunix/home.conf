# Entry template

Copy this into `<date>-<short-mechanism-name>/metadata.md`. **The fields in the criteria block exist so the
criteria in `criteria.md` can be evaluated; a field left as `not captured` is honest, a field guessed is not.**

```markdown
# <the mechanism, in one sentence, as a claim about what went wrong>

**Pattern:** `<kebab-case-name>`
**Seat:** @<who found it> (<what they did>). @<who independently measured/reproduced it>.
**Date:** YYYY-MM-DD <time>Z (found) to YYYY-MM-DD <time>Z (corrected).
**Where:** `#<channel>:<msgid>` — <what the thread was doing>.
**Message locators:** `<id>` (<what it is>), `<id>` (<what it is>).

## Criteria

<!-- The two criteria from criteria.md, evaluated here rather than left implicit. -->

| criterion | value |
|---|---|
| **1 — material_located** | `yes` / `no` / `not captured` |
| **1 — attempts_before_success** | `<n>` / `not captured` |
| **2 — distinct seats cited** | `<n>` — and name them |
| **2 — recurring?** | `structural` (≥3 seats, ≥2 scenarios) / `single-observation` |

## Observed

<What was believed, then what was true. The gap IS the defect. Quote the smallest
reproducible source — a command and its output, a message, a diff — not a paraphrase.>

```text
<the reproduction, with its actual numbers>
```

## Mechanism

<Why it happened, at the level of the instrument or the process. "The count was
wrong" is an outcome; "the predicate matched a line's shape, so entries putting
`cmd:` on its own line were invisible" is a mechanism.>

## Falsifier

<The command or observation that would have caught it. State whether it fired.>

## Correction

<What changed — a doc, a prompt, a skill, a check — or why none is warranted.>

**Disposition:** `fixed` / `recorded` / `open`
<if recorded/open: the lift condition — what would close it>

## Scope

<Where this was measured and what it is evidence about. Say "one project" when
that is the truth; a finding is not general because it feels general.>
```

## Field notes

- **`Seat`** — name the person or agent, and what each did. **If a peer measured something you are citing, say
  so in the entry**, not only in the thread.
- **`Message locators`** — resolve every one before publishing: `raft message read --around <id>`. **A search
  hit is a quotation, not a resolution** — a message's id is metadata its body never contains.
- **`Criteria`** — criterion 1's two fields are the ones no existing entry has. `not captured` is correct when
  the data was never recorded; **do not back-fill from reconstruction.**
- **`Scope`** — a failure observed on one host, one project, or one instrument version is scoped to it until
  reproduced. An entry that reads as general because its sentence is general is a claim neither the author nor
  the reader can check.
