# Build, flash, monitor, trace

## Toolchain and targets

| Project | IDF | Target notes |
| --- | --- | --- |
| vibe-s3 | v6.0.2 | `esp32s3` supported |
| vibe-s31 | v6.1-beta1 | `esp32s31` is **preview**: `idf.py --preview set-target esp32s31`; S3/P4 are supported |
| nfcplay | v6.1-beta1 | `esp32s3`, builds under `firmware/` |

Install/export once per shell:

```bash
cd ~/Documents/esp-idf && ./install.sh esp32s31   # riscv toolchain + python env
. ./export.sh
```

Repos keep IDF out of git via a machine-local symlink `esp-idf -> ../esp-idf`
(gitignored), matching `vibe-s3`/`nfcplay`.

Build/flash from the project directory: `idf.py build flash` (use `-p
/dev/ttyACMx` when more than one board is attached). Some projects use a
`run_benchmarks.sh <target> <port>`-style runner.

## `sdkconfig` traps

- **`idf.py reconfigure` does not override keys already present in `sdkconfig`.**
  A `=y` added to `sdkconfig.defaults` can be silently ignored, which once
  produced a boot loop (`assert failed: xTaskCreateStaticPinnedToCore … 
  xPortcheckValidStackMem`). After editing defaults, delete `sdkconfig` (or
  verify the key landed) before building.
- Keep per-target defaults (`sdkconfig.defaults.<target>`) in multi-board
  projects rather than one merged file — vibe-s31 needs it for 3 targets.
- `sdkconfig*` is gitignored in our firmware repos; never commit it.

## ESP-IDF v6.1 quirks we hit

1. `esp_flash` is **not** a component — the API lives in `spi_flash`.
2. APPTRACE Kconfig needs **both** `CONFIG_ESP_TRACE_TRANSPORT_APPTRACE=y` and
   `CONFIG_APPTRACE_DEST_JTAG=y`.
3. `idf.py mcp-server` needs Python `mcp` pinned `<2` in the IDF venv
   (`mcp` 2.x removed `mcp.server.fastmcp`).
4. Preview targets require the `--preview` flag on `set-target` (and a matching
   toolchain installed); a "missing target" error is usually the flag, not the code.

## Build provenance (do this)

- Define an `APP_BUILD` tag, bump it on **every** code change, and print it in the
  boot banner. Two of our incidents were "compiled but not flashed" and "tag not
  bumped", both invisible without this.
- Keep distinct tags per experiment (we ran `d6-muted`, `d7-heartbeat`,
  `d8-lowduty`, `d9-latch`, `d9c-beep`, `d9r-fullpoll` for exactly this reason).
- State the tag in every result you report.

## RTT capture (ESP32-S3, SEGGER RTT over the debug probe)

Two scripts exist in `nfcplay` and generalize:

- **Single-shot** (`rtt_capture.sh`): attach → reset-run → sleep → halt → dump
  the ring. It **resets the target**, so it is proof for boot behavior only — not
  for runtime sequences.
- **No-reset monitor** (`rtt_monitor.sh [samples]`): attach without resetting,
  resolve `_SEGGER_RTT` from the ELF with `nm`, read `aUp[0].pBuffer` at
  `CB+0x1C`, then repeatedly halt → `mdb` → resume. Tees a host-side log.
  Pair it with a detached loop (`continuous_rtt.sh`) so the log grows while the
  human acts.

Rules learned:

- **Never eyeball boot lines to decide reboot state** — the ring keeps history
  and re-shows old boots. Read **WrOff at `CB+0x24`**: a reboot resets it low;
  constant/increasing across samples = no reboot.
- A **varying halted PC** across samples proves the CPU really executes between
  samples (i.e. the monitor did not halt it for the whole window).
- The on-chip ring is tiny (≈1 KB): it overwrites. Events missing from a dump are
  not evidence of "not read".
- **A raw memory-dump reader does NOT consume RTT, so the target silently drops
  writes once the buffer is full.** `mdb $pBuffer 1024` never advances the host read
  pointer (`aUp[0].RdOff`, `CB+0x28`), and RTT's default NO_BLOCK_SKIP mode drops
  everything after that: with ~100 B heartbeats and a 1 KB buffer the app stops
  emitting after ~27 s, and every later sample re-reads the same frozen block. A
  whole night of "clean idle" was actually one 27-second window (cost us a day,
  2026-09-11). Fixes: write `RdOff = WrOff` (`mww <CB+0x28> <WrOff>`) after each
  dump, set the up-buffer Flags word (`CB+0x2C`) to **NO_BLOCK_TRIM — which is `1`,
  not `2`** (`2` is `BLOCK_IF_FIFO_FULL` and will stall the target when nothing is
  consuming; check the in-tree `SEGGER_RTT.h` rather than guessing the constant),
  read through OpenOCD's RTT server (`rtt setup/start`, `rtt server start`), or —
  best — have the firmware own a RAM ring + monotonic counters read by symbol.
- **Before citing a long capture as evidence, prove it advances:** distinct newest
  values across samples > 1. A frozen ring plus a delta filter that discards zero
  deltas looks exactly like a steady cadence.
- **…and pin every quoted value to the sample label it appeared under.** A rolling ring
  re-shows recent lines, so "it looked newest in the dump" is not a timestamp: a card-tap
  signature read out of a later dump was once attributed to a test that never happened.
  Consume-on-read keeps the capture live; it does not make ring position a clock.
- Sampling must not reset or halt the chip long enough to disturb the behavior
  under test; if the app must run free, sample sparsely and confirm with WrOff.

## JTAG application trace (ESP32-S3/S31)

For CSV-style metrics (temperature, heap) or full ESP_LOG off-device:

```bash
sudo openocd -f board/esp32s31-builtin.cfg            # TCL on 6666
# then, via the OpenOCD TCL port:
esp apptrace start file://<out.bin> 0 32768 30 0 0
$IDF_PATH/tools/esp_app_trace/logtrace_proc.py <trace.bin> <project>.elf
```

This is the cleanest way to collect long metric series without holding the serial
console open (vibe-s31 used it for temp/heap CSVs).

## Serial monitor soaking

`idf.py monitor | tee /tmp/<name>-$(date +%Y%m%d-%H%M%S).txt` — always tee, always
timestamped; write the path to a `*-latest.path` pointer when scripts need it.
See `soak-and-verification.md` for scoring.
