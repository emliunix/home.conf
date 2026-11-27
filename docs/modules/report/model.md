# report — model

## Concepts

A **finding** is one non-satisfied constraint binding: its path and line (or span), its section,
rule id, verdict, message, repair, basis (what decided it), and a reason when it is undetermined.
A **warning** is a diagnostic that does not move the verdict. An **artifact report** is one
document's findings, warnings, sections, and its engine report; the **verification report** is
every artifact plus the counts, the coverage summary and the verdict.

## Verdict

An engine report's verdict follows the model (`docs/doc-verify-model.md` §5), in this order: a
violated error constraint is **NO-GO**; an engine failure carries its own verdict (an
engine NO-GO, such as an outbound-policy violation, is NO-GO; an engine BLOCKED, such as a missing
key, a budget or a resource overrun, is BLOCKED); an undetermined error constraint is
**NEEDS-REVIEW**; a warning ratio below the module's threshold is **NEEDS-REVIEW**; otherwise
**PASS**. A PASS over incomplete coverage is BLOCKED (`docs/modules/language/contract.md`).

A finding's verdict: a violated error is NO-GO, a violated warning is `WARN` and does not move the
verdict, an undetermined binding is NEEDS-REVIEW, or BLOCKED when its oracle could not be asked.
An artifact's and a run's verdict is the worst of its parts, in the precedence NO-GO, BLOCKED,
NEEDS-REVIEW, PASS.
