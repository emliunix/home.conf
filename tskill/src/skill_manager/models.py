"""Data models for skill manager."""

from dataclasses import dataclass
from enum import Enum
from pathlib import Path


class SkillStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    UNMANAGED = "unmanaged"
    # A link in the target farm whose resolved target does not exist. It must be a NAMED
    # state rather than an absence: the entry is visibly there and cannot be followed,
    # which is exactly the condition the enumeration must report instead of dropping.
    BROKEN = "broken"
    # Present in the farm but not usable as a skill: no SKILL.md, unreadable, or
    # frontmatter
    # without both `name` and `description`. Named so it is ACCOUNTED for rather than
    # silently filtered -- the same disappearance by a different route.
    MALFORMED = "malformed"


@dataclass
class Skill:
    name: str
    status: SkillStatus
    description: str
    source_path: Path
    target_path: Path | None = None
    # The FINE reason the enumeration assigned, as `_classify` names it
    # (`no-frontmatter`, `no-skill-md`, `unreadable`, `not-a-dir`, `broken`, `valid`).
    # `status` collapses four of those into MALFORMED, so without this a reader cannot
    # tell WHICH condition put a row in the list -- and acceptance 5 asks for exactly
    # that distinction (`filtered(no front matter)` rather than a bare `malformed`).
    reason: str | None = None

    @property
    def disposition(self) -> str:
        """The row's disposition in the accounting vocabulary.

        ⚠ THE FORMS ARE DERIVED, NOT LISTED. Two earlier drafts of this docstring
        each undercounted them (three, then six) — the same defect one level down.
        What the property actually returns:

            the raw status, for any row whose status is not BROKEN and whose
            `reason` is None or "valid":
                                valid | inactive | unmanaged | malformed
            "broken",          for a BROKEN row or a row whose reason is "broken"
            "filtered(<r>)",   for any other named reason

        `filtered(...)` therefore has one form per reason in `SkillManager.REASONS`. The
        union is 10 values today; enumerating `SkillStatus` against `REASONS` reproduces
        it, and that is how the count should be checked rather than restated here.

        Measured on the real farm — 4 of the 10 occur: `valid 67 · unmanaged 14 ·
        inactive 6 · filtered(no-frontmatter) 1`.

        No PRODUCT code reads this — only the test suite does. Kept because it is the
        name acceptance 5 asks for (`filtered(no front matter)`).
        """
        if self.status == SkillStatus.BROKEN or self.reason == "broken":
            return "broken"
        if self.status == SkillStatus.ACTIVE:
            return "valid"
        if self.reason in (None, "valid"):
            return str(self.status.value)
        return f"filtered({self.reason})"
