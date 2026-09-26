import io
import json

import pytest

from group import Agent, HerdrError
from group import LineInput, Seat


def test_typed_line_submits_on_enter():
    line = LineInput()
    assert line.feed(b"hel") == []
    assert line.feed(b"lo\x7fo\r") == ["hello"]


def test_bracketed_paste_keeps_newlines_until_enter():
    line = LineInput()
    assert line.feed(b"\x1b[200~a\rb\x1b[2") == []
    assert line.feed(b"01~\r") == ["a\nb"]


def test_arrow_keys_dropped():
    assert LineInput().feed(b"a\x1b[Db\r") == ["ab"]


class FakeHerdr:
    def __init__(self, agents, blocked=()):
        self._agents = agents
        self.blocked = set(blocked)
        self.prompts = []
        self.states = []

    def agents(self):
        return self._agents

    def prompt(self, target, text):
        if target in self.blocked:
            raise HerdrError("agent.prompt", "agent_blocked", "blocked")
        self.prompts.append((target, text))

    def report_agent(self, pane_id, source, agent, state):
        self.states.append(state)


AGENTS = [
    Agent("w1:p1", "w1", "group", "maki", "idle"),
    Agent("w1:p2", "w1", "alice", "claude", "idle"),
    Agent("w1:p3", "w1", "bob", "codex", "working"),
    Agent("w1:p4", "w1", None, "claude", "idle"),
    Agent("w2:p1", "w2", "far", "claude", "idle"),
    Agent("w1:p5", "w1", "all", "claude", "idle"),
]


@pytest.fixture
def seat(monkeypatch, tmp_path):
    monkeypatch.setenv("HERDR_PANE_ID", "w1:p1")
    monkeypatch.setenv("HERDR_WORKSPACE_ID", "w1")
    monkeypatch.setenv("XDG_STATE_HOME", str(tmp_path))
    (tmp_path / "herdr-group" / "w1").mkdir(parents=True)
    return lambda herdr: Seat(herdr, "group", "maki", False, io.StringIO())


def test_prompted_message_routes_to_members(seat):
    herdr = FakeHerdr(AGENTS)
    outcome = seat(herdr).route("[from:alice] hello")
    assert outcome.delivered == ("bob",)
    assert herdr.prompts == [("bob", "[from:alice] hello")]
    assert herdr.states == ["working", "idle"]


def test_blocked_recipient_reported_back_to_sender(seat):
    herdr = FakeHerdr(AGENTS, blocked={"bob"})
    seat(herdr).handle_typed("[from:alice; to:bob] hi")
    assert herdr.prompts[0][0] == "alice"
    assert "bob (agent_blocked)" in herdr.prompts[0][1]


def test_second_seat_with_same_name_refused(seat):
    s = seat(FakeHerdr(AGENTS + [Agent("w1:p9", "w1", "group", "maki", "idle")]))
    with pytest.raises(SystemExit, match="already serving on w1:p9"):
        s.run()


def test_typed_bad_format_fed_back_to_declared_sender(seat):
    herdr = FakeHerdr(AGENTS)
    s = seat(herdr)
    s.handle_typed("[from:alice to:zed] hi")
    assert herdr.prompts[0][0] == "alice"
    assert "unknown recipient" in herdr.prompts[0][1]
    assert "rejected" in s.out.getvalue()


def test_typed_without_from_only_echoes(seat):
    herdr = FakeHerdr(AGENTS)
    s = seat(herdr)
    s.handle_typed("[to:bob] hi")
    assert herdr.prompts == []
    assert "missing from" in s.out.getvalue()


def test_other_workspace_not_member(seat):
    assert set(seat(FakeHerdr(AGENTS)).members()) == {"alice", "bob"}


def test_messages_logged(seat, tmp_path):
    s = seat(FakeHerdr(AGENTS))
    s.route("[from:bob; to:alice; re:d52] yo")
    s.route("[from:bob] all")
    lines = (tmp_path / "herdr-group" / "w1" / "group.jsonl").read_text().splitlines()
    first, second = (json.loads(line) for line in lines)
    assert first["from"] == "bob" and first["body"] == "yo"
    assert first["to"] == ["alice"] and first["re"] == "d52"
    assert second["to"] == [] and second["re"] is None


def test_mute_skips_group_messages_unless_named_and_persists(seat):
    herdr = FakeHerdr(AGENTS)
    s = seat(herdr)
    assert s.route("[from:bob; mute]").message.render() == "[from:bob; mute]"
    outcome = s.route("[from:alice] everyone")
    assert outcome.delivered == () and outcome.skipped == ("bob",)
    s.route("[from:alice; to:bob] act")
    assert herdr.prompts == [("bob", "[from:alice; to:bob] act")]
    assert seat(herdr).muted == {"bob"}  # a restarted seat remembers
    seat(herdr).route("[from:bob; unmute]")
    assert seat(herdr).muted == set()


def test_mute_dropped_when_member_leaves(seat):
    s = seat(FakeHerdr(AGENTS))
    s.route("[from:bob; mute]")
    s.herdr = FakeHerdr([a for a in AGENTS if a.name != "bob"])
    s.route("[from:alice] hi")
    assert s.muted == set()


def test_user_cannot_mute(seat):
    s = seat(FakeHerdr(AGENTS))
    s.handle_typed("[from:user; mute]")
    assert "for agent seats" in s.out.getvalue()
