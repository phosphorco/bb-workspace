# Identity continuity review

Reviewed 2026-09-09 for node `identity-continuity-review`.

## Decision

Keep `@phosphorco/bb-identity` as the single shared identity and
synchronization boundary. The evidence does not justify changing
`bindBbIdentity`, actor/viewed-subject/target semantics, invocation scopes,
provider evidence, or lifecycle APIs. Feature code may retain its schemas,
SQLite transactions, migrations, durable operations, conflict decisions,
presentation, and recovery UI, but it must not reconstruct authority or add a
second identity/state controller.

This is a review decision only. No source integration, merge, regeneration, or
runtime proof was performed in this lane.

## Public contract to preserve

The exact public boundary is in
[`packages/bb-identity/bb.d.ts`](/home/ubuntu/bb/plugins/packages/bb-identity/bb.d.ts):

- `BbIdentityApi` is the narrow SDK surface supplied to the package
  (`:27-36`); consumers pass `bb` to `bindBbIdentity` rather than assembling
  adapters or raw routes.
- `BbInvocation.person()` is the only interactive person admission path
  (`:38-44`). A serialized actor, browser header, or feature-local principal
  does not establish authority.
- `BbIdentityBinding` owns server, endpoint, RPC, HTTP, state registration,
  provider registration, tool provenance, background invocations, and disposal
  (`:89-119`). `bindBbIdentity(bb): Result<BbIdentityBinding>` is the factory
  contract (`:121-131`), including explicit failure rather than silent
  fallback.

The browser contract remains the paired `IdentityConnection`/
`IdentityClient`/`IdentityView` and `IdentityStateBinding` in
[`client.d.ts`](/home/ubuntu/bb/plugins/packages/bb-identity/client.d.ts:27),
with the React ownership and hooks in
[`react.d.ts`](/home/ubuntu/bb/plugins/packages/bb-identity/react.d.ts:102).
The state resource and storage seams remain feature inputs in
[`state.d.ts`](/home/ubuntu/bb/plugins/packages/bb-identity/state.d.ts:11);
identity, request lifetime, target checks, invalidation, reconnect, and
operation reconciliation remain package-owned. Retain origin/main's additive
`discardRecovery` implementation/declaration if it is selected; it is
revision-conditional recovery cleanup, not an authority change.

## Consumer disposition

### Thread Progress

Retain the Thread Sections state resource, SQLite atomic storage, legacy
candidate/migration handling, malformed-data blocking, draft preservation,
session fencing, view-as behavior, collaborator reads/self-only writes, and
feature conflict/recovery presentation. The active component already follows
the intended composition: it mounts `BbIdentity.Provider`/`Context`, reads the
live actor/session from the package view, and calls `useIdentityStateBinding`
([`thread-sections-identity-state.tsx`](/home/ubuntu/bb/plugins/plugins/thread-progress/components/thread-sections-identity-state.tsx:1),
`:142-206`, `:311-331`). The server registers the feature resource through
`identity.value.state.register` with `{ self-only }` writes and collaborator
reads ([`server.ts`](/home/ubuntu/bb/plugins/plugins/thread-progress/server.ts:670)).

Do not reattach the older `createIdentityStateSynchronizer` path to the UI.
The current source census found it only in its helper/test seam while the
active UI uses the package binding. Preserve that test-only authored material
temporarily if needed for reviewability; remove it only after the integrated
package path proves equivalent behavior. Do not silently discard it in the
merge. The untracked `bb-identity-public-contract.compile.ts` should have one
canonical copy (the origin witness if identical), and must compile against the
generated public SDK rather than a copied declaration.

### Identity Boundaries

Retain provider-specific verification, Tailnet directory refresh, readiness,
authentication invalidation, native projection, and append-only legacy/server
mapping. `server.ts:226-260` calls `bindBbIdentity(bb)` and registers the
provider; `lib/provider.ts:162-226` consumes host-issued `ProviderEvidenceV1`
and returns normalized issuer/subject/presentation. Keep this as provider
logic, not as a replacement for package admission or request authority.

### Notifications

Retain durable inbox/subscriptions/delivery, provenance, recipient resolution,
and guarded legacy migration. `server.ts:44-63` obtains a `PersonRequest` via
`invocation.person()` and derives the storage reference from
`request.actor.identity.key`. `identity-contract.ts:4-10` deliberately treats
that key as opaque; `:35-79` limits historical decoding to the documented
legacy alias. Preserve unresolved/foreign records; never infer ownership from
numeric subjects, display names, or a client principal field.

### Agent Connect

Retain durable operation IDs, idempotency, restart/response-loss recovery,
correlation, `sendExternal`, `lookupOperation`, and provenance. The shared
imports in `external-submission.ts:6-10` and the origin binding in
`server.ts:205-212` are the right composition. Any actor-display fallback is
presentation-only; authoritative attribution comes from the package history
reader. Do not widen `bb-identity` for the feature-level GraphQL
`operationId` `ID` versus `String` compatibility issue; resolve that at the
Agent Connect API boundary.

## Shared-SDK conversion and generated artifacts

Select origin/main's shared-SDK conversion from commits `697d3e6` and
`862aee5` at the generator boundary. The origin `tools/sdk-types/run.mts`
checks resolved `@get-bb/plugin-sdk` packages, rejects legacy imports and
rejects copied declaration files (`:97-147`). The origin
`tools/workspaces-sync/definition.ts` supplies the pinned SDK dependency and
browser-fixture package metadata, removes per-plugin SDK path maps, and makes
the generated package scripts resolve the shared package.

Therefore regenerate, never hand-merge:

- root `package.json`, `bun.lock`, each affected plugin `package.json` and
  `tsconfig.json`;
- `packages/bb-identity/tsconfig.browser-fixtures.json` and the generated
  `packages/bb-identity/type-tests/browser/package.json`;
- all workspace-owned SDK metadata after the generator source is selected.

The current dirty tree contains 51 copied
`plugins/*/types/bb-plugin-sdk*.d.ts` artifacts (and large generated diffs),
while `git ls-tree origin/main` reports none. Those copies, legacy path
aliases, and documentation that treats them as authoritative must not survive
the selected origin generator. The pinned shared archive/resolution and the
emitted declarations must be reproduced by `sdk-types:check`; an old matching
version number or a manually restored declaration is insufficient.

## Material conflict points and calls

1. `packages/bb-identity/type-tests/browser/progress-inbox-browser-app.tsx`
   is one of the eight clean-merge conflicts recorded by the baseline. Keep
   origin's package-resolved shared SDK fixture wiring and reapply only local
   behavioral assertions that still compile; do not restore a local SDK path
   map.
2. `tools/workspaces-sync/definition.ts` is both dirty locally and changed by
   origin. Origin's shared SDK dependency, no-path-map rule, generated browser
   fixture package, and generated script definitions win. Preserve local
   plugin behavior only through the selected source definitions; let the
   generator recreate manifests/tsconfigs.
3. The copied `types/bb-plugin-sdk*.d.ts` tree conflicts conceptually with
   origin even where Git does not report a clean-merge conflict. Remove it only
   through the selected generator/check flow; do not resolve declaration hunks
   manually.
4. Agent Connect, Thread Progress, and generated consumer declarations are
   jointly edited by the dirty worktree and origin. Compose local product
   behavior onto origin's public-binding consumers. Keep local storage,
   migration, operation, and UI behavior only when the focused tests prove it;
   retain origin's `bindBbIdentity`/`invocation.person()`/package-state paths.
5. The baseline's Rosetta Slack conflicts are outside this lane. They remain a
   blocker for the overall integration decision and are not adjudicated here.

No source-level conflict requires a public `bb-identity` contract change.
The panel review independently reached the same conclusion. One requested
Thread Progress perspective was unavailable, so confidence is moderate-high
for the authority and generator calls and moderate for feature-by-feature
retention until the dirty patch is actually reconciled.

## Focused proof after source integration

Run these only after the selected merge/reconciliation, not as evidence that
this review completed integration:

```sh
test -z "$(git -C plugins ls-files -u)"
rg -n '^(<<<<<<<|=======|>>>>>>>)' plugins --glob '!**/types/**' --glob '!**/dist/**'
! rg -n '@bb-bb|@bb/plugin-sdk' plugins/plugins plugins/packages
bun --cwd plugins run sync:check
bun --cwd plugins run sdk-types:check
bun --cwd plugins run --filter '@phosphorco/bb-identity' typecheck
bun --cwd plugins run --filter '@phosphorco/bb-identity' test
bun --cwd plugins run --filter '@phosphorco/bb-plugin-agent-connect' typecheck
bun --cwd plugins run --filter '@phosphorco/bb-plugin-agent-connect' test
bun --cwd plugins run --filter '@phosphorco/bb-plugin-thread-progress' typecheck
bun --cwd plugins run --filter '@phosphorco/bb-plugin-thread-progress' test
```

The plan's identity proof is the narrower required gate:
`bun --cwd plugins run sync:check && bun --cwd plugins run sdk-types:check &&
bun --cwd plugins run --filter '@phosphorco/bb-identity' typecheck`.

## Blockers and non-claims

The baseline records 133 overlapping paths, eight clean-merge conflicts, and a
dirty worktree with generated and handwritten changes. No merge, source
reconciliation, generator refresh, dependency install, build, reload, or
consumer proof was run by this lane. The perspective panel was launched and
returned, but its result is advisory rather than integration evidence.

