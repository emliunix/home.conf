#!/usr/bin/env python3
"""The smoke profile's first half: lint the artifact before measuring it.

A loadability failure has causes that look identical from a subject - a wrong install root, a session that
started before the install, and a file no loader can parse. This checks the parse and the instrument's own
internal consistency, cheapest first, and says plainly what it cannot see.

Checks:
  1. SKILL.md's frontmatter parses and carries a `name` and a `description`.
  2. Every rubric item names the defect that flips it (`red_when`).
  3. Every case cites a real `SKILL.md` location, and that location says what the case
     claims it says. A line-number cite is checked for range; an anchor cite
     (`SKILL.md#some-heading`) is resolved against the headings in SKILL.md.
  4. Every linked report-kind reference exists and carries its four routing sections.
  5. The pinned production sources exist (skipped, not failed, when the visflow tree is absent).

Usage:  python3 tests/l0.py          (exit 0 = lint clean, 1 = a defect)
Dependency-free apart from PyYAML; run from the package root.
"""

from __future__ import annotations

import pathlib
import re
import sys

try:
    import yaml
except ImportError:  # pragma: no cover
    print("l0: PyYAML is required for the frontmatter and case checks")
    sys.exit(2)

ROOT = pathlib.Path(__file__).resolve().parent.parent
VISFLOW = pathlib.Path.home() / "Documents" / "visflow"
failures: list[str] = []


def skill_anchors(skill_text: str) -> set[str]:
    """GitHub-style heading slugs for SKILL.md, the targets a `SKILL.md#anchor` cite uses."""
    anchors: set[str] = set()
    for line in skill_text.splitlines():
        m = re.match(r"^#{1,6}\s+(.*?)\s*$", line)
        if not m:
            continue
        slug = m.group(1).lower()
        slug = re.sub(r"[^a-z0-9 _-]", "", slug)
        slug = slug.strip().replace(" ", "-")
        anchors.add(slug)
    return anchors


def check_frontmatter() -> None:
    text = (ROOT / "SKILL.md").read_text()
    m = re.match(r"^---\n(.*?)\n---\n", text, re.S)
    if not m:
        failures.append("SKILL.md: no parseable frontmatter block")
        return
    try:
        fm = yaml.safe_load(m.group(1))
    except yaml.YAMLError as exc:
        failures.append(f"SKILL.md: frontmatter is not valid YAML: {exc}")
        return
    for key in ("name", "description"):
        if not fm.get(key):
            failures.append(f"SKILL.md: frontmatter has no `{key}`")


def check_rubric() -> int:
    rub = yaml.safe_load((ROOT / "tests" / "rubric.yaml").read_text())
    n = 0
    for dim, d in rub["dimensions"].items():
        for rb in d["rubrics"]:
            for item in rb["items"]:
                n += 1
                if not item.get("red_when"):
                    failures.append(f"rubric item {item.get('id')}: no `red_when` - an item that cannot "
                                    f"name the defect that flips it is a property claim and must say so")
    return n


def check_cases() -> int:
    """A case's `cites` must point at a real location in SKILL.md.

    A cite must be `SKILL.md#anchor` (resolved against the headings) or the literal
    `SKILL.md frontmatter`. Line-number cites (`SKILL.md:N-M`) are REFUSED: they drift
    silently when a section moves, and the range check cannot tell that they now point at
    unrelated text. That is the defect this check carries from the 2026-10-05 rewrite,
    where every production and trigger cite still named the pre-rewrite line numbers and
    the lint stayed green.
    """
    skill_text = (ROOT / "SKILL.md").read_text()
    anchors = skill_anchors(skill_text)
    n = 0
    for path in sorted((ROOT / "tests" / "cases").glob("*.yaml")):
        doc = yaml.safe_load(path.read_text())
        for t in doc.get("triplets", []):
            for arm in ("canonical", "trap", "paraphrase"):
                cite = (t.get(arm) or {}).get("cites", "")
                anchor = re.search(r"SKILL\.md#([a-z0-9-]+)", cite)
                if anchor:
                    # The anchor must name a heading that exists. This is the fix for the
                    # defect the line-range check carried: a rewrite moves every section,
                    # line numbers stay IN RANGE while pointing at the wrong text, and the
                    # lint stays green. An anchor either resolves or it does not.
                    if anchor.group(1) not in anchors:
                        failures.append(
                            f"{path.name}/{t.get('behavior')}/{arm}: cites SKILL.md#{anchor.group(1)} "
                            f"but SKILL.md has no such heading "
                            f"(have: {', '.join(sorted(anchors))})"
                        )
                    n += 1
                    continue
                if "SKILL.md frontmatter" in cite:
                    n += 1
                    continue
                failures.append(
                    f"{path.name}/{t.get('behavior')}/{arm}: cite is neither an anchor nor the "
                    f"frontmatter - line-number cites drift silently when a section moves; "
                    f"use SKILL.md#<heading>. Got: {cite!r}"
                )
                n += 1
    return n


def check_references() -> int:
    references = ROOT / "references"
    catalog = references / "catalog.md"
    if not catalog.is_file():
        failures.append("references/catalog.md: missing report-kind catalog")
        return 0

    skill_text = (ROOT / "SKILL.md").read_text()
    if "references/catalog.md" not in skill_text:
        failures.append("SKILL.md: does not route through references/catalog.md")

    catalog_text = catalog.read_text()
    paths = sorted(references.glob("*-report.md"))
    required_headings = ("## Use when", "## Aspects", "## Chronology", "## Common failures")
    for path in paths:
        if f"({path.name})" not in catalog_text:
            failures.append(f"references/catalog.md: no link to {path.name}")
        text = path.read_text()
        for heading in required_headings:
            if heading not in text:
                failures.append(f"{path.relative_to(ROOT)}: missing `{heading}`")
    return len(paths)



def check_decision_subtemplate() -> int:
    """The decision-request subtemplate and its acceptance ids must exist together."""
    text = (ROOT / "references" / "decision-report.md").read_text()
    rub = yaml.safe_load((ROOT / "tests" / "rubric.yaml").read_text())
    ids: list[str] = []
    for dimension in rub["dimensions"].values():
        for rubric in dimension["rubrics"]:
            if rubric["id"] == "decision-request":
                ids = [item["id"] for item in rubric["items"]]
    if not ids:
        failures.append("tests/rubric.yaml: no `decision-request` rubric")
        return 0
    if "## Decision-request subtemplate" not in text:
        failures.append("references/decision-report.md: no `## Decision-request subtemplate` "
                        "- the DR-* acceptance items have no stated fields")
    for item_id in ids:
        if item_id not in text:
            failures.append(f"references/decision-report.md: the subtemplate does not name {item_id}")
    return len(ids)


def check_pins() -> str:
    prod = ROOT / "tests" / "cases" / "production.yaml"
    pins = (yaml.safe_load(prod.read_text()) or {}).get("pins", [])
    if not VISFLOW.is_dir():
        return f"skipped ({len(pins)} pins) - the visflow tree is not present"
    missing = [p for p in pins if not (VISFLOW / p).exists()]
    for p in missing:
        failures.append(f"production pin does not exist: {p}")
    return f"{len(pins)} pins, {len(missing)} missing"


def main() -> int:
    check_frontmatter()
    items = check_rubric()
    cases = check_cases()
    references = check_references()
    subtemplate = check_decision_subtemplate()
    pins = check_pins()
    print(
        f"frontmatter: parsed | rubric items: {items} | cited cases: {cases} | "
        f"report kinds: {references} | subtemplate ids: {subtemplate} | pins: {pins}"
    )
    if failures:
        print(f"L0 FAIL - {len(failures)} defect(s):")
        for f in failures:
            print(f"  - {f}")
        return 1
    print("L0 PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
