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
python3 AGENTS.md.compose.py --allow-outside-root                      # compose the user-global target
python3 AGENTS.md.compose.py --check                                   # read-only; exit 0/1/3
python3 AGENTS.md.compose.py --allow-outside-root --install ~/.pi/agent/AGENTS.md
```

**`--allow-outside-root` is required for every write outside this repository**, and the
user-global target is outside it — so it is part of the ordinary form, not an exception. It exists
to make the writer state its destination: a scratch checkout composes to the same home-anchored
file as the canonical one, and `output:` is what decides that, not where you ran the command.

**The composer records what it last wrote** in `<destination>.stamp` (a sha256 of the exact bytes).
That record is what lets it tell a legitimate recompose — a snippet changed, so the composed bytes
changed — from a hand-added block, which it **refuses** and preserves. **It never overwrites content
it did not write without `--force`**, and every overwrite is backed up beside the file first.

`--force` replaces content this composer did not write, after taking a backup. It is **not** part of
a normal install and **not** a way to silence a destination refusal (a symlink destination, or one
outside the repository, needs the right invocation, not the override).

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
