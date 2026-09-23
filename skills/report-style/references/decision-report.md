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

## Chronology

The decision argument is normally organized by requirement and consequence, not meeting
order. Include history only to establish supersession, explain a changed premise, or show
why an earlier choice is no longer authoritative.

## Common failures

- reverse-engineering intent from code without marking it as inference;
- listing options but not the selection criterion;
- presenting a current default as a permanent domain rule;
- keeping stale decisions beside new ones without declaring authority.
