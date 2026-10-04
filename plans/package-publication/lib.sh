# Shared helpers for package-publication oracles. Source from /home/ubuntu/bb.
set -euo pipefail
PACKAGES="bb-identity bb-provider-settings"
VERSION=0.1.0
# plugins origin/main when the plan was authored; package-touching commits after it are cut-over commits.
SPLIT_BASE=d9ed2b708ffb0e57e6f5b6306d774a66f876a252
S=plans/package-publication
HANDOFF=/home/ubuntu/.bb/thread-storage/thr_qjduvhha3z/evidence/release/public-community-move-handoff-20261004/HANDOFF.json
die() { echo "FAIL: $*" >&2; exit 1; }
# origin_head REPO: fetch and print origin/main.
origin_head() { git -C "$1" fetch -q origin main; git -C "$1" rev-parse origin/main; }
# verify_tree REPO SHA: detached verification-only worktree at SHA with a sibling sdk-artifacts link,
# so ../../../sdk-artifacts resolves exactly as in the workspace. Sets WT; removed on exit. Shared trees untouched.
verify_tree() {
  local repo=$1 sha=$2; VT=$(mktemp -d "$HOME/.cache/pkgpub-verify.XXXXXX")
  ln -s /home/ubuntu/bb/sdk-artifacts "$VT/sdk-artifacts"
  # plugins tests read sibling community contracts (e.g. thread-links -> community cross-references); read-only.
  [ "$repo" = plugins ] && ln -s /home/ubuntu/bb/community-plugins "$VT/community-plugins"
  git -C "$repo" worktree add -q --detach "$VT/wt" "$sha"
  WT=$VT/wt; VT_REPO=/home/ubuntu/bb/$repo
  trap 'git -C "$VT_REPO" worktree remove --force "$WT" >/dev/null 2>&1; git -C "$VT_REPO" worktree prune; rm -rf "$VT"' EXIT
}
# Pinned toolchain: plugins/mise.toml (Node 26.3.0, Bun 1.3.14). The workspace root has no mise config and would
# resolve the host default (Node 22, Bun 1.4.2), which the package builds refuse.
in_tool() { mise exec -C /home/ubuntu/bb/plugins -- bash -c "set -o pipefail; $1"; }
# passed LOG PATTERN: a test whose name matches PATTERN passed (bun "(pass)"/"✓", node "✔"/"ok N -") and no
# matching test line reports skip/todo/fail.
passed() {
  grep -iE "$2" "$1" | grep -qE '\(pass\)|✓|✔|^ok [0-9]+ ' || die "no passing test matching '$2'"
  ! grep -iE "$2" "$1" | grep -qiE '\(skip|\(todo|\(fail|# SKIP|# TODO|^not ok|✗|✖' || die "test matching '$2' skipped or failed"
}
