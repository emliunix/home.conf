#!/usr/bin/env sh
# setup-gitleaks -- install the exact pinned Gitleaks the privacy gate runs. No PATH fallback.
#
# ⚠ A PIN VERIFIED ON A MACHINE THAT ALREADY HAS THE BINARY PROVES NOTHING (#50, @GameBoy). This
# downloads a named artifact, verifies it against a named checksum, and installs it to a path the gate
# runs explicitly. If the download or the check fails, it fails BY NAME -- it never falls back to
# whatever `gitleaks` happens to be on PATH, because that is an ambient binary wearing a pin's clothes.
set -eu

VERSION=8.30.1
ARTIFACT="gitleaks_${VERSION}_darwin_arm64.tar.gz"
SHA256=b40ab0ae55c505963e365f271a8d3846efbc170aa17f2607f13df610a9aeb6a5
DEST="${1:-$HOME/.local/share/home-conf/gitleaks/$VERSION}"

# ⚠ THE ROUTE IS FLAKY, NOT BLOCKED, AND THAT CHANGES WHAT TO RECORD (@GameBoy, corrected).
# I first reported `github.com` as unreachable from this host on one 000-after-75s observation. Re-measured
# by both of us: the release URL returns 200 repeatedly, and `git ls-remote https://github.com/golang/go`
# -- the exact command prek reported as failing -- exits 0. The 75s failure was TRANSIENT.
#
# So the durable facts are the CHECKSUM (the integrity control) and a RETRY/TIMEOUT BUDGET (so a consumer
# that sees a 000 retries rather than reading "blocked"). The route is an implementation detail.
api="https://api.github.com/repos/gitleaks/gitleaks/releases"
rel="$api/tags/v$VERSION"
asset="$api/assets"

mkdir -p "$DEST"
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT

echo "setup-gitleaks: fetching $ARTIFACT (route: API asset endpoint)"
asset_id=$(curl -sSL --max-time 60 --retry 2 "$rel" \
  | python3 -c 'import json,sys
d=json.load(sys.stdin)
for a in d.get("assets",[]):
    if a["name"]==sys.argv[1]: print(a["id"]); break
else: raise SystemExit("setup-gitleaks: artifact not listed in the release")' "$ARTIFACT") || {
  echo "setup-gitleaks: could not resolve $ARTIFACT in the v$VERSION release" >&2; exit 1; }

# ⚠ A TRANSIENT 000 MUST NOT READ AS "HOST BLOCKED". Three attempts, then fail by name.
fetched=0
for attempt in 1 2 3; do
  if curl -sSL --max-time 180 --retry 2 --retry-delay 1 \
      -H "Accept: application/octet-stream" -o "$tmp/$ARTIFACT" "$asset/$asset_id" 2>/dev/null; then
    fetched=1; break
  fi
  echo "setup-gitleaks: download attempt $attempt failed; retrying" >&2
  sleep 1
done
if [ "$fetched" != 1 ]; then
  echo "setup-gitleaks: could not download $ARTIFACT after 3 attempts" >&2
  echo "  (a transient network failure looks like this; the checksum below is the integrity control)" >&2
  exit 1
fi

actual=$(shasum -a 256 "$tmp/$ARTIFACT" | cut -d' ' -f1)
if [ "$actual" != "$SHA256" ]; then
  echo "setup-gitleaks: CHECKSUM MISMATCH for $ARTIFACT" >&2
  echo "  expected $SHA256" >&2
  echo "  actual   $actual" >&2
  exit 1
fi
echo "setup-gitleaks: checksum ok ($actual)"

tar xzf "$tmp/$ARTIFACT" -C "$tmp" gitleaks
install -m 0755 "$tmp/gitleaks" "$DEST/gitleaks"

got=$("$DEST/gitleaks" version)
if [ "$got" != "$VERSION" ]; then
  echo "setup-gitleaks: installed binary reports '$got', expected '$VERSION'" >&2; exit 1
fi
echo "setup-gitleaks: installed $DEST/gitleaks ($got)"
