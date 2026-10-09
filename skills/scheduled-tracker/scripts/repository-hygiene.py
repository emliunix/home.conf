#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Read-only inventory for linked worktrees and branches.

The script accepts repository paths as CLI parameters or from a local TOML
config. It never removes a worktree, prunes metadata, or deletes a branch.

Example:

    uv run repository-hygiene.py --repo primary=/path/to/repository

Config shape:

    target = "main"
    remote = "origin"

    [[repositories]]
    name = "primary"
    path = "/path/to/repository"

The target and remote may be overridden per repository.
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from collections.abc import Iterable, Sequence
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

import tomllib

DEFAULT_TARGET = "main"
DEFAULT_REMOTE = "origin"


class HygieneError(RuntimeError):
    """The sweep cannot start with the supplied configuration."""


@dataclass(frozen=True)
class RepoSpec:
    name: str
    path: Path
    target: str = DEFAULT_TARGET
    remote: str | None = DEFAULT_REMOTE


@dataclass(frozen=True)
class Target:
    status: str
    kind: str | None
    ref: str | None
    tip: str | None
    detail: str


@dataclass(frozen=True)
class Relation:
    status: str
    detail: str


@dataclass(frozen=True)
class Row:
    repository: str
    object: str
    tip: str | None
    target_relation: str
    worktree_state: str
    process: str
    owner_card: str
    disposition: str
    next_action: str


@dataclass
class RepoReport:
    name: str
    path: str
    target: Target
    worktrees: int
    local_branches: int
    remote_branches: int
    rows: list[Row]


@dataclass(frozen=True)
class WorktreeRecord:
    path: Path
    head: str | None
    branch_ref: str | None
    detached: bool
    bare: bool
    prunable: bool
    locked: bool


@dataclass(frozen=True)
class BranchRecord:
    ref: str
    name: str
    tip: str
    upstream: str | None
    upstream_track: str | None
    remote: bool


@dataclass(frozen=True)
class CountResult:
    files: int
    unreadable: bool


def run_command(
    argv: Sequence[str], cwd: Path | None = None
) -> subprocess.CompletedProcess[str]:
    try:
        return subprocess.run(
            list(argv),
            cwd=cwd,
            text=True,
            capture_output=True,
            check=False,
        )
    except FileNotFoundError:
        return subprocess.CompletedProcess(
            list(argv), 127, "", f"command not found: {argv[0]}"
        )


def git(repo: Path, *args: str) -> subprocess.CompletedProcess[str]:
    return run_command(["git", "-C", str(repo), *args])


def git_text(repo: Path, *args: str) -> str | None:
    result = git(repo, *args)
    if result.returncode != 0:
        return None
    return result.stdout.strip()


def parse_repo_arg(value: str, target: str, remote: str) -> RepoSpec:
    if "=" not in value:
        raise HygieneError(f"--repo must be NAME=PATH, got {value!r}")
    name, raw_path = value.split("=", 1)
    if not name.strip() or not raw_path.strip():
        raise HygieneError(f"--repo must be NAME=PATH, got {value!r}")
    return RepoSpec(
        name=name.strip(),
        path=expand_path(raw_path.strip()),
        target=target,
        remote=remote or None,
    )


def expand_path(value: str) -> Path:
    return Path(os.path.expandvars(value)).expanduser().resolve()


def load_config(path: Path, cli_target: str, cli_remote: str) -> list[RepoSpec]:
    try:
        with path.open("rb") as handle:
            data = tomllib.load(handle)
    except (OSError, tomllib.TOMLDecodeError) as exc:
        raise HygieneError(f"cannot read config {path}: {exc}") from exc

    target = _optional_string(data, "target") or cli_target
    remote_value = data.get("remote", cli_remote)
    if remote_value is not None and not isinstance(remote_value, str):
        raise HygieneError("config key 'remote' must be a string or omitted")

    raw_repositories = data.get("repositories")
    if not isinstance(raw_repositories, list) or not raw_repositories:
        raise HygieneError("config must contain a non-empty [[repositories]] array")

    repositories: list[RepoSpec] = []
    for index, raw_repo in enumerate(raw_repositories):
        if not isinstance(raw_repo, dict):
            raise HygieneError(f"repositories[{index}] must be a table")
        name = _optional_string(raw_repo, "name")
        raw_path = _optional_string(raw_repo, "path")
        if not name or not raw_path:
            raise HygieneError(f"repositories[{index}] requires name and path")
        repo_target = _optional_string(raw_repo, "target") or target
        repo_remote_value = raw_repo.get("remote", remote_value)
        if repo_remote_value is not None and not isinstance(repo_remote_value, str):
            raise HygieneError(f"repositories[{index}].remote must be a string or null")
        repositories.append(
            RepoSpec(
                name=name,
                path=expand_path(raw_path),
                target=repo_target,
                remote=repo_remote_value or None,
            )
        )

    _require_unique_names(repositories)
    return repositories


def _optional_string(mapping: dict[str, Any], key: str) -> str | None:
    value = mapping.get(key)
    if value is None:
        return None
    if not isinstance(value, str) or not value:
        raise HygieneError(f"config key {key!r} must be a non-empty string")
    return value


def _require_unique_names(repositories: Iterable[RepoSpec]) -> None:
    seen: set[str] = set()
    for repo in repositories:
        if repo.name in seen:
            raise HygieneError(f"duplicate repository name: {repo.name}")
        seen.add(repo.name)


def resolve_target(repo: RepoSpec) -> Target:
    if repo.remote:
        remote_url = git(repo.path, "remote", "get-url", repo.remote)
        if remote_url.returncode == 0:
            return _resolve_remote_target(repo)

    local_ref = f"refs/heads/{repo.target}"
    local_tip = git_text(repo.path, "rev-parse", "--verify", "--quiet", local_ref)
    if local_tip:
        return Target(
            status="resolved",
            kind="local",
            ref=local_ref,
            tip=local_tip,
            detail=f"no {repo.remote or 'configured'} remote; using local {repo.target}",
        )
    return Target(
        status="unconfirmed",
        kind=None,
        ref=None,
        tip=None,
        detail=f"local target {repo.target!r} is unavailable",
    )


def _resolve_remote_target(repo: RepoSpec) -> Target:
    assert repo.remote is not None
    remote_ref = f"refs/heads/{repo.target}"
    live = git(repo.path, "ls-remote", "--heads", repo.remote, remote_ref)
    if live.returncode != 0:
        return Target(
            status="unconfirmed",
            kind="remote",
            ref=None,
            tip=None,
            detail=f"live {repo.remote}/{repo.target} unavailable: {live.stderr.strip()}",
        )

    lines = [line for line in live.stdout.splitlines() if line.strip()]
    if not lines:
        return Target(
            status="unconfirmed",
            kind="remote",
            ref=None,
            tip=None,
            detail=f"remote {repo.remote!r} has no {remote_ref}",
        )
    if len(lines) != 1:
        return Target(
            status="unconfirmed",
            kind="remote",
            ref=None,
            tip=None,
            detail=f"remote lookup returned {len(lines)} rows for {remote_ref}",
        )

    live_tip = lines[0].split()[0]
    cached_ref = f"refs/remotes/{repo.remote}/{repo.target}"
    cached_tip = git_text(repo.path, "rev-parse", "--verify", "--quiet", cached_ref)
    if not cached_tip:
        return Target(
            status="unconfirmed",
            kind="remote",
            ref=None,
            tip=None,
            detail=f"live remote {repo.remote}/{repo.target} has no cached ref",
        )
    if cached_tip != live_tip:
        return Target(
            status="unconfirmed",
            kind="remote",
            ref=None,
            tip=None,
            detail=(
                f"cached {cached_ref} is stale: cached={cached_tip[:12]} "
                f"live={live_tip[:12]}"
            ),
        )
    return Target(
        status="resolved",
        kind="remote",
        ref=cached_ref,
        tip=live_tip,
        detail=f"live {repo.remote}/{repo.target} matches {cached_ref}",
    )


def parse_worktrees(repo: Path) -> list[WorktreeRecord]:
    result = git(repo, "worktree", "list", "--porcelain")
    if result.returncode != 0:
        return []

    records: list[WorktreeRecord] = []
    for block in result.stdout.strip().split("\n\n"):
        if not block.strip():
            continue
        fields: dict[str, str | None] = {}
        for line in block.splitlines():
            key, _, value = line.partition(" ")
            fields[key] = value or None
        raw_path = fields.get("worktree")
        if not raw_path:
            continue
        records.append(
            WorktreeRecord(
                path=Path(raw_path),
                head=fields.get("HEAD"),
                branch_ref=fields.get("branch"),
                detached="detached" in fields,
                bare="bare" in fields,
                prunable="prunable" in fields,
                locked="locked" in fields,
            )
        )
    return records


def parse_branches(repo: Path, *, remote: bool) -> list[BranchRecord]:
    prefix = "refs/remotes" if remote else "refs/heads"
    if remote:
        format_string = "%(refname)%09%(refname:short)%09%(objectname)%09%(upstream:short)%09%(upstream:track)"
    else:
        format_string = "%(refname)%09%(refname:short)%09%(objectname)%09%(upstream:short)%09%(upstream:track)"
    result = git(repo, "for-each-ref", f"--format={format_string}", prefix)
    if result.returncode != 0:
        return []

    records: list[BranchRecord] = []
    for line in result.stdout.splitlines():
        fields = line.split("\t")
        if len(fields) != 5:
            continue
        ref, name, tip, upstream, track = fields
        if remote and ref.endswith("/HEAD"):
            continue
        records.append(
            BranchRecord(
                ref=ref,
                name=name,
                tip=tip,
                upstream=upstream or None,
                upstream_track=track or None,
                remote=remote,
            )
        )
    return records


def git_relation(
    repo: Path, tip: str, branch_ref: str | None, target: Target
) -> Relation:
    if target.status != "resolved" or not target.ref:
        return Relation("unconfirmed", target.detail)

    ancestor = git(repo, "merge-base", "--is-ancestor", tip, target.ref)
    if ancestor.returncode == 0:
        return Relation("reachable", f"{tip[:12]} is an ancestor of {target.ref}")
    if ancestor.returncode != 1:
        detail = (
            ancestor.stderr.strip() or f"git merge-base exited {ancestor.returncode}"
        )
        return Relation("unconfirmed", detail)

    if not branch_ref:
        return Relation(
            "not-reachable", f"{tip[:12]} is not an ancestor of {target.ref}"
        )

    cherry = git(repo, "cherry", target.ref, branch_ref)
    if cherry.returncode != 0:
        detail = cherry.stderr.strip() or f"git cherry exited {cherry.returncode}"
        return Relation("unconfirmed", detail)

    lines = [line for line in cherry.stdout.splitlines() if line.strip()]
    plus = sum(1 for line in lines if line.startswith("+"))
    minus = sum(1 for line in lines if line.startswith("-"))
    if plus == 0 and minus > 0:
        return Relation(
            "patch-equivalent", f"{minus} patch-equivalent commit(s) on {branch_ref}"
        )
    if plus > 0:
        return Relation(
            "unique", f"{plus} unique patch(es) and {minus} patch-equivalent commit(s)"
        )
    return Relation("unconfirmed", "git cherry returned no parseable patch rows")


def worktree_state(
    repo: Path, record: WorktreeRecord
) -> tuple[str, str | None, str | None]:
    if record.prunable:
        if not record.path.is_dir():
            return "prunable; directory=absent", None, None
        count = count_tree(record.path)
        if count.unreadable:
            return "prunable; directory=present; files=unreadable", None, None
        return f"prunable; directory=present; files={count.files}", None, None

    if not record.path.is_dir():
        return "missing checkout", None, None

    tracked = git(record.path, "status", "--porcelain=v1", "--untracked-files=all")
    if tracked.returncode != 0:
        return "unreadable", None, tracked.stderr.strip()
    ignored = git(
        record.path, "status", "--porcelain=v1", "--ignored", "--untracked-files=all"
    )
    if ignored.returncode != 0:
        return "ignored-state-unreadable", None, ignored.stderr.strip()

    tracked_dirty = bool(tracked.stdout.strip())
    ignored_present = any(line.startswith("!!") for line in ignored.stdout.splitlines())
    if tracked_dirty and ignored_present:
        state = "dirty; ignored artifacts present"
    elif tracked_dirty:
        state = "dirty"
    elif ignored_present:
        state = "ignored artifacts present"
    else:
        state = "clean"
    return state, tracked.stdout, ignored.stdout


def count_tree(root: Path) -> CountResult:
    count = 0
    stack = [root]
    while stack:
        current = stack.pop()
        try:
            with os.scandir(current) as entries:
                for entry in entries:
                    try:
                        if entry.is_symlink() or entry.is_file(follow_symlinks=False):
                            count += 1
                        elif entry.is_dir(follow_symlinks=False):
                            stack.append(Path(entry.path))
                    except OSError:
                        return CountResult(count, True)
        except OSError:
            return CountResult(count, True)
    return CountResult(count, False)


def process_state(path: Path) -> tuple[str, str]:
    result = run_command(["lsof", "+D", str(path)])
    if result.returncode == 127:
        return "unconfirmed", result.stderr.strip()
    if result.stderr.strip():
        return "unconfirmed", result.stderr.strip()
    if result.stdout.strip():
        return "held", "lsof reported a holder"
    return "nothing-held", "lsof produced no output"


def worktree_row(
    repo: RepoSpec,
    record: WorktreeRecord,
    target: Target,
    state: str,
    relation: Relation,
) -> Row:
    object_name = f"worktree:{record.path}"
    process = "not-checked"

    if record.locked:
        return Row(
            repository=repo.name,
            object=object_name,
            tip=record.head,
            target_relation=relation.status,
            worktree_state=state,
            process=process,
            owner_card="-",
            disposition="active",
            next_action="worktree is locked by its owner; do not remove",
        )

    if record.prunable:
        if "unreadable" in state:
            disposition = "unconfirmed"
            next_action = (
                "inspect permissions; owner must decide; never prune or rm by default"
            )
        else:
            disposition = "report-only"
            next_action = (
                "inspect files; owner must decide; never prune or rm by default"
            )
        return Row(
            repository=repo.name,
            object=object_name,
            tip=record.head,
            target_relation=relation.status,
            worktree_state=state,
            process=process,
            owner_card="-",
            disposition=disposition,
            next_action=next_action,
        )

    if record.bare:
        return Row(
            repository=repo.name,
            object=object_name,
            tip=record.head,
            target_relation=relation.status,
            worktree_state="bare repository",
            process="not-applicable",
            owner_card="-",
            disposition="clean",
            next_action="none",
        )

    if target.status != "resolved":
        return Row(
            repository=repo.name,
            object=object_name,
            tip=record.head,
            target_relation="unconfirmed",
            worktree_state=state,
            process=process,
            owner_card="-",
            disposition="unconfirmed",
            next_action=target.detail,
        )

    local_target_ref = f"refs/heads/{repo.target}"
    is_target = record.branch_ref == target.ref or record.branch_ref == local_target_ref
    if is_target:
        if state.startswith("dirty") or state not in {
            "clean",
            "ignored artifacts present",
        }:
            return Row(
                repository=repo.name,
                object=object_name,
                tip=record.head,
                target_relation="target",
                worktree_state=state,
                process=process,
                owner_card="-",
                disposition="active",
                next_action=(
                    "target is checked out here; reconcile local/ignored changes; "
                    "never remove the target worktree"
                ),
            )
        if target.kind == "remote" and record.branch_ref != target.ref:
            if relation.status in {"unique", "not-reachable"}:
                return Row(
                    repository=repo.name,
                    object=object_name,
                    tip=record.head,
                    target_relation=relation.status,
                    worktree_state=state,
                    process=process,
                    owner_card="-",
                    disposition="active",
                    next_action=(
                        "local target checkout diverges from the live target; "
                        "reconcile it and never remove this worktree"
                    ),
                )
            if relation.status == "unconfirmed":
                return Row(
                    repository=repo.name,
                    object=object_name,
                    tip=record.head,
                    target_relation=relation.status,
                    worktree_state=state,
                    process=process,
                    owner_card="-",
                    disposition="unconfirmed",
                    next_action=relation.detail,
                )
        return Row(
            repository=repo.name,
            object=object_name,
            tip=record.head,
            target_relation="target",
            worktree_state=state,
            process="not-applicable",
            owner_card="-",
            disposition="clean",
            next_action="none",
        )

    if state.startswith(("dirty", "ignored")):
        return Row(
            repository=repo.name,
            object=object_name,
            tip=record.head,
            target_relation=relation.status,
            worktree_state=state,
            process=process,
            owner_card="-",
            disposition="active",
            next_action="owner must reconcile local/ignored changes before cleanup",
        )

    if state != "clean":
        return Row(
            repository=repo.name,
            object=object_name,
            tip=record.head,
            target_relation=relation.status,
            worktree_state=state,
            process=process,
            owner_card="-",
            disposition="unconfirmed",
            next_action="repair or re-run the inventory; do not delete",
        )

    process, process_detail = process_state(record.path)
    if process == "held":
        disposition = "active"
        next_action = "wait for the holder or name the owner/card; do not delete"
    elif process == "unconfirmed":
        disposition = "unconfirmed"
        next_action = f"re-check the process state: {process_detail}"
    elif relation.status in {"reachable", "patch-equivalent"}:
        disposition = "cleanup candidate"
        next_action = "name owner/card release, then use the safe cleanup gate"
    elif relation.status == "unique" or relation.status == "not-reachable":
        disposition = "unowned/stale"
        next_action = "assign owner/card or confirm the branch still has work"
    else:
        disposition = "unconfirmed"
        next_action = relation.detail

    return Row(
        repository=repo.name,
        object=object_name,
        tip=record.head,
        target_relation=relation.status,
        worktree_state=state,
        process=process,
        owner_card="-",
        disposition=disposition,
        next_action=next_action,
    )


def branch_row(
    repo: RepoSpec,
    branch: BranchRecord,
    target: Target,
    relation: Relation,
    worktrees: dict[str, list[WorktreeRecord]],
    worktree_rows: dict[str, Row],
) -> Row:
    object_name = f"{'remote-branch' if branch.remote else 'branch'}:{branch.name}"
    attached = worktrees.get(branch.ref, [])
    if attached:
        attached_rows = [
            worktree_rows[str(record.path)]
            for record in attached
            if str(record.path) in worktree_rows
        ]
        attached_state = (
            ", ".join(row.worktree_state for row in attached_rows) or "present"
        )
        held = any(row.process == "held" for row in attached_rows)
        unconfirmed = any(row.process == "unconfirmed" for row in attached_rows)
        attached_active = any(
            row.disposition in {"active", "report-only", "unowned/stale"}
            for row in attached_rows
        )
    else:
        attached_state = "none"
        held = False
        unconfirmed = False
        attached_active = False

    protected_branch = branch.ref == target.ref or (
        not branch.remote and branch.name == repo.target
    )
    if protected_branch:
        if attached_active:
            disposition = "active"
            next_action = (
                "reconcile the attached worktree; the target branch is never deleted"
            )
        elif branch.ref != target.ref and relation.status in {
            "unique",
            "not-reachable",
        }:
            disposition = "active"
            next_action = (
                "local target branch diverges from the live target; "
                "reconcile it and never delete this branch"
            )
        elif branch.ref != target.ref and relation.status == "unconfirmed":
            disposition = "unconfirmed"
            next_action = relation.detail
        else:
            disposition = "clean"
            next_action = "none"
    elif target.status != "resolved":
        disposition = "unconfirmed"
        next_action = target.detail
    elif held:
        disposition = "active"
        next_action = "wait for the holder or name the owner/card; do not delete"
    elif unconfirmed:
        disposition = "unconfirmed"
        next_action = "re-check the attached worktree process state"
    elif attached_active:
        disposition = "active"
        next_action = "reconcile the attached worktree before deleting the branch"
    elif relation.status in {"reachable", "patch-equivalent"}:
        disposition = "cleanup candidate"
        next_action = (
            "name owner/card release; remote deletion requires explicit remote authorization"
            if branch.remote
            else "name owner/card release, then use git branch -d"
        )
    elif relation.status == "unique" or relation.status == "not-reachable":
        disposition = "unowned/stale"
        next_action = "assign owner/card or confirm the branch still has work"
    else:
        disposition = "unconfirmed"
        next_action = relation.detail

    return Row(
        repository=repo.name,
        object=object_name,
        tip=branch.tip,
        target_relation="target" if disposition == "clean" else relation.status,
        worktree_state=attached_state,
        process="held"
        if held
        else ("unconfirmed" if unconfirmed else "not-applicable"),
        owner_card="-",
        disposition=disposition,
        next_action=next_action,
    )


def analyze_repo(repo: RepoSpec) -> RepoReport:
    if not repo.path.is_dir():
        target = Target(
            "unconfirmed", None, None, None, f"repository path is missing: {repo.path}"
        )
        row = Row(
            repository=repo.name,
            object="repository",
            tip=None,
            target_relation="unconfirmed",
            worktree_state="missing",
            process="not-applicable",
            owner_card="-",
            disposition="unconfirmed",
            next_action=f"repair the configured path: {repo.path}",
        )
        return RepoReport(repo.name, str(repo.path), target, 0, 0, 0, [row])

    top = git_text(repo.path, "rev-parse", "--show-toplevel")
    if not top:
        target = Target(
            "unconfirmed", None, None, None, f"not a Git worktree: {repo.path}"
        )
        row = Row(
            repository=repo.name,
            object="repository",
            tip=None,
            target_relation="unconfirmed",
            worktree_state="not-a-git-worktree",
            process="not-applicable",
            owner_card="-",
            disposition="unconfirmed",
            next_action=f"repair the configured path: {repo.path}",
        )
        return RepoReport(repo.name, str(repo.path), target, 0, 0, 0, [row])

    target = resolve_target(repo)
    worktrees = parse_worktrees(repo.path)
    local_branches = parse_branches(repo.path, remote=False)
    remote_branches = parse_branches(repo.path, remote=True)
    branch_worktrees: dict[str, list[WorktreeRecord]] = {}
    for record in worktrees:
        if record.branch_ref:
            branch_worktrees.setdefault(record.branch_ref, []).append(record)

    worktree_rows: dict[str, Row] = {}
    rows: list[Row] = []
    for record in worktrees:
        tip = record.head or ""
        relation = (
            git_relation(repo.path, tip, record.branch_ref, target)
            if tip
            else Relation("unconfirmed", "worktree has no HEAD")
        )
        state, _, _ = worktree_state(repo.path, record)
        row = worktree_row(repo, record, target, state, relation)
        worktree_rows[str(record.path)] = row
        rows.append(row)

    for branch in local_branches + remote_branches:
        relation = git_relation(repo.path, branch.tip, branch.ref, target)
        rows.append(
            branch_row(repo, branch, target, relation, branch_worktrees, worktree_rows)
        )

    return RepoReport(
        name=repo.name,
        path=str(repo.path),
        target=target,
        worktrees=len(worktrees),
        local_branches=len(local_branches),
        remote_branches=len(remote_branches),
        rows=rows,
    )


def render_text(reports: Sequence[RepoReport]) -> str:
    lines: list[str] = []
    total_rows = 0
    non_clean = 0
    unconfirmed = 0
    cleanup_candidates = 0

    for report in reports:
        total_rows += len(report.rows)
        clean = sum(1 for row in report.rows if row.disposition == "clean")
        rows_non_clean = [row for row in report.rows if row.disposition != "clean"]
        non_clean += len(rows_non_clean)
        unconfirmed += sum(1 for row in report.rows if row.disposition == "unconfirmed")
        cleanup_candidates += sum(
            1 for row in report.rows if row.disposition == "cleanup candidate"
        )

        target_text = (
            f"{report.target.ref} = {report.target.tip}"
            if report.target.status == "resolved"
            else f"unconfirmed ({report.target.detail})"
        )
        lines.append(f"== {report.name} ==")
        lines.append(f"repo: {report.path}")
        lines.append(f"target: {target_text}")
        lines.append(
            f"inventory: worktrees={report.worktrees} "
            f"local_branches={report.local_branches} remote_branches={report.remote_branches} "
            f"clean={clean}"
        )
        lines.append(
            "repo | object | tip | target relation | worktree state | process | owner/card | disposition | next action"
        )
        for row in rows_non_clean:
            lines.append(
                " | ".join(
                    [
                        row.repository,
                        row.object,
                        (row.tip or "-")[:12],
                        row.target_relation,
                        row.worktree_state,
                        row.process,
                        row.owner_card,
                        row.disposition,
                        row.next_action,
                    ]
                )
            )
        lines.append("")

    lines.append(
        f"summary: repositories={len(reports)} objects={total_rows} "
        f"non_clean={non_clean} cleanup_candidates={cleanup_candidates} unconfirmed={unconfirmed}"
    )
    return "\n".join(lines)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Read-only repository, worktree, and branch hygiene inventory.",
        allow_abbrev=False,
    )
    parser.add_argument(
        "--config",
        type=Path,
        help="TOML file containing [[repositories]] entries.",
    )
    parser.add_argument(
        "--repo",
        action="append",
        default=[],
        metavar="NAME=PATH",
        help="Repository to inspect; repeat for multiple repositories.",
    )
    parser.add_argument(
        "--target",
        default=DEFAULT_TARGET,
        help="Default target branch (default: main).",
    )
    parser.add_argument(
        "--remote",
        default=DEFAULT_REMOTE,
        help="Default remote name (default: origin).",
    )
    parser.add_argument("--format", choices=("text", "json"), default="text")
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    try:
        repositories = [
            parse_repo_arg(value, args.target, args.remote) for value in args.repo
        ]
        if args.config:
            repositories.extend(
                load_config(expand_path(str(args.config)), args.target, args.remote)
            )
        if not repositories:
            parser.error("provide --config or at least one --repo NAME=PATH")
        _require_unique_names(repositories)
    except HygieneError as exc:
        parser.error(str(exc))

    reports = [analyze_repo(repo) for repo in repositories]
    if args.format == "json":
        print(
            json.dumps(
                [asdict(report) for report in reports],
                indent=2,
                sort_keys=True,
            )
        )
    else:
        print(render_text(reports))
    return 0


if __name__ == "__main__":
    sys.exit(main())
