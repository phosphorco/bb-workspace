#!/usr/bin/env bash
# Reconciled: promote holds, every repo is clean on main and equal to origin, bin/check has no warnings,
# and the fork runtime and upstream match their locks.
set -u
here=/home/ubuntu/bb/plans/workspace-reconciliation
cd /home/ubuntu/bb || exit 1
"$here/promote-check.sh" || exit 1
STRICT=1 "$here/drained.sh" || exit 1
out=$(./bin/check --role normal 2>&1); rc=$?; echo "$out"
[ "$rc" = 0 ] && ! grep -qE "WARN|FAIL" <<<"$out" || { echo "bin/check not clean"; exit 1; }
[ "$(git -C fork/build/bb rev-parse 'HEAD^{tree}')" = "$(cat fork/result-tree.lock)" ] || { echo "runtime tree drift"; exit 1; }
[ -z "$(git -C fork/build/bb status --porcelain --untracked-files=no)" ] || { echo "runtime checkout has tracked edits"; exit 1; }
[ "$(git -C fork/upstream rev-parse HEAD)" = "$(cat fork/upstream.lock)" ] || { echo "fork/upstream drift"; exit 1; }
echo "reconciled"
