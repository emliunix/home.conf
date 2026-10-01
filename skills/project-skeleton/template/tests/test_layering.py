"""Layering gate (project skeleton): no import may point against the allowed direction.

Edit PACKAGES, LAYER_OF and MAY_IMPORT for the project's own layout (the visflow
reference is the full worked example). On a fresh bootstrap the gate is green by
construction; the first split-out package must be listed here in the same PR, and the
seeded-violation tests keep the parser honest.
"""
import ast
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


def test_parser_reads_every_import_form():
    source = ("from .ir import X\nfrom . import machine\nimport app.surface\n"
              "from app.domains import y\nfrom numpy import z\nimport json\n")
    assert internal_imports(source, "app") == {"ir", "machine", "surface", "domains"}


def test_from_package_import_module_is_read_as_that_module():
    """`from PKG import module` must not escape the gate as an import of the package."""
    directory = PACKAGES["app"][0]
    (directory / "example_two.py").write_text("X = 1\n", encoding="utf-8") \
        if directory.is_dir() else None
    if directory.is_dir():
        try:
            assert internal_imports("from app import example_two, ATTRIBUTE\n", "app") == \
                {"example_two", "__init__"}
        finally:
            (directory / "example_two.py").unlink(missing_ok=True)
