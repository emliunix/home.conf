# Resolve a citation, and count a population with its predicate

**Task.** (a) Check that a reference in a comment or document actually points at
the thing it names. (b) Count something in the tree and state what you counted.

Both tasks fail the same way, and it is the reason they share a chapter: **the
instrument answers a narrower question than the one being asked**, and nothing in
the output says so.

**The single line, if you keep one:** *say which population your instrument read,
and whether you read the sentence or merely matched it.*

## (a) Resolving a locator

**Invocations.**

```
git show  <ref>:<path>                      # the authoritative landed text at that ref
git grep -n --fixed-strings -- <literal> <ref> -- <scope>   # search a ref, not the worktree
git grep -n --fixed-strings -- <literal> -- <scope>         # the working tree
rg -n "<pattern>" <scope>                   # faster, but the worktree only
```

**Prerequisites.** A commit or ref to resolve against. `git grep` reads the
**index/worktree by default** — pass a ref explicitly when the question is "does
this hold at `origin/main`".

**Observable result.** `git grep` exits **0** with matches, **1** for **no hit**,
and ≥2 for a real failure. **Exit 1 is not an error** — but a spawn failure is
not a no-hit either; check which you got before concluding.

**Failure modes — the column that matters.**

| what you see | what it means |
| --- | --- |
| **A symbol that does not resolve.** `git grep <name>` → **0 hits**, for a name you wrote. | Measured on this repo: six enclosing symbol names were *inferred from what the code did* and published as if measured — all six returned zero. **The unit that makes a citation verifiable is the one you read, not the one that fits.** A nonexistent symbol is harder to catch than a wrong line number, because it reads like an answer. |
| **The citation resolves, but the sentence beside it names a different unit.** | Resolution and correctness are **two independent checks**. A gate that proves "it resolves" passes a mis-indexed citation — the label was never wrong; the unit was a positional ordinal that drifted. Ask both: does it resolve, *and* does the sentence assert what resolves there. |
| **`grep` matches the phrase you expected, so you stop.** | It may not be the whole sentence. Measured: a YAML `freshness.check` clause made **two** claims; a grep for the first matched and the second (stale) went unseen. **A grep that matches is not a read.** |
| **`grep` returns empty on a document that says it.** | The text may **wrap**. Measured: `grep "The composer offers no session box choice"` found nothing on a document that says exactly that, because the line broke mid-phrase. **A miss on a wrapped line is not an absence** — flatten whitespace before comparing. |
| **`git grep` finds nothing, but you can see it in your editor.** | `git grep` searches **tracked** files by default. Untracked and generated files are not searched (verified on this repo). |
| **An empty `git diff --name-only <base>..<tip> -- <scope>`.** | That is a clean range — **unless the base is wrong**, in which case it is the same empty output. Confirm the base is an ancestor (`git merge-base --is-ancestor <base> <tip>`) before reading emptiness as "nothing changed". |

## (b) Counting a population

**The rule.** **Print the predicate with the count.** A number without its
population is not evidence; two numbers from different predicates look
contradictory when both are correct.

**Invocation.**

```bash
# enumerate the sites, then count them — never count from memory
git grep -n --fixed-strings -- 'new SubstrateError(' -- impl/<pkg>/src | wc -l
```

**Failure modes — the column that matters.**

| what you see | what it means |
| --- | --- |
| **Three different totals for one thing** (`11`, `20`, `31`) and they "contradict". | All three were correct; none carried its union. Measured on this repo: one counted literal throw sites, one a superset, one the reachable subset. **A count is a claim about a population** — name it, or the next reader reconciles numbers that were never in conflict. |
| **A grep that returns zero for a construct that exists.** | The **first argument is not the code** for every site. Measured: searching `new SubstrateError(` missed every `refuse(...)` call — a first-argument reader reported **zero** where the honest answer was a bound. Enumerate by *shape*, or state which construction form you searched. |
| **Two counts "contradict".** | They are almost certainly the same population measured **at different trees**. Measured 2026-10-03 on one gate, one day: **`135` at `3e776023`**; **`137` at `c17ceb06`** — the `+2` is a landed card adding two `sources` to an existing companion, i.e. *nothing about the gate changed*; **`138` on an unlanded branch** whose own new design contributes 3 `sources`. Three figures, three trees, no conflict. **A count is a claim about a population AT A TREE.** Quote the commit with the number, or the next reader spends their time reconciling figures that were never in conflict — and the count moves *while you are writing about it*, which is what happened here. |
| **An empty test file counts as a passing test.** | Measured: `node --test <file-with-no-tests>` reports **`tests 1, pass 1`**. So a *"24 tests, 24 pass"* line does not prove 24 assertions exist — it proves 24 things were counted, and a file with zero `test()` calls is one of them. **Assertion counts are not file counts.** This has three layers and they are three different facts — a reader who collapses them will conclude either that `main` is unprotected or that nothing is wrong: **(a) the primitive** — `node --test` counts an empty file as one passing test, unchanged; **(b) the guard** — a gate can refuse a discovered case file with no `test()` call (agent-substrate `1bf2ae5a` does, naming the file); **(c) the residual, still open** — `test("name", () => {})` declares a test and asserts nothing, and **passes**. A regex for a call is not an assertion auditor. |
| **A green test certifies completeness.** | It certifies **the population the parser read**. A checker silent about unmodelled call shapes is green about what it saw, not about the subject. |
| **A population floor turns a real correction into a failure.** | A fixed expected count ("240 citations") reddens when a change legitimately *reduces* it. Count what the change should produce, or derive the expected set from the document (see `code-analysis-cookbook/structural-search`). |

## (c) Did this change land? Content, not commit id

**The instrument that misleads.** `git merge-base --is-ancestor <sha> main` answers
*"is this COMMIT in main"* — **not** *"is this change in main"*. A cherry-pick, a
rebase, or a patch-equivalent land all leave the first **false** while the second is
**true**.

Measured 2026-10-03, three landings in one day:

| landing | correct instrument | what ancestry said |
| --- | --- | --- |
| a merge and a rebase of one branch | **tree identity** (`^{tree}` equal) | n/a |
| a rebase onto a new base | **patch-id** (`git patch-id --stable`) | n/a |
| a **cherry-pick** onto main | **blob sha** of the changed path | **"not landed" — and it was landed** |

**The checks that answer "did this change land":**

```bash
# same file, both sides, compared by content
git show origin/main:<path> | shasum -a 256
git show <candidate-sha>:<path> | shasum -a 256

# same patch, independent of base
git show <candidate-sha> | git patch-id --stable
git show <landed-sha>    | git patch-id --stable
```

**One measured false negative, and one boundary case that shows the instrument costs
nothing (2026-10-03).** A cherry-picked fix read as **missing** from `main` because its
commit id was not an ancestor, while the blob at `origin/main:<path>` was byte-identical
to the candidate's — ancestry said "not landed", content said "landed", and content was
right.

**The boundary case, which is the counter-example and worth as much as the finding:**
another seat flagged a fix as not landed at a moment when it *genuinely was not* — the
cherry-pick had not happened yet, and **both instruments agreed** (`--is-ancestor` false
AND the content grep returned 0). Minutes later the same grep returned 1 after the
landing. So content-equivalence **did not rescue a wrong answer there; it confirmed a
right one.**

That is the point: content-equivalence is the instrument for the landed-change question,
**not a tiebreaker to distrust**. A reader who takes the false negative as evidence that
content checks are unreliable would learn the opposite of the lesson.

### The third dimension: the MOMENT

Predicate and tree are not the whole claim. Measured 2026-10-03: a fix was correctly
observed **absent** (`--is-ancestor` false AND the content grep returned 0 — both
instruments agreeing), and the message carrying that observation was read after the
landing that made it false. The remote moved between the fetch and the message.

**Do not quantify the gap unless you measured the push.** The two fetches bracket it —

```
19:34:56Z  fetch -> <old sha>   fix ABSENT    (measured)
19:35:43Z  the message is sent
19:39:16Z  fetch -> <new sha>   fix PRESENT   (measured)
```

— so the push fell somewhere in `(19:34:56, 19:39:16]`, and the *send* interval was 47
seconds. **"47 seconds after the landing" was not measured by anyone**: it substitutes a
fetch-to-send interval for a landing-to-send interval, which is the same defect as every
count in this chapter one dimension over. State the bracket you have, not the number you
would like.

> **A fetch is a snapshot, not a subscription.**

The reflog is the evidence, and it is the reader's own record of what the remote served:

```bash
git reflog show origin/main --date=iso   # what the remote served, and when
```

So **a claim about a remote state has three parts — predicate, tree, AND moment.**
Re-fetch immediately before sending, or name the time the measurement was taken. Without
the moment, a correct observation reads as a wrong one, and the diagnosis goes to the
instrument when the fault was the interval.

**Keep ancestry for what it actually answers:** *is this the right base* — which is
what makes a diff readable, and its absence is why a diff against a moved main
shows another card's work as a deletion. Two different questions, two instruments;
using the base check for the landing question produces a confident false negative
on someone else's change, which is when it costs most.

**Cross-check before publishing a count.** Run a second instrument with a
different mechanism (`git grep` and `rg`, or an AST search and a symbol search)
and reconcile. If the two disagree, one population was narrower — that is the
finding, and it is worth more than either number.

**Source.** Entries ④ and ⑤ and the population rows are from this repo's
2026-10-03 citation work; the wrapped-line and YAML-clause cases were measured by
another seat and are quoted with the mechanism they measured.
