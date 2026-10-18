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
MANIFEST = ROOT / "references" / "manifest.md"

# The only path form the guidance may contain. Anything else shaped like a home-directory
# path is a machine-specific literal, which is the defect the lead rule prevents.
GENERAL_ROOT = "~/Documents/process-failure-patterns/<project>/"

failures: list[str] = []
entries_root: pathlib.Path | None = None


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


def manifest_tables(text: str) -> tuple[list[dict], list[dict]]:
    """The manifest's executable and semantic tables, as rows keyed by header.

    The manifest supersedes criteria.md for the corpus study (#41), so the same property must hold
    there: an executable criterion that names no template field is a wish wearing an exit code.
    """
    executable: list[dict] = []
    semantic: list[dict] = []
    section = None
    header = None
    for line in text.splitlines():
        if line.startswith("## "):
            section = line[3:].strip()
            header = None
            continue
        if not line.strip().startswith("|"):
            header = None
            continue
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if header is None:
            if any(c.strip("*` ").lower() in ("id", "criterion") for c in cells):
                # Normalise emphasis so `**authority**` and `authority` are the same key.
                header = [c.strip("*` ") for c in cells]
            continue
        if all(set(c) <= set("-: ") for c in cells):
            continue
        if len(cells) != len(header):
            continue
        row = dict(zip(header, cells))
        if section is not None and section.startswith("2."):
            executable.append(row)
        elif section is not None and section.startswith("3."):
            semantic.append(row)
    return executable, semantic


def check_manifest_split() -> None:
    """⚠ A semantic criterion must never appear in the executable table, and vice versa.

    This is the manifest's own central claim: the split IS the instrument. A criterion that moved
    between the tables is the change most likely to be made silently and with the most consequence,
    because it moves a judgement onto an exit code.
    """
    if not MANIFEST.exists():
        failures.append("manifest.md: missing -- the corpus study (#41) has no manifest to apply")
        return
    executable, semantic = manifest_tables(MANIFEST.read_text(encoding="utf-8"))
    if not executable:
        failures.append("manifest.md: no executable table found under section 2")
    if not semantic:
        failures.append("manifest.md: no semantic table found under section 3")

    exec_ids = {row.get("id", "").strip("*` ") for row in executable} - {""}
    sem_ids = {row.get("id", "").strip("*` ") for row in semantic} - {""}
    both = exec_ids & sem_ids
    if both:
        failures.append(
            "manifest.md: " + ", ".join(sorted(both)) + " appears in BOTH the executable and the "
            "semantic tables -- a criterion has exactly one authority"
        )

    # ⚠ THE MARKER MUST BE STRUCTURAL, NOT PROSE (#41). A criterion's authority is a cell, not a
    # phrase somewhere in the row: checking for words in free text is the "wrong control" this
    # manifest exists to refuse. A semantic row must carry an `authority` cell saying so, and an
    # executable row must not add one (its authority is the exit code, which the section implies).
    if semantic and "authority" not in semantic[0]:
        failures.append(
            "manifest.md: the semantic table has no `authority` column -- a criterion's authority "
            "must be a cell, so it cannot be inferred from prose"
        )
        return
    # ⚠ THE TEST IS "DENIES AUTHORITY", NOT "MENTIONS EXIT" (#41). The first version tested
    # `"exit" in authority`, which is true of the CORRECT value `no exit code` -- a check that
    # reddens on the right answer and passes on `exit 3`. It has to read the negation.
    for row in semantic:
        authority = row.get("authority", "").strip("*` ").lower()
        denies = authority.startswith("no ") or "no exit" in authority or "none" in authority
        if not denies:
            failures.append(
                f"manifest.md: semantic criterion {row.get('id', '?')!r} does not deny exit-code "
                f"authority ({authority!r}) -- a semantic criterion cannot gate, and silence here "
                "reads as permission"
            )
    # ⚠ EVERY EXECUTABLE CHECK MUST NAME THE TEMPLATE FIELD IT READS (#41). This is `criteria.md`'s
    # own rule extended to the manifest: "a criterion without a field is a wish". The corpus checks
    # read fields off entries, so an executable check over a field no entry carries cannot be applied
    # to the corpus at all -- it can only be described.
    if executable and "evaluated from" not in executable[0]:
        failures.append(
            "manifest.md: the executable table has no `evaluated from` column -- an executable "
            "check that names no field cannot be applied to the corpus"
        )
        return
    entry_fields = TEMPLATE.read_text(encoding="utf-8")
    for row in executable:
        named = re.findall(r"`([a-z_]+)`", row.get("evaluated from", ""))
        if not named:
            failures.append(
                f"manifest.md: executable check {row.get('id', '?')!r} names no template field"
            )
            continue
        for field in named:
            if field not in entry_fields:
                failures.append(
                    f"manifest.md: executable check {row.get('id', '?')!r} reads `{field}`, which "
                    "entry-template.md does not ask for -- add the field or label the check semantic"
                )

    if executable and "authority" in executable[0]:
        failures.append(
            "manifest.md: the executable table declares an `authority` column -- an executable "
            "criterion's authority IS its exit code and must not be restated"
        )


# ⚠ TEMPLATE_INTRODUCED IS DATA WITH GIT EVIDENCE, NOT A DATE SOMEONE REMEMBERED (#45).
#
#   $ git log -S"## Criteria" --oneline -- skills/failure-pattern-library/references/entry-template.md
#   25416563 feat(skill): add failure-pattern-library, with criteria that a template can evaluate
#   $ git log -1 --format="%H %ad" --date=short 25416563
#   2541656309f8a03d0be0aa4176149252f60647e2 2026-10-17
#   $ git merge-base --is-ancestor 25416563 origin/main   ->  yes
#
# Before this date the admitted form did not exist, so an entry lacking it is EVIDENCE OF AGE, not of a
# capture-policy failure. The check counts those and never fails them.
# The template commit's author time is the real boundary; the calendar date is the classification unit
# because it is the ENTRY's own datum and the only one a directory name carries.
TEMPLATE_INTRODUCED = "2026-10-17"
TEMPLATE_INTRODUCED_AT = "2026-10-17T11:07:33Z"

# ⚠ SAME-DAY BOUNDARY EXCEPTIONS -- EXPLICIT, EVIDENCED, AND CLOSED (#45 rev 5).
#
# A directory name carries only a calendar date, so a same-day entry cannot be classified from its name.
# These two were WRITTEN BEFORE the template existed and each says so in its own content. They are named
# here rather than inferred, because every automatic route to their write time is unsound:
#
#   ⚠ NOT mtime. It is not owned by the corpus and changes under copies and checkouts. It is sound in
#      ONE direction only: a last-write BEFORE the boundary proves the file predates it, and that is
#      what admitted these two. A last-write AFTER proves NOTHING -- an edit and a late creation look
#      identical. Measured: 8 pre-template entries have late mtimes, and one (`2026-09-29-split-wrong-
#      total-right`, mtime 2026-10-18 12:17) is late because an `## Instance 2` section was added to it
#      today. So mtime could have admitted these two and could NOT have excluded the 8.
#
#   ⚠ NOT the entry's own time tokens. Three of the four same-day entries carry no parseable write time,
#      and one of them cites three message ids that would need a LIVE `raft message read` -- turning a
#      corpus-only validator into one with a network dependency.
#
# ⚠ THIS LIST IS CLOSED. A same-day entry NOT named here is post-template and fails. Adding a name
# requires new evidence of the same kind, in this comment, not a looser predicate.
# ⚠ THE EVIDENCE STRINGS ARE CREATION ANNOUNCEMENTS, NOT "CONTENT BEFORE THE BOUNDARY" (#45, @GameBoy).
#
# My first version said window-bound was proved by "cited 223e4fba, 7350d082, 0c79bb54 resolve at
# 10:01-10:02Z". That is wrong in two ways, and he measured both:
#
#   1. THOSE TIMES ARE NOT IN THE FILE. `grep -cE '[0-9]{2}:[0-9]{2}'` on that entry returns 0. I got
#      them from a LIVE `raft message read` -- the exact network dependency the paragraph above rejects.
#      The stated admission standard used the instrument it disclaims.
#   2. AND THE DIRECTION IS WRONG ANYWAY. A message the entry CITES was sent at 10:02Z, so the ENTRY
#      was written AT OR AFTER 10:02Z -- a LOWER bound. Neither can yield "before 11:07:33Z". Content
#      bounds an entry's write time from below, never from above.
#
# The sound instrument is a stored fact: the message that ANNOUNCED each entry's creation. An entry that
# was announced at T existed by T, which is a genuine UPPER bound and requires no live read.
#
# ⚠ AND THE ANNOUNCEMENT MUST SAY THE ENTRY WAS WRITTEN. My first correction used msg `c815c16d`
# (09:40:31Z) for status-names on the strength of its opening line; @CowBoy read it and it announces
# *taking* an entry -- "one library entry I am taking" -- not writing one. **Taking is a claim of
# ownership; writing is the fact this list needs.** The creation announcement is `35d8ffbf` (09:47:25Z),
# seven minutes later, which says "Library entry written" and names the directory.
#
# ⚠ EACH ID CARRIES ITS ENCLOSING THREAD, because a bare msgid is NOT resolvable on its own (@GameBoy):
# a channel-level `--target "<channel>" --around <id>` returns "Message not found" for a THREAD REPLY, so
# a reader must already know the thread. Worse, the entry's own `Where:` is not always it -- the
# window-bound entry names `dd9129ce`, while its creation announcement lives in `1be8d1a9`. So
# `(@<thread>)` follows each id here; a reader can then resolve without searching, and searching for a
# msgid is exactly the "a hit is a quotation, not a resolution" trap these entries warn about.
#
# ⚠ THE GENERAL RULE, since two attempts got this wrong: **entry content and cited locators bound write
# time FROM BELOW; only a stored creation announcement bounds it FROM ABOVE.** Neither a Date line nor a
# cited message id can establish "before the template" -- they establish "at or after" whatever they name.
SAME_DAY_PRE_TEMPLATE = {
    "2026-10-17-status-names-its-object-not-its-content":
        "creation announced at 2026-10-17T09:47:25Z (msg 35d8ffbf @73892fbc: 'Library entry written'), "
        "before 11:07:33Z",
    "2026-10-17-window-bound-read-as-absence":
        "creation announced at 2026-10-17T10:46:42Z (msg 42a4129f @1be8d1a9: 'The -A window entry is "
        "written'), before 11:07:33Z",
}
TEMPLATE_INTRODUCED_COMMIT = "2541656309f8a03d0be0aa4176149252f60647e2"


def entry_records(root: pathlib.Path) -> list[dict]:
    """Every entry directory under `root`, with the facts the entry check needs.

    ⚠ THE CORPUS PATH IS EXPLICIT AND HAS NO DEFAULT (#45). The library lives outside this package, so
    guessing its location would make the check pass by finding nothing -- the vacuous-green shape.
    """
    out: list[dict] = []
    for d in sorted(p for p in root.iterdir() if p.is_dir()):
        # ⚠ A DIRECTORY MUST DECLARE ITSELF BY NAME (#45 review). `entry_records` used to put a no-date
        # directory into NEITHER `post` nor `pre`, and `check_entries` only printed the aggregate
        # `undated` count -- so a malformed or new entry in bold-label prose SILENTLY EVADED the one
        # refusal this check adds. Measured before the fix: 2 undated entries, exit 0.
        #
        # The date prefix is the entry's own claim about which rule it is held to; an entry that does
        # not make the claim cannot be checked, and cannot be skipped.
        # ⚠ A SHAPE IS NOT A DATE (#45 review 2). `^\d{4}-\d{2}-\d{2}-` accepted `2026-02-30` and
        # `2026-13-45`; both then compared lexicographically and were classified as ordinary entries --
        # `2026-13-45` as POST-template and `2026-02-30` as PRE-template, so an impossible date silently
        # chose which rule applied. Measured before the fix: exit 0 for both.
        #
        # A date-shaped string is not a date, which is this package's whole subject one level down: the
        # ENTRY's name has to be evidence, not just a shape that matched.
        m = re.match(r"^(\d{4}-\d{2}-\d{2})-", d.name)
        dated = None
        if m:
            try:
                import datetime
                datetime.date.fromisoformat(m.group(1))
                dated = m.group(1)
            except ValueError:
                out.append({"name": d.name, "date": None, "kind": "invalid-date"})
                continue
        md = d / "metadata.md"
        readme = d / "README.md"
        if not md.is_file() and not readme.is_file():
            # ⚠ AND AN EMPTY SUBDIRECTORY IS NOT AN ENTRY. Counting it made "one empty directory" look
            # like a populated corpus, which defeats the empty-corpus refusal.
            out.append({"name": d.name, "date": dated, "kind": "empty-directory"})
            continue
        if not md.is_file():
            out.append({"name": d.name, "date": dated, "kind": "readme-only"})
            continue
        text = md.read_text(encoding="utf-8")
        admitted = re.search(r"^##\s+Criteria\s*$", text, re.M) is not None
        out.append({"name": d.name, "date": dated, "kind": "admitted" if admitted else "unadmitted"})
    return out


def check_entries(root: pathlib.Path) -> None:
    """Refuse a post-template entry that is not in the admitted `## Criteria` form (#45).

    ⚠ ONE ADMITTED DIALECT. @CowBoy's ruling, 2026-10-18: "`## Criteria` is the single admitted form.
    Do not parse a second convention. The four existing entries are evidence of the policy gap, not
    exceptions that make the new check quieter." So `bold-label-prose` is NOT parsed here; an entry
    carrying it is unadmitted and fails if it is new enough to have known better.
    """
    if not root.is_dir():
        failures.append(f"--entries {root}: not a directory -- refusing rather than reporting zero")
        return
    records = entry_records(root)
    if not records:
        failures.append(f"--entries {root}: no entry directories -- refusing rather than passing vacuously")
        return
    # ⚠ EVERY DIRECTORY IS CLASSIFIED, AND EVERY REFUSAL IS NAMED (#45 review). The previous version
    # silently ignored `undated` and `empty-directory`, so both were ways past the gate.
    undated = [r for r in records if r["date"] is None and r["kind"] != "invalid-date"]
    invalid = [r for r in records if r["kind"] == "invalid-date"]
    empty = [r for r in records if r["kind"] == "empty-directory"]
    real = [r for r in records if r["kind"] != "empty-directory"]
    if not real:
        failures.append(
            f"--entries {root}: {len(empty)} directory/ies but no entry -- refusing rather than "
            "passing vacuously over an empty corpus"
        )
        return
    for r in invalid:
        failures.append(
            f"entry {r['name']}: the leading YYYY-MM-DD is not a real calendar date -- a date-shaped "
            "name is not a date, and cannot choose which rule applies"
        )
    for r in undated:
        failures.append(
            f"entry {r['name']}: directory name does not begin with a canonical YYYY-MM-DD- date, so "
            "the entry cannot be held to either rule -- rename it to claim a date"
        )
    for r in empty:
        failures.append(f"entry {r['name']}: carries neither metadata.md nor README.md -- not an entry")
    # ⚠ A STALE LIST ENTRY IS SILENTLY CORRECT, SO NO CHECK IS WRITTEN FOR IT (#45 rev 5).
    # I first wrote a "the exception list is stale" failure and could not make it fire: a listed name
    # whose date moved off the boundary is simply NOT in `boundary`, so the list clause never sees it,
    # and the entry is then judged normally -- as a post-template entry it must pass like any other, and
    # as an unadmitted one it fails by name. Both outcomes are already right.
    # The dead check was removed rather than kept with a seed invented to reach it.
    boundary = [r for r in records
                if r["name"] in SAME_DAY_PRE_TEMPLATE and r["date"] == TEMPLATE_INTRODUCED]
    # ⚠ A COUNT DOES NOT TELL A READER WHICH ENTRIES ESCAPED THE GATE (#45 rev 6). The ordinary
    # pre-template population stays aggregate -- 107 lines would bury the signal -- but a BOUNDARY
    # exception is a decision this file made about a specific entry, and a reader must be able to see
    # which entry and on what evidence. One named line each.
    for r in sorted(boundary, key=lambda x: x["name"]):
        print(f"l0 boundary exception: {r['name']} (dated {r['date']}) -- {SAME_DAY_PRE_TEMPLATE[r['name']]}")

    post = [r for r in records
            if r["date"] is not None and r["date"] >= TEMPLATE_INTRODUCED
            and r["name"] not in SAME_DAY_PRE_TEMPLATE]
    pre = [r for r in records if r["date"] is not None and r["date"] < TEMPLATE_INTRODUCED]
    bad = [r for r in post if r["kind"] != "admitted"]
    for r in bad:
        failures.append(
            f"entry {r['name']}: dated {r['date']} (on/after TEMPLATE_INTRODUCED {TEMPLATE_INTRODUCED}, "
            f"{TEMPLATE_INTRODUCED_COMMIT[:8]}) but has no admitted `## Criteria` block"
        )
    # Pre-template entries are REPORTED, never failed: they are evidence of age, not of a failure.
    print(
        f"l0 entries: {len(records)} total -- {len(post)} post-template, {len(pre)} pre-template "
        f"(reported, never failed), {len(boundary)} same-day pre-template exception(s), "
        f"{len(undated)} undated, {len(invalid)} invalid-date, "
        f"{len(empty)} empty directory/ies; "
        f"{len(bad)} post-template without `## Criteria`"
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


def main(argv: list[str]) -> int:
    global entries_root
    # ⚠ EXPLICIT CORPUS PATH ONLY (#45). `--entries <root>` is the ONLY entry-validation path; there is
    # no default, because a guessed path that happens not to exist would make every entry check pass by
    # finding nothing, which is the vacuous green this package exists to refuse.
    entries_root = None
    if "--entries" in argv:
        i = argv.index("--entries")
        if i + 1 >= len(argv):
            print("l0: --entries requires a corpus path")
            return 64
        entries_root = pathlib.Path(argv[i + 1]).expanduser().resolve()
    check_frontmatter()
    check_criteria_have_fields()
    check_manifest_split()
    if entries_root is not None:
        check_entries(entries_root)
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
    sys.exit(main(sys.argv[1:]))
