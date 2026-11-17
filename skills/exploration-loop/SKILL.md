---
name: exploration-loop
description: Run a guided, evidence-first exploration of a codebase or system; frame the question, collect cited facts, synthesize validated claims, persist the result to Nowledge Mem, and extend the loop as the user adds direction. Use when asked to explore, map, or audit a repository or architecture; trace how something works; study a development process, documentation, or tooling; or produce findings that must outlive the session and be trusted later.
---

# Exploration Loop

A repeatable loop for turning a broad question about a codebase into a durable, validated
document. It is the `exploration` skill's Notes → Facts → Claims format plus framing,
user steering, independent validation, and memory persistence.

**Read-only by default.** This skill produces knowledge, not code changes. If the user asks
for a change, finish the exploration and hand off to a change plan.

## The loop

```
Frame → Survey → Facts → Claims → Write → Validate → Persist → Report
              ↑                                      |
              └──────── user adds direction ─────────┘
```

Never skip Validate. Never persist before it.

## Non-negotiables

1. Read the workspace's own rules first: `AGENTS.md`, `CLAUDE.md`, `LESSONS.md`,
   `docs/code-standards.md`, and any `docs/subsystems/` index.
2. Every fact has a location (`path:line`) or a command. Every measurement names its
   commit and date.
3. Every claim references facts or prior claims. Facts never contain reasoning.
4. Validation is independent and read-only. The author does not mark their own work
   validated.
5. Negative findings state their search scope ("searched X for Y; none found"), never
   "does not exist".
6. Never persist secrets, tokens, credentials, or personal data.

## Phase 0 — Frame

- Write the central question in one sentence.
- Write explicit IN and OUT scope. Out-of-scope is a feature: it keeps the document finite.
- Choose the artifact:
  - New topic: `analysis/{TOPIC}_EXPLORATION.md`
  - Related topic with an existing master: `analysis/{TOPIC}_{DATE}_{ID}_TEMP.md`, merged
    into the master after validation.
- Create a todo list with one item per phase plus each sub-question.
- For a broad request, split it into 3–5 answerable sub-questions before collecting
  anything.

## Phase 1 — Survey

Measure before reading deeply; it tells you where the weight is.

- Read the ground truth: workspace instructions, subsystem index, lessons, standards.
- Measure: file counts, lines per package, test counts, dependency list, Git volume.
- Find the entry points and trace one representative path end to end.
- Inspect the documentation tree and CI at the same time as the code: they state the
  intended contracts.
- Stop when you can name the main subsystems and where each lives. Write a five-line
  orientation before collecting facts.

Useful commands (adapt to the stack):

```sh
find . -name '*.go' | wc -l
find internal/<pkg> -name '*.go' ! -name '*_test.go' -print0 | xargs -0 cat | wc -l
git log --oneline | wc -l
git log --numstat --pretty=format: | ...
```

## Phase 2 — Facts

A fact is a leaf: raw evidence with no interpretation.

- Cite `path:line` (or `path:start-end`).
- Quote code, config, command output or document text verbatim. Mark omissions with `...`
  or `…` and say that comments were elided.
- For measurements, include the command and its result; do not paraphrase a count.
- Number facts (`Fact 1`, `Fact 2`, …) so claims can reference them.
- If you catch yourself explaining *why*, stop: that belongs in a claim.

```markdown
### Fact 3: The route table mounts every client API

`internal/gateway/gateway.go:949`

```go
func (s *Server) routes() *routeMux {
	mux := &routeMux{ServeMux: http.NewServeMux()}
	mux.HandleFunc("POST /v1/chat/completions", s.handle(provider.Chat))
	...
}
```
```

## Phase 3 — Claims

A claim is a reasoned synthesis over facts and earlier claims.

- Make it atomic and falsifiable: one assertion per claim.
- List references explicitly: `Fact 3, Fact 7, Claim 2, Note 4`.
- Add `Confidence: High | Medium | Low` and the date.
- Separate observed behavior from interpretation. If it is an inference, say so.
- Do not pair facts and claims 1:1; several facts may support one claim, and one claim may
  reuse many facts.
- On contradictory evidence, record both and mark `CONTRADICTS: <source>`; do not resolve
  it silently.

```markdown
### Claim 4: The gateway translates protocols instead of running models

**Reasoning:** The route table accepts four client APIs (Fact 3), `attempt` decides relay
vs. translate from the upstream's protocol support (Fact 9), and the package doc states
the translation contract (Fact 21).
**References:** Fact 3, Fact 9, Fact 21
**Confidence:** High
**Date:** 2026-11-09
```

## Phase 4 — Write

Document order follows dependency order:

```markdown
# <Topic> Exploration

**Topic:** ...
**Commit:** `<sha>` (`<subject>`)
**Date:** YYYY-MM-DD
**Status:** Draft | Validated
**Related:** [`OTHER_EXPLORATION.md`](OTHER_EXPLORATION.md)

## Notes
### Note 1: Central question
### Note 2: Scope and method
### Note 3: Terminology

## Facts
### Fact 1: ...
### Fact 2: ...

## Claims
### Claim 1: ...
### Claim 2: ...

## Open questions
1. ...

## Validation
Two read-only passes. What was checked, what was corrected, what remains unverified.
```

- Notes carry context and planning; facts carry evidence; claims carry reasoning.
- Cross-link related explorations instead of repeating them.
- Keep open questions explicit; they are the next session's entry point.

## Phase 5 — Validate

Spawn an independent, read-only validator. One validator per document is enough for a
focused exploration; split by section for a large one.

The prompt must contain:

1. Absolute paths to the document and to the validation rubric
   (`skills/exploration/REFERENCE.md`, or the rules below).
2. The exact items to check (`F1–Fn`, `C1–Cn`).
3. The rubric: does the fact exist at the cited location and say what is claimed; does the
   claim follow; are numbers reproducible; is anything overreaching.
4. The deliverable: `F<n>: Yes|No|Partial — note`, `C<n>: ...`, then a corrections list.
5. "Do not edit any file."

Apply corrections yourself. If the document changes, revalidate the changed items (a second
pass on the delta is enough). Record both passes in the Validation section; never write
"validated" without them.

## Phase 6 — Persist

If `nmem` is available (`nmem status` answers), save the full document and a distilled
memory. Do not paste the whole document into a memory: summarize the answer, the key
numbers, the commit, the document path, and the validation status.

```sh
nmem library add analysis/TOPIC_EXPLORATION.md \
  -l <topic> -l exploration -l <subtopic> \
  -c "Validated exploration at <commit>: <one-line scope>."

nmem memories add --stdin \
  -t "<Topic>: <one-line answer> (<commit>)" \
  -i 0.8 -l <topic> -l exploration -l <subtopic> -s cli <<'EOF'
<distilled findings: what it is, key measurements, where the full doc is, validation status,
open questions>
EOF
```

Record the returned memory id and artifact id in the report. If the backend is unreachable,
keep the files and say the save failed; never silently drop it.

## Phase 7 — Report

- Lead with the answer, not the method.
- Give the 5–10 numbers that matter.
- Link the document and any saved memory/artifact ids.
- State validation status and what is still uncertain.
- Keep the message short enough to read in one screen; the document holds the detail.

## Steering: when the user adds a direction

Users often extend an exploration mid-flight ("now look at X"). Treat that as a new scope,
not a restart.

- Same topic: extend the same document, or add a section; keep prior numbering stable.
- Distinct topic: start a new master document and cross-link both ways.
- Preserve earlier facts and validated claims; reuse them instead of re-deriving.
- Keep unresolved questions visible.
- Update the todo list and say what changed in one sentence.
- If the new direction contradicts an earlier claim, mark the old claim superseded; do not
  delete it.

## Anti-patterns

- A "fact" with no location, or a claim with no references.
- Paraphrasing code from memory instead of quoting it.
- Mixing reasoning into Facts, or evidence dumps into Claims.
- Measuring once and citing the number without the command or commit.
- Declaring validation without an independent pass; editing the file while the validator
  reads it.
- Persisting unvalidated claims as memory.
- Exploring forever: stop when the central question is answered or the remaining branches
  are explicitly deferred.

## Done criteria

- [ ] Central question answered, or its remaining branches listed as open questions.
- [ ] Every fact points at a location or command; measurements carry a commit and date.
- [ ] Every claim has references, confidence, and a date.
- [ ] An independent read-only pass checked the facts and claims; corrections are recorded.
- [ ] The document is saved with a Validation section.
- [ ] If `nmem` is available, the document is in the Library and a distilled memory exists.
- [ ] The user has a one-screen answer with links.
