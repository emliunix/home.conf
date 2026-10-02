---
name: process-module-review
description: >-
  Review a module, landed unit, or file boundary as evidence: build four
  preparation graphs first, pin each claim to a base and command, reproduce the
  project's gates and seeded red where possible, then publish the findings with
  an explicit claim boundary. Use when asked to review a module or landed unit,
  or to explain an architecture boundary. The project's own design and quality
  rules remain authoritative.
---

# Process module review

A module review is not an opinion about code. It is a set of claims, each
pinned to a revision and the command that produced it, attached to a focused
surface you build before judging the module.

This is the portable method. The project supplies the laws, gates, paths, and
publication target; this skill supplies the review shape. When the project
states a rule in its own design or `AGENTS.md`, that surface wins.

## Required project inputs

Collect these before the first pass. If one is missing, say which claim is
therefore unavailable rather than filling it from memory:

- **Acceptance authority:** the card, design, contract, or project rule that
  defines done. Reviewer taste is never the acceptance authority.
- **Revision boundary:** the module's source root, base revision, tip, and
  whether the artifact is pinned.
- **Project gates:** the exact format, typecheck, test, contract, or build
  commands, plus the package or module suite that covers the changed surface.
- **Boundary queries:** the project's export-surface query, import graph, or
  language-aware inspection command.
- **Seed mechanism:** how the project breaks a claim on purpose and proves the
  check reddens, then how it restores the seed byte-identically.
- **Durable record:** where the review survives the session: repository record,
  worklog, wiki, artifact store, or ticket. If the venue is Raft, follow
  `raft-group-chat` and verify the artifact checksum.
- **Local review rules:** language, framework, or module-quality skills that
  own rules this review must apply instead of restating them.

If the project has no gate for a claim, the finding is "unverified" or
"policy-only", not a pass.

## Step 0: build the focused surface

Produce four Mermaid graphs in the report's `## Diagrams` section. Each graph
carries one claim. Build them from measurement, not memory: import/export
inspection, language-aware symbol queries, section markers, and the project's
package entry points. A grouping guessed from a partial text search is the
first defect.

| Graph | Shows | The claim it makes readable |
| --- | --- | --- |
| **D1 - roles and boundary edge** | pure decision modules, effectful executors, composition roots, with the port drawn as the edge | the divider is the port, not the topic; no edge leaves a pure module for a port |
| **D2 - enforcement map** | per rule, where it is enforced by a gate with a seeded red and where it is only asserted in prose | which invariants are properties and which are habits |
| **D3 - symbols grouped by file** | each file as a group, titled by category, containing the symbols it actually exports, with relations as edges | every arrow runs decision -> effect; the composition root is the hub |
| **D4 - key-symbol UML** | the hub class or function: the ports it binds, the collaborators it drives, and its public surface | why a cut would have to route this plumbing through a new port |

Prefer a compiler, language server, or package-export query over regex when the
question is structural. If only text search is available, state that bound in
the graph caption.

## Step 1: subject and baseline

State the artifact, the reviewed range, the tip, the date, and the acceptance
authority. Name the project gates that will be run and the gates that cannot be
run. Distinguish a reviewed commit from a branch name and a current branch tip
from the branch's merge base.

## Step 2: conformance, claim by claim

Use one row per procedure claim:

**claim | how checked | base or revision | result**

Take the checklist from the project's own laws. Common claim families include:

- the owning design or contract is cited and exists at the named revision;
- one authority owns each symbol, state transition, or rule;
- the public export surface is unchanged or the change is explicitly accepted;
- a required gate has a seeded red that can fail and a restored green;
- the receipt or artifact is pushed to the durable record;
- format, typecheck, suite, and contract gates pass at the reviewed tip.

Do not import a rule from another project just because it sounds rigorous. If
the project has no such law, record that the claim is not governed there.

## Step 3: findings, then strengths

A receipt is a claim, not evidence. Reproduce what you can and mark the rest
`source-backed, not reproduced`.

A finding needs:

- an observable defect or drift;
- severity in the project's own vocabulary;
- evidence, including revision and command;
- the consequence for a user, operator, or system;
- the concrete change that resolves it.

Order findings by consequence, then state strengths and confirmed properties.
Report deviations rather than smoothing them, including deviations in the
review that was already run when the procedure requires it.

## Step 4: claim boundary

Close with four explicit sets:

- **establishes by reproduction here** - commands run and outputs observed;
- **source-backed only** - read from the repository but not re-run;
- **not claimed** - questions outside the review's authority or scope;
- **unverified boundary** - what could not be inspected or reproduced.

No review is complete without this boundary.

## Step 5: durable output

Write the report with `report-style` (kind: review output; shape: record unless
the project's record says otherwise). Publish it through the project's durable
record and verify the returned digest against the local file. The channel
message leads with the verdict and the finding that changes a decision, not
with the method.

## Supporting skills

Use these when their subject is actually in play; do not restate them here:

- `report-style` - report kind, record versus brief, source keys, and claim
  boundaries.
- `reviewer-seat` - recurring observer cadence and independent-verification
  discipline. This module-review skill is the unit-review method, not a seat
  schedule.
- `code-quality` - project and language quality rules when the reviewed module
  is code.
- `efficient-tool-use` - when repeated inspection or output shaping is becoming
  the review's own defect.
- `pstack/principle-encode-lessons-in-structure`, `pstack/reflect`,
  `pstack/create-verification-skill`, and `pstack/how` - when stabilizing or
  explaining the review process.
- `pstack/principle-prove-it-works` and
  `pstack/principle-test-behavior-not-implementation` - evidence and seeded
  gates.
- `pstack/principle-boundary-discipline` and
  `pstack/principle-minimize-reader-load` - boundary and reader shape.
- `pstack/maintain-verification-skill` - keeping the review procedure honest.
- `pstack/principle-exhaust-the-design-space` - only when the review is
  designing a genuinely novel cut.

The pstack handles are optional external skills. If a handle is not installed,
say so and use the project's own equivalent rather than pretending the rule was
applied.
