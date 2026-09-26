#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = [
#     "typer>=0.27.2",
# ]
# ///
"""Herdr group chat: a pane Herdr treats as an agent, fanning messages out to the team.

  group.py serve [--group NAME] [--kind KIND] [--all-workspaces]   run the seat in this pane

Peers post with Herdr itself: ``herdr agent prompt group "<message>"``. The seat
reads its terminal, delivers each message unchanged with ``herdr agent prompt``
to every member except the sender, prints it once on screen, and appends it to
``$XDG_STATE_HOME/herdr-group/<workspace>/<group>.jsonl``. Direct messages do
not pass through the seat: agents send them with ``herdr agent prompt <peer>``.

Message grammar: ``[from:<name>; to:<name>[,<name>...]; re:<topic>] <body>``;
``to:`` and ``re:`` are optional, and fields may also be separated by commas or
spaces. Every member except the sender receives the message; ``to:`` names who
is expected to act, and everyone else reads it as information. ``re:`` is a
free topic tag. ``[from:<name>; mute]`` (no body) stops group messages reaching
the sender, except those naming it in ``to:``; ``unmute`` restores them.
``to:`` names must be members; agents named ``all``/``user``/``mute``/``unmute``
are never members. A leading ``[...]`` without ``from:``/``to:``/``re:``/``mute``/``unmute``
is ordinary body text (e.g. ``[WIP] ...``); any other header is rejected.

Herdr does not tell a terminal who wrote to it, so every message self-declares
``from:``, which must name a live member or ``user``. A rejected message, and a
delivery that failed, is sent back to the declared sender when it is a member.

``agent prompt`` only targets a pane whose foreground process Herdr identifies
as a built-in agent kind; ``HERDR_AGENT=<kind>`` in the process environment is
Herdr's own identification hint, so ``serve`` re-execs itself with it.
"""

from __future__ import annotations

import codecs
import json
import os
import re
import selectors
import shutil
import signal
import socket
import sys
import termios
import time
from dataclasses import dataclass, replace
from pathlib import Path
from enum import Enum
from typing import Annotated, Any, TextIO

import typer


# ---------------------------------------------------------------- protocol

NAME_RE = re.compile(r"^[a-z][a-z0-9_-]{0,31}$")
# The human at the keyboard. Not an agent seat: it reads the group screen and
# can only post by typing into the group pane.
USER = "user"
TOPIC_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._/-]{0,47}$")


class Control(Enum):
    """Bodiless header flags that change the sender's own membership."""

    # Stop group messages arriving, except those naming the sender in to:.
    MUTE = "mute"
    UNMUTE = "unmute"


# Agents with these names are not group members: they would read as keywords,
# the human, or "everyone" in a to: list.
RESERVED = frozenset({"all", USER, *(c.value for c in Control)})

USAGE = (
    "format: [from:<your-name>; to:<name>[,<name>...]; re:<topic>] <message>  "
    "(to: and re: optional; every member except you receives it, to: names who acts)  "
    "or [from:<your-name>; mute|unmute] to opt out of / back into group messages"
)

_HEADER_RE = re.compile(r"^\s*\[([^\]]*)\]\s*(.*)\Z", re.DOTALL)
_KEY_RE = re.compile(r"\b(from\s*:|to\s*:|re\s*:|mute\b|unmute\b)", re.IGNORECASE)


class FormatError(ValueError):
    """The text is not a well-formed group message."""


@dataclass(frozen=True)
class Message:
    sender: str | None
    # Who is expected to act; empty means nobody in particular. Every member
    # except the sender receives the message either way.
    recipients: tuple[str, ...]
    body: str
    topic: str | None = None
    # A control message has no recipients and an empty body.
    control: Control | None = None

    def render(self) -> str:
        fields = [f"from:{self.sender}"]
        if self.control is not None:
            return f"[{fields[0]}; {self.control.value}]"
        if self.recipients:
            fields.append("to:" + ",".join(self.recipients))
        if self.topic:
            fields.append(f"re:{self.topic}")
        return f"[{'; '.join(fields)}] {self.body}"


def _names(raw: str, key: str) -> list[str]:
    names = [part.lower() for part in re.split(r"[,;\s]+", raw) if part]
    for name in names:
        if not NAME_RE.match(name):
            raise FormatError(f"invalid {key} name {name!r}; {USAGE}")
    return names


def parse(text: str) -> Message:
    match = _HEADER_RE.match(text)
    header, body = (match.group(1), match.group(2)) if match else ("", text)
    if match and not _KEY_RE.search(header):
        header, body = "", text

    sender: str | None = None
    recipients: tuple[str, ...] = ()
    topic: str | None = None
    control: Control | None = None
    if header:
        parts = _KEY_RE.split(header)
        if parts[0].strip(" ,;"):
            raise FormatError(f"unexpected {parts[0].strip()!r} in header; {USAGE}")
        seen: set[str] = set()
        for key, raw in zip(parts[1::2], parts[2::2]):
            key = key.lower().replace(" ", "").rstrip(":")
            if key in seen:
                raise FormatError(f"duplicate {key} in header; {USAGE}")
            seen.add(key)
            if key in (c.value for c in Control):
                if raw.strip(" ,;"):
                    raise FormatError(f"{key} takes no names; {USAGE}")
                control = Control(key)
                continue
            if key == "re":
                topic = raw.strip(" ,;")
                if not TOPIC_RE.match(topic):
                    raise FormatError(f"re: needs one short topic tag (letters, digits, . _ / -); {USAGE}")
                continue
            names = _names(raw, key)
            if key == "from":
                if len(names) != 1:
                    raise FormatError(f"from: needs exactly one name; {USAGE}")
                sender = names[0]
            else:
                if not names:
                    raise FormatError(f"to: needs at least one name (omit to: to address nobody in particular); {USAGE}")
                recipients = tuple(dict.fromkeys(names))
        if Control.MUTE.value in seen and Control.UNMUTE.value in seen:
            raise FormatError(f"use either mute or unmute, not both; {USAGE}")
        if control is not None and ("to" in seen or "re" in seen):
            raise FormatError(f"{control.value} goes to the group itself; drop to:/re:")

    body = body.strip()
    if control is not None:
        if body:
            raise FormatError(f"{control.value} takes no message; send it on its own")
        return Message(sender=sender, recipients=(), body="", control=control)
    if not body:
        raise FormatError(f"empty message; {USAGE}")
    return Message(sender=sender, recipients=recipients, body=body, topic=topic)


# ---------------------------------------------------------------- router

@dataclass(frozen=True)
class Route:
    # Sender and recipients are resolved.
    message: Message
    # Agent names to prompt.
    targets: tuple[str, ...]
    # Muted members the message passed over.
    skipped: tuple[str, ...] = ()


def resolve_sender(message: Message, members: frozenset[str]) -> Message:
    """Check the self-declared sender: it must name a member or the user."""
    if message.sender is None:
        raise FormatError(f"missing from:; {USAGE}")
    if message.sender != USER and message.sender not in members:
        raise FormatError(f"from:{message.sender} is not a group member; members: {_listing(members)}")
    return message


def plan(message: Message, members: frozenset[str], muted: frozenset[str] = frozenset()) -> Route:
    """Every member except the sender, minus muted members not named in to:."""
    sender = message.sender
    unknown = [name for name in message.recipients if name not in members]
    if unknown:
        raise FormatError(f"unknown recipient(s) {', '.join(unknown)}; members: {_listing(members)}")
    recipients = tuple(name for name in message.recipients if name != sender)
    if message.recipients and not recipients:
        raise FormatError("the only recipient is yourself")
    audience = members - {sender}
    passed_over = (audience & muted) - set(recipients)
    return Route(
        message=replace(message, recipients=recipients),
        targets=tuple(sorted(audience - passed_over)),
        skipped=tuple(sorted(passed_over)),
    )


def _listing(members: frozenset[str]) -> str:
    return ", ".join(sorted(members)) or "(none)"


# ---------------------------------------------------------------- herdr

class HerdrError(RuntimeError):
    def __init__(self, method: str, code: str, message: str) -> None:
        super().__init__(f"{method}: {code}: {message}")
        self.method = method
        self.code = code
        self.message = message


@dataclass(frozen=True)
class Agent:
    pane_id: str
    workspace_id: str
    name: str | None
    kind: str
    status: str


class Herdr:
    def __init__(self, socket_path: str | None = None, timeout: float = 5.0) -> None:
        path = socket_path or os.environ.get("HERDR_SOCKET_PATH")
        if not path:
            raise RuntimeError("HERDR_SOCKET_PATH is not set; run inside a Herdr pane")
        self.socket_path = path
        self.timeout = timeout

    def call(self, method: str, params: dict[str, Any]) -> dict[str, Any]:
        request = {"id": f"herdr-group:{time.time_ns()}", "method": method, "params": params}
        with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as sock:
            sock.settimeout(self.timeout)
            sock.connect(self.socket_path)
            sock.sendall((json.dumps(request) + "\n").encode())
            buf = b""
            while not buf.endswith(b"\n"):
                chunk = sock.recv(65536)
                if not chunk:
                    break
                buf += chunk
        response = json.loads(buf)
        if "error" in response:
            error = response["error"]
            raise HerdrError(method, error.get("code", "?"), error.get("message", ""))
        return response.get("result", {})

    def agents(self) -> list[Agent]:
        result = self.call("agent.list", {})
        return [
            Agent(
                pane_id=a["pane_id"],
                workspace_id=a["workspace_id"],
                name=a.get("name"),
                kind=a.get("agent", ""),
                status=a.get("agent_status", "unknown"),
            )
            for a in result.get("agents", [])
        ]

    def prompt(self, target: str, text: str) -> None:
        self.call("agent.prompt", {"target": target, "text": text})

    def report_agent(self, pane_id: str, source: str, agent: str, state: str) -> None:
        self.call(
            "pane.report_agent",
            {"pane_id": pane_id, "source": source, "agent": agent, "state": state, "seq": time.time_ns()},
        )

    def release_agent(self, pane_id: str, source: str, agent: str) -> None:
        self.call(
            "pane.release_agent",
            {"pane_id": pane_id, "source": source, "agent": agent, "seq": time.time_ns()},
        )

    def report_display(self, pane_id: str, source: str, display_agent: str, title: str) -> None:
        self.call(
            "pane.report_metadata",
            {"pane_id": pane_id, "source": source, "display_agent": display_agent, "title": title},
        )

    def rename(self, target: str, name: str) -> None:
        self.call("agent.rename", {"target": target, "name": name})


# ---------------------------------------------------------------- seat

SOURCE = "herdr-group:seat"
PASTE_ON, PASTE_OFF = "\x1b[?2004h", "\x1b[?2004l"
PASTE_START, PASTE_END = "\x1b[200~", "\x1b[201~"
DIM, RED, RESET = "\x1b[2m", "\x1b[31m", "\x1b[0m"


def state_dir(workspace_id: str) -> Path:
    base = Path(os.environ.get("XDG_STATE_HOME") or Path.home() / ".local/state")
    return base / "herdr-group" / workspace_id


def log_path(workspace_id: str, name: str) -> Path:
    return state_dir(workspace_id) / f"{name}.jsonl"


def mute_path(workspace_id: str, name: str) -> Path:
    return state_dir(workspace_id) / f"{name}.muted.json"


class LineInput:
    """Turns terminal bytes into submitted lines.

    ``agent prompt`` writes bracketed-paste-wrapped text then Enter, so a
    pasted multi-line message stays one submission; outside a paste, Enter
    submits. Other escape sequences (arrows etc.) are dropped.
    """

    def __init__(self) -> None:
        self._decoder = codecs.getincrementaldecoder("utf-8")(errors="replace")
        self._pending = ""
        self.buffer = ""
        self.in_paste = False

    def feed(self, data: bytes) -> list[str]:
        text = self._pending + self._decoder.decode(data)
        self._pending = ""
        submitted: list[str] = []
        i = 0
        while i < len(text):
            ch = text[i]
            if ch == "\x1b":
                seq_end = _escape_end(text, i)
                if seq_end is None:
                    self._pending = text[i:]
                    break
                seq = text[i:seq_end]
                if seq == PASTE_START:
                    self.in_paste = True
                elif seq == PASTE_END:
                    self.in_paste = False
                i = seq_end
                continue
            if self.in_paste:
                self.buffer += "\n" if ch == "\r" else ch
            elif ch in "\r\n":
                if self.buffer.strip():
                    submitted.append(self.buffer)
                self.buffer = ""
            elif ch in "\x7f\b":
                self.buffer = self.buffer[:-1]
            elif ch == "\x15":
                self.buffer = ""
            elif ch.isprintable():
                self.buffer += ch
            i += 1
        return submitted


def _escape_end(text: str, start: int) -> int | None:
    """Index just past the escape sequence at ``start``; None if incomplete."""
    if start + 1 >= len(text):
        return None
    if text[start + 1] != "[":
        return start + 2
    for j in range(start + 2, len(text)):
        if "\x40" <= text[j] <= "\x7e":
            return j + 1
    return None


@dataclass(frozen=True)
class Outcome:
    message: Message
    delivered: tuple[str, ...]
    failed: dict[str, str]
    skipped: tuple[str, ...] = ()


class Seat:
    def __init__(self, herdr: Herdr, name: str, kind: str, all_workspaces: bool, out: TextIO) -> None:
        self.herdr = herdr
        self.name = name
        self.kind = kind
        self.all_workspaces = all_workspaces
        self.out = out
        self.pane_id = os.environ["HERDR_PANE_ID"]
        self.workspace_id = os.environ["HERDR_WORKSPACE_ID"]
        self.input = LineInput()
        self.log = log_path(self.workspace_id, name)
        self.mute_file = mute_path(self.workspace_id, name)
        # Survives a seat restart; a name that leaves the group is dropped.
        self.muted: set[str] = set(json.loads(self.mute_file.read_text())) if self.mute_file.exists() else set()

    # -- membership -------------------------------------------------------

    def members(self) -> dict[str, str]:
        """Live named agents in scope, by name -> pane id, excluding this seat."""
        return {
            a.name: a.pane_id
            for a in self.herdr.agents()
            if a.name
            and a.name not in RESERVED
            and a.pane_id != self.pane_id
            and (self.all_workspaces or a.workspace_id == self.workspace_id)
        }

    # -- routing ----------------------------------------------------------

    def route(self, text: str) -> Outcome:
        members = self.members()
        self._set_muted(self.muted & members.keys())
        message = resolve_sender(parse(text), frozenset(members))
        if message.control is not None:
            return self._control(message)
        route = plan(message, frozenset(members), frozenset(self.muted))
        self._report("working")
        delivered: list[str] = []
        failed: dict[str, str] = {}
        try:
            rendered = route.message.render()
            for target in route.targets:
                try:
                    self.herdr.prompt(target, rendered)
                    delivered.append(target)
                except HerdrError as err:
                    failed[target] = err.code
        finally:
            self._report("idle")
        outcome = Outcome(route.message, tuple(delivered), failed, route.skipped)
        self._echo(outcome)
        self._append_log(outcome)
        return outcome

    def _control(self, message: Message) -> Outcome:
        sender = message.sender
        if sender == USER:
            raise FormatError(f"{message.control.value} is for agent seats; user reads the group screen")
        match message.control:
            case Control.MUTE:
                self._set_muted(self.muted | {sender})
            case Control.UNMUTE:
                self._set_muted(self.muted - {sender})
        outcome = Outcome(message, (), {})
        self._echo(outcome)
        self._append_log(outcome)
        return outcome

    def _set_muted(self, muted: set[str]) -> None:
        if muted != self.muted:
            self.muted = muted
            self.mute_file.write_text(json.dumps(sorted(muted)))

    def handle_typed(self, text: str) -> None:
        """A message typed or prompted into the seat; the sender is self-declared."""
        try:
            outcome = self.route(text)
        except FormatError as err:
            self._error(text, str(err))
            self._feedback(text, str(err))
            return
        if outcome.failed:
            self._notify(outcome.message.sender, _failure_text(outcome))

    def _feedback(self, text: str, error: str) -> None:
        """Tell a self-declared sender their message was rejected, if we can tell who they are."""
        try:
            claimed = parse(text).sender
        except FormatError:
            return  # No parseable from: — the sender is unknowable; the screen is all we have.
        if claimed and claimed != USER and claimed in self.members():
            self._notify(claimed, f"your message was not delivered: {error}")

    def _notify(self, target: str | None, text: str) -> None:
        if not target or target == USER:
            return
        try:
            self.herdr.prompt(target, f"[from:{self.name}; to:{target}] {text}")
        except HerdrError as err:
            self._line(f"{RED}  could not notify {target}: {err.code}{RESET}")

    # -- screen and log ---------------------------------------------------

    def _echo(self, outcome: Outcome) -> None:
        stamp = time.strftime("%H:%M:%S")
        head, *rest = outcome.message.render().split("\n")
        lines = [f"{stamp} {head}", *(f"         {line}" for line in rest)]
        status = []
        if outcome.delivered:
            status.append("✓ " + " ".join(outcome.delivered))
        status.extend(f"✗ {name} ({code})" for name, code in outcome.failed.items())
        if outcome.skipped:
            status.append("muted " + " ".join(outcome.skipped))
        if status:
            lines.append(f"{DIM}         {'  '.join(status)}{RESET}")
        self._line("\n".join(lines))

    def _error(self, text: str, error: str) -> None:
        stamp = time.strftime("%H:%M:%S")
        preview = text.strip().replace("\n", " ⏎ ")[:120]
        self._line(f"{RED}{stamp} rejected: {preview}\n         {error}{RESET}")

    def _line(self, text: str) -> None:
        # Keep a human's half-typed line below the output.
        self.out.write(f"\r\x1b[K{text}\n{self._prompt()}")
        self.out.flush()

    def _prompt(self) -> str:
        # One screen line only, so "\r\x1b[K" can always erase it.
        width = shutil.get_terminal_size().columns - 3
        return "» " + self.input.buffer.replace("\n", " ⏎ ")[-width:]

    def _append_log(self, outcome: Outcome) -> None:
        record = {
            "ts": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
            "line": outcome.message.render(),
            "from": outcome.message.sender,
            "to": list(outcome.message.recipients),
            "re": outcome.message.topic,
            "control": outcome.message.control.value if outcome.message.control else None,
            "body": outcome.message.body,
            "delivered": list(outcome.delivered),
            "failed": outcome.failed,
            "skipped": list(outcome.skipped),
        }
        with self.log.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(record, ensure_ascii=False) + "\n")

    def _report(self, state: str) -> None:
        self.herdr.report_agent(self.pane_id, SOURCE, self.kind, state)

    # -- lifecycle --------------------------------------------------------

    def run(self) -> None:
        self.log.parent.mkdir(parents=True, exist_ok=True)
        taken = [a.pane_id for a in self.herdr.agents() if a.name == self.name and a.pane_id != self.pane_id]
        if taken:
            raise SystemExit(f"a group seat named {self.name!r} is already serving on {taken[0]}")
        self._register()
        self.herdr.report_display(self.pane_id, SOURCE + "-display", "group", f"group chat · {self.name}")

        stdin_fd = sys.stdin.fileno()
        saved_tty = _enter_raw(stdin_fd)
        signal.signal(signal.SIGTERM, _raise_exit)
        signal.signal(signal.SIGHUP, _raise_exit)
        selector = selectors.DefaultSelector()
        selector.register(stdin_fd, selectors.EVENT_READ, "tty")
        self.out.write(PASTE_ON)
        self._line(
            f"{DIM}herdr-group seat '{self.name}' on {self.pane_id} · members: "
            f"{', '.join(sorted(self.members())) or '(none yet)'}\n"
            f"  post: herdr agent prompt {self.name} \"[from:<you>; to:<name>] <msg>\"  (direct: herdr agent prompt <peer>)\n"
            f"  {USAGE}\n  log: {self.log}"
            + (f"\n  muted: {', '.join(sorted(self.muted))}" if self.muted else "")
            + RESET
        )
        try:
            while True:
                for _ in selector.select():
                    data = os.read(stdin_fd, 65536)
                    if not data:
                        return
                    for line in self.input.feed(data):
                        self.handle_typed(line)
                    self.out.write(f"\r\x1b[K{self._prompt()}")
                    self.out.flush()
        except KeyboardInterrupt:
            pass
        finally:
            self.out.write(PASTE_OFF + "\n")
            self.out.flush()
            if saved_tty is not None:
                termios.tcsetattr(stdin_fd, termios.TCSADRAIN, saved_tty)
            try:
                self.herdr.release_agent(self.pane_id, SOURCE, self.kind)
            except (HerdrError, OSError):
                pass

    def _register(self) -> None:
        # Herdr picks up the HERDR_AGENT process hint on its own poll, so the
        # pane may not count as an agent yet (notably right after a previous
        # seat released it). Retry until the name sticks.
        deadline = time.monotonic() + 15
        while True:
            self._report("idle")
            try:
                self.herdr.rename(self.pane_id, self.name)
                return
            except HerdrError as err:
                if err.code != "agent_not_found" or time.monotonic() > deadline:
                    raise
            time.sleep(0.5)

def _failure_text(outcome: Outcome) -> str:
    failures = ", ".join(f"{name} ({code})" for name, code in outcome.failed.items())
    return f"not delivered to: {failures}"


def _enter_raw(fd: int) -> list[Any] | None:
    """No echo, no line discipline; keep ISIG so ctrl+c still stops the seat."""
    if not os.isatty(fd):
        return None
    saved = termios.tcgetattr(fd)
    mode = termios.tcgetattr(fd)
    mode[0] &= ~(termios.ICRNL | termios.IXON)
    mode[3] &= ~(termios.ECHO | termios.ICANON)
    mode[6][termios.VMIN] = 1
    mode[6][termios.VTIME] = 0
    termios.tcsetattr(fd, termios.TCSADRAIN, mode)
    return saved


def _raise_exit(signum: int, frame: object) -> None:
    raise KeyboardInterrupt


# ---------------------------------------------------------------- cli

# `agent prompt` only targets a pane whose foreground process Herdr identifies
# as a built-in agent kind; HERDR_AGENT=<kind> in the process environment is
# Herdr's own identification hint. maki is used because it is screen-detected
# only and carries no session-restore behaviour.
DEFAULT_KIND = "maki"


app = typer.Typer(help="Herdr group chat: fan [from: to:] messages out to the team.", no_args_is_help=True, rich_markup_mode=None)
GroupOption = Annotated[str, typer.Option("--group", help="seat name")]


@app.callback()
def main() -> None:
    """Keep `serve` a named subcommand even though it is the only one."""


def _workspace(group: str) -> str:
    if not NAME_RE.match(group) or group in RESERVED:
        raise typer.BadParameter(f"invalid seat name {group!r}", param_hint="--group")
    if os.environ.get("HERDR_ENV") != "1":
        raise typer.Exit(_fail("not running inside a Herdr pane (HERDR_ENV != 1)"))
    return os.environ["HERDR_WORKSPACE_ID"]


def _fail(message: str) -> int:
    typer.echo(f"error: {message}", err=True)
    return 1


@app.command()
def serve(
    group: GroupOption = "group",
    kind: Annotated[str, typer.Option(help="agent kind Herdr sees")] = DEFAULT_KIND,
    all_workspaces: Annotated[bool, typer.Option(help="members span every workspace, not just this one")] = False,
) -> None:
    """Run the group seat in this pane."""
    _workspace(group)
    if os.environ.get("HERDR_AGENT") != kind:
        env = {**os.environ, "HERDR_AGENT": kind}
        os.execvpe(sys.executable, [sys.executable, str(Path(__file__).resolve()), *sys.argv[1:]], env)
    Seat(Herdr(), group, kind, all_workspaces, sys.stdout).run()


if __name__ == "__main__":
    app()
