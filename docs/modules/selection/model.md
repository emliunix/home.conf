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

## Affected set

A run's **changed files** are the diff between baseline and candidate; a rename is its deleted
path and its added path. The **affected set** is the documents whose verdict a changed file can
change: what references the changed files, not what they reference. A document references a
file when it links it (a link, its companion, its modules) or when its check reads it. A check's
reads are recorded by running its fact extraction against each snapshot's tree: a path's
existence or text, the count of a file name, the files directly in a directory beginning with a
prefix. A changed file affects a document when it is a path the document read, or when it
changes an answer the document's check received: a directory's existence, a count read as none,
one or several, or the one match itself. The set is closed: a document referencing an affected
document is affected. A changed file under `invalidation_patterns` affects every document.
