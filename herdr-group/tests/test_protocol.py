import pytest

from group import FormatError, Message, parse


def test_full_header():
    assert parse("[from:alice to:bob] hi") == Message("alice", ("bob",), "hi")


def test_spaces_after_colons_and_list():
    assert parse("[from: alice to: bob, carol] hi") == Message("alice", ("bob", "carol"), "hi")


def test_omitted_to_names_no_one():
    assert parse("[from:alice] hi") == Message("alice", (), "hi")
    assert parse("hi there").recipients == ()


def test_topic_tag():
    assert parse("[from:alice; to:bob; re:d52] hi") == Message("alice", ("bob",), "hi", topic="d52")
    assert parse("[re:ops/deploy from:alice] hi").topic == "ops/deploy"


def test_field_separators():
    expected = Message("alice", ("bob", "carol"), "hi")
    assert parse("[from:alice; to:bob,carol] hi") == expected
    assert parse("[from:alice, to:bob, carol] hi") == expected
    assert parse("[from:alice to:bob carol] hi") == expected


def test_bracket_without_keys_is_body():
    assert parse("[WIP] refactor") == Message(None, (), "[WIP] refactor")


def test_multiline_body_kept():
    assert parse("[to:bob] line1\nline2").body == "line1\nline2"


@pytest.mark.parametrize(
    "text",
    [
        "[from:alice to:bob]   ",
        "[from:alice,bob] hi",
        "[from:alice from:bob] hi",
        "[from:Alice! to:bob] hi",
        "[from:alice to:all] hi",
        "[from:alice to:to_all] hi",
        "[from:alice to:] hi",
        "[from:alice to:user] hi",
        "[from:alice, to_all] hi",
        "[from:alice, to:bob, to_all] hi",
        "[from:alice, to_all bob] hi",
        "[from:alice; re:] hi",
        "[from:alice; re:two words] hi",
        "[from:alice; re:a; re:b] hi",
        "[hey from:alice] hi",
    ],
)
def test_rejects(text):
    with pytest.raises(FormatError):
        parse(text)


def test_render_roundtrip():
    for message, text in [
        (Message("alice", (), "hi"), "[from:alice] hi"),
        (Message("alice", ("bob",), "hi", topic="d52"), "[from:alice; to:bob; re:d52] hi"),
    ]:
        assert message.render() == text
        assert parse(text) == message


def test_render_direct():
    assert Message("alice", ("bob", "carol"), "hi").render() == "[from:alice; to:bob,carol] hi"


def test_mute_and_unmute_are_bodiless_controls():
    from group import Control

    assert parse("[from:alice; mute]") == Message("alice", (), "", control=Control.MUTE)
    assert parse("[unmute]").control is Control.UNMUTE
    assert parse("[from:alice; mute]").render() == "[from:alice; mute]"


@pytest.mark.parametrize(
    "text",
    ["[from:alice; mute] hi", "[mute; to:bob]", "[mute; re:x]", "[mute; to_all]", "[mute; unmute]", "[mute bob]"],
)
def test_mute_rejects(text):
    with pytest.raises(FormatError):
        parse(text)
