# Heavy-gate lock

## Purpose

The lock serializes a host resource. It does not certify a commit and is not a
second source of truth for a gate result.

## Invocation

```bash
node skills/worktree-sop/scripts/gate-lock.mjs -- pnpm check
```

The wrapper:

1. writes complete metadata (token, PID, start time, command) to a private
   staging file, then publishes it at the lock path with an exclusive link — so
   the lock path is only ever **absent or complete**, never partially written;
2. waits until the lock is free or its bounded timeout expires;
3. runs the command with inherited output;
4. releases only its own token, verified against the descriptor it opened, so it
   cannot remove a lock that displaced it;
5. exits with the command's exit code and prints a JSON receipt.

## Contention and stale holders

Two concurrent attempts serialize. A live holder makes the second wait.

A waiter classifies the lock file into **three states**, and only two of them are
evictable:

| observed        | meaning                                                  | action                                                        |
| --------------- | -------------------------------------------------------- | ------------------------------------------------------------- |
| **missing**     | no holder                                                | retry the exclusive create                                    |
| **unparseable** | a genuinely corrupt lock — a publish cannot produce this | **honour** it until `--stale-ms`, then reclaim                |
| **parsed**      | a holder wrote metadata                                  | wait, unless its PID is dead or it is older than `--stale-ms` |

A missing lock is **not** stale — there is no holder to displace. An unparseable
lock is **not** evidence of abandonment either: it can only come from corruption
(the atomic publish means a live holder never leaves a partial file), and it is
honoured until it ages out so that a corrupt lock self-heals rather than wedging
the gate. **A parseable file that is not a lock this wrapper writes counts as
unparseable too** — `{}` or `{"pid":"x"}` says nothing about a live holder, so it
must wait out the age rather than be reclaimed on sight. Treating any of these as
immediately stale is the defect this classification exists to prevent: the waiter
would displace a live holder's lock and enter the section.

Recovery **preserves lock ownership**, and neither recovery path can delete or
overwrite a lock it did not measure:

- **The reclaim decision and its displacement are serialized.** Observing a lock and
  then acting on that observation is unsafe on its own: between the two, another
  reclaimer can legitimately displace the stale lock and publish a live successor,
  which the first reclaimer would then rename aside — freeing the path while a live
  command runs. A short **recovery claim** (an atomic exclusive directory, held for a
  few syscalls and never across the command) makes observe-and-displace atomic with
  respect to every other reclaimer, and the observation is retaken inside it. Only one
  process can hold the claim, so no two reclaimers can act on the same snapshot.
  A claim left behind by a crashed decision is reclaimed once it is older than
  `--stale-ms`; because nothing runs while the claim is held, that can only delay
  recovery, never let two commands execute.
  **The claim itself is published non-empty** (a staging directory holding an owner
  file is renamed into place) and is displaced by moving it aside with an identity
  check, never by a path-based removal. That matters because a claim that could be
  removed by path could have a successor's _fresh_ claim deleted by an older
  reclaimer's cleanup — which would let two decisions run, the very overlap the claim
  exists to prevent.
- **Reclaim** then claims the entry by renaming it to a unique tombstone and inspects
  the moved file. It is treated as displaced only if that file is the inode it
  measured; otherwise the lock is restored.
- **Restore is non-clobbering.** `rename` always overwrites, so a restore that used
  it would destroy a successor that won the path meanwhile. The restore links the
  tombstone into place instead, which refuses when the path is taken, and leaves the
  displaced lock's data linked rather than unlinking it.
- **Release** never unlinks the shared path. It claims the entry by renaming it
  aside and deletes only the tombstone holding the inode it opened, so a successor
  published while this holder ran cannot be removed. The path is briefly free at
  that moment, which is safe because release runs after the command has finished.

A corrupt lock still self-heals once it ages past `--stale-ms`, so it cannot wedge
the gate forever.

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
