# System report

## Use when

The reader needs a coherent model of a system, architecture, domain, protocol, or
operating mechanism as it exists at a stated version.

## Aspects

| Aspect | Question it answers |
| --- | --- |
| Reading frame | What distinction prevents the rest of the system from being misunderstood? |
| Purpose and boundary | What is the system responsible for, and what remains outside it? |
| Layers and ownership | Which parts own state, decisions, coordination, and adapters? |
| Core objects | What are the important entities, values, projections, and identities? |
| Operations | What can callers or peers ask the system to do? |
| Runtime lifecycle | How does one representative operation move through the system? |
| State accounting | What is local, shared, durable, derived, or ephemeral? |
| Invariants and absences | What must stay true, and what tempting mechanism deliberately does not exist? |
| Extension points | Where can behavior vary without changing the core model? |
| Claim boundary | Which parts are implemented, designed, inferred, or open? |

Select the aspects that explain the system; do not manufacture empty sections. For a
design-transfer brief, a useful spine is frame -> one claim -> formal object -> mechanism
-> local/shared accounting -> obligations -> nearest contrasts -> claim boundary ->
evidence anchor.

## Chronology

Describe **runtime order**, not the order in which files were implemented. Mention design
evolution only when two versions coexist or a superseded decision would otherwise mislead
the reader.

## Common failures

- a module inventory with no ownership or interaction model;
- a happy-path sequence with no state boundary;
- presenting designed behavior as deployed behavior;
- explaining every component at equal depth instead of defending the load-bearing model.
