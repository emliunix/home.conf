# setup/ — durable build/runtime recipes for host tools

Each subdirectory is a recipe for a **tool that does not install cleanly from a
system package manager on this host**, kept here so it has a HEAD. The pattern is
the same one used for `skills/`: the real files live in this repository, and the
conventional global path is a symlink to them, so the path everyone names is also
the path under version control.

## Why these are versioned rather than left in place

`~/Documents/glean-setup/` was unversioned until 2026-10-04. In one session it was
revised three times and a reported correction **did not land**: the author
believed the file was fixed, and the only reason it was caught is that a reader
checked the file's mtime instead of trusting the message. A recipe with no HEAD
cannot answer "did the correction land", and `git status` answers it instantly.
That is the same finding the cookbook recorded as *"a claim of correction is not
the correction — the artifact is the authority."*

## Recipes

| recipe | conventional path | what it builds |
| --- | --- | --- |
| `glean/` | `~/Documents/glean-setup/` (symlink to `setup/glean/`) | Glean in a Linux container, because the native macOS build fails on `sys/inotify.h` |

## Adding one

Put the real files under `setup/<tool>/`, then point the conventional path at it:

```sh
ln -s home.conf/setup/<tool> ~/Documents/<tool>-setup
```

## After a fresh clone

The symlinks are machine-local and **not tracked**, so a fresh clone has the
recipe files but none of the conventional paths. Recreate them with the script
(idempotent; refuses to clobber a real file or a foreign symlink):

```sh
sh setup/link.sh
```

It links every subdirectory of `setup/` to `~/Documents/<name>-setup`, which is
the convention in the table above. `git ls-files setup` names what should have a
link; a table row with no link is a missing convenience, not a missing artifact.

Record in the recipe's own README what is measured and what is not. An unmeasured
arm is a legitimate state; an unlabelled one is not.
