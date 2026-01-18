"""Tests for CLI argument parsing and directory resolution."""

from pathlib import Path

import pytest

from skill_manager.cli import (
    _find_source_with_fallbacks,
    parse_cli_args,
    resolve_source_target,
)


class TestParseCliArgs:
    def test_explicit_source_and_target(self, monkeypatch):
        monkeypatch.setattr(
            "sys.argv",
            [
                "tskill",
                "--source-dir",
                "/custom/source",
                "--target-dir",
                "/custom/target",
            ],
        )
        source, target = parse_cli_args()
        assert source == Path("/custom/source")
        assert target == Path("/custom/target")

    def test_no_arguments(self, monkeypatch):
        monkeypatch.setattr("sys.argv", ["tskill"])
        source, target = parse_cli_args()
        assert source is None
        assert target is None

    def test_only_source(self, monkeypatch):
        monkeypatch.setattr("sys.argv", ["tskill", "--source-dir", "/custom/source"])
        source, target = parse_cli_args()
        assert source == Path("/custom/source")
        assert target is None


class TestResolveSourceTarget:
    def test_explicit_source_dir(self, tmp_path):
        source_dir = tmp_path / "custom_source"
        source_dir.mkdir()

        source, target = resolve_source_target(source_dir, None, tmp_path)
        assert source == source_dir
        assert target == Path("~/.claude/skills").expanduser()

    def test_explicit_source_not_found(self, tmp_path):
        source_dir = tmp_path / "nonexistent"

        with pytest.raises(FileNotFoundError) as exc_info:
            resolve_source_target(source_dir, None, tmp_path)
        assert "Source directory not found:" in str(exc_info.value)
        assert "nonexistent" in str(exc_info.value)

    def test_fallback_to_local_skills(self, test_cwd_repo_dir):
        source, target = resolve_source_target(None, None, test_cwd_repo_dir)
        assert source == test_cwd_repo_dir / "skills"
        assert target == Path("~/.claude/skills").expanduser()

    def test_fallback_to_parent_skills(self, test_parent_repo_dir):
        parent_dir = test_parent_repo_dir.parent
        source, target = resolve_source_target(None, None, test_parent_repo_dir)
        assert source == parent_dir / "skills"

    def test_no_source_directory_found(self, test_no_repo_dir):
        with pytest.raises(FileNotFoundError) as exc_info:
            resolve_source_target(None, None, test_no_repo_dir)

        error_msg = str(exc_info.value)
        assert "Source directory not found" in error_msg
        assert "Tried the following paths" in error_msg
        assert f"{test_no_repo_dir}/skills" in error_msg
        assert f"{test_no_repo_dir}/../skills" in error_msg
        assert "--source-dir" in error_msg

    def test_explicit_target_dir(self, tmp_path):
        custom_target = tmp_path / "custom_target"
        custom_target.mkdir()

        local_skills = tmp_path / "skills"
        local_skills.mkdir()

        source, target = resolve_source_target(None, custom_target, tmp_path)
        assert target == custom_target

    def test_default_target_dir(self, tmp_path):
        local_skills = tmp_path / "skills"
        local_skills.mkdir()

        source, target = resolve_source_target(None, None, tmp_path)
        assert target == Path("~/.claude/skills").expanduser()

    def test_both_exist_prefers_local(self, test_both_exist_dir):
        source, target = resolve_source_target(None, None, test_both_exist_dir)
        assert source == test_both_exist_dir / "skills"


class TestFindSourceWithFallbacks:
    def test_local_skills_exists(self, test_cwd_repo_dir):
        result = _find_source_with_fallbacks(test_cwd_repo_dir)
        assert result == test_cwd_repo_dir / "skills"

    def test_parent_skills_exists(self, test_parent_repo_dir):
        parent_dir = test_parent_repo_dir.parent
        result = _find_source_with_fallbacks(test_parent_repo_dir)
        assert result == parent_dir / "skills"

    def test_both_exist_prefers_local(self, test_both_exist_dir):
        result = _find_source_with_fallbacks(test_both_exist_dir)
        assert result == test_both_exist_dir / "skills"

    def test_neither_exists_raises_error(self, test_no_repo_dir):
        with pytest.raises(FileNotFoundError) as exc_info:
            _find_source_with_fallbacks(test_no_repo_dir)

        error_msg = str(exc_info.value)
        assert f"{test_no_repo_dir}/skills" in error_msg
        assert f"{test_no_repo_dir}/../skills" in error_msg
