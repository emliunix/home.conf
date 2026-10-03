# glean-setup — build/runtime recipe for Glean in a Linux container

Purpose: run Glean on this macOS host, where it cannot be built natively. Tasks
#103 / #108. This directory is the **build/runtime recipe only**; index storage is
a separate surface (`~/Documents/glean-indexes/{project}/`).

**Where this lives.** The real files are here, in `home.conf`; the path people
name, `~/Documents/glean-setup/`, is a symlink to this directory. That is
deliberate — an unversioned recipe cannot answer *"did that correction land"*, and
this one briefly could not (see `setup/README.md`). Commit the change here and the
conventional path updates with it.

## Why a container at all

Glean's executable has an **unconditional `hinotify` dependency** — a wrapper for
the Linux kernel's inotify feature needing `sys/inotify.h`. macOS has no such
header, so the build cannot complete on the host. A Linux container is the
smallest runtime that supplies the API. This is one platform API, not a
deployment preference.

## Why the base image is TRIXIE, not bookworm

Measured, and it is a genuine conflict rather than a preference:

```
glean's rocksdb binding needs rocksdb/advanced_cache.h
    bookworm librocksdb-dev 7.8.3 -> ABSENT      trixie -> PRESENT
glean's regex-pcre (PCRE1) needs pcre.h
    bookworm has libpcre3-dev     -> present     trixie DROPPED it (pcre2 only)
```

Each release supplies exactly one of the two, so no single base satisfies both.
trixie is the base because the rocksdb header is a hard C++ dependency *inside*
glean, while PCRE1 is a small standalone library built from source in under a
minute (step 8 of the Dockerfile).

## Build

```sh
podman build -t local/glean:ghc9.6.6 .
```

The Dockerfile uses `set -euxo pipefail` and **no error-swallowing**. An earlier
revision ended its apt line with `|| true`, which left the image without `curl`,
so the ghcup bootstrap failed silently through a pipe and only surfaced much
later as `cabal: not found` — two layers of concealment for one missing package.

## Run (standalone mode — the mode that is measured to work)

```sh
podman run --rm \
  -v ~/Documents/Glean/glean:/glean:ro \
  -v ~/Documents/glean-indexes/${PROJECT}:/indexes:rw \
  local/glean:ghc9.6.6 sh -c '
    export PATH=/root/.cabal/bin:$PATH
    glean --db-root /indexes --schema /glean/schema/source list'
```

## ⚠ What is measured, and what is not

**Works:** `create` / `write` / `derive` / `query`; the source indexer on a
compiler-produced `.hie` (`hs.ValBind`, `hs.XRef` with typed targets and byte
spans, `src.File`); and the **stale/partial arm in standalone mode** —
`glean list` reports `(incomplete)` before `glean finish` and `(complete)` plus a
separate `Completed:` timestamp after.

**Server mode: measured, and an earlier note here was wrong.** It said
`glean-server` logs `server alive on port 9999` while binding nothing and needing
a `--server-config`. **Both halves were instrument errors:**

- **It binds the IPv6 wildcard**, so `awk '$4=="0A"' /proc/net/tcp` is **empty** —
  that file is IPv4-only. The same filter on `/proc/net/tcp6` shows the port
  (`270F` = 9999). `Server.hs:104` logs the port the server actually bound.
- **`Bad Gateway` is the container's proxy, not the server.** This image sets
  `HTTP_PROXY`/`HTTPS_PROXY` to `host.containers.internal:7897` and the glean
  client is HTTP-based, so a call to `localhost` is answered 502 by the proxy.
  **Unset the proxy variables for local service calls** and the same call to the
  same server returns exit 0.

**Server-mode completeness is visible and typed** (measured 2026-10-04, both
states in one listing, `finish` issued through the server):

```
glean --service localhost:9999 list
  NAME/INSTANCE (incomplete)   Created: …            before `glean finish`
  NAME/INSTANCE (complete)     Created: … / Completed: …
```

A **zero-fact** `finish` is refused with an explicit escape hatch —
*"Database has no facts. Use `--allow-zero-facts` to allow this."* — which is a
good refusal, not a silent success.

## Two traps worth knowing before you query

1. **The database must be created by the indexer**, not from `glean/schema/source`
   — otherwise the batch schema ID and the DB schema ID disagree and the write is
   killed: *"schema ID in batch (7cb6848b…) does not match schema ID of DB
   (66a80a62…)"*. The message names both IDs, which is why it is a usable refusal.
2. **Glean does not parse source.** `hie-indexer`'s positional argument is a
   *"tree containing `.hie` files"*, which Haskell produces with
   `ghc -fwrite-ide-info` — a full compile. **So "ingest this repository" has a
   language-specific prerequisite that is a build, not a flag.**
3. **Angle refuses a variable used only once.** `hs.ValBind { name = N }` is a
   `BadQuery`; the working form is `hs.ValBind _`.
