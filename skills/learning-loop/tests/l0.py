#!/usr/bin/env python3
"""Deterministic package checks for learning-loop."""

from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

import yaml


ROOT = Path(__file__).resolve().parents[1]
FAILURES: list[str] = []


def load_yaml(path: Path) -> object:
    try:
        return yaml.safe_load(path.read_text())
    except Exception as exc:
        FAILURES.append(f"{path.relative_to(ROOT)}: invalid YAML: {exc}")
        return {}


skill_text = (ROOT / "SKILL.md").read_text()
frontmatter_match = re.match(r"\A---\n(.*?)\n---\n", skill_text, re.DOTALL)
if not frontmatter_match:
    FAILURES.append("SKILL.md: missing frontmatter")
else:
    frontmatter = yaml.safe_load(frontmatter_match.group(1))
    if set(frontmatter) != {"name", "description"}:
        FAILURES.append("SKILL.md: frontmatter must contain only name and description")
    if frontmatter.get("name") != "learning-loop":
        FAILURES.append("SKILL.md: wrong name")

for reference in ("concern-catalog.md", "routing.md", "transfer-checks.md"):
    if f"references/{reference}" not in skill_text:
        FAILURES.append(f"SKILL.md: does not link references/{reference}")

rubric = load_yaml(ROOT / "tests/rubric.yaml")
item_count = 0
for dimension in rubric.get("dimensions", {}).values():
    for rubric_entry in dimension.get("rubrics", []):
        for item in rubric_entry.get("items", []):
            item_count += 1
            if not item.get("red_when"):
                FAILURES.append(f"tests/rubric.yaml: {item.get('id')} has no red_when")

case_count = 0
for case_path in sorted((ROOT / "tests/cases").glob("*.yaml")):
    case = load_yaml(case_path)
    for triplet in case.get("triplets", []):
        for kind in ("canonical", "trap", "paraphrase"):
            entry = triplet.get(kind, {})
            case_count += 1
            cite = entry.get("cites", "")
            match = re.match(r"SKILL\.md:(\d+)(?:-(\d+))?", cite)
            if not match:
                FAILURES.append(f"{case_path.relative_to(ROOT)}: {kind} has no SKILL.md line citation")
                continue
            last = int(match.group(2) or match.group(1))
            if last > len(skill_text.splitlines()):
                FAILURES.append(f"{case_path.relative_to(ROOT)}: citation exceeds SKILL.md")

fixture_count = len(list((ROOT / "tests/fixtures").glob("*.md")))
if fixture_count < 2:
    FAILURES.append("tests/fixtures: rich and low-learning fixtures are required")

lock_path = ROOT / "tests/frozen.lock.json"
if lock_path.exists():
    lock = json.loads(lock_path.read_text())
    for relative, expected in lock.get("files", {}).items():
        path = ROOT / relative
        if not path.exists():
            FAILURES.append(f"tests/frozen.lock.json: missing {relative}")
        elif hashlib.sha256(path.read_bytes()).hexdigest() != expected:
            FAILURES.append(f"tests/frozen.lock.json: digest drift for {relative}")

if FAILURES:
    raise SystemExit("\n".join(FAILURES))

print(f"frontmatter: parsed | rubric items: {item_count} | cited trigger cases: {case_count} | fixtures: {fixture_count}")
