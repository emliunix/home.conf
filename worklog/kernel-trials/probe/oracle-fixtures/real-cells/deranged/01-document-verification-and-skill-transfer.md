# Document verification and skill transfer - CLOSED-GREEN (2026-09-24)

## Goal

The owner identified the source repository, preservation boundary, and desired
working mode:

> then keep design and worklog un commited,  and that project is ~/Documents/task-svc, find that file and work on the design (arm as a goal to work on it)

The owner then specified the capabilities that must compose into the result:

> So I think we need:
>
> * fold lessons into the skills, the refined rules, the library pattern
> * actively use jev-prompts (nemem)
> * and prob prolog based jev calling
> * and tools to segment markdown to segments for finer grained evaluation.
> * and the cli be able to specify which section of the markdown, and what rubric yaml (w/ redirection following)
> * the practice how to use prek to print detailed diagnostics with per project setup jev based check flow (for changed files only to save cost)
>
> ref: https://deepclause.substack.com/p/jev-prolog-pi-and-the-dream-of-probabilistic?utm_campaign=post&utm_medium=web

The article is reference material for evaluating the requested JEV/Prolog
shape. It does not override the owner's requirements or become project law by
itself.

## User requirements (frozen root)

frozen from: direct owner requirements on 2026-09-24

### R1 - Preserve the source boundary and work as a goal

> then keep design and worklog un commited,  and that project is ~/Documents/task-svc, find that file and work on the design (arm as a goal to work on it)

The design and worklog stay uncommitted while this goal runs. The source-side
practice manifest remains in `task-svc`; only reviewed generalized lessons may
be folded into shared skills.

### R2 - Fold the learned practices into shared skills

> * fold lessons into the skills, the refined rules, the library pattern

The result must adopt selected general practices in their correct skill owners
and provide a reusable verification-practice library rather than duplicate the
same rule across flow skills.

### R3 - Use the existing JEV work and a Prolog-style evaluation model

> * actively use jev-prompts (nemem)
> * and prob prolog based jev calling

Existing local JEV experiments and relevant Nowledge memory are evidence for
the adapter and prompt contract. The evaluator must define how bounded JEV
facts participate in explainable Prolog-style rules without allowing model
confidence to become acceptance authority.

### R4 - Evaluate Markdown at section granularity

> * and tools to segment markdown to segments for finer grained evaluation.
> * and the cli be able to specify which section of the markdown, and what rubric yaml (w/ redirection following)

The CLI must expose stable section selection and explicit rubric selection. Its
rubric resolver follows declared references while detecting missing targets and
cycles.

### R5 - Make changed-file verification practical through prek

> * the practice how to use prek to print detailed diagnostics with per project setup jev based check flow (for changed files only to save cost)

Projects must be able to configure the verifier once, run it through `prek` on
the staged changed-file closure, and receive actionable per-document and
per-section diagnostics while avoiding unrelated semantic calls.

### R6 - Evaluate the supplied reference without making it authority

> ref: https://deepclause.substack.com/p/jev-prolog-pi-and-the-dream-of-probabilistic?utm_campaign=post&utm_medium=web

The design records what is adopted or rejected from the referenced article and
grounds implementation claims in the actual JEV API and local experiments.

## Additions to the root

### A7 - Complete the goal

> arm a goal to complete it

The active execution goal is to carry Design 02 through review, implementation,
fresh verification, and its closing retrospective rather than stop at a revised
draft.

### A8 - JEV test credential

> and check notes vault (nmem) if you need the key to call and test

A real JEV call is authorized when it provides required evidence. The
credential remains in the notes vault and is loaded by reference; its value is
never copied into this repository, chat, logs, or test artifacts.

## Design files

- `design/02-programmatic-document-contract-verification.md` - covers R1-R6, A7-A8 - admin source: this goal file

## Dependencies

**Scope analysis**

- `design/02-programmatic-document-contract-verification.md` - repository tooling and shared skills

**Edges**

- None; this is one current design.

## Workstreams

- **Document verification and skill transfer** - `design/02` - `landed` - covers R1-R6, A7-A8

One workstream and no generative dependency make a phase spine or parallel
partition unnecessary.

## Workflows

### design/02-programmatic-document-contract-verification.md - landed

- **Admin source:** `goals/01-document-verification-and-skill-transfer.md`
- **Covers:** R1-R6, A7-A8
- **Scope:** repository tooling and shared skills
- **Depends on:** none
- **Loop:** `flow-grill-review` -> `flow:impl` (`flow-common`) -> `flow-retro`
- **Gate:** each R1-R6 and A7-A8 row has fresh evidence; passing incidental tests is not closure
- **Exit:** implementation mismatch routes to `flow-common` breakout adjudication; a proved wrong machine supersedes the design

## AC coverage

| Row | Covering design(s) | Phase | Locks when |
| --- | --- | --- | --- |
| R1 | design/02 | single workstream | design/02 lands with source boundary intact |
| R2 | design/02 | single workstream | shared verification skill and flow references land |
| R3 | design/02 | single workstream | DeepClause/JEV rule path and parity evidence land |
| R4 | design/02 | single workstream | section and rubric resolver tests pass |
| R5 | design/02 | single workstream | changed-only `prek` check and diagnostics pass |
| R6 | design/02 | single workstream | design records adopted and rejected article claims |
| A7 | design/02 | single workstream | review, implementation, verification, and retro complete |
| A8 | design/02 | single workstream | live test uses the external credential without disclosure |

## Rulings in force

- 2026-09-24 - Markdown remains authoritative; verifier output is evidence, not lifecycle authority -> `design/02-programmatic-document-contract-verification.md` §Authority model
- 2026-09-24 - Source provenance remains in the confidential source repository -> `design/02-programmatic-document-contract-verification.md` §Attestation and confidentiality

## Review outcome

PASS. Three rematches closed the first grill's contract gaps and the later
packaging, rubric, transfer, and hook-trigger findings. No P1 remains.

## Open threads

None. The implementation, fresh verification, source-manifest disposition, and
closing retrospective are complete.

## Acceptance evidence

| Row | Evidence |
| --- | --- |
| R1 | `skills/verification/SKILL.md` and `skills/verification/references/practices.md` exist and are referenced from `flow-common`, `flow-grill-review`, `flow-retro`, `flow-supervise` and `goal-file`; design/02 §Shared verification practices tables the twelve transferred manifest ids with their owning skill and names the seven rejected ones with the reason. The shared skill and the transfer R2 asks for are therefore in place. |
| R2 | `worklog/02-programmatic-document-contract-verification.md` §C9 records the local client and the SDK returning the same normalized typed answer against JEV `1.13.0`, and the forced full promotion check of design/02 passing through deterministic ordered clauses. The rule path is the SDK's and its parity is evidenced, which is what R3 requires. |
| R3 | `npm test` passes the resolver suites: sections in `doc-verify/tests/report/segments.test.ts`, rubric chains with the recursive-cycle and oracle-in-cycle refusals in `doc-verify/tests/language/language.test.ts`, and selection in `doc-verify/tests/selection/companion.test.ts` (260 tests green on 2026-10-13). Those are the section and rubric resolver tests R4 names, so R4 holds. |
| R4 | `doc-verify/tests/remote-hook.sh` drives the pinned remote Prek consumer over a valid staged document and an invalid one; the valid one passed and the invalid one produced the detailed `NO-GO` diagnostics the hook prints. The changed-only check and its diagnostics therefore work from a consumer, which is what R5 asks. |
| R5 | design/02 §Shared verification practices lists each adopted article claim with the skill that now owns it and the seven rejected claims with why, and its verification section runs the built SDK path (`doc-verify/tests/oracles/`) rather than quoting the article. The adopted claims are therefore recorded and executable, as R6 asks. |
| R6 | `worklog/02-programmatic-document-contract-verification.md` records the grill with its three rematches, §C9 the implementation gate and full verification, and §C10 the retrospective dated 2026-09-24; design/02 §Status reads `landed`. Every stage A7 names has a dated record, so A7 is complete. |
| A7 | Live calls loaded the external credential by reference; no credential value or path entered the commit or reports. |
| A8 | `git show --stat 0fa6dea` lists 41 files, all verifier implementation; design/02, this goal, `worklog/02-programmatic-document-contract-verification.md` and the source manifest are not among them, so the source boundary R1 asks for held at the landing commit and provenance stays in its owning repository. |

## Worklog

`worklog/02-programmatic-document-contract-verification.md`
