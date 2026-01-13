"""Core skill manager with file and symlink operations."""

import os
import re
import shutil
from pathlib import Path
from typing import Optional

from skill_manager.models import Skill, SkillStatus


class SkillManager:
    def __init__(self, source_dir: Path, target_dir: Path) -> None:
        self.source_dir = Path(source_dir).expanduser()
        self.target_dir = Path(target_dir).expanduser()

        if not self.source_dir.exists():
            raise FileNotFoundError(f"Source directory not found: {self.source_dir}")

        self.target_dir.mkdir(parents=True, exist_ok=True)

    def scan_skills(self) -> list[Skill]:
        skills: list[Skill] = []
        source_skills = self._get_directories(self.source_dir)
        target_skills = self._get_directories(self.target_dir)

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
            description = self.parse_skill_description(target_path)
            skills.append(
                Skill(
                    name=skill_name,
                    status=SkillStatus.UNMANAGED,
                    description=description,
                    source_path=Path(),
                    target_path=target_path,
                )
            )

        return sorted(skills, key=lambda s: s.name.lower())

    def _get_directories(self, path: Path) -> list[str]:
        if not path.exists():
            return []

        valid_skills = []
        for d in path.iterdir():
            if not d.is_dir() or d.name.startswith("."):
                continue

            skill_md = d / "SKILL.md"
            if not skill_md.exists():
                continue

            try:
                content = skill_md.read_text()
            except (OSError, UnicodeDecodeError):
                continue

            match = re.search(r"^---\n(.*?)\n---", content, re.DOTALL)
            if not match:
                continue

            yaml_content = match.group(1)
            has_name = bool(re.search(r"^name:\s*\S+", yaml_content, re.MULTILINE))
            has_description = bool(
                re.search(r"^description:\s*\S+", yaml_content, re.MULTILINE)
            )

            if has_name and has_description:
                valid_skills.append(d.name)

        return valid_skills

    def get_skill_status(
        self, skill_name: str, source_path: Path, target_path: Path
    ) -> SkillStatus:
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

        if target_path.exists():
            if target_path.is_dir():
                shutil.rmtree(target_path)
            else:
                target_path.unlink()

        os.symlink(source_path, target_path)
        return True

    def deactivate_skill(self, skill_name: str) -> bool:
        target_path = self.target_dir / skill_name

        if not target_path.exists():
            return False

        if target_path.is_symlink():
            target_path.unlink()
            return True

        return False

    def manage_skill(self, skill_name: str) -> bool:
        source_path = self.source_dir / skill_name
        target_path = self.target_dir / skill_name

        if not target_path.exists():
            raise FileNotFoundError(f"Skill not found in target: {skill_name}")

        if source_path.exists():
            if target_path.is_dir():
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
