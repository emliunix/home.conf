import shutil
from pathlib import Path

from skill_manager.manager import SkillManager
from skill_manager.models import SkillStatus


def test_scan_skills(tmp_path: Path, skill_repo_template: Path) -> None:
    source_dir = tmp_path / "source_repo"
    shutil.copytree(skill_repo_template, source_dir)

    target_dir = tmp_path / "target_repo"
    target_dir.mkdir()

    manager = SkillManager(source_dir, target_dir)
    skills = manager.scan_skills()

    assert len(skills) == 1
    skill = skills[0]
    assert skill.name == "test_skill"
    assert skill.status == SkillStatus.INACTIVE
    assert skill.description == "Skill for testing purposes"
