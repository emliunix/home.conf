#!/usr/bin/env python3
"""L0 lint for failure-pattern-library: the criteria list and the template must agree.

The failure this exists for, measured on a live library of 109 entries:

  Two criteria were proposed for the library -- "could not locate the material, or
  more than two failed attempts" and "the alike pattern recurs across many agents".
  Back-filling them found that the first was **unenforceable**: `10` entries mention
  "attempt" and **`0` record a number**, because the entry template had no field for
  it. A criterion whose field does not exist is not a criterion -- it is a wish, and
  nothing can tell whether it is satisfied.

So this checks the two files against each other, which is the property no prose can hold:

  1. SKILL.md's frontmatter parses and carries `name` and `description`.
  2. **Every criterion in `references/criteria.md` declares the field(s) that
     evaluate it, and each named field appears in `references/entry-template.md`.**
     This is the whole point: the list cannot grow a rule nothing can check.
  3. Every field named in `criteria.md`'s "evaluable from" column resolves to a row
     in the template's criteria block.
  4. **The path rule is the LEAD of `criteria.md`**, not a note further down -- and
     NO FILE IN THIS PACKAGE names a project-specific path outside the general root,
     including this lint's own test record. The rule governs the guidance, so the
     guidance AND everything shipped beside it is checked.
  5. The template's criteria block names both criteria, so an entry cannot be written
     that silently omits one.

What it cannot see: whether an entry was filled in truthfully. That is a reader's
judgement, and this lint says so rather than implying otherwise.

Usage:  python3 tests/l0.py          (exit 0 = clean, 1 = a defect)
Run from the package root. Dependency-free apart from PyYAML.
"""

from __future__ import annotations

import pathlib
import re
import sys

try:
    import yaml
except ImportError:  # pragma: no cover
    print("l0: PyYAML is required for the frontmatter check")
    sys.exit(2)

ROOT = pathlib.Path(__file__).resolve().parent.parent
SKILL = ROOT / "SKILL.md"
CRITERIA = ROOT / "references" / "criteria.md"
TEMPLATE = ROOT / "references" / "entry-template.md"

# The only path form the guidance may contain. Anything else shaped like a home-directory
# path is a machine-specific literal, which is the defect the lead rule prevents.
GENERAL_ROOT = "~/Documents/process-failure-patterns/<project>/"

failures: list[str] = []


def frontmatter(text: str) -> dict:
    m = re.match(r"^---\n(.*?)\n---\s*$", text, re.S | re.M)
    if not m:
        failures.append("SKILL.md: no YAML frontmatter block")
        return {}
    try:
        data = yaml.safe_load(m.group(1))
    except yaml.YAMLError as e:
        failures.append(f"SKILL.md: frontmatter is not valid YAML: {e}")
        return {}
    return data or {}


def check_frontmatter() -> None:
    data = frontmatter(SKILL.read_text(encoding="utf-8"))
    for key in ("name", "description"):
        if not isinstance(data.get(key), str) or not data.get(key, "").strip():
            failures.append(f"SKILL.md: frontmatter is missing a non-empty `{key}`")
    if data.get("name") and data["name"] != "failure-pattern-library":
        failures.append(
            f"SKILL.md: `name` is {data['name']!r}, expected 'failure-pattern-library' "
            "(the directory name is what a loader resolves)"
        )


def criteria_rows(text: str) -> list[dict]:
    """Rows of criteria.md's table, as dicts keyed by the header names."""
    rows: list[dict] = []
    header: list[str] | None = None
    for line in text.splitlines():
        if not line.strip().startswith("|"):
            header = None
            continue
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if header is None:
            # `criterion` is the SECOND cell (`# | criterion | kind | evaluable from`),
            # so match the header by any cell -- the first version tested cells[0] only,
            # which is `#`, and reported "no criteria table" for a table that was there.
            if any("criterion" in c.lower() for c in cells):
                header = cells
            continue
        if all(set(c) <= set("-: ") for c in cells):
            continue  # the separator row
        if len(cells) == len(header):
            rows.append(dict(zip(header, cells)))
    return rows


def template_fields(text: str) -> set[str]:
    """Field names the template's criteria block asks an entry to fill in."""
    block = re.search(r"## Criteria(.*?)(?=\n## |\Z)", text, re.S)
    if not block:
        return set()
    # The template's format is `| **<n> — <label>** |` where the label may be a phrase
    # (`distinct seats cited`) and may end in `?`. The first version required a
    # lowercase-underscore label, so it missed criterion 2's two fields entirely.
    return set(re.findall(r"\*\*(\d+ — [^*]+?)\*\*", block.group(1)))


def check_criteria_have_fields() -> None:
    text = CRITERIA.read_text(encoding="utf-8")
    rows = criteria_rows(text)
    if not rows:
        failures.append("criteria.md: no criteria table found")
        return
    fields_in_template = template_fields(TEMPLATE.read_text(encoding="utf-8"))
    if not fields_in_template:
        failures.append(
            "entry-template.md: no criteria block -- a template without the fields "
            "cannot make any criterion evaluable"
        )
        return
    for row in rows:
        criterion = row.get("criterion", "")
        evaluable = row.get("evaluable from", "")
        if not evaluable:
            failures.append(
                f"criteria.md: criterion {criterion!r} names no 'evaluable from' source "
                "-- an unevaluable criterion is the defect this lint exists for"
            )
            continue
        # Each backticked field in the 'evaluable from' cell must exist in the template.
        named = re.findall(r"`([a-z_]+)`", evaluable)
        for field in named:
            if not any(field in f for f in fields_in_template):
                failures.append(
                    f"criteria.md: criterion {criterion!r} is evaluated from `{field}`, "
                    f"which entry-template.md's criteria block does not ask for"
                )


def check_lead_rule() -> None:
    crit = CRITERIA.read_text(encoding="utf-8")
    skill = SKILL.read_text(encoding="utf-8")
    # The rule must appear before any criterion is stated.
    rule_at = crit.lower().find("no specific project")
    first_criterion = crit.find("**1**")
    if rule_at < 0:
        failures.append("criteria.md: the path rule is absent")
    elif first_criterion > 0 and rule_at > first_criterion:
        failures.append(
            "criteria.md: the path rule appears AFTER the first criterion; it is the lead, "
            "so it must precede the list it constrains"
        )
    if "no specific project" not in skill.lower():
        failures.append("SKILL.md: the path rule is absent from the skill it governs")
    # No project-specific home path may appear ANYWHERE in the package -- not only in the
    # two files the rule is written in. Measured 2026-10-17: this lint's first version
    # read SKILL.md and criteria.md only, and its own `tests/seeded-defects.md` shipped a
    # real project path in a worked example of the very rule that forbids one. A rule
    # enforced on the guidance but not on the package that carries it is half a rule.
    for path in sorted(ROOT.rglob("*")):
        if not path.is_file() or path.name == "l0.py":
            continue
        try:
            body = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        for m in re.finditer(r"~/Documents/([A-Za-z0-9._-]+)", body):
            found = m.group(0)
            if not found.startswith("~/Documents/process-failure-patterns"):
                rel = path.relative_to(ROOT)
                failures.append(
                    f"{rel}: names a project-specific path {found!r}; guidance may name "
                    f"only the general root {GENERAL_ROOT}"
                )


def check_template_names_both_criteria() -> None:
    fields = template_fields(TEMPLATE.read_text(encoding="utf-8"))
    for n in ("1", "2"):
        if not any(f.startswith(f"{n} —") for f in fields):
            failures.append(
                f"entry-template.md: the criteria block does not ask for criterion {n}, "
                "so an entry could be written that silently omits it"
            )


def main() -> int:
    check_frontmatter()
    check_criteria_have_fields()
    check_lead_rule()
    check_template_names_both_criteria()
    if failures:
        print("l0: failure-pattern-library is inconsistent:")
        for f in failures:
            print(f"  - {f}")
        return 1
    print("l0: failure-pattern-library OK (every criterion names a field the template asks for)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
