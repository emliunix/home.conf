#!/usr/bin/env python3
"""
Add PEP 723 inline dependencies to an existing Python script.

Usage: ./add_inline_dependencies.py <script.py> <dep1> [dep2] [dep3] ...

Example: ./add_inline_dependencies.py myscript.py "requests>=2.31.0" "pyyaml>=6.0"
"""

import sys
import re
from pathlib import Path


def has_inline_metadata(content):
    """Check if script already has PEP 723 metadata."""
    return re.search(r"# /// script\n", content) is not None


def add_metadata(content, dependencies, python_version=">=3.11"):
    """Add PEP 723 metadata block to script content."""

    # Build the metadata block
    metadata = "# /// script\n"
    metadata += "# dependencies = [\n"
    for dep in dependencies:
        metadata += f'#   "{dep}",\n'
    metadata += "# ]\n"
    metadata += f'# requires-python = "{python_version}"\n'
    metadata += "# ///\n"

    # Check if script has shebang
    if content.startswith("#!"):
        # Add metadata after shebang
        lines = content.split("\n", 1)
        shebang = lines[0]
        rest = lines[1] if len(lines) > 1 else ""

        # Update shebang to use uv run if it's a python shebang
        if "python" in shebang and "uv run" not in shebang:
            shebang = "#!/usr/bin/env -S uv run --quiet"

        return f"{shebang}\n{metadata}\n{rest}"
    else:
        # Add shebang and metadata at the beginning
        shebang = "#!/usr/bin/env -S uv run --quiet"
        return f"{shebang}\n{metadata}\n{content}"


def main():
    if len(sys.argv) < 3:
        print("Usage: ./add_inline_dependencies.py <script.py> <dep1> [dep2] ...")
        print()
        print("Example:")
        print(
            '  ./add_inline_dependencies.py script.py "requests>=2.31.0" "pyyaml>=6.0"'
        )
        print()
        print("Common package names:")
        print("  yaml → pyyaml")
        print("  PIL → pillow")
        print("  bs4 → beautifulsoup4")
        sys.exit(1)

    script_path = Path(sys.argv[1])
    dependencies = sys.argv[2:]

    if not script_path.exists():
        print(f"Error: Script not found: {script_path}")
        sys.exit(1)

    # Read original content
    content = script_path.read_text()

    # Check if already has metadata
    if has_inline_metadata(content):
        print(f"Warning: {script_path} already has inline metadata")
        response = input("Overwrite? (y/N): ")
        if response.lower() != "y":
            print("Aborted")
            sys.exit(0)

        # Remove existing metadata
        content = re.sub(r"# /// script\n.*?# ///\n", "", content, flags=re.DOTALL)

    # Add metadata
    new_content = add_metadata(content, dependencies)

    # Write back
    script_path.write_text(new_content)

    # Make executable
    script_path.chmod(0o755)

    print(f"✓ Added inline dependencies to {script_path}")
    print(f"  Dependencies: {', '.join(dependencies)}")
    print(f"  Made executable: chmod +x {script_path}")
    print()
    print(f"Run with: ./{script_path.name} or uv run {script_path.name}")


if __name__ == "__main__":
    main()
