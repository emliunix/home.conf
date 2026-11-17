#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "typer>=0.15",
#     "pydantic>=2.9",
#     "jinja2>=3.1",
# ]
# ///
"""readingaid — render an annotated bilingual reading-aid HTML page from a
DSL-marked passage plus a terms JSON.

Run with uv (dependencies are resolved and cached automatically; no
preinstalled environment or venv needed):

  uv run readingaid.py validate CONTENT.dsl TERMS.json
  uv run readingaid.py render CONTENT.dsl TERMS.json -o OUT.html [--fragment]

The default output is a self-contained standalone HTML page; --fragment emits
the inline fragment for hosts that already supply the design system
(e.g. the ZCode visualize surface).

DSL (line-oriented, one directive per line; '#' comment lines are ignored)
---------------------------------------------------------------------------
  title:      page title                                   (required)
  source:     small muted line under the title             (optional)
  summary:    one-sentence takeaway paragraph              (optional)
  tab-text:   label of the reading tab      (default 原文精读)
  tab-gloss:  label of the glossary tab     (default 词汇表)
  tab-story:  label of the story tab        (default 背景故事)
  trans-label: label prefix for translations (default 译文)

  para:       one paragraph of the source text
  trans:      translation attached to the most recent para (optional per para)
  story-head: section heading in the story tab
  story-para: paragraph in the story tab
  story-li:   list item; consecutive items are grouped into one <ul>

Inline term references inside para (and trans) text:
  {{term-id}}            uses the term's "word" as the visible text
  {{term-id|display}}    shows "display" instead

terms.json is validated against the pydantic schema in Term/TermsFile below.
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Annotated, Optional

import typer
from jinja2 import Environment
from markupsafe import Markup, escape
from pydantic import BaseModel, ConfigDict, Field, ValidationError

# ---------------------------------------------------------------------------
# Parsing (internal doc model — plain dataclasses; pydantic guards the
# external terms.json boundary below)

DIRECTIVES = {
    "title", "source", "summary",
    "tab-text", "tab-gloss", "tab-story", "trans-label",
    "para", "trans",
    "story-head", "story-para", "story-li",
}
META_KEYS = {
    "title": "title", "source": "source", "summary": "summary",
    "tab-text": "tab_text", "tab-gloss": "tab_gloss",
    "tab-story": "tab_story", "trans-label": "trans_label",
}

LINE_RE = re.compile(r"^\s*([a-z][a-z-]*):\s?(.*)$")
REF_RE = re.compile(r"\{\{\s*([A-Za-z0-9_-]+)\s*(?:\|\s*([^{}]*?)\s*)?\}\}")


@dataclass
class Para:
    en: str
    trans: str | None = None
    line: int = 0


@dataclass
class Doc:
    title: str | None = None
    source: str | None = None
    summary: str | None = None
    tab_text: str = "原文精读"
    tab_gloss: str = "词汇表"
    tab_story: str = "背景故事"
    trans_label: str = "译文"
    paras: list[Para] = field(default_factory=list)
    story: list[tuple[str, str, int]] = field(default_factory=list)  # (kind, text, line)


def parse_dsl(text: str) -> tuple[Doc, list[tuple[str, int, str]]]:
    """Return (doc, issues). issues is a list of (level, line_no, message)."""
    doc = Doc()
    issues: list[tuple[str, int, str]] = []

    for no, raw in enumerate(text.splitlines(), start=1):
        line = raw.rstrip()
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        m = LINE_RE.match(line)
        if not m:
            issues.append(("error", no, "not a directive line (expected 'name: value'); '#' lines are comments"))
            continue
        key, value = m.group(1), m.group(2).strip()

        if key in META_KEYS:
            attr = META_KEYS[key]
            current = getattr(doc, attr)
            if current is not None and current != Doc.__dataclass_fields__[attr].default:
                issues.append(("warning", no, f"'{key}:' set more than once; keeping the last value"))
            setattr(doc, attr, value)
        elif key == "para":
            doc.paras.append(Para(en=value, line=no))
        elif key == "trans":
            if not doc.paras:
                issues.append(("error", no, "'trans:' appears before any 'para:'"))
            elif doc.paras[-1].trans is not None:
                issues.append(("error", no, "two 'trans:' lines in a row for the same para"))
            else:
                doc.paras[-1].trans = value
        elif key in ("story-head", "story-para", "story-li"):
            doc.story.append((key.split("-", 1)[1], value, no))
        else:
            issues.append(("error", no, f"unknown directive '{key}:'"))

    return doc, issues


def para_refs(en: str) -> tuple[list[tuple[str, Optional[str]]], list[str], str]:
    """Return (refs [(id, display|None)], issues, template) where the template
    has each reference replaced by a \\x00 placeholder character."""
    refs: list[tuple[str, Optional[str]]] = []
    out: list[str] = []
    issues: list[str] = []
    pos = 0
    for m in REF_RE.finditer(en):
        refs.append((m.group(1), m.group(2)))
        out.append(en[pos:m.start()])
        out.append("\x00")
        pos = m.end()
    out.append(en[pos:])
    if "{{" in "".join(out):
        issues.append("unterminated '{{' reference (expected '{{id}}' or '{{id|display}}')")
    return refs, issues, "".join(out)


# ---------------------------------------------------------------------------
# terms.json (pydantic models define the accepted schema)

class Category(BaseModel):
    id: str
    name: str


class Term(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str = Field(pattern=r"^[A-Za-z0-9_-]+$")
    word: str = Field(min_length=1)
    zh: str = Field(min_length=1)
    ipa: str = ""
    note: str = ""
    cat: str = "main"
    tooltip: str = ""


class TermsFile(BaseModel):
    categories: list[Category] = Field(default_factory=list)
    terms: list[Term]


def load_terms(path: str | Path):
    """Return (terms_by_id, categories [(id, name)], issues)."""
    issues: list[tuple[str, int, str]] = []
    try:
        data = json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        return {}, [], [("error", 0, f"cannot read terms JSON: {e}")]

    try:
        parsed = TermsFile.model_validate(data)
    except ValidationError as e:
        for err in e.errors():
            loc = ".".join(str(part) for part in err["loc"]) or "(root)"
            issues.append(("error", 0, f"terms.json {loc}: {err['msg']}"))
        return {}, [], issues

    categories = [(c.id, c.name) for c in parsed.categories] or [("main", "词汇")]
    known_cats = {cid for cid, _ in categories}

    terms: dict[str, Term] = {}
    for t in parsed.terms:
        if t.id in terms:
            issues.append(("error", 0, f"duplicate term id '{t.id}'"))
            continue
        if t.cat not in known_cats:
            issues.append(("error", 0, f"term '{t.id}': unknown category '{t.cat}'"))
        terms[t.id] = t

    return terms, categories, issues


# ---------------------------------------------------------------------------
# Cross-validation

def validate_doc(doc: Doc, terms: dict[str, Term], categories: list[tuple[str, str]]):
    issues: list[tuple[str, int, str]] = []
    if not doc.title:
        issues.append(("error", 0, "'title:' is required"))
    if not doc.paras:
        issues.append(("error", 0, "at least one 'para:' is required"))

    used: set[str] = set()
    for p in doc.paras:
        refs, ref_issues, _ = para_refs(p.en)
        for msg in ref_issues:
            issues.append(("error", p.line, f"para: {msg}"))
        for tid, _display in refs:
            used.add(tid)
            if tid not in terms:
                issues.append(("error", p.line, f"para references unknown term '{tid}'"))
        if p.trans is None:
            issues.append(("warning", p.line, "para has no 'trans:' translation"))

    for tid in terms:
        if tid not in used:
            issues.append(("warning", 0, f"term '{tid}' is defined but never referenced in any para"))

    for cid, name in categories:
        if cid != "main" and not any(t.cat == cid for t in terms.values()):
            issues.append(("warning", 0, f"category '{cid}' ({name}) has no terms"))
    return issues


# ---------------------------------------------------------------------------
# Rendering (jinja2 with autoescape; Markup marks pre-escaped HTML)

SCOPED_CSS = """
#reading-aid .ra-term{
  background:transparent;border:none;padding:0 1px;margin:0;font:inherit;
  color:var(--accent);border-bottom:1px dotted var(--accent);border-radius:2px;
}
#reading-aid .ra-term:hover{background:var(--accent);color:var(--accent-foreground);}
#reading-aid .ra-term.is-selected{background:var(--accent);color:var(--accent-foreground);border-bottom-style:solid;}
#reading-aid .ra-cn{border-left:2px solid var(--border);padding:2px 0 2px 12px;margin:10px 0 24px 0;}
#reading-aid .ra-cn-label{color:var(--muted-foreground);}
#reading-aid .ra-term-card{margin:12px 0 16px 0;}
#reading-aid .ra-word{font-weight:500;}
#reading-aid .ra-zh{font-weight:500;}
#reading-aid .ra-note{display:block;margin-top:4px;color:var(--muted-foreground);}
#reading-aid .ra-story h3{margin-top:26px;}
#reading-aid .ra-story h3:first-child{margin-top:0;}
#reading-aid .ra-story ul{padding-left:22px;}
#reading-aid .ra-story li{margin:4px 0;}
#reading-aid .ra-headline{margin:10px 0 4px 0;}
"""

STANDALONE_CSS = """
:root{
  --background:#ffffff; --foreground:#1a1a1a;
  --card:#f7f7f8; --card-foreground:#1a1a1a;
  --muted:#f0f0f2; --muted-foreground:#6b6b70;
  --accent:#3b6ea5; --accent-foreground:#ffffff;
  --primary:#2f2f33; --primary-foreground:#ffffff;
  --border:#dcdce0;
}
@media (prefers-color-scheme: dark){
  :root{
    --background:#17171a; --foreground:#e8e8ea;
    --card:#202024; --card-foreground:#e8e8ea;
    --muted:#26262b; --muted-foreground:#9a9aa2;
    --accent:#6ea3dd; --accent-foreground:#10131a;
    --primary:#e8e8ea; --primary-foreground:#17171a;
    --border:#34343a;
  }
}
body{
  background:var(--background);color:var(--foreground);
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif;
  line-height:1.65;max-width:900px;margin:0 auto;padding:28px 22px 60px;
}
h1{font-size:1.35em;font-weight:500;margin:0 0 6px;}
h3{font-weight:500;}
p{margin:10px 0;}
.card{background:var(--card);color:var(--card-foreground);border:1px solid var(--border);border-radius:10px;padding:14px 16px;}
.text-small{font-size:12px;}
.text-muted{color:var(--muted-foreground);}
.text-nowrap{white-space:nowrap;}
.table{width:100%;border-collapse:collapse;}
.table th,.table td{padding:8px 10px;text-align:left;vertical-align:top;border-bottom:1px solid var(--border);}
.table th{font-weight:500;color:var(--muted-foreground);}
.table-responsive{overflow-x:auto;}
.cursor-interaction{cursor:pointer;}
.nav{display:flex;gap:8px;flex-wrap:wrap;margin:14px 0;}
.nav-link{border:1px solid var(--border);background:transparent;color:var(--muted-foreground);padding:5px 14px;border-radius:999px;font:inherit;cursor:pointer;}
.nav-link.active{background:var(--primary);color:var(--primary-foreground);border-color:transparent;}
button{font:inherit;}
#reading-aid .ra-term[data-tooltip]{position:relative;}
#reading-aid .ra-term[data-tooltip]:hover::after{
  content:attr(data-tooltip);
  position:absolute;left:50%;bottom:calc(100% + 6px);transform:translateX(-50%);
  background:var(--card);color:var(--card-foreground);border:1px solid var(--border);
  border-radius:6px;padding:3px 8px;font-size:12px;white-space:nowrap;z-index:10;
}
"""

SCRIPT = """
(function () {
  var root = document.getElementById('reading-aid');
  if (!root) return;
  var TERMS = @@TERMS_JSON@@;
  var wordEl = document.getElementById('ra-term-word');
  var ipaEl = document.getElementById('ra-term-ipa');
  var defEl = document.getElementById('ra-term-def');
  if (!wordEl || !defEl) return;
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function select(btn, save) {
    var id = btn.getAttribute('data-term');
    var t = TERMS[id];
    if (!t) return;
    var prev = root.querySelectorAll('.ra-term.is-selected');
    for (var i = 0; i < prev.length; i++) prev[i].classList.remove('is-selected');
    btn.classList.add('is-selected');
    wordEl.textContent = t.word;
    ipaEl.textContent = t.ipa || '';
    defEl.innerHTML = '<span class="ra-zh">' + esc(t.zh) + '</span>' +
      (t.note ? '<span class="ra-note">' + esc(t.note) + '</span>' : '');
    if (save) {
      try {
        if (window.zcode && window.zcode.setWidgetState) {
          window.zcode.setWidgetState({ privateContent: { term: id } }).catch(function () {});
        }
      } catch (e) {}
    }
  }
  root.addEventListener('click', function (e) {
    var b = e.target && e.target.closest ? e.target.closest('.ra-term') : null;
    if (!b || !root.contains(b)) return;
    select(b, true);
  });
  function restore(state) {
    try {
      var pc = state && (state.privateContent || state);
      var id = pc && pc.term;
      if (!id) return;
      var btn = root.querySelector('.ra-term[data-term="' + id + '"]');
      if (btn) select(btn, false);
    } catch (e) {}
  }
  try {
    if (window.zcode && window.zcode.widgetState) restore(window.zcode.widgetState);
  } catch (e) {}
  window.addEventListener('zcode:set_globals', function (e) {
    var g = e.detail && e.detail.globals && e.detail.globals.widgetState;
    if (g) restore(g);
  });
})();
"""

TABS_JS = """
(function () {
  document.querySelectorAll('.nav-link[role="tab"]').forEach(function (tab) {
    tab.addEventListener('click', function () {
      var list = tab.closest('[role=tablist]');
      list.querySelectorAll('.nav-link').forEach(function (t) {
        var on = t === tab;
        t.classList.toggle('active', on);
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        var panel = document.getElementById(t.getAttribute('aria-controls'));
        if (panel) panel.hidden = !on;
      });
    });
  });
})();
"""

BODY_TEMPLATE = """<div id="reading-aid">
<style>{{ scoped_css }}</style>
<h1>{{ doc.title or "" }}</h1>
{% if doc.source %}<p class="text-small text-muted">{{ doc.source }}</p>
{% endif %}{% if doc.summary %}<p class="ra-headline">{{ doc.summary }}</p>
{% endif %}<div class="nav nav-pills" role="tablist" aria-label="阅读辅助分页">
  <button class="nav-link active" id="ra-tab-text" role="tab" aria-controls="ra-panel-text" aria-selected="true" type="button">{{ doc.tab_text }}</button>
{%- if has_gloss %}
  <button class="nav-link" id="ra-tab-gloss" role="tab" aria-controls="ra-panel-gloss" aria-selected="false" type="button">{{ doc.tab_gloss }}</button>
{%- endif %}{% if has_story %}
  <button class="nav-link" id="ra-tab-story" role="tab" aria-controls="ra-panel-story" aria-selected="false" type="button">{{ doc.tab_story }}</button>
{% endif %}</div>
<div id="ra-panel-text" role="tabpanel" aria-labelledby="ra-tab-text">
{% if has_gloss %}  <div class="card ra-term-card">
    <div><span class="ra-word" id="ra-term-word">点击原文中的高亮词汇</span> <span class="text-small text-muted" id="ra-term-ipa"></span></div>
    <div id="ra-term-def" aria-live="polite" class="ra-note" style="margin-top:6px;">这里会显示该词的中文释义与文中的用法说明。</div>
  </div>
  <p class="text-small text-muted">带虚线下划线的词可点击查看释义（悬停也有简短提示）；每段英文下方附{{ doc.trans_label }}。</p>
{% endif %}{% for p in paras %}
  <div class="ra-para">
    <p class="ra-en">{{ p.en }}</p>
{% if p.trans is not none %}    <div class="ra-cn"><span class="text-small ra-cn-label">{{ doc.trans_label }}</span><br>{{ p.trans }}</div>
{% endif %}  </div>
{% endfor %}</div>
{% if has_gloss %}<div id="ra-panel-gloss" role="tabpanel" aria-labelledby="ra-tab-gloss" hidden>
  <p class="text-small text-muted">按类别分组；点击“{{ doc.tab_text }}”里的对应词可看完整说明。</p>
{% for cat in gloss %}  <h3>{{ cat.name }}</h3>
  <div class="table-responsive"><table class="table">
    <thead><tr><th>词汇</th><th>释义与说明</th></tr></thead>
    <tbody>
{%- for t in cat.rows %}      <tr><td><span class="text-nowrap">{{ t.word }}</span>{% if t.ipa %}
      <br><span class="text-small text-muted">{{ t.ipa }}</span>{% endif %}</td><td><span class="ra-zh">{{ t.zh }}</span>{% if t.note %}
      <br><span class="text-small text-muted">{{ t.note }}</span>{% endif %}</td></tr>
{%- endfor %}    </tbody>
  </table></div>
{% endfor %}</div>
{% endif %}{% if has_story %}<div id="ra-panel-story" role="tabpanel" aria-labelledby="ra-tab-story" hidden class="ra-story">
{% for b in story_blocks %}{% if b.kind == "ul" %}<ul>{% for li in b.entries %}<li>{{ li }}</li>{% endfor %}</ul>{% elif b.kind == "head" %}<h3>{{ b.text }}</h3>{% else %}<p>{{ b.text }}</p>{% endif %}{% endfor %}</div>
{% endif %}{{ scripts }}
</div>
"""

PAGE_TEMPLATE = """<!doctype html>
<html lang="zh">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{{ title }}</title>
<style>{{ css }}</style>
</head>
<body>
{{ body }}
</body>
</html>
"""

_env = Environment(autoescape=True, trim_blocks=True, lstrip_blocks=True)


def _render_inline(text: str, terms: dict[str, Term]) -> Markup:
    """Escape text and turn {{id}} / {{id|display}} refs into term buttons."""
    refs, _issues, template = para_refs(text)
    out: list[str] = []
    buf: list[str] = []
    ref_iter = iter(refs)
    for ch in template:
        if ch == "\x00":
            out.append(str(escape("".join(buf))))
            buf.clear()
            tid, display = next(ref_iter)
            t = terms.get(tid)
            word = display or (t.word if t else tid)
            tooltip = (t.tooltip if t and t.tooltip else f"{t.word} {t.zh}" if t else "").strip()
            out.append(
                '<button type="button" class="ra-term cursor-interaction" '
                f'data-term="{escape(tid)}" data-tooltip="{escape(tooltip)}">{escape(word)}</button>'
            )
        else:
            buf.append(ch)
    out.append(str(escape("".join(buf))))
    return Markup("".join(out))


def _story_blocks(doc: Doc) -> list[dict]:
    blocks: list[dict] = []
    for kind, text, _line in doc.story:
        if kind == "li" and blocks and blocks[-1]["kind"] == "ul":
            blocks[-1]["entries"].append(text)
        elif kind == "li":
            blocks.append({"kind": "ul", "entries": [text]})
        else:
            blocks.append({"kind": kind, "text": text})
    return blocks


def render_page(doc: Doc, terms: dict[str, Term], categories: list[tuple[str, str]],
                fragment: bool = False) -> str:
    has_gloss = bool(terms)
    has_story = bool(doc.story)

    paras = [
        {"en": _render_inline(p.en, terms),
         "trans": _render_inline(p.trans, terms) if p.trans is not None else None}
        for p in doc.paras
    ]
    gloss = [
        {"name": name, "rows": [t for t in terms.values() if t.cat == cid]}
        for cid, name in categories
        if any(t.cat == cid for t in terms.values())
    ]

    terms_js = {tid: {"word": t.word, "ipa": t.ipa, "zh": t.zh, "note": t.note}
                for tid, t in terms.items()}
    terms_json = json.dumps(terms_js, ensure_ascii=False).replace("</", "<\\/")
    scripts = Markup("<script>" + SCRIPT.replace("@@TERMS_JSON@@", terms_json) + "</script>"
                     + ("" if fragment else "\n<script>" + TABS_JS + "</script>"))

    body = _env.from_string(BODY_TEMPLATE).render(
        doc=doc, paras=paras, gloss=gloss, story_blocks=_story_blocks(doc),
        has_gloss=has_gloss, has_story=has_story,
        scoped_css=Markup(SCOPED_CSS), scripts=scripts,
    )
    if fragment:
        return body
    return _env.from_string(PAGE_TEMPLATE).render(
        title=doc.title or "Reading Aid",
        css=Markup(STANDALONE_CSS + SCOPED_CSS),
        body=Markup(body),
    )


# ---------------------------------------------------------------------------
# CLI (typer)

app = typer.Typer(add_completion=False, no_args_is_help=True,
                  help="Render an annotated bilingual reading-aid page from a DSL file plus terms JSON.")


def _report(issues: list[tuple[str, int, str]]) -> None:
    for level, line, msg in issues:
        where = f"content.dsl:{line}" if line else "input"
        typer.secho(f"[{level}] {where}: {msg}",
                    fg=typer.colors.RED if level == "error" else typer.colors.YELLOW,
                    err=True)


def _load_and_check(content: Path, terms: Path):
    doc, issues = parse_dsl(content.read_text(encoding="utf-8"))
    terms_by_id, categories, t_issues = load_terms(terms)
    issues = t_issues + issues + validate_doc(doc, terms_by_id, categories)
    errors = [i for i in issues if i[0] == "error"]
    return doc, terms_by_id, categories, issues, errors


@app.command()
def validate(
    content: Annotated[Path, typer.Argument(exists=True, readable=True, help="path to content.dsl")],
    terms: Annotated[Path, typer.Argument(exists=True, readable=True, help="path to terms.json")],
) -> None:
    """Check both inputs; exit 1 on any error (warnings still exit 0)."""
    _, _, _, issues, errors = _load_and_check(content, terms)
    _report(issues)
    if errors:
        typer.secho(f"FAIL: {len(errors)} error(s), {len(issues) - len(errors)} warning(s)",
                    fg=typer.colors.RED, err=True)
        raise typer.Exit(1)
    msg = f"OK: valid ({len(issues)} warning(s))" if issues else "OK: valid"
    typer.secho(msg, fg=typer.colors.GREEN, err=True)


@app.command()
def render(
    content: Annotated[Path, typer.Argument(exists=True, readable=True, help="path to content.dsl")],
    terms: Annotated[Path, typer.Argument(exists=True, readable=True, help="path to terms.json")],
    out: Annotated[Path, typer.Option("--out", "-o", help="output .html path")],
    fragment: Annotated[bool, typer.Option("--fragment", help="emit the inline fragment instead of a standalone page")] = False,
) -> None:
    """Validate, then render HTML."""
    doc, terms_by_id, categories, issues, errors = _load_and_check(content, terms)
    if errors:
        _report(issues)
        typer.secho(f"render aborted: {len(errors)} validation error(s)",
                    fg=typer.colors.RED, err=True)
        raise typer.Exit(1)
    _report(issues)
    html = render_page(doc, terms_by_id, categories, fragment=fragment)
    try:
        out.write_text(html, encoding="utf-8")
    except OSError as e:
        typer.secho(f"error: cannot write {out}: {e}", fg=typer.colors.RED, err=True)
        raise typer.Exit(2) from None
    typer.secho(f"wrote {out} ({len(html.encode('utf-8'))} bytes)", err=True)


if __name__ == "__main__":
    app()
