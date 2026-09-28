"""Regression tests for the group seat's rejection feedback and header errors.

Run from this directory:

    uv run --python 3.12 --with typer --with pytest pytest test_group.py -q
"""

from __future__ import annotations

import pytest

import group


class _Seat:
    """Minimal stand-in for Seat that records _notify calls."""

    def __init__(self, members: set[str]) -> None:
        self._members = members
        self.notified: list[tuple[str | None, str]] = []

    def members(self) -> set[str]:
        return self._members

    def _notify(self, target: str | None, text: str) -> None:
        self.notified.append((target, text))


def _feedback(text: str, error: str = "invalid", members: set[str] | None = None) -> list:
    seat = _Seat(members or {"lead", "hawk", "owl"})
    group.Seat._feedback(seat, text, error)
    return seat.notified


def test_declared_sender_recovers_from_a_header_that_parse_rejects() -> None:
    text = "[from:lead; to:hawk; cc:owl; re:d54] owl is right"
    with pytest.raises(group.FormatError):
        group.parse(text)  # the whole point: parse cannot finish
    assert group._declared_sender(text) == "lead"
    assert group._declared_sender("[from: lead; to:hawk] hi") == "lead"
    assert group._declared_sender("[from:123; to:hawk] hi") is None
    assert group._declared_sender("[to:hawk] hi") is None
    assert group._declared_sender("[WIP] not a header") is None


def test_rejected_message_with_a_valid_from_notifies_the_sender() -> None:
    notified = _feedback("[from:lead; to:hawk; cc:owl; re:d54] owl is right")
    assert notified == [("lead", "your message was not delivered: invalid")]


def test_unparseable_or_unknown_from_notifies_nobody() -> None:
    assert _feedback("[from:123; to:hawk] hi") == []
    assert _feedback("[to:hawk] hi") == []
    assert _feedback("[from:ghost; to:hawk] hi") == []


def test_cc_reports_unknown_key() -> None:
    with pytest.raises(group.FormatError) as excinfo:
        group.parse("[from:lead; to:hawk; cc:owl; re:d54] hi")
    assert "unknown key cc:" in str(excinfo.value)


def test_a_bad_name_without_a_colon_still_reports_invalid_name() -> None:
    with pytest.raises(group.FormatError) as excinfo:
        group.parse("[from:lead; to:1bad] hi")
    assert "invalid to name '1bad'" in str(excinfo.value)
