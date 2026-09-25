import io

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


def test_client_broadcast_uses_pane_identity(seat):
    herdr = FakeHerdr(AGENTS)
    response = seat(herdr).handle_client({"pane_id": "w1:p2", "text": "hello"})
    assert response["ok"] and response["delivered"] == ["bob"]
    assert herdr.prompts == [("bob", "[from:alice; to_all] hello")]
    assert herdr.states == ["working", "idle"]


def test_client_spoofed_from_rejected(seat):
    herdr = FakeHerdr(AGENTS)
    response = seat(herdr).handle_client({"pane_id": "w1:p2", "text": "[from:bob] hi"})
    assert not response["ok"] and "does not match" in response["error"]
    assert herdr.prompts == []


def test_client_unnamed_pane_told_how_to_fix(seat):
    response = seat(FakeHerdr(AGENTS)).handle_client({"pane_id": "w1:p4", "text": "hi"})
    assert "herdr agent rename w1:p4" in response["error"]


def test_client_blocked_recipient_reported(seat):
    response = seat(FakeHerdr(AGENTS, blocked={"bob"})).handle_client({"pane_id": "w1:p2", "text": "[to:bob] hi"})
    assert response["failed"] == {"bob": "agent_blocked"}


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
    seat(FakeHerdr(AGENTS)).handle_client({"pane_id": "w1:p3", "text": "[to:alice] yo"})
    log = (tmp_path / "herdr-group" / "w1" / "group.jsonl").read_text()
    assert '"from": "bob"' in log and '"body": "yo"' in log


def test_mute_skips_broadcasts_and_persists(seat):
    herdr = FakeHerdr(AGENTS)
    s = seat(herdr)
    assert s.handle_client({"pane_id": "w1:p3", "text": "[mute]"})["sent"] == "[from:bob; mute]"
    response = s.handle_client({"pane_id": "w1:p2", "text": "everyone"})
    assert response["delivered"] == [] and response["skipped"] == ["bob"]
    s.handle_client({"pane_id": "w1:p2", "text": "[to:bob] direct"})
    assert herdr.prompts == [("bob", "[from:alice; to:bob] direct")]
    assert seat(herdr).muted == {"bob"}  # a restarted seat remembers
    seat(herdr).handle_client({"pane_id": "w1:p3", "text": "[unmute]"})
    assert seat(herdr).muted == set()


def test_mute_dropped_when_member_leaves(seat):
    s = seat(FakeHerdr(AGENTS))
    s.handle_client({"pane_id": "w1:p3", "text": "[mute]"})
    s.herdr = FakeHerdr([a for a in AGENTS if a.name != "bob"])
    s.handle_client({"pane_id": "w1:p2", "text": "hi"})
    assert s.muted == set()


def test_user_cannot_mute(seat):
    s = seat(FakeHerdr(AGENTS))
    s.handle_typed("[from:user; mute]")
    assert "for agent seats" in s.out.getvalue()
