# Plugin compatibility review — upstream `78804e79d280998a3b4c3c965ec1b5845703bc0e`

## Scope and method

This is a source-only compatibility review for the requested upstream refresh.
It compares the current upstream pin `267938526dfcbc0edb228ce827b5bec202c1af97`
with target `78804e79d280998a3b4c3c965ec1b5845703bc0e` using `git show` and
`git diff` in `fork/upstream`, and traces current consumers in `plugins/` and
`community-plugins/`. It does not authorize a plugin source change, dependency
write, database migration, runtime reload, or Analytics enablement.

Target upgrades the upstream package SDK from `0.4.87` to `0.5.9`
(`packages/plugin-sdk/package.json`). The selected fork plugins instead use a
mix of 0.4.15/0.4.47 package dependencies and a generated fork SDK artifact
named `get-bb-plugin-sdk-0.4.98+phosphor.045a825edd2b.sdk.92b3acd09a4a.tgz`.
Those package declarations are not evidence that the target runtime contracts
are compatible; the refreshed fork must generate and test one SDK artifact from
the selected replayed target before any dependent pin or lock is updated.

## Findings

| Area | Target evidence | Current consumer evidence | Required disposition |
| --- | --- | --- | --- |
| Thread-list replacement | `packages/plugin-sdk/src/app-contract.ts` removes `PluginThreadListProps.Original` and `experimental_Original`; target moves the built-in list out into a plugin (`3bcba17f3`, `9516da5ad`). | `plugins/plugins/thread-progress/components/progress-inbox.tsx` only destructures `activeThreadId`, `onNavigate`, and `searchQuery`, so production code is compatible. `plugins/packages/bb-identity/type-tests/browser/progress-inbox-browser-app.tsx:149` still passes both removed props. | Update the browser fixture after the regenerated target declaration is selected; preserve the production replacement slot and add/retain a real replacement-list mount test. No production Thread Progress source change is indicated by this finding. |
| Analytics app and execution boundary | Target retains `app.slots.navPanel`, `useRpc`, `useRealtime`, and `useRealtimeConnectionState` (`packages/plugin-sdk/src/app-contract.ts`, `app.ts`); additions such as `useSdk` are optional. Target plugin runtime aliases its own `zod` only for builtin `dist/server.js` entries (`apps/server/src/services/plugins/plugin-runtime.ts`). | Analytics registers only `navPanel` in `community-plugins/plugins/analytics/app.tsx`; the lazy panel uses `useRpc`/realtime. It owns its `zod@4.3.6`, has no dependency on the new builtin-only alias, and its ordinary app route does not import the target's new sidebar replacement APIs. | No target API rewrite is required for the disabled Analytics app surface. Regenerate its SDK dev pin and run its typecheck plus static cold-path/isolation tests against the target artifact. Do not use this result to enable collection, refresh, SDK capture, or execution. |
| Machine Monitor | Target retains `navPanel`, `useRpc`, realtime hooks, and `useBbNavigate`; all target changes at these SDK seams are additive. | `community-plugins/plugins/machine-monitor/app.tsx` and `attachments.tsx` use exactly those retained APIs; `server.ts` uses `bb.sdk.hosts`, `threads`, and `subscribe`, whose target public areas remain present. It owns `zod@4.3.6`. | No source adaptation identified. Recompile and run server/fleet integration plus app/browser fixture tests using the selected target artifact; test reconnect and realtime invalidation because target changes plugin start/load-hold and source-watcher lifecycle. |
| Plan Graph | Target retains `app.composer.customize`, `threadPanelAction`, `useRpc`, `useBbNavigate`, `useComposerView`, `sdk.threads.storageFiles`, `sdk.files.listPaths/read`, and terminal areas (`packages/plugin-sdk/src/app-contract.ts`; `packages/sdk/src/areas/files.ts`, `threads.ts`). | `plugins/plugins/plan-graph/app.tsx`, banner/resource components, and server use only these APIs. The package currently consumes the fork `0.4.98` artifact. | No API removal found. Replace the generated SDK artifact/pin only after target replay; run plan-graph typecheck and server/component tests, including storage-file read/list, terminal export cancellation/cleanup, and composer banner/panel registration. |
| Context Magnet inspector | Target exports the retained app APIs `ThreadChat`, `threadPanelAction`, `useRpc`, and `useRealtime`. However `git grep` at target finds no `experimental_contextMagnetContributions`. | `plugins/plugins/context-magnet-inspector/host-trace-adapter.ts:16-18` and `witness.ts` refer to `BbPluginApi["sdk"]["threads"]["experimental_contextMagnetContributions"]`; its package pin is the fork `0.4.98` artifact. | **Required fork replay/port before plugin typecheck:** retain a bounded, authorization-checked Context Magnet SDK declaration and server implementation, or explicitly remove/replace the feature under a new scoped decision. Target alone cannot compile this plugin. Verify the target port has bounded/redacted output and run `host-free-boundary`, working-block renderer, plugin integration, and a real SDK declaration/runtime witness. |
| Shared identity package and consumers | Target has no `experimental_p6rIdentity`, `experimental_useProducerMessageRendering`, or `P6rParticipantProfile` (`git grep` at target is empty). Target's normal `rpc.register`, `http.route`, `sdk.threads.send`, `sdk.plugins.callRpc`, and app realtime APIs remain available. | `plugins/packages/bb-identity/bb.d.ts`, `bb-binding-runtime.ts`, and public React types depend on ordinary retained APIs but optional enhanced behavior is supplied by the fork P6R protocol. `fork/build/bb/packages/plugin-sdk/src/experimental-p6r-identity.ts` and its `backend-contract.ts` declaration provide that current custom surface. | **Required fork replay/port before package proof:** preserve the optional P6R protocol and its lifecycle/acceptance/history family according to `fork/plans/bb-identity-upstream-sync.md`; do not substitute target's default identity. Generate declarations from the selected target+fork source, then run bb-identity strict declaration/runtime tests, packed-artifact tests, and consumer witnesses (Thread Progress, Agent Connect, notifications/Slack as applicable). |
| Core DB migrations | Target adds core Drizzle migrations `0119`–`0130` under `packages/db/drizzle/` and changes core event/thread/queue data modules. | The reviewed direct plugins use plugin-owned stores or public SDKs, not core `@bb/db` imports. Analytics' store is plugin-owned; Plan Graph uses SDK file/terminal reads; Machine Monitor uses plugin-owned storage; Context Magnet consumes SDK data. | Do not author a plugin migration based solely on target core migration numbers. In the disposable refresh candidate, run core migration cold-start/upgrade checks and each selected plugin's fresh/open-existing plugin-store tests; examine any replay conflict involving P6R acceptance/history separately from these plugin databases. |

## Required candidate verification

1. Replay the approved fork protocol extensions first, then generate the
   plugin SDK declarations/runtime from that exact selected target tree. Update
   direct plugin SDK artifact references and lockfiles only in an explicitly
   granted follow-up; no plugin should retain a claim that the historical
   `0.4.98` artifact proves target compatibility.
2. Typecheck the direct set against that artifact: Analytics, Machine Monitor,
   Plan Graph, Context Magnet Inspector, and `@phosphorco/bb-identity`.
3. Run focused behavioral checks: Analytics cold route and isolation/static
   containment (still disabled); Machine Monitor server/fleet/realtime app
   checks; Plan Graph server plus banner/panel checks; Context Magnet target
   SDK declaration/runtime and bounded-renderer checks; identity declaration,
   package, packed-artifact, and named consumer witnesses.
4. Run target core DB migration cold-start/upgrade checks in the disposable
   candidate, followed by fresh/open-existing plugin storage checks. This is
   verification only; it does not authorize a live DB migration.
5. Before restart acceptance, repeat the generated-SDK typecheck after the
   final replayed source is materialized. The normal runtime remains untouched
   and Analytics remains disabled throughout.

## Limits

This review proves source contract presence/absence at the named commits. It
does not prove a successful replay, generated artifact compatibility, core
migration execution, production plugin loading, identity admission, or runtime
behavior. In particular, the two absent fork extensions are explicit porting
gates, not compatibility guesses.

## 2026-09-24 latest-upstream addendum

The preceding review is historical for the old upstream target. The new
isolated replay targets `fdd3de3b` (upstream SDK `0.5.24`), and its source
retains the fork's `experimental_p6rIdentity`, producer-rendering, Context
Magnet trace, and sidebar-layout declarations. Source presence is not a packed
SDK compatibility receipt.

The selected organization and community plugin manifests still resolve the
provenance-bound **old** `0.5.9+phosphor.4f309f5652aa...` archive. In
particular, Analytics and Machine Monitor use it directly, and the org
workspace sync definition fans it out to Plan Graph, Context Magnet, and the
identity consumers. The new replay cannot claim direct-plugin compatibility
until its own `0.5.24` runtime and bundled declarations build, an exact-tree
artifact is prepared, the generated manifests/locks are updated together,
and those consumers pass their focused checks. Do not hand-edit bundled SDK
declarations or switch a live plugin independently.

The `78804e79..fdd3de3b` range does not change files under
`packages/db/drizzle`; the downstream 0131 bridge still applies in the
isolated replay and the exact-source DB suite passes 631/631. That is not a
substitute for rehearsing an upgrade of a copy of the current host database.

Upstream's bundled Navigation plugin replaces the old sidebar implementation.
The downstream layout-provider seam has been ported to the new navigation
model and passes its 52-test focused suite. Core P6R (35/35), plugin artifact
builder (13/13), and server artifact validation (13/13) also pass in the
isolated replay. These checks do not cover a cold browser boot, current plugin
artifacts, or host activation. Candidate SDK bundled declarations and runtime
build, and Provider Codex passes 340/340 tests against them. The app and server
direct typechecks pass after a target-native server fixup. The live host
database still requires an exact-candidate copy/rehearsal before rollout.
Analytics must not be activated by this refresh. A read-only `bb plugin list
--json` check on the current bb-machine host on 2026-09-24 reports the
`analytics` plugin as `enabled: false`, `status: disabled`; recheck immediately
before rollout because runtime state can change independently of this source
candidate.
