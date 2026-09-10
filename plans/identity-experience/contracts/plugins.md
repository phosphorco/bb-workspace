# Plugin contract

> Policy update — 2026-09-09: the approved [Identities and multiplayer ADR](../../../docs/adrs/2026-09-identities-and-multiplayer.md)
> governs this trusted shared deployment. Use verified people when available,
> applicable carried attribution next, and a stable machine actor otherwise;
> missing or failed person verification must not block ordinary operations.
> Never relabel fallback as a verified person or redirect pending personal-state
> writes to another owner. Independent access checks and data validation remain.
> Earlier rejection requirements below are superseded; versioned API descriptions
> and test receipts remain historical evidence, not proof of ADR implementation.


Node `plugin-contract`, reviewed against the current [crosswalk](../crosswalk.md) and Pkl adjudication oracle. This defines implementation and acceptance requirements; it is not a source/runtime grant or completion receipt. Only this document and `plugin-fixtures/**` are writable in this assignment. Root owns integration of public contracts, SDK generation, manifests and locks. Source writes remain behind `source-ready`.

Source anchors: organization `862aee51269d87ebcc307ecd7c69a002c0fd8d6a`, community `31498646dbd7d6ce08ce6fabe0488a444cbc589d`, read in `/home/ubuntu/bb-service`. Reconciliation and historical receipts are linked in [lane evidence](../evidence/plugins.md). The public declarations below are in the selected organization `packages/bb-identity`. No proposed descriptor or presence interface below is represented as already callable.

## Public boundary and ownership

Feature factories call `bindBbIdentity(bb)` from `/bb`, handle its Result once, and register person/state/HTTP work through that binding. Public server declarations define `PersonRequest.actor`, `expected`, `target`, `callPlugin`, `signal` and disposal; `CommitValidator.validate` is a same-process synchronous authority check. Feature code does not assemble raw fork adapters, provider routes, transport headers or canonical key codecs. Feature schemas, transactional stores, delivery policy and conflict UI remain feature-owned.

One factory owns its binding until plugin disposal. Interactive handlers open and dispose `invocation.person()`; background and external credentials cannot borrow a current browser person. Request-scoped nested person work uses `PersonRequest.callPlugin` and validates its output codec. Credential-only delivery endpoints verify their own route credential before effects and never manufacture a person scope. Streaming authority follows response completion/cancellation; only one layer owns release on each host. Expiry invalidates old person evidence; new ordinary work resolves carried or machine attribution. Disposal still prevents use of a retired plugin handler, and already-dispatched durable finality is retained.

Native facts and personal appearance remain native-owned, with no import of this package in core. Native participant/facet keys remain in their native domain; do not migrate Thread Manager filters to identity keys or add redundant identity requests. Core authority is not a trusted-plugin sandbox: a display rename or issuer restriction does not imply process containment.

## Actor, viewed subject and operation target

The actor is admitted by the server. The viewed subject is the selected read perspective. A write target is explicitly resolved under the feature's policy and is not authenticated by client selection. Write requests carry actual actor/session expectation and expected subject; those assertions reject stale intent and are not credentials. Delayed actions capture the issued owner/session token and recheck it after awaits.

| Feature action | Read/target policy | Required provenance |
| --- | --- | --- |
| Thread Progress personal sections/preferences | Collaborator preview; self-only writes, matching existing resource declaration | Current admitted actor; foreign preview never initializes or migrates its owner |
| Native personal appearance | Self-only, server-derived owner; native owns shared-default write policy | Native actor/session; a plugin view switch cannot alter native ownership |
| Notification inbox/routes and ntfy link management | Existing person's own mutations; explicit recipient lookup for addressed delivery | Initiator is separate from recipient and viewed subject |
| Shared comments/annotations/stickers | Preserve current shared feature action policy; never infer collaborator write permission from view-as | Record actual creator/editor as supported by feature contract; recipient mentions do not author content |
| External Agent Connect/Slack send | Feature-verified external subject, namespaced by sending plugin | Frozen external author, target and exact immutable input; never identify a person by matching nickname |
| Community Agentation capture/delivery | Preserve `3149864` request-bound capture and source-labelled later delivery | First durable capture freezes actor snapshot; later viewer/session cannot overwrite it; legacy-unresolved stays unresolved |

If a feature requests cross-person mutation beyond existing semantics, it must declare an explicit collaborator write target and actual editor attribution at shared-contract review. This contract does not silently broaden personal settings writes.

For a feature write outside registered state resources, hold the package-issued target across preparation and invoke `binding.server.commits.validate` with exact instance/plugin/collection/record/schema/subject/expectation inside the same synchronous transaction as mutation and receipt. A successful earlier target resolution is insufficient. The target registry binds actor/session/subject/write intent; it is not an independently issued operation- or resource-specific delegation grant. The feature state service supplies collection/record/schema equality and the actual transaction invokes validation. The current same-process trusted-plugin boundary is unchanged. Schema-invalid fixtures cannot witness this fence: positive setup must reach the intended mutation boundary first.

## State, lifecycle and recovery

Use the package's stable resource, transactional `AtomicStateStorage`, persistent `DraftStorage` and state binding; no per-feature replacement controller, parallel load/save effect or polling feed. React ownership is one client, continuously mounted `BbIdentity.Provider`, independent Context view, and `useIdentityStateBinding`. Draft storage outlives replaceable Context children. Separately bundled plugins may use explicit compatible transports but never rely on a shared module singleton.

Render desired/blocked state accurately. Outer UI readiness is not write readiness. On A→B→A, distinct server session stamps and local owner-session tokens fence late reads, callbacks and writes. Reconnect suspends writes until authority revalidation, reconciles any original uncertain operation, then reloads. A refresh or resolved reconnect promise alone is not a successful save.

Retain complete pending drafts: original address/actor, base and desired values, generation and in-flight operation. Revision-conditional checkpoint deletion cannot erase a newer checkpoint. Recovery controls retain exact owner/session/conflict token through awaits; completion must establish either defined durable success or a specific retained blocked/exportable outcome. Persistence failure offers export/retry with visible failure acknowledgement; do not claim browser-death recovery before durable checkpoint success.

Legacy absence, malformed bytes, inaccessible storage, verified foreign owner and unknown owner are different. Preserve original bytes and owner markers; never stamp current actor onto unknown data. Define initializer precedence before mutation, adopt an existing winner and retain losing candidate for recovery. Import and receipt share one transaction; response-loss replay returns the original receipt. Cold/drained activation is a release prerequisite, not proof of arbitrary hot overlap or multi-runtime database writers.

## Provider configuration, health and display

Existing `IdentityProvider` declares issuers, optional `validateReadiness`, `resolve`, optional directory and optional lookup. `ProviderRegistrationV1` exposes generation, staged/active/retired status, immutable non-secret configuration, signal, subscription and invalidation. Readiness receives no person credentials and cannot resolve a user. Native/package normalize issuer/subject into opaque keys. Providers own credential verification and routing among declared issuers.

Keep three separate dimensions:

| Dimension | Meaning and display |
| --- | --- |
| Registration | Staged/active/retired says whether this generation is installed; active does not mean this request is authenticated |
| Current session | Ready/unauthenticated/unavailable/incompatible follows host/package session result; hide stale previous self while rechecking |
| Directory | Optional search/lookup availability and freshness; unavailable is not empty and does not erase a valid self presentation |

`not-applicable`, rejected and unavailable resolver results retain their distinct semantics through the admitted-session contract. Capability absence on an ordinary baseline selects one stable host-store-scoped local owner across plugins and recreated clients. Malformed/unsupported configured extension, provider removal or outage never selects that owner. Failed candidate activation retains the previous active generation; stale disposal cannot remove its successor. Authentication invalidation cancels resolver/request work and reauthenticates sockets; directory-only changes refresh presentation without inventing a different actor.

Tailnet configuration stays in `identity-boundaries`: owned Serve host, preferred login/tag and provider directory freshness. Preserve plugin ID, persisted configuration names, issuer/key history and storage when changing display to Tailnet Identity. Show settings/health with accessible plain language, refresh progress and recoverable failure; no credential values or transport headers in bootstrap, profile, logs or generic UI. Current provider has an empty app entry; a custom health surface is new bounded provider work, not evidence already delivered.

Native and plugins agree a **proposed optional presentation descriptor**: a friendly label and host-validated installed-plugin settings destination. Existing registration ownership supplies routing identity; do not add provider-specific identifiers or an arbitrary URL. Native consumes a structural DTO; package adapts it, provider owns copy/config. Host-observed availability is separate from verification assurance. Missing descriptor retains neutral existing UI. No protocol method/type name or new callable API is asserted until root's shared-contract review assigns the exact declaration and generated integration owner.

Notifications' documented historical Tailnet alias decoder is a narrow migration compatibility branch. Verify historical format and current authority before rekeying only the matching owner. Keep unknown issuers held/exportable. Current principal flow remains opaque and must work for a second issuer/default owner. Directory-recipient policy remains a separate feature seam to inspect; do not remove legacy strings mechanically or generalize current opaque-key parsing.

## Presence boundary

Honor `presence-placement`: first probe supported plugin delivery with actual subscription/disconnect/fanout witnesses. The selected SDK's current global publish path is insufficient evidence of targeted delivery. If the probe establishes a gap, native owns a minimal generic plugin-scoped subscription, targeted publication and connection-lifetime seam; plugin owns leases, thread membership, typing policy and visible surface. No core presence UI is selected by this contract. Historical participants are not presence. Subscription admission uses real connection authority; expired/disconnected/reloaded clients leave no visible stale lease, and unrelated clients receive no thread payload. Numeric budgets follow release baseline measurements, not invented thresholds.

## Acceptance matrix

These are required instruments for later authorized execution, not results. Each defect uses valid positive setup → specific failing boundary witness → correction → identical witness. Missing dependencies, startup failures and skipped tests fail the instrument rather than establish intended rejection.

| Witness | Positive and negative assertions |
| --- | --- |
| Public provider composition | Real public client route reaches binding and provider callbacks; direct lookup before search works; returned identity matches requested subject; undeclared issuer/wrong subject fails. Resolver-only provider preserves self and reports unsupported directory honestly. |
| Provider lifecycle | Real configured admission succeeds; expired/rejected evidence fails; replacement/readiness failure retains old generation; stale disposal and late directory responses cannot revive retired state. No default-owner write on outage. |
| Two people/two clients | A and B use actual admitted sessions; B can preview A's permitted personal state, cannot mutate A's self-only resource; A→B→A fences old callbacks and retains owner-separated drafts. Browser/context replacement alone is controlled evidence, not real admission. |
| Recovery | Lose save response after commit; reconnect reconciles the same operation and exact resulting record once. Intervening revision conflict retains desired edit; explicit recovery completes or remains precisely blocked. Failed checkpoint can export exact bytes; no false Saved state. |
| ntfy/Notifications | Begin/complete/expire and unlink bind current initiator; callback route credential cannot become person authority. Response loss/restart preserves one registration/delivery operation; viewed subject cannot redirect ownership. Inbox/read/handled/snooze/follow behavior remains usable. |
| Slack/Agent Connect | Concurrent identical keys share immutable reservation; changed payload rejects; lost response/unknown lookup never causes resend; retained final replay survives host receipt expiry. Validate AUTO/STEER/QUEUE against native behavior. Recipient and source author remain distinct. |
| Agentation | Preserve3149864 capture; actual A captures, B views, later delivery retains A's historical source label. Legacy unresolved and configured unavailability never synthesize a local person. Ordinary baseline capture remains useful. |
| UI and performance | Actual consumer desktop/mobile keyboard/focus/screen-reader, long names and all supported palettes; pending/error/return-to-self controls remain reachable. Batch profile reads, no per-row directory lookup, no unchanged-profile write. Release owns measured limits. |

Retain Agent Connect completed queue/call/stream/retry receipts referenced in reconciliation. Residual live tests are header click-through, multipage history, pending-operation restart/lost-response and selected-composition regression with explicit reason. Do not reimplement an accepted slice due to old STATUS text. Canonical final message/terminal evidence matters; transient delta chunk count is not exact call identity.

Real live acceptance requires admitted human sessions and explicit disposable fixture scope. Supplied principal IDs, forged headers, mock SDK actors or 401 shell screenshots cannot close it. Real phone/Slack/external delivery needs a separately authorized destination; loopback tests retain mock status. Record source/artifact/runtime hashes, witness assertions, scoped cleanup and uncertainty without copying private profile values or credentials into general evidence.

## Distribution handoff and remaining decisions

Release owns `portable-artifact-proof` installation/runtime receipts; plugins supplies actual feature assertions for Thread Progress, Agent Connect and Notifications. Same bytes must resolve normally and run on baseline and fork, with baseline default-owner behavior and enhanced-host machine fallback explicitly tested. Public registry publication and supported self-contained delivery are alternative release mechanisms to adjudicate; current sibling archive alone is preview delivery. Preserve new3149864 adoption instead of scheduling another direct-provider removal.

The worker's [distribution and consumer contract](plugin-fixtures/distribution-consumers.md) refines public imports, artifact ordering and per-feature assertions. Coordinator reviewed the completed fixture, correcting publication wording and clarifying that self-only policy is explicitly supplied, not an implicit library default. Worker reused `thr_nj6b3bisad` with codex/gpt-5.6-terra/high/fast. Root schedules exactly one owner for package/declaration/generator/lock changes and shared SDK generation.

Open integration choices: exact optional descriptor schema/settings destination validation; presence placement and measured hook necessity; supported release distribution mechanism and host versions; any explicit cross-person mutation product expansion. These do not block this specification and do not authorize implementation. Execution blockers remain source-ready, real human sessions, external delivery grants and later baseline measurements. No new security/credential product, retired plugin or unrelated router migration is added.
