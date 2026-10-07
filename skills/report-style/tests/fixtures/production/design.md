# lanepool: design notes

## 15. Lanes against batches

lanepool gives each independent branch of the program its own lane: a lane is a sequence of
tasks, and the runner keeps every lane's next effect in flight. Lanes are the outer relation;
inside a lane, tasks run in order.

The alternative considered was the batch model: collect every ready task into a batch, start
the batch, wait for the whole batch to land, then build the next batch. Batches are simpler to
reason about, but one slow effect holds back every other lane until the batch completes.

lanepool chose lanes because the measured programs have lanes of very different lengths (see
`evaluate/measure-1.md`).
