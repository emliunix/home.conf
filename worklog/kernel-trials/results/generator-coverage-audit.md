# Property-generator coverage audit (task F4, 2026-10-14; a Sonnet seat, read-only, verbatim summary)

Scope: doc-verify/tests/kernel-slow/property/generator.mjs against the checker's accepted forms and
the translator's special cases (doc-verify/src/kernel/translate.ts). Generated: negation of oracle /
derived / choose atoms with bound args; count in rule bodies and goals, with sibling-shared variables,
with negation inside, bound/constant/shared results, aux sharing; recursion; negative loops; choose
in bodies and goals; matches (bound and unbound); one-element `in`; cmp; nonempty populations;
unknown and partial answers.

Not generated (risk; other coverage):
- negation of a base fact, or with local/anonymous variables (`not p(D,_)`, `not o(D,Z)`), and the
  sibling-shared negation form — the lifting code where a4985be's bug lived; only static witnesses.
- count in a forall; nested count — aux parameter scope; no test.
- count over a choose oracle; choose in a forall — intervals with labels in aux; no test.
- recursion through count; count over derived predicates in rule bodies — tabling interplay; no test.
- multi-document facts; `in` over multi-element or param lists; params, extends, present/3, profiles,
  severity/weight/warning_threshold/rounds/request_shape — composition and aggregation; covered only
  by fixed witnesses (corpus-draft.yaml, present-candidates.yaml, policy-invariance.yaml) and
  checker-side tests.

Top gaps by risk: (1) local/anonymous/base-fact negation; (2) nested count and count in forall;
(3) count over choose and choose in forall; (4) recursion through count; (5) multi-document facts and
multi-element `in`. Closed or listed: see the generator commits that follow this record.
