# The shared trace fixture (design 19)

One scripted call sequence both halves implement; the expected output is the
three files beside this script. The filter for the run is `surface,interp.turn`
(`dv.oracles.ask` is off, so its span and event emit nothing).

```text
span("surface.elab.lower")
  event("surface.elab.step", {n: 1})
  remark("surface.elab.lower.edge", {path: "x.flow.md", line: 3}, "edge lowered to filter")
  span("interp.turn")
    event("interp.turn.step")
  span("dv.oracles.ask")        # disabled — no records at all
    event("dv.oracles.ask.step")
```

Notes on the literal bytes:

- `kind` in `sink.jsonl` is the serialisation of the sink **method name**
  (`begin`/`end`/`event`/`remark`); it is not a key of the record dict.
- Every `sink.jsonl` record carries `ts_us`; `end` records carry `dur_us`. In the
  fixture both are `0`; comparisons ignore their values but require the keys.
- `tree.txt` is in call order: events and remarks print when they happen, a span
  prints on its end; indent is two spaces per span depth; fields print sorted as
  `k=v` with JSON values.
- `chrome.json` is generated from `sink.jsonl`: `end` → `ph:"X"` (`ts`,`dur`
  excepted), `event` → `ph:"i"`, `remark` → `ph:"i"` with `code`/`at`/`why` in
  `args`; begin ids are `s1`, `s2`, … in begin order; `cat` is the name's first
  segment.
