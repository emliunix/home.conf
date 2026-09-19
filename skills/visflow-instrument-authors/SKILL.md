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

## The author-round protocol (the full protocol)

*Moved here from `method.md` when that file became a manifest (2026-09-19): the procedure lives
with the skill, and the manifest points at it.*

The reader batch measures the spine. The **surface** has its own instrument, and it is the same shape:
give someone the thing, let them use it, and count what happens.

**Protocol.** Three to five authors, each given the surface documentation and one workflow spec, blind to
the corpus and forbidden to read the repository beyond a stated command. Two variants, which measure
different things:

- **blind** -- documentation only, no tool, one attempt. Measures whether the documentation alone leads to
  a document the checker accepts, and which constructs the author has to guess.
- **assisted** -- the documentation **and the elaborator CLI**, up to a stated number of runs per document.
  Measures the feedback loop: iterations to acceptance, which diagnostics are actionable, and which
  constructs the author abandons from the documentation to get there.

**The record.** One line per run per document: the diagnostic received and the change made. The report is
the iteration count (or "never accepted"), the most and least useful diagnostic quoted, what was abandoned,
whether the spec was expressible at all, and anything in the messages that was wrong or missing.

**The freeze rule applies**, as it does to the reader batch: tag the tree before dispatch, commit nothing
until the last author is back, correct in one batch afterwards. The tag follows the same convention -
`author-round-<n>`, created at dispatch, recorded with the round.

**The falsifier, and it matters.** A trial whose documentation is the trial's own rendering measures the
author against the person who wrote the summary rather than against the language. Hand authors the
repository's own files where they exist; where they do not exist, say so in the trial's record and treat
the result as being about the summary as much as about the surface.

**What the first trial found.** `worklog/surface-authoring-trial-1.md`: three authors, two documentation
sets, one checker, **0 of 6 documents accepted**, and the failures were three distinct rules rather than one
repeated -- the documented agent node has no lowering at all, the strict subset refuses the inline
`id --> id` form, and the implemented gate accepts only counter predicates, so the trial's own spec
("route on the test result") was attacked three ways and refused three times.

## References
`method.md` · *Measuring the surface: the author round*; `authoring.md`; `use-cases/README.md`; `loop-surface/corpus/`.
