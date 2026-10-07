# oracles — properties

| Id | Property | Statement |
|---|---|---|
| P-oracles-01 | keying | one ground atom is one question; its canonical key names both its evidence entry and its instruction, so an answer binds by construction |
| P-oracles-02 | threshold | the argmax label holds only at `p >= threshold`; a missing, misaligned or tied distribution is unknown with a finding |
| P-oracles-03 | cache | a repeated atom is answered from the cache; a follow-up is cached like an atom; `--no-cache` neither reads nor writes |
| P-oracles-04 | deciding span | a non-passing atom carries the judge-chosen sentence (a whole sentence), or the section span labelled not judged |
| P-oracles-05 | outbound policy | an over-budget batch or a prohibited literal is BLOCKED / NO-GO, and evidence is never truncated |
