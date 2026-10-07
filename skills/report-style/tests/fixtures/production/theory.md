# lanepool: why the model is sound

## 3. Claims and their obligations

Each claim is stated with the obligation that must hold for it to be true. The claim is not the
obligation; an implementation can meet one and miss the other.

- **T1. Independent effects overlap.** Obligation: the runner starts every task in R before it
  waits on any landing (`start_effects`), so O can hold more than one effect.
- **T2. A join never fires early.** Obligation: the barrier check reads S at each landing and
  admits a task only when all of its inputs are present (`barrier_check`).
- **T3. The result does not depend on landing order.** Obligation: each task reads only its own
  inputs from S, and only the single control loop writes σ (`run_one_control`).

## 4. What the theory does not cover

The theory says nothing about how many effects the external services can accept at once. A
service that serialises its calls makes O large and the run no faster; T1 then holds and the
wall-clock gain does not.
