# Plugins origin/main forwarding baseline

Captured 2026-09-09 before source integration.

## Revisions

- Current `plugins` HEAD: `f12bd9dff48397ab6557840aef1dea0c950f2be9`
- Fetched `origin/main`: `1f63d0bff86d9eb5e555b624ee5e4811e8621bfe`
- `HEAD` and `origin/main` diverge at their merge base: the upstream range
  contains 15 commits, while the current branch has 16 files of committed
  branch-only work (+559/-47), predominantly Rosetta Slack work. This is a
  reconciliation/merge, not a fast-forward.

## Existing working tree

The worktree has 128 modified, 29 deleted, and 18 untracked paths relative to
`HEAD`. Forty-five generated `types/bb-plugin-sdk*.d.ts` files account for
+125,601/-110,871 changed lines. The remaining tracked source/documentation/
test changes total +7,201/-6,966 lines across 112 files, plus the 18
untracked files. These are preserved inputs; no reset, clean, stash, or
replacement is authorized by this receipt.

## Upstream interaction

`HEAD..origin/main` changes 420 files (+15,106/-548,917), including the shared
SDK conversion and retired-plugin consolidation. Of the 157 tracked local
modified/deleted paths, 133 also occur in that upstream range. The integration
therefore requires an explicit source-level reconciliation, not a blind
fast-forward.

A commit-only `git merge-tree --write-tree HEAD origin/main` preview reports
eight conflicts before any dirty worktree patch is considered:

- `packages/bb-identity/type-tests/browser/progress-inbox-browser-app.tsx`
- `plugins/rosetta-slack/{README.md,app.tsx,package.json,queue-health.ts,server.ts,test/queue-health.test.ts}`
- `tools/workspaces-sync/definition.ts`

The merge preview does not touch the index or working tree. Its tree object is
evidence only, not an integrated source tree.

## Live state

`subscription-router` was reloaded before this plan and reported `running` from
`path:/home/ubuntu/bb/plugins/plugins/subscription-router`. That is historical
evidence only; it does not prove the future integrated source.
