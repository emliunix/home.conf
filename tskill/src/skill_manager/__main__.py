"""Entry point for skill manager TUI."""

from skill_manager.cli import parse_cli_args, resolve_source_target
from skill_manager.tui import SkillsManagerApp


def main() -> None:
    source_arg, target_arg = parse_cli_args()
    source_dir, target_dir = resolve_source_target(source_arg, target_arg)

    resolved_source = str(source_dir.resolve())
    resolved_target = str(target_dir.resolve())

    app = SkillsManagerApp(
        source_dir=resolved_source,
        target_dir=resolved_target,
    )
    app.run()


if __name__ == "__main__":
    main()
