---
id: verified-instruments
title: A claim is only as good as its instrument
---

Before you state a fact or a verdict, name the instrument that produced it, and
say what that instrument would have printed if the claim were false. A result
that cannot differ between the two cases does not support the claim, however
green it looks.

Three failures in one session were the same mistake in three disguises: the
instrument ran, produced output, and never exercised the thing the claim was
about.

- **A moved ref makes every derived claim stale.** Before any "first commit",
  "exists", "absent", or "N behind", run `git fetch` and query a **named remote
  ref** (`origin/<branch>`). A shared checkout's local branch and a cached
  `origin/*` are readings, not properties. *The real first commit of a hook was
  `4920b559` on `origin/main`; the shared checkout's stale `main` made it read as
  `1fd1bb62`.*

- **A cached PASS is not a PASS.** A verdict served from a cache proves the cache
  held a verdict — not that the check ran, and not that the thing under test is
  reachable. When the claim is about the check, force a live call the cache has
  not seen (change the input, then re-run). *A judge-key "proof" came from the
  hook's cache with no call to the judge at all.*

- **A test that passes is not a test that exercised the behavior.** Assert
  against the real artifact, not a proxy for it. A fake that answers in the wrong
  shape plus a swallowed error yields a green test that never performed the read
  it claims to cover. *A test showed a signed request went out while the file
  read it was meant to prove had never worked.*
