# report — model

## Concepts

A **finding** is one non-satisfied constraint binding: its path and line (or span), its section,
rule id, verdict, message, repair, basis (what decided it), and a reason when it is undetermined.
A **warning** is a diagnostic that does not move the verdict. An **artifact report** is one
document's findings, warnings, sections, and its engine report; the **verification report** is
every artifact plus the counts and the verdict.

## Verdict

The verdict is the worst confirmed outcome: a violated error is **NO-GO**; an engine failure that
left a constraint undetermined is **BLOCKED**; an undetermined error is **NEEDS-REVIEW**; a
warning ratio below the threshold is **NEEDS-REVIEW**; otherwise **PASS**. A violated warning is
`WARN` and stays PASS. The text and JSON forms carry the same fields; `--verbose` adds the
snapshot, the selector trace and the proof tree.
