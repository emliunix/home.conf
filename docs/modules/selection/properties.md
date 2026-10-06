# selection — properties

| Id | Property | Statement |
|---|---|---|
| P-selection-01 | ordered selection | a document is governed by the last rule whose pattern matches it, and `exclude: true` removes it |
| P-selection-02 | companion contract | a companion names its own path and kind; a mismatched kind or path is refused |
| P-selection-03 | type selection | a companion's `document.type` selects exactly one of its rule's `types`, replacing the default modules; no type keeps the default; an unknown type is refused |
| P-selection-04 | snapshot identity | a check reports a baseline and a candidate id derived from the mode (`--paths`, `--staged`, `--range`, `--all`) |
