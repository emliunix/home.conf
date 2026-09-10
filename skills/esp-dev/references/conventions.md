# Repo conventions: logging, docs, commits

Shared by `vibe-s3`, `nfcplay` (and mirrored in spirit by `vibe-s31`). Ports
between projects on purpose; keep them aligned.

## Firmware logging — no silent failure

Applies to application code under `firmware/*/main/`, not IDF/managed components.

`ESP_FAIL` (or anything that becomes a non-`ESP_OK` to a caller) **must** be
logged either:

1. at the fail site, or
2. somewhere up the propagation path — a caller that handles or returns the error
   must `ESP_LOGE` it with context (typically including `esp_err_to_name(err)`).

`return err;` with no log anywhere on the path is the bug. Prefer one clear log at
the root cause; avoid logging every hop on a path that already logs at its leaf or
at the soft-fail handler.

Related product-level rule (vibe-s3 UX): every async step surfaces
loading / success / error to the user — a silent failure is a product bug, not
just a logging nit.

## Where things live

| Kind | Location |
| --- | --- |
| Feature design / plan | `design/NN-<topic>.md` |
| Shared wire/protocol reference | `docs/reference/` (designs point here) |
| Cross-cutting practices | `docs/mcu-practices.md`, `docs/soak-sop.md`, `docs/os_tasks.md`, `docs/*-programming.md` |
| Cross-cutting agent rules | `AGENTS.md`, `rules/*.md` |
| Hardware reference (web-sourced, links inline) | `board.md` |
| Research / spikes | `research/`, `esp-sr.md` |
| Goal (frozen owner words + rationale) | `goals/<goal>.md`, archived to `archives/` when closed |
| Dated ledger ("what did I do / rule / try") | `worklog/` |
| Progress tracker (optional) | `status.md` |
| Firmware / host code | `firmware/`, `host/` |

**Forbidden root living docs:** `plan.md`, `goal.md`, `task.md`. Architecture
plans belong in a numbered design; product intent belongs in `AGENTS.md` or the
goal file; one-shot task briefs are temporary and must not be committed.

## Design doc expectations

Sections that keep `flow-grill-review` / `flow-retro` usable:

- Goal / Scope / Verification criteria / Key decisions
- Review log / revision history (from the grill)
- Retrospective with Keep / Problems / Lessons / Design revisions
- Explicit `Status: draft` or `Status: landed`

When a later design supersedes an earlier one, say so at the top of the new doc
and point implementers at the canonical file only. One normative home per topic
(e.g. vibe-s3 keeps UI/view rules solely in `design/11-ui-status-model.md` — no
second UI style guide elsewhere).

## Commits

- One logical change per commit; the message references the goal/design/task and
  says what was verified.
- Do not commit unless the user asks, or the running flow step carries explicit
  commit authorization.
- Never commit `sdkconfig*`, `build/`, `managed_components/`, the `esp-idf`
  symlink, `.env*`, or machine-local paths — they are gitignored; keep them so.
- Never force-push main; never edit git config.

## Working with the owner

- Frozen owner words go into the goal file verbatim; later direction lands as
  dated additions, not edits to the freeze.
- Hardware claims in `board.md` are web-sourced with inline links, and get
  corrected in place when hardware proves them wrong (the M5Dial PSRAM and Port-A
  pin errors were both caught this way).
- Live-input verification (a human tapping a card, speaking, power-cycling a
  board) is part of the evidence chain — say who did it, when, and with which
  build tag.
