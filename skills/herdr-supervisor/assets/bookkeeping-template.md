# Herdr seat registry - <project>

- Workspace: `<workspace_id>`
- Supervisor: `lead` (`<workspace_id>:p1`)
- Updated: `<timestamp>`
- Permissions: `<mode>`

## Collaboration contract

- Read this file before starting work and whenever the supervisor announces a
  coordination change.
- Address agents by the exact name in the Pane name map.
- Begin every cross-pane message with `[from:<agent_name>]`.
- Peers may communicate directly with one another. Routine coordination does
  not need to pass through `lead`.
- Also notify `lead` of every decision that changes domain meaning, public
  contracts, scope, ownership, dependencies, migration behavior, or acceptance
  criteria. Use:
  `[from:<agent_name>] DECISION: <decision>; rationale: <why>; affects: <artifacts>; owner input: <needed|not needed>`.
- Use `[from:<agent_name>] DONE: ...` for completion and
  `[from:<agent_name>] BLOCKED: ...; needs: ...` for a blocker.
- Only `lead` edits this ledger. Peers report changes through messages.

## Pane name map

This table defines the managed panes watched by the supervisor.

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

- Job ID: `<job_id or not armed>`
- Cadence: `<cadence>`
- Baseline: `/tmp/logs/agent-states.json`
- Supervisor log: `/tmp/logs/p1-supervisor.md`

## Open blockers

| Owner | Blocker | Needs |
| --- | --- | --- |
| `<agent_name>` | `<blocking condition>` | `<agent, lead, owner, or external change>` |
