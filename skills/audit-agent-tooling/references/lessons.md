# Lessons ledger

This ledger holds rules earned by transcript audits. Each row names the
evidence and the boundary that limits it. Replace a rule in place when a
better measurement supersedes it; do not keep contradictory versions active.

Source case: **Tool-Pattern Mining and CLM Hands-On - 2026-10-02**, revision 5
(`pt_ef39716d-e324-49a8-a1fc-685c7e078ca6`), based on 17,551 real tool calls
across six transcripts.

## Established rules

### Save repeated operations as named routines

The largest gap was not a missing tool. One `raft message read | tail` shape
repeated identically 79 times, and 75% of one session's shell calls chained
three or more commands. The reusable fix is a named operation or wrapper for
the repeated invocation.

Bound: one six-transcript corpus, with repeated-shape counts sensitive to
argument normalization. Do not generalize the exact 75% figure.

### Prefer typed answers when the result is a number or a set

TypeScript searches and symbol queries answered with regex can instead use the
compiler API, which returns the structure directly. This removes the
text-to-data parse step where a successful command can still produce a wrong
answer.

The causal claim is narrow: this explains a parsing error where a grep count
read a quotation as an event. It does not explain a wrong CLI argument.
Requiring or validating the argument is a separate fix.

### Split a shape by command before declaring the syntax risky

The earlier conclusion that heredocs were the highest-risk pattern was
withdrawn. The elevated rate came from one command's contract: heredoc plus
`raft` carried most failures, while heredoc without `raft` was the lowest-rate
shape measured.

Bound: the confound was replicated across four corpora, but the exact rates
are corpus measurements, not universal constants.

### Crash rate is not correctness

An error flag measures crashes and refusals. A mis-quoted payload or a
successful query with the wrong argument can exit zero and still produce a
wrong result. Use a correctness instrument when correctness is the claim.

### Bucket non-zero exits by code

`raft message send` returned non-zero for 229 of 781 sends. Most were safe
`SEND_HELD_AS_DRAFT` holds; 20 were genuine `PROXY_5XX`/`ECONNRESET` transport
failures. The recovery differs: read to clear a hold, retry a transport
failure.

A test based on the substring `draft` misclassified transport failures because
their output also says a draft was saved. The structured code is the
discriminator; `$?` alone is not.

### State a guard's reach before crediting protection

`pi-clm` is a Pi extension, but the sessions that died on provider
`Input is too long` errors ran a different harness. The guard could not reach
them. It also withheld tool results only, about 30% of context growth in the
observed cases.

For any guard, measure which harnesses and seats load it, exercise it live,
and state what portion of the target failure it can affect.

### Live transcript counts need their read time

One session's bash count read 873, 875, and 889 across a few minutes, while
another parser read 880 at its own timestamp. Every value was correct for its
read time. Record the read time or the count is not reproducible.

## Candidate lessons

These have a measured instance but need a control or second corpus before
promotion.

### A successful service response is not evidence of service identity

A Visflow CLI setup found another same-domain playground service on the
expected port. It answered with HTTP 400 at `/` but HTTP 200 with compatible
JSON at `/api/catalog`. A liveness check passed while the service was the
wrong process.

Proposed rule: identity checks must require a service-specific response, not
listener presence or a generic success.
