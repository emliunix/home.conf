# Seeded-defect census — `failure-pattern-library/tests/l0.py`

**Claim under test:** *the criteria list and the entry template must agree — every criterion names a field the
template asks for, the path rule leads, and **no file in this package** names a project-specific path outside
the general root.*

**One command per run:** `uv run --with pyyaml python tests/l0.py` (exit 0 = clean, 1 = a defect).

| # | clause | seeded defect | result |
|---|---|---|---|
| 1 | **criterion → field** | removed `1 — attempts_before_success` from the template | **RED** — *"criterion 1 … is evaluated from `attempts_before_success`, which entry-template.md's criteria block does not ask for"* |
| 2 | **rule leads** | moved the path rule to the end of `criteria.md` (line 63, past criterion 1 at 19) | **RED** — *"the path rule appears AFTER the first criterion"* |
| 3 | **no project path** (`criteria.md`) | added `~/Documents/<a project>/notes` | **RED** — names the offending path and the permitted form |
| 4 | **criterion is evaluable** | blanked the `evaluable from` cell | **RED** — *"names no 'evaluable from' source"* |
| 5 | **template names both criteria** | removed criterion 2's two rows | **RED** — *"does not ask for criterion 2"* |
| 6 | **frontmatter parses** | an unquoted `: ` inside `description` | **RED** — PyYAML error, plus the missing-key rows |
| 7 | **name matches the directory** | `name: failure-lib` | **RED** — *"`name` is 'failure-lib', expected 'failure-pattern-library'"* |
| 8 | **rule present in `SKILL.md`** | deleted the two rule lines | **RED** — *"the path rule is absent from the skill it governs"* |
| 9 | **no project path** (`SKILL.md`) | added `~/Documents/<a project>/notes` | **RED** — same clause, on the other file |
| **10** | **no project path** — *any file in the package* | planted `~/Documents/<a project>/notes` in **`tests/seeded-defects.md`**, **`README.md`**, and **`CHANGELOG.md`** — three files the pre-amendment clause never opened | **RED** on each, naming the file and the path |

**Control:** with all seeds reverted, the lint is **green** (exit 0). Verified after every seed.

⚠ **The checker exempts itself** (`l0.py` skips `path.name == "l0.py"`), so *"no file in the package"* is
*"no file except the checker"*. It is exempt because its source necessarily contains the general root and
the matching regex as literals — scanning itself would match its own pattern, not a leak. **The exemption is
named here rather than silent, because "every file" would otherwise be a claim the check does not make.**

## Two of my own seeds were invalid, and finding that is the point of running them

- **Seed 2, first attempt:** I moved the rule text with a `str.replace` that re-inserted it at the *same*
  anchor — `changed? True` but the rule landed at **line 12**, still above the table at 19. **The lint was
  right to stay green: the defect was never created.** Redone by moving the rule past the table (line 63),
  which reddened immediately.
- **Seed 8, first attempt:** the replacement target omitted the trailing `.**` on the rule's second line, so
  `str.replace` matched nothing and the run stayed green. **A no-op seed reads exactly like a missed clause.**

**⇒ A seed that does not flip the check has two explanations — a weak check, or a seed that changed nothing —
and they must be told apart before either is reported.** `changed? True` from a string comparison is not
evidence the *file* changed in the way the seed intended.

---

## Manifest clauses (`#41`)

**Two commands per run:**
```text
uv run --with pyyaml python tests/l0.py           l0 clause: manifest <-> template shape
python3 tests/corpus_checks.py [CORPUS]           executable predicates over entries
```

⚠ **The first version of this section was assertions, not receipts**, and its IDs collided with the
table above (both started at 9). Renumbered from the real maximum.

**What each row actually records:** the clause, the exact mutation, the observed output, and the exit
code. **It does not record a per-row baseline and restored hash** — an earlier draft claimed it did,
which is the same overclaim these receipts exist to prevent.

⚠ **AND THE FILE-LEVEL BASELINE ITSELF WAS STALE ONCE.** An earlier version of this section named
`manifest.md ca8703a6…` as both the before and after hash; the manifest was then edited (the
tool-label rule in §1), so that line no longer described the bytes under review. **A receipt whose subject
moved is not a receipt.** The hashes below were taken from the final bytes, and the three seeds below
were re-run against exactly those bytes.

**File-level baseline — the bytes under review**
```text
$ shasum -a 256 references/manifest.md references/entry-template.md tests/l0.py tests/corpus_checks.py
0cc20f958e0590b3f1d858cafe189c526fef5f82e7633e3ea528e192672ade5a  references/manifest.md
8424a88b4431922811248b6c3ffec579d89cddbd8ba4c8f09367929444edd4d8  references/entry-template.md
031c815f9a7a44dd82de0b2a912b7445ecaf843231f03d0333e8fc11b0664cc7  tests/l0.py
4b2ba6b54292005eab0582855cd6a155676deb1ac2bf64440014107ef9150e28  tests/corpus_checks.py
```

**Seeds re-run against that baseline, then restored — hashes identical afterwards**
```text
$ cp references/manifest.md /tmp/B_man.md ; cp references/entry-template.md /tmp/B_tmpl.md

# S15 — a criterion in both tables
$ python3 -c "...replace('| **E6** | shape-not-content','| **S3** | shape-not-content')"
$ uv run --with pyyaml python tests/l0.py
  - manifest.md: S3 appears in BOTH the executable and the semantic tables -- a criterion has exactly one authority
  exit 1
$ cp /tmp/B_man.md references/manifest.md

# S18 — an executable check names a missing field
$ python3 -c "...replace('`classification_basis` |','`made_up_field` |')"
$ uv run --with pyyaml python tests/l0.py
  - manifest.md: executable check '**E6**' reads `made_up_field`, which entry-template.md does not ask for -- add the field or label the check semantic
  exit 1
$ cp /tmp/B_man.md references/manifest.md

# S19 — the template loses a field the manifest reads
$ python3 -c "...replace('| **E3 — additivity** | `partition` |','| **E3 — additivity** | `part_sum` |')"
$ uv run --with pyyaml python tests/l0.py
  - manifest.md: executable check '**E3**' reads `partition`, which entry-template.md does not ask for -- add the field or label the check semantic
  exit 1
$ cp /tmp/B_tmpl.md references/entry-template.md

$ shasum -a 256 references/manifest.md references/entry-template.md | cut -c1-16
0cc20f958e0590b3        <- identical to the baseline above
8424a88b44319228        <- identical to the baseline above
```

**The no-op control is that last comparison**: after every seed was undone, the hashes match the baseline
exactly, so a green `l0.py` reflects unchanged bytes rather than a silently unapplied edit.

| # | clause | mutation | observed output | exit |
|---|---|---|---|---|
| **15** | one authority per criterion | in `manifest.md`, rewrote executable row `E6` as `S3` | `manifest.md: S3 appears in BOTH the executable and the semantic tables` | **1** |
| **16** | authority is a cell, not prose | blanked the `authority` header cell | `manifest.md: the semantic table has no 'authority' column` | **1** |
| **17** | a semantic criterion denies exit authority | set S1's authority to `exit 0 on pass` | `semantic criterion '**S1**' does not deny exit-code authority ('exit 0 on pass')` | **1** |
| **18** | an executable check names a real field | pointed E6 at `made_up_field` | `executable check '**E6**' reads 'made_up_field', which entry-template.md does not ask for` | **1** |
| **19** | the template keeps what the manifest reads | removed E3's field from the template | `executable check '**E3**' names no template field` | **1** |
| **20** | **E3 discriminates** | entry with `Partition: 5+6 = 10` | `E3 e: partition sums to 11 but states total 10 (5+6)` | **1** |
| **21** | **E6 discriminates — `role`** | entry with `Classification basis: role == user` | `E6 e: classification basis 'role == user' keys on a record's shape` | **1** |
| **21b** | **E6 — `type`** | `Classification basis: type == human` | `keys on a record's shape` | **1** |
| **21c** | **E6 — `field`** | `Classification basis: field == x` | `keys on a record's shape` | **1** |
| **21d** | **E6 — `field name`** | `Classification basis: field name == x` | `keys on a record's shape` | **1** |
| **21e** | **E6 — `by <x>` form** | `Classification basis: by role` / `by type` / `by field name` | `keys on a record's shape` | **1** each |
| **21f** | **E6 converse** | `Classification basis: payload` | `OK (1 entries, 2 predicate evaluations)` | **0** |
| **22** | a correct entry passes | `Partition: 5+6 = 11`, `Classification basis: payload` | `OK (1 entries, 2 predicate evaluations)` | **0** |
| **23** | an empty corpus refuses | `mkdir` an empty dir | `no metadata.md under /tmp/s2 -- refusing rather than passing vacuously` | **2** |
| **24** | no-op control | left all four files byte-identical | hashes above unchanged; `cmp` confirms nothing moved | **0** |

⚠ **Rows 21b–21f exist because the review found the table was advertising more than the code did.**
The row said a basis naming `role`/`type`/`field name` is rejected; the code rejected the `role`
operator form and the `by <x>` form **but passed `type == human`** — measured, exit 0. The table
advertised three branches and the code decided one and a half. **The predicate now covers all three
under both forms, and each is a separate row** so a future narrowing reddens a named seed.

⚠ **Row 21 is why seeds must be run, not written.** The first E6 pattern was
`\brole\s*(==|is)\b` — and `\b` after the operator requires a word character on the left of `==`,
which `=` is not. **The seed stayed GREEN against the defect it was written for.** The pattern now
matches the operator without a trailing boundary. A receipt that says "RED" without the command is how
that goes unnoticed.

---

## Entry validation (`#45`)

**The gap this closes:** `l0.py` validated the template against the manifest and **never opened an
entry**. `#42` measured the consequence — 4 of 13 entries written on or after `TEMPLATE_INTRODUCED`
carried no `## Criteria` block and nothing noticed.

**Command** (the entry path is explicit; there is no default):
```text
uv run --with pyyaml python tests/l0.py --entries <corpus-root>
```

**TEMPLATE_INTRODUCED evidence** — `2026-10-17`, commit `25416563`:
```text
$ git log -S"## Criteria" --oneline -- skills/failure-pattern-library/references/entry-template.md
25416563 feat(skill): add failure-pattern-library, with criteria that a template can evaluate
$ git merge-base --is-ancestor 25416563 origin/main   ->  yes
```

**Baseline** `l0.py` = `e62c0b5c9c2097b4`

| # | clause | mutation | observed | exit |
|---|---|---|---|---|
| **25** | a post-template entry without `## Criteria` fails by name | fixture `2026-10-18-post-no-criteria` with bold-label prose | `entry 2026-10-18-post-no-criteria: dated 2026-10-18 (on/after TEMPLATE_INTRODUCED 2026-10-17, 25416563) but has no admitted `## Criteria` block` | **1** |
| **26** | a pre-template entry does NOT fail | same entry renamed `2026-09-20-…` | `OK`; counter reads "1 pre-template (reported, never failed)" | **0** |
| **27** | the admitted form passes | same entry given a `## Criteria` block | `OK` | **0** |
| **28** | no-op control | fixture restored to its baseline bytes (`32e9d115…`) | red returns — the two greens above were the seeds, not the absence of a check | **1** |

⚠ **Seeds 26 and 27 are the discriminating pair.** A check that only ever reddens has not been shown to
discriminate; 26 proves the **date** is what fails rather than the entry's mere presence, and 27 proves
the **block** is what passes rather than the rename.

**The real corpus (`#45` step 5) — the expected evidence, not a gate to suppress:**
```text
$ uv run --with pyyaml python tests/l0.py --entries ~/Documents/process-failure-patterns/agent-substrate
l0 entries: 120 total -- 13 post-template, 107 pre-template (reported, never failed), 0 undated; 4 post-template without `## Criteria`
  - entry 2026-10-17-percentage-re-quoted-on-a-different-denominator: ...
  - entry 2026-10-17-status-names-its-object-not-its-content: ...
  - entry 2026-10-17-verification-satisfied-by-its-own-failure: ...
  - entry 2026-10-17-window-bound-read-as-absence: ...
exit 1
```
Those four are the `#42` finding; they are left unamended here by @CowBoy's ruling and by `#46`'s scope.

### Entry validation — revision 2 (`#45` review)

⚠ **These rows were missing from the first push.** The seeds were run and reported in chat, **but the
receipt was never committed** — and a chat description is not a durable receipt. @CowBoy caught it by
diffing the commit, which is the correct way to catch it.

**Baseline** `l0.py` = `464c355471e3d227`
**Command** — every row, with only the fixture path varying:
`uv run --with pyyaml python skills/failure-pattern-library/tests/l0.py --entries <fixture>`

| # | clause | fixture | observed (named) | exit |
|---|---|---|---|---|
| **29** | post-template entry without `## Criteria` fails by name | `2026-10-18-x/metadata.md` in bold-label prose | `entry 2026-10-18-x: dated 2026-10-18 (on/after TEMPLATE_INTRODUCED 2026-10-17, 25416563) but has no admitted \`## Criteria\` block` | **1** |
| **30** | **the date is what fails it, not its presence** | the SAME entry renamed `2026-09-19-x` | `OK`; counter reads "1 pre-template (reported, never failed)" | **0** |
| **31** | **the block is what passes it, not the rename** | the SAME entry given a `## Criteria` block | `OK` | **0** |
| **32** | an undated entry is refused, not skipped | `undated-entry/metadata.md` in bold-label prose | `entry undated-entry: directory name does not begin with a canonical YYYY-MM-DD- date…` | **1** |
| **33** | an empty directory is refused, not counted | `empty-dir/` with no files | `--entries …: 1 directory/ies but no entry -- refusing rather than passing vacuously over an empty corpus` | **1** |
| **34** | a date-shaped name that is not a date | `2026-02-30-x/` (impossible day) | `entry 2026-02-30-x: the leading YYYY-MM-DD is not a real calendar date…` | **1** |
| **35** | no-op control | all fixtures removed; corpus unchanged | `OK`, and the real-corpus run below is unchanged | **0** |

⚠ **30 and 31 are the discriminating pair.** Each changes ONE property of the failing entry: 30 the
name's date, 31 the presence of the block. A check that only ever reddens has not been shown to
discriminate; these two are what turn 29 from a red mark into a measurement.

⚠ **34 exists because `^\d{4}-\d{2}-\d{2}-` is a SHAPE, not a date.** It accepted `2026-02-30` and
`2026-13-45`; both then compared lexicographically, so **an impossible date silently chose which rule
applied** (`2026-13-45` sorted post-template, `2026-02-30` pre-template). Measured before the fix:
exit 0 for both. It is now validated with `datetime.date.fromisoformat`.

**Real corpus after every fix (the expected evidence, unsuppressed):**
```text
l0 entries: 120 total -- 13 post-template, 107 pre-template (reported, never failed),
            0 undated, 0 invalid-date, 0 empty directory/ies;
            4 post-template without \`## Criteria\`      ->  exit 1
```

### Same-day boundary (`#45` rev 5)

```text
TEMPLATE_INTRODUCED       2026-10-17          (date -- the entry's own datum, from its directory name)
TEMPLATE_INTRODUCED_AT    2026-10-17T11:07:33Z (the template commit's author time)
```

⚠ **A directory name carries only a date, so a same-day entry cannot be classified from its name.** Two
entries dated `2026-10-17` were written before the template existed, each provable from its own content:

| entry | evidence |
|---|---|
| `status-names-its-object-not-its-content` | own `Date:` line — `09:28Z to 09:40Z` |
| `window-bound-read-as-absence` | cited `223e4fba`, `7350d082`, `0c79bb54` resolve at `10:01–10:02Z` |

**Baseline** `l0.py` = `0ea75c008dd533da`

| # | clause | fixture | observed | exit |
|---|---|---|---|---|
| **36** | a listed same-day exception passes | `2026-10-17-status-names-…` in bold-label prose | `OK`; counter reads "1 same-day pre-template exception(s)" | **0** |
| **37** | an UNLISTED same-day entry still fails | `2026-10-17-unlisted-entry` | `entry 2026-10-17-unlisted-entry: dated 2026-10-17 (on/after …) but has no admitted \`## Criteria\` block` | **1** |
| **38** | an earlier pre-template entry passes | `2026-09-01-old-entry` | `OK`; counted as excluded by age | **0** |

**36 and 37 are the pair that matters**: the exception list is *closed*, so the same date passes one
entry and fails another **only because of the name**, which is what the list is for.

**Real corpus, the expected evidence:**
```text
l0 entries: 120 total -- 11 post-template, 107 pre-template (reported, never failed),
            2 same-day pre-template exception(s), 0 undated, 0 invalid-date, 0 empty;
            2 post-template without \`## Criteria\`      ->  exit 1
```
**11 / 107 / 2**, not 13 / 107: the two exceptions moved out of the failing population, and #46's target
list is the two that remain.

⚠ **ON mtime, so the next reader does not reach for it.** It is sound in ONE direction only:
```text
FORWARD  last-write BEFORE the boundary  =>  PROVES the file predates it            sound
REVERSE  last-write AFTER  the boundary  =>  touched after; edit or late creation?  silent
```
Measured: 8 pre-template entries have late mtimes and **none** of them is evidence — `2026-09-29-split-
wrong-total-right` is late (`2026-10-18 12:17`) because an `## Instance 2` section was added to it
today. mtime could have admitted the two exceptions and could not have excluded those 8, and it is not
owned by the corpus, so the validator does not use it.

⚠ **A check I wrote and removed:** "the exception list is stale". It could not be made to fire — a listed
name whose date moved off the boundary is simply not in `boundary`, and the entry is then judged
normally with the correct outcome either way. **Removed rather than kept with a seed invented to reach
it.**
