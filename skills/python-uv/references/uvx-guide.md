# uv Python Script Guide

## Overview

`uv` allows running Python scripts with automatic dependency management, avoiding system Python package pollution and virtual environment setup.

## Two Approaches

### Approach 1: Inline Dependencies (PEP 723) - Recommended for New Scripts

Add dependencies directly in the script using inline script metadata:

```python
#!/usr/bin/env -S uv run --script
# /// script
# dependencies = [
#   "requests>=2.31.0",
#   "pyyaml>=6.0",
# ]
# requires-python = ">=3.11"
# ///

import requests
import yaml

# Your code here
```

**Run with:** `./script.py` or `uv run script.py`

**Advantages:**
- Self-contained: dependencies travel with the script
- No external commands needed
- Clear dependency documentation
- Automatic environment isolation

**When to use:**
- Creating new standalone scripts
- Scripts that will be shared or distributed
- Scripts with known, stable dependencies
- Long-term maintainable scripts

### Approach 2: `uv run --with` - For Old-Style Scripts

Run existing scripts without modifying them:

```bash
uv run --with pyyaml --with requests script.py
```

**Advantages:**
- No script modification needed
- Quick one-off execution
- Useful for third-party scripts
- Good for experimentation

**When to use:**
- Running existing scripts that lack inline metadata
- Third-party scripts you can't or don't want to modify
- Quick testing with different dependency versions
- One-time script execution
- When you encounter `ModuleNotFoundError` for old scripts

**Pattern for handling import errors:**
```bash
# If you see: ModuleNotFoundError: No module named 'yaml'
# Solution:
uv run --with pyyaml script.py

# Multiple missing modules:
uv run --with pyyaml --with requests --with pandas script.py
```

## PEP 723 Inline Script Metadata Format

### Basic Structure

```python
#!/usr/bin/env -S uv run --script
# /// script
# dependencies = [
#   "package-name>=version",
# ]
# requires-python = ">=3.x"
# ///
```

### Key Points

1. **Shebang line:** `#!/usr/bin/env -S uv run --script`
   - Makes script directly executable
   - `--script` enables inline dependency support

2. **Metadata block:** Must be in comments after shebang
   - Starts with `# /// script`
   - Ends with `# ///`
   - Contains TOML format

3. **Dependencies:** List in array format
   - Use package names from PyPI
   - Specify version constraints for reproducibility
   - Format: `"package-name>=version"`

4. **Python version:** `requires-python = ">=3.x"`
   - Ensures compatible Python version
   - Useful for scripts using newer syntax

### Common Package Names

| Import Statement | Package Name | Example Dependency |
|-----------------|--------------|-------------------|
| `import yaml` | `pyyaml` | `"pyyaml>=6.0"` |
| `import requests` | `requests` | `"requests>=2.31.0"` |
| `import pandas` | `pandas` | `"pandas>=2.0.0"` |
| `import numpy` | `numpy` | `"numpy>=1.24.0"` |
| `import PIL` | `pillow` | `"pillow>=10.0.0"` |
| `import bs4` | `beautifulsoup4` | `"beautifulsoup4>=4.12.0"` |
| `import dotenv` | `python-dotenv` | `"python-dotenv>=1.0.0"` |

## Examples

### CLI Tool with Arguments

```python
#!/usr/bin/env -S uv run --script
# /// script
# dependencies = [
#   "click>=8.1.0",
# ]
# requires-python = ">=3.11"
# ///

import click

@click.command()
@click.argument('name')
@click.option('--count', default=1, help='Number of greetings')
def hello(name, count):
    """Simple program that greets NAME COUNT times."""
    for _ in range(count):
        click.echo(f'Hello {name}!')

if __name__ == '__main__':
    hello()
```

### Data Processing Script

```python
#!/usr/bin/env -S uv run --script
# /// script
# dependencies = [
#   "pandas>=2.0.0",
#   "openpyxl>=3.1.0",
# ]
# requires-python = ">=3.11"
# ///

import pandas as pd

# Read Excel file
df = pd.read_excel('data.xlsx')

# Process data
result = df.groupby('category').sum()

# Write results
result.to_csv('output.csv')
```

### API Client

```python
#!/usr/bin/env -S uv run --script
# /// script
# dependencies = [
#   "requests>=2.31.0",
#   "python-dotenv>=1.0.0",
# ]
# requires-python = ">=3.11"
# ///

import os
import requests
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.getenv('API_KEY')
response = requests.get(
    'https://api.example.com/data',
    headers={'Authorization': f'Bearer {API_KEY}'}
)

print(response.json())
```

## Converting Existing Scripts

### Step 1: Identify Dependencies

Look for import statements that aren't from standard library:

```python
import sys          # Standard library - no dependency needed
import json         # Standard library - no dependency needed
import requests     # Third-party - needs dependency
import yaml         # Third-party - needs dependency
```

### Step 2: Add Metadata Block

Add after the shebang (or at the top if no shebang):

```python
#!/usr/bin/env -S uv run --script
# /// script
# dependencies = [
#   "requests>=2.31.0",
#   "pyyaml>=6.0",
# ]
# requires-python = ">=3.11"
# ///

# Original code continues here
```

### Step 3: Make Executable

```bash
chmod +x script.py
```

### Step 4: Test

```bash
./script.py
# or
uv run script.py
```

## Troubleshooting

### Script Not Found

**Error:** `command not found: uv`

**Solution:** Install uv:
```bash
brew install uv  # macOS
curl -LsSf https://astral.sh/uv/install.sh | sh  # Linux/macOS
```

### Module Not Found During Execution

**Error:** `ModuleNotFoundError: No module named 'xyz'`

**Quick fix:**
```bash
uv run --with xyz script.py
```

**Permanent fix:** Add to inline dependencies:
```python
# /// script
# dependencies = [
#   "xyz>=1.0.0",
# ]
# ///
```

### Wrong Python Version

**Error:** `Requires Python >=3.11 but found 3.9`

**Solution:** Update `requires-python` or upgrade Python
```bash
# Check available Python versions
uv python list

# Install specific Python version with uv
uv python install 3.11
```

### Permission Denied

**Error:** `Permission denied: ./script.py`

**Solution:** Make executable:
```bash
chmod +x script.py
```

## Best Practices

1. **Always specify version constraints** for reproducibility
2. **Pin Python version** if using newer features
3. **Use `--script` flag** in shebang to enable inline dependency support
4. **Test scripts after conversion** to ensure dependencies are complete
5. **Prefer inline dependencies** for shared/distributed scripts
6. **Use `uv run --with`** for quick experiments or third-party scripts
7. **Document non-obvious dependencies** with comments

## When NOT to Use uv Scripts

- Large applications with complex dependency trees → Use proper virtual environment with `uv venv`
- Development projects with dev/test/prod dependencies → Use `uv venv` and `pyproject.toml`
- Scripts that modify site-packages → Use traditional pip install
- Performance-critical code run frequently → Pre-install dependencies in venv
