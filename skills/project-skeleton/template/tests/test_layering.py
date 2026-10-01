"""Layering gate (project skeleton): no import may point against the allowed direction.

Edit PACKAGES and LAYER_OF for the project's own layout (see the visflow reference:
src/<app> plus workspace packages). On a bootstrap with a single source tree the gate is
green by construction; the first split-out package must be listed here the same PR.
"""
import ast
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

PACKAGES = {
    "app": (ROOT / "src", None),  # rename to the project's application package
}
LAYER_OF: dict[str, str] = {}


def layer(module: str) -> str:
    return LAYER_OF.get(module, "app")


def internal_imports(source: str, package: str) -> set[str]:
    found: set[str] = set()
    for node in ast.walk(ast.parse(source)):
        if isinstance(node, ast.ImportFrom):
            if node.level == 1 and node.module:
                found.add(node.module.split(".")[0])
            elif node.level == 1:
                found.update(alias.name for alias in node.names)
            elif node.module and node.module.split(".")[0] in PACKAGES:
                parts = node.module.split(".")
                if len(parts) == 1:
                    directory = PACKAGES[parts[0]][0]
                    found.update(alias.name if (directory / f"{alias.name}.py").is_file()
                                 else package for alias in node.names)
                else:
                    found.add(parts[1] if len(parts) > 1 else parts[0])
        elif isinstance(node, ast.Import):
            for alias in node.names:
                parts = alias.name.split(".")
                if parts[0] in PACKAGES:
                    found.add(parts[1] if len(parts) > 1 else parts[0])
    return found


def test_tree_respects_the_layer_table():
    violations = []
    for name, (directory, _) in PACKAGES.items():
        if not directory.is_dir():
            continue
        for path in sorted(directory.rglob("*.py")):
            module = path.stem
            for target in internal_imports(path.read_text(), name):
                if target == module or target == name:
                    continue
                if layer(target) != layer(module) and layer(module) != "app":
                    violations.append((module, target))
    assert violations == []
