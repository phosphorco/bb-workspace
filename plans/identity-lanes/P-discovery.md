# Lane P discovery: subtract person admission from trusted attribution

Date: 2026-09-09
Scope: read-only discovery for the shared `bb-identity` package and the fork
binding/core. This note is intentionally limited to the permitted planning
file; no production source, patch, build output, or git HEAD was changed.

## Decision

The trusted shared deployment needs one usable attribution snapshot for an
accepted operation. It does not need verified-person admission before ordinary
work can proceed. The smallest maintainable shape is therefore:

* keep the existing request/session/invocation and acceptance seams;
* make the receiving BB instance (or an explicitly carried execution machine)
  the stable fallback actor when person evidence is absent or unusable;
* let an installed provider resolve and enrich attribution when it can, while
  reporting provider health independently of ordinary request availability;
* keep external contributions separate from an invocation actor; and
* leave owner, concurrency, cancellation, immutable receipt/history, payload
  deduplication, and independent route credential checks in place.

This is a subtraction of authorization-only machinery, not a new authorization
model. A `ready` session must mean that the request has a valid, bounded
execution scope and an honest attribution snapshot. It must not imply that the
snapshot is a verified person.

## Current gates that can be removed or collapsed

### Core provider admission

[`provider-admission.ts`](../../fork/build/bb/apps/server/src/services/p6r/provider-admission.ts:181)
contains the largest person-only gate. `sessions`, `lineages`, admission
epochs, the `maxSessions` cap, and `sessionFor` (lines 186-351) exist to cache
and revoke provider-verified person sessions. `resolve` (lines 353-524) then
requires a selected boundary, request facts, trusted ingress ID, a non-empty
lineage, a non-`unverified` ingress, and a matching configured ingress ID
(lines 357-389) before it even attempts provider resolution. Missing config,
missing ingress, provider unavailable/not-applicable/rejected, missing
publication, invalid directory person, and capacity exhaustion all become
unauthenticated/unavailable outcomes (lines 435-512).

The native wrapper (lines 525-574) turns every non-ready result into `blocked`.
That is the direct ordinary-work gate. Remove the blocking branch and the
provider-session cache/lineage bookkeeping that exists only to enforce it.
Retain a bounded provider resolver and its credential extraction as an
optional enrichment attempt. Its failures should select the stable machine
snapshot and emit provider health/enrichment state; they should not invalidate
that snapshot or abort the operation. Keep the abort lifetime, deadline, and
disposal path around the attempt. The `routeClass` passed by
`trustedInvocation` (lines 594-601) is currently not used by this resolver; it
can be removed from this core admission input after a call-site search, while
route class remains package/dispatch intent metadata.

The resulting admission still needs to reject a retired generation, expired
scope, malformed request, or disposed host. Those are lifecycle failures, not
person authorization.

### Native route middleware

[`native-request.ts`](../../fork/build/bb/apps/server/src/services/p6r/native-request.ts:15)
has a useful request-scoped authorship carrier, but `assertAdmission` (lines
28-43) rejects `blocked` admissions and invalid scopes. Collapse the provider
status check into the existing native authorship/acceptance capture: capture
the ready machine or verified actor once, validate the request lifetime and
operation context, and let the existing thread route validation decide whether
the operation is allowed. Keep the `/system/p6rIdentity` response and its
session/lifetime information. Do not accept a client-supplied author.

[`native-authorship.ts`](../../fork/build/bb/apps/server/src/services/p6r/native-authorship.ts:17)
and its durable readers are the right remaining seam. Preserve the exact
authored wrapper from patch 0023 at lines 38-71:

```text
[from=label]
{Original content}
[/from=label]
```

It must continue to omit actor JSON, keys, issuer/subject, avatars, and
verification prose. The wrapper is presentation of the immutable snapshot;
it is not an authorization check.

### Browser lineage and admission-only server wiring

[`plugin-p6r-lineage.ts`](../../fork/build/bb/apps/server/src/services/p6r/plugin-p6r-lineage.ts:1)
signs and restores a browser lineage cookie for person-session admission. If
lineage is no longer needed for an optional provider cache, delete this
middleware and its server installation (the branch around
[`server.ts`](../../fork/build/bb/apps/server/src/server.ts:456)). If it is
kept temporarily, treat it only as an enrichment hint: a missing, malformed,
or stale cookie must follow the machine fallback and must never block ordinary
work.

[`identity-protocol.ts`](../../fork/build/bb/apps/server/src/services/p6r/identity-protocol.ts:184)
subscribes provider invalidation and currently turns non-directory events into
`{ kind: "session", reason: "provider" }` (lines 184-190). That causes a
provider health event to retire package state. Change it to an enrichment or
directory notification unless the actor itself was explicitly changed. Delete
`requiresInvocationAdmission` and the non-ready rejection branch in
`captureInvocation` (lines 193-213), along with its server wiring around
[`server.ts`](../../fork/build/bb/apps/server/src/server.ts:643). A usable
machine-ready session then reaches the same captured invocation path as a
verified session.

### Package origin gates

[`bb-upstream-runtime.ts`](../../plugins/packages/bb-identity/bb-upstream-runtime.ts:176)
rejects background and external origins in `admission`/`session` (lines
176-189), and `openScope`/`selfProfile` consequently have no ordinary scope
for those origins (lines 191-223). Remove the origin-as-person-admission
branch. Issue the same bounded stable default/machine actor for an issued
background or agent scope where the API needs attribution. Keep the existing
WeakMap of issued records, abort propagation, expiry, operation checks, and
forwarding validation.

[`bb-binding-runtime.ts`](../../plugins/packages/bb-identity/bb-binding-runtime.ts:246)
has the parallel `person()` rejection for background and external contexts.
Background work may use its machine-ready request. External work should remain
on `sendExternal`/`ForkAcceptanceExternalSource`, because an external source
is attribution supplied by the caller and must not masquerade as the host
actor. This distinction is source provenance, not a verified-person gate.

`host-runtime.ts` still needs to reject a genuinely unavailable, malformed, or
retired host protocol in `toLiveRequest` (lines 405-426). It should accept a
machine-ready `ServerSession`; changing the error text alone is insufficient if
the core still emits a non-ready session for provider failure.

## Contracts and machinery to retain

The following code protects properties that remain necessary under the ADR and
must not be removed as part of this subtraction:

* [`invocation-registry.ts`](../../fork/build/bb/apps/server/src/services/p6r/invocation-registry.ts:67)
  generation retirement, deadlines, parent-scope derivation, abort signals,
  release, and forwarding checks (lines 67-250). A provider-auth invalidation
  should stop retiring otherwise valid machine scopes; explicit cancellation,
  expiry, host disposal, and plugin-generation retirement still invalidate.
* [`plugin-p6r-dispatch.ts`](../../fork/build/bb/apps/server/src/services/plugins/plugin-p6r-dispatch.ts:64)
  generation binding and scoped `AsyncLocalStorage` (lines 64-191). It prevents
  stale handlers, cross-request ambient identity, and cross-plugin forwarding.
  Route classes can remain intent metadata without deciding whether a person
  exists.
* [`server-runtime.ts`](../../plugins/packages/bb-identity/server-runtime.ts:48)
  private target scopes, exact actor/session expectations, concrete target
  checks, and disposal (lines 48-170). Machine fallback must not silently
  retarget a person-owned collection or record. The expected actor/session
  check remains a freshness and ownership assertion.
* [`state-rpc-runtime.ts`](../../plugins/packages/bb-identity/state-rpc-runtime.ts:1)
  signal combination, owner/subject checks, structured mutation decoding,
  save/reconcile transaction boundaries, and retirement behavior (lines
  1-124). Provider outage should not discard drafts or make a machine actor
  appear to be a selected person.
* [`client-state-binding-runtime.ts`](../../plugins/packages/bb-identity/client-state-binding-runtime.ts:14)
  controller/view lifecycle, pending-draft preservation, writable-owner checks,
  reconnect fences, and explicit view-as changes (lines 14-170).
* [`identity-protocol.ts`](../../fork/build/bb/apps/server/src/services/p6r/identity-protocol.ts:259)
  acceptance, payload hashing, operation lookup, immutable history, and
  participant projection (lines 259-376). Keep the native acceptance hook and
  its transaction/receipt behavior in
  [`native-acceptance.ts`](../../fork/build/bb/apps/server/src/services/p6r/native-acceptance.ts:40)
  and durable storage. Keep original accepted authorship for queue promotion,
  retry, restart, and lost-response deduplication; never resolve a new person
  during delivery.
* [`provider-registry.ts`](../../fork/build/bb/apps/server/src/services/p6r/provider-registry.ts:108)
  provider registration generations, bounded credential validation, directory
  normalization, stale result rejection, and explicit lookup/person checks
  (lines 108-303). These are useful enrichment and explicit target validation;
  they are not ordinary-work admission.
* Existing `local`, `token`, `capability`, and `none` plugin HTTP/RPC auth in
  `plugin-api.ts` and `routes/plugins.ts`. Those credentials control access to
  plugin endpoints and remain independent of whether identity enrichment is
  available.

The package's `createEnhancedDirectory` in
[`host-runtime.ts`](../../plugins/packages/bb-identity/host-runtime.ts:281)
already owns directory mapping, canonical person decoding, generation checks,
and presentation enrichment (lines 281-403). Keep enrichment there. Core
should accept only the smallest serialized actor/evidence snapshot and the
existing acceptance receipt; provider-specific labels, mappings, and health
belong in the package/provider boundary.

## Contract issue that must be resolved before implementation

The current declarations are person-only at the durable boundary:

* [`p6r-message-author.ts`](../../fork/build/bb/packages/domain/src/p6r-message-author.ts:3)
  requires `evidence: "provider-verified"` and `identity.kind: "person"`.
* `P6rReadySession.actor.identity` in
  [`identity-protocol.ts`](../../fork/build/bb/apps/server/src/services/p6r/identity-protocol.ts:24)
  is a `P6rPersonReference`.
* `model.d.ts`/`model-runtime.ts` accept `person`, `default-user`, and
  `external`, but have no explicit machine actor/evidence variant.

Root must choose the additive machine encoding and compatibility rule. A
machine actor must have a stable instance-scoped key and explicit machine
evidence; it must not use a fake issuer/subject or be relabeled
`provider-verified`. The old provider-authored rows must remain byte-for-byte
readable, and old readers must not be silently exposed to new machine rows
without the agreed rollout gate. The actor, viewed subject, execution origin,
and initiating person must remain separate fields.

## Package/core ownership after subtraction

Core should own stable instance identity, the ready-session actor snapshot,
acceptance receipt/history, and the minimum serialization needed by native
routes. The package should own provider registration, bounded credential
validation, directory/label enrichment, invocation binding, and client state
behavior. No new large identity abstraction is needed: use the existing
`ServerSession`, `LiveRequest`, `ForkInvocationScope`, `ForkAcceptanceRequest`,
and receipt/history hooks, adding only the root-approved machine union where
the current person-only codecs require it.

## Proof obligations

The deletion is complete only when focused tests demonstrate all of the
following:

1. A request with no selected provider, no ingress/lineage, malformed or
   invalid evidence, provider rejection/timeout/unavailability, missing
   publication, or provider restart performs ordinary create/send/edit/queue/
   retry work under one stable machine actor. No person-admission 401/503 is
   emitted.
2. Valid provider evidence still produces a verified person snapshot, while a
   late or stale provider result cannot replace a newer machine or person
   snapshot. Directory health is observable without retiring unrelated state.
3. Two concurrent people and machine fallback cannot cross-contaminate one
   another. Generation retirement, expiry, cancellation, parent abort, and
   response/body lifetime still stop work and release scopes.
4. Person-owned state rejects stale actor/session/subject expectations and
   preserves pending drafts. Machine fallback never claims or rewrites a
   selected person's state.
5. Acceptance operation IDs, payload hashes, receipts, history, participants,
   queue promotion, retries, restart recovery, and lost-response deduplication
   preserve the original immutable author/editor snapshot.
6. Independent local/token/capability/none route credentials, request schema
   validation, target validation, transaction conflicts, and external-source
   provenance retain their existing failures.
7. The exact 0023 sender wrapper remains minimal and escapes delimiters/newlines
   without serializing actor metadata. Unknown attribution remains unwrapped.

The implementation review should count deleted route gates, removed session and
lineage state, removed admission-only fields/call sites, and protocol seams
eliminated. It should also record any compatibility branch added for old
provider-authored data. A successful subtraction removes concepts and call
sites; it does not add a second machine authorization protocol.
