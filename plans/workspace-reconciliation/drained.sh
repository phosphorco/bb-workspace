#!/usr/bin/env bash
# Each child is clean, on main, equal to freshly fetched origin/main, with no temporary scaffold leaf.
set -u
here=/home/ubuntu/bb/plans/workspace-reconciliation
cd /home/ubuntu/bb || exit 1
fail=0
for r in fork plugins community-plugins; do
  git -C "$r" fetch -q origin || { echo "$r: fetch failed"; fail=1; continue; }
  # Dirty paths beyond the owner-held list (held-paths.txt) fail; STRICT=1 (final-clean) allows none.
  dirty=$(git -C "$r" status --porcelain --untracked-files=all | cut -c4-)
  if [ -n "$dirty" ]; then
    held=$(awk -v r="$r" '$1==r{print $2}' "$here/held-paths.txt" 2>/dev/null)
    extra=$(LC_ALL=C comm -23 <(LC_ALL=C sort <<<"$dirty") <(LC_ALL=C sort <<<"$held"))
    if [ -n "$extra" ] || [ "${STRICT:-0}" = 1 ]; then echo "$r: dirty$([ -z "$extra" ] && echo ' (held paths only; strict)')"; [ -n "$extra" ] && echo "$extra" | head -5; fail=1; else echo "$r: only owner-held paths dirty (allowed until final-clean)"; fi
  fi
  [ "$(git -C "$r" branch --show-current)" = main ] || { echo "$r: not on main"; fail=1; }
  [ "$(git -C "$r" rev-parse HEAD)" = "$(git -C "$r" rev-parse origin/main)" ] || { echo "$r: HEAD != origin/main"; fail=1; }
done
if compgen -G "plugins/plugins/*calibration*" >/dev/null; then echo "plugins: temporary calibration scaffold present"; fail=1; fi
[ "$fail" = 0 ] && echo "drained: fork $(git -C fork rev-parse --short HEAD) plugins $(git -C plugins rev-parse --short HEAD) community-plugins $(git -C community-plugins rev-parse --short HEAD)"
exit "$fail"
