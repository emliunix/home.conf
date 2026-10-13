# acme-widget — contract

## Public surface

`widget.place(order)` returns an id. Round 5 (2026-10-01): we tried returning the ledger row,
then changed to the id; the ledger read double-counted.
