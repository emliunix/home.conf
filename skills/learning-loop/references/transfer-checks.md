# Transfer checks

Choose the cheapest check that can falsify the claim that the lesson will transfer.

| Level | Use when | Check |
| --- | --- | --- |
| 0. Direct | A path, link, generated file, lint, or test changed | Resolve the path and run the exact check |
| 1. Mechanical walk | The lesson routes among existing records | Walk every proposed destination and command; report missing owners or blockers |
| 2. One fresh reader | An instruction, skill, reading order, or authority pointer changed | Give one bounded scenario without the answer key; record files read, decisions, dead ends, and outcome |
| 3. Reader batch | The work claims better onboarding, lower reader cost, or broad transfer | Pre-register topics and scoring, pin one revision, dispatch independent readers, and wait for all before editing |

Levels 0 and 1 are the default. Level 2 is required when the change depends on future-agent judgment.
Level 3 requires an explicit experiment or a high-cost claim; a normal learning-loop invocation does
not authorize it by itself.

For levels 2 and 3:

1. Put the rubric, predictions, and answer key outside the tree under test.
2. Pin the fixture and artifact bytes with SHA-256.
3. Give readers a redacted, bounded scenario and forbid access to the answer key.
4. Freeze the tree until all readers return. A reader that saw another revision is a separate trial.
5. Record each trajectory before feedback. Score the trajectory and output, not the reader's opinion.
6. Apply changes only after the batch closes, then run a new batch against a new pin if needed.

Measure transfer with concrete costs: files opened, dead ends, wrong authority accepted, steps to the
answer, elapsed time when trustworthy, and whether the reader reached the required decision.
