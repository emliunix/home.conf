"""Entry point for skill manager TUI."""

from pathlib import Path

from skill_manager.tui import SkillsManagerApp


def main() -> None:
    source_dir = Path("~/Documents/home.conf/skills")
    target_dir = Path("~/.claude/skills")

    app = SkillsManagerApp(
        source_dir=str(source_dir.expanduser()),
        target_dir=str(target_dir.expanduser()),
    )
    app.run()


if __name__ == "__main__":
    main()
