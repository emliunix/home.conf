# eval-prompt — changelog

One row per change: date, what changed, the finding that caused it, and the record that showed it. Records live in the evaluator's tree (`visflow/worklog/eval-prompt-trials/` and `worklog/eval-prompt-tests.md`).

| date | version | change | finding | record |
|---|---|---|---|---|
| 2026-09-19 | v0 | created: 5 cases, 3 arms, trial steps | — | — |
| 2026-09-19 | v1 | + `ablation` case, read fence, material integrity, negative tasks, pre-registration step, sample rule, conflicting-records rule; − *Term* paragraph, declare folded into step 1 | iteration 1: a control arm **read the rubric** (F0b) and the material was **truncated at 260 chars** (F0a) | `iter1-control`, `iter1-v4pro` |
| 2026-09-19 | v2 | + `Preconditions` (loadability), fence covers **greps**, ambiguity rule, feedback clause | iteration 2: the surfaces were **not loadable** by any subject (F1); two arms leaked verdicts through **grep** output; a subject could not know the intended routing (T8 flag) | `iter2-*` |
| 2026-09-19 | v3 (queued) | ablation rule corrected: a part the trial never exercised is **unpriced**, not decoration | iteration 3: two sections priced load-bearing, two unpriced for stated reasons | `iter3-*` |
| 2026-09-19 | — (not applied) | shape-form exclusions for the ten `visflow-*` descriptions | iteration 4: exclusions behave as **lexical guards**; shape ≈ live on the decisive test | `iter4-live-flash`, `iter5-*` |

| 2026-09-19 | v4 | + `Preconditions`: **lint the artifact before measuring it** (parse the frontmatter, then confirm the exposed catalog holds the name) | the frontmatter of this skill and all ten `visflow-*` skills was **invalid YAML** - every loader silently dropped them; five trials measured an artifact that could never fire, and each arm reported it as "not exposed" while the parent diagnosed the wrong root twice | `iter5-pos-flash-retry`, catalog refresh |

| 2026-09-19 | v6 | + `walk` case (W1-W6) and its section; the description still lists six cases - **a trigger run is owed** before adding the word there | six walks over the real tree: consistency failed in all six; the entry surfaces were sound and the bodies had drifted from the tree (a batch size, a command count, a citation to two trees that do not name absences) | `worklog/dryrun-walk/` |
| 2026-10-05 | v7 | + **Score the behaviour, not the phrasing** section: state the predicate before writing the pattern, hand-score a sample and report the pattern's disagreement rate, repeat counts fix variance not validity, and an order-inverting rate is evidence about the instrument first | task #166: a writing-rule ablation reported `full 0/6` against both ablated arms at `6/6`, stable over six repeats, and the report named "a defect in the feature regex" as one of two live explanations. Hand-labelling the 72 stored messages against the rule's own sentence gave `4/6`: the pattern required two named verbs where the rule named a **class** of actions, so four runs that performed the behaviour were scored as not performing it. The inversion was entirely the detector and needed no re-run to settle | `#comp-agent-substrate-2:8f5ebaf9`; `2026-10-05-stable-rate-scored-phrasing/` |

**Open at v2:** whether clause-based exclusions generalise at all (iteration 5), and whether the package's rubric and cases make two subjects' records comparable (iteration 6).
