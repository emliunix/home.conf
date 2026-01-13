"""Entry point for skill manager TUI."""

from argparse import ArgumentParser
from pathlib import Path
import sys

from skill_manager.tui import SkillsManagerApp


def parse_args() -> tuple[Path, Path]:
    parser = ArgumentParser(description="Manage your Claude skills repository")
    parser.add_argument(
        "--source-dir",
        type=Path,
        default=Path("../skills"),
        help="Path to the source skills repository (default: ../skills)",
    )
    parser.add_argument(
        "--target-dir",
        type=Path,
        default=Path("~/.claude/skills"),
        help="Path to the target skills directory (default: ~/.claude/skills)",
    )
    args = parser.parse_args()
    return args.source_dir.expanduser(), args.target_dir.expanduser()


def main() -> None:
    source_dir, target_dir = parse_args()

    resolved_source = str(source_dir.resolve())
    resolved_target = str(target_dir.resolve())

    app = SkillsManagerApp(
        source_dir=resolved_source,
        target_dir=resolved_target,
    )
    app.run()


if __name__ == "__main__":
    main()
