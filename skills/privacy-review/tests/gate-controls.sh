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
G="$(git -C "$(dirname "$0")/../../.." rev-parse --show-toplevel)/skills/privacy-review/scripts/privacy_gate"
fail=0; n=0
gen() { python3 -c 'import base64,os;print("api_key = sk-"+base64.b32encode(os.urandom(20)).decode().lower().rstrip("="))'; }
ok()   { n=$((n+1)); echo "ok   $1"; }
bad()  { n=$((n+1)); fail=1; echo "FAIL $1"; }

W=$(mktemp -d); trap 'rm -rf "$W"' EXIT
cd "$W" || exit 1
git init -q; git config user.email t@t; git config user.name t
echo base > a.txt; git add -A; git commit -qm base
cp "$(dirname "$G")/../../../.gitleaks.toml" . 2>/dev/null || :
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
