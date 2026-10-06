# Read a large file by its outline, not its bytes

**Task.** Learn a big file's shape — its symbols, their signatures, their nesting
— before reading any of it.

**Why this is a chapter and not a tip.** On a 5357-line, 213 KB file the three
instruments answer the *same question* very differently:

| instrument | what you get |
| --- | --- |
| `cat` / whole read | **23,401 words** — every byte, no structure, and it costs the context you need for the actual work |
| `rg '^(export )?(async )?function'` | **119 line hits** — names and line numbers; no members, no signatures, no body boundaries |
| `ast_grep_outline` | structured items: **signatures**, nested **members**, and a **read handle** per item |

The outline is the only one that gives the **shape**. It returned
`SubstrateControlAdapter`'s ~40 members as a tree with signatures, exact body
boundaries (`start` → `end` line/column) per symbol, and a read handle for each
item — so the next step is reading *one symbol*, not the file. `rg` gives 119
flat hits for the same file; reconstructing the interface from them is work the
tool has already done.

**Invocation.**

```
ast_grep_outline  paths=["<file>"]  view=expanded     # signatures + members + read handles
ast_grep_outline  paths=["<dir>"]   items=exports     # a directory's public surface
ast_grep_outline  paths=["<file>"]  view=names        # names only — the cheap form
```

**Prerequisites.** None beyond the language being supported. Works on a **file** or
a **directory**.

**Observable result.** A tree of items, each with `name`, `symbolType`
(`function`/`struct`/`class`/`constant`/…), `signature`, `range`, and a `read`
handle (`{path, offset, limit}`) that feeds straight into a bounded read.

**Failure modes — the column that matters.**

| what you see | what it means |
| --- | --- |
| the output is **truncated** | the full expanded outline of a 5000-line file is ~39 KB of JSON. Ask for `view=names`, or filter with `match`/`type`, rather than paging a structure you only needed the headings of. |
| the **LSP refuses the file** for size while this works | they are different paths. The LSP bound is on **diagnostics/sync**; the outline is parsed locally and is unaffected. Measured: the same 5357-line file that the LSP reports as *too large for diagnostics* outlines fine. |
| you outline and then still `cat` the file | the read handles exist so you do not. Read the one symbol you care about (`read_symbol`, or the item's own `read` handle). |
| `items=exports` on a file returns few items | it lists the public surface — the right view when you are asking "what does this module offer", not "what is in here". |

**Pairs with.** `code-analysis-cookbook/symbol-edit` (read the enclosing symbol
before editing a line) and `code-analysis-cookbook/structural-search` (the
outline finds the symbols; a pattern finds the sites).
