#!/usr/bin/env python3
"""Compose AGENTS.md from the snippets listed in manifest.yaml.

The manifest is the authority for what is in the composition and in what order.
This script does not decide content; it assembles it and refuses to guess.

    AGENTS.md.compose.py                 # write AGENTS.md from the manifest
    AGENTS.md.compose.py --check         # exit 1 if AGENTS.md is out of date
    AGENTS.md.compose.py --print         # write to stdout, change nothing
    AGENTS.md.compose.py --only <id>     # print one snippet's body
    AGENTS.md.compose.py --install PATH  # also write the composed bytes to PATH

A snippet file has a small frontmatter block (`id`, `title`) followed by its body.
The body's own headings are kept; the manifest's `title` becomes the section
heading so a snippet need not repeat it.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Any, NoReturn

ROOT = Path(__file__).resolve().parent
MANIFEST = ROOT / "AGENTS.md.snippets" / "manifest.yaml"


def _fail(msg: str) -> NoReturn:
    print(f"compose: {msg}", file=sys.stderr)
    raise SystemExit(2)


def _yaml() -> Any:
    try:
        import yaml
    except ImportError:
        _fail("pyyaml is required (uv run --with pyyaml AGENTS.md.compose.py)")
    return yaml


def load_yaml(path: Path) -> dict:
    yaml = _yaml()
    try:
        data = yaml.safe_load(path.read_text())
    except Exception as exc:
        _fail(f"{path} is not valid YAML: {exc}")
    if not isinstance(data, dict):
        _fail(f"{path} must be a YAML mapping")
    return data


def split_frontmatter(text: str, path: Path) -> tuple[dict, str]:
    """Return (frontmatter, body).

    A snippet without frontmatter is an error: an untitled snippet cannot be
    placed in a deterministic order or checked against the manifest.
    """
    if not text.startswith("---\n"):
        _fail(f"{path} has no frontmatter (needs id and title)")
    end = text.find("\n---\n", 4)
    if end == -1:
        _fail(f"{path} has unterminated frontmatter")
    try:
        meta = _yaml().safe_load(text[4:end]) or {}
    except Exception as exc:
        _fail(f"{path} frontmatter is not valid YAML: {exc}")
    if not isinstance(meta, dict):
        _fail(f"{path} frontmatter must be a mapping")
    return meta, text[end + 5:].lstrip("\n")


def compose(manifest_path: Path) -> str:
    manifest = load_yaml(manifest_path)
    for key in ("version", "output", "snippets", "header"):
        if key not in manifest:
            _fail(f"{manifest_path} is missing required key: {key}")
    if manifest["version"] != 1:
        _fail(f"unsupported manifest version: {manifest['version']!r}")
    if not isinstance(manifest["snippets"], list):
        _fail("manifest 'snippets' must be a list")

    parts: list[str] = [str(manifest["header"]).rstrip("\n")]

    seen: set[str] = set()
    for entry in manifest["snippets"]:
        if not isinstance(entry, dict):
            _fail(f"snippet entry must be a mapping: {entry!r}")
        for key in ("id", "path", "title"):
            if key not in entry:
                _fail(f"snippet entry missing {key!r}: {entry!r}")
        sid = entry["id"]
        if sid in seen:
            _fail(f"duplicate snippet id: {sid}")
        seen.add(sid)

        path = ROOT / entry["path"]
        if not path.is_file():
            _fail(f"listed snippet does not exist: {entry['path']}")
        meta, body = split_frontmatter(path.read_text(), path)

        # The snippet and the manifest must agree about identity. A mismatch means
        # one of them was edited without the other, and the composition would be
        # attributed to the wrong rule.
        if meta.get("id") != sid:
            _fail(f"{entry['path']} declares id {meta.get('id')!r} but the "
                  f"manifest lists it as {sid!r}")
        if meta.get("title") != entry["title"]:
            _fail(f"{entry['path']} declares title {meta.get('title')!r} but the "
                  f"manifest lists it as {entry['title']!r}")

        parts.append(f"## {entry['title']}\n\n{body.rstrip()}")

    return "\n\n".join(parts) + "\n"


def main(argv: list[str]) -> int:
    doc = (__doc__ or "Compose AGENTS.md from snippets.").splitlines()[0]
    ap = argparse.ArgumentParser(description=doc)
    ap.add_argument("--check", action="store_true",
                    help="exit 1 if the output file is out of date")
    ap.add_argument("--print", dest="to_stdout", action="store_true",
                    help="write to stdout, change nothing")
    ap.add_argument("--only", metavar="ID", help="print one snippet body")
    ap.add_argument("--install", metavar="PATH",
                    help="also write the composed bytes to this path")
    args = ap.parse_args(argv)

    if not MANIFEST.is_file():
        _fail(f"no manifest at {MANIFEST.relative_to(ROOT)}")

    if args.only:
        manifest = load_yaml(MANIFEST)
        for entry in manifest["snippets"]:
            if entry["id"] == args.only:
                snippet = ROOT / entry["path"]
                _, body = split_frontmatter(snippet.read_text(), snippet)
                sys.stdout.write(body)
                return 0
        _fail(f"no snippet with id {args.only!r}")

    composed = compose(MANIFEST)

    if args.to_stdout:
        sys.stdout.write(composed)
        return 0

    out = ROOT / load_yaml(MANIFEST)["output"]

    if args.check:
        current = out.read_text() if out.is_file() else ""
        if current != composed:
            print(f"compose: {out.name} is OUT OF DATE "
                  f"(run AGENTS.md.compose.py)", file=sys.stderr)
            return 1
        print(f"compose: {out.name} is up to date")
        return 0

    out.write_text(composed)
    print(f"compose: wrote {out.name} ({len(composed)} bytes)")

    if args.install:
        target = Path(args.install).expanduser()
        target.write_text(composed)
        print(f"compose: installed to {target}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
