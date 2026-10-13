# acme-widget — contract

## Public surface

`widget.place(order)` accepts an order and returns its id. Originally idempotent only within a session. It is idempotent by id: placing
the same order twice returns one id and creates one order. Callers rely on that; they do not
read the ledger directly.
