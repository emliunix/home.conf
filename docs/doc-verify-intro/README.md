# doc-verify: an introduction

`index.html` is an introductory deck for doc-verify. Open it in a browser and press → to step
through each slide (`a` reveals a whole slide). The diagrams on the demo slides load Mermaid from a
CDN, so they need a network connection; everything else works offline.

Every output in the deck was captured at home.conf `6937c15`. Two sets of inputs let you replay it.

## Keyless demos (`fixture/`)

A self-contained configuration, two modules and four documents. No judge key is needed.

```sh
npm ci && npm run build
sh docs/doc-verify-intro/fixture/run.sh
```

Expected: `docs/good.md` PASS (exit 0), `docs/bad.md` NO-GO with two findings (exit 1), and
`docs/decisions.md` NO-GO for the decision with no `#### Why` (exit 1). Add `--verbose` to the
command in `run.sh` to see the proof trees.

## Design demos (`demo/`)

These need the judge key (`.env.doc-verify`). Copy one document to `design/99-demo-scratch.md`, run

```sh
node doc-verify/dist/cli.js check --paths design/99-demo-scratch.md --profile promotion --verbose
```

and delete it afterwards. `99-bad-structure.md` and `99-bad-meaning.md` are NO-GO, and `99-good.md`
is PASS. The judge's probabilities vary slightly from run to run; the labels do not.

This directory is not governed by `.doc-verify.yaml`: it teaches the tool rather than taking part in
the workflow it checks.
