#!/usr/bin/env bash
# fresh-import-check.sh COMMUNITY_REPO BASE HEAD SOURCE_REPO MANIFEST_JSON PKG=SRC [PKG=SRC...]
# Proves the fresh import (Cole 2026-10-05) over the WHOLE newly reachable history BASE..HEAD of COMMUNITY_REPO:
#  1. no commit in BASE..HEAD is a root (foreign history brings its own root) or exists in SOURCE_REPO;
#  2. one commit I adds every package (its parent has none of packages/<pkg>); its message names the full
#     phosphorco/bb-plugins@<SRC> for each package; every SRC is a SOURCE_REPO commit;
#  3. at I, packages/<pkg> equals SRC:packages/<pkg> blob-for-blob outside the manifest/config/docs allowlist;
#  4. no newly reachable tree under packages/ (every commit in BASE..HEAD touching packages/) contains host paths,
#     thread ids, thread-storage references, or any archived campaign path (MANIFEST oldPath).
# Git, diff and grep errors fail; "no match" is the only accepted grep status 1.
set -euo pipefail
C=$1 BASE=$2 HEAD=$3 SRCREPO=$4 MAN=$5; shift 5
die() { echo "FAIL: $*" >&2; exit 1; }
g() { git -C "$C" "$@" || die "git $*"; }
allow='^(package\.json|tsconfig[^/]*\.json|README\.md|PACKAGING\.md|CONSUMERS\.md)$'
leakpat='/home/ubuntu|thread-storage|(^|[^A-Za-z])\.bb/|thr_[a-z0-9]{10}'
g merge-base --is-ancestor "$BASE" "$HEAD" || die "BASE is not an ancestor of HEAD"
new=$(g rev-list "$BASE..$HEAD")
# 1. no roots, no source-repo commits
for c in $new; do
  [ "$(g rev-list --parents -n1 "$c" | wc -w)" -ge 2 ] || die "root commit $c in newly reachable history (foreign history)"
  if git -C "$SRCREPO" cat-file -e "$c^{commit}" 2>/dev/null; then die "commit $c also exists in the source repo"; fi
done
# 2. one import commit for all packages, full pointers
I=""
for spec in "$@"; do p=${spec%%=*}; src=${spec#*=}
  git -C "$SRCREPO" cat-file -e "$src^{commit}" 2>/dev/null || die "$src is not a source-repo commit"
  first=$(g rev-list --reverse "$BASE..$HEAD" -- "packages/$p" | head -1); [ -n "$first" ] || die "nothing adds packages/$p"
  [ -z "$I" ] || [ "$I" = "$first" ] || die "packages are not added by one common import commit ($I vs $first)"
  I=$first
  if git -C "$C" cat-file -e "$I^:packages/$p" 2>/dev/null; then die "packages/$p already exists in the import commit's parent"; fi
  g log -1 --format=%B "$I" | grep -qF "phosphorco/bb-plugins@$src" || die "import commit $I lacks full pointer phosphorco/bb-plugins@$src"
  # 3. tree equality at the import commit
  a=$(git -C "$SRCREPO" ls-tree -r "$src:packages/$p") || die "ls-tree $src:packages/$p"
  b=$(g ls-tree -r "$I:packages/$p")
  delta=$(diff <(printf '%s\n' "$a" | awk '{print $3"\t"$4}' | sort -k2) <(printf '%s\n' "$b" | awk '{print $3"\t"$4}' | sort -k2) | grep -E '^[<>]' | cut -f2 | sort -u | grep -vE "$allow" || true)
  [ -z "$delta" ] || { printf '%s\n' "$delta" | head -5; die "$p at import commit differs from $src outside the allowlist"; }
done
# 4. scan every newly reachable packages/ tree for leaks and archived campaign material
arch=$(node -e 'const m=JSON.parse(require("fs").readFileSync(process.argv[1]));const s=new Set();for(const f of m.files){const x=f.oldPath.match(/^packages\/[^/]+\/(.*)$/);if(x)s.add(x[1])}console.log([...s].join("\n"))' "$MAN") || die "cannot read MANIFEST"
for c in $(g rev-list "$BASE..$HEAD" -- packages); do
  set +e; hits=$(git -C "$C" grep -nIE "$leakpat" "$c" -- packages 2>&1); rc=$?; set -e
  [ $rc -le 1 ] || die "git grep failed at $c: $hits"
  [ -z "$hits" ] || { printf '%s\n' "$hits" | head -3; die "leak in newly reachable tree $c"; }
  paths=$(g ls-tree -r --name-only "$c" -- packages | sed -E 's#^packages/[^/]+/##')
  hit=$(comm -12 <(printf '%s\n' "$paths" | LC_ALL=C sort -u) <(printf '%s\n' "$arch" | LC_ALL=C sort -u) | grep -vE "$allow" || true)
  [ -z "$hit" ] || { printf '%s\n' "$hit" | head -3; die "archived campaign material present in $c"; }
done
echo "fresh-import-check: ok (import $I; $(printf '%s\n' "$new" | grep -c .) new commits inspected)"
