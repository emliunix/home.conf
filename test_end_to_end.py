"""End-to-end arms for the composer CLI (#40 review 7: "no committed end-to-end test").

These run the REAL `AGENTS.md.compose.py` as a subprocess, in a `git archive`-style copy with a
SCRATCH HOME, because the production manifest's output is `~/.agents-local/AGENTS.md` -- a bare run
from any checkout writes that host-wide file. Isolation means redirecting `output:`, not changing
directory (measured twice the hard way).

Run: uv run --with pytest --with pyyaml python -m pytest test_end_to_end.py -q
"""
import os
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

HERE = Path(__file__).resolve().parent
REPO = HERE  # the test lives beside the composer, not in a tests/ dir


def _make_copy(tmp_path: Path, *, output: str, home: Path) -> Path:
    """A throwaway copy of the composer + manifest, with `output:` set explicitly."""
    d = tmp_path / "copy"
    d.mkdir()
    for name in ("AGENTS.md.compose.py", "compose_guard.py"):
        shutil.copy(REPO / name, d / name)
    shutil.copytree(REPO / "user.AGENTS.md.snippets", d / "user.AGENTS.md.snippets")
    manifest = d / "user.AGENTS.md.snippets" / "manifest.yaml"
    text = manifest.read_text()
    text = "\n".join(
        f"output: {output}" if line.startswith("output:") else line
        for line in text.splitlines()
    )
    # Point snippet_roots at the FIXTURE overlay inside the scratch HOME, never the host's.
    text = text.replace("  - ~/.agents-local/agents-snippets",
                        f"  - {home}/.agents-local/agents-snippets")
    manifest.write_text(text + "\n")
    return d


def run(cwd: Path, home: Path, *args: str):
    env = {**os.environ, "HOME": str(home)}
    return subprocess.run(
        [sys.executable, "AGENTS.md.compose.py", *args],
        cwd=cwd, env=env, capture_output=True, text=True,
    )


# ⚠ NO MODULE-LEVEL SKIP, AND NO HOST OVERLAY (#40 review 8). The suite used to skip 4 of 4 e2e arms
# whenever `~/.agents-local/agents-snippets` was absent -- which is every CI run and every cold
# checkout -- so the G->A, C/refusal, read-only `--check` and force->A paths vanished exactly where
# they were needed. The overlay is FIVE FILES whose identities the manifest names; a fixture with
# those names exercises the same composer paths without a host dependency.
_OVERLAY_SNIPPETS = (
    "registries-and-mirrors.md",
    "containers.md",
    "owned-resources.md",
    "credentials.md",
    "working-habits.md",
)


def _make_overlay(home: Path) -> Path:
    """A minimal fixture overlay in the scratch HOME: the five filenames the manifest names."""
    root = home / ".agents-local" / "agents-snippets"
    root.mkdir(parents=True, exist_ok=True)
    # ⚠ THE FRONTMATTER IS PART OF THE CONTRACT, not decoration: the composer refuses a snippet with
    # no `id`/`title`, so a fixture body without them tests the refusal path instead of the state
    # machine. Fixture bodies carry the same frontmatter shape as the real ones.
    # The declared titles must MATCH THE MANIFEST: the composer cross-checks them and refuses a
    # mismatch, so an invented title tests the refusal path rather than the state machine.
    _TITLES = {
        "registries-and-mirrors": "Registries and mirrors",
        "containers": "Containers (podman + podman-compose)",
        "owned-resources": "Owned resources",
        "credentials": "Credentials",
        "working-habits": "Working habits that have paid off here",
    }
    for name in _OVERLAY_SNIPPETS:
        stem = name.removesuffix(".md")
        (root / name).write_text(
            f"---\nid: {stem}\ntitle: {_TITLES[stem]}\n---\n\n"
            f"Fixture body for {stem}.\n"
        )
    return root


# ── the state machine, through the CLI ────────────────────────────────────────────────────────
def test_G_then_A_a_fresh_destination_is_protected_from_the_next_run(tmp_path):
    home = tmp_path / "home"
    home.mkdir()
    _make_overlay(home)
    d = _make_copy(tmp_path, output=str(home / "out" / "AGENTS.md"), home=home)
    home.mkdir(exist_ok=True)
    (home / "out").mkdir(exist_ok=True)
    os.makedirs(home / "out", exist_ok=True)

    first = run(d, home, "--allow-outside-root")
    assert first.returncode == 0, first.stderr
    assert (home / "out" / "AGENTS.md").is_file()
    assert (home / "out" / "AGENTS.md.stamp").is_file(), "G must write a stamp or loop as D forever"

    # second run is A: no new backup appears
    before = sorted(p.name for p in (home / "out").iterdir())
    second = run(d, home, "--allow-outside-root")
    assert second.returncode == 0
    assert sorted(p.name for p in (home / "out").iterdir()) == before, "A writes nothing"


def test_C_a_hand_added_block_refuses_and_survives(tmp_path):
    home = tmp_path / "home"
    (home / "out").mkdir(parents=True)
    _make_overlay(home)
    d = _make_copy(tmp_path, output=str(home / "out" / "AGENTS.md"), home=home)
    run(d, home, "--allow-outside-root")

    target = home / "out" / "AGENTS.md"
    with open(target, "ab") as fh:
        fh.write(b"\n## hand added\n")
    before = target.read_bytes()

    r = run(d, home, "--allow-outside-root")
    assert r.returncode == 3, r.stderr
    assert "REFUSING" in r.stderr
    assert target.read_bytes() == before, "the block must survive"
    assert "--force" in r.stderr, "the remedy is named"


def test_check_reports_states_without_writing(tmp_path):
    home = tmp_path / "home"
    (home / "out").mkdir(parents=True)
    _make_overlay(home)
    d = _make_copy(tmp_path, output=str(home / "out" / "AGENTS.md"), home=home)
    run(d, home, "--allow-outside-root")

    target = home / "out" / "AGENTS.md"
    stamp = home / "out" / "AGENTS.md.stamp"
    before = (target.stat().st_mtime_ns, stamp.stat().st_mtime_ns, target.read_bytes())

    assert run(d, home, "--check").returncode == 0, "up to date"
    # --check wrote NOTHING: destination and stamp are byte- and mtime-identical
    assert (target.stat().st_mtime_ns, stamp.stat().st_mtime_ns) == (before[0], before[1])
    assert target.read_bytes() == before[2]

    with open(target, "ab") as fh:
        fh.write(b"\n## hand added\n")
    tampered = target.read_bytes()
    assert run(d, home, "--check").returncode == 3, "C is reported by --check"
    # and it still wrote nothing, even while reporting a refusal
    assert target.read_bytes() == tampered, "--check must not modify the destination"
    assert (home / "out").glob("AGENTS.md.bak-*"), "no backup should be created by --check"
    assert not list((home / "out").glob("AGENTS.md.bak-*")), "--check creates no backup"


# ── review 7: the CLI's own messages match the next real state ───────────────────────────────
def test_force_then_a_second_run_is_A(tmp_path):
    home = tmp_path / "home"
    (home / "out").mkdir(parents=True)
    _make_overlay(home)
    d = _make_copy(tmp_path, output=str(home / "out" / "AGENTS.md"), home=home)
    run(d, home, "--allow-outside-root")
    with open(home / "out" / "AGENTS.md", "ab") as fh:
        fh.write(b"\n## hand added\n")
    assert run(d, home, "--allow-outside-root").returncode == 3

    forced = run(d, home, "--allow-outside-root", "--force")
    assert forced.returncode == 0, forced.stderr
    assert "backed up" in forced.stderr, "every overwrite takes a backup"
    assert run(d, home, "--allow-outside-root").returncode == 0, "the next run is A"
