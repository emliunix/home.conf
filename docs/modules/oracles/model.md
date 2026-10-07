# oracles — model

## Concepts

An **oracle** is a judged predicate with a label set (a `choose` list, or the `ask` pair
holds/fails), an evidence expression, and a `threshold`. A **demand** is a ground atom. A
**batch** is the demanded atoms of one document in one round. An **answer** is a label and a
distribution: let `L` be the argmax and `p` its value; `L` holds when `L` is not unknown and
`p >= threshold`, otherwise every label is unknown. A missing distribution or a tie is unknown
with a finding.

## Evidence and spans

Evidence is a section expression — `core.own`, `core.body`, or `core.union` — carried with its
piece offsets. A **non-passing** atom (label fails or unknown) gets a **span**: one follow-up
`choose` over the evidence's sentences (`sentenceSpans`), or, when that cannot be judged, the
section span labelled not judged (`sectionSpan`). A sentence is a whole sentence across its
wrapped lines, not a line fragment.

## Cache

The cache key is (model, question, labels, evidence hash, policy). A warm cache replays an
atom's answer and its follow-up span; `--no-cache` neither reads nor writes.
