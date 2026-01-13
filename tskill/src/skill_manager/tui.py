"""Textual TUI application for skill management."""

from pathlib import Path
from typing import Optional

from rich.text import Text
from textual.app import App, ComposeResult
from textual.containers import Vertical
from textual.widgets import DataTable, Footer, Static

from skill_manager.manager import SkillManager
from skill_manager.models import Skill, SkillStatus


class SkillsManagerApp(App[None]):
    CSS = """
    DataTable {
        height: 1fr;
    }
    Static#description {
        height: 3;
        margin: 1;
        background: $panel;
        border: round $primary;
    }
    """

    BINDINGS = [
        ("space", "toggle_status", "Toggle"),
        ("enter", "manage_skill", "Manage"),
        ("r", "refresh", "Refresh"),
        ("q", "quit", "Quit"),
    ]

    def __init__(self, source_dir: str | Path, target_dir: str | Path) -> None:
        super().__init__()
        self.source_dir = str(source_dir)
        self.target_dir = str(target_dir)
        self.manager: Optional[SkillManager] = None
        self.skills: list[Skill] = []

    def compose(self) -> ComposeResult:
        with Vertical():
            yield DataTable(id="skills-table")
            yield Static("Loading skills...", id="description")
        yield Footer()

    def on_mount(self) -> None:
        self.manager = SkillManager(Path(self.source_dir), Path(self.target_dir))
        self.refresh_skills()

    def refresh_skills(self) -> None:
        if self.manager is None:
            return

        self.notify("Refreshing skills...", title="Loading", timeout=1)

        try:
            self.skills = self.manager.scan_skills()
            self.populate_table()
        except Exception as e:
            self.notify(str(e), title="Error", severity="error")

    def populate_table(self) -> None:
        table = self.query_one("#skills-table", DataTable)
        table.clear()
        table.add_columns("Skill", "Status")
        table.cursor_type = "row"
        table.zebra_stripes = True

        for skill in self.skills:
            status_text = self._get_status_text(skill.status)
            table.add_row(skill.name, status_text)

        self.query_one("#description", Static).update(
            f"{len(self.skills)} skills found"
        )

    def _get_status_text(self, status: SkillStatus) -> Text:
        status_colors = {
            SkillStatus.ACTIVE: "green",
            SkillStatus.INACTIVE: "red",
            SkillStatus.UNMANAGED: "yellow",
        }
        status_symbols = {
            SkillStatus.ACTIVE: "●",
            SkillStatus.INACTIVE: "○",
            SkillStatus.UNMANAGED: "⚠",
        }

        color = status_colors[status]
        symbol = status_symbols[status]
        return Text(f"{symbol} {status.upper()}", style=f"bold {color}")

    def on_data_table_row_highlighted(self) -> None:
        table = self.query_one("#skills-table", DataTable)
        row_index = table.cursor_row

        if row_index is not None and 0 <= row_index < len(self.skills):
            skill = self.skills[row_index]
            desc = skill.description
            if len(desc) > 100:
                desc = desc[:97] + "..."
            self.query_one("#description", Static).update(desc)

    def action_toggle_status(self) -> None:
        table = self.query_one("#skills-table", DataTable)
        row_index = table.cursor_row

        if row_index is None or self.manager is None:
            return

        skill = self.skills[row_index]

        if skill.status == SkillStatus.UNMANAGED:
            self.notify(
                f"'{skill.name}' is unmanaged. Press Enter to manage it.",
                title="Cannot Toggle",
                severity="warning",
            )
            return

        try:
            if skill.status == SkillStatus.ACTIVE:
                success = self.manager.deactivate_skill(skill.name)
                new_status = SkillStatus.INACTIVE
            else:
                success = self.manager.activate_skill(skill.name)
                new_status = SkillStatus.ACTIVE

            if success:
                self.skills[row_index].status = new_status
                self.populate_table()
                self.notify(
                    f"'{skill.name}' is now {new_status}",
                    title="Success",
                )
            else:
                self.notify(
                    f"Failed to update '{skill.name}'",
                    title="Error",
                    severity="error",
                )
        except Exception as e:
            self.notify(str(e), title="Error", severity="error")

    def action_manage_skill(self) -> None:
        table = self.query_one("#skills-table", DataTable)
        row_index = table.cursor_row

        if row_index is None or self.manager is None:
            return

        skill = self.skills[row_index]

        if skill.status != SkillStatus.UNMANAGED:
            self.notify(
                f"'{skill.name}' is already managed. Use Space to toggle.",
                title="Already Managed",
                severity="information",
            )
            return

        try:
            success = self.manager.manage_skill(skill.name)

            if success:
                skill.status = SkillStatus.ACTIVE
                self.populate_table()
                self.notify(
                    f"'{skill.name}' managed and activated",
                    title="Success",
                )
            else:
                self.notify(
                    f"Failed to manage '{skill.name}'",
                    title="Error",
                    severity="error",
                )
        except Exception as e:
            self.notify(str(e), title="Error", severity="error")

    def action_refresh(self) -> None:
        self.refresh_skills()
