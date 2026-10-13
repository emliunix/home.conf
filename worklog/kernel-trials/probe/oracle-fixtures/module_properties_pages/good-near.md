# acme-widget — properties

| Id | Property | Statement |
|---|---|---|
| P-widget-01 | idempotent place | placing one order id twice returns one id and one ledger row |
| P-widget-02 | unknown sku refused | a line with an sku not in the catalog is refused, naming the sku |

A property holds when its statement is true of every placement; a property whose statement is false of one placement fails.
