# Cross-chip benchmark numbers and methodology (vibe-s31)

Source: `~/Documents/vibe-s31` (`README.md`, `boards.md`, `goal.md`,
`journals/2026-08-08-qwen8.md`, `results/`). One BSP layer
(`components/bench_common` + per-target `sdkconfig.defaults.<target>`), six
projects, three targets.

## Verified results (2026-08-08, verified against the `results/` logs)

| Board | CoreMark single | dual (scale) | PSRAM | p→p memcpy | GDMA p→p | internal memcpy / memset |
| --- | --- | --- | --- | --- | --- | --- |
| S31 rev v0.0 @320 MHz (RISC-V) | 991.97 | 1973.98 (1.99×) | 16 MB octal @250 MHz | 60 MB/s | 61.4 MB/s | 442 / 812 MB/s |
| S3 / M5Dial @240 MHz (Xtensa) | 604.96 | 1173.46 (1.94×) | none (tests skip cleanly) | n/a | n/a | 366 / 731 MB/s |
| P4 / Tab5 @360 MHz (RISC-V) | 1119.44 | 2228.78 (1.99×) | 32 MB hex-X16 @200 MHz | 52.3 MB/s | 8.6 MB/s | 353 / 644 MB/s |

Also measured on S31: `int→psram` 117 MB/s (CPU) / 124 MB/s (GDMA), `psram→int`
123 MB/s, chip ≤35 °C under CoreMark load.

## Findings that change decisions

1. **CoreMark tracks clock × ISA:** RISC-V ≈3.1 CM/MHz (P4/S31) vs Xtensa ≈2.5
   CM/MHz (S3). Dual-context scales ~1.94–2.0× on all three.
2. **"Use GDMA for PSRAM" is not portable advice.** On S31 GDMA ≈ CPU (the octal
   bus is the copy ceiling), but on P4 CPU memcpy crushes single-stream GDMA
   (`p→int` 348.9 vs 11.8 MB/s). Measure on the actual chip.
3. **Internal-RAM throughput is not monotonic with SRAM size:** P4 (768 KB) is
   slower than S31 (424 KB) — architecture/cache organization dominates.
4. **One binary with-or-without PSRAM works:** `CONFIG_SPIRAM` +
   `CONFIG_SPIRAM_IGNORE_NOTFOUND`, PSRAM tests skipping with a log line —
   verified across the whole suite on the PSRAM-less Dial.

## Reproduce

```bash
cd ~/Documents/esp-idf && . ./export.sh
cd ~/Documents/vibe-s31
./run_benchmarks.sh <target> <port>      # e.g. esp32s31 /dev/ttyACM0
```

The per-target build matrix is compile-tested for all three targets (18/18 green).

## Methodology lessons

- **Dual-context benchmarks need priority discipline:** context tasks at priority
  ≤ the creator's, or they starve the creator on its core and serialise (the score
  halves). See `rtos-and-liveness.md`.
- Benchmarks outrun the task watchdog → `CONFIG_ESP_TASK_WDT_INIT=n` in the
  CoreMark projects.
- Temperature/heap metrics were collected as CSV over **JTAG app-trace**, not the
  serial console — a clean way to get long series (`build-flash-monitor.md`).
- Keep raw result dirs (`results/<target>-<timestamp>/`); every reported row should
  trace to one.
- Per-target `board.h` expectations must be per-target, or the banner lies about
  the board it runs on (S3/P4 once showed S31's sizes until fixed).
