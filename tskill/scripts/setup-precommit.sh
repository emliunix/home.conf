#!/bin/bash
# Pre-commit setup script for tskill

set -e

echo "🔧 Setting up pre-commit hooks for tskill..."

# Use UV to run pre-commit
PRECOMMIT_CMD="uv run pre-commit"

# Check if pre-commit is available
if ! $PRECOMMIT_CMD &> /dev/null 2>&1; then
    echo "❌ pre-commit not found. Installing..."
    exit 1
fi

echo "✅ pre-commit available via UV"

# Install hooks from .pre-commit-config.yaml
echo "📝 Installing pre-commit hooks..."
$PRECOMMIT_CMD install

# Run hooks on all files (first time setup)
echo "🔍 Running hooks on all files..."
$PRECOMMIT_CMD run --all-files

echo ""
echo "✅ Pre-commit setup complete!"
echo ""
echo "📋 Installed hooks:"
echo "  - mypy (strict mode)"
echo "  - ruff (linting)"
echo "  - ruff (formatting)"
echo "  - ruff (import sorting)"
echo "  - trailing-whitespace"
echo "  - end-of-file-fixer"
echo "  - check-yaml, check-json"
echo "  - check-added-large-files"
echo ""
echo "💡 Tips:"
echo "  - Hooks run automatically on git commit"
echo " - Run manually: $PRECOMMIT_CMD run --all-files"
echo "  - Skip hook: git commit --no-verify -m 'message'"
