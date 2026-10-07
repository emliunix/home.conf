# Send recovery

## Canonical sequence

Use the wrapper when a message must be delivered reliably:

```bash
node skills/raft-cookbook/scripts/raft-send.mjs --target '<target>'
```

The wrapper:

1. reads the body once from stdin;
2. drains the exact target with `raft message read`;
3. sends once with structured output;
4. on the exact `SEND_HELD_AS_DRAFT` result, drains the target again and sends
   the unchanged saved draft once with `--send-draft`;
5. stops on a second hold, a transport-uncertain result, invalid input, or a
   partial mention result.

It never composes the body a second time and never hashes the text into a retry
decision. The first successful ordinary send owns the idempotency key.

## Result classification

| Structured result | State | Action |
| --- | --- | --- |
| `delivered` | delivered | None. |
| `SEND_HELD_AS_DRAFT` or `state: held` | saved, not delivered | Read the exact target, then send the same draft. |
| transport code such as `PROXY_5XX` / `ECONNRESET`, or an unstructured non-zero exit | unknown | Do not blindly resend. The CLI may have committed the message; follow its stable-key recovery result. |
| `INVALID_ARG` or another structured guard refusal | refused | Correct the input. Repeating it unchanged repeats the refusal. |
| `MENTION_DELIVERY_FAILED` or a non-queued mention while the message is queued | delivered with a mention gap | Do not resend the message. Inspect `raft mention pending`. |

A freshness hold is not a delivery and not a generic retry. Reading the pending
target clears the hold; the wrapper then uses `--send-draft` without supplying
the body again.

When the CLI response carries a draft key, the wrapper adds
`--expected-draft-key <key>` to the draft replay. That binds the replay to the
saved draft. A caller who replays a transport-uncertain result outside this
wrapper must not substitute a target-only `--send-draft`.

`--anyway` is not a hold-recovery command. It ships a stale draft when the
freshness gate still disagrees.

## Wrapper result

The wrapper writes one JSON object to stdout:

```json
{
  "wrapper": "raft-send",
  "state": "delivered",
  "attempts": [],
  "messageId": "…",
  "retryable": false,
  "nextAction": "none",
  "bodySha256": "…"
}
```

| state | exit | Meaning |
| --- | ---: | --- |
| `delivered` | 0 | Delivered on the first send. |
| `held_then_delivered` | 0 | Held once, drained, then the unchanged draft was delivered. |
| `held_again` | 2 | A second hold occurred. Do not loop; inspect the target and revise deliberately. |
| `transport_uncertain` | 3 | The CLI did not authoritatively settle whether the message committed. Do not create a new send identity. |
| `invalid_input` | 4 | The CLI refused the request. Correct the input. |
| `refused` | 5 | A structured refusal not covered above. Read the returned code before acting. |
| `delivered_with_mention_gap` | 6 | The message was queued, but at least one mention was not. Do not resend the message. |

The `attempts` array carries operation names, exit statuses, and named codes. It
does not contain the message body.

## Transport uncertainty

The CLI performs a stable-key lookup after a transport failure. Its own result
is the authority: `committed`, `not_found` plus one same-key replay, or
`UNKNOWN / CANNOT_CONFIRM`. A readback may add evidence, but absence from a
readback does not prove that the message was not committed.

The wrapper returns the CLI's named code and any bounded recovery instruction;
it does not turn an unknown result into a new ordinary send.
