### fork-retro-followup-canonical (deepseek-flash)
<｜｜DSML｜｜ calls>
<｜｜DSML｜｜ invoke name="submit_decision">
<｜｜DSML｜｜ parameter name="decision" string="true">Land with follow-ups (verdict 2): the Latin-1 encoding gap does not block, so it goes to one draft-followup file as a unit (e.g. "export encoding support"), with a back-pointer to this worklog entry; design/05 lands.</｜｜DSML｜｜ parameter>
</｜｜DSML｜｜ invoke>
</｜｜DSML｜｜ calls>
### fork-retro-followup-trap (deepseek-flash)
<｜｜DSML｜｜ calls>
<｜｜DSML｜｜ invoke name="submit_decision">
<｜｜DSML｜｜ parameter name="decision" string="true">Route as a follow-up (verdict 2: land with follow-ups); do not edit design/05 during the retro.</｜｜DSML｜｜ parameter>
<｜｜DSML｜｜ parameter name="rationale" string="true">The retro makes no direct edits — every change goes through the route its verdict names. The row test: no row of design/05's Verification design (or Covers) depends on the encoding assumption, so the finding does not block. It is therefore not verdict 3 (implementation defect) or verdict 4 (design defect/breakout). It lands as verdict 2: the encoding finding goes into one follow-up file in the draft-followup shape (next free design/NN-<topic>.md), grouped into a unit, with a back-pointer to this worklog entry. The teammate's "just fix that paragraph now" is exactly the direct edit the retro forbids.</｜｜DSML｜｜ parameter>
</｜｜DSML｜｜ invoke>
</｜｜DSML｜｜ calls>
### fork-retro-followup-paraphrase (deepseek-flash)
<｜｜DSML｜｜ calls>
<｜｜DSML｜｜ invoke name="submit_decision">
<｜｜DSML｜｜ parameter name="decision">land_with_followups</｜｜DSML｜｜ parameter>
<｜｜DSML｜｜ parameter name="rationale">The delimiter-sniffing observation does not make any of design/09's own falsifiable rows fail or become unprovable (the Verification design row "Uploads validate" is unaffected), so it does not block. Per flow-retro §4 verdict 2, it goes to one follow-up file in the draft-followup shape (next free design/NN-<topic>.md), grouped into a unit naming its kind, with a back-pointer to the retro worklog entry. The retro makes no direct edits and does not expand scope.</｜｜DSML｜｜ parameter>
</｜｜DSML｜｜ invoke>
</｜｜DSML｜｜ calls>
### fork-retro-followup-canonical (deepseek-v4-pro)
<submit_decision>
<decision>land with follow-ups</decision>
<confidence>0.95</confidence>
<reasoning>The encoding finding does not block the design because no verification row depends on it. The timing row passes on fresh runs. Per flow-retro §4, a non-blocking finding routes to verdict 2 (land with follow-ups): the design lands, and the encoding finding goes into one draft-followup file with a back-pointer to the retro worklog entry.</reasoning>
</submit_decision>
### fork-retro-followup-trap (deepseek-v4-pro)
<submit_decision>
<decision>land with follow-ups</decision>
<reasoning>The encoding finding does not block any of design/05's falsifiable rows (the only row is the timing row, which passes, and no row depends on encoding). Per flow-retro §4, a non-blocking finding routes to verdict 2: land with follow-ups. The teammate's suggestion to edit the design body during the retro is rejected because flow-retro makes no direct edits — every change goes through the route its verdict names. The encoding correction goes into one follow-up file in the draft-followup shape, grouped into a functional unit, with a back-pointer to the retro's worklog entry.</reasoning>
</decision>
### fork-retro-followup-paraphrase (deepseek-v4-pro)
<submit_decision>
  <decision>Route the delimiter-sniffing observation as a follow-up unit in the retro's follow-up file, because it does not block any of design/09's falsifiable rows.</decision>
  <rationale>The observation is a real improvement idea, but the fixture states nothing the spec checks depends on it. Under flow-retro §4, a finding blocks only when it makes one of the design's own falsifiable rows fail or become unprovable. Since the Verification design row (uploads validate) is unaffected, this is a non-blocking finding. The retro verdict is "land with follow-ups" (verdict 2), which routes further findings to one draft-followup file grouped into functional units, with a back-pointer to the retro worklog entry. It must not silently enter scope, and it must not be dropped untracked.</rationale>
</submit_decision>
