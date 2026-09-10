# Upstream reconciliation report

Status: discovery and reconciliation mapping only. No merge, cherry-pick,
reset, clean, stash, generated refresh, dependency install, runtime reload, or
source integration was performed.

## Evidence boundary

The baseline receipt is plans/plugins-origin-main-forwarding/baseline.md. At the
time of inspection it recorded:

- plugins HEAD f12bd9dff48397ab6557840aef1dea0c950f2be9.
- origin/main 1f63d0bff86d9eb5e555b624ee5e4811e8621bfe.
- Merge base 1bce7bbb7a84a18971578679aaca58fecfbaa991.
- HEAD..origin/main: 15 commits, 420 changed paths, +15,106/-548,917.
- The worktree had 157 tracked modified/deleted paths and 18 untracked paths.
  The baseline measured 133 tracked-path overlaps with the upstream range; all
  18 untracked paths also occur as upstream additions, so the broad dirty /
  upstream intersection is 151 paths when untracked files are included.
- The commit-only merge-tree preview reported eight conflicts:
  packages/bb-identity/type-tests/browser/progress-inbox-browser-app.tsx,
  plugins/rosetta-slack/{README.md,app.tsx,package.json,queue-health.ts,server.ts,test/queue-health.test.ts},
  and tools/workspaces-sync/definition.ts. That preview did not include the
  dirty overlay and did not alter the index or worktree.

The local branch-only commits are 9d3a6c762644ce04fb61949a23fdcf74bed341de
(Rosetta queue readiness) and f12bd9dff48397ab6557840aef1dea0c950f2be9
(identity fixture). Their stable patch IDs are identical to upstream commits
863341a7d06100781dbc9f6f847542ea7ecb8ae5 and
8cb96bbf7f5a0709f5932aefc4453dd35fc7fe99, respectively. They should not be
replayed as new work. Patch identity does not prove that later dirty edits or
the complete final tree are conflict-free.

## The 15 upstream commits

| Commit | Material change and risk | Primary paths |
| --- | --- | --- |
| 697d3e66123233370a4453cdc2aa7ff1e1d8bff0 | Converts the workspace from copied SDK declarations and @bb/plugin-sdk path aliases to installed @get-bb/plugin-sdk packages; removes copied declarations and changes generated package/tsconfig rules. Mostly mechanical output, but its generator inputs and SDK archive choice are semantic. | tools/sdk-types/run.mts, tools/workspaces-sync/definition.ts, plugins/*/package.json, plugins/*/tsconfig.json, plugins/*/types/bb-plugin-sdk*.d.ts, packages/bb-identity/tsconfig.browser-fixtures.json |
| c5c37ce622fabf8ebe942b238f334497db43c6e3 | Retires learning and chronoscope, including manifests, source, tests, and inventory entries. | plugins/learning/**, plugins/chronoscope/**, README.md, bun.lock, tsconfig.json, tools/workspaces-sync/definition.ts |
| bf3848abb9e6b70095d148217f290edd84f830d1 | Adds durable operation IDs and related GraphQL/helper/test behavior to Agent Connect. | plugins/agent-connect/{README.md,TUTORIAL.md,call-client.d.ts,call-client.js,graphql-schema.ts}, plugins/agent-connect/test/{call-client.test.ts,graphql-schema.test.ts,server-route-context.test.ts} |
| 59d1a29a9524039f1515760c9a137e9963b66b49 | Preserves stream-directive semantics and releases Agent Connect call leases. | plugins/agent-connect/{README.md,TUTORIAL.md,server.ts}, plugins/agent-connect/test/server-route-context.test.ts |
| 90f91e148a922e5a53e014b05eae164b109aa4bb | Retires firstmate, perspectives, phosphor-checkouts, prompt-stacks, and snippets; describes Perspectives as community-maintained. | The five plugins/<id>/** trees, README.md, bun.lock, tsconfig.json, tools/workspaces-sync/definition.ts, tools/workspaces-sync/definition.test.ts |
| 4ecd8b0bddc248cfd19ab94362cbba8937ba375b | Adds execution-override preflight to Thread Manager. | plugins/thread-manager/server.ts |
| 862aee51269d87ebcc307ecd7c69a002c0fd8d6a | Ports unpublished organization-plugin features to the shared SDK. This is a large semantic source change, not merely SDK churn. | Agent Connect, Background Jobs, BTW, Diffs, Future Threads, Identity Boundaries, Subscription Router, Thread Links, Thread Manager, Thread Progress, and tools/workspaces-sync/definition.ts; notably plugins/diffs/**, plugins/subscription-router/**, and plugins/thread-manager/** |
| 81157cc34fb6d6f39687b399e6574fa7391607c8 | Recovers malformed Codex session rollouts and adds migration/recovery tests. | plugins/subscription-router/host/{router.mjs,session-migration.d.mts,session-migration.mjs}, plugins/subscription-router/server.ts, test/{proxy.test.ts,session-migration.test.ts} |
| 863341a7d06100781dbc9f6f847542ea7ecb8ae5 | Adds Rosetta Slack queue readiness, recovery, and starvation prevention. This is the upstream equivalent of local 9d3a6c7. | plugins/rosetta-slack/{README.md,app.tsx,message-evidence.ts,package.json,queue-health.ts,server.ts,state.ts}, related end-to-end/integration tests, tools/workspaces-sync/definition.ts |
| 8cb96bbf7f5a0709f5932aefc4453dd35fc7fe99 | Aligns the identity browser fixture with the original component prop. This is the upstream equivalent of local f12bd9d. | packages/bb-identity/type-tests/browser/progress-inbox-browser-app.tsx |
| 609ddd54c319481a2f85b6b5093c9189a373d0ea | Adds Rosetta factory and queue-recovery tests against the deployment SDK and adjusts the release checklist. | plugins/rosetta-slack/{RELEASE-CHECKLIST.md,package.json,queue-health.ts,test/factory.test.ts}, identity browser fixture, bun.lock, tools/workspaces-sync/definition.ts |
| ef18ea4a2a93a4629e1f6d41ca7889bd6166d1b3 | Adds Tokyo Dusk and changes identity state/controller, Thread Progress sidebar behavior, and Subscription Router pricing tests. | plugins/tokyo-dusk-theme/**, plugins/thread-progress/{app.css,components/progress-inbox.tsx,components/thread-sections-menu.tsx,lib/sidebar-view-state.ts}, packages/bb-identity/**, plugins/subscription-router/{usage-pricing.ts,test/usage-pricing.test.ts} |
| 788eeeb793346de6c2e02743e9d5473ce761219c | Models Rosetta conversation requests independently of context. | plugins/rosetta-slack/{README.md,app.tsx,conversation-requests.ts,package.json,queue-health.ts,server.ts,state.ts}, related tests, tools/workspaces-sync/definition.ts |
| 37837be25bfbb18a441852820219532899178ba | Preserves Rosetta input order and recovers exact revisions. | plugins/rosetta-slack/{README.md,app.tsx,conversation-requests.ts,message-store.ts,queue-health.ts,server.ts,slack.ts,state.ts}, related tests |
| 1f63d0bff86d9eb5e555b624ee5e4811e8621bfe | Merge commit for the Rosetta conversation-request branch. Relative to its first parent it resolves the Rosetta files above plus tools/workspaces-sync/definition.ts; relative to its second parent it carries the Tokyo Dusk/identity/Thread Progress/Usage changes above. | Rosetta Slack, tools/workspaces-sync/definition.ts, and the second-parent files listed for ef18ea4 |

## Risk classification

### 1. Mechanically supersedable output

The 697d3e6 contract is explicit: source imports move from @bb/plugin-sdk to
@get-bb/plugin-sdk; plugin manifests acquire an exact SDK dependency; tsconfig
path aliases and types/ includes disappear; and copied
plugins/*/types/bb-plugin-sdk*.d.ts files are removed. The new checker in
tools/sdk-types/run.mts rejects legacy imports, path mappings, copied
declarations, and an incorrect archive hash.

Treat these as generated output, not hand-merge targets:

- plugins/*/types/bb-plugin-sdk*.d.ts and generated package/tsconfig files;
- root package.json, tsconfig.json, and bun.lock where the generator or package
  manager owns the result;
- packages/bb-identity/tsconfig.browser-fixtures.json and its generated
  browser-fixture package.

Preserve and reconcile their inputs first:
tools/workspaces-sync/definition.ts, tools/sdk-types/run.mts, plugin
inventories, SDK target declarations, and the selected
sdk-artifacts/get-bb-plugin-sdk-0.4.47+phosphor.c30b12255a7f.sdk.a4652a585b5c.tgz
archive and SHA-256 receipt. Do not hand-merge generated declarations or use
bb plugin types as a fork-artifact updater. The SDK package source/version and
archive hash remain an explicit steward choice even if the version number looks
compatible.

The 39 tracked overlap files whose current bytes matched origin/main are
carry-forward evidence, not authorization to overwrite other dirty files. The
remaining tracked overlap inventory was 36 existing files with differing bytes,
8 locally deleted files, and 50 files deleted by origin/main; these counts are
only a triage aid because the dirty overlay was not merged or tested.

### 2. Already represented upstream

Do not replay local commits 9d3a6c7 or f12bd9d; use the upstream queue and
fixture changes once. The baseline merge preview still reported Rosetta
conflicts because the commits have independent ancestry and later upstream
Rosetta commits continue to edit the same files. Resolve by comparing the final
origin/main tree and the dirty overlay, not by assuming patch-id identity makes
a whole directory safe.

The 18 untracked paths all collide with upstream additions. Byte comparison
found these exact matches, which should be adopted once rather than treated as
local-only implementations:

- all eight plugins/diffs/{host-contract.ts,host.ts,repository-profile-cache.ts,repository-profile.ts,repository-scan.ts,test/repository-profile-cache.test.ts,test/repository-profile.test.ts,test/server-cache.test.ts} files;
- plugins/subscription-router/{terminal-session.ts,test/terminal-session.test.ts};
- plugins/thread-manager/{dialog.tsx,execution-change.ts,execution-mutation-signals.ts,test/execution-change.test.ts,test/execution-mutation-signals.test.ts}.

The untracked files requiring comparison remain
plugins/thread-manager/execution-change-dialog.tsx,
plugins/thread-manager/test/execution-change-dialog.test.tsx, and
plugins/thread-progress/test/bb-identity-public-contract.compile.ts. Their
differing bytes are semantic/test reconciliation work.

### 3. Semantic source overlaps

These must be reconciled as behavior and contracts, even where neighboring
generated files disappear:

- Agent Connect: dirty app.tsx, call-client.js, graphql-schema.ts,
  message-api.ts, server.ts, and GraphQL/message tests overlap 697d3e6,
  bf3848a, and 59d1a29. Upstream adds durable operation IDs, lease release,
  exact-turn recovery, and a different thread URL/actor path; local dirty
  behavior also changes URL flashing, actor attribution, and route handling.
  Preserve the selected public GraphQL contract and test it; do not resolve by
  choosing the generated SDK side.
- Diffs: dirty plugins/diffs/{README.md,app.tsx,package.json,server.ts,tsconfig.json}
  overlaps the large 862aee5 repository-profile feature and its eight exact
  untracked additions. Carry the exact files once, then test the repository
  scan/cache/host contract and the existing matrix surface.
- Subscription Router / Usage: dirty app.tsx, rpc-contract.ts, server.ts,
  host/router.mjs, host/session-migration.{d.mts,mjs},
  test/{proxy.test.ts,session-migration.test.ts}, and package.json overlap
  862aee5, 81157cc, and ef18ea4. The current dirty tree already matches
  upstream for many README, deployment, host-account, sqlite, and test files,
  but the differing files contain reconnect lifecycle, terminal/login state,
  malformed-rollout recovery, and RPC behavior. Treat the Usage route and
  migration tests as handwritten contracts; preserve the exact untracked
  terminal-session files once.
- Thread Manager / Thread Progress: dirty app.tsx, server.ts, package.json,
  README.md, tsconfig.json, sidebar/table files and tests overlap 4ecd8b0,
  862aee5, and ef18ea4. The differing untracked dialog files and
  bb-identity-public-contract.compile.ts need source-level review.
- Background Jobs, BTW, Future Threads, Thread Links, Agentation, Identity
  Boundaries, and related plugins: dirty handwritten files overlap the SDK
  import/package conversion and, for several features, 862aee5. Convert
  imports and manifests through the generator only after deciding the public
  SDK contract; retain feature behavior and tests independently.
- tools/workspaces-sync/definition.ts is a generator input, not generated
  output. It is touched by SDK pinning, plugin retirement, Diffs, Rosetta,
  Tokyo Dusk, and package inventory changes. It is the central semantic
  conflict and must be resolved before any generated refresh.
- packages/bb-identity fixture: local f12bd9d is duplicate upstream work, but
  697d3e6, 8cb96bb, 609ddd5, and ef18ea4 also touch the fixture/runtime
  contract. Verify the chosen SDK package and fixture typecheck together.

### 4. Deletion and retirement decisions

Upstream deletion is not automatically safe merely because local dirty paths
are generated:

- c5c37ce removes plugins/learning/** and plugins/chronoscope/**.
- 90f91e1 removes plugins/firstmate/**, plugins/perspectives/**,
  plugins/phosphor-checkouts/**, plugins/prompt-stacks/**, and
  plugins/snippets/**, and points Perspectives to the community collection.
- Local plugins/sticky-notes/** deletions are separate authored work. They are
  not covered by upstream retirement: origin/main still contains the Sticky
  Notes manifest and source. The steward must decide whether to retain that
  local retirement, restore the plugin, or migrate its behavior before
  accepting either deletion.

The local generated declarations under retired plugin directories can be
mechanically removed only after the steward confirms the corresponding source
retirement. Local handwritten perspectives files and the Sticky Notes deletion
require explicit ownership/consumer review.

## Recommended reconciliation order

1. Reconfirm the checkout identity and record the current HEAD, origin/main,
   merge base, MERGE_HEAD (if any), and dirty status. The independent review
   raised a possible later observation of a different HEAD/MERGE_HEAD; that
   warning was not independently re-probed after the timebox, so it remains an
   explicit blocker rather than a fact about the baseline above.
2. Preserve the dirty worktree as authored input. Do not reset, clean, stash, or
   overwrite it. Separate tracked edits, local deletions, untracked files,
   copied SDK declarations, and generated manifests in the steward's notes.
3. Deduplicate the two patch-id-equivalent local commits against upstream
   863341a and 8cb96bb; do not replay them. Resolve the final Rosetta files
   against upstream's later conversation-request commits and the eight recorded
   merge-preview conflicts.
4. Make the SDK source choice and generator-input reconciliation: update
   tools/workspaces-sync/definition.ts and tools/sdk-types/run.mts only as
   selected, confirm the SDK archive/hash and each plugin target, and convert
   handwritten imports from @bb/plugin-sdk to @get-bb/plugin-sdk as needed.
5. Regenerate package manifests, tsconfigs, browser-fixture metadata, and SDK
   declarations through repository scripts. Inspect the generated diff; do not
   hand-edit it. Run sdk-types:check before using generated output as evidence.
6. Decide upstream retirements and local Sticky Notes deletion separately.
   Remove or preserve each source tree and inventory entry only with the
   steward's explicit decision; do not infer that generated-file overlap is a
   deletion grant.
7. Reconcile high-risk handwritten behavior in this order: Subscription Router
   host/RPC/Usage and migration behavior; Thread Manager/Progress and identity
   fixture; Agent Connect GraphQL and recovery behavior; Diffs host,
   repository-profile cache/scan, and UI; then the smaller plugin source
   overlaps. Adopt byte-identical untracked upstream additions once, and
   inspect the three differing untracked files as semantic conflicts.
8. Run focused proofs before broad checks: changed plugin unit/integration tests;
   Subscription Router proxy/session-migration/Usage-pricing tests; Agent
   Connect GraphQL/message/call tests; Diffs repository-profile/cache/server
   tests; Thread Manager execution/table tests; Thread Progress identity
   contract and sidebar tests; sync:check, references:check, sdk-types:check,
   and targeted typechecks. Only after these pass run the repository build and
   the later Usage build/reload/source proof.

## Full tracked overlap path inventory

The following is the exact 133-path intersection from the baseline comparison;
it is evidence for review, not a merge instruction:

    AGENTS.md
    README.md
    bun.lock
    plugins/agent-connect/app.css
    plugins/agent-connect/app.tsx
    plugins/agent-connect/call-client.js
    plugins/agent-connect/graphql-schema.ts
    plugins/agent-connect/message-api.ts
    plugins/agent-connect/server.ts
    plugins/agent-connect/test/app-pulse-source.test.ts
    plugins/agent-connect/test/graphql-schema.test.ts
    plugins/agent-connect/test/message-api.test.ts
    plugins/agent-connect/test/server-route-context.test.ts
    plugins/agent-connect/types/bb-plugin-sdk-app.d.ts
    plugins/agent-connect/types/bb-plugin-sdk.d.ts
    plugins/agentd/types/bb-plugin-sdk.d.ts
    plugins/background-jobs/README.md
    plugins/background-jobs/lib/prompt-schedule.ts
    plugins/background-jobs/server.ts
    plugins/background-jobs/test/prompt-schedule.test.ts
    plugins/background-jobs/types/bb-plugin-sdk-app.d.ts
    plugins/background-jobs/types/bb-plugin-sdk.d.ts
    plugins/bb-bug-reporter/types/bb-plugin-sdk-app.d.ts
    plugins/bb-bug-reporter/types/bb-plugin-sdk.d.ts
    plugins/btw/README.md
    plugins/btw/app.css
    plugins/btw/app.tsx
    plugins/btw/server.ts
    plugins/btw/types/bb-plugin-sdk-app.d.ts
    plugins/btw/types/bb-plugin-sdk.d.ts
    plugins/chronoscope/types/bb-plugin-sdk-app.d.ts
    plugins/chronoscope/types/bb-plugin-sdk.d.ts
    plugins/diffs/README.md
    plugins/diffs/app.tsx
    plugins/diffs/package.json
    plugins/diffs/server.ts
    plugins/diffs/tsconfig.json
    plugins/diffs/types/bb-plugin-sdk-app.d.ts
    plugins/diffs/types/bb-plugin-sdk.d.ts
    plugins/espresso-theme/types/bb-plugin-sdk.d.ts
    plugins/firstmate/types/bb-plugin-sdk-app.d.ts
    plugins/firstmate/types/bb-plugin-sdk.d.ts
    plugins/future-threads/app.css
    plugins/future-threads/app.tsx
    plugins/future-threads/types/bb-plugin-sdk-app.d.ts
    plugins/future-threads/types/bb-plugin-sdk.d.ts
    plugins/identity-boundaries/types/bb-plugin-sdk-app.d.ts
    plugins/identity-boundaries/types/bb-plugin-sdk.d.ts
    plugins/learning/types/bb-plugin-sdk-app.d.ts
    plugins/learning/types/bb-plugin-sdk.d.ts
    plugins/ntfy/types/bb-plugin-sdk-app.d.ts
    plugins/ntfy/types/bb-plugin-sdk.d.ts
    plugins/perspectives/README.md
    plugins/perspectives/package.json
    plugins/perspectives/server.ts
    plugins/perspectives/test/server.test.ts
    plugins/perspectives/tsconfig.json
    plugins/perspectives/types/bb-plugin-sdk.d.ts
    plugins/phosphor-checkouts/types/bb-plugin-sdk-app.d.ts
    plugins/phosphor-checkouts/types/bb-plugin-sdk.d.ts
    plugins/plan-graph/types/bb-plugin-sdk-app.d.ts
    plugins/plan-graph/types/bb-plugin-sdk.d.ts
    plugins/plan-portfolio/types/bb-plugin-sdk-app.d.ts
    plugins/plan-portfolio/types/bb-plugin-sdk.d.ts
    plugins/prompt-stacks/types/bb-plugin-sdk.d.ts
    plugins/snippets/types/bb-plugin-sdk.d.ts
    plugins/sticky-notes/app.tsx
    plugins/sticky-notes/attention-forwarding.ts
    plugins/sticky-notes/package.json
    plugins/sticky-notes/server.ts
    plugins/sticky-notes/test/attention-forwarding.test.ts
    plugins/sticky-notes/test/human-context-authority.test.ts
    plugins/sticky-notes/test/human-context-integration.test.ts
    plugins/sticky-notes/tsconfig.json
    plugins/sticky-notes/types/bb-plugin-sdk-app.d.ts
    plugins/sticky-notes/types/bb-plugin-sdk.d.ts
    plugins/subscription-router/README.md
    plugins/subscription-router/UPGRADE_RUNBOOK.md
    plugins/subscription-router/app.css
    plugins/subscription-router/app.tsx
    plugins/subscription-router/deployment.ts
    plugins/subscription-router/host/accounts.d.mts
    plugins/subscription-router/host/accounts.mjs
    plugins/subscription-router/host/migration.mjs
    plugins/subscription-router/host/router.mjs
    plugins/subscription-router/host/session-migration.d.mts
    plugins/subscription-router/host/session-migration.mjs
    plugins/subscription-router/host/sqlite-state.d.mts
    plugins/subscription-router/host/sqlite-state.mjs
    plugins/subscription-router/package.json
    plugins/subscription-router/rpc-contract.ts
    plugins/subscription-router/server.ts
    plugins/subscription-router/test/cli.test.ts
    plugins/subscription-router/test/deployment.test.ts
    plugins/subscription-router/test/migration.test.ts
    plugins/subscription-router/test/native-codex-oracle.test.ts
    plugins/subscription-router/test/proxy.test.ts
    plugins/subscription-router/test/session-migration.test.ts
    plugins/subscription-router/test/sqlite-state.test.ts
    plugins/subscription-router/test/state-crash-stress.test.ts
    plugins/subscription-router/types/bb-plugin-sdk-app.d.ts
    plugins/subscription-router/types/bb-plugin-sdk.d.ts
    plugins/thread-links/README.md
    plugins/thread-links/app.css
    plugins/thread-links/app.tsx
    plugins/thread-links/types/bb-plugin-sdk-app.d.ts
    plugins/thread-links/types/bb-plugin-sdk.d.ts
    plugins/thread-manager/README.md
    plugins/thread-manager/app.css
    plugins/thread-manager/app.tsx
    plugins/thread-manager/package.json
    plugins/thread-manager/server.ts
    plugins/thread-manager/sidebar-placeholder.ts
    plugins/thread-manager/table-model.ts
    plugins/thread-manager/test/table-model.test.ts
    plugins/thread-manager/tsconfig.json
    plugins/thread-manager/types/bb-plugin-sdk-app.d.ts
    plugins/thread-manager/types/bb-plugin-sdk.d.ts
    plugins/thread-peek/types/bb-plugin-sdk-app.d.ts
    plugins/thread-peek/types/bb-plugin-sdk.d.ts
    plugins/thread-progress/lib/thread-list-pipeline.ts
    plugins/thread-progress/lib/thread-phase-facet.ts
    plugins/thread-progress/lib/thread-progress-derivation.ts
    plugins/thread-progress/server.ts
    plugins/thread-progress/test/family-rendering-seam.test.ts
    plugins/thread-progress/test/thread-list-pipeline.test.ts
    plugins/thread-progress/test/thread-participants.test.ts
    plugins/thread-progress/test/thread-phase-facet.test.ts
    plugins/thread-progress/test/thread-progress-derivation.test.ts
    plugins/thread-progress/types/bb-plugin-sdk-app.d.ts
    plugins/thread-progress/types/bb-plugin-sdk.d.ts
    tools/workspaces-sync/definition.ts
    tsconfig.json

The 18 untracked paths are the eight Diffs files, the two Subscription Router
terminal-session files, the seven Thread Manager files, and
plugins/thread-progress/test/bb-identity-public-contract.compile.ts, as listed
in the exact-match and differing-file sections above.

## Focused verification and blockers

Before source integration, the useful checks are read-only status/diff checks and
the baseline merge preview already recorded. After the steward makes the
reconciliation, focused proof should include:

- git diff --check and a fresh exact dirty-path preservation comparison;
- sync:check, references:check, and sdk-types:check after generator inputs and
  package resolution are selected;
- targeted Agent Connect, Diffs, Subscription Router, Thread Manager, Thread
  Progress, and bb-identity tests/typechecks listed above;
- the plan's later Subscription Router build/reload/source proof, only after
  integration and identity proof pass.

Current blockers for integration are the steward's SDK archive/version choice;
the definition.ts and source-contract conflicts; explicit decisions for
learning/chronoscope, firstmate/Perspectives/phosphor-checkouts/prompt-stacks/
snippets, and local Sticky Notes deletion; the three differing untracked files;
the dirty overlay not covered by merge-tree; and the unverified
checkout-identity warning from the independent review.

The independent perspectives review agreed that copied SDK declarations and
generated manifests should be mechanically superseded, patch-id-equivalent
commits should not be replayed, and runtime/RPC/tests/generator inputs must
remain semantic. It specifically cautioned that exact byte identity applies
only to the named files and that the broad overlap count is not conflict proof.
The merge-conflict/verification-order lens was unavailable, so the ordering above
is a steward recommendation, not an integration result.

