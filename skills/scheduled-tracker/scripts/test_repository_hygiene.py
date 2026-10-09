from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

SCRIPT = Path(__file__).with_name("repository-hygiene.py")


def git(repo: Path, *args: str) -> str:
    result = subprocess.run(
        ["git", "-C", str(repo), *args],
        text=True,
        capture_output=True,
        check=True,
    )
    return result.stdout.strip()


def init_repo(path: Path) -> Path:
    path.mkdir()
    git(path, "init", "-q", "-b", "main")
    git(path, "config", "user.name", "Hygiene Test")
    git(path, "config", "user.email", "hygiene@example.invalid")
    (path / "tracked.txt").write_text("one\n", encoding="utf-8")
    git(path, "add", "tracked.txt")
    git(path, "commit", "-q", "-m", "initial")
    return path


def add_remote(repo: Path, root: Path) -> Path:
    bare = root / "remote.git"
    subprocess.run(
        ["git", "init", "-q", "--bare", "--initial-branch=main", str(bare)],
        check=True,
    )
    git(repo, "remote", "add", "origin", str(bare))
    git(repo, "push", "-q", "-u", "origin", "main")
    git(repo, "fetch", "-q", "origin")
    return bare


def run_hygiene(*args: str, env: dict[str, str] | None = None) -> dict:
    result = subprocess.run(
        [sys.executable, str(SCRIPT), "--format", "json", *args],
        text=True,
        capture_output=True,
        check=False,
        env=env,
    )
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


def rows_by_object(report: dict) -> dict[str, dict]:
    return {row["object"]: row for row in report["rows"]}


def test_remote_target_matches_cached_ref(tmp_path: Path) -> None:
    repo = init_repo(tmp_path / "repository")
    add_remote(repo, tmp_path)
    git(repo, "symbolic-ref", "refs/remotes/origin/HEAD", "refs/remotes/origin/main")

    report = run_hygiene(f"--repo=primary={repo}")[0]

    assert report["target"]["status"] == "resolved"
    assert report["target"]["kind"] == "remote"
    assert report["target"]["ref"] == "refs/remotes/origin/main"
    assert report["target"]["tip"] == git(repo, "rev-parse", "HEAD")
    assert "remote-branch:origin" not in rows_by_object(report)


def test_remote_without_cached_target_is_unconfirmed(tmp_path: Path) -> None:
    repo = init_repo(tmp_path / "repository")
    add_remote(repo, tmp_path)
    git(repo, "update-ref", "-d", "refs/remotes/origin/main")

    report = run_hygiene(f"--repo=primary={repo}")[0]

    assert report["target"]["status"] == "unconfirmed"
    assert "no cached ref" in report["target"]["detail"]
    non_target = [row for row in report["rows"] if row["object"] != "branch:main"]
    assert non_target
    assert {row["disposition"] for row in non_target} == {"unconfirmed"}


def test_stale_cached_ref_is_unconfirmed(tmp_path: Path) -> None:
    repo = init_repo(tmp_path / "repository")
    add_remote(repo, tmp_path)
    (repo / "tracked.txt").write_text("two\n", encoding="utf-8")
    git(repo, "add", "tracked.txt")
    git(repo, "commit", "-q", "-m", "second")
    git(repo, "push", "-q", "origin", "main")
    git(repo, "update-ref", "refs/remotes/origin/main", "HEAD~1")

    report = run_hygiene(f"--repo=primary={repo}")[0]

    assert report["target"]["status"] == "unconfirmed"
    assert "stale" in report["target"]["detail"]
    non_target = [row for row in report["rows"] if row["object"] != "branch:main"]
    assert non_target
    assert all(row["target_relation"] == "unconfirmed" for row in non_target)


def test_no_remote_uses_local_main(tmp_path: Path) -> None:
    repo = init_repo(tmp_path / "repository")

    report = run_hygiene(f"--repo=primary={repo}")[0]

    assert report["target"]["status"] == "resolved"
    assert report["target"]["kind"] == "local"
    assert report["target"]["ref"] == "refs/heads/main"
    assert report["target"]["tip"] == git(repo, "rev-parse", "HEAD")


def test_config_accepts_multiple_repositories(tmp_path: Path) -> None:
    remote_repo = init_repo(tmp_path / "remote-repository")
    add_remote(remote_repo, tmp_path)
    local_repo = init_repo(tmp_path / "local-repository")
    config = tmp_path / "hygiene.toml"
    config.write_text(
        "\n".join(
            [
                'target = "main"',
                'remote = "origin"',
                "",
                "[[repositories]]",
                'name = "remote"',
                f'path = "{remote_repo}"',
                "",
                "[[repositories]]",
                'name = "local"',
                f'path = "{local_repo}"',
            ]
        )
        + "\n",
        encoding="utf-8",
    )

    reports = run_hygiene("--config", str(config))

    assert [report["name"] for report in reports] == ["remote", "local"]
    assert [report["target"]["kind"] for report in reports] == ["remote", "local"]


def test_direct_target_and_remote_parameters_apply(tmp_path: Path) -> None:
    repo = init_repo(tmp_path / "repository")
    git(repo, "branch", "release")
    bare = tmp_path / "upstream.git"
    subprocess.run(
        ["git", "init", "-q", "--bare", "--initial-branch=release", str(bare)],
        check=True,
    )
    git(repo, "remote", "add", "upstream", str(bare))
    git(repo, "push", "-q", "-u", "upstream", "release")
    git(repo, "fetch", "-q", "upstream")

    report = run_hygiene(
        f"--repo=primary={repo}",
        "--target",
        "release",
        "--remote",
        "upstream",
    )[0]

    assert report["target"]["status"] == "resolved"
    assert report["target"]["ref"] == "refs/remotes/upstream/release"
    assert report["target"]["tip"] == git(repo, "rev-parse", "release")


def test_prunable_worktree_is_report_only(tmp_path: Path) -> None:
    repo = init_repo(tmp_path / "repository")
    worktree = tmp_path / "prunable"
    git(repo, "worktree", "add", "-q", "-b", "prunable", str(worktree))
    (worktree / "important.txt").write_text("not disposable\n", encoding="utf-8")
    (worktree / ".git").unlink()

    report = run_hygiene(f"--repo=primary={repo}")[0]
    row = rows_by_object(report)[f"worktree:{worktree}"]

    assert row["worktree_state"].startswith("prunable; directory=present; files=")
    assert row["disposition"] == "report-only"
    assert "never prune or rm" in row["next_action"]


def test_locked_worktree_is_active_and_never_cleanup(tmp_path: Path) -> None:
    repo = init_repo(tmp_path / "repository")
    worktree = tmp_path / "locked"
    git(repo, "worktree", "add", "-q", "-b", "locked", str(worktree))
    git(repo, "worktree", "lock", str(worktree))

    rows = rows_by_object(run_hygiene(f"--repo=primary={repo}")[0])

    assert rows[f"worktree:{worktree}"]["disposition"] == "active"
    assert "locked" in rows[f"worktree:{worktree}"]["next_action"]
    assert rows["branch:locked"]["disposition"] == "active"


def test_worktree_state_distinguishes_dirty_from_ignored(tmp_path: Path) -> None:
    repo = init_repo(tmp_path / "repository")
    (repo / ".gitignore").write_text("artifact.bin\n", encoding="utf-8")
    git(repo, "add", ".gitignore")
    git(repo, "commit", "-q", "-m", "ignore artifacts")

    dirty_worktree = tmp_path / "dirty"
    git(repo, "worktree", "add", "-q", "-b", "dirty", str(dirty_worktree))
    (dirty_worktree / "tracked.txt").write_text("changed\n", encoding="utf-8")

    ignored_worktree = tmp_path / "ignored"
    git(repo, "worktree", "add", "-q", "-b", "ignored", str(ignored_worktree))
    (ignored_worktree / "artifact.bin").write_text("build output\n", encoding="utf-8")

    rows = rows_by_object(run_hygiene(f"--repo=primary={repo}")[0])

    assert rows[f"worktree:{dirty_worktree}"]["worktree_state"] == "dirty"
    assert (
        rows[f"worktree:{ignored_worktree}"]["worktree_state"]
        == "ignored artifacts present"
    )


def test_dirty_target_worktree_is_not_clean(tmp_path: Path) -> None:
    repo = init_repo(tmp_path / "repository")
    git(repo, "checkout", "-q", "--detach")
    worktree = tmp_path / "target-worktree"
    git(repo, "worktree", "add", "-q", str(worktree), "main")
    (worktree / "tracked.txt").write_text("local work\n", encoding="utf-8")

    rows = rows_by_object(run_hygiene(f"--repo=primary={repo}")[0])

    assert rows[f"worktree:{worktree}"]["disposition"] == "active"
    assert rows["branch:main"]["disposition"] == "active"


def test_ignored_artifacts_do_not_make_target_actionable(tmp_path: Path) -> None:
    repo = init_repo(tmp_path / "repository")
    (repo / ".gitignore").write_text("artifact.bin\n", encoding="utf-8")
    git(repo, "add", ".gitignore")
    git(repo, "commit", "-q", "-m", "ignore artifacts")
    git(repo, "checkout", "-q", "--detach")
    worktree = tmp_path / "target-worktree"
    git(repo, "worktree", "add", "-q", str(worktree), "main")
    (worktree / "artifact.bin").write_text("build output\n", encoding="utf-8")

    rows = rows_by_object(run_hygiene(f"--repo=primary={repo}")[0])

    assert rows[f"worktree:{worktree}"]["worktree_state"] == "ignored artifacts present"
    assert rows[f"worktree:{worktree}"]["disposition"] == "clean"
    assert rows["branch:main"]["disposition"] == "clean"


def test_local_target_with_unpushed_commit_is_active(tmp_path: Path) -> None:
    repo = init_repo(tmp_path / "repository")
    add_remote(repo, tmp_path)
    (repo / "tracked.txt").write_text("local work\n", encoding="utf-8")
    git(repo, "add", "tracked.txt")
    git(repo, "commit", "-q", "-m", "unpushed local work")

    rows = rows_by_object(run_hygiene(f"--repo=primary={repo}")[0])

    assert rows[f"worktree:{repo}"]["target_relation"] == "unique"
    assert rows[f"worktree:{repo}"]["disposition"] == "active"
    assert rows["branch:main"]["target_relation"] == "unique"
    assert rows["branch:main"]["disposition"] == "active"


@pytest.mark.parametrize(
    ("stub_body", "expected_process", "expected_disposition"),
    [
        ("printf 'holder\\n'\nexit 1\n", "held", "active"),
        ("printf 'warning\\n' >&2\nexit 0\n", "unconfirmed", "unconfirmed"),
        ("exit 1\n", "nothing-held", "cleanup candidate"),
    ],
)
def test_process_state_uses_streams_not_exit_status(
    tmp_path: Path,
    stub_body: str,
    expected_process: str,
    expected_disposition: str,
) -> None:
    repo = init_repo(tmp_path / "repository")
    worktree = tmp_path / "candidate"
    git(repo, "branch", "cleanup")
    git(repo, "worktree", "add", "-q", str(worktree), "cleanup")

    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    stub = bin_dir / "lsof"
    stub.write_text("#!/bin/sh\n" + stub_body, encoding="utf-8")
    stub.chmod(0o755)
    env = os.environ.copy()
    env["PATH"] = f"{bin_dir}{os.pathsep}{env['PATH']}"

    report = run_hygiene(f"--repo=primary={repo}", env=env)[0]
    row = rows_by_object(report)[f"worktree:{worktree}"]

    assert row["process"] == expected_process
    assert row["disposition"] == expected_disposition


def test_missing_lsof_is_unconfirmed(tmp_path: Path) -> None:
    repo = init_repo(tmp_path / "repository")
    worktree = tmp_path / "candidate"
    git(repo, "branch", "cleanup")
    git(repo, "worktree", "add", "-q", str(worktree), "cleanup")

    git_path = shutil.which("git")
    assert git_path is not None
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    (bin_dir / "git").symlink_to(git_path)
    env = os.environ.copy()
    env["PATH"] = str(bin_dir)

    report = run_hygiene(f"--repo=primary={repo}", env=env)[0]
    row = rows_by_object(report)[f"worktree:{worktree}"]

    assert row["process"] == "unconfirmed"
    assert row["disposition"] == "unconfirmed"
