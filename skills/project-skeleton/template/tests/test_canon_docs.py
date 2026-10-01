"""Canon pairing (project skeleton): every P-<pkg>-NN property a package claims has a
row in its verification.md naming a runnable pytest node id, and every named node id
resolves. Discovers packages from docs/modules/*."""
from __future__ import annotations

import re
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
PACKAGES = sorted(p.name for p in (ROOT / "docs" / "modules").iterdir() if p.is_dir())


def properties(pkg: str) -> set[str]:
    text = (ROOT / "docs" / "modules" / pkg / "properties.md").read_text()
    ids = set(re.findall(r"P-[a-z]+-\d+", text))
    assert ids, f"{pkg} properties.md lists no P-id"
    return ids


def verification_rows(pkg: str) -> str:
    return (ROOT / "docs" / "modules" / pkg / "verification.md").read_text()


@pytest.mark.parametrize("pkg", PACKAGES)
def test_every_property_has_a_verification_row(pkg):
    missing = properties(pkg) - set(re.findall(r"P-[a-z]+-\d+", verification_rows(pkg)))
    assert not missing, f"{pkg}: no verification row for {sorted(missing)}"


@pytest.mark.parametrize("pkg", PACKAGES)
def test_every_row_names_a_runnable_check(pkg):
    for line in verification_rows(pkg).splitlines():
        if not re.match(r"\| P-[a-z]+-\d+", line):
            continue
        if "no automated check" in line:
            continue
        assert re.search(r"`tests/[a-z_0-9]+\.py::[a-z_0-9]+`", line), \
            f"{pkg}: row cites no runnable node id: {line[:80]}"


@pytest.mark.parametrize("pkg", PACKAGES)
def test_named_node_ids_exist(pkg):
    for match in re.finditer(r"`(tests/[a-z_0-9]+\.py)(?::([a-z_0-9]+))?`", verification_rows(pkg)):
        file, test = match.group(1), match.group(2)
        path = ROOT / file
        assert path.is_file(), f"{pkg}: {file} does not exist"
        if test is not None:
            assert re.search(rf"^def {re.escape(test)}\(", path.read_text(), re.M), \
                f"{pkg}: {file} defines no test {test}"
