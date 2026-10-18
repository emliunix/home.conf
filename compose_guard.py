#!/usr/bin/env python3
"""Shared guard logic for AGENTS.md.compose.py -- state classification and safe writes.

Design: notes/task-40-design.md (34+ arms). This module holds the parts that need arms; the CLI
wiring stays in AGENTS.md.compose.py.

THE ONE INVARIANT THAT MAKES THE REST WORK: a destination is classified by comparing THREE facts --
the on-disk bytes, the stamp that records what this composer last wrote, and the freshly composed
bytes -- and every path that writes bytes also replaces the stamp.

WHY A STAMP AT ALL: "differs from composed" cannot tell a legitimate recompose (a snippet changed)
from a hand-added block (a human edited the output). A snippet edit changes `composed`, so a
`differs` guard refuses every real recompose forever. Only a record of what this composer wrote
separates B from C.
"""
from __future__ import annotations

import hashlib
import json
import os
import stat
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

STAMP_SCHEMA = 1
STAMP_SUFFIX = ".stamp"

# Exit codes. 3 is the refusal class, 64 a usage error, and they must not be confused: a caller
# treating "non-zero" as "just recompose" destroys the block in state C.
EXIT_OK = 0
EXIT_STALE = 1
EXIT_REFUSED = 3
EXIT_USAGE = 64


class Refusal(Exception):
    """A state in which the composer writes nothing. Carries the user-facing message."""

    def __init__(self, message: str, code: int = EXIT_REFUSED):
        super().__init__(message)
        self.message = message
        self.code = code


@dataclass
class Destination:
    """One write target, resolved once.

    BOTH NAMES ARE KEPT, and the order matters: the RAW path is the only one whose final component
    can be tested for being a symlink. `raw.resolve()` replaces a link with its target, so
    `resolved.is_symlink()` is False for a link -- measured.
    """

    raw: Path
    resolved: Path

    @classmethod
    def of(cls, arg: str) -> "Destination":
        raw = Path(arg).expanduser()
        return cls(raw=raw, resolved=raw.resolve(strict=False))

    @property
    def stamp_path(self) -> Path:
        return self.resolved.with_name(self.resolved.name + STAMP_SUFFIX)

    def is_symlink(self) -> bool:
        """H: the FINAL component is a link.

        `Path.is_symlink()` returns False for a missing path, which is what makes ENOENT "not H"
        rather than a refusal -- F and G are absent destinations.
        """
        return self.raw.is_symlink()


def sha_of_file(path: Path) -> Optional[str]:
    """The sha256 of a file's BYTES, or None when it does not exist.

    read_bytes, not read_text: read_text normalizes newlines, so a CRLF file and its LF twin would
    read identical while their bytes differ -- and the sha256 in the message would then not be a
    hash of the bytes on disk.
    """
    try:
        return hashlib.sha256(path.read_bytes()).hexdigest()
    except FileNotFoundError:
        return None


def read_stamp(dest: Destination) -> tuple[Optional[dict], Optional[str]]:
    """Return (stamp, reason). A stamp that cannot be trusted is (None, reason) -- state E."""
    p = dest.stamp_path
    try:
        raw = p.read_text()
    except FileNotFoundError:
        return None, None
    except OSError as exc:
        return None, f"unreadable ({exc.strerror or exc})"
    try:
        stamp = json.loads(raw)
    except json.JSONDecodeError:
        return None, "not JSON"
    if not isinstance(stamp, dict):
        return None, "not a JSON object"
    schema = stamp.get("schema")
    if schema != STAMP_SCHEMA:
        return None, f"schema {schema!r} (this composer writes {STAMP_SCHEMA})"
    if stamp.get("dest") != str(dest.resolved):
        return None, f"dest field names {stamp.get('dest')!r}, not this destination"
    if not isinstance(stamp.get("sha256"), str) or len(stamp["sha256"]) != 64:
        return None, "sha256 field is missing or not a 64-character hex digest"
    return stamp, None


def classify(dest: Destination, composed: bytes) -> tuple[str, Optional[dict]]:
    """One of A, B, C, D, E, F, G. H is decided by `preflight`, before this.

    ⚠ D IS EVALUATED BEFORE A. A no-stamp file whose bytes already equal `composed` must be D, so the
    stamp is created and the file is protected from now on -- otherwise a later hand edit classifies
    D and is overwritten after a backup rather than refused.
    """
    if dest.is_symlink():
        # Caller should have refused in preflight; kept here so a direct call cannot slip past.
        raise Refusal(_symlink_message(dest))

    stamp, reason = read_stamp(dest)
    if reason is not None:
        return "E", None

    disk_sha = sha_of_file(dest.resolved)
    if stamp is None:
        return ("D", None) if disk_sha is not None else ("G", None)
    if disk_sha is None:
        return "F", stamp
    if stamp["sha256"] != disk_sha:
        return "C", stamp
    if disk_sha == hashlib.sha256(composed).hexdigest():
        return "A", stamp
    return "B", stamp


def preflight(dests: list[Destination], root: Path, allow_outside_root: bool) -> None:
    """Refuse before any byte, any backup, any stamp is written.

    H is decided here, not in `classify`, because it is a fact about WHERE we would write.
    """
    for d in dests:
        if d.is_symlink():
            raise Refusal(_symlink_message(d))
        if not allow_outside_root and not _under(d.resolved, root):
            raise Refusal(
                f"compose: REFUSING to write {d.resolved} -- it is outside the repository root "
                f"{root.resolve()}.\n"
                f"  Pass --allow-outside-root if this destination is intended (every write to the "
                f"user-global target needs it)."
            )


def _under(path: Path, root: Path) -> bool:
    try:
        return os.path.commonpath([str(path), str(root.resolve())]) == str(root.resolve())
    except ValueError:
        # Different drives or a mix of absolute/relative: not under.
        return False


def _symlink_message(dest: Destination) -> str:
    return (
        f"compose: REFUSING to write {dest.raw} -- it is a SYMLINK to {dest.resolved}.\n"
        f"  Writing would replace the link itself, not the file it points at, so the bytes this\n"
        f"  composer wrote could be redirected afterwards. Name the resolved target to write it:\n"
        f"    {dest.resolved}"
    )


def backup(dest: Destination) -> Path:
    """Copy the destination aside, uniquely, before an overwrite.

    Uniqueness via O_CREAT|O_EXCL with a counter: two runs in the same second must not overwrite the
    backup that preserves the first run's content.
    """
    stamp = time.strftime("%Y%m%dT%H%M%SZ", time.gmtime())
    base = f"{dest.resolved.name}.bak-{stamp}-{os.getpid()}"
    for n in range(1000):
        candidate = dest.resolved.with_name(base if n == 0 else f"{base}-{n}")
        try:
            fd = os.open(candidate, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        except FileExistsError:
            continue
        with os.fdopen(fd, "wb") as fh:
            fh.write(dest.resolved.read_bytes())
        return candidate
    raise Refusal(f"compose: REFUSING -- could not create a unique backup name beside {dest.resolved}")


def write_bytes_and_stamp(dest: Destination, composed: bytes) -> None:
    """Replace the destination, then replace its stamp. Each is atomic; the PAIR IS NOT A TRANSACTION.

    ⚠ THE MODE RULE: for an existing destination the mode is preserved exactly; for a fresh one the
    temp is created with 0o666 so the CALLER'S UMASK applies, which is what `write_text` does today.
    A fixed 0644 would override the umask and change existing behaviour.
    """
    dest.resolved.parent.mkdir(parents=True, exist_ok=True)
    try:
        existing_mode = stat.S_IMODE(os.stat(dest.resolved).st_mode)
    except FileNotFoundError:
        existing_mode = None

    tmp = dest.resolved.with_name(f".{dest.resolved.name}.tmp-{os.getpid()}")
    fd = os.open(tmp, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o666)
    try:
        with os.fdopen(fd, "wb") as fh:
            fh.write(composed)
            fh.flush()
            os.fsync(fh.fileno())
        if existing_mode is not None:
            os.chmod(tmp, existing_mode)
        os.replace(tmp, dest.resolved)
    except BaseException:
        try:
            os.unlink(tmp)
        except FileNotFoundError:
            pass
        raise

    write_stamp(dest, composed)


def write_stamp(dest: Destination, composed: bytes) -> None:
    payload = {
        "schema": STAMP_SCHEMA,
        "sha256": hashlib.sha256(composed).hexdigest(),
        "bytes": len(composed),
        "dest": str(dest.resolved),
        "composer": "AGENTS.md.compose.py",
        "written_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    body = (json.dumps(payload, indent=2) + "\n").encode()
    tmp = dest.stamp_path.with_name(f".{dest.stamp_path.name}.tmp-{os.getpid()}")
    fd = os.open(tmp, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o666)
    with os.fdopen(fd, "wb") as fh:
        fh.write(body)
        fh.flush()
        os.fsync(fh.fileno())
    os.chmod(tmp, 0o644 if not dest.stamp_path.exists() else stat.S_IMODE(os.stat(dest.stamp_path).st_mode))
    os.replace(tmp, dest.stamp_path)


def refusal_message(dest: Destination, state: str, stamp: Optional[dict], composed: bytes) -> str:
    """The user-facing message for a refusing state, naming three sizes and hashes.

    Tonight's failure was invisible because the run printed `wrote … 13804 bytes` and nothing else.
    A reader must see what is on disk and what would replace it without asking.
    """
    disk_sha = sha_of_file(dest.resolved) or "(absent)"
    new_sha = hashlib.sha256(composed).hexdigest()
    disk_bytes = (
        len(dest.resolved.read_bytes()) if dest.resolved.is_file() else 0
    )
    if state == "C":
        return (
            f"compose: REFUSING to overwrite {dest.resolved} -- it differs from the bytes this "
            f"composer last wrote.\n"
            f"  The file has been edited outside the composer (a hand-added block, or another tool).\n"
            f"    last composed : {stamp['bytes']} bytes, sha256 {stamp['sha256'][:12]}\n"
            f"    on disk       : {disk_bytes} bytes, sha256 {disk_sha[:12]}\n"
            f"    composed now  : {len(composed)} bytes, sha256 {new_sha[:12]}\n"
            f"  Review: diff {dest.resolved} <(python3 AGENTS.md.compose.py --print)\n"
            f"  Then readmit the block into a snippet, or pass --force to replace it (a backup is taken)."
        )
    if state == "E":
        _stamp, reason = read_stamp(dest)
        return (
            f"compose: REFUSING to touch {dest.resolved} -- its stamp is unusable: {reason}.\n"
            f"  A stamp that cannot be read cannot certify the file. Inspect {dest.stamp_path},\n"
            f"  or pass --force to replace the file (a backup is taken)."
        )
    if state == "F":
        return (
            f"compose: {dest.resolved} was written by this composer but the file is GONE -- writing "
            f"fresh.\n  The previous bytes are not recoverable from this design; any hand edits in it "
            f"are lost."
        )
    return f"compose: {dest.resolved} is in state {state}"
