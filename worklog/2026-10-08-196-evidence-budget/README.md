# #196 — the v2 evidence budgets, recalibrated against the v2 evidence SHAPE

Owner ruling (`#comp-agent-substrate-2:e833320b`): **"both sides, co-evolve."** An over-cap subtree is
not only a cap defect — it is *also* a signal that the document is too verbose or carries what should
be code. This object is the ENGINE/CONFIG side; the owning document's shape is the other side.

## The defect, and the number that shows it

The v2 migration moved a `combined` item's evidence from v1's **own prose** to the **full section
subtree**, and the caps came across unchanged. Measured at the pin the card names (`f48fb18`):
`rubric.ts:makeQuestion` maps over the **matched** sections and takes `own.get(id)?.text` —
`withDescendants` is **absent** at that rev (`grep -c` → 0), so v1 never saw a descendant's body.

For `module.fold-in-or-named-absence` on `docs/modules/runtime/README.md`:

| | bytes | what it is |
| --- | ---: | --- |
| v1 own-text judged | **2,956** | the `## Decisions` PREAMBLE, before the first `###` |
| v2 full subtree | **18,562** | the preamble + all 5 decision entries |

⚠ **The inherited 16,000 cap blocked a document whose decision ENTRIES v1 never judged at all.** And
18 of the preamble's 42 non-blank lines are citation bookkeeping (`H1`/`H2`/`H3` spelling,
`check-h2`) — so v1's number was derived from a text that excludes the very content the rule's `ask`
is about: *"does the Decisions section record the choices that shaped the shipped system."*

## The recalibration

`.doc-verify/modules/{design,design-guide,module}.yaml`: **all 10 oracle caps → `32,000`**, uniformly.
`policy.max_evidence_bytes` is **unchanged** (48,000 in the consumer config).

The value is not arbitrary. `deepclause-sdk/dist/judge/jev.js:21` sets `stateTokenBudget: 32_000`, and
`oracles.ts:306` compares the rendered state against `min(policy.max_evidence_bytes, stateTokenBudget)`
— **against bytes, despite the field name**. So 32,000 is the judge's own ceiling, and a cap above it
would let a section clear the item cap and still BLOCK under a message naming the judge rather than
the corpus. Row 4 of the case exists to keep that boundary recorded.

## What is in this object

- `doc-verify/tests/language/evidence-budget.test.ts` — 4 rows: under-cap judges, over-cap BLOCKs
  naming `max_bytes`, the **old-16,000 removal-red**, and the judge-ceiling boundary.
- `doc-verify/tests/language/evidence-budget.mutations.mjs` — the committed runner, 4/4 RED, each row
  required to redden **the case its row names** (the #216 lesson).
- `doc-verify/tests/language/evidence-budget.mutations.md` — the table, describing a runner that is
  in the tree.

⚠ **`runProgram` CATCHES `BlockedError`** (`index.ts:80-86`) and reports `verdict: "BLOCKED"` with
`failure.message`. My first draft awaited a throw, read `blocked: undefined` on a genuinely blocked
run, and would have passed only if the engine had changed. The assertions read the REPORT — which is
what a consumer reads.

## Measured

```
npx vitest run --reporter=basic          → 25 files, 213 tests, ALL PASS
npx tsc -p doc-verify/tsconfig.json      → 0
node doc-verify/tests/language/evidence-budget.mutations.mjs → 4/4 RED
```

⚠ **A FOCUSED RUN IS NOT EVIDENCE ABOUT THE SUITE, and this repeated #216's shape.** The first full
run showed 23 failures and the focused runs showed none. The cause was neither my file nor the code:
the `subprocess` project spawns `node doc-verify/dist/cli.js` and `dist/` **did not exist** in the
fresh worktree. `npm run build` first, and the tier returned 23/23. A fresh worktree is not an
environment.

## Residual, stated

- The consumer-level gate case lives in `agent-substrate` (`scripts/__gate-cases__/evidence-budget.test.mjs`),
  because that is where the governed documents are. It builds the engine from the **pinned** rev.
- `design/122` is **resolved**: #197 landed (`43aff5d3`) and the `/Users/` path is gone. It is not a
  #196 result in either direction.
