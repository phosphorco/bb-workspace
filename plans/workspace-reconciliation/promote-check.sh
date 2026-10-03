#!/usr/bin/env bash
# Workspace main is clean and pushed; gitlinks equal the tested SHAs, which are published on each child origin/main.
set -u
here=/home/ubuntu/bb/plans/workspace-reconciliation
cd /home/ubuntu/bb || exit 1
git fetch -q origin || { echo "workspace fetch failed"; exit 1; }
fail=0
[ -z "$(git status --porcelain)" ] || { echo "workspace dirty"; fail=1; }
[ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ] || { echo "workspace HEAD != origin/main"; fail=1; }
while read -r r sha; do
  link=$(git ls-tree HEAD "$r" | awk '{print $3}')
  [ "$link" = "$sha" ] || { echo "$r: gitlink $link != tested $sha"; fail=1; }
  git -C "$r" fetch -q origin && git -C "$r" merge-base --is-ancestor "$sha" origin/main || { echo "$r: tested $sha not on origin/main"; fail=1; }
done < "$here/tested-shas"
exit "$fail"
