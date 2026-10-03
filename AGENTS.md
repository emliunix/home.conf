# Working in home.conf

Guidance for this repository only. Machine-wide conventions live in the generated
user-global file (`~/.agents-local/AGENTS.md`), not here. This file is hand-owned;
the composer does not write it.

## Skills are sources; generated files are not

`skills/*/SKILL.md` are the sources. Anything generated — this file is not one, but
the user-global target is — is built from snippets and must not be hand-edited.

## User-global guidance is composed, not hand-written

`user.AGENTS.md.snippets/manifest.yaml` is the authority for what the user-global
file contains and in what order. `AGENTS.md.compose.py` resolves each snippet
through an ordered root list and writes the result to `~/.agents-local/AGENTS.md`,
which is then installed into the agent runtimes.

```sh
python3 AGENTS.md.compose.py          # compose the user-global target
python3 AGENTS.md.compose.py --check  # exit 1 if it is out of date
python3 AGENTS.md.compose.py --install ~/.pi/agent/AGENTS.md --force
```

## Nothing machine-specific may be committed here

This repository is public. Live endpoints, account names, credential paths, host
ports, and anything derived from them belong to a snippet under a root outside the
repo — listed in `snippet_roots` and marked `local_only: true`. The repo contains
their identity and order, never their bodies; that separation is the only thing
keeping them unpublished.

## Reporting

Messages about work in this repo follow the shared brief form; see
`skills/report-style/SKILL.md` §"Style hot words" and the brief-by-default rule in
`skills/raft-group-chat/SKILL.md`.
