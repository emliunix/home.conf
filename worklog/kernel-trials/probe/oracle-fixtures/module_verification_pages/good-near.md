# acme-widget — verification

| Property | Check | Limit |
|---|---|---|
| P-widget-01 | `tests/test_widget.py::test_place_is_idempotent` | in-process ledger, no database |
| P-widget-02 | `tests/test_widget.py::test_unknown_sku_is_refused` | in-process, names the sku |

A property is witnessed when its check runs against the in-process ledger and passes; the limit names what that check does not reach.
