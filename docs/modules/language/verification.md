# language — verification

| Property | Check (deciding test) | Limit |
|---|---|---|
| P-language-01 | `tests/modules-check.test.ts` | in-process; extends, library resolution, unknown-library refusal |
| P-language-02 | `tests/language.test.ts` | in-process fixtures |
| P-language-03 | `tests/evaluate.test.ts` | in-process; the two bounds |
| P-language-04 | `tests/diagnostics.test.ts` | in-process; the precedence table |

The engine golden path (`tests/engine-golden.test.ts`) composes the two together: it classifies
through two bounded rounds and explains the one violation, and is the deciding test for the
composition of facts, evaluation and diagnostics.
