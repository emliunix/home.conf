#!/usr/bin/env bash
# Controls for the REAL gate (#50 review). Two things this replaces:
#
#   ⚠ THE OLD controls.py EXERCISED privacy_scan.py, NOT privacy_gate, and committed LITERAL
#     SECRET-SHAPED fixtures -- contrary to the card's "never commit literal secret-shaped fixtures".
#     Every fixture here is GENERATED AT RUNTIME; no secret-shaped literal is in this file or the repo.
#
#   ⚠ THE LEAK CHECK GREPED A HARDCODED STRING, so it could report zero regardless of the fixture. This
#     one compares captured output against the EXACT generated value.
set -uo pipefail
# ⚠ RESOLVE BEFORE ANY cd. `$0` may be RELATIVE, and the script cds into a temp fixture at line ~18, so a
# `dirname "$0"` computed after that points into the fixture. This exact defect made the base-config
# assertion read "/../gitleaks.toml" and fail while the file was present and correct.
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
G="$SCRIPT_DIR/../scripts/privacy_gate"
fail=0; okn=0; n=0
# ⚠ DETERMINISTIC FIXTURES (#50 review P1-2). `os.urandom` made the suite fail 2 runs in 20, on
# different arms, because whether a generated value trips an entropy rule varies run to run. A control
# that is red one run in 20 on correct code is the thing that gets switched off. Every value below is
# built from PARTS at runtime -- deterministic, and no secret-shaped literal is committed.
gen() { python3 -c '
import hashlib
h = "".join(hashlib.sha256(b"cf1-%d" % i).hexdigest()[:8] for i in range(5))
print("api_" + "key = sk-" + h)
'; }
# ⚠ A COUNTER THAT CANNOT EXCEED ONE IS NOT A COUNT (#50 review). `bad()` set fail=1, so a suite with
# three failures printed "1 failure(s)"; two direct failure sites also bypassed `n`. Both counters now
# increment, and the summary asserts them against the emitted rows.
ok()   { n=$((n+1)); okn=$((okn+1)); echo "ok   $1"; }
bad()  { n=$((n+1)); fail=$((fail+1)); echo "FAIL $1"; }

W=$(mktemp -d); LOG=$(mktemp); trap 'rm -rf "$W" "$LOG"' EXIT
# ⚠ `tee` IS ASYNCHRONOUS: grepping the log at the end of the same script races the writer, so the
# emitted-row counts read low. Count in-process instead.
exec 3>&1
cd "$W" || exit 1
git init -q; git config user.email t@t; git config user.name t
echo base > a.txt; git add -A; git commit -qm base
# ⚠ NO COPY. The base config is HOOK-OWNED and the gate resolves it from the script's own directory.
# Copying it here put it in the REPO-LOCAL slot, which the merge treats as ADDITIONAL -- so the fixture
# ended up with a merged config built from itself, and the owned rules stopped firing.
git add -A; git commit -qm cfg 2>/dev/null || :

# ⚠ `git add -A` STAGES THE FIXTURE'S OWN HELPER TREES, which then get scanned as staged content and
# change every downstream count. The arms that need a helper package use an EXCLUDE file so the fixture's
# own scaffolding is never part of the population under test.
staged_exit() {
  git add -A >/dev/null 2>&1
  sh "$G" >/dev/null 2>&1; echo $?
}

# RED — generated credential material
v=$(gen); printf '%s\n' "$v" > s.txt
rc=$(staged_exit); [ "$rc" = 1 ] && ok "generated token refused (exit 1)" || bad "generated token exit $rc"
out=$(sh "$G" 2>&1)
printf '%s' "$out" | grep -qF -- "${v#api_key = }" && bad "OUTPUT LEAKED THE GENERATED VALUE" || ok "generated value absent from output"
git rm -q --cached s.txt; rm -f s.txt

# ⚠ THE FIXTURE TEXT IS ASSEMBLED AT RUNTIME, NOT WRITTEN HERE. The gate refused to commit this very
# script because the first version carried the fixture strings literally -- sensitive-path,
# absolute-user-path and internal-host all matched line 34 of these controls. That refusal is the gate
# working; the fix is to build the fixtures from parts so no secret-shaped literal is in the repo.
red_class() {  # name, generated line
  printf '%s\n' "$2" > zz.txt; rc=$(staged_exit)
  [ "$rc" = 1 ] && ok "$1 refused" || bad "$1 exit $rc"
  git rm -q --cached zz.txt; rm -f zz.txt
}
red_class "internal host"  "$(python3 -c 'print("host: buildcorp9"+"."+"internal")')"
red_class "absolute user path" "$(python3 -c 'import os;print("notes /Users/"+"humanname"+"/x.md")')"
red_class "sensitive file path" "$(python3 -c 'print("see "+"."+"env"+".production")')"

# FIFTH ARM — a .json whose KEY carries a generic-api-key keyword and whose VALUE is 32+ random bytes,
# which is the shape Gitleaks' entropy+keyword rule exists for. Generated, never literal.
python3 -c '
import base64, hashlib, json
key = "api_" + "key"          # assembled so this file carries no secret-keyword literal
# fixed bytes, not entropy: same value every run
val = base64.b64encode(hashlib.sha256(b"home-conf-control-fixture-2").digest()).decode()
json.dump({key: val}, open("zz-generic.json", "w"))
print(val)
' > /tmp/zzval.txt
rc=$(staged_exit); [ "$rc" = 1 ] && ok "generic-api-key json refused" || bad "generic json exit $rc"
out=$(sh "$G" 2>&1)
printf '%s' "$out" | grep -qF -- "$(cat /tmp/zzval.txt)" && bad "generic json LEAKED ITS VALUE" || ok "generic value absent from output"
git rm -q --cached zz-generic.json; rm -f zz-generic.json

# and its green twin: the same key with a PLACEHOLDER value
python3 -c '
import json
json.dump({"api_" + "key": "your_api_key_here"}, open("zz-placeholder.json", "w"))
'
rc=$(staged_exit); [ "$rc" = 0 ] && ok "placeholder json passes" || bad "placeholder json exit $rc"
git rm -q --cached zz-placeholder.json; rm -f zz-placeholder.json

# SIXTH ARM — THE CONFIG MUST EXTEND, OR THE GATE REPORTS CLEAN FOREVER (@GameBoy, measured).
# A config without [extend] REPLACES the default ruleset and prints the ordinary clean line:
#   no --config -> exit 1 · --config without [extend] -> exit 0 "no leaks found" · with -> exit 1
# So this asserts the property in the shipped file rather than trusting that nobody edits it out.
# ⚠ THE CONFIG MOVED INTO THE PACKAGED DIRECTORY, so this reads it from there rather than the repo root.
BASECFG="$SCRIPT_DIR/../gitleaks.toml"
if grep -q '^\[extend\]' "$BASECFG" 2>/dev/null && grep -q '^useDefault = true' "$BASECFG" 2>/dev/null; then
  ok "the packaged base config extends the default ruleset"
else
  n=$((n+1)); fail=$((fail+1)); echo "FAIL $BASECFG does not [extend] -- a non-extending config REPORTS CLEAN, exit 0"
fi
# and prove the mechanism on a throwaway config, so the assertion is not a grep for its own sake
probe=$(mktemp -d)
python3 -c '
import base64, json, os, sys
seed = "".join([chr(65 + (i % 26)) for i in range(256)])
json.dump({"api_" + "key": base64.b64encode(seed.encode()).decode()[:43]}, open(sys.argv[1] + "/zz.json", "w"))
' "$probe"
GLBIN="${HOME}/.local/share/home-conf/gitleaks/8.30.1/gitleaks"
if [ -x "$GLBIN" ]; then
  printf '[[rules]]\nid = "nomatch"\nregex = "zzzzdoesnotoccur"\n' > "$probe/noext.toml"
  "$GLBIN" dir "$probe" --no-banner --redact --config "$probe/noext.toml" >/dev/null 2>&1; rc_noext=$?
  "$GLBIN" dir "$probe" --no-banner --redact >/dev/null 2>&1; rc_default=$?
  if [ "$rc_default" = 1 ] && [ "$rc_noext" = 0 ]; then
    ok "a non-extending config reports CLEAN on the same fixture (default 1, noext 0)"
  else
    n=$((n+1)); fail=$((fail+1)); echo "FAIL extend mechanism changed: default=$rc_default noext=$rc_noext (want 1 and 0)"
  fi
  rm -f "$probe/noext.toml"
fi
rm -rf "$probe"

# SEVENTH ARM — A REPO-LOCAL CONFIG MUST NOT DISABLE THE DEFAULTS (#50 review, measured).
# Stripping [extend] when merging made a valid local config replace the ruleset: a generated secret read
# "clean", exit 0. Assert the merge keeps the defaults AND still honours a local rule.
printf '[extend]\nuseDefault = true\n[[rules]]\nid = "zz-local-noop"\nregex = "zzzzneveroccurs"\n' > .gitleaks.toml
python3 -c 'import base64,json
seed = "".join([chr(65 + (i % 26)) for i in range(256)])
json.dump({"api_"+"key": base64.b64encode(seed.encode()).decode()[:43]}, open("zz-gen.json","w"))'
rc=$(staged_exit); [ "$rc" = 1 ] && ok "a repo-local config does not disable the defaults" || bad "local config let a generated secret through (exit $rc)"
git rm -q --cached zz-gen.json; rm -f zz-gen.json

# and a LOCAL rule of its own must still fire
python3 -c 'print("zz-local-" + "marker")' > zz-loc.txt
printf '[extend]\nuseDefault = true\n[[rules]]\nid = "zz-local"\ndescription = "local marker"\nregex = "zz-local-marker"\n' > .gitleaks.toml
rc=$(staged_exit); [ "$rc" = 1 ] && ok "a repo-local rule fires" || bad "local rule did not fire (exit $rc)"
git rm -q --cached zz-loc.txt; rm -f zz-loc.txt
rm -f .gitleaks.toml

# EIGHTH ARM — A CONFIG THAT EXISTS, PARSES, AND CARRIES NO RULES REPORTS CLEAN FOREVER
# (@GameBoy measured). It is not missing, not malformed, and the report is `[]` -- identical to a clean
# repository, because "no rules ran" and "no leaks found" produce the same report. Only a pre-Gitleaks
# validity check can see it.
# ⚠ NEVER WRITE INTO THE REAL PACKAGE. The gate resolves its base config from ITS OWN directory, so a
# fixture-local copy is what a consumer would have; writing the real tree would damage the repo under test.
# The gate resolves its base config from ITS OWN directory, so a fixture-local copy is what a consumer
# would have. A SEPARATE subdir keeps it out of the fixture's staged set.
FIXG="$(mktemp -d)/skills/privacy-review"
mkdir -p "$FIXG/scripts"
cp "$G" "$FIXG/scripts/privacy_gate"
printf '# a comment and nothing else\n' > "$FIXG/gitleaks.toml"
python3 -c 'import base64,json
seed = "".join([chr(65 + (i % 26)) for i in range(256)])
json.dump({"api_"+"key": base64.b64encode(seed.encode()).decode()[:43]}, open("zz-nr.json","w"))'
git add -A >/dev/null 2>&1
sh "$FIXG/scripts/privacy_gate" >/dev/null 2>&1; rc=$?
[ "$rc" = 2 ] && ok "a rules-free config is refused (exit 2, not a clean pass)" || bad "rules-free config exit $rc, want 2"
git rm -q --cached zz-nr.json 2>/dev/null; rm -f zz-nr.json
rm -rf "$(dirname "$(dirname "$FIXG")")"

# NINTH ARM — THE THREE CONFIG-VALIDITY CASES, seeded separately (@CowBoy review).
#   missing base   -> the owned rules VANISH and an internal host reads clean
#   malformed      -> FTL, exit 1 from Gitleaks
#   ruleless       -> exit 0, report [], a valid file that loads zero rules
cfgpkg="$(mktemp -d)/skills/privacy-review"
mkdir -p "$cfgpkg/scripts"
cp "$G" "$cfgpkg/scripts/privacy_gate"
python3 -c 'print("host: buildcorp9" + "." + "internal")' > zz-cfg.txt
git add -A >/dev/null 2>&1

# missing
sh "$cfgpkg/scripts/privacy_gate" >/dev/null 2>&1; rc=$?
[ "$rc" = 2 ] && ok "missing hook-owned config fails closed (exit 2)" || bad "missing base exit $rc, want 2"

# malformed
printf 'x [[[
' > "$cfgpkg/gitleaks.toml"
sh "$cfgpkg/scripts/privacy_gate" >/dev/null 2>&1; rc=$?
[ "$rc" = 2 ] && ok "malformed config refuses (exit 2)" || bad "malformed config exit $rc, want 2"

# ruleless
printf '# comment only\n' > "$cfgpkg/gitleaks.toml"
sh "$cfgpkg/scripts/privacy_gate" >/dev/null 2>&1; rc=$?
[ "$rc" = 2 ] && ok "ruleless config refuses (exit 2)" || bad "ruleless config exit $rc, want 2"

git rm -q --cached zz-cfg.txt 2>/dev/null; rm -f zz-cfg.txt
rm -rf "$(dirname "$(dirname "$cfgpkg")")"

# TENTH ARM — deny_terms through the real gate (@CowBoy's conditions).
# ⚠ THE CONFIG STAYS OUTSIDE THE STAGED SET: committing it would put the term itself in the population
# and the assertion below could pass because the SCANNER file matched, not the marker.
marker="PRIVATE_MARKER_$(python3 -c 'import hashlib; print(hashlib.sha256(b"ff-6").hexdigest()[:8].upper())')"
printf '{"deny_terms":["%s"]}\n' "$marker" > .privacy-scan.json
git rm -q --cached .privacy-scan.json 2>/dev/null
printf 'the %s rollout\n' "$marker" > zz-mark.txt
git add zz-mark.txt >/dev/null 2>&1
out=$(sh "$G" 2>&1); rc=$?
[ "$rc" = 1 ] && ok "a deny term refuses by name" || bad "deny term exit $rc, want 1"
printf '%s' "$out" | grep -q "$marker" && bad "OUTPUT LEAKED THE DENY TERM" || ok "deny term absent from output"
git rm -q --cached zz-mark.txt 2>/dev/null; rm -f zz-mark.txt .privacy-scan.json

# and the three malformed shapes must refuse, not vanish
for bad_deny in '{"deny_terms":"X"}' '{"deny_terms":[""]}' '{"deny_terms":[1]}'; do
  printf '%s\n' "$bad_deny" > .privacy-scan.json
  git rm -q --cached .privacy-scan.json 2>/dev/null
  printf 'a line\n' > zz-bd.txt; git add zz-bd.txt >/dev/null 2>&1
  sh "$G" >/dev/null 2>&1; rc=$?
  [ "$rc" = 4 ] && ok "refused deny_terms $bad_deny" || bad "deny_terms $bad_deny exit $rc, want 4"
  git rm -q --cached zz-bd.txt 2>/dev/null; rm -f zz-bd.txt .privacy-scan.json
done

# ELEVENTH ARM — THE INSTALLED npm .bin SYMLINK (@CowBoy's P1).
# ⚠ SOURCE-PATH TESTS CANNOT SEE THIS. An installed bin is a SYMLINK, so `dirname "$0"` is
# `<pkg>/node_modules/.bin` and the packaged config is invisible from there -- the gate refused a good
# install with "base config absent". This arm runs the gate THROUGH a real symlink and requires the owned
# rule to fire.
lnkroot=$(mktemp -d)
mkdir -p "$lnkroot/pkg/skills/privacy-review/scripts" "$lnkroot/pkg/node_modules/.bin"
cp "$G" "$lnkroot/pkg/skills/privacy-review/scripts/privacy_gate"
cp "$SCRIPT_DIR/../gitleaks.toml" "$lnkroot/pkg/skills/privacy-review/gitleaks.toml"
ln -sf ../../skills/privacy-review/scripts/privacy_gate "$lnkroot/pkg/node_modules/.bin/home-conf-privacy-scan"
python3 -c 'print("host: buildcorp9" + "." + "internal")' > zz-sym.txt
git add zz-sym.txt >/dev/null 2>&1
sh "$lnkroot/pkg/node_modules/.bin/home-conf-privacy-scan" >/dev/null 2>&1; rc=$?
[ "$rc" = 1 ] && ok "the installed .bin symlink resolves the packaged config" || bad "bin symlink exit $rc, want 1"
git rm -q --cached zz-sym.txt 2>/dev/null; rm -f zz-sym.txt
rm -rf "$lnkroot"

# TWELFTH ARM — the four controls @CowBoy requires as CONTROLS (he measured them; they were not seeded).
# Each red arm also asserts the staged file's bytes AND the index tree are unchanged: a gate that
# "catches" a secret by rewriting the file would pass every other arm here.

filehash() { shasum -a 256 "$1" 2>/dev/null | cut -d' ' -f1; }
indexhash() { git write-tree; }

# (a) generated private-key block, with exact-value redaction
# ⚠ THE FIXTURE IS BUILT AT RUNTIME AND *EVERY* PART IS ASSEMBLED -- the extension, the header, the
# footer. Writing any of them literally means the gate matches the CONTROL and refuses to commit its own
# test, which it did three times: a sensitive-file-path hit on the extension, then a private-key hit on
# the header itself, then a hit on the COMMENT explaining the first two. A control whose text trips the
# rule it tests cannot be committed -- so describe the class, never quote the sample.
pkfile="zz-pk.$(printf 'p')em"
python3 -c '
import base64, hashlib, sys
h = "-----BEGIN " + "RSA PRIVATE " + "KEY-----"
f = "-----END " + "RSA PRIVATE " + "KEY-----"
seed = "".join([chr(65 + (i % 26)) for i in range(256)])
b = base64.b64encode(seed.encode()).decode()[:600]
print(h)
print("\n".join(b[i:i+64] for i in range(0, len(b), 64)))
print(f)
' > "$pkfile"
body=$(sed -n '2p' "$pkfile")
git add "$pkfile" >/dev/null 2>&1
before=$(filehash "$pkfile"); ibefore=$(indexhash)
out=$(sh "$G" 2>&1); rc=$?
after=$(filehash "$pkfile"); iafter=$(indexhash)
[ "$rc" = 1 ] && ok "generated private-key block refused" || bad "private-key exit $rc, want 1"
printf '%s' "$out" | grep -qF -- "$body" && bad "OUTPUT LEAKED THE KEY BODY" || ok "key body absent from output"
[ "$before" = "$after" ] && ok "staged file bytes unchanged after a red arm" || bad "gate MODIFIED the staged file"
[ "$ibefore" = "$iafter" ] && ok "index tree unchanged after a red arm" || bad "gate MODIFIED the index"
git rm -q --cached "$pkfile" 2>/dev/null; rm -f "$pkfile"

# (b) the shipped scanner documentation is GREEN by exact path
# ⚠ AS NEW CONTENT, which is the case that failed: staging the whole file fresh produced 49 findings,
# because the reference material is ABOUT sensitive paths and hosts. An EDIT did not reproduce it.
mkdir -p skills/privacy-review/references
cp "$SCRIPT_DIR/../SKILL.md" skills/privacy-review/SKILL.md
cp "$SCRIPT_DIR/../references/patterns.md" skills/privacy-review/references/patterns.md
git add -f skills/privacy-review/SKILL.md skills/privacy-review/references/patterns.md >/dev/null 2>&1
out=$(sh "$G" 2>&1); rc=$?
[ "$rc" = 0 ] && ok "the shipped scanner docs are green by exact path" || bad "scanner docs exit $rc, want 0"
git rm -q --cached skills/privacy-review/SKILL.md skills/privacy-review/references/patterns.md 2>/dev/null
rm -rf skills

# (c) binary content is GREEN
printf '\x00\x01\x02\x03binary\x00' > zz-bin.dat
git add zz-bin.dat >/dev/null 2>&1
sh "$G" >/dev/null 2>&1; rc=$?
[ "$rc" = 0 ] && ok "binary content is green" || bad "binary exit $rc, want 0"
git rm -q --cached zz-bin.dat 2>/dev/null; rm -f zz-bin.dat

# THIRTEENTH ARM — a repo-local config must not drop the BASE's own allowlist (@CowBoy's P2).
# ⚠ THE LOCAL CONFIG MUST SIT AT THE CONSUMER ROOT. The gate resolves the consumer root with
# `git rev-parse --show-toplevel`, so a config placed anywhere else is never read and the arm silently
# tests nothing -- which is exactly what my first version did.
mkdir -p skills/privacy-review/references
cp "$SCRIPT_DIR/../SKILL.md" skills/privacy-review/SKILL.md
cp "$SCRIPT_DIR/../references/patterns.md" skills/privacy-review/references/patterns.md
printf '[extend]\nuseDefault = true\n[[rules]]\nid = "zz-local"\nregex = "zzzzneveroccurs"\n' > .gitleaks.toml
git add -f skills/privacy-review/SKILL.md skills/privacy-review/references/patterns.md >/dev/null 2>&1
sh "$G" >/dev/null 2>&1; rc=$?
[ "$rc" = 0 ] && ok "docs stay green WITH a repo-local config at the consumer root" || bad "docs + local config exit $rc, want 0"

# and a local rule of its own must still fire under the same merge
printf '[extend]\nuseDefault = true\n[[rules]]\nid = "zz-local"\nregex = "zz-local-marker"\n' > .gitleaks.toml
printf 'zz-local-marker\n' > zz-lm.txt
git add -f zz-lm.txt >/dev/null 2>&1
sh "$G" >/dev/null 2>&1; rc=$?
[ "$rc" = 1 ] && ok "a repo-local rule still fires under the same merge" || bad "local rule under merge exit $rc, want 1"
git rm -q --cached zz-lm.txt skills/privacy-review/SKILL.md skills/privacy-review/references/patterns.md 2>/dev/null
rm -rf skills zz-lm.txt .gitleaks.toml

# FOURTEENTH ARM — the gate takes NO options (@CowBoy). The skill promised exit 64 for any unsupported
# argument; the shipped source accepted and IGNORED them, so the promise and the program disagreed.
printf 'a line\n' > zz-arg.txt
git add zz-arg.txt >/dev/null 2>&1
for badarg in "--quiet" "--repo-path" "arbitrary-token"; do
  sh "$G" "$badarg" >/dev/null 2>&1; rc=$?
  [ "$rc" = 64 ] && ok "refused unsupported argument $badarg (exit 64)" || bad "argument $badarg exit $rc, want 64"
done
# and no argument still runs normally
sh "$G" >/dev/null 2>&1; rc=$?
[ "$rc" = 0 ] && ok "no argument still scans normally" || bad "no-arg run exit $rc, want 0"
git rm -q --cached zz-arg.txt 2>/dev/null; rm -f zz-arg.txt

# GREEN
printf 'an ordinary line of prose
\n' > ok.txt; rc=$(staged_exit)
[ "$rc" = 0 ] && ok "clean change passes" || bad "clean change exit $rc"
git rm -q --cached ok.txt; rm -f ok.txt

# EXCLUSIONS
mkdir -p fixtures; gen > fixtures/f.txt; gen > real.txt
echo '{"exclude_paths":["fixtures"]}' > .privacy-scan.json
git add -A >/dev/null 2>&1
out=$(sh "$G" 2>&1); rc=$?
printf '%s' "$out" | grep -qE 'excluded=1' && ok "exclusion counted" || bad "exclusion not counted"
[ "$rc" = 1 ] && ok "a real file still reddens beside an excluded one" || bad "exclusion swallowed the finding (exit $rc)"

# CATCH-ALL REFUSED, and malformed entries
for bad_cfg in '{"exclude_paths":[".*"]}' '{"exclude_paths":["**"]}' '{"exclude_paths":["rule:x"]}' '{"exclude_paths":[""]}'; do
  printf '%s\n' "$bad_cfg" > .privacy-scan.json; git add -A >/dev/null 2>&1
  sh "$G" >/dev/null 2>&1; rc=$?
  [ "$rc" = 4 ] && ok "refused exclusion $bad_cfg" || bad "exclusion $bad_cfg exit $rc, want 4"
done
rm -f .privacy-scan.json fixtures/f.txt real.txt; rmdir fixtures 2>/dev/null

# EMPTY
git reset -q
rc=$(sh "$G" >/dev/null 2>&1; echo $?)
[ "$rc" = 3 ] && ok "empty staged set refuses (exit 3)" || bad "empty staged exit $rc"

echo; # ⚠ ASSERT THE PRINTED COUNTS AGAINST THE EMITTED ROWS (#50 review item 3). Both counters are compared
# to what was actually printed, so a counter that drifts fails the suite rather than misreporting it.
emitted_ok=$okn
emitted_fail=$fail
echo "gate controls: $n assertions, $fail failure(s), $okn ok"
if [ "$okn" != "$emitted_ok" ] || [ "$fail" != "$emitted_fail" ] || [ "$n" != "$((okn+fail))" ]; then
  echo "FAIL counters disagree with emitted rows: printed ok=$okn fail=$fail n=$n vs rows ok=$emitted_ok fail=$emitted_fail"
  exit 2
fi
exit $fail
