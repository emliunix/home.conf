# herdr-group

Tests and research for the Herdr group-chat seat. The script itself ships
inside the `herdr-supervisor` skill as a single-file uv script (PEP 723
inline deps): [`../skills/herdr-supervisor/scripts/group.py`](../skills/herdr-supervisor/scripts/group.py).
The skill's SKILL.md is the usage doc (the lead runs the seat; agents DM each
other with `herdr agent prompt <peer> "[from:<you>; to:<peer>] ..."` and post
to the team with `herdr agent prompt group "[from:<you>; to:<name>] ..."`). The tests load that script by its path in this
repo:

```bash
uv run pytest
```

Grammar, as the seat renders it:

```
[from:<sender>; to:<name>[,<name>...]; re:<topic>] <message>   # to: and re: optional
[from:<sender>; mute]                                           # unmute opts back in
```

Every group message reaches every member except the sender; `to:` names who is
expected to act. A muted member receives only group messages that name it in
`to:`. Fields may be separated by `;`, `,` or spaces on input. `to_all`,
`to:all` and `to:user` are rejected with a hint. `all`, `to_all`, `user`,
`mute` and `unmute` are reserved names; `user` is the human, who reads the seat
screen and may type into it.

## Research findings (herdr 0.9.1)

**1. Does a seat know who sent it a message?** Not through Herdr.
`agent.prompt` takes only `{target, text, wait}` (see `research/schema.json`).
Herdr writes the text into the target's terminal as bracketed paste followed by
Enter, and the server log records the method but not the caller. So a message
typed or prompted into the seat is only as trustworthy as its self-declared
`from:`. The seat therefore requires `from:` to name a live member (or `user`). If the
message is malformed or a delivery fails and `from:` names a member, the seat
sends the reason back to that member with `agent prompt`. If `from:` is missing
or unparseable, the sender cannot be known, so the error is only shown on
screen.

An earlier version also served a Unix socket for a `group.py send` client that
proved the sender from `HERDR_PANE_ID` and answered errors synchronously. It
was removed (2026-09-26) to reuse Herdr as much as possible: agents post with
`herdr agent prompt group`, and the seat is the only script command. The team
is cooperative, so a self-declared `from:` is enough.

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

- Herdr refuses a `blocked` recipient (approval UI) with `agent_blocked` and
  writes nothing. The seat reports it as failed to the sender.
- A recipient that is `working` still receives the text in its input, so
  "delivered" means queued. How it is queued depends on that agent's CLI.
- A delivered message arrives as a new user turn in the recipient, so every
  group message interrupts every unmuted idle member.

## Layout

```
tests/        protocol, routing and seat tests against ../skills/herdr-supervisor/scripts/group.py
research/     herdr 0.9.1 docs, API schema, the first probe
```

## Live checks (2026-09-26, herdr 0.9.1, opencode 1.18.32)

- Two opencode agents, briefed only through the group: alice asked bob
  `17*23`, bob answered alice, alice reported `391` to `user`.
- `to_all` broadcast delivered to every member but the sender; `to:all`
  rejected with the `to_all` hint.
- Mute: an opencode agent posted `[from:bob; mute]`; the next `to_all` reached
  only the other agent (`✓ alice  muted bob`), and the mute survived a seat
  restart.
- An agent that polls `history` in a loop while waiting leaves the awaited
  message `QUEUED` in its input until its turn ends. The skill tells
  agents to end their turn instead.

## Live checks (2026-09-26, the DM plus group model)

- Restarted the seat on a six-member workspace. `[from:lead; to:collab_taskboard; re:chat-test]`
  and a plain `[from:lead]` message each reached all five other members; the log
  recorded `to` as `["collab_taskboard"]` and `[]` and `re` as `"chat-test"` and `null`.
- `[from:lead; mute]` and `unmute` logged as controls; `[from:lead; to_all]` was
  rejected with the retirement hint.
