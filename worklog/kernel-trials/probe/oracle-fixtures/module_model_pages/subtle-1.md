# acme-widget — model

Placement previously returned the ledger row; callers moved to the id after the double-count.

## State

An **order** is a set of lines keyed by sku. The **ledger** records each accepted order under
its id. The only mutable state is the pending order and the ledger; everything else is derived
from those two.
