# Criteria

> **This guide names NO specific project, repository, or PC path — only the general library root
> `~/Documents/process-failure-patterns/<project>/`.**

⚠ **Lead rule, and it constrains every criterion below.** A criterion that names a project path is true on one
machine; a criterion is guidance and must hold wherever the library is read. **A dated capture may name the
project it came from** — the capture is evidence about one place and states its own scope. **Guidance may
not.**

---

## What counts as a failure

**Admission is deliberately cheap: a failure is captured when it is found.** The library is raw material, not a
verdict, and a threshold at capture time loses the single incidents that later turn out to be structural.

| # | criterion | kind | evaluable from |
|---|---|---|---|
| **1** | **A target could not be located**, or locating it took **more than two failed attempts**. | **admission** — one incident qualifies | `material_located`, `attempts_before_success` |
| **2** | **The alike pattern appears across many scenarios and many agents** — it has recurred, not merely happened. | **classification (structural)** | the entry's cited seats: `≥3` distinct agents/people named |

### Why the two are different kinds, and why saying so matters

**Criterion 1 is decidable at capture time; criterion 2 is not.** Recurrence across many agents is a fact that
**cannot exist yet** when a pattern is first recorded — so as an admission test it would exclude every new
observation, and as a classification it is exact. **Applying them as the same kind of rule is the error to
avoid.**

**Measured on a live library of 109 entries**, to show what each does:
- **criterion 1:** the mechanism is present in a minority of entries, and **no entry recorded an attempt count**
  (`10` mention "attempt"; **`0` record a number**). ⇒ **The criterion was unenforceable because the template
  had no field for it.** This is why `references/entry-template.md` carries `attempts_before_success` and
  `material_located`, and why the existing entries are **not** retro-fitted from guesses.
- **criterion 2:** `30 of 109` entries name **≥3** distinct seats — a direct count over data every entry
  already carries. ⇒ **usable today, no template change needed.**

⚠ **A criterion without a field is a wish.** Adding one to this list means adding its field to the template in
the same change, or the list grows a rule nothing can check.

## What a captured failure must state

Each entry records, in its own file:

1. **What was believed, and what was true.** The defect is the gap; state both sides.
2. **The mechanism**, not the outcome. "The count was wrong" is an outcome; "the predicate matched a line's
   shape" is a mechanism. **Only a mechanism predicts the next instance.**
3. **The falsifier** — the command or observation that would have caught it, and whether it fired.
4. **The correction**, or an explicit `recorded` / `open` disposition with a lift condition.
5. **The scope.** A finding from one project is evidence about one project until it is reproduced elsewhere.

## Dispositions

| disposition | means |
|---|---|
| `fixed` | the process changed, and the change is named |
| `recorded` | captured, correction not yet made — **carries its lift condition** |
| `open` | a live defect with a named owner or a stated next step |

⚠ **`fixed` is a claim about the process, not about the write-up.** A corrected sentence in an entry is a
`recorded` disposition until the process it describes actually changes.
