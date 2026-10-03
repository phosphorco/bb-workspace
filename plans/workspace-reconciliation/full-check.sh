#!/usr/bin/env bash
# Full repository checks at the drained revisions; records tested SHAs. Refuses to run unless drained
# (root plugins builds would otherwise write into a peer's in-progress leaves).
set -u
here=/home/ubuntu/bb/plans/workspace-reconciliation
"$here/drained.sh" || { echo "refusing full check: children not drained"; exit 1; }
cd /home/ubuntu/bb || exit 1
logs="${BB_THREAD_STORAGE:-$HOME/.cache}/reconciliation-logs/$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$logs"
run() { local name=$1; shift; if ! "$@" >"$logs/$name.log" 2>&1; then echo "FAILED $name (log: $logs/$name.log)"; exit 1; fi; echo "ok $name"; }
run plugins-install bash -c 'cd plugins && mise exec -- bun install --frozen-lockfile'
for s in sync:check references:check sdk-types:check typecheck test build; do
  run "plugins-$s" bash -c "cd plugins && mise exec -- bun run $s"
done
# community-plugins has no mise config; mise exec supplies the workspace default Node/npm.
# community-plugins: if owner-held paths keep the shared tree dirty, check HEAD in a clean isolated
# worktree instead (never the held source); otherwise check in place.
if [ -n "$(git -C community-plugins status --porcelain)" ]; then
  cw=$(mktemp -d "$HOME/.cache/community-check.XXXXXX"); git -C community-plugins worktree add -q --detach "$cw/wt" HEAD
  cleanup_cw() { git -C /home/ubuntu/bb/community-plugins worktree remove --force "$cw/wt" 2>/dev/null; git -C /home/ubuntu/bb/community-plugins worktree prune; rm -rf "$cw"; }
  trap 'cleanup_cw; rm -rf "${tmp:-}"' EXIT
  cdir="$cw/wt"; echo "community-plugins: checking HEAD $(git -C community-plugins rev-parse --short HEAD) in isolated worktree (held paths excluded)"
else
  cdir=/home/ubuntu/bb/community-plugins
fi
# community-plugins pins no toolchain; use the mise default (Node 22). mise exec -C changes the working directory,
# so cd into the community checkout inside the command.
run community-ci mise exec -C /home/ubuntu/bb -- bash -c "cd '$cdir' && npm ci"
for s in test typecheck build; do run "community-$s" mise exec -C /home/ubuntu/bb -- bash -c "cd '$cdir' && npm run $s"; done
tmp=$(mktemp -d "$HOME/.cache/fork-verify.XXXXXX"); trap 'rm -rf "$tmp"; declare -F cleanup_cw >/dev/null && cleanup_cw' EXIT
run fork-verify bash -c "cd fork && TMPDIR='$tmp' ./scripts/verify"
"$here/drained.sh" >/dev/null || { echo "children moved during the check; rerun"; exit 1; }
{ for r in fork plugins community-plugins; do echo "$r $(git -C "$r" rev-parse HEAD)"; done; } > "$here/tested-shas"
# Pre-promotion gitlinks: the baseline reload-check diffs against, stable after promote.
{ for r in fork plugins community-plugins; do echo "$r $(git ls-tree HEAD "$r" | awk '{print $3}')"; done; } > "$here/baseline-gitlinks"
echo "tested: $(tr '\n' ' ' < "$here/tested-shas") logs: $logs"
