# Round 8 verdict — the module-page oracles' request shape (2026-10-13)

## Predicate

```sh
node worklog/kernel-trials/probe/oracle-test.mjs --fixtures --oracle current_not_history --request-shape both --repeat 2 --no-spans --ledger round8-pages  --cap 240   # complete: true, 160 of 240
node worklog/kernel-trials/probe/oracle-test.mjs --fixtures --oracle pairs_every_property --request-shape both --repeat 2 --no-spans --ledger round8-pairs  --cap 24    # complete: true, 16 of 24
node worklog/kernel-trials/probe/oracle-test.mjs --fixtures --oracle properties_are_claims --request-shape both --repeat 2 --no-spans --ledger round8-claims --cap 24   # complete: true, 16 of 24
node worklog/kernel-trials/probe/oracle-test.mjs --real-cells --labels module-pages.yaml --request-shape both --repeat 2 --no-spans --ledger round8-real --cap 222      # complete: true, 148 of 222; 29/29 labels found under both shapes
node worklog/kernel-trials/probe/compare-shapes.mjs --self-test && node worklog/kernel-trials/probe/compare-shapes.mjs round8-pages round8-pairs round8-claims round8-real   # pass; complete (all prefixes): true
```

Run by the lead: pages and pairs 09:38–09:50; claims and real 10:57–10:59 after their first
attempt returned BLOCKED on every document with no question sent (0 of 222 spent), which a
re-run under the same command did not reproduce; the runner now prints the BLOCKED reason on
its problem lines so a repeat of that outage is named. Live judge, ABBA per fixture, cache off,
two repeats, 340 questions. The build (an Opus subagent, after the Cursor seat's provider
failed) was reviewed by the `reviewer` seat (7 findings, none blocking; its two should-fix
items landed before the run: the comparer refuses mixed live/mock sidecars and defines the
near-threshold stratum from the first batched repeat, as the plan says). The lead's 29 blind
labels were written before any call; their section ids were renamed to the engine's slugs after
the builder's mock run found all 29 under the wrong form (no label changed).

## What measured

**Seeded pages (12 regex-clean history edits over four kinds, 2 or 1 sections per page).**
Only one edited section reads `fails` under either shape: `module_model/subtle-1` under
batched (the title section at 0.60, NO-GO); per-atom reads it `holds` at 0.74. Every other
subtle page PASSes under both shapes: 11 of 12 edited units read `holds`, at 0.62–0.98. The
near-margin `good-near` pages hold under both (the properties kind reads `unknown` at 0.50
batched, `holds` at 0.73 per-atom). Correctness against the expected labels on 28 labelled
units: both right 11, batched right / per-atom wrong 1, the reverse 1, both wrong 15; exact
McNemar p = 1.0. The gross pages are refused structurally under both shapes (draft NO-GO, no
question asked), as pre-registered.

**Signed shift of P(expected), per-atom minus batched** (pages, 38 units): all −0.068
[−0.102, −0.035]; near-threshold stratum (5 units) −0.209 [−0.339, 0.000]; single-oracle batches
−0.094, mixed-oracle batches −0.044; noise floors ±0.006 and ±0.009. Per-atom lowers
P(expected) on these pages, beyond the ±0.05 band, without changing a label.

**Real pages (16 pages, 29 atoms, the lead's blind labels all `holds`).** Agreement 29/29
under both shapes; no confident flip; shapes disagree on 0 of 37 cells. The one atom round 6
flagged, `docs/modules/oracles/model.md` §concepts, reads batched 0.75/0.78 and per-atom
`holds` 0.51 then `unknown` 0.52 across the repeats: the only repeat flip, total variation
0.29; `scout`'s independent label was `holds` at 0.96. The fork resolves as the plan wrote it:
the label is `holds`, per-atom demotes, one per-atom error counted against `module-model`'s
pin removal (k = 1, below the k ≥ 3 rule). Shift on real pages: all −0.016 [−0.037, 0.002];
near-threshold (4) −0.080 [−0.256, 0.079]; floors ±0.001.

**One-section oracles (smoke).** `pairs_every_property` and `properties_are_claims`: 2 of 2
fixture units right under both shapes, the seeded pages caught; too few cells to decide
anything, as the plan said.

**Cost.** Per-atom asks 2× the requests on the pages (80 against 40 per run) and 2.3× on the
real pages (37 against 16), inside the plan's 1–4×.

## Expectations against the run

| Expectation | Outcome |
| --- | --- |
| subtle fixtures, batched ≥ 10 of 12 edited sections `fails` | **refuted: 1 of 12** |
| subtle fixtures, per-atom the same ± 1 | **refuted: 0 of 12** (the one batched catch is lost at 0.74 `holds`) |
| good and good-near hold under both | met (one `unknown` at 0.50 batched on properties/good-near) |
| gross controls NO-GO at draft | met (4 of 4, structural) |
| real pages agreement within one atom, ≥ 80% | met: 29/29 under both |
| `concepts` per-atom `unknown`/`fails` at 0.45–0.55, batched `holds` | met: 0.51 `holds` then 0.52 `unknown`; batched 0.75–0.78 |
| stratum shift within ±0.05 of the floor | **refuted on the pages**: −0.07 overall, −0.21 near threshold; real pages within the band |
| cost 1–4× | met (2–2.3×) |

## Decision (the per-library rule, applied)

No library has a one-sided case. Labels are equal under the two shapes on every real page and
on 26 of 28 seeded units, with one discordant unit each way (k = 1 against each shape, below
the k ≥ 3 rule), and the signed shift refutes the "within ±0.05" expectation against per-atom
on the seeded pages. That is the rule's **mixed** branch: **every `module-*` pin stays
`batched`**, with the measured reason written into each library's comment (this round, the
shift and the one near-threshold atom). Round 6's per-atom default on the other modules is
untouched.

**The finding that matters is not the shape.** The `current_not_history` question misses
regex-clean history under both shapes: a sentence that says what a thing *used to be* or *was
originally*, in a page that otherwise states current law, reads `holds` at 0.6–0.98. The
hook's dated-prose regex catches dated and numbered history; the judge catches neither the
subtle form nor the margin. This is a question finding (round 4c's shape: the ask does not name
what it is to reject), recorded as a new gate-ledger item for a question round on this oracle
(a per-sentence or per-paragraph ask, or an explicit "any statement of a former value or
order" clause), with the twelve subtle pages as its fixtures. Until then the module-page
libraries' history check is the regex plus a judge that passes subtle history, and the
calibration note says so.

## What changes after the verdict

1. The four `module-*` libraries: the pin comment cites this round (this commit); no shape
   change.
2. Gate-ledger: a round 8 row; item 10 opened for the question finding.
3. The runner's round 8 extension (per-section leaves, section-keyed matching, per-document
   rules, BLOCKED reasons on problem lines) and the comparer's hardening land as the programme's
   tooling (this commit).

## Left unmeasured

Judge variation; the one-section oracles beyond a smoke test; whether a per-sentence ask
catches the subtle edits (the question round); the shift's cause (the per-atom request carries
one section's body without the page's other sections, which the batched request shows beside
it; round 6 found the opposite sign on table cells, where the batch hurt).

## Records

`round-8-preregistration.md` (plan, review), `results/round-8-review.md` (plan review),
`results/round-8-{pages,pairs,claims,real,compare}.txt`, `probe/oracle-fixtures/module_*_pages/`
(the fixtures), `probe/oracle-fixtures/real-cells/module-pages.yaml` (the labels), `probe/
oracle-test.mjs` and `probe/compare-shapes.mjs` (the tooling), `decisions.md`, `gate-ledger.md`.
