# 2026-10-07 — widget retry

Tried returning the id from the ledger read; the retry path double-counted. Replaced it with
the idempotency key on place; `tests/test_widget.py` 5 passed, and the manual retry produced
one row. Decision recorded for the contract owner: the key lives on place, not on the ledger.
