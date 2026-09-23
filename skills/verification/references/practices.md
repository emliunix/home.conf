# Verification practice library

Select practices by the property at risk. A row is relevant only when its
trigger is present.

| Practice | Trigger | Required witness |
| --- | --- | --- |
| Authority layering | Several documents or artifacts can state the same rule | One declared precedence order and a conflict example that resolves to one authority |
| Frozen requirements and coverage | A goal tracks owner requirements across designs | Every live requirement maps to a design and fresh evidence; later additions do not rewrite the frozen root |
| Design plus verification | A design makes a material behavior claim | The design pairs the claim with an observable and a failure witness |
| Shared rubric metadata | Several artifacts of one kind use the same quality criteria | One shared rubric is referenced from compact metadata; a local file cannot weaken inherited critical items |
| Evidence claim ceiling | Completion depends on a runtime boundary | The report names E0-E3 and does not claim a boundary the command did not exercise |
| Risk-selected verification | The change has several possible test families | The design selects checks from actual state, data, concurrency, user, and integration risks and records why omitted families do not apply |
| Semantic mutation | A rule or evaluator result blocks acceptance | A representative semantic defect changes a known pass into the declared non-pass outcome |
| Worklog evidence separation | Review or execution produces history and raw output | Current decisions stay in the design; commands, outputs, rejected paths, and review history stay in the worklog |
| Migration rehearsal and recovery | A real persisted shape crosses a declared release boundary | A preserved old-shape fixture proves forward migration, rollback, and restoration |
| Boundary-first observability | A change introduces or moves an integration boundary | The smallest real consumer path runs first and emits enough structured evidence to identify the decision and failure class |
| Public contract hygiene | A CLI or API exposes internal control fields | A contract test proves only intentional user controls are public and internal retry, ordering, or operator fields stay private |
| Stable document references | Documents or tools link into evolving prose | References use stable section IDs or program symbols; a heading-preserving edit does not break the link |

## Additional practice selectors

Use these only when the named risk exists:

- **Real path.** Exercise the production parser, serializer, command, or adapter
  instead of restating the same fixture on both sides of a mock.
- **Property examples.** Generate boundary and malformed cases when a parser,
  resolver, or state machine has a broad input space.
- **Refusal.** Prove invalid, unauthorized, over-budget, or unsafe input fails
  before a side effect.
- **Replay and idempotency.** Repeat an operation when retries or duplicate
  delivery can happen. Observe stable state and identity.
- **Concurrency.** Overlap actors only when the system has shared mutable state.
  Prove the ownership or serialization rule, not only the happy result.
- **Persistence.** Restart or reopen the real store when durability is claimed.
- **Diagnostic trace.** Assert the reason class and correlation identity at a
  boundary. Do not persist secrets or raw provider bodies.
- **Visual interaction.** For user interfaces, exercise the rendered product at
  its supported viewports and input methods.
- **Independent oracle.** Compare against another implementation or direct
  protocol client when both do not share the same failure mode.
