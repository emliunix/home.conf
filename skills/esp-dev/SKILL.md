---
name: esp-dev
description: >-
  ESP32 / ESP-IDF firmware development and bring-up practice distilled from our
  vibe-s3, vibe-s31 and nfcplay projects: board wiring and serial-port mapping,
  build/flash/monitor plus RTT and JTAG tracing, PSRAM/SRAM and DMA placement,
  RTOS liveness and stack budgets, no-silent-fail logging, soak scoring, NFC
  (ST25R3916) register work, esp-sr audio front end, and cross-chip benchmarks.
  Use when writing, flashing, debugging, reviewing, or planning ESP-IDF firmware
  on our boards.
metadata:
  short-description: ESP32/ESP-IDF development practice for our boards
---

# ESP-IDF development (our boards)

Cross-project firmware knowledge. Project-specific designs stay in their repos;
this skill holds the practice that transfers between them.

## Where the detail lives

| Project | Repo | What it is | Its own living docs |
| --- | --- | --- | --- |
| vibe-s3 | `~/Documents/vibe-s3` | ESP32-S3 touch AMOLED voice companion + WebRTC host | `AGENTS.md`, `board.md`, `design/`, `docs/` (psram, os_tasks, soak-sop, mcu-practices), `rules/`, `esp-sr.md` |
| vibe-s31 | `~/Documents/vibe-s31` | ESP32 cross-chip benchmark suite (S31 / S3 Dial / P4 Tab5) | `README.md`, `boards.md`, `goal.md`, `journals/`, `results/` |
| nfcplay | `~/Documents/nfcplay` | M5Dial + ST25R3916 NFC reader exploration | `AGENTS.md`, `board.md`, `goals/nfcplay.md`, `docs/` (nfc-programming-guide, card-types, memory-practices), `design/` |

This skill is the distilled layer over those repos. When a fact here conflicts
with a repo doc, the repo doc wins — and update this skill.

## Non-negotiables (each one cost us a real bug)

1. **Placement is a contract you write.** Use `heap_caps_malloc()` with explicit
   caps; never plain `malloc()` or a "try X then fall back" retry when placement
   matters. Prove it with `esp_ptr_external_ram()` / `esp_ptr_internal()` at the
   allocation site. Silent fallbacks make a wrong placement look successful.
2. **Silence is a bug.** `ESP_FAIL` (or any non-`ESP_OK` that reaches a caller)
   must be logged at the fail site, or by a caller that observes it. Never
   `return err;` with no log anywhere on the path.
3. **Build-tag discipline.** Bump the app's build tag on every code change and
   print it at boot. "Compiled but not flashed" and "tag not bumped" both burned
   us; the boot line is the only proof of which build is running.
4. **One change per build/flash/soak.** A soak that mixes changes attributes
   nothing. Isolate, measure, then combine.
5. **One agent per board and serial port at a time.** Confirm the port is the
   board you think it is (MAC/serial) before flashing anything.
6. **`UNTESTED` ≠ `PASS`.** An idle-only soak or a quiet-room audio run does not
   prove a feature that never executed. Score the real path.
7. **Watchdogs mean "stuck", not "busy".** Name the non-yielding path before
   touching priorities or core affinity.
8. **Assume capture buffers overwrite.** Before asking a human to tap/act, start a
   host-side appending capture and verify it records real events end-to-end.

## Working loop

1. Recon: which board, which port, which target/IDF version (`boards-and-wiring.md`).
2. Design first: `design/NN-<topic>.md` with goal, scope, verification criteria
   (`conventions.md`); grill it before coding.
3. Implement, then `idf.py build flash` from the project dir.
4. Observe: serial monitor / RTT / JTAG trace (`build-flash-monitor.md`).
5. Verify with a scored soak (`soak-and-verification.md`) against the design's gates.
6. Commit one logical change, message referencing the design/task.

## Routing

| Read | When |
| --- | --- |
| [`references/boards-and-wiring.md`](references/boards-and-wiring.md) | Before touching a board: SoC/memory specs, pinouts, Port-A/B, which `/dev/ttyACM*`, download-mode and latch quirks |
| [`references/build-flash-monitor.md`](references/build-flash-monitor.md) | Toolchain/target selection, `sdkconfig` traps, RTT and JTAG app-trace capture, build provenance |
| [`references/memory-and-psram.md`](references/memory-and-psram.md) | Any allocation, LVGL buffers, task stacks, DMA, or a "why did the LCD fail" question |
| [`references/rtos-and-liveness.md`](references/rtos-and-liveness.md) | Watchdog trips, priority/core questions, stack sizing, queue design |
| [`references/conventions.md`](references/conventions.md) | Logging rules, where designs/docs/goals live, commit policy |
| [`references/soak-and-verification.md`](references/soak-and-verification.md) | Running and scoring a soak; deciding whether a claim is proven |
| [`references/nfc-st25r3916.md`](references/nfc-st25r3916.md) | NFC reader work on the M5Dial + ST25R3916 (driver surface, registers, classification, LPCD) |
| [`references/esp-sr-afe.md`](references/esp-sr-afe.md) | esp-sr Audio Front End: mic layout, AEC/SE/NS/VAD wiring, memory mode |
| [`references/benchmarks.md`](references/benchmarks.md) | Performance numbers and methodology across our chips (CoreMark, PSRAM/CPU vs GDMA bandwidth) |
