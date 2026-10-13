# acme-widget — properties

As of v2 the order is a map; it used to be a list.

| Id | Property | Statement |
|---|---|---|
| P-widget-01 | idempotent place | placing one order id twice returns one id and one ledger row |
| P-widget-02 | unknown sku refused | a line with an sku not in the catalog is refused, naming the sku |
