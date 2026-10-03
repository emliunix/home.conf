---
name: code-analysis-cookbook
description: >-
  Recipes for code ANALYSIS and code EDITING with compiler, language-server,
  structural-AST and reference tools: typecheck a package, rename a symbol
  everywhere, find every caller, resolve a citation to its definition, count a
  population with its predicate. Use when a task is to learn a fact about code
  or to change code by its structure, especially before reaching for grep/sed.
  Topics live under this one handle; read the topic that matches the task. Do
  not use for general tool use or transcript auditing (see efficient-tool-use
  and audit-agent-tooling).
---

# Code-analysis cookbook

One trigger, task-grouped recipes. Read only the chapter that matches the task
in front of you; the chapter files are the durable recipes, not this routing
surface.

**The default is structural, not textual.** A text pattern stands in for the
structure it means: `sed s/old/new/` matches a *string*, so it rewrites comments
and test names that merely contain it, and a structural pattern that cannot see
a construct reports "no match" exactly like a genuine absence. Reach for the
structural tool first and keep text search as a documented fallback — with the
knowledge of which one you are holding.

**Every recipe states its failure mode**, and that column is the reason this
cookbook exists. Checked-and-clean must be distinguishable from could-not-read:
a tool that refuses a target, exceeds a size limit, or holds a stale index has
**not** answered, and its silence must never be read as a pass.

## Chapters

- **`code-analysis-cookbook/typecheck`** —
  [typecheck.md](references/typecheck.md): typecheck a package and its tests;
  the gap where `pnpm check` is green while a package does not compile.
- **`code-analysis-cookbook/symbol-edit`** —
  [symbol-edit.md](references/symbol-edit.md): rename a symbol, find every
  caller, and read the enclosing symbol before editing a line.
- **`code-analysis-cookbook/service-state`** —
  [service-state.md](references/service-state.md): judge a service by what it
  serves, not by what it reports; `active (exited)` is not "started".
- **`code-analysis-cookbook/native-prerequisites`** —
  [native-prerequisites.md](references/native-prerequisites.md): six ways a
  library reports "not found", with the different fix each needs.
- **`code-analysis-cookbook/diagnostic-rules`** —
  [diagnostic-rules.md](references/diagnostic-rules.md): judge a lint rule by what
  it read; a rule can fire correctly and be wrong, and its own test corpus can be
  the reason.
- **`code-analysis-cookbook/symbol-outline`** —
  [symbol-outline.md](references/symbol-outline.md): learn a large file's shape
  from an outline instead of reading its bytes.
- **`code-analysis-cookbook/structural-search`** —
  [structural-search.md](references/structural-search.md): AST search and
  preview-then-apply replacement; what it can and cannot see.
- **`code-analysis-cookbook/citation-and-population`** —
  [citation-and-population.md](references/citation-and-population.md): resolve a
  locator to the thing it names, and count a population with its predicate
  printed.

## Proposals (not recipes)

Tools nobody on this host has run end to end are listed in
[proposals.md](references/proposals.md) as candidates with their prerequisites,
never as recipes. Move one here only when a seat has executed it and recorded
the failure mode.

## Runnable

`scripts/typecheck-all.sh` — the non-gate form of the typecheck chapter: runs
every workspace package's typecheck, attributes each error to the FILE that
carries it, and refuses to report a pass when it found no `tsconfig.json` at all.
Copy it into a repo as `scripts/local/typecheck-all.sh` and run with `sh`.
**It changes no repository gate** — wiring a `typecheck` entry into a repo's
aggregate check is a separate decision.

`scripts/patch-pi-lens-lsp-limit.mjs` — raises pi-lens 4.3.0's hardcoded
LSP-sync line bound from 5000 to 10000 in the installed package, with
`--revert` to restore stock. It is a host patch, not a supported pi-lens
setting; re-run it after an install and start a fresh Pi session.

## Evidence

Source cases: agent-substrate, 2026-10-03 — the #99 port race, #94's landed
type errors behind a green gate, and the citation/population findings in the
#88/#95/#98 chain. Every invocation in the chapters was run on this host; where
a claim is quoted from another seat it says so and names the message.

Add a recipe only when it changed a decision and its invocation is reproducible
on this host (or is marked with its missing prerequisite). Replace a superseded
recipe in place rather than keeping contradictory versions.
