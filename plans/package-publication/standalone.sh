#!/usr/bin/env bash
# standalone.sh DIR [private|public]: package code under DIR/<pkg> reaches nothing outside its own tree:
# no relative path climbing into plugins/, tools/, packages/, sdk-artifacts/ or fork/ (static, dynamic,
# require or filesystem string), no absolute host paths. Docs (*.md) and recorded artifacts/ are excluded.
# Known failure: plugins/packages at SPLIT_BASE (provider-settings consumer suites, identity browser fixture).
. plans/package-publication/lib.sh
root=${1:?DIR}; stage=${2:-public}
# private stage (still inside plugins): manifests may keep the fork SDK tarball devDependency; it is replaced by
# public @get-bb/plugin-sdk during the community adaptation, where the public stage checks manifests too.
mexcl=(); [ "$stage" = private ] && mexcl=(--exclude=package.json)
for p in $PACKAGES; do test -d "$root/$p" || die "missing $root/$p"; done
set +e
hits=$(cd "$root" && grep -rnE "(\.\./){2,}(plugins|tools|packages|sdk-artifacts|fork)/|/home/ubuntu/|proof-bb" \
  $PACKAGES --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=artifacts --exclude='*.md' "${mexcl[@]}")
rc=$?; set -e
[ $rc -le 1 ] || die "grep error ($rc)"
[ -z "$hits" ] || { echo "$hits" | head -40 || true; die "package code reaches outside its tree ($(echo "$hits" | wc -l) hits)"; }
echo "standalone: ok ($root)"
