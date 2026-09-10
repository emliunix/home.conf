# 02 — Follow-up sweep: eval L2 sandbox

Status: draft-followup

Swept from `design/01-fact-based-eval.md` grill (worklog/01-fact-based-eval.md). No
obligation until picked up; on pickup, write the three heads and grill as a normal design.

## Functional unit: L2 sandboxed end-to-end

- **B7** — L1 decision cases observe a JSON decision, not filesystem behavior. A model
  can pick the right `write_target` while a real agent would still overwrite the worklog,
  paste retro prose into the design body, or omit `Superseded by:`. Build the release-level
  L2 layer per `design/01-fact-based-eval.md` §L2: a real agent run against a temp-dir
  fixture repo asserting the resulting filesystem (files changed, final `Status:` lines,
  append-not-overwrite worklog entries, `Superseded by:` on superseded designs).
- **B8** — The schema asserts write *target*, never write *content*. When L2 lands,
  high-risk write-target cases (retro prose, supersession) should gain content-level
  assertions; decide then whether content checks live in L1 (schema field) or only in L2
  (filesystem assertion).

## Functional unit: tooling hygiene

- **npm test blocker** — `devEngines` pins npm 12.0.2 (`onFail: "download"`); the shipped
  environment has npm 11.17.0, so `npm test` fails with EBADDEVENGINES and only
  `./node_modules/.bin/vp test --run` works. Decide: relax the pin, document the vp-first
  workflow as canonical, or provide a lock-regeneration path for contributors on stock
  npm. Disclosed at the 01 review gate; not blocking because the vp path is verified.
