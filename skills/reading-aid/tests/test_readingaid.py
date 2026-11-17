# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "typer>=0.15",
#     "pydantic>=2.9",
#     "jinja2>=3.1",
# ]
# ///
"""Tests for readingaid.py — run with: uv run tests/test_readingaid.py -v"""
import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path

TOOL = Path(__file__).resolve().parents[1] / "scripts" / "readingaid.py"
spec = importlib.util.spec_from_file_location("readingaid", TOOL)
ra = importlib.util.module_from_spec(spec)
sys.modules["readingaid"] = ra
spec.loader.exec_module(ra)

from typer.testing import CliRunner  # noqa: E402

runner = CliRunner()

MIN_TERMS = {
    "categories": [{"id": "general", "name": "一般词汇"}],
    "terms": [
        {"id": "heir", "word": "heir", "ipa": "/eə/", "zh": "继承人", "note": "h 不发音", "cat": "general"},
        {"id": "wail", "word": "wail", "ipa": "", "zh": "恸哭", "note": "", "cat": "general"},
    ],
}


def write_tmp(text, suffix):
    f = tempfile.NamedTemporaryFile("w", suffix=suffix, delete=False, encoding="utf-8")
    f.write(text)
    f.close()
    return f.name


class ParseTest(unittest.TestCase):
    def test_basic(self):
        dsl = "\n".join([
            "# a comment",
            "title: 测试",
            "source:出处行",
            "summary: 大意",
            "para: She {{wail|wails}} about the {{heir}}.",
            "trans: 她为继承人而恸哭。",
            "story-head: 背景",
            "story-para: 第一段。",
            "story-li: 甲",
            "story-li: 乙",
        ])
        doc, issues = ra.parse_dsl(dsl)
        self.assertEqual(issues, [])
        self.assertEqual(doc.title, "测试")
        self.assertEqual(doc.source, "出处行")
        self.assertEqual(len(doc.paras), 1)
        self.assertEqual(doc.paras[0].trans, "她为继承人而恸哭。")
        self.assertEqual([k for k, _, _ in doc.story], ["head", "para", "li", "li"])

    def test_unknown_directive(self):
        doc, issues = ra.parse_dsl("title: t\nbogus: x\n")
        self.assertEqual(issues[0][0], "error")
        self.assertEqual(issues[0][1], 2)
        self.assertIn("bogus", issues[0][2])

    def test_non_directive_line(self):
        _, issues = ra.parse_dsl("just some text\n")
        self.assertEqual(issues[0][0], "error")

    def test_trans_before_para(self):
        _, issues = ra.parse_dsl("title: t\ntrans: 先译\n")
        self.assertTrue(any(lv == "error" and "trans" in m for lv, _, m in issues))

    def test_double_trans(self):
        _, issues = ra.parse_dsl("title: t\npara: a\ntrans: 1\ntrans: 2\n")
        self.assertTrue(any("trans" in m and "row" in m for _, _, m in issues))


class RefTest(unittest.TestCase):
    def test_refs_and_display(self):
        refs, issues, tpl = ra.para_refs("the {{heir}} and {{wail|wails}} here")
        self.assertEqual(refs, [("heir", None), ("wail", "wails")])
        self.assertEqual(issues, [])
        self.assertNotIn("{{", tpl)

    def test_unterminated(self):
        _, issues, _ = ra.para_refs("broken {{heir ref")
        self.assertEqual(len(issues), 1)


class ValidateTest(unittest.TestCase):
    def load(self, dsl, terms_obj=MIN_TERMS):
        doc, issues = ra.parse_dsl(dsl)
        tf = write_tmp(json.dumps(terms_obj, ensure_ascii=False), ".json")
        terms, cats, t_issues = ra.load_terms(tf)
        return ra.validate_doc(doc, terms, cats) + t_issues + issues

    def test_ok(self):
        issues = self.load("title: t\npara: the {{heir}} {{wail}}s\ntrans: 译\n")
        self.assertEqual([i for i in issues if i[0] == "error"], [])

    def test_unknown_ref(self):
        issues = self.load("title: t\npara: the {{ghost}}\ntrans: 译\n")
        self.assertTrue(any(i[0] == "error" and "ghost" in i[2] and i[1] == 2 for i in issues))

    def test_missing_title_and_para(self):
        issues = self.load("")
        errs = [i[2] for i in issues if i[0] == "error"]
        self.assertTrue(any("title" in m for m in errs))
        self.assertTrue(any("para" in m for m in errs))

    def test_unreferenced_term_warning(self):
        issues = self.load("title: t\npara: the {{heir}}\ntrans: 译\n")
        self.assertTrue(any(i[0] == "warning" and "wail" in i[2] for i in issues))

    def test_dup_term_and_bad_cat(self):
        bad = {
            "categories": [{"id": "general", "name": "g"}],
            "terms": [
                {"id": "heir", "word": "heir", "zh": "继承人", "cat": "general"},
                {"id": "heir", "word": "heir", "zh": "继承人", "cat": "general"},
                {"id": "odd", "word": "odd", "zh": "怪", "cat": "nope"},
            ],
        }
        issues = self.load("title: t\npara: the {{heir}}\ntrans: 译\n", bad)
        errs = " | ".join(i[2] for i in issues if i[0] == "error")
        self.assertIn("duplicate", errs)
        self.assertIn("unknown category 'nope'", errs)

    def test_pydantic_field_errors(self):
        bad = {"terms": [{"id": "with space", "word": "w", "zh": "z"}]}
        issues = self.load("title: t\npara: x\ntrans: 译\n", bad)
        errs = " | ".join(i[2] for i in issues if i[0] == "error")
        self.assertIn("pattern", errs)  # pydantic rejects the malformed id

    def test_bad_json(self):
        tf = write_tmp("{not json", ".json")
        terms, cats, issues = ra.load_terms(tf)
        self.assertEqual(terms, {})
        self.assertEqual(issues[0][0], "error")


class RenderTest(unittest.TestCase):
    def render(self, dsl, terms_obj=MIN_TERMS, fragment=False):
        doc, _ = ra.parse_dsl(dsl)
        tf = write_tmp(json.dumps(terms_obj, ensure_ascii=False), ".json")
        terms, cats, _ = ra.load_terms(tf)
        return ra.render_page(doc, terms, cats, fragment=fragment)

    def test_standalone(self):
        out = self.render(
            "title: 标题 <b>注入</b>\npara: the {{heir}} {{wail|wails}}\ntrans: 译 <i>x</i>\n"
        )
        self.assertTrue(out.startswith("<!doctype html>"))
        self.assertIn("<title>标题 &lt;b&gt;注入&lt;/b&gt;</title>", out)
        self.assertIn('data-term="heir"', out)
        self.assertIn(">wails</button>", out)  # display text used
        self.assertIn("译 &lt;i&gt;x&lt;/i&gt;", out)  # translation escaped
        self.assertNotIn("{{", out)
        self.assertIn("ra-panel-gloss", out)
        self.assertIn("ra-panel-text", out)

    def test_fragment(self):
        out = self.render("title: t\npara: the {{heir}}\ntrans: 译\n", fragment=True)
        self.assertFalse(out.startswith("<!doctype"))
        self.assertIn('id="reading-aid"', out)
        self.assertIn('role="tablist"', out)
        self.assertNotIn("@@", out)  # no leftover tokens

    def test_no_story_tab_when_no_story(self):
        out = self.render("title: t\npara: the {{heir}}\ntrans: 译\n")
        self.assertNotIn("ra-panel-story", out)

    def test_story_list_grouping(self):
        dsl = "title: t\npara: the {{heir}}\ntrans: 译\nstory-head: H\nstory-li: a\nstory-li: b\nstory-para: p\n"
        out = self.render(dsl)
        self.assertIn("<ul><li>a</li><li>b</li></ul>", out.replace("\n", ""))

    def test_terms_json_injected_safely(self):
        out = self.render("title: t\npara: the {{heir}}\ntrans: 译\n")
        self.assertIn('"word"', out)
        # </ must be escaped inside the injected JSON so it cannot close the script tag
        self.assertNotIn('"zh": "继承人"}</script', out)


class CliTest(unittest.TestCase):
    def test_validate_ok(self):
        df = write_tmp("title: t\npara: the {{heir}}\ntrans: 译\n", ".dsl")
        tf = write_tmp(json.dumps(MIN_TERMS, ensure_ascii=False), ".json")
        res = runner.invoke(ra.app, ["validate", df, tf])
        self.assertEqual(res.exit_code, 0, res.output)

    def test_validate_missing_file(self):
        res = runner.invoke(ra.app, ["validate", "/nonexistent.dsl", "/nonexistent.json"])
        self.assertNotEqual(res.exit_code, 0)

    def test_render_writes_output(self):
        df = write_tmp("title: t\npara: the {{heir}}\ntrans: 译\n", ".dsl")
        tf = write_tmp(json.dumps(MIN_TERMS, ensure_ascii=False), ".json")
        with tempfile.TemporaryDirectory() as d:
            out = str(Path(d) / "o.html")
            res = runner.invoke(ra.app, ["render", df, tf, "-o", out])
            self.assertEqual(res.exit_code, 0, res.output)
            self.assertTrue(Path(out).read_text(encoding="utf-8").startswith("<!doctype"))

    def test_render_fails_on_validation_error(self):
        df = write_tmp("title: t\npara: the {{ghost}}\ntrans: 译\n", ".dsl")
        tf = write_tmp(json.dumps(MIN_TERMS, ensure_ascii=False), ".json")
        res = runner.invoke(ra.app, ["render", df, tf, "-o", "/tmp/should-not-exist-ra.html"])
        self.assertEqual(res.exit_code, 1)
        self.assertFalse(Path("/tmp/should-not-exist-ra.html").exists())


if __name__ == "__main__":
    unittest.main()
