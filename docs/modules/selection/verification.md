# selection — verification

| Property | Check (deciding test) | Limit |
|---|---|---|
| P-selection-01 | `doc-verify/tests/selection/task61-selector-gate.test.ts` | the `subprocess` project; a git-initialised fixture tree |
| P-selection-02 | `doc-verify/tests/selection/companion.test.ts` | in-process; a malformed companion is a usage error |
| P-selection-03 | `doc-verify/tests/selection/companion.test.ts` | in-process; covers none / one / unknown type |
| P-selection-04 | `doc-verify/tests/selection/snapshots.test.ts` | in-process; the modes are exercised offline |

The selector gate (`doc-verify/tests/selection/task61-selector-gate.test.ts`) is the load-bearing row: it exercises
the union of the tracked inventory and the working tree, which is where a selector silently
drops a document.
