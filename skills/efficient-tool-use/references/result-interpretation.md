# Result interpretation

Use these rules when a command returns an error, a partial result, or a value
that will drive the next action.

## Put the discriminating field in the test

Do not key on a substring that merely correlates with the category. A
transport failure may also print "draft saved"; the structured status code is
what distinguishes it.

Why: a test keyed on the word `draft` hid 20 real transport failures inside a
"safe draft" bucket.

## Bucket non-zero exits by code

`exit != 0` is not one condition. Classify the result before retrying:

- safe hold: read the pending state, then send the existing draft;
- transport failure: retry the operation;
- refusal or invalid input: fix the input, do not retry unchanged.

Discriminate on the structured status code. `$?` alone is not enough.

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
