# 12 - Module docs convention follow-ups

Follow-up file from the retro of design 08 (module docs convention):
[worklog/08-module-docs-convention.md](../worklog/08-module-docs-convention.md),
§ Retrospective - re-close after round 4 (2026-10-17). It carries no obligation
until someone picks it up; a unit picked up becomes the scope of a normal design,
and the heads are written then.

## Unit 1 - A mechanical check that Scope names the module documents

Kind: new feature (document rules).

The review-stage rule held only after a P1 sentence at review item 0; before that,
neither model applied it unprompted (worklog C7–C8). A deterministic check makes it
independent of the reviewer: a design whose Scope names a package's code must name
that package's `docs/modules/<pkg>/` documents. It fits as a conditional section in
the typed document outlines the owner-forwarded survey of document rules proposes,
decided from a fact the engine already has (a path under the package's source).

## Unit 2 - A retro-stage case for the clause only §5 adds

Kind: clean-up (eval corpus).

The `module-docs-retro-*` cases are decided by the row test alone; removing §5's
sentence does not change them. The clause §5 adds is "any other mismatch is a
follow-up unit": a module document that disagrees with the build without
contradicting a row. Its case needs a schema that scores the follow-up act
(design 11 unit 1).

## Unit 3 - Design 08's Scope sentence on the retro check

Kind: docs clean-up.

Design 08's Scope says a module-docs mismatch at retro "is a bounded correction";
design 09 replaced that with "a contradiction blocks, any other mismatch is a
follow-up unit", which is what `flow-retro` §5 says. Design 08 is landed, so this
moves only through a design, or through the non-semantic correction rule (design 11
unit 8) if it lands.

## Unit 4 - One home for the review-stage rule

Kind: process or docs optimization (skill text).

The rule is stated twice in `flow-grill-review` with two outcomes: the Draft
contract returns such a draft to the drafter before review, and §0 makes it a P1
raised in review (worklog/08, corrections of 2026-10-18). Pick one consequence, and
place the §0 sentence so that §0's "if the project has none, skip this step" (about
the P0 contract) does not also skip it. A skill edit moves the stage-vs-act class
(design 11 unit 1), so the whole corpus re-runs after it.

## Status

draft-followup
