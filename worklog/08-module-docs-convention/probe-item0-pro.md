### module-docs-review-canonical (deepseek-v4-pro)
submit_decision({"action": "return-to-drafter", "reason": "The draft's Scope changes the contract of the report package (PASS semantics) but names no module documents from docs/modules/report/. Per flow-grill-review §0, a draft whose Scope changes a package's contract and names none of its module documents is a P1 blocker, reviewed before all else. The draft is returned to the drafter untouched."})
### module-docs-review-paraphrase (deepseek-v4-pro)
<submit_decision>
  <flow_action>flow:grill-review</flow_action>
  <status>draft</status>
  <next_step>Run the review gate on design/15-retry-policy.md. First run the P0 project-contract check, then plan attack angles. The Scope changes src/delivery/send.ts behavior (retry semantics) but names no module documents, and docs/modules/delivery/ contract promises "at most one attempt per event" — a direct contradiction with the proposed three retries. This is a P1 blocker under the module-docs order rule and must be reviewed before all else.</next_step>
</submit_decision>
