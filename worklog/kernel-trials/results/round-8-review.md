# Round 8 plan: independent review (verbatim)

The independent seat (a sonnet subagent) read `round-8-preregistration.md` as first written on
2026-10-13, round 6's plan, verdict and review, the four module-* libraries and their example
pairs, the demoted module page and the fixture runner. It ran nothing and edited nothing. Its
review follows unedited; the plan's `## Review` section records how each finding was taken.

---

# Round 8 plan: independent review

I read the plan, round 6's preregistration, verdict and review, the four module-* libraries, the four example pairs and their diffs, `oracles/model.md` §Concepts, `oracle-test.mjs` (`runFixtures`, `runRealCells`, `applyShape`, `findLeaf`), and `checker.ts`. I ran nothing and edited nothing. Findings are ordered by how much each one threatens the decision. 1–3 and 10 block the run.

## 1. The seeded defects are all caught by a deterministic pre-check, so the fixture track cannot discriminate

**What is wrong.**
- `checker.ts` L190–203: for any `artifact_kind` starting with `module-`, a no-judge pre-check emits a `structure.dated-prose` NO-GO on `/\b20\d\d-\d\d-\d\d\b/`, `/\bround\s+\d+\b/i`, `/we tried/i` and `/then changed/i`.
- All four `-bad.md` edits use exactly those strings ("Round 5 (2026-10-01): we tried … then changed", "round 3 (2026-09-20)", "### Note (2026-10-01)").
- The library comment says as much: the judge's `current_not_history` "covers the subtle cases".
- The runner's draft step then prints `structure already catches it -- fixture defect` for every bad fixture.
- Such an edit is gross, so both shapes will put it at p≈0.95+. Round 6's effect lived in the near-threshold cells, and these fixtures have none.
- The plan lists "subtle history" under "Left unmeasured", so the only defect class the judge exists for goes unmeasured.

**Why it matters.** "8/8 pages right, medium confidence" is nearly guaranteed. A pass says nothing about whether per-atom keeps the `current_not_history` discrimination the pin protects. The refuting cells cannot fire on this evidence.

**Amendment.**
- Re-author the bad pages so they evade the regex:
  - "Placement previously returned the ledger row; callers moved to the id after the double-count."
  - "As of v2 the order is a map; it used to be a list."
  - "Originally idempotent only within a session."
- Reuse the 2026-10 style for one deliberately gross control per kind, and expect `draft` NO-GO "caught" for that control only.
- Add a good page that is regex-clean but near the margin, such as a Concepts-style sentence that narrates a rule.
- Fixtures are cheap (finding 9), so five or more seeded edits per kind is affordable.
- Pre-register the draft status of each fixture: PASS for subtle and good, NO-GO for the gross control.

## 2. The runner cannot express these fixtures, and the plan understates the extension

**What is wrong.** `fixtures.yaml` today assumes a single governed `document` and a per-row atom: `atom.sections`, `atom.rows`, `per_row`, `expect_cells` keyed by `rowN`.
- `findLeaf` requires exactly 1 hit (non per-row) or `atom.rows` hits whose `leaf.sections` equals `atom.sections`.
- Module pages have 2–3 sections each (title plus children), and each section is its own atom `current_not_history(D, S)` with `sections=[S]`. Expected labels have to be keyed per section.
- `loadFixtureSets` filters by `--oracle`, so `--oracle current_not_history` selects the contract, model, properties and verification sets together under one ledger.
- Each set is one rule (one `artifact_kind`, one library) and one document path, so four sets are needed. Evidence is `editIntegrity`-checked through `edit {from,to}` against `good.md`, which the bad pages (whole-paragraph rewrites) must supply.
- The plan says only "the builder extends the runner if the rule is not expressible". It is not.

**Amendment.** Specify the extension in the plan before the run:
- A `per_section: true` atom mode with `expect_sections: {<section-id>: label}`.
- A section-keyed `rowOf`.
- Per-kind sets named `module_contract_pages` and so on, each with `oracle: current_not_history` and a distinct ledger.
- `pairs_every_property` and `properties_are_claims` as their own sets or ledgers.
- `edit.from/to` blocks.
- Fixture document paths under the module pattern (for example `docs/modules/_fixtures/<name>/contract.md`) that the rule's `pattern` matches.
- A dry mock run that proves the right leaf counts per page.

## 3. Expected labels on ancestor sections are unspecified; `core.body` is the heading plus its whole subtree

**What is wrong.**
- `facts.ts` L766: `core.body(D, S)` covers the heading and the whole subtree. The title section of every example page therefore contains the edit.
- "The bad page's targeted atom fails, the rest holds" is ill-defined. contract-bad's title and "Public surface" both carry the history. properties-bad's title (which now contains `### Note`) and the Note section both do. verification-bad is the same.
- Read literally, the plan's "list every touched section" would mark the title `holds` and a correct `fails` as a miss.

**Amendment.** Pre-register the rule "an atom's expected label is `fails` iff its body contains the edit". Tabulate per fixture: section id, expected label and why. The bad pages then have no `holds` atoms of their own, so the 2×2 for them is effectively fails-only. Say so, and rely on the good pages for the `holds` side.

## 4. The two section-level oracles cannot be seeded or judged as the plan implies

**What is wrong.**
- `pairs_every_property` judges one section in isolation. verification-bad removes the P-widget-02 row and cuts the limit text, but the page never names P-widget-02 elsewhere. Only the history clause of the ask is visible to the judge. The pairing defect is invisible to this oracle by construction, because the property list lives on the sibling properties page.
- `properties_are_claims` has an unseeded clause too: "prose that cannot be witnessed". The properties-bad diff trims a statement and adds history; no unfalsifiable property is seeded.
- The real track gives each oracle 4 atoms, one per title-only page. Round 6's rule (McNemar, stratum shift) has no power at n=4. A pass there is anecdote.
- `request_shape` is per library. module-properties and module-verification carry both oracles, so the pin on those two libraries cannot be decided by `current_not_history`'s 25-or-so atoms alone, and not by 4-atom oracles either.

**Amendment.**
- Seed one defect per clause: a property id mentioned in the page's own prose with no check or limit, and an unfalsifiable "property" row.
- Declare `pairs_every_property` and `properties_are_claims` descriptive only. At n≈4 real plus a handful of fixtures, they cannot trigger the decision rule in either direction.
- Decide the pin per library: contract and model, which carry only `current_not_history`, on the full evidence; properties and verification either hold the pin or move with the n disclosed.
- Do not claim the two oracles are "measured". Say "smoke-tested at n=…".

## 5. "At most 2 of 37" is not a measurement, and the hypothesis contradicts itself

**What is wrong.**
- The only anchor is round 6's real track. Designs: 3 reproduced confident flips on about 28 cells per shape, roughly 10%. Goals: 0 of 19.
- At 10% the expectation on 37 atoms is about 3–4, so "≤ 2" would be missed by the base rate itself. At the goals rate it is trivially met. The plan states no rate or derivation.
- Round 3 found every corpus leaf `holds` with stability 1.00, so most atoms sit at the ceiling and cannot disagree. The number that matters is how many atoms sit near the threshold. The plan neither counts them nor says how they will be found.
- "Disagree" is undefined: a label difference, a flip at p≥0.6 on both sides, or a repeat-reproduced difference.
- The hypothesis says the demoted `concepts` atom is among the ≤2. That atom is a per-atom `unknown` at 0.49 where the lead expects batched to be right. The hypothesis therefore predicts per-atom is wrong on one real atom, while also claiming "per-atom at least as accurate".
- The fourth refuting cell is listed as refuting, then labelled "informational, not a decision input". That is inconsistent.

**Amendment.**
- Define disagreement as a label difference that reproduces on both repeats of both shapes, or a confident flip (each side p≥0.6).
- Replace the count with round 6's near-threshold stratum. Define it from batched p in [0.4, 0.8] in an independent source: the round 3 corpus p values if recorded, otherwise a first mock-free batched pass. Do not select on the same run's data, which invites regression to the mean.
- Pre-register an equivalence bound on the signed shift of P(expected side) (CI inside ±0.05 for the stratum) and the repeat-pair noise floor from the comparer.
- Report the unknown-vs-label transitions separately; the concepts atom is exactly one.
- Make the concepts atom a stated, named exception counted separately.

## 6. The real-page track needs blind labels, and "informational" is not honest

**What is wrong.**
- The real pages are the thing the pin protects. The pin exists because per-atom demoted one real atom, and the decision rests on that track.
- Without labels there is no correctness 2×2 for it, and the decision rule's "no refuting cell: remove the pin" runs on the eight gross example pages alone (finding 1).
- Rounds 4 and 4c wrote blind labels before the run. Round 6 did too (`labels.yaml`, 26/30 agreement under both shapes, which also bounds how reliable the lead's labels are).
- Post-hoc reading of the disagreements biases toward the lead's prior, and the lead already knows the demoted atom is `concepts`.
- The pages are short and the volume is small: about 29 headings plus the oracle pairings.

**Amendment.**
- The lead labels all 37 atoms blind, in a labels file committed before any live call, with confidence per label.
- Disclose that the lead knows the `concepts` result. Ideally a second seat labels that one atom blind.
- Report agreement per shape, and the lead-label noise (26/30 in round 6) as a ceiling on what the agreement can show.
- Ask the judge nothing the lead has not labelled.
- Keep the post-hoc read of disagreements, but as a second column, never as the labels.

## 7. The rule for rewriting `concepts` is a way to make the removal pass

**What is wrong.**
- The decision rule says: no refuting cell, remove the pin, and "rewrite `concepts` after the verdict if per-atom still demotes it", then treat the judge's reading as "a finding about the page".
- Rewriting the page until the judge passes it makes the hook's full-corpus run green and the pin removal "pass" without per-atom having been shown acceptable on that text.
- Round 4c's rewrites came after a verdict that found the cells bad by a stated standard. Here the standard is not stated, and the judge is a 0.49 coin flip on an edge atom.
- If the lead's blind label is `holds`, the demotion is a per-atom error. If it is `fails`, the page is deficient on a stated standard and a rewrite is legitimate.

**Amendment.**
- Fork on the blind label of `concepts`, pre-registered.
  - Label `holds` and per-atom demotes it: count it as a per-atom error. The `module-model` pin stays, or a measured threshold change goes through the ledger. Do not rewrite the page.
  - Label `fails`: the page is rewritten as its own landed unit with its own decision row, and the new text is re-measured under both shapes (a fresh round 8b cell).
- Because the pins are per library, the other three libraries do not wait on `module-model`.

## 8. The decision rule is thinner than round 6's amended one

**What is wrong.**
- No branch for mixed results, such as per-atom better on some libraries and worse on others.
- No branch for a stratum shift with no discordant cells.
- No branch for `unknown` transitions.
- No McNemar `k`/`m` or equivalence bound is pre-registered.
- "Batched loses: the pin is removed" does not follow. If batched is worse on an example page, that is a separate finding against round 3, but nothing says what the default is for the real corpus.
- The rule is one rule for four libraries (finding 4).

**Amendment.**
- Copy round 6's amended structure: correctness against labels first, the discordant-cell rule with `k` and `m` set before the run, the signed shift on the stratum against the floor and ±0.05, and the `unknown` stratum.
- Add the missing branches and a per-library outcome table.
- State that no change ships on a mixed result.

## 9. Cost and caps are blank, and one expectation is wrong

**What is wrong.**
- The predicate has `<1.5× worst>` placeholders.
- Per-atom is "4–10× the requests per page" at "high" confidence. A page has 1–4 sections, so the ratio is at most the atoms per page: 1–4 for real pages, higher only with several oracles. 10× cannot occur. The refuting cell is "—".
- Rough projection: fixtures about 20 main per shape-repeat, ×2 shapes ×2 repeats = about 80; the real track 37×4 = 148; follow-ups ≤ main for non-passing atoms. The total is about 230 main, under about 460 worst. This is cheap.

**Amendment.**
- Fill the caps (`worst × repeat × 1.5`, per ledger, as round 6's review required) and fix the expectation to "1–4×", with a refuting cell.
- Report bytes and wall time too.
- Spend the headroom on the larger seeded set (finding 1) and a third repeat.

## 10. Smaller points a builder would otherwise guess

- **Real-cells runner.**
  - `runRealCells` takes one `rule` per labels file, but the 16 pages are four artifact kinds and four libraries. Either four labels files and ledgers, or a per-document `rule`, which is a runner change.
  - The leaf matcher is ``entry.atom.includes(`${rowId},`)``. A `current_not_history(D, S)` atom has the section last, so it ends `S)` and every lookup is `NOT-FOUND` (`complete: false`).
  - A labels file with no labels still needs `rows: {}`, or `Object.keys(spec.rows)` throws.
  - `labels.oracle` is a prefix filter, so each oracle needs its own pass.
  - Document ordering: the plan's single `--labels module-pages.yaml` command cannot run.
- **Pin override.** `applyShape` and `shapedModules` copy the shipped library to `.shapes/` and rewrite `request_shape`, replacing the pin line. I read that code and it works. State it once in the plan, with the `extends [doc-verify:references]` caveat: `references` is not copied and declares no shape, so it does not make per-atom sticky.
- **Counts.** 29 headings across the four kinds: contract 2×4, model 13, properties 4, verification 4. If so, the "29" is `current_not_history` on all four kinds, not only contract/model/verification, and the table's row assignment is wrong. Recount and fix.
- **Pin the commit.** The clone is taken at HEAD, and `concepts` may be edited mid-programme.
- **Comparer.** Re-run `compare-shapes.mjs --self-test` on a planted section-keyed flip, since the keys change.
- **Stratum definition.** Say how "the targeted-section list" and the per-page atoms are matched: by section id as the runner emits it, listed in `fixtures.yaml`.
- **Review file.** `results/round-8-review.md` is to receive this review verbatim.

**Verdict: run after amendments (1–3 and 10 are blocking; 4–9 go into the same revision).**
