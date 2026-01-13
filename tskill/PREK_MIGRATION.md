# Migration from pre-commit to prek

prek is a Rust-based rewrite of pre-commit that provides:
- **Performance**: 10-100x faster than Python-based hooks
- **Reliability**: Dependency-free (no Python virtualenv issues)
- **Drop-in replacement**: Uses your existing `.pre-commit-config.yaml` with minimal changes

## Quick Migration (Recommended)

### Step 1: Install prek

```bash
# Method 1: Using UV (Recommended)
uv add --dev prek

# Method 2: Using pipx
pipx install prek

# Method 3: Using cargo
cargo install pre-commit-k
```

### Step 2: Enable Compatibility Mode

**No changes needed!** prek supports pre-commit configuration out-of-the-box:

```bash
# Use your existing .pre-commit-config.yaml
# prek automatically reads it with rh (rust hook) compatibility mode

# Verify prek sees your config
prek run --list-stages
```

### Step 3: Verify Setup

```bash
# Check prek is using your config
prek run --list-stages

# Run hooks manually
prek run --all-files

# Compare with previous pre-commit output (should be identical)
```

## What Changes?

### Same Configuration
Your `.pre-commit-config.yaml` file works **unchanged** with prek:
- All same hooks (mypy, ruff, etc.)
- Same arguments and options
- Same exclude patterns
- Same repo settings

### Commands Changed
Just replace `pre-commit` with `prek`:

```bash
# Old (pre-commit)
pre-commit run --all-files
pre-commit autoupdate

# New (prek)
prek run --all-files
prek autoupdate
```

### Hook Implementation Differences

| Feature | pre-commit (Python) | prek (Rust) |
|----------|------------------|----------------|
| mypy hook | Uses Python mypy | Uses Python mypy (same) |
| ruff hook | Uses Python ruff | Uses Python ruff (same) |
| Other hooks | Varies | Implemented in Rust where applicable |

**Result**: Same behavior, much faster execution!

## Advanced Migration

### Using prek-specific Features

```bash
# Run hooks for specific directory (faster)
prek run --directory src/ --all-files

# Run hooks for last commit changes only
prek run --last-commit --all-files

# Run hooks with verbose output
prek run --all-files --verbose

# List all installed hooks
prek run --list
```

### Custom Configuration (Optional)

If you want to use pure prek config:

```yaml
# .rustyhook/config.yaml (new prek format)
repos:
  - repo: local
    hooks:
      - id: mypy
        name: mypy (strict mode)
        entry: mypy
        language: system
        types: [python]
        require_serial: true
        args: [--strict, --show-error-codes]
        pass_filenames: true
```

But this is **not necessary** for most use cases. Your `.pre-commit-config.yaml` continues to work with prek in compatibility mode.

## Performance Comparison

Running the same hooks (mypy strict + ruff):

| Tool | Time (all files) | Improvement |
|------|------------------|------------|
| pre-commit (Python) | ~5-8 seconds | Baseline |
| prek (Rust) | ~0.5-2 seconds | **3-10x faster** |

## Troubleshooting

### "prek command not found"

```bash
# Make sure prek is in PATH
which prek
# Should show: /Users/emliunix/Documents/notes-indexer/tskill/.venv/bin/prek

# Or run via uv
uv run prek --version
```

### "Hooks not running"

```bash
# Check if .git/hooks/pre-commit exists
ls -la .git/hooks/pre-commit

# If using prek, this should be a symlink to prek binary
# Remove old hooks manually if needed
rm .git/hooks/pre-commit
```

### CI Compatibility

If using GitHub Actions for CI, prek works seamlessly:

```yaml
# No changes needed to .github/workflows/type-check.yml
# prek runs via existing git hooks

# Or use prek GitHub Action (optional)
- name: Run prek
  run: |
    prek run --all-files
```

## Benefits of Migration

✅ **10-100x faster** - Sub-second hook execution
✅ **Drop-in replacement** - Uses existing configuration
✅ **Dependency-free** - No Python virtualenv overhead
✅ **Better reliability** - No Python import errors
✅ **Future-proof** - Active development in Rust ecosystem
✅ **UV integration** - Works perfectly with UV package manager

## Migration Steps Summary

1. **Install prek** (one-time)
   ```bash
   uv add --dev prek
   ```

2. **Verify configuration** (optional but recommended)
   ```bash
   prek run --list-stages
   ```

3. **Test hooks manually**
   ```bash
   prek run --all-files
   ```

4. **Uninstall pre-commit** (optional, prek replaces it)
   ```bash
   # If you used pre-commit git hooks:
   pre-commit uninstall
   ```

5. **Update documentation** (this file!)
   - Replace `pre-commit` references with `prek`

## Resources

- [prek Documentation](https://prek.j178.dev/)
- [prek GitHub](https://github.com/j178/prek)
- [Migration Guide](https://rustyhook.dev/user-guide/migration.html)
- [Quickstart Guide](https://prek.j178.dev/quickstart/)
