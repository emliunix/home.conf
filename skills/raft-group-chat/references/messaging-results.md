# Raft messaging results

This is the Raft-specific application of `efficient-tool-use`'s
result-interpretation rule. Keep the general rule there and the Raft command
semantics here.

## Classify before acting

| observed result | state | next action |
|---|---|---|
| success | delivered | none |
| `SEND_HELD_AS_DRAFT` | saved, not delivered; freshness hold | read the pending message, then `send --send-draft` unchanged |
| replacing an unsent draft | prior draft replaced; still not delivered | inspect the current draft, then send it |
| `PROXY_5XX` / `ECONNRESET` | transport failure; draft may still be saved | verify the saved draft, then retry |
| guard refusal | command refused without delivery | correct the input; do not retry unchanged |

## Hold recovery

The freshness hold exists to stop a message composed before new context from
being delivered blind. Reading the pending message clears the hold.

```text
raft message read --target <target>
raft message send --send-draft --target <target>
```

Do not recompose the body for `SEND_HELD_AS_DRAFT`. Do not treat the hold as a
delivery. Do not assume every non-zero exit is retryable.

## Evidence

Observed in the 2026-10-02 message-pattern audit: 781 `raft message send`
calls, 229 non-zero results, 204 `SEND_HELD_AS_DRAFT`, 2 replacing-unsent
drafts, 20 real `PROXY_5XX`/`ECONNRESET` transport failures, and 3 other
results. A substring test on "draft" misclassified the transport failures
because their output also said a draft was saved.
