#!/usr/bin/env python3
"""The smoke profile's first half: lint the artifact before measuring it.

A loadability failure has causes that look identical from a subject - a wrong install root, a session that
started before the install, and a file no loader can parse. This checks the parse and the instrument's own
internal consistency, cheapest first, and says plainly what it cannot see.

Checks:
  1. SKILL.md's frontmatter parses and carries a `name` and a `description`.
  2. Every rubric item names the defect that flips it (`red_when`).
  3. Every case cites a real `SKILL.md` line.
  4. The pinned production sources exist (skipped, not failed, when the visflow tree is absent).

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
    lines = (ROOT / "SKILL.md").read_text().count("\n") + 1
    n = 0
    for path in sorted((ROOT / "tests" / "cases").glob("*.yaml")):
        doc = yaml.safe_load(path.read_text())
        for t in doc.get("triplets", []):
            for arm in ("canonical", "trap", "paraphrase"):
                cite = (t.get(arm) or {}).get("cites", "")
                m = re.search(r"SKILL\.md:(\d+)(?:-(\d+))?", cite)
                if not m:
                    failures.append(f"{path.name}/{t.get('behavior')}/{arm}: no SKILL.md line cite")
                    continue
                last = int(m.group(2) or m.group(1))
                if last > lines:
                    failures.append(f"{path.name}/{t.get('behavior')}/{arm}: cites SKILL.md:{last} "
                                    f"but the file has {lines} lines")
                n += 1
    return n


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
    pins = check_pins()
    print(f"frontmatter: parsed | rubric items: {items} | cited cases: {cases} | pins: {pins}")
    if failures:
        print(f"L0 FAIL - {len(failures)} defect(s):")
        for f in failures:
            print(f"  - {f}")
        return 1
    print("L0 PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
