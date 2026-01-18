# TSkill - Terminal UI for Managing Claude Skills

A Textual-based TUI for managing Claude skills via symlinks.

## Features

- 📋 List all available skills from source directory
- 🔄 Toggle skills between active (symlinked) and inactive
- ⚠️  Identify and manage unmanaged skills
- 📝 Display skill descriptions from SKILL.md files
- ⌨️ Keyboard-driven interface
- 🎨 Color-coded status indicators:
  - 🟢 **ACTIVE** - Skill is symlinked in target directory
  - 🔴 **INACTIVE** - Skill exists in source but not symlinked
  - ⚠️ **UNMANAGED** - Skill in target but not in source

## Installation

```bash
cd tskill

# Install dependencies
uv sync
```

## Tooling Setup

**IDE Integration (VS Code):**
- **Pyright (Pylance)**: Fast, precise type checking in editor
- **Ruff**: Fast linting, import sorting, and formatting

**CI Setup:**
- **MyPy**: Strict type checking (recommended for CI)
- **Ruff**: Fast linting and auto-fixes
- **Pyright**: Additional type checker coverage

### Recommended Stack

```bash
# Development
- Editor: VS Code with Pylance
- Type checking: Pyright (interactive) + MyPy (CI)
- Linting: Ruff
- Project management: UV

# Workflow
1. Write code with Pyright showing real-time type errors
2. Ruff shows instant linting issues
3. Before commit, MyPy verifies strict type consistency
4. CI runs both MyPy and Ruff for final validation
```

### Configuration Files

**VS Code Settings** (`.vscode/settings.json`):
- Pyright type checking (standard mode)
- Ruff linting enabled
- Ruff auto-format on save
- Organize imports on save

**Project Configuration** (`pyproject.toml`):
- Ruff: Line length 88, Python 3.11
- MyPy: Strict mode enabled
- Target Python 3.11

## Usage

### Running the TUI

```bash
# Direct module run
uv run python -m skill_manager

# Or using the entry point
uv run tskill
```

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `↑` / `↓` | Navigate skills |
| `Space` | Toggle active/inactive status |
| `Enter` | Manage unmanaged skill |
| `R` | Refresh skills list |
| `Q` | Quit |

## Configuration

Default paths (can be overridden with CLI arguments):
- **Source**: Tries `./skills`, then `../skills`, or specify `--source-dir`
- **Target**: `~/.claude/skills`, or specify `--target-dir`

### Examples

```bash
# Use default fallback (./skills → ../skills)
uv run tskill

# Specify custom source
uv run tskill --source-dir ~/my-skills

# Specify both source and target
uv run tskill --source-dir ./skills --target-dir ~/.custom-skills
```

## How It Works

### Status Detection

1. **ACTIVE**: A symlink exists in target pointing to source
2. **INACTIVE**: Skill exists in source but no symlink in target
3. **UNMANAGED**: Skill exists in target but not in source

### Actions

- **Toggle (Space)**: Creates or removes symlinks for active/inactive skills
- **Manage (Enter)**: Moves unmanaged skills to source and creates a symlink

## Tooling Setup

### Dependencies (UV Managed)

```bash
cd tskill

# Install/update all dev dependencies
uv sync

# Current stack includes:
# - pytest: Testing
# - ruff: Fast linting, formatting, import sorting
# - pyright: IDE type checking (VS Code Pylance)
# - mypy: CI type checking (strict mode)
# - textual: TUI framework
# - prek: Fast git hooks (Rust-based, 10-100x faster than pre-commit)
```

### IDE Integration (VS Code)

Recommended extensions:
- **Pylance** (Pyright) - Fast, precise type checking
- **Ruff** - Fast linting and formatting

The `.vscode/settings.json` file is configured with:
- Pyright type checking (standard mode)
- Ruff linting enabled
- Ruff auto-format on save
- Ruff import organization on save

### Pre-Commit Hooks (prek)

**Quick Setup (One-Time):**
```bash
# Install prek
uv add --dev prek

# Use existing configuration (drop-in replacement!)
prek run --all-files
```

**What's Checked:**
- ✅ mypy (strict mode) - Type errors
- ✅ ruff (linting) - Style/linting issues
- ✅ ruff (formatting) - Auto-format code
- ✅ ruff (imports) - Sorted imports
- ✅ trailing-whitespace - No trailing spaces
- ✅ end-of-file-fixer - Single newline at EOF
- ✅ file format checks - Yaml, JSON
- ✅ Large file check - Warn on >1MB files

**Pre-Commit Commands:**
```bash
# Run all hooks on all files
prek run --all-files

# Run hooks manually
prek run --all-files

# Update hooks to latest versions (auto in CI)
prek autoupdate

# List all hooks
prek run --list-stages
```

**Migration Benefits:**
- ⚡ 10-100x faster than pre-commit (Python)
- 📦 Drop-in replacement - Uses your existing `.pre-commit-config.yaml`
- 🔒 Dependency-free - No Python virtualenv overhead
- 💪 Better reliability - No Python import errors

**Note**: prek is a Rust rewrite of pre-commit that provides 10-100x performance while using your existing configuration. See `PREK_MIGRATION.md` for details.

**Hook Configuration:**
Your `.pre-commit-config.yaml` works unchanged with prek in compatibility mode.

**Excluded Files:**
- Virtual environments (`.venv/`)
- Cache directories (`.pytest_cache/`, `.mypy_cache/`, `.ruff_cache/`)
- Git directory (`.git/`)
- TUI main file (excluded from mypy to avoid false positives)

### IDE Integration (VS Code)

Recommended extensions:
- **Pylance** (Pyright) - Fast, precise type checking
- **Ruff** - Fast linting and formatting

The `.vscode/settings.json` file is configured with:
- Pyright type checking (standard mode)
- Ruff linting enabled
- Ruff auto-format on save
- Ruff import organization

### Pre-Commit Hooks

Pre-commit hooks run checks automatically before each git commit. They ensure code quality by catching issues locally.

**Quick Setup (One-Time):**
```bash
# Install pre-commit and run hooks
uv run pre-commit install

# Run hooks on all files (first time)
uv run pre-commit run --all-files
```

**What's Checked:**
- ✅ mypy (strict mode) - Type errors
- ✅ ruff (linting) - Style/linting issues
- ✅ ruff (formatting) - Auto-format code
- ✅ ruff (imports) - Sorted imports
- ✅ Trailing whitespace - No trailing spaces
- ✅ End-of-file fixers - Single newline at EOF
- ✅ File format checks - Yaml, JSON
- ✅ Large file check - Warn on >1MB files

**Pre-Commit Commands:**
```bash
# Run all hooks on all files
uv run pre-commit run --all-files

# Update hooks to latest versions
uv run pre-commit autoupdate

# Skip hooks for a commit (use carefully!)
uv run pre-commit run --skip-hooks -m "message"

# List all hooks
uv run pre-commit run --list-stages
```


**Pre-commit hooks include:**
- mypy (strict mode) - Type checking before commit
- ruff (linting) - Fast style/lint checking
- ruff (formatting) - Auto-format code
- ruff (imports) - Ensure imports are sorted
- Trailing whitespace, end-of-file, Yaml, JSON checks

## Development

### Type Checking

```bash
# Interactive (development)
uv run pyright src/skill_manager/

# CI (non-interactive, strict)
uv run mypy src/skill_manager/ --strict
```

### Linting

```bash
# Check only
uv run ruff check src/skill_manager/

# Check and auto-fix
uv run ruff check src/skill_manager/ --fix

# Format only
uv run ruff format src/skill_manager/

# Check imports only
uv run ruff check src/skill_manager/ --select I
```

### Type Inference (Optional)

For untyped codebases, you can use pytype:

```bash
# Add to dev dependencies
uv add --dev pytype

# Infer types
uv run pytype src/skill_manager/ -o pytype-output

# Generate stubs
uv run pytype --generate-stubs src/skill_manager/ > src/skill_manager.pyi
```

Note: Pytype support ended in 2024 (Python 3.12 last supported version). Recommended to add type annotations manually or use MyPy/Pyright instead.

## Recommended Workflow

### Feature Development
```bash
# 1. Write code in VS Code (Pyright shows errors immediately)
# 2. Ruff shows linting issues as you type
# 3. Save triggers Ruff auto-format
# 4. Pre-commit runs mypy + ruff before you commit
# 5. CI runs MyPy + Pyright + Ruff for verification
```

### Bug Fixing
```bash
# 1. Use Pyright to see precise error location
# 2. Run `reveal_type()` in code for debugging
# 3. Use mypy --strict for thorough checking
# 4. Ruff catches style issues alongside type errors
```

### Linting

```bash
uv run ruff check src/skill_manager/
```

### Type Checking

```bash
uv run mypy src/skill_manager/
```

## Project Structure

```
tskill/
├── src/
│   └── skill_manager/
│       ├── __init__.py
│       ├── __main__.py      # Entry point
│       ├── manager.py       # Core file/symlink operations
│       ├── models.py       # Data models
│       └── tui.py         # Textual TUI application
├── tests/
│   └── skill_manager/
│       └── __init__.py
├── pyproject.toml         # Project configuration
└── README.md
```

## License

MIT
