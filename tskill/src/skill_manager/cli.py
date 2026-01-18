"""CLI argument parsing and directory resolution."""

from argparse import ArgumentParser
from pathlib import Path

DEFAULT_TARGET = Path("~/.claude/skills")

FALLBACK_SOURCES = [
    Path("./skills"),
    Path("../skills"),
]


def parse_cli_args() -> tuple[Path | None, Path | None]:
    """Parse command line arguments (both optional)."""
    parser = ArgumentParser(description="Manage your Claude skills repository")
    parser.add_argument(
        "--source-dir",
        type=Path,
        help="Path to the source skills repository (default: ./skills -> ../skills)",
    )
    parser.add_argument(
        "--target-dir",
        type=Path,
        help=f"Path to the target skills directory (default: {DEFAULT_TARGET})",
    )
    args = parser.parse_args()
    return args.source_dir, args.target_dir


def resolve_source_target(
    source_dir: Path | None,
    target_dir: Path | None,
    base_dir: Path | None = None,
) -> tuple[Path, Path]:
    """
    Resolve source and target directories with fallback logic.

    Args:
        source_dir: Explicit source directory from CLI (None if not provided)
        target_dir: Explicit target directory from CLI (None if not provided)
        base_dir: Base directory for relative paths (defaults to current working dir)

    Returns:
        Tuple of (resolved_source, resolved_target)

    Raises:
        FileNotFoundError: If no source directory can be found
    """
    if base_dir is None:
        base_dir = Path.cwd()

    if target_dir is None:
        resolved_target = DEFAULT_TARGET.expanduser()
    else:
        resolved_target = target_dir.expanduser()

    if source_dir is not None:
        resolved_source = source_dir.expanduser()
        if not resolved_source.exists():
            raise FileNotFoundError(f"Source directory not found: {resolved_source}")
    else:
        resolved_source = _find_source_with_fallbacks(base_dir)

    return resolved_source, resolved_target


def _find_source_with_fallbacks(base_dir: Path) -> Path:
    """
    Try each fallback source directory and return the first that exists.

    Args:
        base_dir: Base directory for relative paths

    Returns:
        The first existing source directory

    Raises:
        FileNotFoundError: If no source directory exists
    """
    attempted_paths = []

    for relative_path in FALLBACK_SOURCES:
        candidate = (base_dir / relative_path).resolve()
        attempted_paths.append(candidate)

        if candidate.exists():
            return candidate

    formatted_attempts = "\n  - ".join(
        str(base_dir / relative_path) for relative_path in FALLBACK_SOURCES
    )

    raise FileNotFoundError(
        f"Source directory not found. Tried the following paths:\n"
        f"  - {formatted_attempts}\n\n"
        f"Please create one of these directories or specify --source-dir."
    )
