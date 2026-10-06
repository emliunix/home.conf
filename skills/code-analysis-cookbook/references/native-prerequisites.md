# Native prerequisites: six ways "the package does not exist"

**Task.** Install, or diagnose the absence of, a library a build needs
(`pkg-config`-style dependencies). Every mechanism below was reproduced on this
host; the correctness action differs for each.

**The general form, and the reason this chapter exists.**

> **The error names the thing absent from the tool's search path — never the
> reason it is absent.** All six present as "the package does not exist", and
> the correction is different every time.

**Diagnose in this order.**

```bash
pkg-config --exists <name>            # 1/2/3/5 live here
pkg-config --variable pc_path pkg-config   # what dirs are searched at all
ls /opt/homebrew/opt/<formula>/lib/pkgconfig/   # is the .pc actually there?
brew info <formula>                    # keg-only? bottled? linked?
echo $CPATH $PKG_CONFIG_PATH           # compile-time vs configure-time search
```

**The six mechanisms.**

| # | mechanism | what it looks like | corrective action |
| --- | --- | --- | --- |
| 1 | **`pkg-config` itself absent** | every `pkgconfig-depends` test fails, naming the **library** | install the tool — it is never named in the error |
| 2 | **bottles installed but unlinked** | files exist under the Cellar with valid `.pc`; invisible | `brew install <f>` (or `brew link`) |
| 3 | **keg-only formula** | correct install, correct `.pc`, still invisible | set `PKG_CONFIG_PATH=/opt/homebrew/opt/<f>@<ver>/lib/pkgconfig` |
| 4 | **Linux-only formula on macOS** | a *requirement* failure (`"Linux is required"`), not a missing file | point `pkg-config` at the platform SDK, or build a local `.pc` shim |
| 5 | **module name ≠ `.pc` basename** | a correct install with a valid `.pc` still reports missing | **check the name you asked for** |
| 6 | **brew prefix off the include path** | a **compiler** error: a *header* is not found | set `CPATH` (see below) |

**Mechanism 5, measured.** `glog` is installed and `/opt/homebrew/opt/glog/lib/pkgconfig/libglog.pc`
exists — but pkg-config keys on the **basename**:

```
pkg-config --exists glog       -> no
pkg-config --exists libglog    -> yes
```
Before concluding a library is absent, query the `.pc` basename you can see on
disk, not the name you expected.

**Mechanism 6, measured — and it is the odd one out.** The other five are
*configure-time* and say "package not found". This one is *compile-time* and
names a **header**, so it reads like a different class of problem and the instinct
is to hunt for the C library rather than the include path:

```
brew --prefix                  -> /opt/homebrew     (NOT /usr/local)
CPATH                          -> <unset>
cc -E <<< '#include <glog/logging.h>'  -> fatal error: 'glog/logging.h' file not found
```
`pkg-config` can be entirely satisfied and the build still fails here. The fix is
`CPATH=/opt/homebrew/include` (or the formula's own `include`), not another
install.

**Failure modes of the *diagnosis* itself.**

| what you see | what it means |
| --- | --- |
| you set no `PKG_CONFIG_PATH` and report a keg-only library missing | mechanism 3, arriving at the diagnostician. Set the path **before** concluding anything. |
| you grepped the build log for "not found" and found the C library | mechanism 6's header error says "not found" too. Check whether the missing thing is a header or a `.pc`. |
| a library reports missing and you install it again | if it was already installed (bg `brew info`) you are in mechanism 2, 3, 5 or 6 — reinstalling changes nothing. |

**Provenance.** Mechanisms 1–4 and 6 measured by @GameBoy during the Glean
prerequisite chain (its native deps: `libxxhash → gflags → glog →
double-conversion → icu-uc → libunwind`); mechanism 5 found by @AstraBoy while
attempting to falsify that report, and it is the one that nearly produced a false
contradiction — the probe set no `PKG_CONFIG_PATH` and queried `glog` rather than
`libglog`, so **the diagnosis failed by two of its own mechanisms while checking
them.**
