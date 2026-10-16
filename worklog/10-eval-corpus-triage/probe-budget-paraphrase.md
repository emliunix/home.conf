### budget-paraphrase (deepseek-flash)
<｜｜DSML｜｜ calls>
<｜｜DSML｜｜ invoke name="submit_decision">
<｜｜DSML｜｜ parameter name="decision" string="true">Audit communication before another code round: rewrite the dispatch brief (expected output format, acceptance evidence, gate) rather than re-dispatching implementation. This is round 3 of the round budget, where vague brief / mis-specified gate / wrong acceptance evidence are the prime suspects; the design stays `reviewed` and no status change occurs.</｜｜DSML｜｜ parameter>
</｜｜DSML｜｜ invoke>
</｜｜DSML｜｜ calls>
### budget-paraphrase (deepseek-v4-pro)
<submit_decision>
  <decision>Audit communication before touching code again</decision>
  <rationale>Three dispatch-and-report cycles on the same reviewed design have bounced, each with a different misreading of the expected output format. This is rounds 3–4 territory under flow-common's round budget: audit COMMUNICATION before touching code again — vague brief, non-deterministic fixture, dropped enumeration, mis-specified gate, or wrong acceptance evidence are the prime suspects. Rewrite the brief much more than the code. The next move is not another implementation dispatch, not a design change, and not a retro — it is a communication audit of the dispatch brief and expected-output specification.</rationale>
</submit_decision>
