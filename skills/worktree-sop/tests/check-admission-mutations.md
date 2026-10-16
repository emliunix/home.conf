# `gate-admission` — the committed mutations

Each mutation is applied **alone** to `skills/worktree-sop/scripts/gate-admission.mjs` (or, for M5,
to `tests/check-dispatch.mjs`), then the named case in `tests/check-admission.mjs` must REDDEN.

The cases are the evidence that admission excludes; this table is the evidence that the cases can
tell the difference.

| # | mutation | must redden |
|---|---|---|
| M1 | `reusePort: false` → `true` | "A2 atomicity: N >= 5 true-concurrent racers -> exactly one acquires" |
| M2 | delete the non-`EADDRINUSE` early return, so every bind fault is retried to the budget | "A4b a REAL fault is not retried as contention" |
| M3 | make the default port follow `TMPDIR` (the incumbent's path-keyed defect, in a new spelling) | "A5 anchor invariance: the default port is a constant…" |
| M4 | change `ADMISSION_PORT` away from the sibling repository's literal | "CROSS-REPO: the port constant equals the sibling repository's literal" |
| M5 | have the unlocked control give both children the SAME port (admission not actually removed) | "check-dispatch: unlocked control did not overlap…" — a red, not a pass, and the arm that caught a real authoring error |

## Measured

**M1, M2, M3, M4 all applied and all reddened their named case** (2026-10-16, #329 branch).

- **M1** reddens A2 and A1: with `reusePort: true` the kernel lets N listeners share the port, so
  every racer "acquires" — the atomic test-and-set silently excludes nothing. That is the failure
  the flag exists to prevent, and it is why the flag is a pinned assertion rather than a default
  being restated.
- **M2** reddens A4b, **which exists because that mutation was measured green in the sibling
  repository first.** There, deleting the guard left every arm passing: the module documented
  *"any other bind failure is a REAL fault and is returned immediately rather than retried"* in
  prose with nothing pinning it. The mutation surfaces the fault after ~3 s (the caller's budget)
  instead of at once, and reports it as `ADMISSION_TIMEOUT` — a misconfiguration read as contention.
- **M3** reddens A5. The mutation is **port-shaped, not path-keyed**: it is the same defect class as
  the incumbent's `tmpdir()`-derived lock path, translated to the replacement, so A5 is proven to
  catch the defect's **shape** rather than one historical spelling.
- **M4** reddens the cross-repo case. This is the mutation that matters most for the transition: it
  is the one failure that **nothing else reports**, because each repository continues to serialize
  its own gates correctly and only the cross-repository exclusion silently disappears.

## Why M5 is in this table although it is not a mutation of the module

M5 was **not hypothetical** — it is the error the first version of the control actually contained.
It gave both children the same unused port, which does **not** remove admission: they still bind
that one port and serialize. The "control" was therefore a second **guarded** arm, and it failed
with *"did not overlap, so the fixture cannot prove serialization"* — the arm correctly refusing to
pass vacuously. The fix is two **different** ports, one per child. It is listed here because a
control that cannot produce the phenomenon it controls for is the exact artefact this table exists
to catch, and recording it as a row makes the failure mode reproducible rather than anecdotal.

## A second authoring error, recorded for the same reason

The **unlocked control first failed on a real machine, not by construction**: two children launched
together ran strictly sequentially (`D start · D end · C start · C end`) because process startup
jitter exceeded the 120 ms hold, so the overlap the control needs never occurred. The fix is the
sibling repository's own measured remedy — each run **publishes its start and then polls for its
peer's**, bounded — so the overlap is a fact rather than a hope. Without it the control passes or
fails by timing, on a loaded host it fails, and a suite that reddens on a busy machine is the
false-red mode this card removes, reproduced inside its own guard.

## Bounds

- The cases measure **admission correctness and the wrapper's wiring**, not saturation isolation.
  They do not demonstrate that an admitted gate is insulated from host load, and nothing here
  should be read as evidence about load-induced false reds.
- **A7 and A8 do not run the wrapper**, because running it runs the compound. A7 invokes it with a
  rejected argument (so it exits at the usage check, before any admission or build); A8 reads it.
  The card's rule: an arm whose subject is the wrapper's admission must not invoke its payload.
- Every wait in these cases is **explicitly bounded well under `ADMISSION_TIMEOUT_MS`** (20 min). A
  stub that omitted its own `timeoutMs` blocked for the full budget and hung the suite in the
  sibling repository — measured there, avoided here.
