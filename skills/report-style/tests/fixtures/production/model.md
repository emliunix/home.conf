# lanepool: the execution model

lanepool runs a program of tasks, each of which may start one external effect (a call that
takes time and returns a result). The model below is what the runner implements.

## Configuration

A run's configuration is σ = (S, R, O):

- **S** — the store: every value a finished task produced.
- **R** — the ready set: tasks whose inputs are all in S and that have not started.
- **O** — the outstanding set: effects that have started and not yet landed.

A step takes one task from R, starts its effect and adds it to O. A landing removes an effect
from O, writes its result to S, and may move dependents into R.

## Properties that change

- **P1 (independence).** Two tasks with no path between them in the dependency graph can be in
  O at the same time.
- **P2 (barrier).** A task with several inputs enters R only after every input has landed; the
  check runs at each landing, not on a timer.
- **P3 (one control).** Only one control loop mutates σ. Effects run concurrently; the decision
  about what starts next is serial.

P1 is the property the earlier design lacked: it started one effect, waited for it, then took
the next task, so O never held more than one element.
