# Decision report

## Use when

The reader asks why a direction was chosen, what requirement it descends from, or whether
a previous decision still governs the current design.

## Aspects

| Aspect | Question it answers |
| --- | --- |
| Decision question | What choice had to be made? |
| Authority and status | Which artifact or owner makes the decision current, and is it accepted, proposed, or superseded? |
| Requirements and constraints | Which root needs, invariants, or environmental facts narrow the choice? |
| Options | What were the nearest viable alternatives, not an exhaustive market list? |
| Selection | What was chosen, in precise domain vocabulary? |
| Rationale | Which requirement does each important part of the choice satisfy? |
| Tradeoffs | What becomes harder, excluded, or intentionally unprotected? |
| Consequences | Which objects, contracts, operations, or follow-on decisions change? |
| Reversibility | What would make the decision worth revisiting, and what would reversal cost? |
| Open boundary | What remains undecided or blocked on later product evidence? |

Distinguish the reason a value exists from policy that acts on that value. Do not invent a
root requirement to justify an implementation that merely happened to be present.

## Decision-request subtemplate

Use this when the report is not *about* a decision already made but **asks the reader to make one**. It is the
`INPUT_TEST` rule in fillable form: a list of decisions is not decision-ready merely because each item has a name.

For each decision, supply all six fields:

| Field | What it must carry | When it is missing | Accepted by |
| --- | --- | --- | --- |
| Subject and current state | The artifact, value, or behaviour as it stands now | "Decide the budget." | `DR-STATE` |
| Reason it is needed now | The source that established the need, and what changes if it waits | "This matters." | `DR-WHY-NOW` |
| Options | The viable alternatives, each named in domain vocabulary | One option presented as the only choice | `DR-OPTIONS` |
| Consequence of not deciding | What stays broken, unjudged, or silently defaulted | Silence, so the reader infers it | `DR-COST` |
| Distinguishing evidence and constraints | The measurement, bound, or rule that separates the options, with its base | Options with no basis for choosing | `DR-EVIDENCE` |
| Recommendation | The recommended option, or an explicit statement that none is made | A recommendation hidden among the options | `DR-RECOMMEND` |

Each id is an acceptance item in `tests/rubric.yaml` and names the defect that flips it. If a field is missing,
supply the context or present the item as incomplete -- do not transfer the work to the reader.

## Chronology

The decision argument is normally organized by requirement and consequence, not meeting
order. Include history only to establish supersession, explain a changed premise, or show
why an earlier choice is no longer authoritative.

## Common failures

- reverse-engineering intent from code without marking it as inference;
- listing options but not the selection criterion;
- presenting a current default as a permanent domain rule;
- keeping stale decisions beside new ones without declaring authority.
