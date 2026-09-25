# Herdr seat registry - <project>

- Workspace: `<workspace_id>`
- Supervisor: `lead` (`<workspace_id>:p1`)
- Updated: `<timestamp>`
- Permissions: `<mode>`

## Collaboration contract

- Read this file before starting work and whenever `lead` announces a
  coordination change.
- The team is a group chat led by `lead`. Send every cross-pane message
  through the group seat, never with `herdr agent prompt <peer>`:
  - direct: `uv run ~/.claude/skills/herdr-supervisor/scripts/group.py send --to <name>[,<name>...] "<message>"`
  - everyone: the same command without `--to` (to_all). Every idle member
    takes a turn, so broadcast only announcements and coordination changes.
  - The sender is taken from your pane, so do not write `from:`. A non-zero
    exit prints why the message was not delivered.
  - `... group.py mute` stops `to_all` broadcasts reaching you (for long
    heads-down work); `... group.py unmute` restores them. Direct messages
    always arrive.
- Messages reach you as `[from:<name>; to:<names>|to_all] <message>`, each as
  a new turn. Reply with `send --to <name>`. To wait for a reply, end your
  turn; never poll the history or sleep in a loop, because messages queue
  behind a running turn.
- Read the group history with `... group.py history -n 50`.
- Address agents by the exact name in the Pane name map.
- Peers may message one another directly. Routine coordination does not need
  to pass through `lead`. Only `lead` assigns work or starts agents.
- Also notify `lead` of every decision that changes domain meaning, public
  contracts, scope, ownership, dependencies, migration behavior, or acceptance
  criteria, with `--to lead` (or `--to lead,<peer>`):
  `DECISION: <decision>; rationale: <why>; affects: <artifacts>; owner input: <needed|not needed>`.
- Use `DONE: ...` for completion and `BLOCKED: ...; needs: ...` for a blocker.
- Only `lead` edits this ledger. Peers report changes through messages.

## Pane name map

This table defines the managed panes watched by `lead`. Agent names are the
herdr agent names (`herdr agent start <name>` / `herdr agent rename`) and the
group addresses.

| Pane ID | Agent name | Domain | Task type | Ownership |
| --- | --- | --- | --- | --- |
| `<workspace_id>:p2` | `<agent_name>` | `<domain>` | `<task_type>` | `<files or responsibility>` |

## Pane and agent ledger

| Agent name | Status | Current assignment | Last evidence | Next action |
| --- | --- | --- | --- | --- |
| `<agent_name>` | `idle` | `<assignment>` | `<evidence or none>` | `<next action>` |

## Dependencies

| Upstream | Downstream | Gate |
| --- | --- | --- |
| `<agent or artifact>` | `<agent or artifact>` | `<condition>` |

## Shared decisions

| Decision | Affected work | Lead aware | Owner input |
| --- | --- | --- | --- |
| `<decision>` | `<agents or artifacts>` | `yes` | `<needed|not needed>` |

## Heartbeat

- Group seat: `group` (`<workspace_id>:<seat_pane>`, tab `group`); log
  `~/.local/state/herdr-group/<workspace_id>/group.jsonl`

- Job ID: `<job_id or not armed>`
- Cadence: `<cadence>`
- Baseline: `/tmp/logs/agent-states.json`
- Supervisor log: `/tmp/logs/p1-supervisor.md`

## Open blockers

| Owner | Blocker | Needs |
| --- | --- | --- |
| `<agent_name>` | `<blocking condition>` | `<agent, lead, owner, or external change>` |
