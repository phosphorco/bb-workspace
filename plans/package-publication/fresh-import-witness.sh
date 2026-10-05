#!/usr/bin/env bash
# Known-failure witnesses for fresh-import-check.sh on synthetic repositories: one clean import must pass; a merged
# rewritten private history, a leaked first import later cleaned up, archived material, split import commits and a
# short source pointer must each fail. Prints one line per case; exits non-zero if any expectation is violated.
set -euo pipefail
H=${H:-$(cd "$(dirname "$0")" && pwd)/fresh-import-check.sh}
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
gi() { git -C "$1" -c user.name=w -c user.email=w@x "${@:2}"; }
mk() { mkdir -p "$1"; git -C "$1" init -q -b main; }
# source repo with two packages and some private history
mk $T/src; mkdir -p $T/src/packages/a $T/src/packages/b $T/src/plugins/x
echo 'export const a = 1' > $T/src/packages/a/index.js; echo '{"name":"a"}' > $T/src/packages/a/package.json
echo 'export const b = 1' > $T/src/packages/b/index.js; echo 'private' > $T/src/plugins/x/secret.ts
gi $T/src add -A; gi $T/src commit -qm 'private history'; SRC=$(git -C $T/src rev-parse HEAD)
echo '{"files":[{"oldPath":"packages/a/test/receipts/run.log"}]}' > $T/manifest.json
base() { rm -rf $T/c; mk $T/c; echo readme > $T/c/README.md; gi $T/c add -A; gi $T/c commit -qm base; git -C $T/c rev-parse HEAD; }
import() { mkdir -p $T/c/packages; cp -r $T/src/packages/a $T/src/packages/b $T/c/packages/; }
run() { local name=$1 want=$2 B=$3; set +e; out=$("$H" $T/c "$B" HEAD $T/src $T/manifest.json a=$SRC b=$SRC 2>&1); rc=$?; set -e
  if { [ "$want" = pass ] && [ $rc = 0 ]; } || { [ "$want" = fail ] && [ $rc != 0 ]; }; then echo "ok   $name: $(echo "$out" | tail -1)"; else echo "BAD  $name (rc=$rc): $out"; BADN=1; fi; }
BADN=0
B=$(base); import; gi $T/c add -A; gi $T/c commit -qm "import phosphorco/bb-plugins@$SRC"; run clean-import pass $B
B=$(base); gi $T/c fetch -q $T/src main; gi $T/c merge -q --allow-unrelated-histories -m "merge private" FETCH_HEAD; run rewritten-private-ancestry fail $B
B=$(base); import; echo '/home/ubuntu/.bb/thread-storage/x' > $T/c/packages/a/receipt.log; gi $T/c add -A; gi $T/c commit -qm "import phosphorco/bb-plugins@$SRC"; rm $T/c/packages/a/receipt.log; gi $T/c commit -qam cleanup; run leaked-first-import-then-cleanup fail $B
B=$(base); import; mkdir -p $T/c/packages/a/test/receipts; echo ok > $T/c/packages/a/test/receipts/run.log; gi $T/c add -A; gi $T/c commit -qm "import phosphorco/bb-plugins@$SRC"; run archived-material fail $B
B=$(base); mkdir -p $T/c/packages; cp -r $T/src/packages/a $T/c/packages/; gi $T/c add -A; gi $T/c commit -qm "import phosphorco/bb-plugins@$SRC"; cp -r $T/src/packages/b $T/c/packages/; gi $T/c add -A; gi $T/c commit -qm "import phosphorco/bb-plugins@$SRC"; run split-import-commits fail $B
B=$(base); import; gi $T/c add -A; gi $T/c commit -qm "import phosphorco/bb-plugins@${SRC:0:7}"; run short-pointer fail $B
# cases that pass tree equality at the import commit, so only the full-history scan can catch them
B=$(base); import; echo 'see /home/ubuntu/.bb/thread-storage/thr_abcdefghij' > $T/c/packages/a/README.md; gi $T/c add -A; gi $T/c commit -qm "import phosphorco/bb-plugins@$SRC"; run leak-in-allowlisted-doc-at-import fail $B
B=$(base); import; gi $T/c add -A; gi $T/c commit -qm "import phosphorco/bb-plugins@$SRC"; echo '/home/ubuntu/x' > $T/c/packages/a/notes.txt; gi $T/c add -A; gi $T/c commit -qm later; rm $T/c/packages/a/notes.txt; gi $T/c commit -qam cleanup; run leak-after-import-then-cleanup fail $B
B=$(base); import; gi $T/c add -A; gi $T/c commit -qm "import phosphorco/bb-plugins@$SRC"; mkdir -p $T/c/packages/a/test/receipts; echo ok > $T/c/packages/a/test/receipts/run.log; gi $T/c add -A; gi $T/c commit -qm later; rm -r $T/c/packages/a/test; gi $T/c commit -qam cleanup; run archived-material-after-import-then-cleanup fail $B
# side branch from the baseline adds then cleans a leak, merged with a clean import branch (path simplification bait)
B=$(base); gi $T/c checkout -q -b side; mkdir -p $T/c/packages/a; echo '/home/ubuntu/leak' > $T/c/packages/a/x.txt; gi $T/c add -A; gi $T/c commit -qm leak; rm -r $T/c/packages; gi $T/c commit -qam clean; gi $T/c checkout -q main; import; gi $T/c add -A; gi $T/c commit -qm "import phosphorco/bb-plugins@$SRC"; gi $T/c merge -q -m "merge side" side; run merged-side-branch-leak fail $B
# import made as a merge commit (two parents)
B=$(base); gi $T/c checkout -q -b other; echo x > $T/c/other.txt; gi $T/c add -A; gi $T/c commit -qm other; gi $T/c checkout -q main; gi $T/c merge -q --no-commit --no-ff other; import; gi $T/c add -A; gi $T/c commit -qm "import phosphorco/bb-plugins@$SRC"; run import-as-merge-commit fail $B
# side branch from the IMPORT commit leaks then cleans, merged back: one introduction, so only the full-set scan catches it
B=$(base); import; gi $T/c add -A; gi $T/c commit -qm "import phosphorco/bb-plugins@$SRC"; gi $T/c checkout -q -b side2; echo '/home/ubuntu/leak' > $T/c/packages/a/x.txt; gi $T/c add -A; gi $T/c commit -qm leak; rm $T/c/packages/a/x.txt; gi $T/c commit -qam clean; gi $T/c checkout -q main; echo y > $T/c/top.txt; gi $T/c add -A; gi $T/c commit -qm top; gi $T/c merge -q -m "merge side2" side2; run side-branch-leak-after-import fail $B
exit $BADN
