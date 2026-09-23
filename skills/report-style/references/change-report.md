# Change report

## Use when

The reader needs to understand a product, domain-model, API, policy, data, or operational
change and its consequences. A feature list is useful only when capabilities are the
natural units of change.

## Aspects

| Aspect | Question it answers |
| --- | --- |
| Scope anchor | Which baseline and target are being compared? |
| Reader-visible behavior | What can a user, operator, or caller do differently? |
| Before / after | What was true before, what is true now or in the target, and why does the difference matter? |
| Model change | Which objects, opaque identities, human-readable names, fields, relations, or ownership boundaries changed? |
| Operation and contract change | Which commands, queries, routes, events, or payloads were added, removed, or redefined? |
| Policy change | Which rules are enforced, removed, deliberately absent, or deferred? |
| Data and compatibility | Does persisted or external state need migration, coexistence, rollback, or no compatibility at all? |
| Availability | Is each change implemented, reviewed design, draft, blocked, or merely proposed? |
| Evidence and boundary | What observable check supports the change, and what is not yet claimed? |

Keep **model facts** separate from **policy**. An enum, field, or configuration value is
not automatically a transition rule. State explicit absences when they prevent readers
from inferring policy that the product has not chosen.

## Chronology

Prefer before/after comparison over a sequence of edits, goals, agents, or review rounds.
Include order only when migration, rollout, compatibility, or an intermediate state
changes correctness. If chronology is included, explain its consequence; do not publish
an activity ledger.

## Common failures

- organizing by files, tickets, agents, or workstreams instead of changed behavior;
- mixing current implementation with target design;
- conflating opaque identity with a human-readable name, configuration with a domain
  invariant, or vocabulary with a transition policy;
- reporting tests run without saying which changed claim they establish.
