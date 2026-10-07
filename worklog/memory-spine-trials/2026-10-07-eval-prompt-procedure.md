# memory-spine — eval-prompt procedure trial (2026-10-07)

One `eval-prompt` **procedure** trial of the `memory-spine` skill (task #198, requirement 6). The
artifact under test is the skill; the arms' edits to the fixture index are evidence only.

## 1. Declaration

| Item | Value |
|---|---|
| Artifact under test | `skills/memory-spine/` — `SKILL.md` sha256 `6617f4af00ea5d4f…` (5587 B), `scripts/memory-lint.mjs` `1971a18d510fdf0d…` (5128 B), `scripts/memory-append.mjs` `4753b4bce4bf9866…` (7715 B), `scripts/memory-migrate.mjs` `80cea6a3fd341a14…` (10151 B), `.doc-verify.yaml` `b73fd290286ee638…` (2199 B), `module.yaml` `13b18f2ff19ce238…` (1989 B) |
| Arms | control = task + fixture, no skill. full = task + fixture + the package, pointed at `SKILL.md` as the instruction surface |
| Tasks | T1 over-cap (405 B, sha256 `0bc254cb05e10943…`), T2 interrupted publish (500 B, sha256 `35b8bbd922233aae…`) — identical bytes in both arms |
| Fixtures | T1 index `b28ef649b4ddd7ef…` (16,528 B, over the 16,384 B cap). T2 index `e9023b475666d6fb…` (125 B, valid) plus a stale `.MEMORY.md.abc123.tmp` holding `PARTIAL GARBAGE THAT MUST NOT BE PUBLISHED` |
| Held constant | model (host default), one scored run per arm per task, same fixture bytes, same task bytes, same tools |
| Subject | this session's host `pi -p`; **one run per cell, one model → sample, not a distribution** |

**Material integrity.** Digests above are of the handed bytes; nothing abridged or paraphrased.

**Loadability — checked first, per the method.** The full arm's first tool call read `SKILL.md` and
its second ran `memory-lint.mjs`, so the surface demonstrably loaded. A negative control that fails
this would make every other score meaningless; it did not.

## 2. Read fence

The pre-registration (`preregistration.md`, the rubric and the predictions) was kept **outside the
fixture tree** at `/tmp/hb198-fence/` for the batch, and the fence was named in each task.

**Compliance, verified rather than asserted.** Zero tool calls in any of the four runs referenced
`hb198-fence` or `prereg` (checked by scanning every `tool_execution_start` argument). An earlier
grep appeared to show all four runs matching — those hits were the task text *containing the fence
instruction*, echoed into the log, not a read. That is the difference between reading the fence and
being told not to.

## 3. Scores

Scored per rubric item. A tie is decoration; only where control is worse does the skill earn credit.

### T1 — over-cap index

| # | Item | Control | Full | Delta |
|---|---|---|---|---|
| P1 | cap-aware (names 16,384 B, not "too long") | 0 | 2 | +2 |
| P2 | moves to notes **with a pointer**; deletes nothing | 0 | 2 | +2 |
| P3 | atomic publish (temp + rename) | 0 | 2 | +2 |
| P4 | preservation shown/verified | 2 | 2 | 0 |
| P5 | before/after bytes reported | 2 | 2 | 0 |
| P7 | does not truncate the index in place | 0 | 2 | +2 |
| | **Total** (0/2 per item, max 12) | **6** | **12** | **+6** |

### T2 — interrupted publish

| # | Item | Control | Full | Delta |
|---|---|---|---|---|
| P3 | names atomicity / the temp as uncommitted | 2 | 2 | 0 |
| P4 | index content undamaged | 2 | 2 | 0 |
| P6 | stale temp **not** published over the index | 2 | 2 | 0 |
| P7 | no truncating write | 2 | 2 | 0 |
| | **Total** (0/2 per item, max 8) | **8** | **8** | **0** |

**Verdict. GO on T1, NO EFFECT on T2, scoped to one model and one run per cell.** The control
handled the interrupted-publish case correctly without the skill — deleting a stale temp is not a
subtle inference — so the skill earns nothing there. All its measurable contribution is on the
over-cap task, where it changed *how* the work was done: the control compacted 150 entries into a
summary and kept a full archive copy; the full arm relocated them to `notes/long-log.md` behind a
pointer and published through the atomic path.

**Both arms preserved content; they are not equivalent.** The control left no route from the index
to the 150 entries — it kept a second copy of the whole file instead. That is not a loss, but it is
not a memory spine either: the detail is in a dead file, not a linked note.

## 4. Rubric findings (the instrument, not the arms)

The method's own warning — *a pattern scores the words the arm happened to choose; the rubric names
the thing it did* — fired **twice in one trial, in opposite directions**:

1. **P3 scored FALSE for the full arm** because it never *said* "atomic"/"rename". It had actually
   published atomically: it ran `memory-migrate.mjs --apply`, which publishes via temp + rename.
   The behaviour was present; the vocabulary was not.
2. **P7 scored TRUE for the control** because the word "truncate" never appeared. The control wrote
   the index with the `write` tool, which truncates in place. The behaviour was present; the
   vocabulary was again absent.

Corrected on behaviour, read from the trajectories (0/2 per item, max 12): **control 6/12, full
12/12** — delta +6, where the pattern as first written reported control 6 / full 10, delta +4. The
rubric understated the delta by inflating the control (P7 false-pass) and depressing the full arm
(P3 false-fail). Both items are re-specified in §5 so a re-run does not repeat it.

This is the same class as the recorded instance in `eval-prompt`'s own §Score-the-behaviour: there a
feature regex required two named verbs where the rule named a *class* of actions. Here a writing
rule scored narration where the rule names an *operation*.

## 5. Disposition

| Findings | Disposition |
|---|---|
| P3 must be scored on how the index was written (the trajectory's `write`/`mv`/`--apply`), not on the arm's narration | **Fixed in the rubric**: P3 is now "the index is replaced by rename or by a tool that does so; a direct truncating write is a 0" |
| P7 is not independently scorable from P3 — both are the same predicate on the write path | **Recorded; P7 merged into P3** for a re-run rather than kept as a duplicated item |
| The skill does not help the interrupted-publish case | **Recorded as a real null result**, not fixed: the case is not where this skill's value is |
| One run per cell, one model | **Recorded as the bound**; scaling this to a distribution was not in #198's scope |
| Host finding: the pi JSONL stream carries assistant text in `message_update`/`text_delta` and `message_end`, not in a bare `assistant` record; a naive extractor returns 0 chars and reads as "the arm said nothing" | **Recorded**; this is the same shape as task #201's miner defect, hit independently here |

## 6. Reproducing

The seed script and both task texts are landed beside this record, so the fixtures are
reconstructible from the repository rather than from my scratch directory:

```bash
bash worklog/memory-spine-trials/seed-fixtures.sh    # writes the frozen fixtures under /tmp/eval198

# control arm — from the fixture directory, with no skill material:
pi -p --mode json "$(cat /tmp/eval198/task-overcap.txt)"

# full arm — same task, plus the skill's entry surface:
#   "Read skills/memory-spine/SKILL.md and treat it as your instructions for this task."
```

Fixture digests after seeding must equal the §1 table; `seed-fixtures.sh` also writes the T2 stale
temp (`PARTIAL GARBAGE THAT MUST NOT BE PUBLISHED`), which is the case's whole premise.

Fence material (`preregistration.md`) is landed with this record now that the batch is closed.
