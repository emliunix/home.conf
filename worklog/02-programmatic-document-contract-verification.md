# Worklog - programmatic document contract verification

## C1 - Source grounding and draft

The owner directed that high-level documents remain the golden source while
their structural and semantic contracts become programmatically verifiable from
the flow and goal-file skills, including a `prek` commit trigger. The owner also
requested a manifest of reusable practices learned in a confidential project,
with that manifest kept outside `home.conf`.

No matching goal file exists in this repository, so Design 02 is grounded
directly in that owner request. Design 00 establishes `02` as the next unused
stable handle. The repository has no root verifier package or root hook
configuration today; existing executable projects are nested and are not
silently reused as the owner of this new contract.

## Decisions in force

- Documents remain authoritative. Code extracts and evaluates facts but does
  not manufacture missing high-level policy.
- The verifier uses deterministic structural facts, bounded JEV semantic facts,
  and an explainable declarative rule graph.
- JEV reports evidence and uncertainty; deterministic rules produce verifier
  outcomes. Correlated confidence values are not multiplied as if independent.
- One executable contract serves skills, `prek`, and CI. Commit-time checks read
  staged blobs, while CI remains authoritative because hooks are bypassable.
- Draft edits use a fast structural profile. Lifecycle promotion requires a
  fresh semantic attestation keyed by content and policy versions.
- Shared rubrics are selected by artifact kind and referenced from metadata.
  Artifact-specific decisions and acceptance properties stay in Markdown.
- The private practice manifest remains in its source repository. Only reviewed,
  generalized practice text may cross into `home.conf`; source provenance stays
  private.

## Rejected or deferred paths

- **One decision tree:** rejected because requirements, blockers, and affected
  dependents overlap rather than form mutually exclusive branches.
- **Full probabilistic Prolog:** deferred. The current need is explainable rule
  evaluation with annotated uncertainty, not joint probability inference.
- **One custom rubric per document:** rejected because it turns metadata into a
  duplicate design surface and prevents consistent evaluation.
- **JEV as acceptance authority:** rejected because confidence is evidence for a
  bounded claim, not proof or lifecycle authority.
- **Hook-only enforcement:** rejected because `--no-verify` and non-Git authoring
  paths exist. CI and skill invocations must use the same evaluator.
- **Copying source documents into this repository:** rejected by the
  confidentiality boundary. The external manifest is an intake ledger, not an
  export bundle.

## Verification status

This cycle creates the design and external manifest only. Implementation,
fixtures, a `prek` hook, CI wiring, and independent grill review remain pending.

## C2 - Review plan

The source-side transfer manifest was located and inspected in its owning
confidential repository. It conforms to the boundary assumed by the design:
source references remain local, candidate statements are generalized, and each
entry has an explicit transfer state. No raw manifest content is copied here.

Independent review will evaluate four angles:

1. **Problem, scope, and implementability:** whether one design can coherently
   own document verification and the transfer boundary, and whether its open
   packaging/rule/JEV choices leave an implementer guessing.
2. **Snapshot and graph correctness:** whether working-tree, staged-index, and
   committed-range modes can share semantics while proving that each mode reads
   only its declared immutable snapshot and follows affected dependents.
3. **Semantic trust and confidentiality:** whether `unknown`, stale evidence,
   judge unavailability, cache identity, outbound minimization, and the privacy
   canary fail closed without giving model confidence promotion authority.
4. **Integration and falsifiability:** whether agent, `prek`, and CI consumers
   truly invoke one implementation and whether the proposed fixtures and
   semantic mutations can prove the important gates turn red.

P0 project-contract review is skipped because this repository declares no
project-specific P0 contract. Goal-file coverage and frozen-root angles are
skipped because this design has no goal file; the owner request and the three
design heads are the review authority.

## Open questions for implementation

- None blocking after C3 defense. Implementation follows the reviewed root-owned
  project, registry, snapshot, adapter, and report contracts.

## C3 - Independent review and defense

The independent reviewer returned `NEEDS-FIX` on all four planned angles. The
direction was sound, but twelve findings exposed load-bearing ambiguity. All
were accepted as P1 because an implementer would otherwise invent behavior at a
correctness or confidentiality boundary:

| Finding | Defender verdict | Rank | Correction |
| --- | --- | --- | --- |
| Practice-transfer lifecycle was a second concern | Accept | P1 | Removed transfer workflow ownership; retained only verifier outbound-data enforcement. |
| Packaging, registry/rules, and adapter were TBD | Accept | P1 | Defined a root-owned Python `uv` project, console entry point, restricted YAML rules, and adapter boundary. |
| `flow-supervise` was a consumer outside scope | Accept | P1 | Added it to the declared skill surface. |
| A candidate-only graph loses deletion and rename dependents | Accept | P1 | Defined changed roots and reverse closure over the union of baseline and candidate graphs. |
| Snapshot modes lacked capture identity and tree semantics | Accept | P1 | Added the three-mode table, canonical snapshot identity, deletion handling, and mutable-read blocking. |
| Snapshot verification omitted destructive graph changes | Accept | P1 | Added deletion, rename, retarget, and baseline-only reverse-edge witnesses. |
| One document hash could reuse stale semantic evidence | Accept | P1 | Keyed reuse by the canonical complete evidence, question, adapter, judge, rule, rubric, and policy request. |
| Judge unavailability had two outcomes | Accept | P1 | Reserved `BLOCKED` for unavailable prerequisites and `NEEDS-REVIEW` for available but unresolved judgments. |
| Per-entry confidentiality contradicted the real manifest | Accept | P1 | Matched the manifest-level boundary and made outbound filtering deny by default across requests and persistence surfaces. |
| Consumer integration had no executable/report/exit contract | Accept | P1 | Defined the root entrypoint, report schema, exit codes, profiles, and literal invocations. |
| Verification lacked commands and evidence locations | Accept | P1 | Replaced the proof-only table with executable, prerequisite, evidence, and failure-witness mappings. |
| Byte-equivalent reports contradicted mode provenance | Accept | P1 | Compare normalized facts, traces, and verdicts while preserving raw provenance. |

**Simplicity delta.** Removed the second practice-transfer workflow and the
requirement that a new draft obtain semantic attestation. Retained one root
executable, three snapshot providers behind one capture contract, one restricted
rule format, one semantic interface with production and scripted adapters, and
one report schema because each is required by a named consumer or failure
witness. No new skill owner or generalized source practice is adopted by this
design.

That last sentence described the first revision only. C4 and the rematch
revision supersede it: the owner explicitly requested practice transfer, and
the current design maps every generalized candidate to its target owner.

## C4 - Owner additions and rematch preparation

The owner additions changed the implementation choice after the first defense.
The revised design now names a TypeScript package with
`deepclause-sdk@0.0.89`, one batched DML `judge/2` call, and ordered Prolog
clauses. It uses explicit `supported`, `refuted`, and `unknown` choices because
the current DeepClause JEV `verify` adapter resolves the midpoint to yes or no.
Probabilities may order unresolved review work but cannot produce acceptance.

The reference article supports explicit state, typed questions, one batch, and
deterministic routing. It does not establish a probabilistic inference system,
so the design rejects probability multiplication and model-controlled `PASS`.
The official DeepClause references and the local `jev-prompts` client establish
the executable contracts. A live parity check will use the external credential
without persisting its path or value.

The revision also specifies AST section identity, recursive rubric references,
restricted rubric-to-DML compilation, changed-section call selection, detailed
diagnostics, project configuration, the literal `prek` hook, and a reusable
verification-practice skill. The goal coverage table now keeps R1-R6 and A7-A8
separate so closing evidence can be checked one row at a time.

The independent reviewer must rematch the whole revised design because these
are P1 changes to the implementation and trust boundaries.

## C5 - First rematch defense

The rematch returned seven P1 findings. All were accepted and corrected before
implementation:

| Finding | Correction |
| --- | --- |
| Practice transfer had no auditable selection | Mapped every manifest ID to its target owner and made source-manifest disposition conditional on passing target verification. |
| Adopting projects could not run the repository-local executable | Defined a root Node package and a remote `prek` hook pinned to an immutable repository revision. |
| The all-files setup claim still invoked staged mode | Added explicit `check --all`; kept `--staged` for ordinary commits. |
| Auto profile could skip semantic review while a design was draft | Required explicit promotion profile in grill and promotion gates; configured non-lifecycle kinds. |
| Rubric precedence, fragments, merging, and scoring were open | Defined all four, including duplicate rejection and the literal weighted ratio. |
| The SDK's model compiler could invent DML policy | Prohibited `DeepClauseSDK.compile`; required deterministic AST emission, structural escaping, and a runtime capability allowlist. |
| The live parity check did not pin the external client | Added an environment-supplied path, a repository-pinned client hash, prerequisites, and redacted reporting. |

The three P2 findings were also accepted. The design pins the slug library,
blocks before sending an over-budget batch, and corrects the goal backlink.
Because the corrections change packaging and rule semantics, they require one
final independent rematch.

## C6 - Second rematch defense

The next rematch found three remaining P1 gaps. All were accepted. The transfer
review now accepts 12 manifest practices that belong to document authority,
verification evidence, bounded stateful checks, public contracts, or stable
references. It rejects seven candidates whose proper owners are specialist
migration, environment, compatibility, domain-modeling, or release work. The
source manifest records `accepted_for_transfer` and `rejected`; no item is
`transferred` before its target passes verification.

The rubric contract now gives its canonical item schema and exact intersection
rules. Explicit section selection restricts evaluation. A missing critical
section is `NO-GO` only during whole-document evaluation, optional unmatched
items are skipped, and an empty explicit selection is a usage error. Evidence
limits block rather than truncate.

The remote hook now has a literal `.pre-commit-hooks.yaml` contract and uses
`--staged-input` with paths supplied by Prek. A normal run evaluates changed
index paths; `--all-files` evaluates every matching tracked index path. The
remote-hook test installs the current committed revision into a temporary
consumer and proves both a passing and failing diagnostic.

## C7 - Hook trigger correction

The final rematch found that a hook-side path regex could skip changes to shared
rubrics, policy, configuration, or skills. The correction removes hook
filtering, sets `always_run: true`, and lets `doc-verify --staged` compute the
affected closure from the complete index diff. The separate `check --all`
command remains the full setup audit. The remote-install fixture now stages its
inputs and runs the ordinary hook path instead of misusing Prek's `--all-files`
switch.

## C8 - Review gate

The independent reviewer passed the final rematch with no remaining P1. Design
02 moves from `draft` to `reviewed`. Implementation may now begin against the
current TypeScript package, rubric selection, DML authority, confidentiality,
and hook distribution contracts.

## C9 - Implementation gate

Implementation completed in one round and was self-reviewed against R1-R6 and
A7-A8. Commit `0fa6dea8fdc2138ce1bf45ff024ecf2bb9c31889` contains the root
TypeScript verifier, contracts, tests, remote Prek hook, CI workflow, shared
verification library, and the narrowed references from the owning flow and
goal skills. The design, goal, worklog, status file, and confidential source
manifest were excluded from that commit.

Fresh evidence:

- `npm test`: 8 files and 18 tests passed, including semantic mutations,
  staged-snapshot isolation, rubric redirects, section IDs, and the privacy
  canary.
- `npm run typecheck`, `npm run lint`, and `npm run check`: passed; the
  repository check covered 2 artifacts and 44 sections.
- `uvx prek validate-config .pre-commit-config.yaml` and `uvx prek
  validate-manifest .pre-commit-hooks.yaml`: passed.
- `npm pack --dry-run --json`: included the executable, compiled runtime,
  contracts, and hook manifest.
- `npm run test:remote-hook`: a temporary consumer pinned to `0fa6dea` passed
  its valid staged document and produced the asserted path, section, rule ID,
  and `NO-GO` verdict for the invalid staged document.
- The local `jev-prompts` client and the DeepClause SDK backend returned the
  same normalized typed answer against JEV `1.13.0`; the report retained the
  pinned client digest and no credential or local path.
- Forced full Design 02 promotion checks returned `PASS` with one batched
  semantic call and zero cache hits; the final run used the exact `landed`
  design text. A prior section-only check returned `NEEDS-REVIEW`, correctly
  demonstrating that a selected section cannot claim rationale supplied
  elsewhere.
- All six touched skill packages passed `quick_validate.py`.

The source transfer manifest now records 12 reviewed practices as
`transferred` and 7 as `rejected`, with the target commit recorded in the
source repository. No confidential source reference crossed into the target
commit.

The implementation gate therefore moved Design 02 from `reviewed` to
`pending-retro`.

## C10 - Retrospective (2026-09-24)

### First-principles bottom line

Re-derived from the Problem statement and frozen requirements, the minimum
machine is: one shared executable; AST-derived selectable Markdown sections;
schema-validated, recursively resolved rubrics; deterministic checks before a
single bounded typed JEV batch; ordered Prolog clauses that alone decide the
verdict; a shared practice library; and one changed-index path usable by agents,
Prek, and CI with explicit privacy, cache, and budget boundaries.

The as-built system matches that minimum architecture. The Node package and
remote-hook packaging are **constraint-justified** by the selected SDK and the
need for projects to pin an executable revision. Git snapshot capture is
constraint-justified by staged and range correctness. Cache timestamps and
`--refresh` are constraint-justified by the fresh-attestation requirement.
There is no known debt, no project-law violation, and no history-only
accretion to remove.

The heads still hold: the Problem statement remains the observed inability to
run one affordable document contract across agent, hook, and CI paths; Scope
did not expand beyond the verifier, its consumers, and generalized skill
transfer; and the Rationale survived live execution because model answers
became bounded facts while deterministic clauses retained verdict authority.
The rejected alternatives remain rejected for their recorded reasons.

### Evidence and rework

The section-only live trial exposed an implementation defect: a cache entry had
content identity but no wall-clock freshness limit. The implementation added
`createdAt`, `attestation_max_age_seconds`, and `--refresh`, then reran the full
uncached promotion check. This was not a design mismatch; the reviewed design
already required fresh semantic evidence.

The external-consumer hook, semantic mutation, confidentiality canary, local
client parity, and forced live promotion check observe the actual boundaries
claimed by the design. No correction remains.

### Design holds

Design 02 matches the first-principles minimal architecture with no pile-up.
Its problem, scope, rationale, trust boundary, and distribution contract hold.
The closing pass moves it from `pending-retro` to `landed`.

## C11 - Ordered include/exclude selectors (2026-09-26)

The owner requested that document selection support inclusion and exclusion as
an ordered list. The selector contract now treats every matching entry as a
decision and the last match as authoritative: include then exclude removes a
path, while exclude then include adds it back and selects the include entry's
metadata. Existing include-only configurations keep their behavior.

Key tracepoints:

- `selectorTrace` records every matching selector in configuration order with
  `include` or `exclude`.
- The snapshot inventory and reverse dependency graph both consume the same
  last-match decision, so an excluded working-tree document cannot re-enter
  through the glob union.
- The CLI reports the trace in verbose output and JSON, and a CLI case asserts
  the exclude-then-include trace on a real `check --paths` run.
- A second CLI case stages an excluded document and asserts it is absent from
  `affectedArtifacts` and the artifact report.

Verification executed from the repository root:

- `npm test`: 10 files / 40 tests passed, including 10 CLI cases.
- `npm run build`, `npm run typecheck`, and `npm run lint`: passed.
