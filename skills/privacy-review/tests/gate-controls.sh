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
fail=0; n=0
gen() { python3 -c 'import base64,os;print("api_key = sk-"+base64.b32encode(os.urandom(20)).decode().lower().rstrip("="))'; }
ok()   { n=$((n+1)); echo "ok   $1"; }
bad()  { n=$((n+1)); fail=1; echo "FAIL $1"; }

W=$(mktemp -d); trap 'rm -rf "$W"' EXIT
cd "$W" || exit 1
git init -q; git config user.email t@t; git config user.name t
echo base > a.txt; git add -A; git commit -qm base
# ⚠ NO COPY. The base config is HOOK-OWNED and the gate resolves it from the script's own directory.
# Copying it here put it in the REPO-LOCAL slot, which the merge treats as ADDITIONAL -- so the fixture
# ended up with a merged config built from itself, and the owned rules stopped firing.
git add -A; git commit -qm cfg 2>/dev/null || :

staged_exit() { git add -A >/dev/null 2>&1; sh "$G" >/dev/null 2>&1; echo $?; }

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
import base64, json, os
key = "api_" + "key"          # assembled so this file carries no secret-keyword literal
val = base64.b64encode(os.urandom(32)).decode()
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
n=$((n+1))
# ⚠ THE CONFIG MOVED INTO THE PACKAGED DIRECTORY, so this reads it from there rather than the repo root.
BASECFG="$SCRIPT_DIR/../gitleaks.toml"
if grep -q '^\[extend\]' "$BASECFG" 2>/dev/null && grep -q '^useDefault = true' "$BASECFG" 2>/dev/null; then
  ok "the packaged base config extends the default ruleset"
else
  fail=1; echo "FAIL $BASECFG does not [extend] -- a non-extending config REPORTS CLEAN, exit 0"
fi
# and prove the mechanism on a throwaway config, so the assertion is not a grep for its own sake
probe=$(mktemp -d)
python3 -c '
import base64, json, os, sys
json.dump({"api_" + "key": base64.b64encode(os.urandom(32)).decode()}, open(sys.argv[1] + "/zz.json", "w"))
' "$probe"
GLBIN="${HOME}/.local/share/home-conf/gitleaks/8.30.1/gitleaks"
if [ -x "$GLBIN" ]; then
  printf '[[rules]]\nid = "nomatch"\nregex = "zzzzdoesnotoccur"\n' > "$probe/noext.toml"
  "$GLBIN" dir "$probe" --no-banner --redact --config "$probe/noext.toml" >/dev/null 2>&1; rc_noext=$?
  "$GLBIN" dir "$probe" --no-banner --redact >/dev/null 2>&1; rc_default=$?
  n=$((n+1))
  if [ "$rc_default" = 1 ] && [ "$rc_noext" = 0 ]; then
    ok "a non-extending config reports CLEAN on the same fixture (default 1, noext 0)"
  else
    fail=1; echo "FAIL extend mechanism changed: default=$rc_default noext=$rc_noext (want 1 and 0)"
  fi
  rm -f "$probe/noext.toml"
fi
rm -rf "$probe"

# SEVENTH ARM — A REPO-LOCAL CONFIG MUST NOT DISABLE THE DEFAULTS (#50 review, measured).
# Stripping [extend] when merging made a valid local config replace the ruleset: a generated secret read
# "clean", exit 0. Assert the merge keeps the defaults AND still honours a local rule.
printf '[extend]\nuseDefault = true\n[[rules]]\nid = "zz-local-noop"\nregex = "zzzzneveroccurs"\n' > .gitleaks.toml
python3 -c 'import base64,json,os;json.dump({"api_"+"key":base64.b64encode(os.urandom(32)).decode()},open("zz-gen.json","w"))'
rc=$(staged_exit); [ "$rc" = 1 ] && ok "a repo-local config does not disable the defaults" || bad "local config let a generated secret through (exit $rc)"
git rm -q --cached zz-gen.json; rm -f zz-gen.json

# and a LOCAL rule of its own must still fire
python3 -c 'print("zz-local-" + "marker")' > zz-loc.txt
printf '[extend]\nuseDefault = true\n[[rules]]\nid = "zz-local"\ndescription = "local marker"\nregex = "zz-local-marker"\n' > .gitleaks.toml
rc=$(staged_exit); [ "$rc" = 1 ] && ok "a repo-local rule fires" || bad "local rule did not fire (exit $rc)"
git rm -q --cached zz-loc.txt; rm -f zz-loc.txt
rm -f .gitleaks.toml

# GREEN
printf 'an ordinary line of prose\n' > ok.txt; rc=$(staged_exit)
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

echo; echo "gate controls: $n assertions, $fail failure(s)"
exit $fail
