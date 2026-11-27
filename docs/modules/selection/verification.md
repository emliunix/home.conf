# selection — verification

| Property | Check (deciding test) | Limit |
|---|---|---|
| P-selection-01 | `doc-verify/tests/selection/task61-selector-gate.test.ts` | subprocess; a git-initialised fixture tree |
| P-selection-02 | `doc-verify/tests/selection/companion.test.ts` | unit; a malformed companion is a usage error |
| P-selection-03 | `doc-verify/tests/selection/companion.test.ts` | unit; covers none / one / unknown type |
| P-selection-04 | `doc-verify/tests/selection/snapshots.test.ts` | unit; the modes are exercised offline |
| P-selection-05 | `doc-verify/tests/selection/snapshots.test.ts` | unit; staged mode on git-initialised fixtures: links, citations, code-span paths, modules, a rename, a bare file name, a `design/NN` binding, a staged and a named deletion warned `structure.deleted` (verdict PASS) as a range over the commit warns it |
| P-selection-06 | `doc-verify/tests/selection/dependencies.test.ts` | unit; one document holding every reference kind; Git-ref classification is not varied, and a read outside `DocumentInput` is not detected |

The selector gate (`doc-verify/tests/selection/task61-selector-gate.test.ts`) is the load-bearing row: it exercises
the union of the tracked inventory and the working tree, which is where a selector silently
drops a document.
