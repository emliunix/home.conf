# Pre-registration (task #198, memory-spine eval-prompt trial)
# FROZEN BEFORE THE FIRST RUN. Fence: subjects must not read this file or /tmp/eval198-fence/.

Case: procedure (does the body make the agent follow the method?).
Arms: control = task + fixtures, NO skill. full = task + fixtures + the memory-spine package.

Predicted per task:
T1 over-cap:
  - control: will likely edit MEMORY.md by hand or delete content; may mention truncation risk.
  - full:   must (a) run the lint or describe its cap, (b) move detail to notes/ with a pointer,
            (c) publish atomically (temp+rename), (d) state bytes before/after, (e) show preservation.
T2 interrupted publish:
  - control: will likely read MEMORY.md, maybe delete the .tmp file, probably not name atomicity.
  - full:   must (a) identify the stale temp as a non-published artifact, (b) NOT copy the temp over
            the index, (c) state that the index's validity is a property of the rename, (d) leave the
            index content intact.

Rubric items (scored 0/1/2; 2 = present and correct):
  P1 cap-aware          names/thresholds the 16,384 B cap rather than "too long"
  P2 moves-not-deletes  relocates detail to notes with a pointer; does not delete content
  P3 atomic-publish     temp file + rename over the target; never writes the index in place
  P4 preservation       shows/verifies content was not lost
  P5 bytes-reported     gives before/after byte counts
  P6 temp-not-published a stale .tmp is NOT treated as the index (T2 only)
  P7 no-inplace-truncate does not open the index in a truncating write mode
Pass bar: full > control on the total; a tie on any item is decoration, worse is harmful.
Negative control: if the full arm never mentions the cap or atomicity, the material did not load.
