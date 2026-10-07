# Result interpretation

Use these rules when a command returns an error, a partial result, or a value
that will drive the next action.

## Put the discriminating field in the test

Do not key on a substring that merely correlates with the category. A
transport failure and a safe stateful hold may print overlapping prose; the
structured status code is what distinguishes them.

Why: a test keyed on one shared word hid 20 real transport failures inside a
safe-hold bucket.

## Bucket non-zero exits by code

`exit != 0` is not one condition. Classify the result before retrying:

- safe hold: perform the state-clearing read, then retry the existing artifact
  unchanged;
- transport failure: retry the operation;
- refusal or invalid input: fix the input, do not retry unchanged.

Discriminate on the structured status code. `$?` alone is not enough.

## Keep the checked command's exit status

A shell pipeline returns the rightmost command's status unless the caller reads
the checked command's status. `tsc ... | head -30; echo "EXIT=$?"` reports
`head`, so a failed compiler run can print a clean zero.

Preserve the status by one of:

- running the checked command without a pipe;
- reading the checked command's `${PIPESTATUS[...]}` entry immediately after the
  pipeline; or
- using a wrapper whose result is the checked command's status.

`set -o pipefail` is not an equivalent substitute. It makes the pipeline report
failure if any stage fails or dies by signal, so a downstream no-match or a
truncation SIGPIPE can red a successful check. Use it only when the pipeline as
a whole is the subject. When the status must belong to the checked command, read
its `${PIPESTATUS[...]}` entry or use the wrapper.

When output must be truncated, the receipt names the command that decided the
result and the status that command returned. The downstream formatter's status
is not evidence about the checked command.

When the command is evidence for a review, capture its combined stdout/stderr,
working directory, start time, and checked exit status in a shareable log:

```sh
node skills/efficient-tool-use/scripts/capture-command-log.mjs \
  --log receipts/<topic>/logs/<check>.log -- <command> [args...]
```

The wrapper returns the checked command's exit status unchanged. Link the log
from the receipt instead of copying raw output into the prose.

## Crash rate is not correctness

An error flag measures crashes and refusals. It does not detect a command that
exited zero with the wrong answer. If correctness matters, use an oracle or
known-answer check; otherwise state that the corpus cannot price correctness.

The compiler-API case is a correctness rule, not a lower-crash-rate rule. A
typed query removes the text-to-data parse step where a successful command can
still produce the wrong result.

## Split the command before blaming the syntax

Do not attribute an outcome to heredocs, pipes, or another syntax shape until
the data is split by command identity. In the source corpus, high failure
rates were concentrated in one command's contract, not the syntax.
