"""Core skill manager with file and symlink operations."""

import os
import re
import shutil
from pathlib import Path

from skill_manager.models import Skill, SkillStatus


class SkillManager:
    def __init__(self, source_dir: Path, target_dir: Path) -> None:
        self.source_dir = Path(source_dir).expanduser()
        self.target_dir = Path(target_dir).expanduser()

        if not self.source_dir.exists():
            raise FileNotFoundError(f"Source directory not found: {self.source_dir}")

        self.target_dir.mkdir(parents=True, exist_ok=True)

    def scan_skills(self) -> list[Skill]:
        """Every non-dot entry in either tree appears exactly once, with a named status.

        This is the accounting the card requires: the enumeration must not drop an
        entry, so the rows are built from the CLASSIFICATION (which names every
        than from the valid-only list.
        """
        skills: list[Skill] = []
        source_classified = self._classify(self.source_dir)
        target_classified = self._classify(self.target_dir)

        source_skills = [n for n, r in source_classified.items() if r == "valid"]
        target_skills = list(target_classified)

        # A source-side entry that is not valid is still real (a malformed skill dir,
        # or a
        # broken link in the source). Name it rather than filtering it.
        for skill_name, reason in source_classified.items():
            if reason == "valid":
                continue
            source_path = self.source_dir / skill_name
            skills.append(
                Skill(
                    name=skill_name,
                    status=SkillStatus(self._REASON_STATUS[reason] or "unmanaged"),
                    description="",
                    source_path=source_path,
                    target_path=self.target_dir / skill_name,
                )
            )

        for skill_name in source_skills:
            source_path = self.source_dir / skill_name
            target_path = self.target_dir / skill_name
            status = self.get_skill_status(skill_name, source_path, target_path)
            description = self.parse_skill_description(source_path)
            skills.append(
                Skill(
                    name=skill_name,
                    status=status,
                    description=description,
                    source_path=source_path,
                    target_path=target_path,
                )
            )

        for skill_name in target_skills:
            if skill_name in source_skills:
                continue

            target_path = self.target_dir / skill_name
            source_path = self.source_dir / skill_name
            named = self._REASON_STATUS[target_classified[skill_name]]
            if named is not None:
                # A target-side condition that is decidable without the source: BROKEN
                # or
                # MALFORMED. This is what keeps a broken entry IN the model, and it is
                # chosen by the LINK's state rather than by which side exists.
                status = SkillStatus(named)
            else:
                status = self.get_skill_status(skill_name, source_path, target_path)
            description = self.parse_skill_description(target_path)
            skills.append(
                Skill(
                    name=skill_name,
                    status=status,
                    description=description,
                    source_path=Path(),
                    target_path=target_path,
                )
            )

        return sorted(skills, key=lambda s: s.name.lower())

    # Every non-dot entry in a farm lands in exactly one of these reasons. Kept as a
    # data
    # table so the enumeration and its accounting cannot drift apart, and so a reader
    # can
    # see every exit route without reading the control flow (cf. the :87 fall-through,
    # which has no `continue` and is invisible to a grep for one).
    REASONS = (
        "valid",
        "broken",
        "not-a-dir",
        "no-skill-md",
        "unreadable",
        "no-frontmatter",
        "malformed",
    )

    def _classify(self, path: Path) -> dict[str, str]:
        """Classify EVERY non-dot entry by NAME-first integrity, then by content.

        Decide integrity before any call that follows the link: `is_dir()` and
        both resolve, so a dangling link fails each and would leave the population
        silently -- which is the defect this ordering removes.
        """
        if not path.exists():
            return {}

        classified: dict[str, str] = {}
        for d in path.iterdir():
            if d.name.startswith("."):
                continue

            if d.is_symlink() and not d.is_dir():
                classified[d.name] = "broken"
                continue
            if not d.is_dir():
                # A regular file sitting in the farm. Not usable, but it IS there, so it
                # must be named rather than filtered -- the last silent exit route.
                classified[d.name] = "not-a-dir"
                continue

            skill_md = d / "SKILL.md"
            if not skill_md.exists():
                classified[d.name] = "no-skill-md"
                continue

            try:
                content = skill_md.read_text()
            except (OSError, UnicodeDecodeError):
                classified[d.name] = "unreadable"
                continue

            match = re.search(r"^---\n(.*?)\n---", content, re.DOTALL)
            if not match:
                classified[d.name] = "no-frontmatter"
                continue

            yaml_content = match.group(1)
            has_name = bool(re.search(r"^name:\s*\S+", yaml_content, re.MULTILINE))
            has_description = bool(
                re.search(r"^description:\s*\S+", yaml_content, re.MULTILINE)
            )
            # NOTE: this was a bare `if has_name and has_description: append(...)` with
            # no
            # `continue` -- the one exit route a grep for `continue` cannot find.
            classified[d.name] = (
                "valid" if (has_name and has_description) else "malformed"
            )

        return classified

    def _get_directories(self, path: Path) -> list[str]:
        """Names usable as skills. Retained for callers that only want the valid set."""
        classified = self._classify(path)
        return [name for name, reason in classified.items() if reason == "valid"]

    # Reason -> displayed status. A malformed or absent-SKILL.md entry is present but
    # not
    # usable; that is a different condition from unmanaged, and naming it is the point.
    _REASON_STATUS = {
        "valid": None,  # resolved by get_skill_status (depends on the source tree)
        "broken": "broken",
        "not-a-dir": "malformed",
        "no-skill-md": "malformed",
        "unreadable": "malformed",
        "no-frontmatter": "malformed",
        "malformed": "malformed",
    }

    def get_skill_status(
        self, skill_name: str, source_path: Path, target_path: Path
    ) -> SkillStatus:
        # Link state first: a dangling target is BROKEN regardless of whether a source
        # exists, so the two classes cannot be confused by which one the caller passes.
        if target_path.is_symlink() and not target_path.exists():
            return SkillStatus.BROKEN

        if not source_path.exists():
            return SkillStatus.UNMANAGED

        if not target_path.exists():
            return SkillStatus.INACTIVE

        if target_path.is_symlink():
            try:
                resolved = target_path.resolve()
                resolved_source = source_path.resolve()

                if resolved == resolved_source or (resolved_source in resolved.parents):
                    return SkillStatus.ACTIVE
            except OSError:
                pass

        return SkillStatus.UNMANAGED

    def activate_skill(self, skill_name: str) -> bool:
        source_path = self.source_dir / skill_name
        target_path = self.target_dir / skill_name

        if not source_path.exists():
            raise FileNotFoundError(f"Skill not found in source: {skill_name}")

        if target_path.is_symlink() or target_path.exists():
            if target_path.is_dir() and not target_path.is_symlink():
                shutil.rmtree(target_path)
            else:
                target_path.unlink()

        os.symlink(source_path, target_path)
        return True

    def deactivate_skill(self, skill_name: str) -> bool:
        target_path = self.target_dir / skill_name

        if not target_path.is_symlink() and not target_path.exists():
            return False

        if target_path.is_symlink():
            target_path.unlink()
            return True

        return False

    def manage_skill(self, skill_name: str) -> bool:
        source_path = self.source_dir / skill_name
        target_path = self.target_dir / skill_name

        if not target_path.is_symlink() and not target_path.exists():
            raise FileNotFoundError(f"Skill not found in target: {skill_name}")

        # Refuse rather than "succeed": with no source there is nothing to move back,
        # and
        # the move would deposit the dangling link in the SOURCE tree -- a versioned
        # path.
        if not source_path.exists():
            raise FileNotFoundError(
                f"Skill has no source to restore: {skill_name} "
                f"(refusing to move {target_path} into {self.source_dir})"
            )

        if source_path.exists():
            if target_path.is_dir() and not target_path.is_symlink():
                shutil.rmtree(target_path)
            else:
                target_path.unlink()
        else:
            if source_path.exists():
                shutil.rmtree(source_path)
            shutil.move(str(target_path), str(source_path))

        os.symlink(source_path, target_path)
        return True

    def parse_skill_description(self, skill_path: Path) -> str:
        skill_md = skill_path / "SKILL.md"
        if not skill_md.exists():
            return "No description available"

        try:
            content = skill_md.read_text()
        except (OSError, UnicodeDecodeError):
            return "Could not read description"

        match = re.search(r"^description: (.+)$", content, re.MULTILINE)
        if match:
            return match.group(1).strip()

        match = re.search(r"^---\n.*?\n---\n(.*?)\n\n", content, re.DOTALL)
        if match:
            desc = match.group(1).strip()
            return desc if desc else "No description available"

        return "Description not found"
