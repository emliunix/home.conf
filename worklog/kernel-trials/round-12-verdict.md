# Round 12 verdict — the judge does not use where the subject sits (design/07 phase 1, 2026-10-14)

## Predicate

```sh
npm test && npx vitest run doc-verify/tests/kernel/path.test.ts doc-verify/tests/kernel/keys-roundtrip.test.ts doc-verify/tests/oracles/context.test.ts doc-verify/tests/kernel/boundary.test.ts   # 404 / 72 passed
node worklog/kernel-trials/probe/compare-arms.mjs --self-test                                       # pass
# the six oracle-test.mjs lines of round-12-preregistration.md §Predicate, run in order 05:25–05:57
node worklog/kernel-trials/probe/compare-arms.mjs round12-E-fix round12-E-real round12-E-der round12-W-fix round12-W-real round12-M   # complete (all prefixes): true
```

Run by the lead on the builder's code (an Opus seat in its own worktree; 9d0ab3d, 224c632, cedf24e),
live judge (jev-1.13.0), per-atom, cache off, two repeats, ABBA over arms per document; every
labelled cell found under every arm on every track. The M line first ran with its own
`complete: false`: its 12 subtle pages are refused structurally before any question since item 10
closed, the pre-run amendment's case. The amendment was then encoded in the fixture specs (the 12
subtle pages `draft: NO-GO`, `judged: false`, as round 8's gross control is; labels unchanged) and
the M line re-run as written: `complete: true`, exit 0, the same 12 judged units, no harm. Output:
`results/round-12-compare.txt`.

## What measured

| Track | N | A (address) | D (another row's address) | C (address + claim) |
| --- | --- | --- | --- | --- |
| E-der, wrong-row real cells (11 counted) | 0 caught | 0 caught | — | 0 caught |
| E-fix wrongrow (5) | 0 | 0 | 0 | 0 |
| E-fix no-harm (50) | — | 0 right→wrong | 0 | 0 |
| E-real no-harm (13) | — | 0 | — | 0 |
| W-fix no-harm (84) | — | **3 right→wrong** (`verification-design#row3` in three fixtures, both repeats; base rate 1) | — | — |
| W-real no-harm (52) | — | 1 (within the base rate) | — | — |
| M judged units (12) | — | 0 | — | — |

The judge saw the context: it travels inside the judged entry (`state.evidence.<key>.context`),
A's "Where:" was 106–146 bytes and C's 208–272, C fell back on no cell, and no echo fired. With the
row key `R1` and the requirement's title beside evidence that says "R2 holds", every arm read the
cell `holds`. Near-threshold (reported, not a bar): on E-fix's 3 such cells A and D lowered
P(expected) (−0.07 [−0.10, −0.04] and −0.11 [−0.16, −0.06] against N's repeat-2 null of +0.02), C
by −0.02; on E-real's one such cell C raised it by +0.14 (n = 1).

## Expectations against the run

| Expectation | Outcome |
| --- | --- |
| E-der: N ≤ 2, A 5–8, C ≥ 8 caught | **refuted: 0, 0, 0** |
| E-fix wrongrow: A 1–3, D ≤ 1, C ≥ 3 | **refuted: 0, 0, 0** |
| no harm on the evidence oracles | met |
| W, M: no harm | **refuted on W-fix** (3 right→wrong under A); met on W-real and M |
| context ≤ 300 / 400 bytes, no `max_bytes` refusal | met |

## Decision (the plan's rows, per oracle)

- `evidence_reasons`: no arm meets its wrong-row bar; nothing ships on it.
- `witness_observable_in_row`: A harms it; A does not ship on it.
- module-page oracles: no gain to ship.

So the table's last row applies: **the path relations ship for rules; `context:` stays in the
language, used by no shipped library; phases 2 and 3 are declined** (decision rows). The judge,
told only to judge the subject, does not use an address or a claim it is shown; round 9 found the
same for a property shown in the evidence. A relevance check would need a question that asks for the
comparison, which round 9 measured without success; it stays the accepted gap of gate-ledger item 11.

Shipped from the build, measured green: `core.header_pos/4`, `core.cell_text/4`, `core.path/4`,
`core.cell_path/5`, `core.section_keyed/3`; the `context:` field with its renderer, outbound scan,
byte share and cache keys; the echo rule; the kernel/host key quoting made identical (Unicode, tab).

## What changes after the verdict

1. design/07: phase 1 recorded as decided (relations for rules, `context:` unused), phases 2 and 3
   declined, Status `landed`.
2. Decision rows; gate-ledger row; the builder's interpretations (pre-run amendment) accepted.
3. The builder's coherence proposals, decided by the lead under the owner's rule (coherence over
   compatibility, home.conf migrated): `core.header/3` is removed in favour of
   `core.header_pos/4` (the same fact plus a position); `core.cell/3` stays (the non-empty test the
   language has no other way to write); `core.cells` and `core.row_with_column` stay as evidence
   forms, because moving the Property cell into `context:` is what harmed W-fix here.

## Left unmeasured

A question that tells the judge to use the context; the requirement's body as the claim; batched
rendering; judge models other than jev-1.13.0.

## Records

`round-12-preregistration.md` (plan, review, amendment), `results/round-12-review.md`,
`results/round-12-compare.txt`, the `.leaves-round12-*` and `.question-count-round12-*` sidecars under
`probe/oracle-fixtures/`, `probe/compare-arms.mjs`, `probe/oracle-test.mjs` (`--variants`),
`probe/oracle-fixtures/*/variants*`, `probe/oracle-fixtures/real-cells/deranged-r12.yaml` and
`real-cells/deranged/`, `doc-verify/tests/kernel/{path,keys-roundtrip}.test.ts`,
`doc-verify/tests/oracles/context.test.ts`, `decisions.md`, `gate-ledger.md`.
