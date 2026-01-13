from pathlib import Path

import pytest


@pytest.fixture(scope="session")
def fixtures_dir() -> Path:
    return Path(__file__).parent / "fixtures"


@pytest.fixture(scope="session")
def skill_repo_template(fixtures_dir: Path) -> Path:
    return fixtures_dir / "test_repo"
