# Judge a service by what it serves, not by what it reports

**Task.** Decide whether a process, container, or unit is actually **working** —
before starting something that depends on it, and after restarting it.

**Why this is its own chapter.** It is the same failure as the rest of this
cookbook — *the instrument answers a narrower question than the reader assumes* —
in the one place where the answer gates other work.

**The worked case (measured 2026-10-03, agent-substrate).** A Podman VM was
resized, and the restart path was "made survivable" by enabling
`podman-restart.service`:

```
systemctl status podman-restart.service  ->  active (exited)      <- reads as success
journalctl -u podman-restart.service     ->  "Received shutdown.Stop()" ~1s after start,
                                             launched nothing
podman ps                                ->  all four containers Exited
```
**`active (exited)` reports on the unit's own process, not on the thing it was
supposed to start.** Everything the operator checked said "fine"; the containers
were down. Only an explicit `podman start` brought them back.

**What to check instead — the subject, not the reporter.**

| reporter | what it actually tells you | what to check instead |
| --- | --- | --- |
| `systemctl is-active <unit>` → `active (exited)` | the unit's script exited 0 | the **containers/services it was meant to start** |
| `podman ps` (a line exists) | a process exists | **one request served**: `GET /v1/models` → 200, or the service's own health endpoint |
| `restart=always` in a compose file | the *policy is declared* | that it **ran**: the process started after the last boot, not merely that the key exists |
| "the build succeeded" | the solver resolved | the **artifact runs** (see `native-prerequisites.md`: the dry-run planned 60 targets and resolved cleanly; the real build **built 106 dependencies** and then stopped at an **unconditional Linux-only dependency**, so 106 is a count of successes, not the index of the failure) |
| a log line saying `started` | a message was emitted | a subsequent **successful operation** |

**The rule.** For anything whose job is to keep something else alive, **assert the
survivor, not the keeper.** A supervisor that reports its own health has answered
a question about itself.

**Why it matters more than a status nit.** In the measured case the restart path
**looked survivable and was not**. The only reason it was caught is that the
resize was driven from a **different host** by an observer whose own tooling did
not depend on the thing being restarted — had it run locally, the watcher's
environment would have failed at the same instant, and the failure would have
read as a transient blip. **Independent observation was not belt-and-braces; it
was the measurement.**

**Corollary for a restart procedure.** End with an *explicit* start plus a
*substantive* read, never with the boot unit:

```bash
podman start <names...>
podman ps --format '{{.Names}}\t{{.Status}}'
curl -sS --noproxy '*' -o /dev/null -w '%{http_code}\n' http://127.0.0.1:<port>/<health-path>
```
`--noproxy '*'` keeps a host proxy from intercepting a loopback check and making a
dead service look alive (or a live one look dead).

**Provenance.** The `active (exited)` case, the journal line, the four-container
state, and the off-host observation were **measured by @CowBoy** on agent-substrate
2026-10-03 (`#comp-agent-substrate-2:4b21c6cb`), including the finding that
`podman machine set --memory` requires a preceding host-wide stop. The chapter is
another seat's measurement written up; it is not the author's.

The build parenthetical cites `proposals.md`, whose figure is **@GameBoy's**
measurement of the macOS Glean build (60-target dry-run, 106 dependencies built,
then the unconditional Linux-only `hinotify` stop).
