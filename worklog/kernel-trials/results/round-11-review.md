# Round 11 plan review (independent seat: Sonnet; author: Opus), 2026-10-14, verbatim

**Run after amendments.** I did not run an implementation; I ran `check --all --profile draft` (28 docs, PASS, 2 warnings) and wrote a throwaway prototype of the stated rules (`/tmp/rv11/p.py`) over those 28 docs.

**Blocking**

1. **`docs/doc-verify-model.md#semantics` is mislabelled `dangling`.** The fragment rule says "or `frag` equals a section id under `normalizeSectionId`"; that function strips a leading enumeration, so `3-semantics` and `semantics` normalize equal, and the rule *resolves* it. Implementation would be right and the fixture would show a miss. Either drop the normalize clause (then `#3-semantics` still resolves by the slug pass) or relabel `#semantics` `resolves` and add a real dangling one (e.g. `#overview`).
2. **Corpus expectation "exactly 2" is wrong under the stated rules.** `design/05-trusted-kernel-redesign.md:54`: "(`docs/doc-verify-constitution.md`), with … stated in §Constitution amendments." The constitution has no such heading → a third finding (the § is really meant for design/05's own heading: a mis-bind). Also `design/06:79` is a table row "design/05 §Design, module language … | … listed in §Language breaks": unless `|` ends a sentence, the second § binds to design/05 and is flagged falsely. Decide whether table cells / bullets are sentence ends and say so; then relabel design/05:54 as `dangling` (the rule as stated flags it) → expected corpus findings = 3 (or 2 only if the plan changes the rule).
3. **Seeded defect 2 does not turn the fixture red.** "Skipped: §3, model §9, §C1-receipt" has no resolvable doc before any of them, so removing the id rule changes nothing there; it only flips on the corpus (design/05:113, `docs/doc-verify-model.md` §9). Add `` `docs/doc-verify-model.md` §9 `` and `design/05 §C1-receipt` to the fixture.
4. **`score.mjs` cannot score the fixture as specified.** It reads only `/tmp/r11-all.json`, which does not contain the fixture (not one of the 28), so all 10 fixture danglings would count as missed. It also locates labels by string, but the fixture text has backticks (`` `design/03` §Report contract ``, `` `AGENTS.md` §… ``) that labels lack → `complete` breaks; `code-span §Nowhere` and the relative-link prefix `../../../../` are not literal strings either. Key labels as (file, line, target-as-written), have the vitest run emit the fixture's JSON for `score.mjs`, and strip backticks when locating.

**Should-fix (unspecified choices that could be tuned)**

- Sentence boundary undefined. Specify: `.`/`!`/`?` + whitespace, or blank line; not `|`, `:`, `;`, newline. `AGENTS.md` must not break at its dot.
- Bare names: `AGENTS.md`-style resolves how? State: exact path at root, else unique basename.
- `design/NN`: specify regex `design/\d\d` not followed by `-`, glob `design/NN-*.md` (ignore `.yaml`), exactly one match.
- Doc inside a code span: is it a doc candidate, and is a § in the same span skipped? (I assumed doc yes, § skipped.)
- Heading text: not defined for backticks/links/setext. Use mdast `toString` as the segmenter does; skip fenced headings.
- Duplicate headings: fixture has no `-1` case, yet duplicate numbering is S3's central point. Add `#where-u-comes-from` (backtick heading) and a duplicate-heading doc.
- `#kernel` only separates slug passes — fine for defect 1, but a nested-duplicate case is untested.
- Second prefix test: any heading starting with a common word matches (`§Rule` resolves). State this accepted laxness.

**Notes**

- Defect 3 does turn red: `design/06 §Nowhere` inside a code span resolves design/06 and finds no `Nowhere`.
- Fixture counts check out (10/10/7); `../../../../` paths resolve to repo root; the other slugs (`3-semantics`, `4-constraints-and-status`, `kernel`, `companion-contract`, `links-with-fragments`) and labelled headings resolve.
- `design 04 §Engine` is skipped only because nothing precedes it; it tests nothing about the no-slash rule. State that.
- "28 docs, 0 fragment links" holds (design/07's `.md#` are in code spans).
- Cost bar +10% is inside observed run-to-run spread (~9%); use 5 runs and compare medians.
- Not stated as unmeasured: anchors for headings with HTML, setext headings, `readTarget` mtime invalidation, case differences in paths.

**Run after amendments.**
