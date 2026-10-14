# Verification of `dv/kernel-adopt`: the WFS kernel alone, on `main`

This branch answers the adoption review of `dv/trusted-kernel-trials`
(`reviews/2026-10-14-trusted-kernel-trials.md` on branch `cursor/trusted-kernel-review-5419`, PR #10).
It follows that review's option 3: the evaluator lands by itself, and the judge-policy changes and
the trial archive are left for separate decisions.

## What the branch is

The branch is `main` at `d91d92a` plus three commits. Together they make the well-founded-semantics
kernel (`doc-verify/src/kernel/`, SWI-Prolog under `swipl-wasm` 8.2.2) the only evaluator:

- `runProgram` runs a fresh sandboxed instance for each evaluation, under the inference budget.
- A budget or resource overrun is `BLOCKED`.
- `evaluate.ts` is deleted.
- The checker refuses the three forms the translator cannot give a meaning:
  - a negation sharing an unbound variable with another literal;
  - an oracle negation with an unbound argument;
  - a goal that uses a forall count's result.
- It brings the kernel's conformance, boundary, regression and proof tests; the slow property,
  seed and clingo suite (nightly in CI); and the model and constitution the kernel implements.

Left out, as the review recommends:
- the per-atom default (the `request_shape` fallback stays `batched`);
- table facts and the table evidence forms;
- section-reference checks and the dated-prose extension;
- `goal-evidence-reasons` and `design-witness-observable`;
- the commit hook's profile;
- the spine relations and `context:`;
- `worklog/kernel-trials/`.

A grep for each left-out feature over `doc-verify/` and `.github/` finds nothing. `lib/`, `modules/`,
`facts.ts`, `module.ts`, `compose.ts` and both hook configs are unchanged from `main`.

## Review findings, addressed

| Finding | Here |
| --- | --- |
| B1 mutation anchor | `oracles.ts` is `main`'s; `if (alone > limit)` occurs once. `evidence-budget.mutations.mjs` 4/4 red (M3 red); `npm run test:mutations`: 5/5 runners exit 0 |
| S1 1,700 programs | corrected on the trials branch (7dbec93): round 2's kernel run was 200 programs; the 1,500 brute-force programs checked the reference |
| S2 per-atom default | not in this branch; fallback `batched` (`module.ts`) |
| S3 sandbox off in tests | witness and corpus tests load with `{ sandbox: true }` |
| S4 no transcripts | this file (below) |
| S5 accepted gaps | see "Known and accepted" |
| N1 comment | `module.ts` is `main`'s; its comments say batched |
| N5 core.pl header | names `translate.ts` |

## Transcripts (2026-10-15, macOS, Node v26.10.0, judge `jev-1.13.0`)

| Command | Result |
| --- | --- |
| `npm run lint` | exit 0, gate armed |
| `npm run typecheck` | exit 0 |
| `npm test` | 37 files, 359 passed |
| `npm run test:mutations` | 5/5 runners exited 0 (evidence-budget 4/4, references 9/9, canonical-checkout 12/12, lock 12/12, resolve-write-target 7/7) |
| `npm run test:kernel-slow` | property pass (1,500 programs, refuting 0); seeds pass (refuting 0); clingo pass (500 programs, S3 pass); complete: true; 1006 s |
| `check --all --profile draft` | `main` PASS, branch PASS, 24 documents |
| `check --all --profile promotion` (shared cache: `main` first, then branch) | `main` PASS with 24 judge calls; branch PASS with 0 calls, every answer it needed already cached |
| per-document comparison of the two runs (verdict and every finding's rule, verdict and line) | **0 documents differ** at draft and at promotion |
| `check --all --profile promotion --no-cache` on the branch | PASS, 24 documents, 24 live judge calls |

On this repository's documents, then, swapping the evaluator changes no verdict and no finding.
Where the kernel's model does differ from the old evaluator (prefix demand, the three refusals),
these documents don't exercise the difference. Round 2's witnesses do, and they are tests here.

## Changed test expectations (the model, not the documents)

- `evaluate.test.ts` "rounds": requests `[6,2]` become `[2,2]`, and `diagnostics.test.ts`:
  "oracle questions 8" becomes 4. Both are prefix demand (round 2 witnesses `d2-minimal`,
  `pass-is-final`, `missing-literal`: the old evaluator over-demanded).
- `language.test.ts`: the unsafe-negation case uses a variable shared with another literal, since
  one local to the negation is now lifted into a helper. New tests refuse shared unsafe negation
  and a goal using a forall count's result.

## Known and accepted (carried into the merge note)

- **Gate-ledger item 8, accepted as a cost:** a binding resting on a loop is demanded once before
  it is called unfounded, so one judge question is wasted. Statuses and verdicts are the
  well-founded model's.
- **Gate-ledger item 9:** a history-dependent error on a *reused* instance. Production never
  reuses one; the slow suite reports it and doesn't fail on it.
- **Items 5 and 6 (clingo D1, generator hole):** the differential subject only, not the evaluator.
- **Item 11 (a witness on the wrong row):** does not apply here, because this branch doesn't add
  `design-witness-observable`.
- **Startup cost:** a fresh `swipl-wasm` instance for each evaluation, one evaluation per oracle
  round, about 40 ms each. A draft `check --all` took 2.8 s here, against 1.5 s on `main`.

## Not in this change, decided separately

The per-atom default; the goal-evidence and design-witness promotion checks; section-reference
and dated-prose checks; the hook profile; the spine relations; the trial archive. The trial
records stay on `dv/trusted-kernel-trials`, which code comments here cite by branch name.
