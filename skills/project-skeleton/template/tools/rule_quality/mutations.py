"""Seeded mutations for the rule-quality harness. Each mutation MUST flip its target
constraint on a real project document; collateral firings are allowed but recorded."""

import re


def _replace_once(text: str, old: str, new: str) -> str:
    if old not in text:
        raise ValueError(f"anchor not found: {old[:60]!r}")
    return text.replace(old, new, 1)


def _drop_section(text: str, heading: str) -> str:
    pattern = re.compile(rf"^## {re.escape(heading)}\n(?:.*\n)*?(?=^## |\Z)", re.M)
    out, n = pattern.subn("", text)
    if n != 1:
        raise ValueError(f"section not droppable: {heading} (matches={n})")
    return out


def _empty_section_body(text: str, heading: str) -> str:
    """Remove every non-empty line of a section's body, keeping the heading."""
    pattern = re.compile(rf"(^## {re.escape(heading)}\n)(.*?)(?=^## |\Z)", re.M | re.S)
    out, n = pattern.subn(lambda m: m.group(1) + "\n", text)
    if n != 1:
        raise ValueError(f"section not emptyable: {heading} (matches={n})")
    return out


# --- design-module mutations (base: design/06, a promotion-profile full design)

def mut_status_word_vocabulary(t):
    return _replace_once(t, "## Status\n\nlanded", "## Status\n\nselected")

def mut_status_not_one_word(t):
    return _replace_once(t, "## Status\n\nlanded", "## Status\n\nDraft — nearly done, pending one more look")

def mut_status_word_gone(t):
    # No status word at all: the section body is emptied, so the runner reads no status
    # (a non-empty body leaves a token behind and trips the vocabulary rule instead).
    return _empty_section_body(t, "Status")

def mut_status_section_gone(t):
    return _drop_section(t, "Status")

def mut_goal_section_gone(t):
    return _drop_section(t, "Goal")

def mut_verification_section_gone(t):
    return _drop_section(t, "Verification")

def mut_decision_sections_gone(t):
    out = t
    for h in ("Rationale", "Model", "Decision"):
        try:
            out = _drop_section(out, h)
        except ValueError:
            pass
    if out == t:
        raise ValueError("no rationale/model/decision section found to drop")
    return out

def mut_verification_toothless(t):
    section = re.search(r"(^## Verification\n)(.*?)(?=^## |\Z)", t, re.M | re.S)
    if not section:
        raise ValueError("no Verification section")
    toothless = section.group(1) + "\nWe will make sure this works well and test it thoroughly.\n\nEverything here is carefully verified.\n\n"
    return t[:section.start()] + toothless + t[section.end():]

def mut_implementation_steps(t):
    return _replace_once(
        t, "## Verification\n",
        "## Implementation notes\n\n1. Open `src/foo.py` and change line 34 to call `bar()`.\n"
        "2. Rename function `baz` to `baz2` in `src/qux.ts`.\n3. Add a `try/except` around the loop body.\n\n## Verification\n")

# --- goal-module mutations (base: goals/00)

def mut_goal_workstreams_gone(t):
    return _drop_section(t, "Workstreams")

def mut_goal_coverage_gone(t):
    return _drop_section(t, "AC coverage matrix")

def mut_goal_root_gone(t):
    return _drop_section(t, "User requirements — frozen root")

def mut_goal_design_files_gone(t):
    return _drop_section(t, "Design files")

def mut_goal_worklog_gone(t):
    return _drop_section(t, "Worklog")

# --- spine-module mutations (base: constitution.md)

def mut_spine_purpose_gone(t):
    return _drop_section(t, "1. Purpose")

def mut_spine_falsifiers_gone(t):
    return _drop_section(t, "6. What would falsify the commitment")

def mut_spine_falsifiers_vague(t):
    section = re.search(r"(^## 6\. What would falsify the commitment\n)(.*?)(?=^## |\Z)", t, re.M | re.S)
    if not section:
        raise ValueError("no falsifier section")
    vague = section.group(1) + "\nThe design should feel wrong to a thoughtful reader if it is bad.\n\n"
    return t[:section.start()] + vague + t[section.end():]

def mut_spine_roots_idle(t):
    section = re.search(r"(^## 4\. The roots we stand on, and the work each does\n)(.*?)(?=^## |\Z)", t, re.M | re.S)
    if not section:
        raise ValueError("no roots section")
    idle = section.group(1) + section.group(2) + "\n- **Simplicity.** It speaks for itself; no further comment needed.\n\n"
    return t[:section.start()] + idle + t[section.end():]


BASE_DESIGN = "design/06-durable-delivery.md"
BASE_GOAL = "goals/00-v4-service-api.md"
BASE_CONST = "constitution.md"

CASES = [
    {"name": "artifact-status-vocabulary", "kind": "design", "base": BASE_DESIGN, "expect": "artifact-status-in-vocabulary", "mutate": mut_status_word_vocabulary},
    {"name": "design-status-one-word", "kind": "design", "base": BASE_DESIGN, "expect": "design-status-is-one-word", "mutate": mut_status_not_one_word},
    {"name": "artifact-has-status", "kind": "design", "base": BASE_DESIGN, "expect": "artifact-has-status", "mutate": mut_status_word_gone},
    {"name": "design-has-status-section", "kind": "design", "base": BASE_DESIGN, "expect": "design-has-status-section", "mutate": mut_status_section_gone},
    {"name": "artifact-has-goal", "kind": "design", "base": BASE_DESIGN, "expect": "artifact-has-goal", "mutate": mut_goal_section_gone},
    {"name": "design-has-verification", "kind": "design", "base": BASE_DESIGN, "expect": "design-has-verification", "mutate": mut_verification_section_gone},
    {"name": "design-has-decision", "kind": "design", "base": BASE_DESIGN, "expect": "design-has-decision", "mutate": mut_decision_sections_gone},
    {"name": "design-verification-falsifies", "kind": "design", "base": BASE_DESIGN, "expect": "design-verification-falsifies", "mutate": mut_verification_toothless},
    {"name": "design-altitude", "kind": "design", "base": BASE_DESIGN, "expect": "design-altitude", "mutate": mut_implementation_steps},
    {"name": "goal-has-workstreams", "kind": "goal", "base": BASE_GOAL, "expect": "goal-has-workstreams", "mutate": mut_goal_workstreams_gone},
    {"name": "goal-has-coverage", "kind": "goal", "base": BASE_GOAL, "expect": "goal-has-coverage", "mutate": mut_goal_coverage_gone},
    {"name": "goal-has-anchored-root", "kind": "goal", "base": BASE_GOAL, "expect": "goal-has-anchored-root", "mutate": mut_goal_root_gone},
    {"name": "goal-has-design-files", "kind": "goal", "base": BASE_GOAL, "expect": "goal-has-design-files", "mutate": mut_goal_design_files_gone},
    {"name": "goal-has-worklog", "kind": "goal", "base": BASE_GOAL, "expect": "goal-has-worklog", "mutate": mut_goal_worklog_gone},
    {"name": "spine-states-purpose", "kind": "constitution", "base": BASE_CONST, "expect": "spine-states-purpose", "mutate": mut_spine_purpose_gone},
    {"name": "spine-states-falsifiers", "kind": "constitution", "base": BASE_CONST, "expect": "spine-states-falsifiers", "mutate": mut_spine_falsifiers_gone},
    {"name": "spine-falsifiers-observable", "kind": "constitution", "base": BASE_CONST, "expect": "spine-falsifiers-observable", "mutate": mut_spine_falsifiers_vague},
    {"name": "spine-roots-do-work", "kind": "constitution", "base": BASE_CONST, "expect": "spine-roots-do-work", "mutate": mut_spine_roots_idle},
]
