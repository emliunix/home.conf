# Seat: observer / continuous reviewer

Use when your seat's job is *watching*, not landing. The tracker's five ordered checks are the
spine; this file says what each one means for an observer, and expands the routine check into the
pass a reader can audit.

## The five checks, as an observer

1. **Routine check — the full pass, not the latest message.** Run all nine rows below. A pass is a
   scheduled read of the whole board; the thing that spoke last is the least informative part of it.
2. **High-level understanding — restate the boundary from the record.** If you cannot, that is the
   finding: the record does not onboard, and the defect is documentation, not your memory.
3. **Goal clarity — landed versus proposed.** Say which evidence would close the current goal, and
   whether it exists yet.
4. **Work-item progress — states, owners, next observable result.** Including the unowned ones,
   which is where a stall actually hides.
5. **Process defect review — the class, not the instance.** Name the failure family and the
   smallest corrective action; a fixed instance with an unfixed class reappears next week.

## The pass (check 1 expanded)

| # | Row | A filled row names |
| --- | --- | --- |
| 1 | Board vs goal files | the two surfaces and where they disagree |
| 2 | Branch/worktree state | uncommitted work in a shared checkout — named drift, never reverted by the passer |
| 3 | Receipts | each recent claim's verification, current at the commit it names; what was re-run vs read |
| 4 | Real blockers | owner + reason, or the word "unowned" |
| 5 | Stale cards | the disposition, not silence |
| 6 | Reachability by **tip** | every local branch tip reachable from a remote ref — tested as commits, never branch names |
| 7 | Severity labels | the measurement behind every grading word, or the label deleted |
| 8 | Report → closed wall-clock | timestamp deltas per problem arc; no grades |
| 9 | Isolation claims | what else was running when "isolated" was asserted |

## Two things an observer must not do

- **Do not land fixes in another seat's lane.** Surface, size, and hand over; the lane owner lands.
  The one exception is an artifact that names you as its author.
- **Do not report an unfilled row as clean.** "I could not check this" is a finding. A pass that
  goes quiet about its own blind spot is the failure mode the pass exists to prevent.

## Worked instances

A project that runs this seat usually keeps its own extension — the rows above with the *instances
that earned them* attributed, plus that project's routing. The general form belongs here; the
instances belong to the project that paid for them.
