# report-style - design philosophy and dimensions

**What it is.** A router and writing method for reports. It separates **kind** (the
reader's question) from **shape** (durable record or one-sitting brief). `SKILL.md` is the
entry point; `references/` contains one concern set per report kind; `tests/` is the
instrument.

## Philosophy

1. **Question before outline.** Choose a kind from `references/catalog.md` before
   choosing sections. A system report, change report, and retrospective do not need the
   same furniture.
2. **Kind and shape are independent.** Any report kind can be a durable, source-keyed
   record or a concise brief. The kind controls what must be explained; the shape controls
   how much context and sourcing travel with it.
3. **Every load-bearing assertion carries a warrant.** It is measured, derived,
   source-backed, or visibly open.
4. **Process is included only when it is evidence.** Runtime flow can explain a system;
   before/after can explain a change; causal sequence can explain an incident. Commands,
   edit order, review rounds, and agent activity are normally omitted.
5. **The close is a boundary, not a summary.** The reader can distinguish established,
   designed, inferred, unresolved, and deliberately unclaimed statements.
6. **Subtract before adding.** A section that does not change understanding, a decision,
   or trust in the boundary is cut.

## Catalog

| Kind | Primary concern |
| --- | --- |
| System | boundaries, ownership, objects, operations, runtime lifecycle, invariants |
| Change | before/after behavior, model, contract, policy, data, availability |
| Status | usable now, open work, blockers, decisions, accepted exposure |
| Decision | requirements, options, selection, rationale, consequences, reversibility |
| Review output | verdict, findings, conformance, recommendations, unverified boundary |
| Research | corpus, findings, mechanism, comparison, inference, recommendation |
| Retrospective | intent/outcome, impact, causal sequence, causes, learning, changes |

The catalog is intentionally about reader questions, not document names. Report-kind
references provide aspects to consider, not mandatory headings to concatenate.

## Dimensions

| Dimension | The question | How it is measured |
| --- | --- | --- |
| Trigger | Does the surface fire for report writing and stay silent for prose polish, review execution, bare activity logs, and duplicated records? | Entry-only trigger cases over canonical, trap, and paraphrase prompts. |
| Routing | Does the writer select the reader's dominant question before choosing a structure? | Cross-kind prompts with an observable primary-kind choice and no template concatenation. |
| Chronology | Does the report include runtime, change-order, or work-history steps only when they answer the reader's question? | Change/status/retrospective contrasts, including a diary-shaped negative case. |
| Record | Is a durable report self-contained, keyed, and honest about capture scope? | Resolving keys, three-table legend, link checks, and claim boundary. |
| Brief | Does a one-sitting transfer carry the smallest sufficient argument and boundary? | Full versus control and subtraction arms over the same material. |
| Production | Does the chosen kind and shape improve a realistic report? | Mechanical invariants plus blinded comparison where prose judgment is unavoidable. |

## What it refuses

Prose polish; performing the underlying review, research, incident response, or
retrospective; a bare command/activity log; duplicate canon; decorative diagrams;
unsupported facts; and a closing summary presented as a claim boundary.

## Maintenance

Run the landing lint from this package:

```bash
uv run --with pyyaml python tests/l0.py
```

The lint parses frontmatter, checks rubric defects and case citations, verifies linked
report-kind references, and checks pinned production sources when the source workspace is
available.

`tests/frozen.lock.json` pins the evaluated material. After a deliberate change, update
the lock only after the relevant smoke checks and trials have been rerun. Record the
reason in `CHANGELOG.md`; do not treat a new hash as evidence that behavior improved.
