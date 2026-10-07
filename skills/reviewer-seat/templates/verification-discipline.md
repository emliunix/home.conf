# Verification discipline — general rules

The rules a review obeys, in their general form. Each is stated once, without the instance that
earned it: an instance belongs to the project that paid for it, and a rule that travels with
another project's history does not travel well. Where a project keeps its instances, they should
name the rule they earned.

- **Choose the check by the claim's shape, not its importance.** Two levels, stated by the author
  and escalatable by any reviewer without justification. On a `Review handoff`, the reviewer
  chooses one action: `inspect`, `ask author`, `different instrument or population`, or
  `reproduce`. **Level 1 — witness (default):** the claim names the artifact or command and the
  revision, and a second agent opens it there and spot-reviews it; no rerun and no separate record
  proving a review happened. If a handoff field is missing or unclear, ask the author once; do not
  reconstruct the work or rerun the same command merely to fill the gap. **Level 2 —
  confirmation:** independent establishment or re-derivation, earned when the claim is the only
  evidence for a canon/gate/contract/authority change, is a population or count a decision rests
  on, establishes a release baseline, migration, or guard deletion, would be checked by reading or
  running the same artifact whose output it reports, cannot be checked by one named command, is
  given as a summary, or is disputed. Confirmation names a different instrument or population, or
  independently re-derives the claim through a named check; the same command on the same bytes is
  not independent confirmation. A claim quoted from a report is a pointer, not evidence; the
  artifact and the tip are the evidence. A fresh checkout is required only when the claim is about
  clean-checkout, lockfile, or cold-install reproducibility. When a claim cannot be re-derived at
  all, state its evidence class instead of adding effort. A silent-wrong-green claim still earns
  reproduction; asking the author never waives that risk. A receipt-only correction verifies the
  corrected fields and keeps behavior review closed unless a claim, object, or evidence class
  changes.
- **Final review and collaborative debugging are separate jobs.** A final review is a verdict on
  a frozen tip; it does not require a new worktree. Collaborative debugging is shared
  investigation in the common checkout, handed over as an evidence pack, and it does not acquire
  review authority.
- **Structure over sampling.** The mechanism argument — closed by construction — is load-bearing.
  Run counts are supporting sampling. Compute P(0 in N) under the measured baseline rate before
  calling a clean sheet evidence: at a 15% baseline, 5 clean runs carry P ≈ 44% and discriminate
  almost nothing. Say which of the two you are standing on.
- **Measure the counter-check before the correction ships.** A correction written from the same
  surface as the error repeats the error. Reproduce the hole, then fix it.
- **Check the surface the claim is ABOUT**, not the adjacent one. A claim verified on one surface
  and stated about another is wrong even when every check ran. The test: which artifact would
  have to be different for this sentence to be false? Verify *that* one.
- **A claimed capability is measured at the surface that would have to serve it.** A route claim is
  settled against the served surface — the route table, the running instance — never against a
  document that names the route. A symbol claim is settled by a caller census, never by the
  signature that promises the capability. The trigger is narrow and cheap: whenever a repair or
  recovery story rests on a symbol or a route, run that census before writing the story down — a
  capability nothing reaches is not a recovery path.
- **Counts derive from the population the sentence names.** A route-table count comes from the
  route table; a corpus count states its glob; a count that matters is written as `command +
  result` with the scope expressed as the command's own arguments. A count without its command is
  unreproducible the moment its author stops remembering it.
- **A guard whose input equals its fallback is not being exercised.** The diagnostic is one
  question, cheaper than a mutation: *what would have to be different for this to matter?* If no
  fixture can answer it, that absence **is** the finding — the mutation's null is evidence about
  the fixture's world, not about the code.
- **Mutations and seeds both assert their placement.** The anchor count is asserted (`== 1`), and
  the site is resolved relative to the enclosing declaration (find the function, search forward),
  not chosen for textual distinctiveness. A no-op stays green; a misplaced anchor reddens the
  wrong thing; a unique anchor at the wrong site does both.
- **Predict, then measure, with a checkable time anchor.** Write the expected verdicts down
  *before* running, and land the prediction in a dated surface before the output does —
  otherwise measure-then-narrate read backwards is indistinguishable from prediction. Pre-
  registration governs the reviewer; instrument rules govern the author's tools; neither is
  dischargeable on the other's behalf.
- **A lifted arm that fails immediately after a lift: suspect the fixture first, then the
  product.** When a skip lifts, the mock must grow the surface the newly-reachable path reads —
  otherwise the product looks broken and the fixture was.
- **Open the deciding call, not the line that names it.** A rule, decision, or flag is settled at the code path that
  consults it — never at the identifier, the doc, or the log line that mentions it. When a mechanism is right and its
  input is wrong for a reason outside it, the log blames the mechanism: the check has to be aimed where the decision is
  actually taken.
- **Inspect the record or run the thing; do not infer it from its design.** A design says what was intended, and an
  instance says what happened. Neither is evidence of what *should* happen, and a mechanism named only in a design
  document is a declaration, not an emission.
- **A ref is evidence only at the revision you read it.** Name the revision with every file you quote. A checkout that
  is merely nearby, or a branch-era copy left on disk, will otherwise be read as the current floor — and it reads
  perfectly while being months of commits out of date. Verify ancestry before trusting a branch name.
- **Prefer the rule that removes the opportunity for a defect over the rule that checks for the violation.** A check
  catches the instance it was pointed at; a shape that makes the mistake unrepresentable catches the class.
- **A gate cannot see what its population excludes.** Before trusting a green, ask how the check builds its list — a
  file list, a glob, or a key set that is too narrow produces a passing report about a subset. An empty result is only
  evidence if the instrument could have seen the answer.
- **An uncited artifact that states a claim must be true or not exist.** A cited artifact must
  resolve or it fails loudly; an uncited one sits at a plausible path, states a claim, and is read
  by whoever finds it, so nothing will ever make anyone check it. Disposal is fair game — but a
  stale claim makes deletion the only safe state.
- **Assignments hand pointers, not claim sets.** "There is no history in this arc" and "here are
  my conclusions about it" cannot both go to the same reviewer. Hand the fresh seat where to
  look; disagreements settle on the tree, not on seniority.
- **Separate exposure kinds when labelling provenance.** A *location* (branch, file, section,
  the name of the claim) is unavoidable and harmless; an *answer* (what the review is expected to
  find, or why it is true) ends the seat's independence. Labelling both "exposure" invites
  treating a harmless one as disqualifying and a disqualifying one as harmless. The test: a
  prediction of the location is not a prediction of the answer.
- **A name that promises a guarantee must be true of every instance of that name.** When a verb
  names a property rather than an action — `mark…`, `assert…`, `ensure…`, `verify…` — census every
  instance in the tree and check that each could be wrong. A method whose body is `void x` claims an
  invariant while maintaining nothing, and readers act on the name, not the body. The census is the
  check; the name is the claim. Counterweight: this applies where a reader *could* act on the name —
  a local latch that happens to share the word is a different verb, not a false promise.

- **Establish whether the instrument writes before you point it at someone else's tree.** A read
  is not read-only because it was meant as one; the tool's default mode is the fact. `sqlite3 <path>
  "<sql>"` opens read-write, creates a missing database file, and consumes a write-ahead log on close
  — so "check what is in this file" destroyed the last copy of the bytes it was checking, with a
  clean exit. Safe forms exist for nearly every tool and are almost never the default (`-readonly`,
  `?mode=ro&immutable=1`, or `ls`/`stat` when metadata is all you need). After such a mistake the
  repair is to say what you read, what you wrote, and what is now gone.
- **A snapshot is verified by listing its contents, never by the command having exited 0.** The
  number that matters is the one you read back out of the artifact: an `add` that skips ignored
  paths captured 5 of 55 files and reported success. Same rule for a state claim about a tree —
  **read the tip, not your own commit**; a message describing the change is not the change.
- **A tree with a borrowed store is not the tree under test — check where the imports resolve.** In a
  git worktree with `node_modules` symlinked from the main checkout, the nested workspace links re-base
  to the *source* tree: `realpath(node_modules/<workspace-pkg>)` returns the main checkout, so a
  repo-wide test run silently exercises the wrong code while reporting green. Copy the store rather than
  symlinking it (a copy keeps nested relative links inside the copy), or install in the worktree — and
  then verify resolution by path before reading any number off the run.

- **A measurement whose instrument can be named as the writer is a finding, not a footnote.** Report
  the mechanism with the result, including what it cost and what could not be recovered; the next
  seat meets the same shape on a tree nobody in the room owns.

## Where these rules are owned

A rule's durable home is the surface a future reader would consult — a contract, a guide, a
worklog entry — not a chat message and not agent memory alone. This file owns the general form;
the project that earned an instance owns the instance and should cite this rule by name.
