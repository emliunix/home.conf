# RTOS tasks, stacks, and liveness

From `vibe-s3/docs/mcu-practices.md`, `vibe-s3/docs/os_tasks.md`, and the
vibe-s31 CoreMark SMP work.

## Watchdogs: "stuck", not "busy"

Watchdog trips are rare on a healthy system. When one fires, prefer a liveness /
stuck-path hypothesis over "the chip is just busy — move the task to the other
core."

| Watchdog | Typical meaning |
| --- | --- |
| **IWDT** (interrupt WDT) | This core failed to service ticks/interrupts: long critical section, spin with IRQs masked, hang in a driver/ISR path |
| **TWDT** (task WDT, often `IDLE*`) | The watched task did not run within `TIMEOUT`: some higher-priority task never blocked, waited, or yielded |

Debug order:

1. Identify the stuck site — core, running task, backtrace / PC class.
2. Ask why that path never waits — missing blocking I/O or queue receive, infinite
   retry, unbounded drain, library call that burns CPU longer than the period.
3. Falsify "just busy" — if other work still advances, it is still a liveness bug
   relative to Idle/WDT.
4. Only then change priority, core affinity, or cut features — as measured
   remediations for a named non-yielding path.

Anti-patterns: "WDT on core N → pin it to the other core" without a soak backtrace
that names the stuck path; conflating IWDT and TWDT; treating periodic soft TWDT
as noise while a feed/encode loop never blocks.

## Priority and core affinity

- A context/worker task that must run alongside its creator should be created at
  **priority ≤ the creator's**, or it starves the creator on its core and the work
  serializes. In the dual-core CoreMark fork this halved the score (991 → ~500 per
  core) until fixed; the correct dual-context result is ~1.99× single.
- Pinning is a tool for measurement, not a first response to a watchdog.

## Stack sizing and history

- Track **high-water marks** (`uxTaskGetStackHighWaterMark`, reported per task by a
  small `stack_report` task each health period) — the key is dated history of real
  usage, not the configured size.
- Log HWM as `task=<name> free=<B> total=<B> used=<pct>%` and also record
  placement (`loc=psram|internal` from `TaskStatus_t.pxStackBase`); a stack that
  silently failed to allocate in PSRAM and fell back to internal is a placement
  bug, not a success.
- **Right-sizing is not a one-way ratchet.** One encoder stack was shrunk and then
  had to grow back to 40 KB after a soak showed **52 B** of headroom left (99%
  used). Small configured size ≠ safe size.
- Keep `CONFIG_FREERTOS_CHECK_STACKOVERFLOW_CANARY=y`: overflow becomes a panic
  with a backtrace instead of silent corruption.
- The inventory file (`docs/os_tasks.md` pattern) should record, per task/buffer:
  code location (provenance), configured size and **why**, placement/caps,
  lifecycle, and dated observed usage. A blank history column means unverified.

## Queues and buffers

- Size queues from a stated frame size and depth (e.g. `8 × 1,280 B` PCM frames),
  and record whether the payload (not just the TCB/header) is internal or PSRAM —
  `xQueueCreate` uses the allocator default, `xQueueCreateStatic` lets you choose.
- Anything a task copies between tasks by CPU can live in PSRAM; anything an ISR
  or DMA touches stays internal.

## Reporting discipline

- Per-task and per-buffer rows need provenance (file + symbol) so a later agent can
  re-measure the same thing.
- When a health line exists, gate on it; do not declare a fix from "no watchdog
  seen" alone.
