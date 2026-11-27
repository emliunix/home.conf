# language — model

## Concepts

A **module** is a YAML program: oracle signatures, rules and constraints, composed from its
`extends` parents. A **fact** is a ground atom over a document, derived by `documentFacts` from
the section tree and the document's references; `core.*` names the shipped vocabulary. A **rule**
derives atoms from other atoms. An **oracle** is a judged predicate; a **demand** is a ground
oracle atom to ask. A constraint is `require` (its goal must hold) or `forbid` (it must not), at a
`severity` (error or warning) and on a set of `profiles`.

## Run

The language compiles a module into a program, translates the program and the document's facts
into the kernel's input, and runs rounds: the kernel returns statuses and its demand, the host asks
the judge for the demanded atoms, and the answers go back to the kernel. The truth values,
binding statuses, demand and verdict a run computes are defined by the model
(`docs/doc-verify-model.md` §2 to §6). The engine report records, per constraint, its bindings
and proofs, and the run's coverage: which atoms were asked, which were never asked, and which got
no usable answer.
