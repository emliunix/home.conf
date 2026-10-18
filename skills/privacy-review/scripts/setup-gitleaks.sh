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

# ⚠ THE FETCH ROUTE IS RECORDED BECAUSE IT VARIES BY HOST. On this host `github.com` is unreachable
# (curl -> 000 after 75s) while the API and asset hosts are not, so the asset API is the working route.
# The checksum is what makes either route safe; the route is what a clean consumer reproduces.
api="https://api.github.com/repos/gitleaks/gitleaks/releases"
rel="$api/tags/v$VERSION"
asset="$api/assets"

mkdir -p "$DEST"
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT

echo "setup-gitleaks: fetching $ARTIFACT (route: API asset endpoint)"
asset_id=$(curl -sSL --max-time 60 "$rel" \
  | python3 -c 'import json,sys
d=json.load(sys.stdin)
for a in d.get("assets",[]):
    if a["name"]==sys.argv[1]: print(a["id"]); break
else: raise SystemExit("setup-gitleaks: artifact not listed in the release")' "$ARTIFACT") || {
  echo "setup-gitleaks: could not resolve $ARTIFACT in the v$VERSION release" >&2; exit 1; }

curl -sSL --max-time 180 -H "Accept: application/octet-stream" -o "$tmp/$ARTIFACT" "$asset/$asset_id" || {
  echo "setup-gitleaks: download failed" >&2; exit 1; }

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
