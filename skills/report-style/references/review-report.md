# Review-output report

## Use when

A review or evaluation method has already examined an artifact and its result must be
communicated durably or handed to a decision-maker. This reference shapes the output; it
does not define how to perform the review.

## Aspects

| Aspect | Question it answers |
| --- | --- |
| Subject and baseline | Exactly what artifact, revision, and acceptance authority were reviewed? |
| Verdict | Is it sound, ready, conformant, or blocked, and what is the most important reason? |
| Findings | What observable defect exists, at what severity, with what evidence and consequence? |
| Recommendation | What concrete change would resolve each accepted finding? |
| Architecture assessment | Are ownership, coupling, boundaries, and abstractions coherent? |
| Conformance | Which required properties are fully, partially, or not supported? |
| Missing implications | What behavior is promised or implied but absent from implementation or verification? |
| Re-review disposition | Which prior findings are resolved, still open, superseded, or shown invalid by current evidence? |
| Unverified boundary | What could not be inspected, reproduced, or independently challenged? |

Lead with findings ordered by severity. Keep summaries secondary. Cite the current artifact
and evidence rather than carrying old findings forward as inherited truth.

## Chronology

Do not narrate how the reviewer searched. On a rematch, report the disposition of each
prior finding and the current evidence; the sequence of review rounds matters only as a
source/version anchor.

## Common failures

- self-certifying findings without an independent challenge when one is required;
- grading prose style instead of the named acceptance authority;
- using severity without stating user or system consequence;
- silently dropping findings that became stale rather than disposing them.
