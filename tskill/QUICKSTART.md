# TSkill - Quick Start Guide

## What We Built

A fully functional TUI application for managing Claude skills with these features:

✅ **Skills List** - Displays all available skills from source directory
✅ **Status Indicators** - Color-coded status (🟢 Active, 🔴 Inactive, ⚠️ Unmanaged)
✅ **Skill Descriptions** - Shows description from SKILL.md when hovering over skills
✅ **Toggle Actions** - Press Space to activate/deactivate skills
✅ **Manage Actions** - Press Enter to manage unmanaged skills
✅ **Refresh** - Press R to refresh the skills list
✅ **Type Safety** - Full mypy type checking passes

## Project Structure

```
tskill/
├── src/
│   └── skill_manager/
│       ├── __init__.py      # Module init
│       ├── __main__.py     # Entry point
│       ├── manager.py       # File/symlink operations (100+ lines)
│       ├── models.py        # Data models (Skill, SkillStatus)
│       └── tui.py           # Textual TUI app (160+ lines)
├── tests/
│   └── skill_manager/
│       └── __init__.py
├── pyproject.toml         # Project config with textual dependency
└── README.md             # Full documentation
```

## Quick Start

```bash
cd tskill

# Install dependencies
uv sync

# Run the TUI
uv run python -m skill_manager

# Or using the entry point
uv run tskill
```

## Keyboard Controls

| Key | Action |
|-----|--------|
| ↑ / ↓ | Navigate through skills |
| Space | Toggle skill active/inactive |
| Enter | Manage unmanaged skill |
| R | Refresh skills list |
| Q | Quit application |
| Ctrl+P | Open command palette |

## Status Logic

The application determines status based on your skill setup:

### ACTIVE (🟢)
- Skill has a symlink in target directory
- Symlink points to source directory
- **Current State**: All skills show as UNMANAGED because `~/.claude/skills` is itself a symlink to your source

### INACTIVE (🔴)
- Skill exists in source directory
- No symlink exists in target directory
- Can be activated by pressing Space

### UNMANAGED (⚠️)
- Skill exists in target but not in source
- Or target directory itself is a symlink to source (your current setup)
- Press Enter to move to source and create symlink

## Configuration

Edit `src/skill_manager/__main__.py` to change paths:

```python
source_dir = Path("~/Documents/home.conf/skills")  # Your skill repository
target_dir = Path("~/.claude/skills")         # Claude skills directory
```

## Development

### Type Checking
```bash
uv run mypy src/skill_manager/
# Success: no issues found in 5 source files
```

### Linting
```bash
uv run ruff check src/skill_manager/
```

## Next Steps (Optional Enhancements)

1. **Search/Filter** - Add input widget to filter skills by name
2. **Bulk Actions** - Select multiple skills with Ctrl+Space
3. **Profiles** - Save/load different skill configurations
4. **Categories** - Group skills by type
5. **Hot Reload** - Watch directories and auto-update
6. **Themes** - Customizable color schemes

## Notes

- Built with Python 3.11+ and Textual 0.89+
- Fully type-annotated with mypy strict mode
- Follows Textual best practices
- Uses UV for dependency management
- Hatchling build system for clean packaging

---

**Ready to use!** The TUI is fully functional and type-safe. Enjoy managing your Claude skills!
