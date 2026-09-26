import pytest

from group import FormatError, Message
from group import plan, resolve_sender

MEMBERS = frozenset({"alice", "bob", "carol"})


def test_every_member_but_sender_receives():
    for recipients in ((), ("bob",)):
        route = plan(Message("alice", recipients, "hi"), MEMBERS)
        assert route.targets == ("bob", "carol")
        assert route.message.recipients == recipients


def test_to_drops_self():
    route = plan(Message("alice", ("alice", "bob"), "hi"), MEMBERS)
    assert route.message.recipients == ("bob",)
    assert route.targets == ("bob", "carol")


def test_unknown_recipient():
    with pytest.raises(FormatError, match="unknown recipient"):
        plan(Message("alice", ("zed",), "hi"), MEMBERS)


def test_only_self():
    with pytest.raises(FormatError):
        plan(Message("alice", ("alice",), "hi"), MEMBERS)


def test_self_declared_sender_must_be_member_or_user():
    assert resolve_sender(Message("user", (), "hi"), MEMBERS).sender == "user"
    with pytest.raises(FormatError, match="missing from"):
        resolve_sender(Message(None, (), "hi"), MEMBERS)
    with pytest.raises(FormatError, match="not a group member"):
        resolve_sender(Message("zed", (), "hi"), MEMBERS)


def test_muted_skipped_unless_named_in_to():
    muted = frozenset({"bob", "carol"})
    route = plan(Message("alice", (), "hi"), MEMBERS, muted)
    assert route.targets == () and route.skipped == ("bob", "carol")
    route = plan(Message("alice", ("carol",), "hi"), MEMBERS, muted)
    assert route.targets == ("carol",) and route.skipped == ("bob",)
