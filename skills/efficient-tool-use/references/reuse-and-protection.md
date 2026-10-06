# Reuse and protection

Use these rules when the same operation recurs or when a guard, wrapper, or
gate is being treated as protection.

## Save the repeated operation

Normalize invocation shapes after removing arguments. When the same operation
recurs, name it as a routine, wrapper, command, or typed query. The recurring
gap is often "the tool exists; the invocation shape does not."

## Measure a guard before crediting it

For a guard, wrapper, extension, or gate, measure three separate properties:

1. Reach: which harnesses, seats, and sessions can load it.
2. Activation: a real round trip, not installation or source reading.
3. Scope: what it changes and what remains outside its boundary.

A guard that cannot reach the failure path does not protect it, even when the
guard itself works.

## Require identity, not liveness

A service-specific response is stronger evidence than "something is
listening" or a generic success body. A wrong process can occupy the expected
port and speak the same vocabulary.

Status: candidate. One measured case demonstrated a same-domain service
answering on the expected port; the general rule still needs a second corpus
or a controlled check.

## Record the read time for live sources

A count from a live transcript or changing log is only reproducible with its
read time. If the source can append, record the path, hash when stable, and
the timestamp of the measurement.

## Capture once, hand over the file

When a result will be read by someone else, capture the raw output once,
together with the revision or input identity that produced it and the exit
code, and hand over that file instead of a hand-typed transcript. A capture is
evidence only for the revision in its header: a later revision needs a new
capture, and the file is never edited to look current.

Status: candidate. One project adopted it with a capture harness (owner ruling,
2026-10-05); the general rule still needs a second corpus or a controlled
check.
