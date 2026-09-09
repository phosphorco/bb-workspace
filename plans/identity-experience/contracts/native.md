# Native identity experience contract

> Policy update — 2026-09-09: the approved [Identities and multiplayer ADR](../../../docs/adrs/2026-09-identities-and-multiplayer.md)
> governs this trusted shared deployment. Use verified people when available,
> applicable carried attribution next, and a stable machine actor otherwise;
> missing or failed person verification must not block ordinary operations.
> Never relabel fallback as a verified person or redirect pending personal-state
> writes to another owner. Independent access checks and data validation remain.
> Earlier rejection requirements below are superseded; versioned API descriptions
> and test receipts remain historical evidence, not proof of ADR implementation.


Proposed contract for `native-contract` in [the campaign graph](../../identity-experience.plan.pkl). Root adjudicates with the plugins coordinator. This document specifies future behavior; proposed shapes and operations below are not existing public APIs or implementation grants. Root alone owns the ledger and exact future grants. Read together with [the crosswalk](../crosswalk.md) and [reconciliation evidence](../evidence/native.md).

## Accepted boundary and inputs

Preserve native patch 0016: provider-neutral Identity settings, captured native request admission, immutable stored sender snapshots on ordinary sends, and the existing command dispatcher. Correct its creator/editor gaps rather than introduce a second sender implementation. Use machine fallback, never a fabricated verified person; no core import of `@phosphorco/bb-identity` or named providers. Snapshot presentation explains a historical actor; it is never current write authority. Core owns native atomic acceptance; plugins own provider verification and feature policy; the shared package adapts the host protocol.

Source observations are from comparison-only `/home/ubuntu/bb-service/fork` at `ad974140351d64e6ffc7df47005c7ce110d1dafa`. Materialized source and earlier controlled tests are not a fresh selected-artifact or live proof. Implementation must revalidate these paths after `source-ready`.

## Attribution, resolver and execution facts

The bounded [worker contract](native-fixtures/attribution-contract.md) and [attribution cases](native-fixtures/attribution-cases.json) provide the detailed per-group shape, lifecycle transitions and source touchpoints. The integration requirements are:

- One namespaced, versioned native attribution envelope preserves ordered input groups, immutable accepted original author/source snapshot, and latest editor separately. Existing person-only `p6rAuthors` is a backward-read input, not permission to invent authors for unknown history. An external author remains plugin-scoped and integration-asserted. Explicit agent/system/unknown origins remain distinguishable.
- Queue content edits preserve creator and atomically update editor with content. Reorder, scheduling and grouping preserve both. Supported accepted-message edit preserves original author and records editor during history rewrite. Retained fork/truncate history rebuilds participant projection from visible facts. Grouped accepted-message editing continues to refuse under upstream rules.
- Retry copies original source attribution; retry invoker is a separate attempt/lifecycle fact, never a replacement author. The contract retains the fact while UI placement remains root's product disposition. No complete edit audit archive is implied.
- Interaction resolution captures the admitted resolver, validates at the actual acceptance transaction and stores the snapshot with resolution data and durable lifecycle event. Tool execution remains attributed to its causal inputs, not whichever person resolved the latest interaction. Duplicate/stale resolution does not manufacture a second acceptance. Background/system resolutions carry explicit nonperson origin.
- Transcript, actual provider input and structured tool context consume the same ordered facts, including attachment-only groups. Generated sender text stays separate from stored authored content; retry/resume must not duplicate formatting. Historical unknown and partial tool correlation stay explicit. No authority comes from parsing a prefix.
- Preserve native compact/clear and other structured commands through existing parsing/dispatch. If a structured daemon field is required, the integration owner handles the versioned wire contract and compatibility; do not replace the upstream dispatcher or assume text formatting alone proves tool context.

## Personal appearance

Actual callers are existing Identity settings, app theme/favicon bootstrap and synchronization, native SDK and CLI. Existing shared Appearance and `bb theme` write policy remains unchanged. The existing theme catalog supplies built-in, custom and plugin-contributed choices; personal selection never creates a per-person theme definition.

Proposed semantic response, decoded at the boundary:

```ts
type AppearancePreference = { themeId: string | null; faviconColor: FaviconColorPreference | null };
type SelfAppearance =
  | { status: "ready"; ownerToken: string; preferenceRevision: string;
      sharedRevision: string; preference: AppearancePreference;
      shared: { themeId: string; faviconColor: FaviconColorPreference };
      effective: { themeId: string; faviconColor: FaviconColorPreference };
      source: { theme: "personal" | "shared"; favicon: "personal" | "shared" };
      warnings: readonly ("selected-theme-unavailable")[] }
  | { status: "unconfigured" | "unavailable" | "unauthenticated" };
```

`FaviconColorPreference` means the existing validated domain enum; it is not a new string namespace. Each null means inherit that field. The enum value `default` is an explicit favicon choice and differs from null. Full reset clears both fields. `ownerToken` is a server-issued opaque concurrency/freshness fence for the admitted host/person/session, not an actor key or transferable authority. It must be checked together with current admission inside the write transaction. Exact DTO spelling and whether an existing stamp can supply this fence are shared-contract integration choices.

Operations (semantic names, not claimed endpoints):

| Operation | Authority and result |
| --- | --- |
| Read own effective appearance | Server resolves current request once; returns both shared and effective values plus override/source state. No client principal argument. An unchanged read does not write profiles/preferences. |
| Set own selection | Request supplies complete two-field preference, previously issued owner fence and expected preference revision. Server validates catalog and existing favicon enum, current admission/fence and revision atomically; stores only this person's preference. Conflict returns reload-required without moving the write to another owner. |
| Clear own selection | Same authority/fence/revision rules; sets both fields to inherit. Response is current effective shared value, not a hard-coded factory palette. |
| Read/write shared appearance | Existing API and edit policy retained. Shared revision changes update clients only for fields they inherit. A personal read/set never mutates shared row `current`. |

Use a small fork-owned persistence model keyed by stable core identity and host scope. Storage layout/migrations are compose-native's decision and grant, not permission for a feature worker to edit DB schema. Do not store provider subject strings as preference authority. A rename preserves ownership. External authors have no personal native appearance. On no-provider hosts retain ordinary shared local-user appearance and report personal feature unsupported/unconfigured unless root explicitly selects a native singleton-person preference extension. Portable plugin stable-default behavior remains unchanged.

Concurrency and failures:

1. Bind loaded preference, pending mutations, cache and subscriptions to actual owner/session and server instance. Account/provider-generation change hides stale personal data, retires pending callbacks and rereads under the new owner. View-as in a plugin never changes native appearance owner.
2. A configured failure cannot silently select default-person preferences. Render a neutral/shared fallback while resolution is unavailable, labelled as unavailable for editing; do not overwrite the previous person's preference or persist that fallback as their choice.
3. Losing a set response permits authoritative reread. Never rebase an old intent onto a newly resolved owner or new revision automatically. Repeating the exact expected-revision request either reports conflict or converges without applying it to another owner; no new operation ID protocol is needed for this simple desired-state write unless an existing contract requires it.
4. Invalid requested theme is rejected without writes. If an already selected theme disappears, retain the preference and resolve effective theme to current shared valid fallback with an explicit warning. If shared theme itself is unavailable, reuse the host's catalog fallback. Reappearance can restore the retained selection. This behavior must be visible in the response and tested.
5. Scope browser caches and migration markers to verified owner/instance; a legacy origin-wide favicon value has no proven personal owner. Do not assign it automatically to the first admitted person or let the existing migration write shared settings during personal bootstrap. Preserve legacy value as local recovery data until an explicit relevant action adopts it; no automatic deletion is required.
6. Bootstrap may use only an owner-matching known preference. Before identity resolves, use neutral/shared theme; never flash another person's cached preference. Subsequent effective changes flow to existing theme/favicon application hooks, including favicon unread overlays and install-icon behavior. Pending favicon image work is generation-fenced.

## Provider-neutral self presentation

Existing `sdk.system.p6rIdentity()` and `/settings/p6rIdentity` remain the self-status source. Ready/loading/unconfigured/unauthenticated/unavailable are distinct. Refresh hides a previous verified person until current evidence is known. Configured rejection must resolve to explicitly labeled carried or machine
attribution, never an impersonated person. Ordinary operations continue.

Agreed with plugins coordinator: propose an optional descriptor containing a bounded display label and supported plugin settings destination. Existing registration ownership supplies routing identity; do not duplicate a provider namespace in this payload. No existing friendly descriptor API was established during inspection. This is a semantic extension for review, not a fabricated method. Core validates destination against the installed plugin/settings registry; it is not an arbitrary URL. Labels and configuration belong to the plugin, availability to host observation, and assurance to admitted identity. Registration staged/active/retired, current-session ready/unauthenticated/unavailable, and optional directory readiness remain distinct; active registration does not prove the current person. No secrets, ingress headers or provider credential schema enter the DTO. Missing descriptor leaves current neutral self-status behavior; a second provider must work without changes to the core page. Plugin reload/removal retires old descriptor generation and stale destinations.

## Presence placement and minimum contract

`presence-placement` remains root's Selector. Prefer existing supported plugin UI and delivery. A participant means someone in durable thread history; an online viewer or typer is ephemeral connection state. Neither implies the other. Presence does not add secrecy or access tiers among admitted collaborators.

Inspected [PluginRealtime.publish](/home/ubuntu/bb-service/fork/build/bb/packages/plugin-sdk/src/backend-contract.ts:638) explicitly broadcasts all clients without per-channel subscriptions. Client-side filtering therefore does not satisfy targeted fan-out. The placement probe must show an existing supported route that targets delivery and owns socket lifecycle, or justify the following narrow host addition. Do not grant core presence UI merely because this delivery hook is needed.

Proposed host semantics, only if existing capabilities cannot deliver them:

- Plugin-generation-scoped topic subscription over the existing shared connection, with explicit subscribe/dispose and a bounded topic key. Host namespaces by registered plugin; clients cannot select another plugin's publication namespace.
- Host associates the subscription with its actual admitted connection and exposes a server-owned connection handle/lifecycle signal to that plugin. Client-supplied person keys never establish a viewer. Provider invalidation closes or reauthenticates relevant subscriptions; reconnect creates new handles.
- Plugin can publish only to subscribed connection handles/topics in its own generation. Subscription add/remove is observed by the owning plugin; disconnect, abort and generation disposal release membership. No extra polling transport and no all-client broadcast followed by filtering.
- Initial snapshot and later changes need a gap-free handoff: subscribe then receive a sequence/revision-bearing snapshot, with bounded update buffering; a gap or overflow requests a new snapshot. This is ephemeral recovery, not a durable event log.

Plugin-owned policy: authenticated viewer membership for actual mounted thread panes; typing activity from supported composer scope; bounded leases and rate limits; deduplication of multiple tabs by stable person; idle/hidden/expiry behavior; native thread-header contribution and optional composer status through supported slots. The plugin uses shared package identity and lifecycle. No durable DB row per heartbeat; no presence in participant tables. Unsupported baseline omits enhancement without breaking normal thread use. If supported slots cannot preserve the required UI, root reviews one concrete missing slot independently of delivery.

Presence acceptance must select and record actual heartbeat/lease/throttle limits before implementation acceptance; this contract does not invent measured timing budgets. For the probe, symbolic limits `heartbeat < lease`, bounded topics/client, bounded payload and bounded pending updates must hold. Viewer/typing expiry, hidden-tab behavior and displayed wording are a root-reviewed product policy, not silently inferred online status.

## Acceptance instruments and shared integration

The [appearance/presence cases](native-fixtures/appearance-presence-cases.json) are expected-state fixture specifications, not executed tests. Native-instruments must fail on wrong author/editor, late-owner write, shared-setting mutation or presence fan-out leak. Missing dependencies, crashes and absent auth are failures, never intended negative controls. Human-native and personal-state proofs require actual independently admitted people; supplied identifiers/headers are fixtures only.

UI matrix: desktop/narrow split/mobile, 200% text zoom, keyboard/focus/screen-reader, long/missing names and failed avatars, loading/disconnected/errors, light/dark/materially different palette. External source and editor meaning use text, not only color. Presence never creates per-row timers or roster queries. Keep no extra author query per timeline row, one batched participant query per list page, no unchanged-profile writes. Baseline-measurements and commissioning-contract own numerical budgets before expansion.

| Future owner | Narrow integration handoff and maintenance reason |
| --- | --- |
| Native attribution worker | Fork-owned acceptance/formatting modules and existing send/edit/retry/queue/resolver callsites. Atomic content/provenance acceptance is core-owned. Shared DTO and DB needs are requested explicitly from compose-native. |
| Native appearance worker | Fork-owned self preference resolution/storage adapter; existing settings page; effective theme/favicon hooks/cache; SDK/CLI self operations after approved contract. App-wide effective theme cannot be correctly implemented by a disconnected settings picker. |
| Presence plugin owner | Feature data/policy, composer/header supported contributions, snapshot/lease behavior. Minimal host transport hook only after placement ruling. |
| Plugins coordinator | Optional provider descriptor and package adaptation; feature identity/view/target semantics. Core never imports package brands. |
| Compose-native/root | DB schema/generated migrations, domain/server/SDK shared exports, daemon protocol changes if necessary, patch queue, lock/result-tree and replay. Gives workers precise handoffs without overlapping ownership. |

Current selected touchpoints include packages/sdk/src/areas/system.ts, packages/server-contract/src/api/system.ts and public-api.ts; apps/app/src/lib/favicon-color-preference.ts and existing theme application hooks; packages/db/src/data/app-theme.ts is the preserved shared path. Confirm paths after source-ready. Each seam must record its no-extension default, invariant, callers, transaction or lifecycle boundary, test and deletion condition for second-upstream review. Reuse existing dispatcher and plugin slots; avoid copying upstream modules or new generic frameworks for a single feature.

## Review disposition needed

Root/plugins review should accept or amend: independent per-field inheritance, explicit default-versus-inherit favicon semantics, missing-theme retention/fallback, owner fence and revision behavior, optional descriptor validation, and plugin-first presence placement. Root owns exact presence policy and retry-invoker UI placement. Source-ready and shared-contract acceptance still gate all product work. This contract's completion means its documentation and fixtures are reviewable, not that future behavior is implemented or verified.
