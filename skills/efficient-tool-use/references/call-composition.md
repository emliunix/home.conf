# Call composition

Use these rules when building the command or request that invokes a tool.

## Do not inline payloads into command strings

Keep prose, code, JSON, and other structured payloads out of shell strings.
Pass them through standard input, a file, or the tool's native structured
argument instead.

Why: the source corpus contained 5,145 heredocs and 4,493 inline interpreter
programs. A quoting error can change the payload while the command still exits
zero, which makes this a correctness risk rather than only a crash risk.

## Block on a condition instead of polling

When the surface supports waiting, ask it to block until the condition is
ready. Do not insert sleep-and-recheck loops around a service that already
offers `--wait`, a subscription, or a blocking API.

If polling is the only available contract, state why, bound the total wait,
and stop on a clear timeout. The source corpus contained 3,368 poll loops
where a blocking condition belonged.

### Bound the process, not just the parent

When you bound a command that can spawn children, kill the **process group**,
not the parent process. A bound that kills only the parent leaves the child
running, and a child that holds a lock holds it for as long as it lives.

Measured 2026-10-13 (task #264). `perl -e 'alarm N; exec @ARGV'` is the wrong
idiom: `alarm` kills the parent, and the hook tree survives orphaned to pid 1.
In a two-process arm a parent-only kill left the holder **alive** (`reclaimable=
false`) while a group kill left it **dead** and reclaimable:

```
ARM A parent-only kill : wrapperAlive=false holderAlive=true  reclaimable=false
ARM B group kill       : wrapperAlive=false holderAlive=false reclaimable=true
```

The cost is not only a leaked process. The shared heavy-gate lock is reclaimed
**immediately** for a dead holder and only after `staleMs` (30 minutes) for a
live one, so a parent-only kill turns a bounded command into a 30-minute stall
for every other seat that needs the lock. One reach cost ~4 minutes and read as
a network fault.

Give the command its own session, then signal the group:

```bash
setsid <command> & child=$!
kill -TERM -"$child"     # negative pid = the group, not the process
```

In Node the equivalents are `spawn(cmd, args, { detached: true })` followed by
`process.kill(-child.pid, "SIGTERM")`. Either way, verify the group is gone
before reporting the bound fired: a killed parent is not a release.

This is the remedy for the **bound-kill idiom**, not for the lock. Do not fix it
by shortening the lock's `staleMs` — that trades a stall for a false eviction of
a genuinely working heavy gate. The lock's predicate is unchanged, so a holder
that is still working is not disturbed by this rule.
