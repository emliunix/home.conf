# report — contract

The report package runs the check over the selected documents, turns each engine run into
findings and a verdict, and renders the text or JSON a reader acts on. It owns the command line.

## Public surface

| Module | Exports | Rule callers rely on |
|---|---|---|
| `doc-verify/src/checker.ts` | `checkDocuments`, `titleStatus`, `combineVerdicts` | runs the rules for a mode and returns a `VerificationReport`; the run's verdict is the worst artifact verdict |
| `doc-verify/src/engine/diagnostics.ts` | `decideVerdict`, `renderReport`, `bindingSpan`, `bindingReason`, `bindingBasis`, `EngineReport` | an engine report's verdict, proofs and spans |
| `doc-verify/src/engine/kernel-bridge.ts` | `constraintReportsFromKernel` | the kernel's report becomes the engine report's constraint rows |
| `doc-verify/src/report.ts` | `renderText`, `exitCodeFor` | the text form carries the same fields as the JSON form |
| `doc-verify/src/cli.ts` | none (entry point) | the command line below |
| `doc-verify/src/segments.ts` | `segmentMarkdown` | stable section ids with line and byte spans |
| `doc-verify/src/normalize.ts` | `normalizeSectionId`, `sectionIdMatches` | required-section matching |

## Command line

`doc-verify <segments|check|mutate> [options]`. `-h` or `--help` prints the usage.

- `check` takes exactly one mode: `--paths FILE|GLOB...` (a bare positional file is a path),
  `--staged`, `--range BASE...HEAD`, or `--all`. Options: `--profile draft|promotion|auto`
  (default `auto`), `--section ID` (repeatable; narrows the `selected(D, S)` fact),
  `--format text|json` (default `text`), `--verbose` (text only; adds the snapshot, the selector
  trace and the proof tree), `--no-cache`, `--output FILE`.
- `segments DOCUMENT [--format text|json]` lists a document's sections.
- `mutate TABLE.yaml [--judge]` runs a mutation table; `--judge` adds the judge-leg rows.

Exit codes: 0 PASS, 1 NO-GO, 2 NEEDS-REVIEW, 3 BLOCKED, 64 usage or configuration error, 65 the
configuration is not in the Git index (`--staged`), 66 no configuration, 70 internal error.
