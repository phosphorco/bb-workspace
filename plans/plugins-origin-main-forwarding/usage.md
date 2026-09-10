# Usage continuity review

Node: `usage-continuity-review`  
Reviewed: 2026-09-09  
Status: report-only; source integration is not complete.

## Recommendation

Forward `origin/main`'s generated SDK/manifest model, but manually preserve the
handwritten Subscription Router Usage and host-lifecycle behavior. The current
worktree's `@bb/plugin-sdk` imports, copied `types/bb-plugin-sdk*.d.ts`, and
generated package/tsconfig edits are compatibility plumbing, not Usage product
behavior. Origin/main's generator and router source use `@get-bb/plugin-sdk`
and its generated dependency path; regenerate these outputs from the selected
definition rather than merging declarations or `dist/` by hand.

Do not add `@phosphorco/bb-identity` to this plugin. Router-specific
provider/thread/turn attribution is feature-owned and already uses stable
provider-qualified identity. Keep the shared identity boundary intact and
continue to consume the SDK's `thread/identity` event contract; do not introduce
a second identity controller or local identity authority.

## Contracts that must survive

### Usage UI and data path

- `app.tsx:1282-1300` registers the `Usage` navigation route and lazy-loads
  `usage-page.tsx`; the settings/router surface remains separate.
- `usage-page.tsx:250-272` must retain 7/30/90-day selection, the `usage` RPC,
  reconnect retry, stale-range retention, and the visible error/retry state.
- `rpc-contract.ts:171-257` defines the `UsageSnapshot` shape: observed totals,
  daily machine rows, model/account rollups, coverage, evidence, estimation,
  and hourly router operations. This is the UI/data compatibility boundary.
- `server.ts:63-64` opens and migrates the SQLite usage projection. The retained
  event ingestion at `server.ts:428-512`, backfill at `server.ts:517-531`,
  hourly router sampling at `server.ts:533-560`, `thread.idle` refresh at
  `server.ts:563-567`, and `usage` RPC at `server.ts:645-652` must remain.
- The package file list in the generated
  `plugins/subscription-router/package.json:47-80` must continue to include
  `usage-page.tsx`, `usage-existing-data.ts`, `usage-projection.ts`,
  `usage-reconciliation.ts`, `usage-estimation.ts`, `usage-pricing.ts`,
  `thread-identity.ts`, `rpc-contract.ts`, and the host files they depend on.

The committed `origin/main` router already contains this Usage surface; the
current worktree-versus-origin difference in `app.tsx`, `usage-page.tsx`,
`rpc-contract.ts`, and `server.ts` is primarily the SDK namespace/generated
plumbing. No Usage UI rewrite is indicated by this lane.

### Attribution and identity continuity

`server.ts:428-480` retains `thread/identity`, provider thread identity,
provider account identity, machine, model, and local account-slot provenance.
`usage-reconciliation.ts:38-39,173-207` makes the canonical turn key and
provider attribution independent of a copied local slot. Preserve that rule or
historical Usage will split/double-count after routing moves and account
failover. This aligns with `bb-identity` guidance: shared identity owns
authority/synchronization, while the feature owns its product data and storage.

### Router deployment and host lifecycle

- `server.ts:23-26,83-121,579-605` stages the complete host bundle, computes a
  generation manifest, compares the active launcher generation, activates the
  candidate, and invalidates status/route caches.
- `deployment.ts:122-144,168-239` hashes every host file, verifies file names
  and digests, runs Bun/SQLite preflight, performs migration and schema
  preparation, then atomically publishes the launcher and records a receipt.
- The pinned Bun executable, SQLite WAL/state migrations, account homes,
  launcher generation, and already-running native provider processes are
  separate lifecycle boundaries. A plugin reload does not prove an existing
  Codex provider process adopted a new host generation; fresh-process adoption
  needs its own evidence.
- `UPGRADE_RUNBOOK.md:7-18,141-156,417-444` and the README's migration notes
  require preserving exact runtime selection, SQLite authority, account-home
  retention, atomic activation, and the distinction between installed source
  and running provider generations.

## Obsolete/generated versus handwritten source

Origin/main's `tools/workspaces-sync/definition.ts` and tests establish the
new generated route: plugin manifests receive `@get-bb/plugin-sdk`, while
source-relative copied declarations and hand-maintained SDK aliases are not the
canonical path. The dirty worktree instead has `@bb/plugin-sdk` imports in
`app.tsx`, `usage-page.tsx`, `rpc-contract.ts`, and `server.ts`, adds local
tsconfig paths at `tsconfig.json:12-22`, removes the generated SDK dependency
from `package.json`, and carries modified `types/bb-plugin-sdk*.d.ts`.

Those package.json/tsconfig/type declaration files and ignored `dist/` are
generated outputs. They must be regenerated after the source/generator decision;
do not preserve them by textual conflict resolution. The `bb-identity` package
itself documents `@get-bb/plugin-sdk` as its public SDK binding, which supports
using origin/main's package boundary. The independent panel also flagged a
reported SDK archive/resolution failure, but this lane did not run the SDK
checker; treat that as an unverified blocker for the identity/integration lanes.

Two handwritten lifecycle differences need explicit integration adjudication:

1. The dirty `server.ts` removes `disposed` fences around in-flight Usage
   backfill/sampling writes, while origin/main retains them. The panel flags the
   removal as a reload/disposal risk. Retain disposal fencing unless a named
   owner supplies a test-backed reason to change it.
2. The dirty host sources remove `recoverMalformedNativeRollout` handling from
   `host/router.mjs` and `host/session-migration.mjs`, while origin/main retains
   it. This is outside the Usage UI contract but is lifecycle/recovery-sensitive;
   do not silently call either version obsolete. The integration decision must
   select one behavior and name its recovery test.

The current installed-source lookup was read-only and reported:

```text
subscription-router
  resolved: path:/home/ubuntu/bb/plugins/plugins/subscription-router
  installed: 2026-08-20T13:18:20.907Z
```

That confirms the canonical path only. It is historical evidence and does not
prove that a future integrated build is installed, reloaded, or running.

## Minimal focused proof after reconciliation

The Usage build/reload node should run from `/home/ubuntu/bb` exactly:

```sh
bb plugin build ./plugins/plugins/subscription-router
bb plugin reload subscription-router
bb plugin source subscription-router
```

Pass criteria:

- build succeeds from the selected canonical source;
- reload completes without an error;
- `bb plugin source subscription-router` resolves to
  `/home/ubuntu/bb/plugins/plugins/subscription-router` and reports `running`;
- the generated manifest/SKD checks have already passed in their owning lanes;
- one Usage range change and one reconnect/refresh exercise preserve the RPC
  shape and retained historical values;
- if host files changed, a separate doctor/fresh-provider check confirms the
  selected launcher generation, Bun/SQLite preflight, and new-process adoption.

This lane did not run build, reload, Usage UI, or fresh-provider checks because
the grant is report-only and forbids runtime/generated-output mutation. The
exact command above is the smallest valid live proof once integration is
accepted; it is not evidence that integration is complete.

## Blockers and confidence

- The plugins worktree remains dirty with the baseline's authored changes;
  source integration and conflict reconciliation have not occurred.
- SDK namespace/generator output, disposal fences, and malformed-rollout
  recovery still require named integration decisions.
- No live build/reload/running-state or fresh-provider evidence exists after
  forwarding.
- The independent perspectives panel reviewed five operational lenses and
  agreed that the historical running receipt is insufficient. Its generated-
  manifest perspective was unavailable, so confidence in the precise generator
  diagnosis is medium; confidence in the Usage and lifecycle contracts is
  medium-high.

