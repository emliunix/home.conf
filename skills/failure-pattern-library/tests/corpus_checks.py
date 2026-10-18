#!/usr/bin/env python3
"""Corpus checks for `references/manifest.md` — the executable half, actually implemented.

⚠ WHY THIS FILE EXISTS (#41 review). The first version of the manifest listed E1 and E3-E6 as
"executable" and named the entry fields they read, but **nothing evaluated any predicate over an
entry**. `l0.py` checked the manifest's own shape; a copy of the corpus with the values set to
`99 / 1` and `role == user` stayed green. **A check that only verifies the check's documentation is
the defect class this lane spent the day on**, so the predicates live here now and each has a seed.

Scope, stated so it is not over-claimed: this reads `metadata.md` fields off entries and decides
**only what those fields say**. It cannot decide whether a field was filled in truthfully.

Usage:  python3 tests/corpus_checks.py [CORPUS]   (default: the general library root's agent-substrate)
        exit 0 = clean, 1 = a defect, 2 = cannot evaluate (a refusal with a reason)
"""
from __future__ import annotations

import pathlib
import re
import sys

FIELD = re.compile(r"^- \*\*(?P<key>[^*]+?):\*\*\s*(?P<value>.*(?:\n(?!- \*\*|\s*$).*)*)", re.M)


def fields(text: str) -> dict[str, str]:
    """`- **Key:** value` pairs, with continuation lines folded in."""
    out: dict[str, str] = {}
    for m in FIELD.finditer(text):
        # Keys normalise spaces to underscores so `- **Classification basis:**` and
        # `classification_basis` are the same key -- the manifest names fields in underscores, the
        # entries write them in prose, and the first version silently looked up the wrong key.
        key = re.sub(r"\s+", "_", m.group("key").strip().lower())
        out[key] = " ".join(m.group("value").split())
    return out


def entries(root: pathlib.Path) -> list[tuple[str, str]]:
    """(name, text) for every directory carrying a `metadata.md`."""
    return [
        (d.name, (d / "metadata.md").read_text(encoding="utf-8"))
        for d in sorted(root.iterdir())
        if d.is_dir() and (d / "metadata.md").is_file()
    ]


failures: list[str] = []
checked: list[str] = []


def check_e3_additivity(name: str, f: dict[str, str]) -> None:
    """E3 — a stated partition must sum to its stated total.

    Reads a `partition` field of the form `a+b+c = total` or `sum / total`. Both sides are parsed as
    integers and compared EXACTLY; a missing field is `not-applicable`, not a pass.
    """
    raw = f.get("partition", "").strip("`").strip()
    if not raw or raw.strip().lower() in ("not captured", "not-applicable", "n/a"):
        return
    m = re.match(r"^([\d+\s]+?)\s*(?:=|/)\s*(\d+)\s*$", raw)
    if not m:
        failures.append(f"E3 {name}: partition {raw!r} is not `a+b = total` or `sum / total`")
        return
    parts = [int(x) for x in re.findall(r"\d+", m.group(1))]
    total = int(m.group(2))
    if sum(parts) != total:
        failures.append(
            f"E3 {name}: partition sums to {sum(parts)} but states total {total} "
            f"({'+'.join(str(p) for p in parts)})"
        )
    checked.append(f"E3 {name}")


# ⚠ E1'S CLOCK-NAME CHECK WAS ATTEMPTED AND WITHDRAWN (#41 review). I implemented it, ran it on the
# corpus, and it flagged 9 durations in three entries -- all of them THRESHOLDS (`>60 s`, `a 120 s
# bound`, the `300-600 s bucket`), not durations anyone claimed to have measured. A regex cannot tell
# "the gap was 120 s" from "an idle bound of 120 s would not have cut it", because the difference is
# whether the sentence is a CLAIM, and that is what a reader decides.
#
# So E1 is SEMANTIC in the manifest (`S-clock-named`), with a stated proxy: the reviewer greps for a
# duration and asks whether its sentence asserts a measurement. Publishing the regex as an executable
# check would have been exactly the sin this review was about -- a check that exists in code and
# answers a different question than the one it is named for.

def check_e6_shape_not_content(name: str, f: dict[str, str]) -> None:
    """E6 — a classification must not key on a field/role NAME when the payload is what matters.

    Executable half: a classification basis that literally names `role`, `type` or `field` is
    decidable. Whether the chosen basis is the right one is `S-basis-choice` (semantic).
    """
    basis = f.get("classification_basis", "").strip("`").strip()
    if not basis:
        return
    # ⚠ THREE BRANCHES, AND ALL THREE ARE TESTED (#41 review 3). The table advertises
    # `role` / `type` / `field name`; the first version only matched the OPERATOR form for `role`
    # plus the `by <x>` form, so `type == human` -- the exact shape-not-content defect this row is
    # named for -- passed. Measured on a temp corpus before the repair: "OK, exit 0".
    #
    # ⚠ And `\b` AFTER the operator never matched at all: a word boundary needs a word character to
    # its left, and `=` is not one. That was review 2's catch, also measured, also green.
    KEY = r"(role|type|field|field[ _]name)"
    operator_form = rf"\b{KEY}\s*(==|===|is|:)\s"
    by_form = rf"\bby\s+{KEY}\b"
    if re.search(operator_form, basis, re.I) or re.search(by_form, basis, re.I):
        failures.append(
            f"E6 {name}: classification basis {basis!r} keys on a record's shape -- "
            "classify by payload and state the inclusion rule"
        )
    checked.append(f"E6 {name}")


def main(argv: list[str]) -> int:
    root = pathlib.Path(argv[1] if len(argv) > 1 else
                        pathlib.Path.home() / "Documents/process-failure-patterns/agent-substrate")
    if not root.is_dir():
        print(f"corpus_checks: {root} is not a directory -- refusing rather than reporting zero")
        return 2
    corpus = entries(root)
    if not corpus:
        # ⚠ AN EMPTY CORPUS IS A REFUSAL (#38's rule, applied here). Zero entries is the state in which
        # every check passes vacuously, which is exactly the false green this file exists to prevent.
        print(f"corpus_checks: no metadata.md under {root} -- refusing rather than passing vacuously")
        return 2
    for name, text in corpus:
        f = fields(text)
        check_e3_additivity(name, f)
        check_e6_shape_not_content(name, f)
    if failures:
        print("corpus_checks: FAILED")
        for line in failures:
            print(f"  - {line}")
        return 1
    # ⚠ ZERO EVALUATIONS IS A REFUSAL, NOT A PASS (#41 review). The checks read opt-in fields that no
    # entry carried when this landed, so "OK (118 entries, 0 evaluations)" was a green line over a
    # population nothing examined -- #38's defect wearing a different hat. A corpus that supplies none
    # of the predicate's inputs is `not-evaluable`, and saying so is the honest outcome.
    if not checked:
        print(
            f"corpus_checks: NOT EVALUABLE ({len(corpus)} entries, 0 predicate evaluations) -- no entry "
            "carries the fields E3/E6 read. This is not a pass: the checks examined nothing."
        )
        return 2
    print(f"corpus_checks: OK ({len(corpus)} entries, {len(checked)} predicate evaluations)")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
