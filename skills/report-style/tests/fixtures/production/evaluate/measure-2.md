# Measurement 2: does a join wait for all of its inputs?

**Verdict: measured.** Over 200 runs with landing order shuffled, no join task started before its
last input landed, and the final store was identical in every run.

## What it does not establish

- **Unmeasured:** behaviour when an effect fails; every effect in these runs succeeded.
- **Unmeasured:** throughput against a service that serialises calls (see `theory.md` §4).
- **By design, not tested:** a second control loop; P3 forbids it, so no run attempted one.
- **Not claimed:** that lanes beat batches on programs whose lanes have equal length.
