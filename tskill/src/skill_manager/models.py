"""Data models for skill manager."""

from dataclasses import dataclass
from enum import Enum
from pathlib import Path


class SkillStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    UNMANAGED = "unmanaged"
    # A link in the target farm whose resolved target does not exist. It must be a NAMED
    # state rather than an absence: the entry is visibly there and cannot be followed,
    # which is exactly the condition the enumeration must report instead of dropping.
    BROKEN = "broken"
    # Present in the farm but not usable as a skill: no SKILL.md, unreadable, or
    # frontmatter
    # without both `name` and `description`. Named so it is ACCOUNTED for rather than
    # silently filtered -- the same disappearance by a different route.
    MALFORMED = "malformed"


@dataclass
class Skill:
    name: str
    status: SkillStatus
    description: str
    source_path: Path
    target_path: Path | None = None
