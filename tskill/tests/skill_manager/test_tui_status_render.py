"""The TUI must be able to RENDER every named state, including the new ones.

WHY THIS FILE EXISTS (HorseBoy's F1 on #268, 2026-10-13). `BROKEN` and `MALFORMED` were
added to `SkillStatus`, and the TUI's two presentation tables are indexed DIRECTLY, not
via `.get()`. `MALFORMED` reached the model but not the tables, so the row carrying it
raised `KeyError` — and the population that carries it is the malformed entry this card
exists to stop hiding (`project-reviewer-seat` on the real farm). It was LIVE-REACHABLE,
and the suite could not see it: no test imported the TUI at all, and the 29 tests that
did pass asserted the model, not the render.

The lesson the shape encodes: **a new enum member is a change to every table keyed by
it.** Asserting one member's text would not have caught this — the arm below enumerates
the members from the enum itself, so adding a sixth member reddens without anyone
remembering to extend a list here.
"""

from pathlib import Path

from skill_manager.models import Skill, SkillStatus
from skill_manager.tui import SkillsManagerApp


def _row(status: SkillStatus, reason: str | None = None) -> Skill:
    return Skill(
        name="subject",
        status=status,
        description="",
        source_path=Path("/nonexistent/source"),
        target_path=Path("/nonexistent/target"),
        reason=reason,
    )


def test_design268_status_tables_cover_every_member():
    """The EXHAUSTIVE arm: every member of the enum has a colour and a symbol.

    Enumerated from `SkillStatus`, not typed as a list, so a new member fails here
    instead of crashing on a user's row.
    """
    missing = SkillsManagerApp.missing_status_presentations()
    assert missing == [], (
        f"these SkillStatus members have no TUI presentation and would raise KeyError "
        f"when rendered: {missing}"
    )
    # Non-vacuous: the enum has more than one member, so an empty table would not pass.
    assert len(list(SkillStatus)) > 1


def test_design268_every_member_renders_without_raising():
    """Render every member through the real method — the path that raised."""
    app = SkillsManagerApp.__new__(SkillsManagerApp)  # no Textual app needed for this
    for member in SkillStatus:
        for reason in (None, "no-frontmatter"):
            text = app._get_status_text(_row(member, reason))
            assert str(text).strip() != "", f"{member} rendered as empty text"


def test_design268_malformed_row_names_its_fine_reason():
    """Acceptance 5: the row says WHICH condition, not a bare MALFORMED.

    Four different routes collapse into MALFORMED, so a reader cannot act on the coarse
    state alone.
    """
    app = SkillsManagerApp.__new__(SkillsManagerApp)
    rendered = str(app._get_status_text(_row(SkillStatus.MALFORMED, "no-frontmatter")))
    assert "MALFORMED" in rendered
    assert "no-frontmatter" in rendered, (
        "the fine reason must be VISIBLE on the row -- acceptance 5 names "
        "`filtered(no front matter)` rather than an unqualified malformed"
    )


def test_design268_disposition_matches_the_accounting_vocabulary():
    """`disposition` is the card's vocabulary: valid | broken | filtered(<reason>)."""
    assert _row(SkillStatus.ACTIVE, "valid").disposition == "valid"
    assert _row(SkillStatus.BROKEN, "broken").disposition == "broken"
    assert (
        _row(SkillStatus.MALFORMED, "no-frontmatter").disposition
        == "filtered(no-frontmatter)"
    )
    assert (
        _row(SkillStatus.MALFORMED, "unreadable").disposition == "filtered(unreadable)"
    )
    assert _row(SkillStatus.MALFORMED, "not-a-dir").disposition == (
        "filtered(not-a-dir)"
    )
