"""Layering gate (project skeleton): no import may point against the allowed direction.

Edit PACKAGES, LAYER_OF and MAY_IMPORT for the project's own layout (this skeleton
is the worked minimum). On a fresh bootstrap the gate is green by
construction; the first split-out package must be listed here in the same PR, and the
seeded-violation tests keep the parser honest.
"""
import ast
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]

# Each import root, and the layer its package holds once it is split out (None: still mixed).
PACKAGES = {
    "app": (ROOT / "src", None),  # rename to the project's application package
}
LAYER_OF: dict[str, str] = {}
MAY_IMPORT: dict[str, set[str]] = {}  # layer -> layers it may import (its own implied)


def layer(module: str, package: str | None = None) -> str:
    if module in LAYER_OF:
        return LAYER_OF[module]
    # A module not listed by name inherits its package's layer (PACKAGES names it).
    if package is not None and PACKAGES.get(package, (None, None))[1] is not None:
        return PACKAGES[package][1]
    return "app"


def module_name(package: str, dotted: list[str]) -> str:
    if dotted:
        return dotted[0]
    return "__init__" if package == "app" else package


def internal_imports(source: str, package: str) -> set[str]:
    found: set[str] = set()
    for node in ast.walk(ast.parse(source)):
        if isinstance(node, ast.ImportFrom):
            if node.level == 1 and node.module:
                found.add(module_name(package, node.module.split(".")))
            elif node.level == 1:
                found.update(alias.name for alias in node.names)
            elif node.module and node.module.split(".")[0] in PACKAGES:
                parts = node.module.split(".")
                if len(parts) == 1:
                    # `from PKG import name`: each name that is a module of PKG is that module;
                    # any other name is an attribute of the package itself.
                    directory = PACKAGES[parts[0]][0]
                    found.update(alias.name if (directory / f"{alias.name}.py").is_file()
                                 else module_name(parts[0], []) for alias in node.names)
                else:
                    found.add(module_name(parts[0], parts[1:]))
        elif isinstance(node, ast.Import):
            for alias in node.names:
                parts = alias.name.split(".")
                if parts[0] in PACKAGES:
                    found.add(module_name(parts[0], parts[1:]))
    return found


def import_graph() -> dict[str, tuple[str, set[str]]]:
    """Module -> (its package, its imports). The package carries the layer fallback."""
    graph: dict[str, tuple[str, set[str]]] = {}
    for package, (directory, _) in PACKAGES.items():
        if not directory.is_dir():
            continue
        for path in sorted(directory.rglob("*.py")):
            name = package if path.stem == "__init__" else path.stem
            graph[name] = (package, internal_imports(path.read_text(), package))
    return graph


def violations(graph: dict[str, tuple[str, set[str]]]) -> list[tuple[str, str]]:
    bad = []
    for module, (package, imports) in graph.items():
        for target in imports:
            if target not in graph:
                continue
            target_package = graph[target][0]
            allowed = MAY_IMPORT.get(layer(module, package), {layer(module, package)}) | {layer(module, package)}
            if layer(target, target_package) not in allowed:
                bad.append((module, target))
    return sorted(bad)


def test_tree_respects_the_layer_table():
    assert violations(import_graph()) == []


def test_parser_reads_every_import_form(monkeypatch, tmp_path):
    """Runs against a synthetic package, so renaming the project's real package
    (as the docstring instructs) cannot break the parser tests."""
    synthetic = tmp_path / "syn"
    synthetic.mkdir()
    (synthetic / "surf.py").write_text("X = 1\n", encoding="utf-8")
    monkeypatch.setattr(sys.modules[__name__], "PACKAGES", {"syn": (synthetic, None)})
    source = ("from .ir import X\nfrom . import machine\nimport syn.surf\n"
              "from syn.domains import y\nfrom numpy import z\nimport json\n")
    assert internal_imports(source, "syn") == {"ir", "machine", "surf", "domains"}


def test_from_package_import_module_is_read_as_that_module(monkeypatch, tmp_path):
    """`from PKG import module` must not escape the gate as an import of the package."""
    synthetic = tmp_path / "syn"
    synthetic.mkdir()
    (synthetic / "example_two.py").write_text("X = 1\n", encoding="utf-8")
    monkeypatch.setattr(sys.modules[__name__], "PACKAGES", {"syn": (synthetic, None)})
    assert internal_imports("from syn import example_two, ATTRIBUTE\n", "syn") == \
        {"example_two", "syn"}


def test_a_seeded_violation_is_caught(monkeypatch, tmp_path):
    """The gate is red-capable on every bootstrap: a synthetic two-layer project with
    one forbidden arrow must be reported, and the allowed arrow must not be."""
    core = tmp_path / "corep"; web = tmp_path / "webp"
    core.mkdir(); web.mkdir()
    (core / "values.py").write_text("V = 1\n", encoding="utf-8")
    (web / "page.py").write_text("from corep.values import V  # allowed\n", encoding="utf-8")
    (core / "greedy.py").write_text("from webp.page import P  # forbidden\n", encoding="utf-8")
    monkeypatch.setattr(sys.modules[__name__], "PACKAGES",
                        {"corep": (core, "core"), "webp": (web, "web")})
    monkeypatch.setattr(sys.modules[__name__], "LAYER_OF", {})
    monkeypatch.setattr(sys.modules[__name__], "MAY_IMPORT", {"web": {"core"}})
    graph = import_graph()
    assert violations(graph) == [("greedy", "page")]
