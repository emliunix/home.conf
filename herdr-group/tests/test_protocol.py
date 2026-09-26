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
        "[from:alice to:] hi",
        "[from:alice, everyone] hi",
        "[from:alice, to:bob; cc:carol] hi",
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
    ["[from:alice; mute] hi", "[mute; to:bob]", "[mute; re:x]", "[mute; unmute]", "[mute bob]"],
)
def test_mute_rejects(text):
    with pytest.raises(FormatError):
        parse(text)


def test_query_is_a_control_with_terms_in_the_body():
    from group import Control

    message = parse("[from:alice; query] from:bob re:d52 deploy")
    assert message.control is Control.QUERY and message.body == "from:bob re:d52 deploy"
    assert message.render() == "[from:alice; query] from:bob re:d52 deploy"
    assert parse("[from:alice; query]").body == ""


@pytest.mark.parametrize(
    "text",
    [
        "[from:alice; query; to:bob] x",
        "[from:alice; query; mute]",
        "[from:alice; query] since:10:00",
        "[from:alice; query] last:0",
        "[from:alice; query] last:many",
        "[from:alice; query] from:bob from:carol",
        "[from:alice; query] re:two/words/but:colon",
    ],
)
def test_query_rejects(text):
    with pytest.raises(FormatError):
        parse(text)


def test_query_filters_and_last():
    from group import answer, parse_query

    records = [
        {"ts": "t1", "line": "[from:bob; to:lead; re:d52] DONE: deploy", "from": "bob", "to": ["lead"], "re": "d52", "control": None, "body": "DONE: deploy"},
        {"ts": "t2", "line": "[from:bob; mute]", "from": "bob", "to": [], "re": None, "control": "mute", "body": ""},
        {"ts": "t3", "line": "[from:carol] Deploy window moved", "from": "carol", "to": [], "re": None, "control": None, "body": "Deploy window moved"},
        {"ts": "t4", "line": "[from:bob; to:carol] hi", "from": "bob", "to": ["carol"], "re": None, "control": None, "body": "hi"},
    ]
    assert parse_query("from:bob to:lead").matches(records[0])
    assert not parse_query("from:bob").matches(records[1])  # controls never match
    assert answer(parse_query("deploy"), records).splitlines() == [
        "2 of 2 matches",
        "t1 [from:bob; to:lead; re:d52] DONE: deploy",
        "t3 [from:carol] Deploy window moved",
    ]
    assert answer(parse_query("last:1"), records).splitlines() == ["1 of 3 matches", "t4 [from:bob; to:carol] hi"]
    assert answer(parse_query("re:zz"), records) == "0 of 0 matches"
