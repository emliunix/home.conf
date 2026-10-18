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

sys.path.insert(0, str(Path(__file__).resolve().parent))
import compose_guard as guard  # noqa: E402

ROOT = Path(__file__).resolve().parent
MANIFEST = ROOT / "user.AGENTS.md.snippets" / "manifest.yaml"


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


def resolve_output(declared: str) -> Path:
    """Resolve the composition's output path.

    An absolute or `~`-anchored path is the user-global target and lives outside
    the repo; a relative path is repo-local. Expanding before the is_absolute test
    is what keeps `~/x` from becoming `<repo>/~/x`.
    """
    p = Path(declared).expanduser()
    return p if p.is_absolute() else ROOT / p


def resolve_snippet(entry_path: str, roots: list[Path]) -> Path:
    """Find a snippet file across the configured roots.

    Roots are searched in order, so a private overlay can shadow a shared snippet
    without editing the manifest. The first hit wins, and the chosen root is
    recorded by the caller so a composition is explainable.
    """
    candidate = Path(entry_path)
    if candidate.is_absolute():
        if not candidate.is_file():
            _fail(f"listed snippet does not exist: {entry_path}")
        return candidate
    for root in roots:
        p = root / entry_path
        if p.is_file():
            return p
    _fail(f"listed snippet not found under any root: {entry_path} "
          f"(roots: {', '.join(str(r) for r in roots)})")


def compose(manifest_path: Path) -> str:
    manifest = load_yaml(manifest_path)
    for key in ("version", "output", "snippets", "header"):
        if key not in manifest:
            _fail(f"{manifest_path} is missing required key: {key}")
    if manifest["version"] != 1:
        _fail(f"unsupported manifest version: {manifest['version']!r}")
    if not isinstance(manifest["snippets"], list):
        _fail("manifest 'snippets' must be a list")

    # Roots: the manifest's own directory first, then any declared search roots.
    # Local-only snippets are skipped entirely when compose is asked for the
    # publishable composition, so a public output can never carry their bodies.
    # `snippet_roots` is how a PRIVATE overlay supplies snippets that must not
    # live in a public repo, without the manifest naming them by absolute path.
    roots: list[Path] = [manifest_path.parent.parent]
    declared = manifest.get("snippet_roots") or []
    if not isinstance(declared, list):
        _fail("manifest 'snippet_roots' must be a list")
    for extra in declared:
        roots.append(Path(str(extra)).expanduser())

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

        path = resolve_snippet(entry["path"], roots)
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
    ap.add_argument("--force", action="store_true",
                    help="allow --install to replace an existing, differing file")
    ap.add_argument("--allow-outside-root", action="store_true",
                    help="required when a destination is outside this repository "
                         "(every write to the user-global target needs it)")
    ap.add_argument("--with-local", action="store_true",
                    help="with --print, include the local-only snippets")
    args = ap.parse_args(argv)

    # ⚠ THE INVOCATION MATRIX (#40 review 2, blocker 2). Today `--check` returns before `--install` is
    # ever read, so `--check --install` silently checked the output and ignored the target. Refusing the
    # combination names the confusion; supporting it would hide a second, differently-shaped answer.
    reading = args.check or args.to_stdout or args.only is not None
    if reading and args.install is not None:
        print("compose: --install cannot be combined with --check/--print/--only. "
              "A read-only verb reports on the output only; run the writing form for installs.",
              file=sys.stderr)
        return guard.EXIT_USAGE
    if args.force and (args.check or args.to_stdout or args.only is not None):
        print("compose: --force is only meaningful on a writing invocation.", file=sys.stderr)
        return guard.EXIT_USAGE

    if not MANIFEST.is_file():
        _fail(f"no manifest at {MANIFEST.relative_to(ROOT)}")

    if args.only:
        manifest = load_yaml(MANIFEST)
        roots = [ROOT] + [Path(str(x)).expanduser()
                          for x in (manifest.get("snippet_roots") or [])]
        for entry in manifest["snippets"]:
            if entry["id"] == args.only:
                snippet = resolve_snippet(entry["path"], roots)
                _, body = split_frontmatter(snippet.read_text(), snippet)
                sys.stdout.write(body)
                return 0
        _fail(f"no snippet with id {args.only!r}")

    manifest = load_yaml(MANIFEST)
    composed = compose(MANIFEST)

    if args.to_stdout:
        sys.stdout.write(compose(MANIFEST))
        return 0

    out = resolve_output(str(manifest["output"]))

    composed_bytes = composed.encode()

    # DESTINATIONS, resolved once and deduped by resolved path (#40 §1).
    dests = [guard.Destination.of(str(out))]
    if args.install is not None:
        installed_dest = guard.Destination.of(args.install)
        if installed_dest.resolved != dests[0].resolved:
            dests.append(installed_dest)

    try:
        # PREFLIGHT FIRST: H (unsafe destination) and the outside-root rule, before any byte.
        # ⚠ `--check` is READ-ONLY and has no destination to announce: the outside-root rule applies
        # to writers only, while H still applies (#40 review 6, blocker 1).
        guard.preflight(dests, ROOT, args.allow_outside_root, reading=args.check)
    except guard.Refusal as refusal:
        print(refusal.message, file=sys.stderr)
        return refusal.code

    states = []
    for dest in dests:
        try:
            state, stamp = guard.classify(dest, composed_bytes)
        except guard.Refusal as refusal:
            print(refusal.message, file=sys.stderr)
            return refusal.code
        states.append((dest, state, stamp))

    # --check REPORTS EVERY STATE, INCLUDING H, and writes NOTHING: no output, no stamp, no backup.
    if args.check:
        worst = 0
        for dest, state, stamp in states:
            if state == "A":
                print(f"compose: {dest.resolved} is up to date ({len(composed_bytes)} bytes)")
            elif state == "B":
                print(f"compose: {dest.resolved} is out of date (last written by this composer; re-run)",
                      file=sys.stderr)
                worst = max(worst, 1)
            elif state == "C":
                print(guard.refusal_message(dest, state, stamp, composed_bytes), file=sys.stderr)
                worst = max(worst, 3)
            elif state == "D":
                print(f"compose: {dest.resolved} has no compose record; the next run backs up and writes",
                      file=sys.stderr)
                worst = max(worst, 1)
            elif state == "E":
                print(guard.refusal_message(dest, state, stamp, composed_bytes), file=sys.stderr)
                worst = max(worst, 3)
            elif state == "F":
                print(f"compose: {dest.resolved} was written by this composer but the file is GONE",
                      file=sys.stderr)
                worst = max(worst, 1)
            else:  # G
                print(f"compose: {dest.resolved} does not exist and has no compose record",
                      file=sys.stderr)
                worst = max(worst, 1)
        return worst

    # REFUSAL PREFLIGHT over the whole set: if any destination refuses, write NOTHING anywhere.
    refusals = [(d, s, st) for d, s, st in states if s in ("C", "E") and not args.force]
    if refusals:
        for dest, state, stamp in refusals:
            print(guard.refusal_message(dest, state, stamp, composed_bytes), file=sys.stderr)
        print("compose: nothing was written, and no backup was taken.", file=sys.stderr)
        return guard.EXIT_REFUSED

    # EXECUTION: fail-stop, per destination, naming what changed on failure (#40 §2).
    written: list[str] = []
    for dest, state, _stamp in states:
        try:
            if state in ("B", "D") or (state in ("C", "E") and args.force):
                bak = guard.backup(dest)
                print(f"compose: backed up {dest.resolved} -> {bak}", file=sys.stderr)
            guard.write_bytes_and_stamp(dest, composed_bytes)
            written.append(str(dest.resolved))
        except guard.StampFailed as exc:
            # ⚠ WRITTEN BUT UNSTAMPED (#40 review 6, blocker 2 / arm 34). Reporting this as
            # "unchanged" was the opposite of the truth: the bytes are on disk. The state it leaves
            # is D on the next run, and the user is told that rather than left to discover it.
            print(f"compose: the bytes were written to {dest.resolved} but its STAMP failed -- "
                  f"{exc.cause}", file=sys.stderr)
            # ⚠ THE NEXT STATE IS THE CLASSIFIED ONE, not a promise (#40 review 7, blocker 1): an
            # unusable stamp leaves E, a stale valid one leaves C, and only a missing stamp leaves D.
            print(f"  The destination is WRITTEN; the next run will classify it as state "
                  f"{exc.state_after} -- {exc.why}.", file=sys.stderr)
            if written:
                print(f"  already written: {', '.join(written)}  (NOT rolled back)", file=sys.stderr)
            return guard.EXIT_REFUSED
        except (OSError, guard.Refusal) as exc:
            detail = getattr(exc, "message", str(exc))
            print(f"compose: REFUSING at {dest.resolved} -- {detail}", file=sys.stderr)
            if written:
                print(f"  already written: {', '.join(written)}  (NOT rolled back)", file=sys.stderr)
            print(f"  unchanged: {dest.resolved}", file=sys.stderr)
            return guard.EXIT_REFUSED

    for path in written:
        print(f"compose: wrote {path} ({len(composed_bytes)} bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
