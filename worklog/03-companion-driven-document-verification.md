# Worklog - companion-driven document verification

## C1 - Goal and design draft

The owner confirmed the three-stage automation path: coarse changed-file
activation in Prek, per-document verification selection from adjacent YAML, and
the existing Markdown segmentation plus JEV plus Prolog evaluator. The owner
corrected one proposed boundary: an absent companion warns and falls back rather
than failing the repository.

Design 03 is a follow-up to landed Design 02 because it changes the companion
contract and affected-input graph without invalidating the original verifier
architecture. The minimum implementation adds a typed companion profile, a
warning channel, YAML reference edges, and a safe Prek trigger. It does not add
an arbitrary workflow language or command execution from YAML.

## C2 - Review plan

One independent reviewer will cover these angles:

1. **Root fidelity:** the companion is expressive enough to select rubric-based
   verification while missing companions remain warning-only.
2. **Trigger and graph correctness:** Prek cannot suppress shared YAML changes,
   and baseline-only rubric or companion edges retain their consumers.
3. **Precedence and safety:** CLI overrides, companion profiles, companion
   defaults, and repository defaults resolve deterministically without enabling
   arbitrary execution or DML.
4. **Proof quality:** tests demonstrate the warning exit behavior, strategy
   selection, targeted shared-rubric closure, and external hook behavior.

P0 project-contract review is skipped because this repository declares no
separate P0 contract. Design 03 covers R1-R3 in goal 02.

## C3 - First review and defense

The independent reviewer returned one passing trigger/graph angle and three P1
ambiguities. All three findings served the frozen root and were accepted:

| Finding | Correction |
| --- | --- |
| The companion was still only a rubric pointer | Defined `X.yaml#rubrics` as the default full rubric block, with inherited and local items in one recorded chain. |
| Precedence, reference bases, and profile scope were ambiguous | Added a field-by-field table and made an explicit CLI profile apply to the complete affected closure. |
| The proof did not compose staged Prek, live JEV, and Prolog | Added a live temporary-consumer witness requiring one semantic call and `all.required.facts`; separated artifact evidence from aggregate closure verdict. |

The warning-only rule passed. The companion expressiveness around it needed the
first correction above.

**Simplicity delta.** The design retains two fixed companion profiles and the
existing rubric grammar. It removes the undefined external strategy-file class
and does not introduce an arbitrary stage graph or command execution. Complex
verification composes from rubric inheritance, selected sections, the existing
fixed evaluator stages, and deterministic rules.

## C4 - Rematch defense

The first rematch passed four angles and found one remaining P1: a document
without a companion falls back to its repository document-rule rubric, but that
rubric was not explicitly included in the dependency graph. The finding is
accepted. Every document node now links to the applicable repository rubric in
both snapshots, in addition to companion and profile roots. The example also
stops overriding its own companion rubric during promotion, so its local item
remains in the effective chain.

## C5 - Review gate

The final independent rematch passed R1-R3 and all four attack angles with no
remaining P1. Design 03 moves from `draft` to `reviewed`; implementation may
begin against the typed companion, warning, graph, and Prek contracts.

## C6 - Implementation round 1

Implementation added typed companion profiles and full local rubrics, a
warning-only diagnostic channel, baseline-plus-candidate YAML reference edges,
and coarse Prek filename filters. The deterministic suite initially exposed a
missing test import and a deprecated Zod builder; both were implementation
defects and were corrected without changing the architecture.

Self-review found that the design's own promotion profile selected the shared
rubric sections but omitted `scope---what-we-touch`, which is the evidence for
its local rubric item. The profile and example now select that section too, so
the document-local criterion is exercised rather than merely present in the
resolved chain.

## C7 - Implementation gate

Implementation round count: **1**.

Fresh evidence against R1-R3:

- `npm test` passed 9 files and 26 tests. The new cases cover full local rubric
  blocks, profile-relative rubrics and sections, cache refresh, missing and
  malformed companions, CLI precedence, and transitive shared-rubric closure.
- `npm run typecheck`, `npm run lint`, `git diff --check`, `uvx prek
  validate-config .pre-commit-config.yaml`, and `uvx prek validate-manifest
  .pre-commit-hooks.yaml` passed.
- A temporary immutable source revision passed the remote consumer hook. An
  unrelated staged text file was skipped; a staged Markdown edit ran, warned
  about its missing companion, and passed; removing a required section emitted
  the asserted path, section, rule ID, and `NO-GO` verdict.
- With the protected credential loaded by reference, `npm run verify:jev`
  passed against the pinned client hash and model, with equal normalized typed
  answers from the local `jev-prompts` client and SDK backend.
- The live remote consumer promotion passed with exactly one semantic call and
  a cached outcome whose deciding rule was `all.required.facts`.
- An uncached live promotion of Design 03 resolved the shared design rubric and
  its adjacent local rubric, evaluated all three questions in one JEV batch,
  and produced artifact `PASS` through `all.required.facts`. The dependency
  closure also evaluated Goal 02, whose separate result made one earlier
  aggregate run non-pass; artifact-level evidence remained explicit as the
  reviewed design requires.
- `npm pack --dry-run --json` contained the Node hook manifest, executable,
  runtime modules, and shared contracts.

The covered outcome is demonstrated with deterministic mutation witnesses and
fresh live integration evidence. Design 03 moves to `pending-retro`.

## C8 - Retrospective (2026-09-24)

### First-principles bottom line

Re-derived from R1-R3, the minimum architecture is: a cheap Prek inclusion
filter; authoritative staged capture and reverse dependency closure inside the
verifier; an optional, typed adjacent YAML control plane with repository
fallback; Markdown AST section selection; one bounded typed JEV batch; and
ordered Prolog clauses that alone decide the verdict. The as-built system
matches that minimum architecture - no pile-up.

The two hook filters are **constraint-justified** because the local repository
must also react to verifier/package changes while a consuming project only
needs Markdown/YAML activation. Baseline-plus-candidate graph union is
constraint-justified by deletion and retargeting correctness. Separate warning
and finding channels are constraint-justified by R3. There is no project-law
violation, known debt, or history-only accretion to remove.

The heads remain accurate. The Problem statement is still the missing
per-document control plane and overly broad hook activation; Scope stayed
within companion parsing, selection, graph closure, reports, and Prek; and the
Rationale survived execution. No arbitrary commands or DML became executable.

### Evidence and design holds

The C7 deterministic, package, remote-hook, parity, and live promotion evidence
proves the implemented path. One live attempt returned no terminal DML answer
and was correctly reported as `BLOCKED`; a fresh uncached rerun passed. Keeping
SDK retries at zero remains the deliberate cost and auditability boundary, so a
provider-transient retry is an explicit rerun rather than hidden extra spend.
A final uncached check of the exact `landed` design text again produced three
`supported` facts and `PASS` through `all.required.facts` for the design
artifact.

Design 03 holds and moves from `pending-retro` to `landed`. Goal 02 is
`CLOSED-GREEN`; no authorized work remains.

## C9 - Consumer-driven schema correction (2026-09-24)

The first `sandbox-deploy` adoption exposed two real companion conventions:
that repository used short rubric-class tags, while the newer `task-svc`
repository used compact metadata plus shared weighted rubrics. The initial
implementation made `rubrics.inherits` the executable entry and would have
needed permissive multi-shape parsing to consume both. The owner rejected that
direction: adoption is a standardization step, a configured subtree may be
migrated, and invalid present YAML should fail directly.

The corrected current model makes `verification` the entry. A shared file with
`kind: verification-strategy` owns the JEV rubric, default profile, section
selection, and cache policy. Each companion has `kind: document-contract`, a
typed `document` block, and `verification.kind: jev-prolog`; it inherits the
shared strategy and carries only its commands/evidence plus genuine local
rubric additions or profile overrides. Strict Zod objects reject unknown keys,
wrong discriminators, and document path or artifact-kind mismatches.

The first-principles shape remains one staged selector, one strategy chain, one
rubric chain, one JEV batch, and one ordered Prolog decision. The discarded
normalization experiment added no committed compatibility code. The weighted
threshold now counts every rubric item's weight after critical failures are
handled, matching the shared 85/100 design rubric used by the cleaner corpus.

Fresh evidence: 28 tests passed; typecheck passed; the migrated sandbox
`design/{99..104}` subtree passed draft validation with six artifacts and zero
warnings, then passed promotion with a mock JEV backend using six batches and
four facts per artifact. A fresh uncached promotion of Design 99 through the
corrected inherited strategy made one live JEV batch; all four facts were
`supported`, and generated Prolog selected `all.required.facts` with `PASS`.

## C10 - Commit feedback and schema ownership (2026-09-24)

The aggregate pass line was insufficient as an agent feedback surface. The
text CLI now has `--verbose`; each artifact reports its project-defined impact
path, required sections, base-to-local strategy chain, effective rubric chain,
expanded question-to-section line ranges, typed answers when evaluated, and
the JEV/Prolog decision. The provider hook requests verbose output, and the
consumer sets Prek `verbose: true` so successful output is visible on commit.

The owner then narrowed universality to the fields this verifier owns. Dedicated
verifier config and strategy files remain closed. Companion top-level and
`document` mappings accept project fields, but the parser retains only identity,
status, dependencies, and the closed verification subtree. Commands, evidence,
freshness, and other project metadata moved outside `verification`; unknown
fields within `verification`, profiles, and rubrics still fail directly.

Final evidence: 29 tests, typecheck, lint, package dry-run, hook manifest, and
sandbox Prek configuration passed. The exact committed provider revision passed
the remote-hook fixture without `prek -v`. A shared-strategy path reported all
six affected sandbox designs and their impact paths. A fresh uncached live
promotion of Design 99 printed its two-level strategy chain, one rubric root,
four question-to-section ranges, four `supported` facts, and Prolog `PASS` via
`all.required.facts` in one JEV call.

## C11 - Local credential pointer (2026-09-24)

The owner asked for a local override that points at the protected env file
while the committed project stays general, and named the file
`.env.doc-verify`. That matches the `jev-prompts` dotenv symlink: the shared
file's variable is `API_KEY`, the runtime variable is `TYPESAFE_API_KEY`, and
an unrelated process-wide `API_KEY` is not sent. `nmem` recorded the same
credential home and left this override open. No `.doc-verify.local.yaml`
schema was added. The loader runs at the start of `check` and the parity
entry. Home and the sandbox consumer each get a gitignored symlink to
`~/Documents/notes/common/creds/env-jev`. Fresh evidence: 33 tests, typecheck,
and lint passed. The home symlink loads `API_KEY` into `TYPESAFE_API_KEY`
for the process; the value stayed out of the check output.
