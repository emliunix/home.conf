# Routing and disposition

Route each accepted lesson to the owner with the shortest path to future behavior.

| Evidence and scope | Destination | Mechanism |
| --- | --- | --- |
| One-off event that explains this run | Corresponding worklog | Dated evidence entry with source references |
| Work that remains unresolved | Project's explicit open-work register | Owner, next action, and closure evidence |
| Machine or runtime fact | Local environment record | Versioned fact, reproduction command, and re-check condition |
| Judgment future agents must exercise | Existing skill or agent instruction | Scoped rule plus a concrete failure example |
| Stable domain or architecture rule | Owning design | Current-tense rule, rationale, and affected contract |
| Recurring detectable failure | Code structure | Type, API, test, lint, script, hook, or generated check |

## Disposition test

For every candidate, choose one status:

- **apply:** within the invocation's authorization boundary and supported by evidence;
- **verified existing:** the source task already encoded and checked the mechanism;
- **propose:** useful, but the destination changes shared policy, architecture authority, or another owner's surface;
- **open:** evidence shows unresolved work, so add it to the project's existing register;
- **retain locally:** one-off evidence belongs only in the worklog;
- **reject:** unsupported, duplicated, over-generalized, stale, or more costly than the problem.

Do not create a destination to avoid finding the existing owner. If no owner exists, report that as
an unresolved governance gap before adding a new register.

## Strength test

1. Does the evidence reproduce, or is it one observation?
2. Is the lesson local to this project, runtime, or version?
3. Can a mechanism detect or prevent the failure?
4. Will the intended future reader consult the proposed destination?
5. What event makes the lesson stale or removable?

When a structural mechanism carries the whole rule, do not duplicate it as an instruction. Keep a
short rationale only where a maintainer needs it to understand the mechanism.
