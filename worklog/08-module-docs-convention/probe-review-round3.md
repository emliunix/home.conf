### module-docs-review-canonical (deepseek-flash)
I'll decide the single next flow action for this draft.
<｜｜DSML｜｜ calls>
<｜｜DSML｜｜ invoke name="submit_decision">
<｜｜DSML｜｜ parameter name="decision">run_p0_project_contract_check_first</｜｜DSML｜｜ parameter>
<｜｜DSML｜｜ parameter name="rationale">The draft has just been submitted for review and no angle has run yet. Per flow-grill-review §0, the P0 project-contract check is always the FIRST review item, before any attack angle runs. The fixture supplies a concrete contract to test against: the package's module contract defines PASS as "no constraint fails". The draft's Scope changes `src/report.ts` and `src/engine/index.ts` so an incomplete run reports BLOCKED instead of PASS — this is a change to the meaning of the PASS verdict itself, which the module contract currently defines. That is exactly the kind of contract-level conflict item 0 exists to catch, and it must be weighed before anything below it. So the next action is to run the P0 project-contract check against the draft's heads and body (and the named module documents `docs/modules/report/{contract,model,properties,verification}.md`), not to plan attack angles or dispatch a reviewer yet.</｜｜DSML｜｜ parameter>
</｜｜DSML｜｜ invoke>
</｜｜DSML｜｜ calls>
### module-docs-review-trap (deepseek-flash)
I'll evaluate this case against the flow lifecycle contract.
The draft is submitted for review. Key facts:
- Design `14-report-coverage.md` has the three heads (Problem statement, Scope, Rationale) and `Status: draft`.
- Scope names `src/report.ts` and `src/engine/index.ts` — but the draft changes a package and names **no module document** in Scope. The Draft contract requires: "It names the module documents (`docs/modules/<pkg>/`, convention in `project-skeleton` § Module docs) the design changes; a draft that changes a package and names none is returned to the drafter."
- The drafter explicitly defers the module doc (`docs/modules/report/contract.md`) to "after merge" — but that contract defines PASS as "no constraint fails", which the design directly contradicts. Module documents must be updated **before** code (`flow-common` Implementation gate: "the module documents the design's Scope names are updated from the design... Code follows the documents, not the reverse").
The precondition gate: "Design draft exists on disk **and satisfies the Draft contract below** — a draft missing it is returned to the drafter untouched (cheap gate; prevents review churn)."
This draft fails the Draft contract (no module document named in Scope, and the named contract is deferred). So it is returned to the drafter untouched — review does not start.
<｜｜DSML｜｜ calls>
<｜｜DSML｜｜ invoke name="submit_decision">
<｜｜DSML｜｜ parameter name="decision">Return the draft to the drafter untouched; do not start the review gate.</｜｜DSML｜｜ parameter>
<｜｜DSML｜｜ parameter name="reason">The draft fails the Draft contract precondition. Its Scope changes packages (`src/report.ts`, `src/engine/index.ts`) but names no module document, and the drafter explicitly defers `docs/modules/report/contract.md` to "after merge" — yet that contract defines PASS as "no constraint fails", which this design directly contradicts. Module documents must be updated from the design before code, not after merge. Per flow-grill-review Preconditions, a draft missing the Draft contract is returned to the drafter untouched (cheap gate; prevents review churn). The drafter must name the module document in Scope and reconcile the contract as part of the design, not defer it.</｜｜DSML｜｜ parameter>
</｜｜DSML｜｜ invoke>
</｜｜DSML｜｜ calls>
### module-docs-review-paraphrase (deepseek-flash)
I'll analyze this case against the flow lifecycle contract.
The design is at `Status: draft`, just handed in for review. Per `flow-grill-review`, the first review item is always the **P0 project-contract check**, and the draft must satisfy the **Draft contract** (three heads present).
Key observations:
- The three heads (Problem statement, Scope, Rationale) are present.
- The Scope names `src/delivery/send.ts` but the design changes the delivery package's behavior — the module documents live in `docs/modules/delivery/`, and the contract page promises "at most one attempt per event." The design's retry behavior directly contradicts the module document's contract. Per the Draft contract, a draft that changes a package and names no module documents is returned to the drafter.
The next action is the review gate: an independent reviewer runs the P0 check and attack angles. The draft contract violation (module documents not named / contradicting the contract page) is a precondition failure.
<｜｜DSML｜｜ calls>
<｜｜DSML｜｜ invoke name="submit_decision">
<｜｜DSML｜｜ parameter name="decision">run_review_gate</｜｜DSML｜｜ parameter>
<｜｜DSML｜｜ parameter name="rationale">The design is at Status: draft and has just been handed in for review, so the next flow action is the review gate (flow-grill-review). The first review item is always the P0 project-contract check, followed by the Draft contract check and the planned attack angles. The draft presents the three heads, but its Scope changes the delivery package while naming no module documents, and the delivery package's contract page (docs/modules/delivery/) promises callers "at most one attempt per event" — directly contradicted by the design's three-retry behavior. Under the Draft contract, a draft that changes a package and names none of its module documents is returned to the drafter untouched; the contract-page contradiction is a blocker-class finding. So the plan enters the review gate, where the P0/Draft-contract check runs first and the module-document omission plus the contract contradiction are raised as findings before any attack angle is weighed.</｜｜DSML｜｜ parameter>
</｜｜DSML｜｜ invoke>
</｜｜DSML｜｜ calls>
### module-docs-review-canonical (deepseek-v4-pro)
<submit_decision>
  <flow_action>flow-grill-review</flow_action>
  <status>draft</status>
  <next_step>Run the review gate on design/14-report-coverage.md: first the P0 project-contract check, then plan attack angles (schema/code scenario rows plus the three heads), then dispatch a single independent reviewer seat with the draft path, planned angles, source paths, the three heads excerpted, and the module contract PASS definition as evidence context.</next_step>
  <reason>The draft is a fresh design at Status: draft that has just been submitted for review and no angle has run yet. The correct next flow action is the review gate of flow-grill-review, which starts with the P0 project-contract check and then plans and dispatches the independent review. The draft satisfies the Draft contract (three heads present and substantive), so it is not returned to the drafter. No implementation or retro action is authorized before the review gate passes.</reason>
</submit_decision>
### module-docs-review-trap (deepseek-v4-pro)
<submit_decision>
<decision>Return the draft to the drafter untouched: it fails the Draft contract precondition because the Scope names no module document even though the design changes a package, and the drafter's proposal to update docs/modules/report/contract.md after merge is rejected — module documents must be updated before code, not after.</decision>
<reason>The Draft contract in flow-grill-review requires every design's Scope to name the module documents it changes, and a draft that changes a package and names none is returned to the drafter. Here the Scope touches src/report.ts and src/engine/index.ts but names no docs/modules/<pkg>/ document. The drafter's own statement confirms docs/modules/report/contract.md is affected and would need updating, but proposes deferring it until after merge. flow-common's implementation gate requires module documents named in the design's Scope to be updated before code, and flow-grill-review's precondition gate returns a draft missing the contract untouched to prevent review churn. The ten-line size is irrelevant; the contract is about presence of the required heads and orientation, not page count.</reason>
</submit_decision>
### module-docs-review-paraphrase (deepseek-v4-pro)
<submit_decision>
<decision>Return to drafter untouched: the draft fails the Draft contract precondition.</decision>
<reasoning>The draft is missing the required Scope element that names the module documents the design changes. It modifies `src/delivery/send.ts` but names no module document, and the existing contract page at `docs/modules/delivery/` promises "at most one attempt per event" — a direct contradiction the draft does not address. Per flow-grill-review Preconditions, a draft missing the Draft contract is returned to the drafter untouched as a cheap gate to prevent review churn.</reasoning>
</submit_decision>
