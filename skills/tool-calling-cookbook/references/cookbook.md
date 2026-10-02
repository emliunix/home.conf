# Tool-calling cookbook

These rules are for ordinary work with tools. They are distinct from the
`audit-agent-tooling` procedure, which mines a transcript corpus and decides
which new rules are earned.

Apply a rule when its condition appears. Keep the evidence bound with the
rule; a local measurement is not a universal constant.

## At the moment of use

### Ask the owning surface for its shape

Do not invent a text parser for a surface that already returns structured
data. Use JSON, a typed API, or the command's native output format; then ask
for only the fields needed.

Why: the transcript corpus text-shaped structured `raft` output repeatedly.
The tool already knew the response shape.

### Search before reading

Ask a targeted question first, then read the matching region. A full-file read
to answer a local question costs context and hides the relevant record.

### Parse records, not strings

Count events by their record shape, not by occurrences of a word. A mixed
document quotes other documents, so string counts include descriptions and
examples as if they happened.

For a transcript, count tool-call records and pair calls with results by ID.
If the format does not expose the needed record, state the reduced claim.

### Put the discriminating field in the test

Do not key on a substring that merely correlates with the category. A
transport failure may also print "draft saved"; the structured status code is
what distinguishes it.

Why: a test keyed on the word `draft` hid 20 real transport failures inside a
"safe draft" bucket.

## Results and failures

### Bucket non-zero exits by code

`exit != 0` is not one condition. Classify the result before retrying:

- safe hold: read the pending state, then send the existing draft;
- transport failure: retry the operation;
- refusal or invalid input: fix the input, do not retry unchanged.

Discriminate on the structured status code. `$?` alone is not enough.

### Crash rate is not correctness

An error flag measures crashes and refusals. It does not detect a command that
exited zero with the wrong answer. If correctness matters, use an oracle or
known-answer check; otherwise state that the corpus cannot price correctness.

The compiler-API case is a correctness rule, not a lower-crash-rate rule. A
typed query removes the text-to-data parse step where a successful command can
still produce the wrong result.

### Split the command before blaming the syntax

Do not attribute an outcome to heredocs, pipes, or another syntax shape until
the data is split by command identity. In the source corpus, high failure
rates were concentrated in one command's contract, not the syntax.

### Make required arguments explicit

A typed or structured interface should require the identifiers and
discriminators the operation actually needs. A wrong argument is a different
failure class from a parsing error and needs a different fix.

## Reuse and protection

### Save the repeated operation

Normalize invocation shapes after removing arguments. When the same operation
recurs, name it as a routine, wrapper, command, or typed query. The recurring
gap is often "the tool exists; the invocation shape does not."

### Measure a guard before crediting it

For a guard, wrapper, extension, or gate, measure three separate properties:

1. Reach: which harnesses, seats, and sessions can load it.
2. Activation: a real round trip, not installation or source reading.
3. Scope: what it changes and what remains outside its boundary.

A guard that cannot reach the failure path does not protect it, even when the
guard itself works.

### Require identity, not liveness

A service-specific response is stronger evidence than "something is
listening" or a generic success body. A wrong process can occupy the expected
port and speak the same vocabulary.

Status: candidate. One measured case demonstrated a same-domain service
answering on the expected port; the general rule still needs a second corpus
or a controlled check.

### Record the read time for live sources

A count from a live transcript or changing log is only reproducible with its
read time. If the source can append, record the path, hash when stable, and
the timestamp of the measurement.

## Evidence

Source case: **Tool-Pattern Mining and CLM Hands-On - 2026-10-02**, artifact
`pt_ef39716d-e324-49a8-a1fc-685c7e078ca6`, revision 5, based on 17,551 tool
calls across six transcripts.

The source report and its parsers remain the first case study. Add a new rule
here only when the evidence is reproducible and the rule changes a future
decision. Replace superseded rules in place rather than keeping contradictory
versions active.
