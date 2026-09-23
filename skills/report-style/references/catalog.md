# Report-kind catalog

Choose the kind by the reader's dominant question, not by the files available or the
steps the author performed.

| Kind | Reader's question | Reference | Is work chronology normally relevant? |
| --- | --- | --- | --- |
| System | What is this system, how is it divided, and how does it behave? | [system-report.md](system-report.md) | No. Runtime flow may be essential; implementation history is not. |
| Change | What behavior, model, contract, or policy is different? | [change-report.md](change-report.md) | Usually no. Use before/after; include ordering only for migration or compatibility. |
| Status | What is usable now, what remains open, and what decision or action is needed? | [status-report.md](status-report.md) | Sometimes. Include only milestones or dependency order that explain the present state. |
| Decision | Why is this the chosen direction, and what alternatives or consequences matter? | [decision-report.md](decision-report.md) | Rarely. Include supersession history only when it explains current authority. |
| Review output | Is the reviewed subject sound, conformant, and ready; if not, what must change? | [review-report.md](review-report.md) | No. Re-review disposition may refer to prior findings, not replay the review session. |
| Research | What do the sources establish, how do options compare, and what follows? | [research-report.md](research-report.md) | No. Source publication chronology matters only when the subject changed over time. |
| Retrospective | What happened, why did it happen, and what should change because of it? | [retrospective-report.md](retrospective-report.md) | Yes when sequence establishes cause; otherwise organize by finding. |

## Routing rules

- A report about **the current architecture** is a system report. A report about **why
  that architecture was selected** is a decision report.
- A report about **what changed for users or the domain** is a change report. A report
  about **whether the change is complete and what blocks it** is a status report.
- A report about **what an evaluation found** is review output. The review method itself
  belongs to the relevant review skill.
- A report about **what was learned from execution** is a retrospective. It is the main
  kind in which work history can be evidence rather than noise.
- When two kinds overlap, name the primary reader question. Import individual aspects
  from at most one secondary kind instead of creating a section for every kind.

## Universal rejection test

For every proposed section, ask: "Would removing this prevent the intended reader from
understanding the answer, making the decision, or trusting the claim boundary?" If not,
remove it.
