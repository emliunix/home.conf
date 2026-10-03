#!/bin/sh
# Recreate the conventional symlinks for every versioned setup recipe.
#
# The recipe files are tracked; the symlinks in ~/Documents are not (a symlink
# pointing at a checkout is machine-local). After a fresh clone, run this once.
# It is idempotent and refuses to clobber a real file or a foreign symlink.

set -eu

root=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
dest=${SETUP_LINK_DEST:-"$HOME/Documents"}

link() {
	name=$1
	target=$root/$name
	path=$dest/$name-setup

	if [ -L "$path" ]; then
		# Compare resolved paths, not raw targets: an existing link may be
		# relative (e.g. `home.conf/setup/glean`) and still be the same link.
		have=$(cd -P "$path" 2>/dev/null && pwd) || have=
		want=$(cd -P "$target" 2>/dev/null && pwd) || want=
		if [ -n "$have" ] && [ "$have" = "$want" ]; then
			echo "ok      $path -> $target"
			return 0
		fi
		echo "refuse  $path is a symlink to $(readlink "$path")" >&2
		return 1
	fi
	if [ -e "$path" ]; then
		echo "refuse  $path exists and is not a symlink" >&2
		return 1
	fi

	ln -s "$target" "$path"
	echo "linked  $path -> $target"
}

found=0
for dir in "$root"/*/; do
	[ -d "$dir" ] || continue
	found=1
	link "$(basename -- "$dir")"
done

[ "$found" -eq 1 ] || {
	echo "no recipes found under $root" >&2
	exit 1
}
