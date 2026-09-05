---
name: compatibility-design
description: >-
  Use when a design or implementation proposes compatibility, fallback, dual-world,
  migration, or history-gated shape selection. Reject compat/fallback; pick the
  current matching inventory choice, or stop and request a gated design.
---

# Compatibility Design

Reject any compatibility/fallback design. Maintain an inventory of right choices; pick the current matching one. Otherwise exit the flow and request a design with gate + assumption taken at a higher, earlier stage.

**P0 project law (first check, always):** where the project has legislated a zero-compat/current-model law, design proposals that breach it are rejected outright — template posture: no dual-world support (temporary included), no migration machinery, no era-named transition artifacts, no history-gated shape selection; positive contract-match-or-refuse only; provenance lives in history/logs, never in code.

## Inventory

- [Gated Design](references/gated-design.md) — gate styles: empty (clarify assumptions, go) or versioned (version/type routes to different impls).
