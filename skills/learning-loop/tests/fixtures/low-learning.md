# Fixture: verified chart relocation

Source: `deepseek-harness-e4aafd75-97c7-4e6c-a1a6-ac138cc2543e`, messages 517-525,
captured 2026-09-22 with `nmem`. This is a bounded, redacted excerpt.

## Transcript evidence

The task moves four existing charts in `design/run-summary-card.html` into their owning topics so a
static companion matches the live card. The final browser check confirms the same chart-to-topic
mapping in both artifacts. Geometry checks at 1440, 1120, 768, and 380 pixels report no overflow in
light or dark mode. Tag counts are balanced, the implementation file remains untouched, and no
unresolved decision or repeated failure remains.

The transcript includes a transient browser-bridge disconnect that succeeds on retry after the
tool's own doctor reports the extension connected. No earlier or later recurrence appears in the
bounded evidence window.
