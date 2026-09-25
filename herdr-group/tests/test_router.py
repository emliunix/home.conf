import pytest

from group import FormatError, Message
from group import plan, resolve_sender

MEMBERS = frozenset({"alice", "bob", "carol"})


def test_broadcast_excludes_sender():
    route = plan(Message("alice", None, "hi"), MEMBERS)
    assert route.targets == ("bob", "carol")
    assert route.message.recipients is None


def test_direct_drops_self_and_keeps_user_off_targets():
    route = plan(Message("alice", ("alice", "bob", "user"), "hi"), MEMBERS)
    assert route.targets == ("bob",)
    assert route.message.recipients == ("bob", "user")


def test_unknown_recipient():
    with pytest.raises(FormatError, match="unknown recipient"):
        plan(Message("alice", ("zed",), "hi"), MEMBERS)


def test_only_self():
    with pytest.raises(FormatError):
        plan(Message("alice", ("alice",), "hi"), MEMBERS)


def test_caller_identity_fills_and_guards_from():
    assert resolve_sender(Message(None, None, "hi"), MEMBERS, "bob").sender == "bob"
    with pytest.raises(FormatError, match="does not match"):
        resolve_sender(Message("alice", None, "hi"), MEMBERS, "bob")


def test_self_declared_sender_must_be_member_or_user():
    assert resolve_sender(Message("user", None, "hi"), MEMBERS, None).sender == "user"
    with pytest.raises(FormatError, match="missing from"):
        resolve_sender(Message(None, None, "hi"), MEMBERS, None)
    with pytest.raises(FormatError, match="not a group member"):
        resolve_sender(Message("zed", None, "hi"), MEMBERS, None)


def test_broadcast_skips_muted_but_direct_reaches_them():
    muted = frozenset({"carol"})
    route = plan(Message("alice", None, "hi"), MEMBERS, muted)
    assert route.targets == ("bob",) and route.skipped == ("carol",)
    assert plan(Message("alice", ("carol",), "hi"), MEMBERS, muted).targets == ("carol",)
