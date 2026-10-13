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

## Outcome (2026-10-14)

Closed (generator commits d379f16, 79b445b; each with a coverage key and a trigger floor):
gap 1 (local, anonymous and base-fact negation, the sibling-shared form, and the refused forms
asserted as refusals), gap 2 (count in a forall; nested count generated as a refusal, since the
checker refuses it), gap 3 (count over a choose label; choose in a forall). Each was shown able to
fail: a `localNegationVars` break and a constant-label aux-sharing break each produced REFUTING
counterexamples on 150 programs.

The closed gaps found a real defect in the unmodified kernel: a count in a forall made its counted
variable and result binding values (unbound, interval-valued), giving empty demand and false
`unfounded` (58 of 60 counterexamples). Fixed in 58d5f8a (translator and checker) and a5e9eb3 (the
report's names), both through `forallBindingVars`; regression test with the minimal triple. Full
slow suite after: property 1500 programs refuting 0, seeds pass, clingo pass, 1065 s.

Listed, not closed: gap 4 (recursion and derived predicates inside count goals) and gap 5 (a second
document; multi-element `in`), with params, extends, present/3 and profiles still covered only by
fixed witnesses.
