"""Tests run against the skill's single-file script, loaded as module ``group``."""

import importlib.util
import sys
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[2] / "skills/herdr-supervisor/scripts/group.py"

sys.dont_write_bytecode = True  # keep __pycache__ out of the skill directory
_spec = importlib.util.spec_from_file_location("group", SCRIPT)
group = importlib.util.module_from_spec(_spec)
sys.modules["group"] = group
_spec.loader.exec_module(group)
