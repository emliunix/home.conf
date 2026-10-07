"""Rule-quality harness (task #9, design 10 "Verify the verifier").

For every constraint in doc-verify/modules:
  (a) a seeded mutation of a real document MUST flip exactly that constraint (hit);
      collateral firings are recorded (a mutation that trips many constraints is fine,
      a constraint nothing flips is toothless);
  (b) good documents from OTHER projects (held-out corpus) MUST NOT trip the semantic
      (oracle-backed) constraints — false alarms mean the rule is overfit to visflow.
      Structural constraints (heading names, status placement) are exempt by design:
      those are visflow conventions. Each held-out firing is classified from the module
      definition as structural-exempt, semantic-violated or semantic-undetermined, and
      the report quotes those counts;
  (c) judge stability: oracle-bearing documents run N times; verdict flips are reported.

Held-out corpora are pinned (repo URL + commit) and cloned on demand; a missing or
uncloneable corpus is an error, never a silent skip. By default only home.conf runs
and lands in the committed record; agent-substrate is opt-in (--with-agent-substrate)
pending the owner's scope ruling.

Run:  python3 tools/rule_quality/run.py [--stability-runs 3] [--only mutations|heldout|stability|report]
      [--with-agent-substrate] [--corpus-cache DIR]
Needs: .env.doc-verify (judge key) at the repo root; node/npm on PATH.
Writes: worklog/evidence/rule-quality/report.md (+ raw run logs beside it).
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent.parent
MODULES = REPO / "doc-verify" / "modules"
ENGINE_PKG = "github:emliunix/home.conf#a8527868bef6e69a0948380cc20d4cebc064c654"
EVIDENCE = REPO / "worklog/evidence/rule-quality"

CORPORA = {
    "homeconf": {
        "url": "https://github.com/emliunix/home.conf",
        "commit": "538dac3966aa4e8cd19609fc0c33e0bc9e655b0c",  # main at harness time
        "roots": ["design/*.md", "goals/*.md"],
        "default": True,
    },
    # Extra local corpora are scratch work (owner ruling 2026-10-01): pass
    # --corpus NAME=PATH (a git clone); nothing about them is committed except
    # the aggregate this harness records from the run.
}

# A constraint is semantic iff its require/forbid calls an oracle directly or through a
# rule chain, across ALL composed modules (rules may reference another module's oracle,
# e.g. design's sections classify via artifact's purpose oracle).
SEMANTIC_CONSTRAINTS: dict[str, set[str]] = {}


def _index_modules() -> None:
    oracles: set[str] = set()
    rule_defs: dict[str, str] = {}
    constraint_chunks: list[tuple[str, str]] = []
    for path in sorted(MODULES.glob("*.yaml")):
        text = path.read_text()
        if "oracles:" in text:
            oracles |= set(re.findall(r"^  ([a-z_][a-z0-9_]*)\(D", text.split("oracles:", 1)[1].split("\nrules:", 1)[0], re.M))
        if "\nrules:" in text:
            rules_block = text.split("\nrules:", 1)[1].split("\nconstraints:", 1)[0]
            rule_defs.update(re.findall(r"^  ([a-z_][a-z0-9_]*)\(.*?\):\s*(.*)$", rules_block, re.M))
        if "constraints:" in text:
            for chunk in re.split(r"^  (?=[a-z0-9-]+:)", text.split("constraints:", 1)[1], flags=re.M):
                m = re.match(r"([a-z0-9-]+):", chunk)
                if m:
                    body = "\n".join(l for l in chunk.splitlines() if l.strip().startswith(("require:", "forbid:")))
                    constraint_chunks.append((m.group(1), body))

    def closure(preds: set[str]) -> set[str]:
        seen, done = set(preds), set()
        while True:
            frontier = [p for p in seen if p in rule_defs and p not in done]
            if not frontier:
                return {p for p in seen if p in oracles}
            for p in frontier:
                done.add(p)
                seen |= set(re.findall(r"([a-z_][a-z0-9_]*)\(", rule_defs[p]))

    for name, body in constraint_chunks:
        called = closure(set(re.findall(r"([a-z_][a-z0-9_]*)\(", body)))
        if called:
            SEMANTIC_CONSTRAINTS.setdefault(name, set()).update(called)


_index_modules()


def classify(constraint: str, verdict: str) -> str:
    semantic = bool(SEMANTIC_CONSTRAINTS.get(constraint))
    if verdict == "NO-GO":
        return "semantic-violated" if semantic else "structural-exempt"
    return "semantic-undetermined" if semantic else "structural-exempt"


MODULE_LINE = re.compile(
    r"^(?P<path>\S+):\d+ \[(?P<section>[^\]]+)\] module\.(?P<constraint>[a-z0-9-]+) "
    r"(?P<verdict>NO-GO|WARN|NEEDS-REVIEW) (?:violated|undetermined)", re.M)


def doc_config_yaml(kind: str) -> str:
    modules = {
        "design": "docmods/artifact.yaml, docmods/design.yaml",
        "goal": "docmods/artifact.yaml, docmods/goal.yaml",
        "constitution": "docmods/spine.yaml",
    }[kind]
    status_from = "\n    status_from: title" if kind == "goal" else ""
    return (
        "schema_version: 1\nkind: document-verification\ndocuments:\n"
        f"  - pattern: doc.md\n    artifact_kind: {kind}\n    modules: [{modules}]{status_from}\n"
        "    required_sections: []\n"
        "judge:\n  kind: jev\n  model: jev-1.13.0\n"
        "  client_sha256: ce983f8de97d5b30d527a7116f0c49ad3d17e098d2c3f17c9600041260c65dcb\n"
        "  attestation_max_age_seconds: 86400\n"
        "policy:\n  kind: semantic-boundary\n  version: 1\n  max_evidence_bytes: 36000\n  forbidden_literals: []\n")


def stage(tree: Path, kind: str, text: str, companion_kind: str | None = None) -> None:
    shutil.copytree(MODULES, tree / "docmods")
    strat = tree / "strategies"
    strat.mkdir()
    shutil.copy(REPO / "doc-verify/contracts/design-strategy.yaml", strat / "kind-strategy.yaml")
    (tree / ".doc-verify.yaml").write_text(doc_config_yaml(kind))
    (tree / "doc.md").write_text(text)
    if companion_kind:
        (tree / "doc.yaml").write_text(
            "schema_version: 1\nkind: document-contract\ndocument:\n  path: doc.md\n"
            f"  kind: {companion_kind}\nverification:\n  kind: jev-prolog\n"
            "  inherits: strategies/kind-strategy.yaml#verification\n")
    subprocess.run(["git", "init", "-q", "."], cwd=tree, check=True)
    subprocess.run(["git", "add", "-A"], cwd=tree, check=True)
    subprocess.run(["git", "-c", "user.email=h@x", "-c", "user.name=h", "commit", "-qm", "init"], cwd=tree, check=True)
    (tree / ".env.doc-verify").symlink_to(Path.home() / ".config/doc-verify/credentials.env")


def run_check(tree: Path) -> tuple[int, list[dict], str, str]:
    proc = subprocess.run(
        ["npm", "exec", "--yes", f"--package={ENGINE_PKG}", "--", "doc-verify", "check", "--all"],
        cwd=tree, capture_output=True, text=True, timeout=900)
    out = proc.stdout + proc.stderr
    findings = [{"constraint": m.group("constraint"), "verdict": m.group("verdict"),
                 "classification": classify(m.group("constraint"), m.group("verdict")),
                 "section": m.group("section")} for m in MODULE_LINE.finditer(out)]
    summary = next(iter(re.findall(r"^(PASS|NO-GO|BLOCKED): (.*)$", out, re.M)), ("?", ""))
    return proc.returncode, findings, out, summary


# ---------------------------------------------------------------- mutations
sys.path.insert(0, str(Path(__file__).parent))
import mutations as M  # noqa: E402


def run_mutations(base_texts: dict, record: list) -> None:
    for case in M.CASES:
        kind = case["kind"]
        text = base_texts[case["base"]]
        try:
            mutated = case["mutate"](text)
        except Exception as exc:  # a mutation that cannot apply is a harness bug, not a pass
            record.append({"case": case["name"], "error": f"mutation not applicable: {exc}"})
            continue
        with tempfile.TemporaryDirectory(prefix="rq-mut-") as tmp:
            tree = Path(tmp)
            stage(tree, kind, mutated, companion_kind=kind)
            rc, findings, out, summary = run_check(tree)
            fired = sorted({f["constraint"] for f in findings})
            record.append({"case": case["name"], "kind": kind, "expect": case["expect"],
                           "hit": case["expect"] in fired, "collateral": [c for c in fired if c != case["expect"]],
                           "fired": fired, "summary": summary, "returncode": rc})
            EVIDENCE.mkdir(parents=True, exist_ok=True)
            (EVIDENCE / f"mutation-{case['name']}.log").write_text(out)


def corpus_checkout(name: str, cache: Path) -> tuple[Path, str]:
    spec = CORPORA[name]
    target = cache / name
    if not target.exists():
        target.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(["git", "clone", "-q", spec["url"], str(target)], check=True)
    commit = spec["commit"] or subprocess.run(["git", "-C", str(target), "rev-parse", "HEAD"],
                                              capture_output=True, text=True, check=True).stdout.strip()
    subprocess.run(["git", "-C", str(target), "checkout", "-q", commit], check=True)
    return target, commit


def run_heldout(record: list, cache: Path, extra_corpora: dict[str, Path], cap: int = 8,
                scratch: Path = Path("/tmp/rule-quality-scratch")) -> None:
    """Per-document held-out rows and raw logs are scratch evidence (owner ruling
    2026-10-01: other projects' documents stay out of the visflow repo); only the
    per-corpus aggregate is committed to the record and report."""
    corpora = dict(CORPORA)
    for name, path in extra_corpora.items():
        if not path.exists():
            raise RuntimeError(f"extra corpus {name} not found at {path}; refusing to skip silently")
        corpora[name] = {"local": path, "roots": ["design/*.md", "goals/*.md"], "default": True}
    aggregate: dict[str, dict] = {}
    for name, spec in corpora.items():
        if not spec.get("default"):
            continue
        if "local" in spec:
            root, commit = spec["local"], subprocess.run(
                ["git", "-C", str(spec["local"]), "rev-parse", "HEAD"],
                capture_output=True, text=True, check=True).stdout.strip()
        else:
            root, commit = corpus_checkout(name, cache)
        docs: list[Path] = []
        for pattern in spec["roots"]:
            docs += sorted(root.glob(pattern))[:cap]
        if not docs:
            raise RuntimeError(f"held-out corpus {name} at {commit} matched no documents; refusing to skip silently")
        for doc in docs:
            kind = "goal" if doc.parent.name == "goals" else "design"
            with tempfile.TemporaryDirectory(prefix="rq-ho-") as tmp:
                tree = Path(tmp)
                stage(tree, kind, doc.read_text(), companion_kind=kind)
                try:
                    rc, findings, out, summary = run_check(tree)
                except subprocess.TimeoutExpired:
                    record.append({"case": f"heldout:{name}:{doc.parent.name}/{doc.name}", "error": "timeout"})
                    continue
                scratch.mkdir(parents=True, exist_ok=True)
                (scratch / f"heldout-{name}-{doc.stem}.log").write_text(out)
                aggregate.setdefault(name, {"corpus_commit": commit, "documents": 0,
                                            "counts": {}, "semantic_violated": []})
                agg = aggregate[name]
                agg["documents"] += 1
                for f in findings:
                    agg["counts"][f["classification"]] = agg["counts"].get(f["classification"], 0) + 1
                    if f["classification"] == "semantic-violated":
                        agg["semantic_violated"].append(f["constraint"])


    for name, agg in aggregate.items():
        record.append({"case": f"heldout-aggregate:{name}", **agg})


def run_stability(base_texts: dict, record: list, runs: int) -> None:
    for name in base_texts:
        kind = "design" if name.startswith("design/") else "constitution"
        verdicts_per_run = []
        for i in range(runs):
            with tempfile.TemporaryDirectory(prefix="rq-st-") as tmp:
                tree = Path(tmp)
                stage(tree, kind, base_texts[name], companion_kind=kind if kind != "constitution" else None)
                rc, findings, out, summary = run_check(tree)
                verdicts_per_run.append(sorted((f["constraint"], f["verdict"]) for f in findings))
                (EVIDENCE / f"stability-{Path(name).stem}-{i}.log").write_text(out)
        record.append({"case": f"stability:{name}", "runs": runs,
                       "stable": all(v == verdicts_per_run[0] for v in verdicts_per_run),
                       "verdicts": [f"{c}:{v}" for c, v in verdicts_per_run[0]]})


def replace_leg(record: list, prefix: str, rows: list) -> list:
    return [r for r in record if not str(r.get("case", "")).startswith(prefix)] + rows


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--stability-runs", type=int, default=3)
    ap.add_argument("--only", choices=["mutations", "heldout", "stability", "report"], default=None)
    ap.add_argument("--corpus", action="append", default=[], metavar="NAME=PATH",
                    help="extra local held-out corpus (a git clone); scratch work, aggregates only")
    ap.add_argument("--corpus-cache", type=Path, default=Path("/tmp/rule-quality-corpora"))
    args = ap.parse_args()

    base = {}
    for name in ("design/06-durable-delivery.md", "design/09-package-split.md",
                 "goals/00-v4-service-api.md", "constitution.md"):
        p = REPO / name
        if p.exists():
            base[name] = p.read_text()

    record_path = EVIDENCE / "record.json"
    record = json.loads(record_path.read_text()) if record_path.exists() else []
    want = args.only or "all"
    if want in ("all", "mutations"):
        rows: list = []
        run_mutations(base, rows)
        record = rows + [r for r in record if "expect" not in r]
    if want in ("all", "heldout"):
        extra = dict(spec.split("=", 1) for spec in args.corpus)
        rows = []
        run_heldout(rows, args.corpus_cache, extra)
        record = replace_leg(record, "heldout:", [])  # per-document rows are scratch-only
        record += rows  # aggregate rows (heldout-aggregate:NAME) are committed
    if want in ("all", "stability"):
        rows = []
        run_stability(base, rows, args.stability_runs)
        record = replace_leg(record, "stability:", rows)
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    record_path.write_text(json.dumps(record, indent=2) + "\n")

    # ---- report
    lines = ["# Rule-quality harness report (task #9)", ""]
    muts = [r for r in record if "expect" in r]
    if muts:
        hits = sum(1 for r in muts if r.get("hit"))
        lines += [f"## Mutations — {hits}/{len(muts)} constraints flipped by their seeded mutation", "",
                  "| case | target | hit | collateral |", "|---|---|---|---|"]
        for r in muts:
            lines.append(f"| {r['case']} | {r['expect']} | {'YES' if r.get('hit') else 'NO'} | {', '.join(r.get('collateral', [])) or '—'} |")
    aggs = [r for r in record if str(r.get("case", "")).startswith("heldout-aggregate:")]
    if aggs:
        lines += ["", "## Held-out corpus — per-corpus aggregate (per-document rows are scratch, not committed)", ""]
        for r in aggs:
            name = r["case"].split(":", 1)[1]
            lines.append(f"### {name} @ `{r.get('corpus_commit', '?')[:12]}` — {r.get('documents', 0)} documents")
            for cls, n in sorted(r.get("counts", {}).items()):
                marker = " **(false alarms)**" if cls == "semantic-violated" else ""
                lines.append(f"- {cls}: {n}{marker}")
            violated = sorted(set(r.get("semantic_violated", [])))
            if violated:
                lines.append(f"- violated constraints: {', '.join(violated)}")
    stab = [r for r in record if str(r.get("case", "")).startswith("stability:")]
    if stab:
        lines += ["", "## Judge stability", "", "| document | stable |", "|---|---|"]
        for r in stab:
            lines.append(f"| {r['case']} | {'YES' if r['stable'] else 'NO — flips recorded'} |")
    report = EVIDENCE / "report.md"
    report.write_text("\n".join(lines) + "\n")
    print(f"wrote {report} ({len(muts)} mutations, {len(aggs)} held-out corpora, {len(stab)} stability checks)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
