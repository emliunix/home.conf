# language — verification

| Property | Check (deciding test) | Limit |
|---|---|---|
| P-language-01 | `doc-verify/tests/language/modules-check.test.ts` | unit; extends, library resolution, unknown-library refusal |
| P-language-02 | `doc-verify/tests/language/language.test.ts` | unit; in-process fixtures |
| P-language-03 | `doc-verify/tests/language/evaluate.test.ts`, `doc-verify/tests/language/engine-golden.test.ts` | unit; the golden path runs bounded rounds against the kernel and explains its one violation |

The kernel's own gates (`docs/doc-verify-model.md` §9) are its module's properties, not this one's.
