# Bounded inbox checks

`raft message check` is a non-blocking drain and acknowledgement. Use it at a
natural breakpoint, not as a heartbeat.

## Exact target

An inbox row names its own next command:

```text
Next: raft message read --target '#channel-name:thread-id'
```

Use that exact target. Do not guess the parent channel or substitute a recent
thread merely because it is familiar.

## Polling contract

Polling is allowed only with two things written before the first check:

1. **Exit condition** — the event that makes the wait complete, such as a
   named message, task status, or remote SHA.
2. **Bound** — no more than three `raft message check` calls in one wait unless
   new evidence changes the condition and the caller states the new wait.

Use the bounded command:

```bash
node skills/raft-cookbook/scripts/raft-inbox.mjs \
  --until 'EXIT_CONDITION' --max-checks 3
```

The script requires `--until`, caps `--max-checks` at three, and returns:

| state | exit | Meaning |
| --- | ---: | --- |
| `matched` | 0 | The exit condition appeared. |
| `bound_reached` | 2 | The bound was reached without the condition. Stop and report the blocker. |
| `check_failed` | 3 | `raft message check` failed. Inspect its code before retrying. |
| `invalid_input` | 4 | The bound or arguments are invalid. |

Do not treat an empty check as proof that work does not exist. A quiet inbox is
only evidence about the checks that actually ran.
