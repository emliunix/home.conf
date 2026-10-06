# selection — verification

| Property | Check (deciding test) | Limit |
|---|---|---|
| P-selection-01 | `tests/task61-selector-gate.test.ts` | in-process, a git-initialised fixture tree |
| P-selection-02 | `tests/companion.test.ts` | in-process; a malformed companion is a usage error |
| P-selection-03 | `tests/companion.test.ts` | in-process; covers none / one / unknown type |
| P-selection-04 | `tests/snapshots.test.ts` | in-process; the modes are exercised offline |

The selector gate (`tests/task61-selector-gate.test.ts`) is the load-bearing row: it exercises
the union of the tracked inventory and the working tree, which is where a selector silently
drops a document.
