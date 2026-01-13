"""Textual TUI application for skill management."""

from pathlib import Path
from typing import Optional

from rich.text import Text
from textual.app import App, ComposeResult
from textual.binding import Binding
from textual.containers import Horizontal, Vertical
from textual.widgets import DataTable, Footer, Static
from textual.widgets._data_table import ColumnKey

from skill_manager.manager import SkillManager

from skill_manager.models import Skill, SkillStatus


class SkillsManagerApp(App[None]):
    STATUS_COLUMN: ColumnKey = ColumnKey("Status")

    CSS = """
    #header {
        height: auto;
        padding: 0 1;
        content-align: left middle;
        background: $boost;
        border: round $primary;
        margin-bottom: 1;
        padding-right: 2;
    }
    #header > Static {
        width: 1fr;
        overflow: hidden;
    }
    DataTable {
        height: 1fr;
    }
    Static#description {
        height: 3;
        width: 1fr;
        padding: 0 1;
        overflow: auto;
        margin: 1;
        background: $panel;
        border: round $primary;
    }
    """

    BINDINGS = [
        ("space", "toggle_status", "Toggle"),
        ("m", "manage_skill", "Manage"),
        ("r", "refresh", "Refresh"),
        ("q", "quit", "Quit"),
    ]

    def __init__(self, source_dir: str | Path, target_dir: str | Path) -> None:
        super().__init__()
        self.source_dir = str(Path(source_dir).resolve())
        self.target_dir = str(Path(target_dir).resolve())
        self.manager: Optional[SkillManager] = None
        self.skills: list[Skill] = []

    def _update_header(self, skill_count: int) -> None:
        self.query_one("#header-source", Static).update(f"Source: {self.source_dir}")
        self.query_one("#header-target", Static).update(f"Target: {self.target_dir}")
        self.query_one("#header-count", Static).update(f"Skills: {skill_count}")

    def compose(self) -> ComposeResult:
        header = Horizontal(id="header")
        with header:
            yield Static("Source", id="header-source")
            yield Static("Target", id="header-target")
            yield Static("Skills", id="header-count")

        with Vertical():
            yield header
            yield DataTable(id="skills-table")
            yield Static("Loading skills...", id="description")
        yield Footer()

    def on_mount(self) -> None:
        if self.manager is None:
            self.manager = SkillManager(Path(self.source_dir), Path(self.target_dir))
        self.skills = self.manager.scan_skills()
        self._update_header(len(self.skills))
        table = self.query_one("#skills-table", DataTable)

        table.cursor_type = "row"
        table.zebra_stripes = True
        self.populate_table()

    def populate_table(self) -> None:
        table = self.query_one("#skills-table", DataTable)
        table.clear(columns=True)
        table.add_columns("Skill", "Status")

        for skill in self.skills:
            status_text = self._get_status_text(skill.status)
            table.add_row(skill.name, status_text)

        skill_count = len(self.skills)
        self._update_header(skill_count)
        self.query_one("#description", Static).update(f"{skill_count} skills found")

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

    def _get_action_hint(self, status: SkillStatus) -> str:
        if status == SkillStatus.UNMANAGED:
            return "Press m to manage"
        return "Press space to toggle"

    def on_data_table_row_highlighted(self) -> None:
        table = self.query_one("#skills-table", DataTable)
        row_index = table.cursor_row

        if row_index is not None and 0 <= row_index < len(self.skills):
            skill = self.skills[row_index]
            action_hint = self._get_action_hint(skill.status)
            desc = skill.description
            self.query_one("#description", Static).update(f"{desc} | {action_hint}")

    def action_toggle_status(self) -> None:
        table = self.query_one("#skills-table", DataTable)
        row_index = table.cursor_row

        if row_index is None or self.manager is None:
            return

        skill = self.skills[row_index]

        if skill.status == SkillStatus.UNMANAGED:
            self.notify(
                f"'{skill.name}' is unmanaged. Press m to manage it.",
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
                table.move_cursor(row=row_index)
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
                self.skills[row_index].status = SkillStatus.ACTIVE
                self.populate_table()
                table.move_cursor(row=row_index)
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
        table = self.query_one("#skills-table", DataTable)
        row_index = table.cursor_row

        if self.manager is None:
            return

        try:
            self.skills = self.manager.scan_skills()
            self.populate_table()
            if row_index is not None and row_index < len(self.skills):
                table.move_cursor(row=row_index)
            self.notify("Skills refreshed", title="Refresh complete")
        except Exception as e:
            self.notify(str(e), title="Error", severity="error")
