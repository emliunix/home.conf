---
name: visflow-instrument-authors
description: >-
  Project specific method on DX trials in visflow: blind and assisted authors, the
  repository’s own files never a summary, docs-as-code, acceptance implies execution. Use in
  visflow when measuring whether the surface lets someone produce a working program; not when
  the measurement is compile counts, or the material is a summary rather than the surface.
---

# Author round

1. **Two arms** — blind (documentation only) and assisted (documentation + the elaborator CLI, capped runs). They measure different things: the first, whether the docs are sufficient; the second, whether the feedback loop teaches.
2. **Hand the repo’s own files**, never a summary — otherwise the trial measures the summary.
3. **One topic per author**, drawn from `use-cases/` or the owning programme’s corpus.
4. **Measure** first-pass acceptance, iterations to acceptance, which diagnostics were actionable, and which constructs the author abandons to get there.
5. **Acceptance implies execution** — a document that compiles but cannot run is not accepted; the trial runs what it accepts.
6. **Freeze while the trials run**; disposition every finding per `visflow-findings`.

## References
`method.md` · *Measuring the surface: the author round*; `authoring.md`; `use-cases/README.md`; `loop-surface/corpus/`.
