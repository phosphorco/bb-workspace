#!/usr/bin/env bash
# The reconciliation evidence is fresh for this work: for each child, HEAD = origin/main = tested-shas =
# recorded gitlink; tested-shas is newer than this plan's cut-over (both children contain the package move);
# reloads.log has an entry newer than tested-shas. Known failure: today (tested-shas predates the move).
. plans/package-publication/lib.sh
R=plans/workspace-reconciliation
for d in fork plugins community-plugins; do
  h=$(git -C $d rev-parse HEAD); o=$(origin_head $d); t=$(awk -v d=$d '$1==d{print $2}' $R/tested-shas)
  g=$(git ls-tree HEAD $d | awk '{print $3}')
  [ "$h" = "$o" ] && [ "$o" = "$t" ] && [ "$t" = "$g" ] || die "$d HEAD $h origin $o tested $t gitlink $g disagree"
done
p=$(awk '$1=="plugins"{print $2}' $R/tested-shas); c=$(awk '$1=="community-plugins"{print $2}' $R/tested-shas)
! git -C plugins cat-file -e "$p:packages/bb-identity" 2>/dev/null && git -C plugins cat-file -e "$p:evidence/package-publication/MANIFEST.json" \
  && git -C plugins grep -q "@phosphorco/bb-provider-settings/testing" "$p" -- plugins/github-review || die "tested plugins predates conformance + npm consumption"
git -C community-plugins cat-file -e "$c:packages/bb-identity/package.json" || die "tested community predates the move"
[ $R/reloads.log -nt $R/tested-shas ] || die "no reload after the tested SHAs"
echo "fresh-check: ok"
