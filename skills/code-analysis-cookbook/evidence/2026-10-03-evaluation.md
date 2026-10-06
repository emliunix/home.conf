# Evaluation — is the cookbook useful, or just plausible?

Control-vs-guided, on tasks where the tool choice is not obvious. Every command
below was run on this host at repo `d337eef1`.

## T1 — "does the repository compile?" (guided finds what control misses)

| arm | command | result |
| --- | --- | --- |
| control (the obvious gate) | `pnpm check` | `10 checks, 0 failed` — **GREEN** |
| guided (`typecheck.md`) | `sh scripts/local/typecheck-all.sh` | **4 of 10 packages report errors** |

**This is the finding the chapter exists for, and it reproduces exactly:** the
aggregate gate is green while four packages do not typecheck, all from one
pre-existing error in a dependency's file. **Verdict: the chapter changed the
answer.** Without it, a "does it compile" question is answered wrongly by the
command anyone would reach for first.

## T2 — NEGATIVE: a bounded case the tool cannot answer

The `structural-search.md` chapter claims AST patterns cannot match code inside
string literals. Tested on the same construct:

| arm | command | result |
| --- | --- | --- |
| text search | `grep -c 'INSERT INTO agent (' impl/substrate/src/store.ts` | **1** — found |
| structural search | `ast_grep_search 'INSERT INTO agent ($$$C) VALUES ($$$V)'` | **No matches found** |

**Verdict: the bound is real and the recipe states it.** The two tools disagree
on the same file, and only the chapter's stated rule tells you which answer to
believe. A reader who trusted the structural no-match would conclude the SQL was
absent.

## T3 — "what is the shape of this file?" (tool beats plain reading, same question)

Asked by the owner directly, on the 5357-line, 213 KB `impl/control-plane/src/index.ts`:

| instrument | result |
| --- | --- |
| `cat` / whole read | 23,401 words, no structure |
| `rg '^(export )?(async )?function'` | 119 flat line hits |
| `ast_grep_outline view=expanded` | structured items with **signatures**, nested **members**, exact body boundaries, and a read handle per item |

**Verdict: the chapter changed the answer, and here both arms answer the *same*
question** — which makes this a cleaner demonstration than T1, where the control
arm answered it wrongly. It also produced a bound: the full outline is ~39 KB of
JSON and was truncated in one call, so `view=names` or a filter is the
pragmatic form on a file this size. Noted in the chapter.

**And it works where the LSP refuses.** The same file is reported as *too large
for LSP diagnostics*; the outline path is unaffected, because the bound is on
diagnostics/sync rather than on parsing.

## T4 — a symbol rename, and its bounds

`lsp_navigation rename` on a private method proposed exactly the declaration and
the call site, and an independent `grep -rn 'name('` agreed — measured, not
asserted. Bounds also measured: `references` from a **usage** site returned
**0** where the definition returned **2**; a 5358-line file is **refused** by the
size limit rather than reported clean.

**Post-trial host change (2026-10-03 18:00Z):** the owner directed the
5000-line bound be raised to 10000. pi-lens 4.3.0 does not expose that bound as
configuration; the host now carries the bounded patch in
`scripts/patch-pi-lens-lsp-limit.mjs`. The trial above remains the stock-tool
measurement; with the patch, the 5358-line file is in bounds and a synthetic
10001-line input is refused. A Pi process that loaded the old module still
holds 5000 until reload.

## Deleted / kept

Nothing was deleted: no recipe here is ablation-neutral, because each states a
command whose *observable* differs from the obvious alternative's. The
evaluation that would justify deletion is a task where control and guided agree —
T1 and T2 are the opposite, and the third (rename) is a bound rather than a
behaviour change, which is why it is recorded as a limit and not trimmed.

## Unresolved

- The Glean chapter is a **proposal**, not a recipe: reachability measured, run
  not performed.
- Recipes are verified on **one repo** (`agent-substrate`). Nothing here is
  claimed to be general, and the failure-mode column is where generalisation
  would have to be earned.
