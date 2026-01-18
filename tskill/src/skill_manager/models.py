"""Data models for skill manager."""

from dataclasses import dataclass
from enum import Enum
from pathlib import Path


class SkillStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    UNMANAGED = "unmanaged"


@dataclass
class Skill:
    name: str
    status: SkillStatus
    description: str
    source_path: Path
    target_path: Path | None = None
