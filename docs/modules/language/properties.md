# language — properties

| Id | Property | Statement |
|---|---|---|
| P-language-01 | module composition | `extends` composes parents in order; a name defined twice is refused; `doc-verify:NAME` resolves a shipped library and an unknown one is refused, naming the ones the engine ships |
| P-language-02 | facts | the section tree and its relations are derived from headings, not reconstructed from byte spans |
| P-language-03 | runs decide by the model | a run's statuses, demand and verdict are the model's; an unanswered oracle leaves its binding undetermined, and a violated require yields its missing goal literal |
