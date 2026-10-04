# dispatch — design philosophy and dimensions

**What it is.** The method for handing work to subagents deliberately: a route per role, the spine handed
rather than paraphrased, one output file per child, reuse keyed by the kind of work and the subject it was
done on, and a frozen tree while a child measures. `SKILL.md` is the artifact; this package is its
instrument (`flow-skills-eval/design/03-skill-package-format.md`).

## Philosophy

1. **A child is an instrument, not a convenience.** It buys independence and a second reading; a fresh one
   is earned by blinding, independence or a new topic.
2. **Hand the repository, not a summary.** A paraphrase measures the parent.
3. **Reuse beats re-derivation.** The child that did the same kind of work on the same subject holds the
   context the follow-up needs; re-dispatching pays the whole run again.
4. **A measurement needs a still tree.** While a child measures, the parent edits nothing and commits
   nothing, and every writing child has its own output path.
5. **Children are environment facts.** Routes can be refused and forks lose their children; never put a
   child on the critical path.

## Dimensions

| dimension | the question | how it is measured |
|---|---|---|
| **trigger** | does the entry surface fire when work is split across subagents or a child could be reused, and stay silent when no child is involved? | trigger pass over `tests/cases/trigger.yaml` triplets |
| **procedure** | does an agent route per role, hand the spine, give each child one output file, reuse by topic and kind, freeze, and write a shared lever? | control, entry-only and full arms; the dispatch briefs and the parent's commits are checked |
| **production** | do the children's reports arrive as one file each, against the stated commit, with `file:line` findings? | review of the produced files and the commit log during the dispatch |
| **ablation** | does each step earn its place? | full vs full-minus-one-step on the same request |

Rubrics per dimension, each item naming the defect that must flip it, are in `tests/rubric.yaml`.

## What it refuses

No exclusion clause in the description — deliberately: a trial of an exclusion pair read out a legitimate
co-owner. The body refuses a child minted for convenience, a summary in place of the repository, two
children writing one path, and a parent that commits while a child measures.
