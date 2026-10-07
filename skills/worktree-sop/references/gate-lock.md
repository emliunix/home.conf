# Heavy-gate lock

## Purpose

The lock serializes a host resource. It does not certify a commit and is not a
second source of truth for a gate result.

## Invocation

```bash
node skills/worktree-sop/scripts/gate-lock.mjs -- pnpm check
```

The wrapper:

1. atomically creates a lock file with `O_EXCL`;
2. writes a token, PID, start time, and command;
3. waits until the lock is free or its bounded timeout expires;
4. runs the command with inherited output;
5. releases only its own token;
6. exits with the command's exit code and prints a JSON receipt.

## Contention and stale holders

Two concurrent attempts serialize. A live holder makes the second wait. A dead
PID or a lock older than `--stale-ms` is stale; the waiter renames it aside and
retries the atomic acquisition, so it cannot delete a newer holder's lock.

If the timeout expires, the wrapper exits `75` and does not run the command.
That is a resource blocker, not a gate failure.

## Receipt

```json
{
  "wrapper": "gate-lock",
  "state": "completed",
  "pid": 1234,
  "command": "pnpm check",
  "exitCode": 0,
  "acquiredAt": "2026-10-07T…",
  "releasedAt": "2026-10-07T…"
}
```

The command's own output remains authoritative for correctness. The receipt
shows only that this attempt held the resource and reports its own exit.
