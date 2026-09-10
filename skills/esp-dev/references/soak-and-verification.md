# Soak and verification

Generalized from `vibe-s3/docs/soak-sop.md` and `nfcplay/docs/soak-sop.md`.
A soak is how a firmware claim becomes evidence.

## Before you run

- Board plugged in; confirm the serial device is the board you mean (MAC/serial, not
  enumeration order).
- Firmware built **and flashed** for the config under test, with a **bumped build
  tag** printed in the boot banner.
- Host side (if any) running with its recordings/artifacts dir noted, and the
  session id from the log.
- Gates and PASS criteria stated **before** the run (they come from the design).

## Run

```bash
idf.py monitor | tee /tmp/<project>-soak-$(date +%Y%m%d-%H%M%S).txt
```

1. Reset, then let the system reach its steady state for the feature under test.
2. Exercise the real path — talk and pause for speech edges, tap cards, start a
   session. Duration by kind: boot/UI proof ≥60–90 s; a task/feature soak ≥2–5 min
   or N real cycles; media/catch-up ≥2–3 min.
3. Keep the log path; write it to a `*-latest.path` pointer when scripts need it.

## Score with explicit gates

| Gate | Evidence | PASS looks like |
| --- | --- | --- |
| Boot to active state | nav/state lines | one clean boot, no panic |
| Liveness | `task_wdt`, Guru | none over the soak |
| Heap | `heap_caps_get_minimum_free_size`, largest free block | above the floor stated in the design |
| Stack HWM | `stack_report` lines | each task leaves the stated margin |
| Real-time throughput | per-interval counters (e.g. Δframes sent) | meets the design's rate |
| Error counters | driver/app counters | zero (e.g. `enc_fail`, `rtp_fail`, `*_i2s_err`) |
| Device I/O | LCD/DMA/I2C/NFC errors | zero alloc failures, zero timeouts |
| Feature-specific | e.g. VAD edges, card reads | N edges/reads observed, not zero |

## Anti-patterns (each seen for real)

- Declaring PASS from an **idle-only** soak when the feature path never ran — mark
  `UNTESTED`, not PASS.
- Scoring on "no watchdog" alone when the design has a real metric.
- Scoring a quiet-room audio soak (`speech=0` throughout) as speech PASS.
- Two agents fighting over one board/serial port.
- Treating a protocol task's long wait (e.g. `peer_loop_us` ≈500 ms) as a media bug
  when it is a blocking protocol wait on its own task — gate on throughput/drops.
- Reporting a pass with the wrong build tag, or with a stale log from an earlier
  build.

## When a gate fails

1. Name the owner (which task/metric) before changing anything.
2. **No runtime fallbacks that hide the problem** — no buffer bump to mask an OOM,
   no fake UI animation, no silent retry that makes the gate look green.
3. Record the attempt + result, then re-soak and re-score against the same gate.
4. Preserve the negative result. A falsified approach recorded in the docs is worth
   more than a quiet revert (our low-power-idle design failed, and that failure is
   now the reason the next attempt is shaped correctly).

## Capturing human-in-the-loop events

When verification needs a person to act (tap a card, power-cycle, speak), the
capture must already be running and appending host-side; short bounded captures
miss placements and small on-chip rings overwrite history. Confirm the capture
works on a controlled event before asking for the human's time, and report the
result with the build tag and timestamp.
