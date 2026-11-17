---
name: reading-aid
description: Turn a difficult English (or other-language) passage into an interactive annotated reading-aid page — click-to-explain vocabulary, per-paragraph translations, a grouped glossary, and background-story sections. Use when the user supplies a hard text to read and wants word annotations and context, or asks to regenerate/extend an existing reading-aid page.
---

# Reading Aid

Convert **source text + terms JSON** into a self-contained bilingual reading-aid HTML page with three tabs:
reading (原文精读， clickable terms + per-paragraph translation), glossary (词汇表， grouped tables), and
background stories (背景故事， free-form sections). Runs via [uv](https://docs.astral.sh/uv/) with inline
script metadata (PEP 723) — no preinstalled environment needed; deps (typer, pydantic, jinja2) are
resolved and cached on first run. Requires Python ≥ 3.10.

## Workflow

1. Read the passage. Decide which words/phrases need explanation: hard vocabulary, idioms, technical
   terms, names, works, places. Group them into 2–4 categories (e.g. 核心术语 / 一般词汇 / 人名与作品).
2. Write `terms.json` — one entry per term (schema below; validated by the pydantic model `Term`).
   Keep `zh` a short gloss; put the in-context nuance in `note`. IPA optional but helpful for hard words.
3. Write `content.dsl` — paste the passage as `para:` lines, wrapping each annotated word in
   `{{term-id|display}}`; add `trans:` under each paragraph, then `story-*:` blocks for background.
4. Validate, then render:

```bash
SKILL="$HOME/.agents/skills/reading-aid"
uv run "$SKILL/scripts/readingaid.py" validate content.dsl terms.json
uv run "$SKILL/scripts/readingaid.py" render   content.dsl terms.json -o out.html
```

`render` validates first and refuses to write on any error. Add `--fragment` to emit the inline
fragment instead of a standalone page — use that inside ZCode together with the visualize skill
(the host supplies the design system); the default standalone page is for browsers.

## content.dsl reference

Line-oriented; one directive per line; `#` lines are comments. All text is HTML-escaped by the
renderer — never hand-write HTML in values. Every directive value must fit on one line.

| Directive | Meaning | Default / notes |
|---|---|---|
| `title:` | page title | required |
| `source:` | muted line under the title (出处) | optional |
| `summary:` | one-sentence takeaway paragraph | optional |
| `tab-text:` / `tab-gloss:` / `tab-story:` | tab labels | 原文精读 / 词汇表 / 背景故事 |
| `trans-label:` | translation label prefix | 译文 |
| `para:` | one paragraph of the source text | required ≥1 |
| `trans:` | translation of the most recent `para:` | optional but warned if missing |
| `story-head:` | section heading in the story tab | |
| `story-para:` | paragraph in the story tab | |
| `story-li:` | list item; consecutive items group into one `<ul>` | |

Inline term references, allowed in `para:` and `trans:` text:

```
{{heir}}           -> button showing the term's "word"
{{wail|wails}}     -> button showing custom display text (keep the original wording)
```

## terms.json schema

```json
{
  "categories": [
    { "id": "logic",   "name": "核心逻辑与数学术语" },
    { "id": "general", "name": "一般英语词汇与表达" },
    { "id": "names",   "name": "人名 · 作品 · 地名" }
  ],
  "terms": [
    { "id": "heir", "word": "heir", "ipa": "/eə(r)/",
      "zh": "继承人", "note": "注意 h 不发音。", "cat": "general",
      "tooltip": "heir 继承人" }
  ]
}
```

- `id`: `[A-Za-z0-9_-]+`, unique — this is what `{{...}}` refers to.
- `word`, `zh`: required. `ipa`, `note`, `tooltip` optional (`tooltip` defaults to `<word> <zh>`).
- `cat` must be a declared category id; omit `categories` to put everything in one default group.

## Validation rules

Errors (exit 1): missing `title:` or `para:`; unknown directive line; `trans:` before any `para:` or
twice in a row; unterminated `{{`; `{{id}}` referencing an undefined term; duplicate term ids; term
missing `word`/`zh`; unknown category; malformed JSON.
Warnings: para without translation; term never referenced; empty category; duplicate meta directive.

## Example

A complete worked example — Wadler's "Propositions as Types" §4 on intuitionistic logic — lives in
[`examples/intuitionistic-logic/`](examples/intuitionistic-logic/):
`content.dsl`, `terms.json` (45 terms, 3 categories), and the generated `rendered.html`.
Regenerate it with:

```bash
cd "$SKILL/examples/intuitionistic-logic"
uv run ../../scripts/readingaid.py render content.dsl terms.json -o rendered.html
```

Tests: `uv run "$SKILL/tests/test_readingaid.py" -v` (23 tests).

## Quality bar for generated content

- Translate faithfully and completely; keep the author's tone (note jokes, not just words).
- Glossary `zh` ≤ ~8 characters where possible; explain usage in `note`.
- Story tab should cover: where the text is from, any proper names/plots it alludes to,
  and the background needed to understand the passage's point — in the user's language.
- Do not annotate every word: mark what a fluent reader would still stumble on.
