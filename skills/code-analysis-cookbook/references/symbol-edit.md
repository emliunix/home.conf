# Rename a symbol, find every caller, read before you edit

**Task.** Change a symbol's name, or learn who uses it — by *symbol*, not by
matching text. This is the chapter that replaces `grep` + `sed`.

**Why it matters, measured.** Renaming a private method through the language
server returned **exactly two** edits — the declaration and the call site — and
an independent `grep -rn 'name('` agreed with it. The two agree here; the
difference is how they get there. The language server resolves the *symbol*;
`sed` rewrites any *string* that contains it, so it also rewrites a comment, a
log message, or a test title. A same-shaped task done by hand in this repo
produced three real failures in one day: a multi-row `VALUES` list where one of
two tuples was patched, a regex that wrote into a read-projection it should not
have touched, and a formatting break that forced reverting the file.

**Invocations.**

```
lsp_navigation  operation=rename           path=<file> line=<L> character=<C> newName=<new> apply=false
lsp_navigation  operation=references       path=<file> line=<L> character=<C>
lsp_navigation  operation=workspaceSymbol  query=<Name>
lsp_navigation  operation=definition       path=<file> line=<L> character=<C>
read_enclosing  path=<file> line=<L>       # the smallest symbol body containing that line
read_symbol     path=<file> symbol=<Name>  # one symbol's verbatim source
```

**Prerequisites.** A language server must be configured for the language and able
to index the workspace. `lsp_navigation` reports `supported: true/false` per
operation — check it, because an unsupported operation and an empty result look
the same in prose.

**Observable result.** `rename` with `apply=false` returns the *pending* edits
(a count and the new ranges) **without writing**. Read that list before applying:
it is the difference between "the tool proposed 2 edits" and "the file changed".
Then `apply=true` to write them.

**Failure modes — the column that matters.**

| what you see | what it means |
| --- | --- |
| **`file too large for LSP diagnostics (N lines > 10000 limit)`** | stock pi-lens 4.3.0 refuses `impl/control-plane/src/index.ts` at its hardcoded 5000-line bound; this host runs the bounded local patch to 10000 (below), so the 5358-line file is now in bounds. The distinction still matters: a refusal is **not** a clean result, and a rename against an unpatched or reload-pending session falls back to text. |
| `references` returns **empty** from a *usage* site on a symbol that plainly has callers | the tool's own hint says retry **from the definition**. A no-result from a usage site is not an absence. |
| the same file appears **twice**, under `/tmp/...` and `/private/tmp/...` | one real file reached by two paths; on macOS the temp dir is a symlink. Deduplicate before counting hits, or a rename's fan-out doubles. |
| `rename` returns edits in **one file** for a symbol used in several | some servers scope a rename to the open file. Verify with an independent symbol search before believing a small fan-out. |
| `apply=false` returns **0 edits** | could be "no occurrences" or "the server could not see the symbol". Distinguish by asking `workspaceSymbol` for the name — if the symbol resolves but rename proposes nothing, the server is limited, not the symbol absent. |

**Order of operations for a safe rename.**

1. `workspaceSymbol` for the name — confirm it resolves, and see how many kinds
   share it.
2. `references` from the **definition** (not a usage) — that is the fan-out.
3. `rename` with `apply=false`; compare its edit list against step 2.
4. Apply, then typecheck the touched packages
   (`code-analysis-cookbook/typecheck`) — the compiler catches the references a
   server missed, which is the cheapest confirmation that exists.

**Host bound and patch.** pi-lens 4.3.0 hardcodes
`RUNTIME_CONFIG.pipeline.lspMaxFileLines = 5000`; it is not a config key or an
environment variable. This host is patched to `10000` with
`code-analysis-cookbook/scripts/patch-pi-lens-lsp-limit.mjs` (idempotent;
`--revert` restores stock). Re-run it after reinstalling pi-lens, and start a
fresh Pi session: a process that loaded the old module keeps the old constant
until reload. The patch writes `LOCAL-PATCH-pi-lens-lsp-limit.md` into the
installed package so a reader cannot mistake the local value for upstream.

**Bound-read failure mode (measured 2026-10-03).** A bound read out of an
installed package can be **someone else's local patch**. The file is unversioned
and unsigned, and the only original signal was an mtime eleven seconds after the
patch announcement. Before quoting a package-internal constant as upstream,
compare three things: the live tool's answer, the file on disk, and the file's
mtime against your own session — and look for the local-patch marker.

**Reading before editing.** `read_enclosing` answers "what body is this line in",
and it is the habit that prevents the failure where a line is edited without
seeing the function around it. After any `grep` hit or diagnostic, read the
enclosing symbol before changing the line — a one-line edit inside a function
whose contract you have not read is how a local fix becomes a regression.
