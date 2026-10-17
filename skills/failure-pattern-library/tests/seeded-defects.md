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
