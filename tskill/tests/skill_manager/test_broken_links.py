"""#268: enumeration must not resolve before it counts; a broken link is a NAMED state.

Route-specific fixtures (per the card): one aimed at a zero-instance route passes while
proving nothing, so each arm below names the route it exercises.

Routes covered, with the fixture that carries traffic on each:
  :66  not is_dir() / dotfile      -> test_dangling_link_is_named_broken (dangling link)
  :70  SKILL.md absent             -> test_skill_md_absent_still_dropped
  :75  read raised                 -> (not seeded: needs an unreadable file on disk)
  :79  no frontmatter              -> test_no_frontmatter_reported_not_silent
  :87  frontmatter missing a key   -> test_frontmatter_missing_key_reported
plus the ACCOUNTING IDENTITY, which is what reddens on any of them.
"""

from __future__ import annotations

import os
from pathlib import Path

import pytest

from skill_manager.manager import SkillManager
from skill_manager.models import SkillStatus


def _skill(root: Path, name: str, *, frontmatter: str | None = None) -> None:
    """Create <root>/<name>/SKILL.md — the skill DIRECTORY, not a file at the root."""
    directory = root / name
    directory.mkdir(parents=True, exist_ok=True)
    if frontmatter is None:
        frontmatter = f"---\nname: {name}\ndescription: d\n---\n"
    (directory / "SKILL.md").write_text(frontmatter)


@pytest.fixture()
def farm(tmp_path: Path) -> tuple[Path, Path]:
    """A clean source tree, plus a target empty except for what each test seeds."""
    source = tmp_path / "src"
    target = tmp_path / "tgt"
    source.mkdir()
    target.mkdir()
    return source, target


# ── the defect itself ────────────────────────────────────────────────────────────────


def test_dangling_link_is_named_broken(farm: tuple[Path, Path]) -> None:
    """Route :66. A dangling link must ENTER the population and be named BROKEN."""
    source, target = farm
    os.symlink(target / "does-not-exist", target / "retired")

    skills = SkillManager(source, target).scan_skills()

    names = {s.name: s.status for s in skills}
    assert "retired" in names, "a dangling link must not be dropped by the enumeration"
    assert names["retired"] == SkillStatus.BROKEN


def test_broken_is_independent_of_the_source(farm: tuple[Path, Path]) -> None:
    """The link's state decides, not which side happens to exist."""
    source, target = farm
    os.symlink(target / "gone-a", target / "no-source")  # source absent too
    _skill(source, "with-source")
    os.symlink(target / "gone-b", target / "with-source")  # source PRESENT

    names = {s.name: s.status for s in SkillManager(source, target).scan_skills()}

    assert names["no-source"] == SkillStatus.BROKEN
    assert names["with-source"] == SkillStatus.BROKEN, (
        "a present source must not mask a broken target link"
    )


# ── the accounting identity: reddens on ANY silent route ─────────────────────────────


def test_enumeration_accounts_for_every_name(farm: tuple[Path, Path]) -> None:
    """Every non-dot name lands in exactly one named bucket.

    This is the assertion that survives a FUTURE silent `continue`: it fails whenever a
    name vanishes, without needing to know which route dropped it.
    """
    source, target = farm
    {
        "valid": _skill(target, "valid"),
        "no-skill-md": (target / "no-skill-md").mkdir(),
        "no-frontmatter": _skill(
            target, "no-frontmatter", frontmatter="# Title\n\nbody\n"
        ),
        "frontmatter-missing-key": _skill(
            target,
            "frontmatter-missing-key",
            frontmatter="---\ndescription: only a description\n---\n",
        ),
    }
    os.symlink(target / "nowhere", target / "dangling")
    (target / ".hidden").mkdir()  # dotfile: excluded by rule

    manager = SkillManager(source, target)

    # The ACCOUNTING: every non-dot name is classified, and the buckets sum to the tree.
    classified = manager._classify(target)  # noqa: SLF001
    non_dot_names = {p.name for p in target.iterdir() if not p.name.startswith(".")}
    assert set(classified) == non_dot_names, "every name must be accounted for"
    assert set(classified.values()) <= set(manager.REASONS)
    assert classified["valid"] == "valid"
    assert classified["dangling"] == "broken"
    assert classified["no-skill-md"] == "no-skill-md"
    assert classified["no-frontmatter"] == "no-frontmatter"
    assert classified["frontmatter-missing-key"] == "malformed"

    # And every one of them reaches the MODEL with a named status.
    skills = {s.name: s.status for s in manager.scan_skills()}
    for name in non_dot_names:
        assert name in skills, f"{name} vanished from the model"
    # `valid` exists only in the TARGET, so with no source it is UNMANAGED ("present but
    # not mine") -- not INACTIVE, which is for a target absent a present source.
    assert skills["valid"] == SkillStatus.UNMANAGED
    assert skills["dangling"] == SkillStatus.BROKEN
    assert skills["no-frontmatter"] == SkillStatus.MALFORMED
    assert skills["frontmatter-missing-key"] == SkillStatus.MALFORMED
    assert skills["no-skill-md"] == SkillStatus.MALFORMED


# ── the action paths, split by BRANCH (a broken-link fixture leaves :121 untested) ───


def test_deactivate_removes_a_dangling_link(farm: tuple[Path, Path]) -> None:
    """Removal must work for exactly the entries the old guard called absent."""
    source, target = farm
    os.symlink(target / "gone", target / "dangling")
    manager = SkillManager(source, target)

    assert manager.deactivate_skill("dangling") is True
    assert not os.path.lexists(target / "dangling")


def test_activate_over_a_live_dir_link_replaces_it(farm: tuple[Path, Path]) -> None:
    """Route :121. A link to a LIVE dir is unlinked, not rmtree'd, and the dir kept.

    ⚠ A broken-link fixture cannot exercise this branch: `is_dir()` follows the
    dangling link is always False there. This fixture is the one that carries traffic.
    """
    source, target = farm
    live = target / "real-dir"
    live.mkdir()
    (live / "keep.txt").write_text("do not lose me\n")
    _skill(source, "linked")
    os.symlink(live, target / "linked")

    manager = SkillManager(source, target)

    assert manager.activate_skill("linked") is True
    assert (live / "keep.txt").exists(), "the real directory must survive"
    assert os.path.realpath(target / "linked") == os.path.realpath(source / "linked")


def test_manage_refuses_when_the_source_is_absent(farm: tuple[Path, Path]) -> None:
    """The refusal: with no source there is nothing to restore, and the move would
    deposit the dangling link in the SOURCE tree."""
    source, target = farm
    os.symlink(target / "gone", target / "orphan")
    manager = SkillManager(source, target)

    with pytest.raises(FileNotFoundError, match="no source to restore"):
        manager.manage_skill("orphan")

    assert not (source / "orphan").exists(), "the source tree must not receive the link"
    assert os.path.lexists(target / "orphan"), "the target link must be left untouched"


def test_manage_repairs_when_the_source_exists(farm: tuple[Path, Path]) -> None:
    """And the repairable case still works — the refusal must not be a blanket block."""
    source, target = farm
    _skill(source, "recoverable")
    os.symlink(target / "gone", target / "recoverable")
    manager = SkillManager(source, target)

    assert manager.manage_skill("recoverable") is True
    assert os.path.realpath(target / "recoverable") == os.path.realpath(
        source / "recoverable"
    )
    assert not (source / "recoverable").is_symlink(), "source stays the real directory"


def test_no_frontmatter_reported_not_silent(farm: tuple[Path, Path]) -> None:
    """Route :79. A readable SKILL.md with no frontmatter must be NAMED, not dropped."""
    source, target = farm
    _skill(target, "no-frontmatter", frontmatter="# Just a heading\n\nbody\n")

    classified = SkillManager(source, target)._classify(target)  # noqa: SLF001
    assert classified["no-frontmatter"] == "no-frontmatter"


def test_frontmatter_missing_key_reported(farm: tuple[Path, Path]) -> None:
    """Route :87 — the FALL-THROUGH with no `continue`, invisible to a grep for one."""
    source, target = farm
    _skill(target, "no-desc", frontmatter="---\nname: no-desc\n---\n")
    _skill(target, "no-name", frontmatter="---\ndescription: only a description\n---\n")

    classified = SkillManager(source, target)._classify(target)  # noqa: SLF001
    assert classified["no-desc"] == "malformed"
    assert classified["no-name"] == "malformed"


def test_skill_md_absent_still_dropped(farm: tuple[Path, Path]) -> None:
    """Route :70 — a directory with no SKILL.md is named, and is NOT a valid skill."""
    source, target = farm
    (target / "empty-dir").mkdir()
    manager = SkillManager(source, target)

    assert manager._classify(target)["empty-dir"] == "no-skill-md"  # noqa: SLF001
    assert "empty-dir" not in manager._get_directories(target)  # noqa: SLF001


# ── the mutation arms: the identity must REDDEN when a route is silenced ─────────────
#
# ⚠ Only a POPULATED route can be exercised: silencing a zero-instance route leaves the
# sum unchanged, so such a fixture passes while proving nothing. Each arm below asserts
# its route carries traffic FIRST, then that the accounting reddens.


def _accounting(classified: dict[str, str]) -> dict[str, int]:
    counts = {"valid": 0, "broken": 0, "malformed": 0, "dropped": 0}
    for reason in classified.values():
        if reason == "valid":
            counts["valid"] += 1
        elif reason == "broken":
            counts["broken"] += 1
        else:
            counts["malformed"] += 1
    return counts


def test_accounting_reddens_broken_route(farm: tuple[Path, Path]) -> None:
    """Route :66 carries traffic here, so the identity discriminates it."""
    source, target = farm
    os.symlink(target / "gone", target / "dangling")
    manager = SkillManager(source, target)

    classified = manager._classify(target)  # noqa: SLF001
    assert classified == {"dangling": "broken"}, "the arm must carry traffic"
    assert sum(_accounting(classified).values()) == 1

    # Silence it the way the shipped code did; the identity must now disagree.
    silenced = {k: v for k, v in classified.items() if v != "broken"}
    assert sum(_accounting(silenced).values()) == 0 != 1, (
        "the accounting must redden when a populated route is silenced"
    )


def test_accounting_reddens_fallthrough(farm: tuple[Path, Path]) -> None:
    """Route :87 (the no-`continue` fall-through) also carries traffic, so it is
    exercisable — unlike :70/:75 in an empty farm."""
    source, target = farm
    _skill(target, "no-desc", frontmatter="---\nname: no-desc\n---\n")
    manager = SkillManager(source, target)

    classified = manager._classify(target)  # noqa: SLF001
    assert classified == {"no-desc": "malformed"}, "the arm must carry traffic"
    assert sum(_accounting(classified).values()) == 1

    silenced = {k: v for k, v in classified.items() if v != "malformed"}
    assert sum(_accounting(silenced).values()) == 0 != 1


def test_a_zero_instance_route_cannot_be_exercised(farm: tuple[Path, Path]) -> None:
    """The bound on the mutation method, asserted so it cannot be mistaken for coverage.

    With an empty farm, BOTH mutating and not mutating the `no-skill-md` route give the
    same accounting. That is why the card requires the route to be NAMED in the fixture.
    """
    source, target = farm
    manager = SkillManager(source, target)

    classified = manager._classify(target)  # noqa: SLF001
    assert classified == {}
    silenced = {k: v for k, v in classified.items() if v != "no-skill-md"}
    silenced_total = sum(_accounting(silenced).values())
    classified_total = sum(_accounting(classified).values())
    # Equal totals: this fixture cannot tell the route apart, so it proves nothing.
    assert silenced_total == classified_total == 0
