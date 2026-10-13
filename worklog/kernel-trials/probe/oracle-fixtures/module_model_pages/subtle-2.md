# acme-widget — model

## State

An **order** is a set of lines keyed by sku. As of v2 the order is a map; it used to be a list. The **ledger** records each accepted order under
its id. The only mutable state is the pending order and the ledger; everything else is derived
from those two.
