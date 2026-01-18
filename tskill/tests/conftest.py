from pathlib import Path

import pytest


@pytest.fixture(scope="session")
def fixtures_dir() -> Path:
    return Path(__file__).parent / "fixtures"


@pytest.fixture(scope="session")
def test_parent_repo_dir(fixtures_dir: Path) -> Path:
    return fixtures_dir / "test_parent_repo" / "working_dir"


@pytest.fixture(scope="session")
def test_cwd_repo_dir(fixtures_dir: Path) -> Path:
    return fixtures_dir / "test_cwd_repo"


@pytest.fixture(scope="session")
def test_no_repo_dir(fixtures_dir: Path) -> Path:
    return fixtures_dir / "test_no_repo"


@pytest.fixture(scope="session")
def test_both_exist_dir(fixtures_dir: Path) -> Path:
    return fixtures_dir / "test_both_exist_repo" / "working_dir"
