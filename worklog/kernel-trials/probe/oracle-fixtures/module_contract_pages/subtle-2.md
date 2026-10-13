# acme-widget — contract

As of v2 the order is a map; it used to be a list.

## Public surface

`widget.place(order)` accepts an order and returns its id. It is idempotent by id: placing
the same order twice returns one id and creates one order. Callers rely on that; they do not
read the ledger directly.
