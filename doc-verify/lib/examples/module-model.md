# acme-widget — model

## State

An **order** is a set of lines keyed by sku. The **ledger** records each accepted order under
its id. The only mutable state is the pending order and the ledger; everything else is derived
from those two.
