#!/usr/bin/env bash
set -euo pipefail

if (($# != 1)); then
  printf 'usage: %s /absolute/evidence/output-directory\n' "${0##*/}" >&2
  exit 2
fi

handoff_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
workspace_root="$(cd "$handoff_dir/../../.." && pwd -P)"
output_dir="$1"

[[ "$output_dir" == /* ]] || {
  printf 'error: evidence output must be an absolute path\n' >&2
  exit 1
}
[[ "$output_dir" != "$workspace_root" && "$output_dir" != "$workspace_root/"* ]] || {
  printf 'error: evidence output must be outside the Git workspace\n' >&2
  exit 1
}

umask 077
mkdir -p "$output_dir"

date --iso-8601=seconds > "$output_dir/captured-at.txt"
"$workspace_root/bin/status" > "$output_dir/workspace-status.txt" 2>&1
git -C "$workspace_root" status -sb > "$output_dir/workspace-git.txt"
git -C "$workspace_root" log --oneline -20 > "$output_dir/workspace-log.txt"
git -C "$workspace_root" ls-tree HEAD fork plugins community-plugins > "$output_dir/workspace-gitlinks.txt"

for component in fork plugins community-plugins; do
  git -C "$workspace_root/$component" status -sb > "$output_dir/$component-git.txt"
  git -C "$workspace_root/$component" log --oneline -20 > "$output_dir/$component-log.txt"
  git -C "$workspace_root/$component" rev-parse HEAD > "$output_dir/$component-head.txt"
done

git -C "$workspace_root/fork/upstream" rev-parse HEAD > "$output_dir/upstream-head.txt"
node -p "require('$workspace_root/fork/build/bb/packages/bb-app/package.json').version" > "$output_dir/runtime-version.txt" 2>&1 || true
df -h "$workspace_root" > "$output_dir/disk.txt"

find "$output_dir" -maxdepth 1 -type f ! -name MANIFEST.sha256 -print0 |
  sort -z |
  xargs -0 sha256sum > "$output_dir/MANIFEST.sha256"

printf 'evidence captured at %s\n' "$output_dir"
