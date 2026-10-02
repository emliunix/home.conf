# Call composition

Use these rules when building the command or request that invokes a tool.

## Do not inline payloads into command strings

Keep prose, code, JSON, and other structured payloads out of shell strings.
Pass them through standard input, a file, or the tool's native structured
argument instead.

Why: the source corpus contained 5,145 heredocs and 4,493 inline interpreter
programs. A quoting error can change the payload while the command still exits
zero, which makes this a correctness risk rather than only a crash risk.

## Block on a condition instead of polling

When the surface supports waiting, ask it to block until the condition is
ready. Do not insert sleep-and-recheck loops around a service that already
offers `--wait`, a subscription, or a blocking API.

If polling is the only available contract, state why, bound the total wait,
and stop on a clear timeout. The source corpus contained 3,368 poll loops
where a blocking condition belonged.
