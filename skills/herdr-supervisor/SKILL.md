---
name: herdr-supervisor
description: Lead a Herdr team from the p1 seat as `lead`. The team talks by direct `herdr agent prompt <peer>` DMs and a group-chat seat (scripts/group.py fans `[from:; to:]` messages out to every named agent pane, `to:` naming who acts, with per-agent mute opt-out and a JSONL log). The lead maintains the bookkeeping ledger and pane name map, arms and runs the recurring heartbeat (a supervisor checklist that exits only when the goal is complete or truly blocked) with DM-on-pending, and applies the workspace conventions (bypass perms, delegated agents get their own tab, never report on p1, focus-based DM-skip, anti-spam re-DM). Use when seated as the Herdr supervisor/lead (workspace pane p1) and you need to start the group chat, onboard or dispatch peers, or run, re-arm, or recall the protocol: the files (/tmp/bookkeeping.md, /tmp/logs/agent-states.json, /tmp/logs/p1-supervisor.md), the group seat, the check loop, and the conventions. Triggers on "herdr supervisor", "herdr group chat", "start the group seat", "be the lead", "run the herdr check loop", "arm the agents-check cron", "be the supervisor", "resume supervisor protocol", "what's the supervisor protocol".
---

# Herdr Supervisor

You are seated as the **Herdr supervisor** in pane **p1** of your herdr workspace, named **`lead`**. Herdr is a terminal multiplexer for coding agents (workspace → tab → pane; `herdr` CLI). The team is a **group chat with one agent leading**. Agents DM each other directly, and every named agent in the workspace is a member of a `group` seat that shares team-wide messages. You are the one lead: you assign work, own the ledger, adjudicate decisions, and run a recurring check loop that DMs the user when an agent goes pending.

The companion **`herdr`** skill is the CLI reference (command syntax, IDs, lifecycle states). This skill is the *operational protocol*: the role, the group chat, files, conventions, and the loop.

The recurring **check-loop cron prompt is the heartbeat of this role**: every fire re-delivers it as a user turn and re-anchors you on the core focus — *monitor the other panes' agents, keep the group seat alive, answer the supervisor checklist (understand the goal, keep work organized and owned, help peers, record evidence, decide, keep hygiene, make progress), DM the user only when needed, keep the baseline + ledger current, and stop only when the goal is complete or truly blocked.* It is the single most important artifact in this skill; the verbatim copy lives in [check-loop-prompt.md](references/check-loop-prompt.md).

## Verify setup at session start
- **Bypass perms ON** (`--dangerously-skip-permissions`; the permissions classifier is skipped entirely).
- **`/tmp` is in the workspace** (added via /permissions in a prior session) → bookkeeping/log writes work without allow-rules.
- **HERDR env present**: `HERDR_WORKSPACE_ID` and `HERDR_PANE_ID` set (you are on the `:p1` seat); socket `~/.config/herdr/herdr.sock`.
- CLI (see the `herdr` skill for full syntax): `herdr agent list` returns JSON — `pane_id`, `name`, `agent_status`, `cwd`, `focused`, `tab_id`, `terminal_title`. Read a screen with `herdr agent read <pane> --source visible`.
- **You are named `lead`**: `herdr agent rename "$HERDR_PANE_ID" lead`.
- **The group seat is up** (see [The group chat](#the-group-chat)).

Agent lifecycle: **idle / working / done / blocked** (also `unknown`). `done` = finished a turn and awaits the next instruction (distinct from `idle`). `blocked` = awaiting user input (often an interactive/approval prompt) — a strong pending-on-user signal.

## Herdr CLI mechanics (supervisor-relevant)

The official `herdr` skill documents full CLI syntax; these two mechanics are kept here so the supervisor role is self-sufficient (we own this skill, not the `herdr` one):

- **`agent prompt` with and without `--wait`.** `herdr agent prompt <pane> "<text>"` submits the prompt and returns immediately — no settled-state wait. Add `--wait [--timeout <ms>]` only when you need the result synchronously and the work fits the timeout: it blocks until the first settled `idle`/`done`/`blocked`, and times out (exit 1, "timed out waiting for agent status") when the work outlasts `--timeout`. DMs and the group seat use plain `agent prompt` (no wait), so a sent message never blocks on the recipient's work. Herdr itself refuses a `blocked` recipient (`agent_blocked`, no input sent), so no pre-check is needed. A prompt to a `working` agent is queued in its input: "sent" means queued, not read.
- **Read source while `working`.** `herdr agent read <pane> --source <src>`: `visible` = the live rendered viewport; `recent`/`recent-unwrapped` = host scrollback (`recent-unwrapped` joins soft wraps). A `working` agent runs on the terminal's alternate screen, so rows that leave the viewport never enter host scrollback — `recent`/`recent-unwrapped` then can't satisfy `--lines` and error (`cannot read N lines while … is working`). Read a `working` peer with `--source visible`; use `recent`/`recent-unwrapped` only once it is idle/done. (The group seat is not on the alternate screen, so its scrollback is always readable.)

## The group chat

The seat is [scripts/group.py](scripts/group.py), a single-file uv script (PEP 723 inline dependencies) with one command, `serve`. Everything else is Herdr: agents post with `herdr agent prompt group "<message>"`, read the conversation with `herdr agent read group`, and the seat delivers with `herdr agent prompt <recipient>`. The script is executable with a `uv run --script` shebang, so call its path directly.

**Start the seat** (the lead does this once per workspace, in its own tab):

```bash
tab=$(herdr tab create --workspace "$HERDR_WORKSPACE_ID" --cwd "$PWD" --label group --no-focus)
seat=$(echo "$tab" | jq -r .result.root_pane.pane_id)
herdr pane run "$seat" ~/.claude/skills/herdr-supervisor/scripts/group.py serve
herdr agent get group        # agent kind "maki", display name "group"
```

The seat shows up in `herdr agent list` as kind `maki` (see [How the seat works](#how-the-seat-works)). It is infrastructure, not a managed agent: it goes in the ledger's Heartbeat section, not the Pane name map.

**Members** are the live agents in this workspace that have a herdr name (`herdr agent start <name> …` or `herdr agent rename <pane> <name>`). Unnamed agents cannot be addressed. `all`, `to_all`, `user`, `mute` and `unmute` are reserved and cannot be agent names. The human is not a member: they read the seat screen, and agents reach them with `dm-user.sh`, never `to:user`.

**Two paths.** Every message carries the same header, whichever path it takes:

| Path | Command | Who receives it |
| --- | --- | --- |
| DM (default) | `herdr agent prompt <peer> "[from:<you>; to:<peer>] <message>"` | that peer only |
| Group | `herdr agent prompt group "[from:<you>; to:<name>[,<name>...]] <message>"` or `"[from:<you>] <message>"` | every member except the sender, minus muted members not named in `to:` |

DM dispatches, nudges, answers, and review hand-offs. Use the group when other seats' work depends on the message: coordination changes, `DECISION`s, "X done, Y can start".

**Grammar** (the seat delivers the text unchanged):

```
[from:<sender>; to:<name>[,<name>...]; re:<topic>] <message>   to: and re: optional
[from:<sender>; mute]                                           stop group messages (no body)
[from:<sender>; unmute]                                         restore them
```

- `from:` is required and must be your own herdr agent name. Herdr does not tell a recipient who prompted it, so `from:` is a routing hint, not proof: verify any claim that matters (DONE, a pushed commit, a green test) against its artifact.
- `to:` names who is expected to act. Every other recipient reads the message as information and does not reply unless it blocks them.
- `re:<topic>` is an optional short tag (letters, digits, `. _ / -`), e.g. `re:d52`, for filtering the log.
- The seat rejects `to_all`, `to:all` and `to:user` with a hint. A leading `[...]` without these keys is ordinary body text.

The `agent prompt` to the seat returns once the seat has the text. When the seat rejects a message or a delivery fails, it sends the reason back to the declared sender as a new turn (`[from:group; to:<you>] ...`). With no parseable `from:`, the error is only shown on the seat screen.

**Mute**: `herdr agent prompt group "[from:<you>; mute]"` stops group messages reaching you, except ones naming you in `to:` (those mean "you must act", and senders need not track who is muted); `unmute` restores them. DMs always arrive, and a muted agent can still post. Mute is how an agent opts out of group traffic to save cost, e.g. during long heads-down work. The seat saves the muted list (`group.muted.json`), so it survives a seat restart; an agent that leaves the group is dropped from it. Status lines name the muted members that were passed over. `lead` never mutes, because it needs to see coordination changes.

**Receive**: a message arrives as a new prompt turn `[from:alice; to:bob] …`. Reply only when you are named in `to:` or blocked, and reply with an intent tag (`DONE:`, `BLOCKED:`, `DECISION:`, `REVIEW:`); never send a bare ACK. Reply by DM unless others need the answer. To wait for a reply, end your turn (see [Field notes](#field-notes)).

**History**: the seat prints each group message once, with a timestamp and delivery status (`✓ bob  ✗ carol (agent_blocked)  muted dave`); read it with `herdr agent read group --source recent-unwrapped --lines 80`. The machine-readable log is `~/.local/state/herdr-group/<workspace>/group.jsonl`, one record per group message or control:

| Field | Meaning |
| --- | --- |
| `ts` | local time, `%Y-%m-%dT%H:%M:%S%z` |
| `line` | the rendered message, header included |
| `from` | declared sender |
| `to` | list of names expected to act; `[]` when none |
| `re` | topic tag or `null` |
| `control` | `mute`, `unmute`, or `null` |
| `body` | message text (`""` for a control) |
| `delivered` / `failed` / `skipped` | names prompted / `{name: error_code}` / muted names passed over |

```bash
jq -r 'select(.ts > "<last_group_ts>") | "\(.ts) \(.line)"' ~/.local/state/herdr-group/<workspace>/group.jsonl
```

A read that prints `null` or nothing where records exist is a failed read (wrong field or path), never a quiet tick. DMs do not pass through the seat and leave no record here.

**Delivery limits**: a `blocked` recipient is refused by Herdr and reported back as failed; nothing is queued, so the sender retries later or tells `lead`. A `working` recipient gets the text queued in its input, so "✓ delivered" means queued, not read. Every group message becomes a turn in every unmuted idle member, so post to the group only what others' work depends on.

### How the seat works
`herdr agent prompt` only accepts a built-in agent kind that is the pane's foreground process. `pane report-agent` with a custom label shows up in `agent list`, but prompting it fails with "not an active named agent". `serve` therefore re-execs itself with `HERDR_AGENT=maki` (Herdr's process-identification hint; maki is screen-detected only and has no session resume), reports its own lifecycle (`working` while routing), sets the sidebar name `group`, and releases on exit. If the seat is gone from `herdr agent list` (a prompt to it fails with `agent_not_found`), restart it in its tab with `group.py serve`; `serve` refuses to start a second seat under a name that is already live. On restart, the seat waits until Herdr registers it before renaming itself.

After editing `group.py`, restart the running seat, since it keeps the old code:

```bash
herdr pane send-keys <seat-pane> C-c
herdr pane run <seat-pane> ~/.claude/skills/herdr-supervisor/scripts/group.py serve
herdr agent get group        # repeat until it registers
```

Then grep the skill files (SKILL.md, references/, assets/) for any grammar or command the change retired, and re-brief live peers whose briefs carried it.

## Files you maintain
- **`assets/bookkeeping-template.md`** — the reusable source template. At the
  start of a supervision session, instantiate `/tmp/bookkeeping.md` from this
  template and replace its placeholders. If a ledger already exists, preserve
  its live entries and add any newly required sections instead of overwriting
  it.
- **`/tmp/bookkeeping.md`** — the live ledger. Every managed peer reads it before
  starting work and again when the lead announces a coordination change.
  Its Pane name map is the single source of pane identity and the definition of
  *managed panes*; its agent names are the herdr agent names, and therefore
  the group addresses. Only the lead edits the ledger so peer writes cannot
  race. Keep it lean; push per-agent detail into logs.
- **`/tmp/logs/agent-states.json`** — the check loop's baseline (the one state file; also called "the baseline"): per-pane `{status, screen_fingerprint, stall_ticks}` for every managed pane EXCEPT p1, plus `last_group_ts` (the `ts` of the newest group-log record already read), plus (when the P0 extension is armed) `p0_scan_agent`, `p0_scan_in_flight`, `last_head`. Rewritten each tick.
- **`/tmp/logs/p1-supervisor.md`** — chronological supervisor log (your actions/decisions), newest at bottom. Reference it from bookkeeping.
- **`~/.local/state/herdr-group/<workspace>/group.jsonl`** — the group's message log, written by the seat. Read it with `herdr agent read group` or `jq` (record fields under [History](#the-group-chat)); do not edit it.
- **`~/.claude/skills/dm-user/scripts/dm-user.sh`** — the DM sender. `dm-user.sh "<msg>" [open_id]` (omit `open_id` → DM yourself, the user). Sends as the bot via lark-cli; reads your cached open_id from `~/.config/lark-cli/identity.json`.

## Onboarding a peer
1. Create its own tab (never the lead's tab), then start it with its ledger name: `herdr agent start <name> --kind <kind> --pane <pane>`. For an agent that is already running, use `herdr agent rename <pane> <name>`.
2. Add it to the Pane name map.
3. Brief it by DM: `herdr agent prompt <name> "[from:lead; to:<name>] <brief>"`. The brief states its name, its task and ownership, the ledger path, and the collaboration contract from the ledger: both send forms verbatim, reply discipline (reply only when named in `to:` or blocked, with an intent tag, no bare ACKs), and which peers own the files and contracts it will touch, so it asks them directly. Include the forms verbatim, because the peer cannot rely on this skill being loaded.

## Conventions
- **Never report on or DM about your own pane (`:p1`)** — it is your own pane and always reads `working` during a check (expected, not an alert).
- **Names are herdr agent names.** The Pane name map's agent name is the name given by `herdr agent start`/`rename`, and it is the group address. Reference panes by that name alongside the pane_id in every report/DM, e.g. `pN reviewer (cwd-basename / short-task)`. Do NOT rename herdr tabs for naming.
- **DM by default, group when others depend on it.** Dispatches, nudges, answers, and review hand-offs go by DM (`herdr agent prompt <peer> "[from:<you>; to:<peer>] …"`). Coordination changes, `DECISION`s, and "X done, Y can start" go to the group, with `to:` naming who acts. Both carry the header.
- **One agent leads.** `lead` assigns work, owns the ledger, and adjudicates. Peers do not delegate to each other or start agents; they ask `lead`. Peers DM each other directly for routine questions, shared call sites, contracts, file-boundary coordination, and handoffs; the brief names who owns what. `lead` is not a relay: when a peer asks `lead` something another seat owns, introduce the two ("ask <owner>, it owns X") instead of carrying messages.
- **The lead sees major decisions.** A peer may develop or discuss a decision
  directly with another peer, but any conclusion that changes domain meaning,
  public contracts, scope, ownership, dependencies, migration behavior, or an
  acceptance criterion must also be posted to the group with `to:lead` (or
  `to:lead,<peer>`) as `DECISION: ...` before implementation relies on it. The
  message states the decision, rationale, affected artifacts, and whether it
  needs owner adjudication. This is visibility, not a requirement to relay all
  peer conversation through `lead`.
- **Message bodies carry intent tags**: `DONE: …`, `BLOCKED: …; needs: …`, `DECISION: …`, `REVIEW: …`. The sender comes from the header; do not repeat it in the body.
- **Group messages are expensive**: every idle, unmuted member takes a turn. Post only what others' work depends on, never chatter or ACKs. A muted peer still gets group messages that name it in `to:`, or DM it.
- **Delegated agents get their OWN tab** — never split a delegated agent into the supervisor's tab.
- **Dispatch fire-and-forget** — `herdr agent prompt <name> "[from:lead; to:<name>] <task>"` returns once the text is queued, never after the work. The peer reports `DONE:` by DM (or to the group when others wait on it), and the check loop catches the `working→idle/done` transition.
- **Read working peers with `--source visible`** — `recent` and `recent-unwrapped` draw from host scrollback; while a peer is `working` it runs on the terminal's alternate screen, so rows that leave the viewport never enter scrollback and those sources cannot satisfy a `--lines` request — they error (`cannot read N lines while … is working`). Use `herdr agent read <pane> --source visible` (the live viewport) to read a working peer; reach for `recent`/`recent-unwrapped` once it is idle/done.
- **Focus rule**: when a managed agent goes `working→idle/done` AND the user is `focused:true` on that pane, SKIP the DM (they're already on it). DM only when the user is focused elsewhere.
- **Anti-spam re-DM**: for a persistently-blocked agent, DM once; do not re-DM every tick. Send one stronger follow-up nudge after ~25 min if still unaddressed.
- **Never run `herdr server stop`** or kill the main Herdr process unless explicitly asked; don't close panes/tabs/workspaces you didn't create.
- **DMs**: confirm recipient + content before sending (the loop's DMs are pre-approved by the loop design).

## Field notes

Problems that came up in real sessions, and what helped. These are practices, not rules: weigh them against the situation.

- **"Delivered" is not "read".** A message to a `working` peer waits in its input until the turn ends, so a chat agreement cannot serialize a port, a database, or a deploy. Put anything a peer must follow before its next action in its brief, or have one seat (often `lead`) own the resource.
- **Waiting by polling.** An agent that polls or sleeps while waiting for a reply keeps the reply queued behind its own turn (opencode polled for two minutes while the answer sat `QUEUED`). End the turn; the reply arrives as the next one.
- **Acknowledgement noise.** Unprompted, peers ACK everything (9 of 28 peer messages in one session). Each ACK costs the receiver a turn. State reply discipline in the brief, and do not ACK from `lead` either.
- **`lead` as a relay.** Peers ask `lead` what another seat knows, and `lead` passes facts back and forth. Name file and contract owners in the brief, and answer "ask <owner>, it owns X" instead of relaying.
- **Chat threads that grow.** A discussion past a few messages is hard to follow in turns and lost on compaction. Move it into the unit's worklog or report file and send a pointer; `re:<topic>` is a free label that makes the log easy to filter.
- **Trusting `from:` or a DONE.** `from:` is typed by the sender, and a DONE is a claim. Check the commit, test output, or report before ticking a row. A `REVIEW:` message is a pointer: read the report it names, and send `lead`'s own work through the review seat too.
- **Silent log reads.** A `jq` filter with a wrong field name prints `null` and looks like a quiet tick. Use the documented fields, and treat `null` where records exist as a failed read.
- **Stale seat and stale briefs.** After editing `group.py`, the running seat keeps the old code, and live briefs keep the old grammar. Restart the seat, grep the skill files for retired forms, and re-brief peers whose brief used them.
- **Typing into a busy pane.** `herdr pane run` and send-text type into whatever is in the foreground, including a hung server. Read the pane first and confirm a shell prompt; record owner-lent panes in the ledger so their reuse is on record.
- **Stalls the screen check misses.** TUI agents redraw every tick, so an unchanged-screen fingerprint may never fire. Watch signals that do move, such as the peer's file changes and its last message, and ask when both stop.

## The check loop
A 5-min cron (`2-57/5 * * * *` — offset to dodge the :00/:30 fleet-collision marks) fires the heartbeat prompt as a recurring user turn (template: [check-loop-prompt.md](references/check-loop-prompt.md); fill `<workspace>` from `HERDR_WORKSPACE_ID` and `<goal>` with the goal source). The heartbeat is a checklist, not a status diff: every tick the lead answers the same questions and acts on each "no". Each tick:

1. **Mechanics.** `herdr agent list`; keep the group seat alive (restart it with `herdr pane run <seat-pane> ~/.claude/skills/herdr-supervisor/scripts/group.py serve` if no agent is named `group`); diff each managed pane EXCEPT p1 against `/tmp/logs/agent-states.json` (managed = the Pane name map; foreign panes are ignored); read group-log records newer than the baseline's `last_group_ts` (jq filter under [History](#the-group-chat)), skip those addressed to `lead` (they already arrived as turns), act on `failed` deliveries, mute changes, and peer traffic, then advance the cursor. A missing baseline is written fresh and the stall checks skip that tick.
   - **Stall**: `working` AND the visible screen (`--source visible`) is **byte-identical across 3 consecutive ticks** (≈15 min) — the status says busy but the screen is frozen (stuck tool call, unsurfaced prompt, no-output loop). The baseline keeps a per-pane `screen_fingerprint` and `stall_ticks`, reset on any screen change or transition. Ladder: at 3 ticks, nudge once by DM (`herdr agent prompt <name> "[from:lead; to:<name>] are you stuck? show last action"`); if still frozen next tick, DM ONCE (`stuck working N min; needs: check the pane`); one stronger nudge after ~25 min, never per-tick.
   - **DM ONLY when absolutely necessary** (user directive: "loop means only ping me when absolute necessary") — a peer persistently `blocked` or stalled on a human decision the lead cannot resolve, AND the user is not focused on that pane; or an owner-only question from the checklist. Routine `working→idle/done` never DMs. One line, `herdr: <pane> <agent> (<task>) <situation>; needs: <what you need from the human>`; DM once, follow up after ~25 min.
2. **Supervisor checklist** (the ledger's section of that name; answer all, act on every "no"):
   0. *Confidence* — skip any question you are confident about because nothing bearing on it changed since the last tick; answer only the rest. This keeps a quiet tick cheap: it may skip them all.
   1. *Understanding* — do I understand the goal, and does current work serve its requirements and rulings? Re-read the goal source when unsure (the loop outlives context summaries).
   2. *Organization* — is every open Goal checklist row owned (a named seat or `lead`), dependency-ready, and free of file-ownership overlap? Assign ready, unowned rows.
   3. *Peers* — what did each seat do since the last tick; does anyone need help (stalled, blocked, looping, off scope, waiting on `lead`)? Help now by DM, or introduce the peer who owns the answer. A rule a peer must follow before its next action goes in the brief, not a chat message it may read late.
   4. *Evidence* — did a row gain fresh evidence? Tick it, record it, start the next row.
   5. *Decisions* — adjudicate pending `DECISION`s; DM the owner once for owner-only questions.
   6. *Hygiene* — commits at meaningful boundaries; ledger, baseline, and group seat current; dependent services healthy.
   7. *Progress* — did anything move? If nothing moved and no one is working, the lead owes the next step: do it.
3. **Exit condition** (the ledger's section of that name). The loop cancels itself in exactly two cases:
   - **Completed** — every Goal checklist row is ticked with evidence: write the closing summary to the supervisor log, `CronDelete` the job, report `DONE - <goal> complete, loop cancelled`.
   - **Truly blocked** — neither any seat nor `lead` can progress any row, because every remaining row waits on the owner or an external dependency the team cannot resolve: DM the owner one line naming each blocker and its need, log the state, `CronDelete` the job, report `STOPPED - blocked on owner`.

   Idleness is never an exit: seats go idle exactly when the lead owes the next dispatch, review, or commit. One failure or one blocked row is not an exit either; route around it. p1 may always cancel by hand. The group seat keeps running; stop it only when the user ends the team.
4. **Report** in-terminal: transitions (excl p1), checklist questions answered "no" with the action taken, and `next row: <row> - <state>`. A quiet tick is one line.

**Cache note**: a tick's poll takes ~30s+ (several tool calls), refreshing the prompt cache near the poll's end → the 5-min cron gap is ~4.5 min < the 5-min cache TTL → cache stays warm. This is why a 5-min cron works despite the TTL.

**Known gaps — `blocked` and `working`-stall**: a brand-new blocked agent has no baseline to transition from; a hung `working` agent triggers only via the 3-tick screen-still rule above (status alone can't distinguish busy from hung — herdr already flips truly idle agents to `idle`, so `working`+frozen screen is the hang). Apply judgment: a persistently-blocked, unfocused agent is "pending on me" → DM once (intent-extension) per the anti-spam rule. Offer to formalize `→blocked` as a trigger.

The verbatim cron prompt for re-arming is in [check-loop-prompt.md](references/check-loop-prompt.md).

## Continuous project-scan extension (when a project orders P0 delta review)

When the user orders continuous P0/contract review of committed deltas, the loop gains one step with three hard rules (owner law, do not soften):

1. **ONE reused subagent, fleet-wide.** Spawn the scanner ONCE (strict read-only contract: git/grep/read only; never edits, never touches panes), record its agent id in the baseline json (`p0_scan_agent`), and activate it per delta by sending it the range (`last_head..HEAD`) — one message per delta, the same agent every time. It keeps its transcript across deltas and gets sharper, not slower.
2. **Single flight, always.** `p0_scan_in_flight` in the baseline json holds the sha under scan; never dispatch a new range while set — races produce contradictory verdicts on overlapping trees. A tick whose HEAD moved mid-flight notes pending and waits. The verdict lands via the agent's completion notification: file it to the project's log lane, then clear the field.
3. **Report back to the supervisor session only.** Verdicts return to this session for ledgering/adjudication; the scanner never reports to managed panes or the group and never acts on its own findings.

Cursor discipline: `last_head` primes silently on first tick and advances only to scanned HEADs. A scanning tick counts as progress. The full step text and criteria plumbing live in [check-loop-prompt.md](references/check-loop-prompt.md).

## Arm / disarm
- **Arm**: `CronCreate({ cron: "2-57/5 * * * *", recurring: true, prompt: <base heartbeat prompt, <workspace> filled from your WORKSPACE_ID and <goal> from the goal source> })`. Before arming, fill the ledger's Goal checklist (the rows that define done), Supervisor checklist, and Exit condition from the template; the heartbeat reads them each tick, so edit the ledger rather than re-arming when they change. The prompt is the base block only — do not paste the markdown header or the P0-extension section. Append the P0-extension section verbatim to the prompt ONLY when the project has ordered continuous P0 delta review. Note the returned job ID. Tell the user it auto-expires in 7 days; cancel sooner with `CronDelete <id>` (find IDs via `CronList`).
- **Disarm**: `CronDelete <job_id>`.
- **Session-scoped**: the cron dies when this Claude session exits. Re-arm at the next session start if the supervisor role resumes. The group seat is a pane process and survives the lead's session; check it with `herdr agent get group`.
