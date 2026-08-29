#!/usr/bin/env bash
set -euo pipefail

mode="report"
if [[ "${1:-}" == "--enforce" ]]; then
  mode="enforce"
elif (($#)); then
  printf 'usage: %s [--enforce]\n' "${0##*/}" >&2
  exit 2
fi

handoff_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
workspace_root="$(cd "$handoff_dir/../../.." && pwd -P)"
target_upstream="f3cab2dd8c5c4be6d450be318550f3a04c8c3a1f"
minimum_free_kib=$((40 * 1024 * 1024))
failures=0

fail() {
  printf 'FAIL: %s\n' "$*" >&2
  failures=$((failures + 1))
}

warn() {
  printf 'WARN: %s\n' "$*" >&2
}

[[ "$(git -C "$workspace_root" rev-parse --show-toplevel 2>/dev/null || true)" == "$workspace_root" ]] || {
  printf 'error: handoff is not inside the canonical bb-workspace Git root\n' >&2
  exit 1
}

printf 'workspace=%s\n' "$workspace_root"
printf 'mode=%s\n' "$mode"
printf 'target_upstream=%s\n' "$target_upstream"
"$workspace_root/bin/status"

root_changes="$(git -C "$workspace_root" status --porcelain --untracked-files=all --ignore-submodules=all)"
if [[ -n "$root_changes" ]]; then
  warn "workspace root has authored changes"
  [[ "$mode" == "report" ]] || fail "clean root required before staging setup"
fi

for component in fork plugins community-plugins; do
  if [[ ! -d "$workspace_root/$component/.git" && ! -f "$workspace_root/$component/.git" ]]; then
    warn "$component is not initialized"
    continue
  fi
  branch="$(git -C "$workspace_root/$component" symbolic-ref --quiet --short HEAD || true)"
  head="$(git -C "$workspace_root/$component" rev-parse HEAD)"
  dirty="$(git -C "$workspace_root/$component" status --porcelain --untracked-files=all)"
  printf '%s branch=%s head=%s\n' "$component" "${branch:-detached}" "$head"
  if [[ -n "$dirty" ]]; then
    warn "$component contains authored changes"
    [[ "$mode" == "report" ]] || fail "$component must be attributed before automated setup"
  fi
done

if git -C "$workspace_root/fork/upstream" cat-file -e "$target_upstream^{commit}" 2>/dev/null; then
  printf 'target_commit=available\n'
else
  warn "target commit is not yet available in fork/upstream; inspect then fetch exact target"
fi

runtime_version="$(node -p "require('$workspace_root/fork/build/bb/packages/bb-app/package.json').version" 2>/dev/null || true)"
printf 'runtime_version=%s\n' "${runtime_version:-unavailable}"

free_kib="$(df -Pk "$workspace_root" | awk 'NR==2 {print $4}')"
printf 'free_kib=%s\n' "$free_kib"
if ((free_kib < minimum_free_kib)); then
  warn "less than 40 GiB is free"
  [[ "$mode" == "report" ]] || fail "staging disk floor not met"
fi

if [[ -e "$workspace_root/../.bb/bb.db" ]]; then
  warn "a local operator database exists; never treat it as a disposable rehearsal copy"
fi

if ((failures)); then
  printf '%d preflight failure(s)\n' "$failures" >&2
  exit 1
fi

printf 'preflight completed\n'
