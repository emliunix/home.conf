"""Arms for compose_guard (#40). Each test names the STATE it pins.

Run: python3 -m pytest test_compose_guard.py -q   (or: python3 test_compose_guard.py)
"""
import os
import stat
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from compose_guard import (  # noqa: E402
    Destination, Refusal, backup, classify, preflight, read_stamp,
    sha_of_file, write_bytes_and_stamp,
)

import pytest  # noqa: E402


def fresh(tmp_path):
    d = tmp_path / "dest.md"
    dest = Destination.of(str(d))
    return d, dest


A = b"composed A\n"
B = b"composed B\n"


# ── arm 1: A ────────────────────────────────────────────────────────────────────────────────────
def test_A_up_to_date_writes_nothing(tmp_path):
    d, dest = fresh(tmp_path)
    write_bytes_and_stamp(dest, A)
    before = (d.stat().st_mtime_ns, dest.stamp_path.stat().st_mtime_ns)
    assert classify(dest, A)[0] == "A"
    assert (d.stat().st_mtime_ns, dest.stamp_path.stat().st_mtime_ns) == before


# ── arm 2: B — the case `differs` gets wrong ───────────────────────────────────────────────────
def test_B_composer_wrote_then_snippet_changed(tmp_path):
    d, dest = fresh(tmp_path)
    write_bytes_and_stamp(dest, A)
    # a snippet edit: composed changes, disk is still exactly what the composer wrote
    assert classify(dest, B)[0] == "B", "a changed snippet must be B, not C"


# ── arm 3: C — a hand-added block refuses ──────────────────────────────────────────────────────
def test_C_hand_added_block_refuses_and_survives(tmp_path):
    d, dest = fresh(tmp_path)
    write_bytes_and_stamp(dest, A)
    d.write_bytes(A + b"hand added\n")
    assert classify(dest, A)[0] == "C"
    assert d.read_bytes() == A + b"hand added\n", "the block must still be there"


# ── arm 4 / 20 / 32: G, and the NO-LOOP follow-up ──────────────────────────────────────────────
def test_G_fresh_then_second_run_is_A(tmp_path):
    d, dest = fresh(tmp_path)
    assert classify(dest, A)[0] == "G"
    write_bytes_and_stamp(dest, A)
    assert classify(dest, A)[0] == "A", "G must write a stamp or the next run is D forever"


# ── arm 6 / 33: F, and the NO-SELF follow-up ───────────────────────────────────────────────────
def test_F_file_gone_then_second_run_is_A(tmp_path):
    d, dest = fresh(tmp_path)
    write_bytes_and_stamp(dest, A)
    d.unlink()
    assert classify(dest, A)[0] == "F"
    write_bytes_and_stamp(dest, A)
    assert classify(dest, A)[0] == "A", "F must replace the stamp or the next run calls its own write C"


# ── arm 5: E — malformed stamps, reasons enumerated ────────────────────────────────────────────
@pytest.mark.parametrize("body,reason", [
    ("not json", "not JSON"),
    ('{"schema": 2}', "schema 2"),
    ('{"schema": 1, "sha256": "' + "a" * 64 + '", "dest": "/elsewhere"}', "dest field names"),
])
def test_E_malformed_stamp_reasons(tmp_path, body, reason):
    d, dest = fresh(tmp_path)
    d.write_bytes(A)
    dest.stamp_path.write_text(body)
    state, _ = classify(dest, A)
    assert state == "E"
    assert reason in read_stamp(dest)[1]


# ── arm 7 / 8: D is evaluated BEFORE A ─────────────────────────────────────────────────────────
def test_D_before_A_no_stamp_and_disk_equals_composed(tmp_path):
    d, dest = fresh(tmp_path)
    d.write_bytes(A)          # same bytes, but no stamp
    assert classify(dest, A)[0] == "D", "no stamp must be D even when bytes already match"


# ── arm 35: ENOENT is not H ────────────────────────────────────────────────────────────────────
def test_H_absent_destination_is_not_a_symlink(tmp_path):
    d, dest = fresh(tmp_path)
    assert dest.is_symlink() is False, "a missing path is not a symlink"
    preflight([dest], tmp_path, allow_outside_root=True)   # must not raise
    assert classify(dest, A)[0] == "G"
    write_bytes_and_stamp(dest, A)
    d.unlink()
    assert classify(dest, A)[0] == "F"


# ── arm 25 / 30: H — the final component is a link ─────────────────────────────────────────────
def test_H_symlink_destination_refused_and_realpath_first_would_miss(tmp_path):
    target = tmp_path / "real.md"
    target.write_bytes(A)
    link = tmp_path / "link.md"
    link.symlink_to(target)
    dest = Destination.of(str(link))
    # the bug the arm exists for: resolving first loses the fact
    assert dest.resolved.is_symlink() is False, "realpath-first would report this safe"
    assert dest.is_symlink() is True
    with pytest.raises(Refusal) as ei:
        preflight([dest], tmp_path, allow_outside_root=True)
    assert "SYMLINK" in ei.value.message
    assert link.is_symlink() and target.read_bytes() == A


# ── arm 19: a symlinked PARENT is fine ─────────────────────────────────────────────────────────
def test_symlinked_parent_directory_is_allowed(tmp_path):
    realdir = tmp_path / "real"
    realdir.mkdir()
    linkdir = tmp_path / "linkdir"
    linkdir.symlink_to(realdir, target_is_directory=True)
    dest = Destination.of(str(linkdir / "dest.md"))
    assert dest.is_symlink() is False, "the final component is not a link"
    preflight([dest], tmp_path, allow_outside_root=True)


# ── arm 12: outside ROOT ──────────────────────────────────────────────────────────────────────
def test_outside_root_refused_without_flag(tmp_path):
    dest = Destination.of(str(tmp_path.parent / "outside.md"))
    with pytest.raises(Refusal) as ei:
        preflight([dest], tmp_path / "root", allow_outside_root=False)
    assert "outside the repository root" in ei.value.message
    preflight([dest], tmp_path / "root", allow_outside_root=True)   # flag allows it


# ── arm 26: mode — fresh respects umask, existing preserved ───────────────────────────────────
def test_mode_fresh_respects_umask(tmp_path):
    old = os.umask(0o027)
    try:
        d, dest = fresh(tmp_path)
        write_bytes_and_stamp(dest, A)
        assert stat.S_IMODE(d.stat().st_mode) == 0o640, "0o666 & ~0o027; a fixed 0644 would be 0644"
    finally:
        os.umask(old)


def test_mode_existing_is_preserved(tmp_path):
    d, dest = fresh(tmp_path)
    write_bytes_and_stamp(dest, A)
    os.chmod(d, 0o604)
    write_bytes_and_stamp(dest, B)
    assert stat.S_IMODE(d.stat().st_mode) == 0o604, "an existing destination keeps its exact mode"


# ── arm 17: backups are unique within a second ────────────────────────────────────────────────
def test_backup_names_are_unique(tmp_path):
    d, dest = fresh(tmp_path)
    d.write_bytes(A)
    a = backup(dest)
    b = backup(dest)
    assert a != b, "two backups in one second must not collide"
    assert a.read_bytes() == A and b.read_bytes() == A


# ── arm 16: bytes, not text — a CRLF twin must hash differently ───────────────────────────────
def test_crlf_and_lf_twins_hash_differently(tmp_path):
    lf = tmp_path / "lf.md"
    crlf = tmp_path / "crlf.md"
    lf.write_bytes(b"a\nb\n")
    crlf.write_bytes(b"a\r\nb\r\n")
    assert sha_of_file(lf) != sha_of_file(crlf), "read_text would call these identical"


# ── arm 34: STAMP-FAIL — bytes land, stamp fails, and the next run is D ───────────────────────
def test_stamp_failure_leaves_destination_unstamped_and_next_run_is_D(tmp_path, monkeypatch):
    d, dest = fresh(tmp_path)
    import compose_guard

    def boom(*a, **k):
        raise OSError(28, "No space left on device")

    monkeypatch.setattr(compose_guard, "write_stamp", boom)
    # ⚠ A DISTINCT EXCEPTION, not a bare OSError (review 6, blocker 2): the caller must be able to
    # tell "bytes written, stamp failed" from "nothing happened", or it reports the opposite.
    with pytest.raises(compose_guard.StampFailed):
        write_bytes_and_stamp(dest, A)
    assert d.read_bytes() == A, "the bytes landed"
    assert not dest.stamp_path.exists(), "the stamp did not"
    monkeypatch.undo()
    assert classify(dest, A)[0] == "D", "written but unstamped -> the next run is D, and says so"


# ── gap 1 (review 6): --check must not apply the outside-root rule ──────────────────────────────
def test_check_skips_outside_root_but_still_reports_H(tmp_path):
    """A read-only verb has no destination to announce, so the writer rule must not fire on it."""
    outside = tmp_path.parent / "outside-check.md"
    dest = Destination.of(str(outside))
    # writing: refuses
    with pytest.raises(Refusal):
        preflight([dest], tmp_path, allow_outside_root=False)
    # reading: allowed
    preflight([dest], tmp_path, allow_outside_root=False, reading=True)
    # but H still fires in reading mode
    link = tmp_path.parent / "outside-link.md"
    link.symlink_to(outside)
    with pytest.raises(Refusal) as ei:
        preflight([Destination.of(str(link))], tmp_path, allow_outside_root=False, reading=True)
    assert "SYMLINK" in ei.value.message


# ── gap 2 (review 6): a stamp failure is WRITTEN+BUT-UNSTAMPED, not "unchanged" ─────────────────
def test_stamp_failure_is_a_distinct_exception_not_a_silent_unchanged(tmp_path, monkeypatch):
    d, dest = fresh(tmp_path)
    import compose_guard

    def boom(*a, **k):
        raise OSError(28, "No space left on device")

    monkeypatch.setattr(compose_guard, "write_stamp", boom)
    with pytest.raises(compose_guard.StampFailed) as ei:
        write_bytes_and_stamp(dest, A)
    assert ei.value.dest.resolved == dest.resolved
    assert "No space left" in str(ei.value.cause)
    # the fact that matters: the bytes ARE on disk
    assert d.read_bytes() == A
