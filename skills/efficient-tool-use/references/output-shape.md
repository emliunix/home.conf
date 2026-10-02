# Output shape

Use these rules when a tool result will be parsed, counted, compared, or used
as evidence.

## Ask the owning surface for its shape

Do not invent a text parser for a surface that already returns structured
data. Use JSON, a typed API, or the command's native output format; then ask
for only the fields needed.

Why: the source corpus text-shaped structured `raft` output repeatedly. The
tool already knew the response shape.

## Search before reading

Ask a targeted question first, then read the matching region. A full-file read
to answer a local question costs context and hides the relevant record.

## Parse records, not strings

Count events by their record shape, not by occurrences of a word. A mixed
document quotes other documents, so string counts include descriptions and
examples as if they happened.

For a transcript, count tool-call records and pair calls with results by ID.
If the format does not expose the needed record, state the reduced claim.

## Make required arguments explicit

A typed or structured interface should require the identifiers and
discriminators the operation actually needs. A wrong argument is a different
failure class from a parsing error and needs a different fix.
