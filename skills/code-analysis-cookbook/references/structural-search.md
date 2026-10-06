# Structural search and preview-then-apply

**Task.** Find code by its *shape* rather than its text — every call to a method,
every object literal with a given property, every function with a given body —
and rewrite matches without touching strings that merely look similar.

**Invocation.**

```
ast_grep_search   lang=typescript paths=["<dir-or-file>"] pattern="this.refuse($A, $B, $C)"
ast_grep_replace  lang=typescript paths=[...] pattern=<pattern> rewrite=<replacement> apply=false
```

**Prerequisites.** A supported language only (`lang` is required). Patterns are
code, not regular expressions — metavariables are `$NAME` (one node) and `$$$NAME`
(a list).

**Observable result.** Each match prints its file, line, the matched source, and
the **bound value of every metavariable** — so the result is structured, not a
line of text you then have to parse. `ast_grep_replace` with `apply=false` is a
**dry run**: it lists what would change and writes nothing.

**Failure modes — the column that matters.**

| what you see | what it means |
| --- | --- |
| **`No matches found`** for a pattern whose text you can see with `grep` | the pattern is not a valid AST node in that position, or the text lives **inside a string literal**, which is not code. Measured: `INSERT INTO agent ($$$C) VALUES ($$$V)` matched **nothing** though the SQL was present, because it is inside a template literal. A bare property pattern (`bindingKind: $V`) also matched nothing without its enclosing object; a rule-based attempt to work around it **timed out**. **A structural no-match is not an absence** — it can mean the tool cannot see that construct. |
| the search **times out** | the pattern is too broad (`$OBJ` as a top-level pattern) or the scope too wide. Scope `paths` to a file or narrow directory, and prefer the most specific node shape. |
| match count looks right but sites are wrong | the pattern matched a *sibling* occurrence. Check the bound metavariables in the output, not just the count — the values are printed, so read them. |

**When to use which — the decision this chapter exists for.**

```
is the target CODE (a call, a declaration, a property, an import)?
  yes -> ast_grep_* ; it matches structure and cannot touch a string literal
  no  -> it is inside a string/template literal (SQL, a fixture, a message)
         -> text search (rg/grep), and YOU are responsible for the over-match

is the task a RENAME?
  -> prefer lsp_navigation rename (symbol), see code-analysis-cookbook/symbol-edit
```

**Why this ordering.** A text pattern stands in for the structure it means, and
the two diverge exactly where it costs: a `sed`/regex rewrite of a name also hits
comments and test titles, and a hand-built patch of a repeating construct tends
to catch only the first instance — measured in this repo as a multi-row `VALUES`
list where one of two tuples was rewritten, producing
`all VALUES must have the same number of terms` at runtime, which reads like a
schema fault rather than an edit fault.

**Confirm a rewrite independently.** After `apply=true`, run the typecheck for
the touched packages (`code-analysis-cookbook/typecheck`) and re-run the search.
A structural rewrite that typechecks and whose match set is now empty is
evidence; a rewrite that "looks right in the diff" is not.
