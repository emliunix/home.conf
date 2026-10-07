# report — contract

The report package turns an engine run into findings, a verdict, and the text or JSON a reader
acts on.

## Public surface

| Module | Exports | Rule callers rely on |
|---|---|---|
| `checker` | `checkDocuments`, `titleStatus` | runs the rules for a mode and returns a `VerificationReport` |
| `diagnostics` | `constraintReports`, `decideVerdict`, `renderReport`, `bindingSpan`, `bindingReason` | the engine report, its verdict, proofs and spans |
| `report` | `renderText`, `exitCodeFor` | text and JSON; exits 0 PASS, 1 NO-GO, 2 NEEDS-REVIEW, 3 BLOCKED |
| `cli` | `main` | `check` and `segments`; `--verbose`, `--format`, `--help`, a bare `FILE` |
| `segments` | `segmentMarkdown` | stable section ids with line and byte spans |
| `normalize` | section-match helpers | required-section matching |

`check` takes one mode (`--paths`, `--staged`, `--range`, `--all`); `--section ID` narrows the
selection; `--profile draft|promotion|auto` chooses the constraints; `--verbose` adds the proof
tree and snapshot.
