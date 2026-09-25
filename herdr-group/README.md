# herdr-group

Tests and research for the Herdr group-chat seat. The script itself ships
inside the `herdr-supervisor` skill as a single-file uv script (PEP 723
inline deps): [`../skills/herdr-supervisor/scripts/group.py`](../skills/herdr-supervisor/scripts/group.py).
The skill's SKILL.md is the usage doc (the lead runs the seat; every agent
posts with `group.py send`). The tests load that script by its path in this
repo:

```bash
uv run pytest
```

Grammar, as the seat renders it:

```
[from:<sender>; to:<name>[,<name>...]] <message>
[from:<sender>; to_all] <message>          # also: no to: at all
[from:<sender>; mute]                      # opt out of to_all; unmute opts back in
```

Fields may be separated by `;`, `,` or spaces on input. `to:all` is an error.
`all`, `to_all`, `user`, `mute` and `unmute` are reserved names; `user` is the human, shown on
the seat screen only.

## Research findings (herdr 0.9.1)

**1. Does a seat know who sent it a message?** Not through Herdr.
`agent.prompt` takes only `{target, text, wait}` (see `research/schema.json`).
Herdr writes the text into the target's terminal as bracketed paste followed by
Enter, and the server log records the method but not the caller. So a message
typed or prompted into the seat is only as trustworthy as its self-declared
`from:`. The seat handles this in two ways:

- Typed or prompted input: `from:` is required and must be a live member (or `user`).
  If the message is malformed but `from:` names a member, the seat sends the
  error back to that member with `agent prompt`. If `from:` is missing or
  unparseable, the sender cannot be known, so the error is only shown on screen.
- `group.py send`: the client passes its `HERDR_PANE_ID`, and the seat resolves the
  name from `agent.list`. The sender therefore comes from Herdr, a mismatched
  `from:` is rejected, and every error is returned synchronously to the caller.
  This path is the one to give agents. It trusts the environment (cooperative
  agents); it does not verify the peer process.

**2. Becoming a seat that `herdr agent prompt` accepts.** Two conditions, both
visible in `src/app/api/agents.rs`:

- `pane.report_agent` with any label makes the pane appear in `agent list`,
  lets you give it a name, and gives it lifecycle state. It is not enough for
  `agent prompt`, which requires a *built-in* agent kind
  (`effective_known_agent`); otherwise it fails with "not an active named agent".
- The kind must also be the pane's foreground process
  (`runtime_hosts_agent`). Herdr identifies the process either by executable
  name or by `HERDR_AGENT=<kind>` in its environment.

So `group.py serve` re-execs itself with `HERDR_AGENT=maki` and reports `maki`
lifecycle state under its own source (`herdr-group:seat`). It sets
`display_agent=group` metadata for the sidebar, reports `working` while
routing (so `agent prompt --wait` settles), and releases authority on exit.
`maki` is used because it is only screen-detected and has no integration or
session resume (`--kind` overrides this). Its screen rules look for a maki status bar and
permission form that the seat never draws.

**3. Shared screen history.** The seat runs on the normal screen (not the
alternate screen), so its output goes into Herdr scrollback and
`agent read --source recent-unwrapped` works. Terminal echo is off; the seat
prints each message once, with a timestamp and delivery status
(`✓ bob  ✗ carol (agent_blocked)`).

## Delivery caveats

- A recipient that is `blocked` (approval UI) is not written to. It is
  reported as failed to the sender, and nothing is queued.
- A recipient that is `working` still receives the text in its input. How it is
  queued depends on that agent's CLI.
- A delivered message arrives as a new user turn in the recipient, so a
  broadcast interrupts every idle member.

## Layout

```
tests/        protocol, routing and seat tests against ../skills/herdr-supervisor/scripts/group.py
research/     herdr 0.9.1 docs, API schema, the first probe
```

## Live checks (2026-09-26, herdr 0.9.1, opencode 1.18.32)

- Two opencode agents, briefed only through the group: alice asked bob
  `17*23`, bob answered alice, alice reported `391` to `user`.
- `to_all` broadcast delivered to every member but the sender; `to:all`
  rejected with the `to_all` hint; a forged `from:` via `send` rejected.
- Mute: an opencode agent ran `group.py mute`; the next `to_all` reached
  only the other agent (`✓ alice  muted bob`), and the mute survived a seat
  restart.
- An agent that polls `history` in a loop while waiting leaves the awaited
  message `QUEUED` in its input until its turn ends. The skill tells
  agents to end their turn instead.
