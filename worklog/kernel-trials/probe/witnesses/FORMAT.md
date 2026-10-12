# Witness format (round 2)

One YAML file per witness. Every subject (the WFS kernel, the TypeScript evaluator, the naive
reference) reads the same file. Expected values are derived by hand from
`docs/doc-verify-model.md` and written before any subject runs.

```yaml
id: m1-monotone                 # file name without .yaml
gate: M1                        # a row of model §9, or "corpus"
module: |                       # a design-04 module YAML (schema_version 2), verbatim; the
  schema_version: 2             # TypeScript evaluator loads it as is, the other subjects translate it
  kind: verification-module
  module: w
  imports: {core: doc-verify:core}
  oracles:
    o(D, S): {ask: q, evidence: "core.own(D, S)"}
  rules:
    ok(D, S): core.section(D, S, _), o(D, S)
  constraints:
    c1: {forall: "core.section(D, S, _)", require: "ok(D, S)", severity: error}
facts:                          # ground base facts, Prolog syntax, core predicates unqualified
  - section(d, a, root)
  - section(d, b, root)
steps:                          # a sequence of answer states; each step is evaluated in order
  - answers: {}                 # atom -> label; atom in Prolog syntax with qualified predicate
    expect:
      statuses:                 # constraint -> list of {binding, status}
        c1: [{D: d, S: a, status: undetermined}, {D: d, S: b, status: undetermined}]
      demand:
        full: ["w::o(d,a)", "w::o(d,b)"]
        prefix: ["w::o(d,a)", "w::o(d,b)"]
      verdict: NEEDS-REVIEW     # the model's verdict for this document under this state
  - answers: {"w::o(d,a)": holds, "w::o(d,b)": fails}
    expect:
      statuses:
        c1: [{D: d, S: a, status: satisfied}, {D: d, S: b, status: violated}]
      demand: {full: [], prefix: []}
      verdict: NO-GO
      missing:                  # violated require -> model §7 descent: literal and clause path
        c1: [{D: d, S: b, literal: "w::o(d,b)", path: ["w::ok(d,b)#1"]}]
```

Rules:
- `answers` are cumulative facts of the step, not deltas; a step may remove nothing (M1 witnesses
  extend the previous step's answers).
- Atom syntax in `answers`, `demand` and `missing`: `module::pred(args)` with ground args, no
  spaces, atoms quoted only when Prolog requires it. Label atoms of a `choose` oracle are keyed by
  the oracle atom (`"w::k(d,a)": x`), never by the label atom.
- `statuses` lists every binding of the constraint; order does not matter; the binding keys are the
  forall's named variables.
- A `corpus` witness has no `module`/`facts`; it names `documents: [paths]` and the module list of
  `.doc-verify.yaml`, and its `expect` is produced by the reference, not by hand, then frozen in the
  file with `derived_by: reference`.
- Expected values are the model's. If a subject disagrees, the subject is wrong until the hand
  derivation is shown wrong, in which case the witness is corrected in place and the correction
  is recorded in the results file.

Added for round 2 by the reference author (after the 2026-10-12 model amendments):
- Write `evidence:` in block style or quoted (`evidence: "core.own(D, S)"`); in a YAML flow mapping an
  unquoted `core.own(D, S)` splits at the comma and the module does not load.
- A second clause of a rule needs a distinct YAML key: rename its head variable (`ok(D, T): ...`).
- `missing` rows (model §7, descent): `literal` is the f literal reached; `path` lists the derived
  goals entered, each as `goal#1` (always the first clause), omitted when empty; `passed_u` lists the
  u literals passed as if they held, omitted when empty. Literal text: `mod::p(args)` for a predicate
  or label atom, `not mod::p(args)` for a negation, `x in [y,z]`, `matches('Notes','^re')`, `2<1`;
  a count interval prints as `lo..hi` (`1..2<1`).
- Population rows (model §4): a `nonempty` constraint with no binding has the row
  `{population: empty, status: violated}`; one whose every binding has Bθ = u has the extra row
  `{population: undetermined, status: undetermined}`, whose support is the forall leaves of its bindings.
- `expect: {rejected: true}` means the module must be refused statically (model §8).
- `reference: unsupported` marks a witness outside the stratified fragment; the naive reference skips
  it, the expect is hand-derived, and `findings` lists required findings (e.g. `unfounded`).
- A `corpus` witness carries `facts_file`, `modules` (per document, the rule's module list) and per
  step a `profile`; `expect.documents` maps each path to the per-document expect shape above.

