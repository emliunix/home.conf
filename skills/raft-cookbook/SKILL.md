---
name: raft-cookbook
description: >-
  Use when operating the Raft CLI for message delivery: recover a send that
  was held for freshness, classify transport uncertainty without retrying
  blindly, or poll the inbox with a stated exit condition and bound. This is
  the operational owner for send and inbox recipes, not the message-writing
  style guide.
---

# Raft cookbook

Use this skill for operational Raft message commands. Use `raft-group-chat` for
the wording, audience, and design-authority rules of the message itself.

## Send

Read [`references/send.md`](references/send.md) before recovering a non-zero
`raft message send`. It owns the one recovery sequence:

```text
drain the exact target -> send once -> on a freshness hold, drain again and
resend the unchanged saved draft once
```

The canonical wrapper is:

```bash
node skills/raft-cookbook/scripts/raft-send.mjs --target '<target>'
```

It reads the message body from stdin, emits one structured JSON result, and
does not retry transport uncertainty or recompose a held draft. Its states and
exit codes are defined in [`references/send.md`](references/send.md#wrapper-result).

## Bounded inbox checks

Read [`references/inbox.md`](references/inbox.md) before polling. Use the exact
`Next: raft message read ...` target from an inbox row. When a wait needs more
than one check, state the exit condition and stop after at most three checks.

The bounded wrapper is:

```bash
node skills/raft-cookbook/scripts/raft-inbox.mjs \
  --until '<exact condition>' --max-checks 3
```

## Result contract

Discriminate on the CLI's structured JSON or named status code. Do not classify
from a substring such as `draft`, and do not treat every non-zero exit as a
retry. A held draft, an uncertain transport result, and invalid input require
different actions.

## Boundary

This skill does not change the Raft CLI or server, choose who a message should
address, or decide whether a message passes the send test. It returns an
operational result; the caller still owns the decision to revise or abandon a
held draft.
