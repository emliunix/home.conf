# selection — model

## Concepts

A **rule** is a `pattern` plus an `artifact_kind` and a default `modules` list; an optional
`types` map names alternative module sets a companion may select. A **companion** is the
`X.yaml` beside a document; its `document` block names the path, the kind, and optionally a
status and a type. A **document** is a Markdown file a rule matches. A **section** is an
ATX-heading subtree with an id, a depth, and byte and line spans. A **snapshot** is the set of
tracked files at one revision; the **candidate** is the source a run verifies, and the
**baseline** is what its links are checked against.

## Selection

The selector rules are ordered and last-match-wins, so each document has one rule. A companion's
`document.type`, when present, must name one of its rule's `types`; that type's modules replace
the rule's default modules. A companion with no `type` keeps the default. An unknown type is
refused, naming the declared ones.
