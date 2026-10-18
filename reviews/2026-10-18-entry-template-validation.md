# Proposal — validate an entry against the template, not just the template against the manifest

**Raised by #42's corpus study. Not implemented; this file is the proposal, per @CowBoy's instruction
not to edit entries or land a capture-policy change from the study card.**

`sha256` of the manifest it was measured against: `0cc20f958e0590b3…` (`#41`, accepted).

---

## The finding

**`tests/l0.py` validates the template against the manifest and never validates an entry against the
template.** Every occurrence of "entry" in `l0.py` is inside a docstring; no function opens a
`metadata.md`.

Consequence, measured on the corpus on **2026-10-18** (population **120 entry directories** — and the
corpus grew mid-study, see §Stamps):

| era | entries | with a criteria block | coverage |
|---|---|---|---|
| before `2026-10-17` (pre-template) | 107 | 0 | n/a — not expected of these |
| `2026-10-17` onward | 13 | **9** | **69%** |

**Four entries written after the template existed omit its `## Criteria` block**:

```text
2026-10-17-percentage-re-quoted-on-a-different-denominator
2026-10-17-status-names-its-object-not-its-content
2026-10-17-verification-satisfied-by-its-own-failure
2026-10-17-window-bound-read-as-absence
```

All four use a **third dialect** — bold-label prose (`**Observed:**`, `**Mechanism:**`, 9–19 such
labels) instead of either the template's `## Criteria` table or the older `- **Field:**` list. They are
not careless; they are a *different convention* that nothing checks.

**Three dialects coexist:**

```text
criteria-block        9   post-template, evaluable
bold-label-prose     46   4 post-template + 42 pre-template
dash-field-list      64   pre-template
readme-only           1   2026-10-05-legacy-config-not-loaded
```

⚠ **The 7.5% figure (9/120) is misleading on its own.** It mostly measures **age**, not compliance:
107 of the 120 predate the template. **The number that implicates the capture policy is 9 of 13.**

---

## Why this is the defect the library exists to prevent

`criteria.md` states the rule this proposal turns on:

> **A criterion without a field is a wish.**

The mirror is equally true and unguarded: **a template nothing checks against is a wish.** `l0.py`
proves the *fields* exist in the template; nothing proves an *entry* has them. So the library can
publish a template, lint it thoroughly, and accumulate entries that ignore it — which is the state the
four entries above are in.

---

## Proposed change (bounded)

1. **`l0.py` gains an entry check**, over a corpus path passed explicitly (the library root is not
   inside this package, so it must be a parameter, never a default guess):

   ```text
   python3 tests/l0.py --entries <corpus-root>
   ```

2. **The check is a refusal, not a score.** It exits non-zero when a `metadata.md` dated on or after
   the template's introduction lacks the `## Criteria` block. Entries older than the template are
   **counted and reported, never failed** — retrofitting them is explicitly out of scope.

3. **The template's date is data, not prose.** The check needs to know which entries it may hold to the
   rule. `TEMPLATE_INTRODUCED = 2026-10-17` is a constant with the measured evidence beside it, so a
   future reader can re-derive it from `git log`.

4. **`bold-label-prose` is REJECTED for entries dated on or after `TEMPLATE_INTRODUCED`.**
   **Decided by @CowBoy, 2026-10-18:** *"`## Criteria` is the single admitted form. Do not parse a
   second convention. The four existing entries are evidence of the policy gap, not exceptions that make
   the new check quieter."*

   ⚠ **The four entries are therefore NOT amended by this work.** They stay as written — the evidence of
   the gap — and are counted and reported by the check, never failed and never fixed to make it quiet.

5. **Seeded red required before acceptance.** An entry dated after the template with no criteria block
   must redden by name; one dated before must not. A no-op control confirms the seed moved the bytes.

---

## Status

**Decided and carded.** @CowBoy, 2026-10-18: reject the second dialect; implementation is a separate
card with scope *explicit `--entries <corpus-root>`, post-template-only refusal, old-entry reporting
without failure, seeded red, no-op control*. **This file remains the proposal of record; the card is the
implementation.**

## What this proposal deliberately does not do

- **It does not edit any entry.** The 4 are evidence, not a work queue. **The decision above explicitly
  keeps them unamended.**
- **It does not backfill `partition` or `classification_basis`.** Those are #41's manifest fields and no
  entry carries them; populating them is a prospective capture-policy change, as @CowBoy ruled.
- **It does not choose the dialect — because that decision has been MADE.** See §Status: `## Criteria`
  is the single admitted form, ruled by @CowBoy on 2026-10-18. An earlier draft of this line said the
  choice was still open; it was stale within an hour of being written, which is the same class of defect
  as the rest of this file's subject.

---

## Stamps

**Measurement conditions**, recorded because a corpus figure without them is not reproducible:

```text
date               2026-10-18
population         120 entry directories
                  (+1 appeared at 13:35 the same day — 2026-10-18-reference-to-an-unpublished-object —
                   so any earlier figure of 119 was already stale when written)
index rows         120  (README.md: 122 table lines = header + separator + 120 data)
metadata.md        119  (the 120th is readme-only)
manifest           skills/failure-pattern-library/references/manifest.md @ 0cc20f958e0590b3
```

⚠ **Joinability, corrected:** 105 of 120 entries cite a `channel:msgid` that resolves (`--around`),
14 cite no channel-qualified locator, **0 are unresolvable**, 1 is n/a. An earlier measurement reported
111 unresolvable because it queried the wrong channel, and then 2 because it used the `channel:msgid`
target form — which tests **thread** existence, not **message** existence. Both were instrument errors,
not corpus defects.
