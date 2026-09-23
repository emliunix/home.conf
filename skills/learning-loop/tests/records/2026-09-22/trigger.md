# Trigger trial

Subject: fresh agent, one classification pass, no task execution. It read the full current skill
description catalog and `tests/cases/trigger.yaml`; it did not read the pre-registration or rubric.

| Case | Result | Expected |
| --- | --- | --- |
| Run the learning loop | `learning-loop` | `learning-loop` |
| Implement retry fix and summarize | none | none |
| Mine completed work and route knowledge | `learning-loop` | `learning-loop` |
| Process retrospective with cost and traps | `learning-loop` | `learning-loop` |
| Review a pull request | none | none |
| Determine what slowed a completed migration | `learning-loop` | `learning-loop` |
| Extract incident lessons learned | `learning-loop` | `learning-loop` |
| Report current incident status | none | none |
| Preserve reusable findings from a finished transcript | `learning-loop` | `learning-loop` |

Verdict: **9/9 pass**. Canonical and paraphrased routes selected the skill; all ordinary-work
negatives stayed silent.

Trajectory: the subject read `/tmp/learning-loop-trigger-catalog.md` and
`tests/cases/trigger.yaml`, classified each prompt in file order, and executed none.
