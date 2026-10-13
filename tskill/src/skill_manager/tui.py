"""Textual TUI application for skill management."""

from pathlib import Path

from rich.text import Text
from textual.app import App, ComposeResult
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
        height: 5;
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
        self.manager: SkillManager | None = None
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
            status_text = self._get_status_text(skill)
            table.add_row(skill.name, status_text)

        skill_count = len(self.skills)
        self._update_header(skill_count)
        self.query_one("#description", Static).update(f"{skill_count} skills found")

    # The presentation for every member of `SkillStatus`, as TWO tables keyed by the
    # enum itself. Direct indexing (not `.get`) is deliberate: a member with no entry is
    # a crash on the row that carries it, which is exactly the population this module
    # exists to report -- so a missing entry must be loud. `test_design268_status_text`
    # pins the exhaustiveness so adding a member forces this table to be updated.
    _STATUS_COLORS = {
        SkillStatus.ACTIVE: "green",
        SkillStatus.INACTIVE: "red",
        SkillStatus.UNMANAGED: "yellow",
        SkillStatus.BROKEN: "magenta",
        SkillStatus.MALFORMED: "bright_red",
    }

    _STATUS_SYMBOLS = {
        SkillStatus.ACTIVE: "●",
        SkillStatus.INACTIVE: "○",
        SkillStatus.UNMANAGED: "⚠",
        SkillStatus.BROKEN: "✖",
        SkillStatus.MALFORMED: "▨",
    }

    @classmethod
    def missing_status_presentations(cls) -> list[str]:
        """Members of `SkillStatus` with no colour or symbol entry.

        Empty means every member can be RENDERED. The TUI indexes these tables directly,
        so a gap is a KeyError on the row that carries it, not a cosmetic default.
        """
        members = set(SkillStatus)
        return sorted(
            s.name
            for s in members
            if s not in cls._STATUS_COLORS or s not in cls._STATUS_SYMBOLS
        )

    def _get_status_text(self, skill: Skill) -> Text:
        """The row's status cell.

        Takes the ROW, not just its status, because acceptance 5 requires the fine
        reason
        to be visible: four distinct conditions collapse into `MALFORMED`, so a bare
        `MALFORMED` cannot tell a reader whether the entry lacks front matter, lacks
        SKILL.md, is unreadable, or is not a directory. `disposition` names it.
        """
        status = skill.status
        color = self._STATUS_COLORS[status]
        symbol = self._STATUS_SYMBOLS[status]
        label = status.upper()
        if status == SkillStatus.MALFORMED and skill.reason:
            label = f"{label} ({skill.reason})"
        return Text(f"{symbol} {label}", style=f"bold {color}")

    def on_data_table_row_highlighted(self) -> None:
        table = self.query_one("#skills-table", DataTable)
        row_index = table.cursor_row

        if row_index is not None and 0 <= row_index < len(self.skills):
            skill = self.skills[row_index]
            self.query_one("#description", Static).update(skill.description)
            self.refresh_bindings()

    def check_action(self, action: str, parameters: tuple[object, ...]) -> bool | None:
        if action == "manage_skill":
            table = self.query_one("#skills-table", DataTable)
            row_index = table.cursor_row
            if row_index is not None and 0 <= row_index < len(self.skills):
                skill = self.skills[row_index]
                if skill.status not in (SkillStatus.UNMANAGED, SkillStatus.BROKEN):
                    return None
        return True

    def action_toggle_status(self) -> None:
        table = self.query_one("#skills-table", DataTable)
        row_index = table.cursor_row

        if row_index is None or self.manager is None:
            return

        skill = self.skills[row_index]

        if skill.status == SkillStatus.BROKEN:
            self.notify(
                f"'{skill.name}' is broken: its link target does not exist",
                title="Cannot Toggle",
                severity="error",
            )
            return

        if skill.status == SkillStatus.UNMANAGED:
            self.notify(
                f"'{skill.name}' is unmanaged",
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

        if skill.status == SkillStatus.BROKEN:
            # A broken link IS repairable when its source still exists -- that is the
            # point of this action. Refuse only when there is nothing to restore, so the
            # failure is named rather than arriving as a raw FileNotFoundError, and
            # a silent "success" that moves the dangling link into the versioned tree.
            if not (self.manager.source_dir / skill.name).exists():
                self.notify(
                    f"'{skill.name}' has no source to restore; "
                    "remove the link manually",
                    title="Cannot Manage",
                    severity="error",
                )
                return
        elif skill.status != SkillStatus.UNMANAGED:
            self.notify(
                f"'{skill.name}' is already managed",
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
