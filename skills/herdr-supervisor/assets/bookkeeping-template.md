# Herdr seat registry - <project>

- Workspace: `<workspace_id>`
- Supervisor: `lead` (`<workspace_id>:p1`)
- Updated: `<timestamp>`
- Permissions: `<mode>`
- Goal: `<goal source, e.g. goals/NN-topic.md>`

## Goal checklist

The rows that define done for this team. The heartbeat reads them as the
progress record. Tick a row only on fresh evidence, and name where the evidence
is recorded. The first unticked row is the current work.

- [ ] G1. `<outcome>` - owner `<agent or lead>` - evidence: `<test, review, run, or live check>`
- [ ] G2. `<outcome>` - owner `<agent or lead>` - evidence: `<...>`

## Supervisor checklist

Every heartbeat tick works through this list, acts on every "no", and records
non-trivial answers in `/tmp/logs/p1-supervisor.md`.

0. Confidence: skip any question below you are confident about, because
   nothing bearing on it changed since the last tick. Answer only the rest; a
   quiet tick may skip them all.
1. Understanding: do I understand the goal, and does the current work serve
   its requirements and rulings? Re-read the goal source when unsure.
2. Organization: is every open Goal checklist row owned by a named seat or by
   `lead`, with its dependencies met and no two owners on one file? Is any row
   ready but unassigned?
3. Peers: what has each seat done since the last tick (screen, group log,
   working tree)? Does any peer need help: stalled, blocked, looping, going off
   scope, or waiting on an answer from `lead`? Help now.
4. Evidence: did any row gain fresh evidence? Tick it, record it, and start the
   next row.
5. Decisions: is any `DECISION` pending adjudication, or any question only the
   owner can answer? Adjudicate it, or DM the owner once.
6. Hygiene: is work committed at meaningful boundaries? Are the ledger,
   baseline, and group seat current? Are dependent services healthy?
7. Progress: did anything move since the last tick? If nothing moved and no one
   is working, what does `lead` do next? Do it.

## Exit condition

The heartbeat cancels itself in exactly two cases:

- Completed: every Goal checklist row is ticked with evidence.
- Truly blocked: no progress is possible for any seat or for `lead`, because
  every remaining row waits on the owner or an external dependency the team
  cannot resolve. Before exiting, DM the owner one line naming each blocker
  and what it needs, and record the state in the supervisor log.

Idleness, one failure, or one blocked row is not an exit: route around it and
keep working on whatever else can progress.

## Collaboration contract

- Read this file before starting work and whenever `lead` announces a
  coordination change.
- The team is led by `lead`. Every message carries the header
  `[from:<you>; to:<name>[,<name>...]]`; `from:` is required and must be your
  own agent name. There are two paths:
  - DM (default): `herdr agent prompt <name> "[from:<you>; to:<name>] <message>"`
    for questions, answers, hand-offs, and reports to one seat.
  - Group: `herdr agent prompt group "[from:<you>; to:<name>] <message>"`, or
    `"[from:<you>] <message>"` when no one in particular acts. Every member
    except you receives it and `to:` names who acts. Use it only when others'
    work depends on the message: coordination changes, DECISIONs, "X done, Y
    can start". An optional `re:<topic>` tag (e.g. `re:d52`) labels the thread.
  - If the seat rejects a message or a delivery fails, it tells you in a new
    turn from `group`.
  - `[from:<you>; mute]` to the group stops group messages reaching you, except
    ones naming you in `to:`; `[from:<you>; unmute]` restores them. Mute during
    long heads-down work to save turns. DMs always arrive.
- Messages reach you as `[from:<name>; to:<names>] <message>`, each as a new
  turn. Reply only when you are named in `to:` or blocked, with `DONE:`,
  `BLOCKED:`, `DECISION:` or `REVIEW:`; never send a bare acknowledgement.
  To wait for a reply, end your turn; never poll or sleep in a loop, because
  messages queue behind a running turn.
- A discussion that runs past a few messages moves into your unit's worklog or
  report file; the chat carries a pointer.
- Search the group conversation with `herdr agent prompt group "[from:<you>; query] <terms>"`
  (terms: `from:<name>`, `to:<name>`, `re:<topic>`, `last:<N>`, and words in
  the text); the seat answers you alone.
- Address agents by the exact name in the Pane name map.
- Ask the owner of a file or contract directly (see Ownership in the Pane name
  map), not `lead`. Only `lead` assigns work or starts agents.
- A delivered message to a working peer is only queued. Never rely on a chat
  message to serialize a shared resource; the brief or `lead` owns it.
- Also notify `lead` of every decision that changes domain meaning, public
  contracts, scope, ownership, dependencies, migration behavior, or acceptance
  criteria, on the group with `to:lead` (or `to:lead,<peer>`):
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
- Baseline: `/tmp/logs/agent-states.json` (includes the group-log cursor `last_group_ts`)
- Supervisor log: `/tmp/logs/p1-supervisor.md`

## Open blockers

| Owner | Blocker | Needs |
| --- | --- | --- |
| `<agent_name>` | `<blocking condition>` | `<agent, lead, owner, or external change>` |
