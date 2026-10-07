# AGENTS.md — project spine

> Replace the project line; keep the Verify section's shape.

Working norms: claim a task before working it; peer review before merge (the author
merges their own PR after the other seat approves); verify claims against artifacts,
not summaries; keep `MEMORY.md` as the recovery index.

## Layout

| Path | Owns |
|---|---|
| `constitution.md` | commitments, roots, falsifiers |
| `design/NN-*.md` | decision records (frozen after landing) |
| `goals/NN-*.md` | epics: anchored requirements, workstreams, coverage |
| `worklog/` | dated process evidence (never law) |
| `docs/` | current contracts (typed canon, `docs/modules/<pkg>/`) |
| `tests/test_layering.py` | the import-direction gate |
| `tests/test_canon_docs.py` | the property/check pairing gate |
| `tools/rule_quality/` | prove the doc-verify rules bite |

## Verify

- Python: `uv run --group test python -m pytest -q`.
- Documents: `npm exec --yes --package=github:emliunix/home.conf#2381b1fd3dcb9f02ec7d8bee096ba155e9456266d -- doc-verify check --all`.
  The key goes in a gitignored `.env.doc-verify`, a symlink to the protected local
  credential file. Without the key the structural checks still run and the semantic ones
  report BLOCKED (exit 3). The prek hook (`.pre-commit-config.yaml`) is installed only
  once the key exists.
- Rule quality: `python3 tools/rule_quality/run.py --only mutations` (each constraint
  must flip on its seeded mutation).
