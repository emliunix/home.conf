---
name: audit-agent-tooling
description: >-
  Audit how agents actually use tools and skills from session transcripts,
  separate crash rate from correctness, identify repeated operations that
  should become named routines or typed surfaces, and publish reproducible
  lessons. Use when mining agent sessions for tooling patterns, evaluating a
  guard or extension's reach, or deciding which lesson belongs in a durable
  skill or repository check. This is the measurement procedure, not the
  ordinary tool-use rulebook.
---

# Audit agent tooling

Treat session transcripts as measurements, not anecdotes. The output is a
small set of falsifiable rules, each with its population, command, result, and
bound. This is not an agent ranking or a productivity score.

Follow the `tool-calling-cookbook` skill for rules already earned. Its
`references/cookbook.md` is the durable rulebook; do not rediscover or
silently overwrite an entry.

## 1. Freeze the corpus

Record every transcript path, harness, session ID, file hash when stable, and
read time. Live sessions change between reads, so a count without its read
time is not reproducible. State the corpus and time window in every table.

Keep transcript source files read-only. Do not paste large transcript
payloads into the report; reference the source and show only the relevant
records or normalized rows.

## 2. Parse records, not text

Extract assistant tool-call records and pair each with its tool result by ID.
Count actual calls, not strings that mention a call. If the transcript format
does not expose IDs or a complete record type, say so and reduce the claim.

Use a small, rerunnable parser when the corpus has more than one session.
Keep the parser next to the report or in the owning repository so another
reader can reproduce the census.

Searching before reading is a corpus-level lesson: search for the target
statement first, then read only the matching region.

## 3. Classify by operation, then control for conflation

At minimum, separate:

- direct structured tool calls from shell calls;
- reads used to answer a targeted question;
- search-before-read;
- inline interpreters and ad-hoc parsers;
- poll loops;
- output shaping such as `head`, `tail`, `cut`, and `fold`;
- repeated invocation shapes after normalizing arguments;
- skill loads and other explicit procedure activation.

Do not attribute an outcome to syntax when one command or subcommand explains
it. Split the data by command identity before naming a shape rule. Replicate a
candidate rule on another corpus when one is available.

Bucket non-zero or error results by their structured code. Semantic families
such as "safe hold" and "transport failure" have different recovery paths and
must not be collapsed under one word.

## 4. Keep the instrument inside its claim

`is_error` measures crashes and refusals. It does not measure wrong answers. A
low crash rate cannot establish that a pattern is safe, and a successful
command cannot establish that its result is correct.

If correctness is part of the question, use an instrument that checks the
result against a known answer. State the residual risk when the corpus has no
correctness signal.

For a guard, extension, or wrapper, measure three separate things:

1. **Reach:** which harnesses, seats, and sessions can load it.
2. **Activation:** a real round trip, not only installation or source.
3. **Scope:** what it can change and what remains outside its boundary.

A guard that cannot reach the failure path does not protect it, even when the
guard itself works.

## 5. Convert the finding into the right artifact

- Repeated invocation shape: save the operation as a named routine, wrapper,
  or command. The gap is often "the tool exists; the invocation shape does
  not."
- Numeric or set-valued answer parsed from text: expose a typed or structured
  result and make required arguments explicit. This removes the parsing step
  where silent errors occur.
- A high crash rate concentrated in one command: fix or document that
  command's contract instead of labeling the syntax unsafe.
- A low crash rate: do not promote it to a safety rule without a correctness
  check.
- A verified correction: replace the superseded rule in
  `tool-calling-cookbook/references/cookbook.md` and mark the correction in
  the report. Do not leave both versions active.

Add a rule to the cookbook only when it changes a future decision and its
evidence is reproducible. Keep single instances labeled as candidates until a
control, another corpus, or a live round trip supports them.

## 6. Report and retain

Write the report with `report-style` using the review-output shape. Lead with
the largest decision-changing result, not the method. Include:

- corpus census and read time;
- parser and exact reproduce commands;
- counts by shape with their denominators;
- confounds and controls;
- corrections to prior rules;
- actionable rules, non-claims, and unverified boundaries;
- links to any issues or follow-up cards.

Publish a durable artifact and verify its checksum. A concise channel message
carries the outcome; the artifact carries the evidence; the
`tool-calling-cookbook` reference carries what should survive the report.
