# TSkill Tooling Quick Reference

## Tooling Stack

| Tool | Purpose | Version | Command |
|------|---------|---------|---------|
| **Ruff** | Fast linting, formatting, import sorting | 0.14.11+ | `uv run ruff check src/` |
| **Pyright** | IDE type checking (VS Code Pylance) | 1.1.408+ | `uv run pyright src/` |
| **MyPy** | CI type checking (strict mode) | 1.19.1+ | `uv run mypy src/ --strict` |
| **Textual** | TUI framework | 0.89.1+ | `uv run python -m skill_manager` |
| **UV** | Package manager | 0.5.0+ | `uv sync`, `uv run` |

## Commands

### Development (Interactive)

```bash
# Type check in editor (fastest)
uv run pyright src/skill_manager/

# Lint with auto-fixes
uv run ruff check src/skill_manager/ --fix

# Full type check (slower, more strict)
uv run mypy src/skill_manager/ --strict

# Full type check (pre-commit version)
uv run mypy src/skill_manager/ --strict --show-error-codes
```

### Pre-Commit Hooks (Automated)

```bash
# Quick setup (install + run all hooks)
./scripts/setup-precommit.sh

# Run all hooks manually
uv run pre-commit run --all-files

# Update hooks to latest versions
uv run pre-commit autoupdate

# Run mypy only
uv run pre-commit run mypy --all-files

# Skip hooks for one commit
git commit --no-verify -m "message"
```

### Pre-Commit Hooks (Automated)

Pre-commit hooks run automatically before each git commit. They catch issues locally.

**Quick Setup (One-Time):**
```bash
# Run setup script (installs pre-commit + runs all hooks)
./scripts/setup-precommit.sh

# Or manually:
uv run pre-commit install
uv run pre-commit run --all-files
```

**What's Checked:**
- ✅ mypy (strict mode) - Type errors
- ✅ ruff (linting) - Style/linting issues (with auto-fix)
- ✅ ruff (formatting) - Code formatting (enforced)
- ✅ ruff (imports) - Sorted imports
- ✅ ruff (docstrings) - Docstring presence
- ✅ ruff (line-length) - 88 character limit
- ✅ Trailing whitespace
- ✅ End-of-file fixers
- ✅ File format checks (Yaml, JSON, large files)

**Pre-Commit Commands:**
```bash
# Run all hooks on all files
uv run pre-commit run --all-files

# Skip hooks for a commit (use carefully!)
git commit --no-verify -m "message"

# List all hooks
uv run pre-commit run --list-stages
```

### Manual Pre-Commit Check

```bash
# Run all hooks manually
uv run pre-commit run --all-files

# Run mypy only
uv run mypy src/skill_manager/ --strict
```

### Pre-Commit Commands

```bash
# Run all hooks on all files
uv run pre-commit run --all-files

# Update hooks to latest versions
uv run pre-commit autoupdate

# List all hooks
uv run pre-commit run --list-stages
```

**Hook Configuration:**
See `.pre-commit-config.yaml` for full configuration.

**Excluded Files:**
- Virtual environments (`.venv/`)
- Cache directories (`.pytest_cache/`, `.mypy_cache/`, `.ruff_cache/`)
- Git directory (`.git/`)
- TUI main file (excluded from mypy to avoid false positives)

### CI (GitHub Actions)

```bash
# Runs automatically on push/PR
# Checks:
#   - MyPy (strict mode)
#   - Pyright (additional coverage)
#   - Ruff (linting)
```

## VS Code Configuration

**Enabled Features:**
- ✅ Pyright type checking (Pylance)
- ✅ Ruff linting
- ✅ Ruff auto-format on save
- ✅ Ruff import organization on save
- ✅ Auto-fix for Ruff issues

**Type Checking Mode:** `standard` (balanced)

**Keyboard Shortcuts:**
- `Cmd+Shift+M` - Show problems
- `Cmd+.` - Quick fix
- `Cmd+I` - Go to definition

## Configuration Files

### `.vscode/settings.json`
- Editor type checking: Pyright
- Linter: Ruff
- Formatter: Ruff
- Auto-imports: Pyright

### `pyproject.toml`
- Ruff: Line length 88, Python 3.11
- MyPy: Strict mode, warn_return_any
- Target: Python 3.11

## Workflows

### 1. Feature Development

```bash
# 1. Write code in VS Code (Pyright shows errors immediately)
# 2. Ruff shows style/linting issues as you type
# 3. Save triggers Ruff format
# 4. Run full mypy check before committing
```

### 2. Bug Fixing

```bash
# 1. Use Pyright to see precise error location
# 2. Use `reveal_type()` for debugging
# 3. Run mypy for strict verification
# 4. Ruff catches unused imports, dead code
```

### 3. Code Review

```bash
# CI runs all checkers automatically
# PR shows:
#   - Type errors (MyPy + Pyright)
#   - Linting errors (Ruff)
```

## Common Issues

### "MyPy and Pyright disagree"
- **Solution**: Use union types `Union[int, str]`
- Both tools accept it, even if they disagree elsewhere

### "Too slow to type check"
- **Solution**: Use Pyright in editor (fast), MyPy in CI (strict)

### "Ruff auto-fix broke my code"
- **Solution**: Review changes, use `--safe-fixes` flag
- `uv run ruff check --safe-fixes src/`

### "Can't see type hints in editor"
- **Solution**: Check Pylance is enabled in VS Code
- Restart VS Code if needed

## Performance Tips

### Fast Feedback Loop
1. **Pyright**: Sub-second type checking
2. **Ruff**: Instantaneous linting
3. **VS Code**: Minimal UI overhead

### Large Files
```json
{
  "python.analysis.diagnosticMode": "workspace"
}
```

### Excluding Files
```json
{
  "files.exclude": {
    "**/node_modules": true,
    "**/.venv": true,
    "**/__pycache__": true
  }
}
```

## IDE Alternatives

### Neovim
```lua
-- init.lua
require("nvim-lspconfig").setup {
  capabilities = require("cmp_nvim_lsp").default_capabilities(),
  settings = {
    basedpyright = {
      analysis = {
        typeCheckingMode = "standard",
      },
    },
    ruff = {
      lint = { enable = true },
    },
  },
}
```

### PyCharm
- Built-in MyPy-compatible checker
- Can use Pyright plugin
- Ruff plugin available

## Advanced: Type Inference (Not Recommended)

If you want to try Pytype for untyped code:

```bash
# Install pytype
uv add --dev pytype

# Run type inference
uv run pytype src/skill_manager/ -o pytype-output

# Review inferred types
# Then manually add annotations to source
```

**Note**: Pytype is slower and Google ended support in 2024.

## Troubleshooting

### Type checking not working in VS Code
1. Check Pylance is enabled
2. Reload VS Code window (`Cmd+Shift+P`)
3. Check `.vscode/settings.json` syntax
4. Check Python interpreter selected

### Ruff not auto-formatting
1. Check `[python].editor.formatOnSave` is true
2. Check `[python].editor.defaultFormatter` is set
3. Check file is not excluded in settings

### CI failures
1. Run commands locally to reproduce
2. Check Python version matches (3.11)
3. Check dependencies are installed: `uv sync`

## Quick Reference

**Ruff Commands:**
```bash
uv run ruff check src/                    # Check only
uv run ruff check src/ --fix             # Auto-fix
uv run ruff check src/ --select F        # Fix imports only
uv run ruff format src/                   # Format only
uv run ruff check src/ --statistics     # Show stats
```

**Pyright Commands:**
```bash
uv run pyright src/                     # Check
uv run pyright src/ --outputjson       # JSON output
uv run pyright src/ --stats              # Statistics
uv run pyright --help                   # Show options
```

**MyPy Commands:**
```bash
uv run mypy src/                           # Check
uv run mypy src/ --strict                   # Strict mode
uv run mypy src/ --html-report report.html  # HTML report
uv run mypy src/ --show-traceback           # Debug
```

**Textual Commands:**
```bash
uv run python -m skill_manager          # Run TUI
TEXTUAL_LOG=info uv run python -m skill_manager  # Debug
```

## Next Steps

1. ✅ Dependencies configured
2. ✅ VS Code settings created
3. ✅ CI workflow created
4. ✅ All tools verified working

**Ready to code!** 🚀
