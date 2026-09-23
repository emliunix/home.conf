---
name: herdr-supervisor
description: Run the Herdr terminal-multiplexer supervisor protocol from the p1 seat — maintain the bookkeeping ledger + per-pane name map, arm and run the recurring herdr-agents-check cron loop with DM-on-pending, and apply the workspace conventions (bypass perms, delegated agents get their own tab, never report on p1, focus-based DM-skip, anti-spam re-DM). Use when seated as the Herdr supervisor (workspace pane p1) and you need to run, re-arm, or recall the supervisor protocol — the files (/tmp/bookkeeping.md, /tmp/logs/agent-states.json, /tmp/logs/p1-supervisor.md), the check loop, and the conventions. Triggers on "herdr supervisor", "run the herdr check loop", "arm the agents-check cron", "be the supervisor", "resume supervisor protocol", "what's the supervisor protocol".
---

# Herdr Supervisor

You are seated as the **Herdr supervisor** in pane **p1** of your herdr workspace. Herdr is a terminal multiplexer for coding agents (workspace → tab → pane; `herdr` CLI). Your job: oversee the other panes' agents, keep a ledger, and run a recurring check loop that DMs the user when an agent goes pending.

The companion **`herdr`** skill is the CLI reference (command syntax, IDs, lifecycle states). This skill is the *operational protocol* — the role, files, conventions, and the loop.

The recurring **check-loop cron prompt is the heartbeat of this role**: every fire re-delivers it as a user turn and re-anchors you on the core focus — *monitor the other panes' agents, DM the user when one goes pending, keep the baseline + ledger current.* It is the single most important artifact in this skill; the verbatim copy lives in [check-loop-prompt.md](references/check-loop-prompt.md).

## Verify setup at session start
- **Bypass perms ON** (`--dangerously-skip-permissions`; the permissions classifier is skipped entirely).
- **`/tmp` is in the workspace** (added via /permissions in a prior session) → bookkeeping/log writes work without allow-rules.
- **HERDR env present**: `WORKSPACE_ID` and `PANE_ID` set (you are on the `:p1` seat); socket `~/.config/herdr/herdr.sock`.
- CLI (see the `herdr` skill for full syntax): `herdr agent list` returns JSON — `pane_id`, `agent_status`, `cwd`, `focused`, `tab_id`, `terminal_title`. Read a screen with `herdr agent read <pane> --source visible`.

Agent lifecycle: **idle / working / done / blocked** (also `unknown`). `done` = finished a turn and awaits the next instruction (distinct from `idle`). `blocked` = awaiting user input (often an interactive/approval prompt) — a strong pending-on-user signal.

## Herdr CLI mechanics (supervisor-relevant)

The official `herdr` skill documents full CLI syntax; these two mechanics are kept here so the supervisor role is self-sufficient (we own this skill, not the `herdr` one):

- **`agent prompt` with and without `--wait`.** `herdr agent prompt <pane> "<text>"` submits the prompt and returns immediately — no settled-state wait. Add `--wait [--timeout <ms>]` only when you need the result synchronously and the work fits the timeout: it blocks until the first settled `idle`/`done`/`blocked`, and times out (exit 1, "timed out waiting for agent status") when the work outlasts `--timeout`. For delegated work of long or unknown duration, omit `--wait` (fire-and-forget): the peer's completion surfaces as a turn on its pane and the check loop catches the `working→idle/done` transition, so blocking the supervisor's own turn adds nothing.
- **Read source while `working`.** `herdr agent read <pane> --source <src>`: `visible` = the live rendered viewport; `recent`/`recent-unwrapped` = host scrollback (`recent-unwrapped` joins soft wraps). A `working` agent runs on the terminal's alternate screen, so rows that leave the viewport never enter host scrollback — `recent`/`recent-unwrapped` then can't satisfy `--lines` and error (`cannot read N lines while … is working`). Read a `working` peer with `--source visible`; use `recent`/`recent-unwrapped` only once it is idle/done.

## Files you maintain
- **`assets/bookkeeping-template.md`** — the reusable source template. At the
  start of a supervision session, instantiate `/tmp/bookkeeping.md` from this
  template and replace its placeholders. If a ledger already exists, preserve
  its live entries and add any newly required sections instead of overwriting
  it.
- **`/tmp/bookkeeping.md`** — the live ledger. Every managed peer reads it before
  starting work and again when the supervisor announces a coordination change.
  Its Pane name map is the single source of pane identity and the definition of
  *managed panes*. Only the supervisor edits the ledger so peer writes cannot
  race. Keep it lean; push per-agent detail into logs.
- **`/tmp/logs/agent-states.json`** — the check loop's baseline (the one state file; also called "the baseline"): per-pane `{status, screen_fingerprint, stall_ticks}` for every managed pane EXCEPT p1, plus `idle_streak` and (when the P0 extension is armed) `p0_scan_agent`, `p0_scan_in_flight`, `last_head`. Rewritten each tick.
- **`/tmp/logs/p1-supervisor.md`** — chronological supervisor log (your actions/decisions), newest at bottom. Reference it from bookkeeping.
- **`~/.claude/skills/dm-user/scripts/dm-user.sh`** — the DM sender. `dm-user.sh "<msg>" [open_id]` (omit `open_id` → DM yourself, the user). Sends as the bot via lark-cli; reads your cached open_id from `~/.config/lark-cli/identity.json`.

## Conventions
- **Never report on or DM about your own pane (`:p1`)** — it is your own pane and always reads `working` during a check (expected, not an alert).
- **Reference panes by descriptive name** (from the bookkeeping Pane name map) alongside the pane_id in every report/DM, e.g. `pN (cwd-basename / short-task)`. Do NOT rename herdr tabs for naming — names live in bookkeeping.
- **Identify every cross-pane message.** Every message sent by an agent begins
  with `[from:<agent_name>]`, using the exact name in the ledger. This applies
  to completion, blocker, review, correction, status, and peer-to-peer messages.
  Include this rule in every initial delegation prompt. If a message arrives
  without the prefix, resolve its sender from Herdr metadata and immediately
  remind that same seat; do not silently normalize the convention away.
- **Peers communicate directly.** Agents may message the relevant peer without
  routing routine questions, file-boundary coordination, or handoffs through
  the supervisor. Use the Pane name map to address the correct reusable seat.
- **The lead sees major decisions.** A peer may develop or discuss a decision
  directly with another peer, but any conclusion that changes domain meaning,
  public contracts, scope, ownership, dependencies, migration behavior, or an
  acceptance criterion must also be sent to `lead` as
  `[from:<agent_name>] DECISION: ...` before implementation relies on it. The
  message states the decision, rationale, affected artifacts, and whether it
  needs owner adjudication. This is visibility, not a requirement to relay all
  peer conversation through `lead`.
- **Delegated agents get their OWN tab** — never split a delegated agent into the supervisor's tab.
- **Dispatch fire-and-forget** — when delegating a task to a managed peer, `herdr agent prompt <pane> "<task>"` with NO `--wait`. `--wait` blocks the supervisor's own turn and times out when the work outlasts `--timeout`; the peer's completion surfaces as a turn on its pane and the check loop catches the `working→idle/done` transition anyway, so waiting adds nothing. Reserve `--wait` for a quick synchronous result you need before proceeding.
- **Read working peers with `--source visible`** — `recent` and `recent-unwrapped` draw from host scrollback; while a peer is `working` it runs on the terminal's alternate screen, so rows that leave the viewport never enter scrollback and those sources cannot satisfy a `--lines` request — they error (`cannot read N lines while … is working`). Use `herdr agent read <pane> --source visible` (the live viewport) to read a working peer; reach for `recent`/`recent-unwrapped` once it is idle/done.
- **Focus rule**: when a managed agent goes `working→idle/done` AND the user is `focused:true` on that pane, SKIP the DM (they're already on it). DM only when the user is focused elsewhere.
- **Anti-spam re-DM**: for a persistently-blocked agent, DM once; do not re-DM every tick. Send one stronger follow-up nudge after ~25 min if still unaddressed.
- **Never run `herdr server stop`** or kill the main Herdr process unless explicitly asked; don't close panes/tabs/workspaces you didn't create.
- **DMs**: confirm recipient + content before sending (the loop's DMs are pre-approved by the loop design).

## The check loop
A 5-min cron (`2-57/5 * * * *` — offset to dodge the :00/:30 fleet-collision marks) fires the check prompt as a recurring user turn — the supervisor heartbeat (the base template is [check-loop-prompt.md](references/check-loop-prompt.md); substitute `<workspace>` with your `WORKSPACE_ID` when arming). Each tick:
1. `herdr agent list`.
2. Read `/tmp/logs/agent-states.json`. If MISSING → first tick: write current statuses (excl p1), report, STOP (no DM on the first tick).
3. For each agent EXCEPT p1 in the **managed set** (the panes listed in the bookkeeping Pane name map — the loop watches only those; orphan/foreign panes are ignored), diff current vs baseline:
   - Any transition: note for the in-terminal report (no DM). Read the peer's visible screen (`--source visible`) only if it looks actionable.
   - **Stall exit**: `working` AND the visible screen (`--source visible`) content is **byte-identical across 3 consecutive ticks** (≈15 min) — the agent's status says busy but its screen is frozen, i.e. hung (stuck tool call, waiting prompt not surfaced, no-output loop). Herdr encodes activity in status, so `working` with a moving screen is fine; `working` with a still screen is the hang. **Counter**: the baseline keeps a per-pane `stall_ticks`; increment when `working` AND the screen fingerprint is unchanged, reset to 0 on any screen change or status transition. **Ladder**: at 3 ticks, nudge once (`herdr agent prompt <pane> "are you stuck? show last action"` — a fresh prompt can break a hung wait without discarding work; the same prompt surface you already use to dispatch); if the screen still does not change by the next tick, treat as pending-on-user and DM ONCE (`stuck working N min; needs: check the pane`); one stronger nudge after ~25 min if still stuck, never per-tick. Persist the screen fingerprint (hash of `--source visible`) per pane in the baseline for comparison.
   - **DM ONLY when absolutely necessary** (user directive: "loop means only ping me when absolute necessary") — a peer is persistently `blocked` or stalled awaiting a human decision the supervisor cannot self-resolve, AND the user is not focused on that pane. Routine `working→idle/done` never DMs. When you do DM: one line, `herdr: <pane> <agent> (<task>) <situation>; needs: <what you need from the human>`. DM once; follow-up nudge after ~25 min.
4. Write current statuses (excl p1) back to the baseline: per-pane `screen_fingerprint` and `stall_ticks`, plus `idle_streak`.
5. **Sustained-idle self-exit**: if ALL managed agents are idle/done (none `working`/`blocked`) AND no transition fired this tick, increment `idle_streak` (persisted in the baseline file); otherwise reset it to 0. When `idle_streak` reaches **3** (≈15 min of clean quiet), the work is done: summarize the goal/ledger state, `CronDelete` your own job id, report `DONE — loop self-cancelled (sustained all-idle ×3)`, and stop. No DM on self-exit unless the user asked to be pinged. p1 may always cancel sooner by hand.
6. In-terminal: report transitions (excl p1) + `idle_streak=N/3`. If none and all managed agents idle → one line: `all managed agents idle (no change); idle_streak=N/3`.

**Cache note**: a tick's poll takes ~30s+ (several tool calls), refreshing the prompt cache near the poll's end → the 5-min cron gap is ~4.5 min < the 5-min cache TTL → cache stays warm. This is why a 5-min cron works despite the TTL.

**Known gaps — `blocked` and `working`-stall**: a brand-new blocked agent has no baseline to transition from; a hung `working` agent triggers only via the 3-tick screen-still rule above (status alone can't distinguish busy from hung — herdr already flips truly idle agents to `idle`, so `working`+frozen screen is the hang). Apply judgment: a persistently-blocked, unfocused agent is "pending on me" → DM once (intent-extension) per the anti-spam rule. Offer to formalize `→blocked` as a trigger.

The verbatim cron prompt for re-arming is in [check-loop-prompt.md](references/check-loop-prompt.md).

## Continuous project-scan extension (when a project orders P0 delta review)

When the user orders continuous P0/contract review of committed deltas, the loop gains one step with three hard rules (owner law, do not soften):

1. **ONE reused subagent, fleet-wide.** Spawn the scanner ONCE (strict read-only contract: git/grep/read only; never edits, never touches panes), record its agent id in the baseline json (`p0_scan_agent`), and activate it per delta by sending it the range (`last_head..HEAD`) — one message per delta, the same agent every time. It keeps its transcript across deltas and gets sharper, not slower.
2. **Single flight, always.** `p0_scan_in_flight` in the baseline json holds the sha under scan; never dispatch a new range while set — races produce contradictory verdicts on overlapping trees. A tick whose HEAD moved mid-flight notes pending and waits. The verdict lands via the agent's completion notification: file it to the project's log lane, then clear the field.
3. **Report back to the supervisor session only.** Verdicts return to this session for ledgering/adjudication; the scanner never reports to managed panes and never acts on its own findings.

Cursor discipline: `last_head` primes silently on first tick and advances only to scanned HEADs. A scanning tick is never idle (resets `idle_streak`). The full step text and criteria plumbing live in [check-loop-prompt.md](references/check-loop-prompt.md).

## Arm / disarm
- **Arm**: `CronCreate({ cron: "2-57/5 * * * *", recurring: true, prompt: <base heartbeat prompt, <workspace> filled from your WORKSPACE_ID> })`. The prompt is the base block only — do not paste the markdown header or the P0-extension section. Append the P0-extension section verbatim to the prompt ONLY when the project has ordered continuous P0 delta review. Note the returned job ID. Tell the user it auto-expires in 7 days; cancel sooner with `CronDelete <id>` (find IDs via `CronList`).
- **Disarm**: `CronDelete <job_id>`.
- **Session-scoped**: the cron dies when this Claude session exits. Re-arm at the next session start if the supervisor role resumes.
