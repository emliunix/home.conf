# language — model

## Concepts

A **program** is a module's constraints, rules and oracle signatures. A **fact** is a ground atom
over a document. A **rule** derives atoms from other atoms. An **oracle** is a judged predicate;
a **demand** is a ground oracle atom to ask. A **binding** is one assignment to a constraint's
`forall`. A constraint is `require` (its goal must hold) or `forbid` (it must not), at a
`severity` (error or warning) and on a set of `profiles`.

## Two bounds

The **possibly true** bound treats an unknown or unasked oracle atom as true; the **certainly
true** bound treats it as false. A binding is **satisfied**, **violated** (the goal is certain
false for a require, or certain true for a forbid), or **undetermined**. A violated require
reports the goal literals that were not possible (bounded abduction); it does not search for a
repair.
