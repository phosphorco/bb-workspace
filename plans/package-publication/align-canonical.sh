#!/usr/bin/env bash
# align-canonical.sh [--apply]: move the canonical plugins checkout to origin/main without discarding authored work.
# HEAD and index move by mixed reset (working files untouched). A dirty path is updated only when its bytes equal the
# blob at the old HEAD or at an origin/main ancestor (published content); an untracked leftover is removed only when
# its bytes equal its blob at the old HEAD. A tracked path deleted in the working tree is an authored deletion and
# stays deleted. Everything else is authored work, kept byte-identical and verified. Without --apply it only prints the plan. Evidence goes to thread storage.
set -euo pipefail
cd /home/ubuntu/bb/plugins
E=/home/ubuntu/.bb/thread-storage/thr_i7xakgdxdd/package-publication/canonical-align-$(date +%Y%m%dT%H%M%S); mkdir -p "$E"
git fetch -q origin main; OLD=$(git rev-parse HEAD); NEW=$(git rev-parse origin/main)
# Local commits on the canonical HEAD are allowed only when each is already upstream in patch-equivalent form.
if ! git merge-base --is-ancestor "$OLD" "$NEW"; then
  unpublished=$(git cherry "$NEW" "$OLD" | grep '^+' || true)
  [ -z "$unpublished" ] || { echo "FAIL: canonical HEAD has unpublished local commits:"; echo "$unpublished"; exit 1; }
fi
MB=$(git merge-base "$OLD" "$NEW")
echo "old $OLD new $NEW" > "$E/heads.txt"
git status --porcelain --untracked-files=all > "$E/status-before.txt"
awk '{print $NF}' "$E/status-before.txt" | while read -r fp; do [ -f "$fp" ] && echo "$(git hash-object "$fp") $fp"; done > "$E/hashes-before.txt"
published() { local fp=$1 h; h=$(git hash-object "$fp"); { echo "$OLD"; git log --format=%H "$MB..$NEW" -- "$fp"; } | while read -r r; do [ "$h" = "$(git rev-parse "$r:$fp" 2>/dev/null)" ] && echo yes && break; done; }
if [ "${1:-}" != --apply ]; then echo "dry run; evidence $E"; fi
[ "${1:-}" = --apply ] && git reset -q --mixed "$NEW"
REF=$([ "${1:-}" = --apply ] && echo "$NEW" || echo "$OLD")
git status --porcelain --untracked-files=all > "$E/status-mid.txt"
: > "$E/plan.txt"
while read -r st fp; do
  h=$(git hash-object "$fp" 2>/dev/null || echo none); o=$(git rev-parse "$OLD:$fp" 2>/dev/null || echo none)
  case "$st" in
    # Missing from disk: restore only paths that are NEW on origin (absent at the old HEAD). A path tracked at the old
    # HEAD and deleted in the working tree is an authored deletion (tombstone) and stays deleted.
    D) if git cat-file -e "$OLD:$fp" 2>/dev/null; then echo "KEEP-deleted $fp" >> "$E/plan.txt"; else echo "restore $fp" >> "$E/plan.txt"; fi ;;
    M) if [ "$h" = "$o" ] || [ -n "$(published "$fp")" ]; then echo "update $fp" >> "$E/plan.txt"; else echo "KEEP $fp" >> "$E/plan.txt"; fi ;;
    '??') if [ "$h" = "$o" ]; then echo "remove $fp" >> "$E/plan.txt"; else echo "KEEP $fp" >> "$E/plan.txt"; fi ;;
  esac
done < "$E/status-mid.txt"
awk '{print $1}' "$E/plan.txt" | sort | uniq -c
[ "${1:-}" = --apply ] || exit 0
up=$(awk '$1=="restore"||$1=="update"{print $2}' "$E/plan.txt"); [ -z "$up" ] || git checkout "$NEW" -- $up
awk '$1=="remove"{print $2}' "$E/plan.txt" | while read -r fp; do rm -f -- "$fp"; done
git status --porcelain --untracked-files=all > "$E/status-after.txt"
bad=0; while read -r fp; do b=$(grep " $fp\$" "$E/hashes-before.txt" | cut -d' ' -f1); [ -z "$b" ] || [ "$(git hash-object "$fp")" = "$b" ] || { echo "CHANGED $fp"; bad=1; }; done < <(awk '$1=="KEEP"{print $2}' "$E/plan.txt")
while read -r fp; do [ ! -e "$fp" ] || { echo "TOMBSTONE RESURRECTED $fp"; bad=1; }; done < <(awk '$1=="KEEP-deleted"{print $2}' "$E/plan.txt")
echo "aligned to ${NEW:0:12}; kept $(grep -c '^KEEP' "$E/plan.txt") authored paths byte-identical (bad=$bad); evidence $E"
exit $bad
