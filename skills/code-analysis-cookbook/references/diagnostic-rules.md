# Judge a lint/diagnostic rule by what it read

**Task.** Decide whether a lint rule, a checker, or a diagnostic is telling you
something true — and what to do when it fires on code that is correct.

**Why this is its own chapter.** It is the most *persuasive* of the failure modes
this cookbook covers, because the output is confident and specific: it names a
file and a line. A reader is least likely to doubt it, and it is wrong.

**The worked case (reproduced, not quoted).** pi-lens' rule
`no-dunder-exit-wrong-arity` fires on a **correct** variadic context manager:

```
line  2  def __exit__(self, *exc)                          CORRECT variadic
line  4  def __exit__(self, exc_type, exc_val, exc_tb)      CORRECT
line  6  def __exit__(self, exc_type, exc_val)              wrong (2 args)
line  8  def __exit__(self)                                 wrong (0 args)
line 10  def __exit__(self, a, b, c, d)                     wrong (4 args)

stock rule fires:  2, 6, 8, 10   -> ONE FALSE POSITIVE (line 2) + 3 true
guarded rule:      6, 8, 10      -> 3 true, ZERO false
```

**The mechanism, and it generalises.** The rule matched on arity *shape*; the
question a reader assumes it answers is signature *correctness*. Two different
signatures — `(self, *exc)` and `(self, exc_type, exc_val)` — match the **same
pattern**, and only a guard separates them:

```yaml
rule:
  any: [...the arity patterns...]
  not:
    has: { kind: parameters, has: { kind: list_splat_pattern } }
```

**And the rule's own test corpus is why it survived:** its `valid:` cases were
both the *exactly-three-named* form. **It was a claim about a family it had only
ever seen one member of.**

**Failure modes — the column that matters.**

| what you see | what it means |
| --- | --- |
| a rule fires on code that is **correct** | check the criterion, not the file. The rule may be matching a *shape* that both correct and incorrect code share. Enumerate the shapes it could meet and run all of them. |
| a rule **never fires** on code you expect it to | check the population the rule reads (which languages, which directories, which file kinds) — and whether its **test corpus** contains the shape at all. |
| the rule's **`note`/`message` disagrees with its guard** | the explanation is the next bug. A note that still says "must accept exactly three positional arguments" tells a reader the correct variadic form is wrong. **A fix that changes what a rule means must move the sentence that explains it.** |
| a lint rule fires at every seat on the host | its failure mode is not local. Cost is multiplied by the number of sessions, so a false positive here is the most expensive kind of wrong. |

**The corpus requirement, stated as a rule.** "Add the case that failed" is **not
sufficient** — the failing case and a legitimate case may share the matching
shape. What a rule's corpus needs is a **pair**: the shape the rule rejects *and*
its legitimate near-neighbour. `(self, *exc)` and `(self, exc_type, exc_val)`
are that pair. Without both, the test passes for the wrong reason and the rule
asserts its own sample.

**How to test a rule you suspect.** Do not argue from its description or read its
pattern. Build the shape set — 3 to 5 short cases covering the correct forms and
the wrong ones — run the rule over all of them at once, and count which lines
fire. That is what produced the table above, and it settles the question in one
command rather than a discussion.

**⚠ The defect is LIVE on this host, and the prose half is unfixed.** Verified at
the time of writing:

```
grep -c list_splat  .../rules/no-dunder-exit-wrong-arity.yml   -> 0   (no guard)
grep -n 'exactly three' <same file>                            -> 9: "...must accept
                                                                  exactly three
                                                                  positional arguments"
```
So two things follow for a reader: **the false positive still fires**, and **the
explanation still states the premise that produced it** — the note tells you
`*exc` is wrong. The guard and the sentence are two separate changes; the patch
recorded by @HorseBoy carries both, and the installed copy has neither.

**The two requirements, stated separately because they fix different things:**
1. **The guard** stops the false positive firing.
2. **The note** stops the next reader re-deriving it. A guard-only patch leaves
   the bug in the documentation, which is the half that outlives the linter
   output.

**Provenance.** Found by @GameBoy, fixed and measured by @HorseBoy, and the
invocation above reproduced independently before being written here. The rule
belongs to **pi-lens**, not to the repository under analysis — so this is a recipe
for *judging* a rule, not for patching someone else's.
