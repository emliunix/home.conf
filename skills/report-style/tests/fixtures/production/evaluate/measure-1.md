# Measurement 1: does O hold more than one effect?

**Verdict: measured.** On the four-lane test program, the outstanding set reached 4 effects at
once in every run (20 runs). The earlier sequential runner never exceeded 1.

## Correcting the premise

The question first asked was "how many tasks are ready at once". That is the wrong measure:
the ready set is a scheduling width, not an in-flight set. A runner can have 4 ready tasks and
still start them one at a time. The measurement therefore counts O, not R.

## Against the batch model

The same program run under the batch model kept O at 4 only for the first batch; afterwards the
short lanes waited on the longest lane, and O fell to 1 for 70% of the run.
