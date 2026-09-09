# Lane N discovery: native admission and durable authorship

Date: 2026-09-09
Workspace: `/home/ubuntu/bb`
Fork materialized source: `fork/build/bb` at `8e801e78ad471eb94f5f0f987a18bdd4ecd56b32`

## Finding

The smallest coherent fallback is an additive machine actor in the shared
actor contract, then a provider-admission change that returns that actor for a
native request whenever verified person evidence is absent, inapplicable,
rejected, malformed, timed out, unavailable, or cannot be published. The
native route and durable paths already capture one immutable author snapshot
and carry it through the relevant writes. The main contract work therefore
belongs to T1, before Lane N changes provider admission.

The fallback must never be presented as a person or as verified evidence. A
bare request may use only the receiving server's stable instance identity. The
current durable source for that identity is
`initializeP6rInstanceNamespace` in
`fork/build/bb/apps/server/src/services/p6r/sidecar-store.ts:187-210`; it
persists the generated value in `p6r_metadata` and returns it on restart.
The fallback formatter should use the root-approved machine key format and a
machine-qualified label (for example, `machine:rosetta` style), without
claiming a Rosetta host that the request did not identify. Do not derive the
key from hostname, path, or Unix user. If a later trusted execution context
identifies a machine, that context may supply the machine actor explicitly;
the receiving instance remains the default for a bare native HTTP request.

## Current source seams

* `fork/build/bb/packages/domain/src/p6r-message-author.ts:3-26` accepts only
  `{ evidence: "provider-verified", identity.kind: "person" }`. The queued
  inline payload and the turn-request event reuse this schema at
  `fork/build/bb/packages/domain/src/queued-message.ts:170-185` and
  `fork/build/bb/packages/domain/src/thread-events.ts:105-134`.
* `fork/build/bb/apps/server/src/services/p6r/native-request.ts:15-18,28-43`
  stores one request-scoped author and rejects every `blocked` admission;
  routes are installed at `:81-109`, and the identity response parses the
  ready session actor at `:54-79`. This is the correct place to consume a
  machine-ready admission, while route validation, access checks, and thread
  writability remain independent.
* `fork/build/bb/apps/server/src/services/p6r/provider-admission.ts:353-524`
  currently turns missing request/ingress facts into unauthenticated and
  provider `unavailable`, `not-applicable`, `rejected`, malformed, missing
  source, invalid person, and capacity outcomes into blocked sessions. The
  native admission wrapper is at `:525-574`; it currently also invalidates a
  ready admission when `configured()` becomes false. Provider-success session
  lifecycle and lineage invalidation must remain intact for verified people.
* Server setup creates the stable namespace once at
  `fork/build/bb/apps/server/src/server.ts:583-624` and passes it to the
  admission. No current public native request supplies an authenticated remote
  machine identity, so the fallback must not use `hosts.id` by inference.
* `fork/build/bb/apps/server/src/services/p6r/native-authorship.ts:17-35`
  captures the request author and reads attribution from the original request
  event. `fork/build/bb/apps/server/src/services/threads/thread-send.ts:368-402`
  stores authors/editors with the request event, and `:468-475` deliberately
  reloads the original attribution for retries. `:643-645` and `:750-752`
  pass the captured values into model preparation.
* Queue attribution is already aligned per message/group. Creation captures
  the author in `fork/build/bb/apps/server/src/services/threads/queued-messages.ts:179-255`;
  queue drain keeps attributed rows on the general path and passes aligned
  authors/editors at `:480-505` and `:797-825`. The DB has one nullable JSON
  `p6r_authors` column with legacy array and `{authors, editors}` envelope
  decoding in `fork/build/bb/packages/db/src/data/queued-thread-messages.ts:570-700`.
  A machine actor therefore needs no new queue column once T1 makes the
  existing codec additive.
* Native acceptance stores immutable accepted authorship and latest editor in
  the same transaction at
  `fork/build/bb/apps/server/src/services/p6r/sidecar-store.ts:420-503`.
  Queue reservation and promotion preserve that snapshot at `:505-555` and
  `:580-654`; delivery must never resolve a new person. The JSON fields are
  generic today, but readers should use the shared actor codec and handle
  malformed persisted data deliberately.
* The existing 0023 wrapper is in
  `fork/build/bb/apps/server/src/services/p6r/native-authorship.ts:38-71`.
  It emits one `[from=label]` block per attributed group, falls back from
  author to editor, leaves unknown groups unwrapped, and escapes delimiters
  and line breaks. Keep this exact minimal model input shape; machine labels
  come from machine presentation. Do not add actor JSON, issuer/key/avatar,
  evidence, or verification prose to model input.
* Participant parsing currently accepts only person or external identities at
  `fork/build/bb/apps/server/src/services/p6r/participant-projection.ts:64-125`.
  T1/T5 must add machine as an additive participant kind, or machine-authored
  accepted contributions will be discarded from the participant projection.

## T1 contract checkpoint

Before production edits in this lane, root should publish the exact shared
contract and compatibility decision. The minimum additive surface is:

1. Add a machine identity/evidence variant to the domain author codec and all
   SDK/server response codecs. Keep the existing provider-verified person
   object parseable byte-for-byte. Keep `P6rPersonReference` person-only;
   machine actors must not use fake issuer or subject values.
2. Expand identity-protocol session snapshots and actor parsing, which
   currently assume a person in `fork/build/bb/apps/server/src/services/p6r/identity-protocol.ts`.
   Decide whether a native machine session is `ready` for native routes while
   remaining ineligible for person-only profile/preferences APIs. Preserve the
   distinction between actor, evidence, execution origin, and initiating
   person.
3. Define the exact stable machine key and display label. The key must be
   instance-scoped and survive a rename; presentation may change without
   changing history. Define how an explicitly identified execution machine is
   carried, while defaulting a bare request to the receiving instance.
4. Define downgrade behavior. Existing readers reject a newly written machine
   author because the current codec is provider-only, even though the queue
   envelope is structurally generic. A rollout gate or compatibility procedure
   is needed before a machine-attributed writer shares storage with an old
   reader. Legacy arrays, absent metadata, and old provider-authored rows must
   continue to decode.

Root-owned/shared files to settle before N writes:

* `fork/build/bb/packages/domain/src/p6r-message-author.ts`
* `fork/build/bb/packages/domain/src/queued-message.ts`
* `fork/build/bb/packages/domain/src/thread-events.ts`
* `fork/build/bb/apps/server/src/services/p6r/identity-protocol.ts`
* `fork/build/bb/apps/server/src/services/p6r/provider-contract.ts`
* `fork/build/bb/packages/server-contract/src/api/system.ts` identity response declaration
* `fork/build/bb/apps/server/src/services/p6r/participant-projection.ts`
* `fork/build/bb/apps/server/src/services/p6r/native-authorship.ts` while the
  0023 patch is being preserved and integrated
* `fork/build/bb/apps/server/src/server.ts` if the receiver machine label or
  explicit execution context is added

## Post-contract Lane N allowlist

After G1, the smallest N production allowlist is:

* `fork/build/bb/apps/server/src/services/p6r/provider-admission.ts` — retain
  the verified provider path; construct a machine-ready admission for the
  fallback outcomes; avoid provider calls when ingress is missing/unverified;
  keep request lifetime, disposal, and verified-lineage revocation semantics.
* `fork/build/bb/apps/server/src/services/p6r/native-request.ts` — accept a
  machine-ready session exactly as a ready native admission and expose its
  actor; do not accept client-supplied authorship.
* `fork/build/bb/apps/server/src/services/p6r/native-acceptance.ts` and
  `fork/build/bb/apps/server/src/services/p6r/sidecar-store.ts` only if T1
  requires accepted machine actors to be parsed or passed differently; keep
  operation-id/payload-hash idempotency and atomic receipt/contribution writes.
* `fork/build/bb/apps/server/src/services/threads/queued-messages.ts`,
  `thread-queued-messages.ts`, `thread-send.ts`, and the assigned edit handler
  only where current author/editor plumbing assumes a person or drops a
  machine variant. Preserve frozen queue authors, editor attribution, group
  positions, and retry original-request lookup.

Do not modify the shared contract files above from N without root's explicit
assignment. No schema migration should be needed for the current queue or
sidecar JSON shape; a migration is required only if T1 changes the storage
envelope. Do not change the existing 0023 patch payload or its series/hash
metadata while implementing this lane.

## Focused verification

The following tests are sufficient to prove the fallback slice after T1 and
the N implementation:

* `fork/build/bb/apps/server/test/services/p6r/provider-admission.test.ts`:
  verified person behavior is unchanged; missing/unverified ingress does not
  call the provider and returns a machine actor; provider unavailable,
  not-applicable, rejection, timeout, malformed output, invalid person, and
  absent publication return the same stable machine key; admission lifetime
  and disposal still invalidate it; provider lineage invalidation still
  retires verified people.
* `fork/build/bb/apps/server/test/services/p6r/native-message-authorship.test.ts`:
  untrusted ingress and provider outage can create/send/edit/queue/retry under
  machine attribution; identity GET reports the machine actor; model input has
  only the per-group wrapper with a machine label and no metadata/prose;
  malformed requests and independent authorization/validation failures still
  fail.
* `fork/build/bb/packages/db/test/data/queued-thread-messages.test.ts`:
  machine authors round-trip through both legacy arrays and the current
  `{authors, editors}` envelope; editing retains the original author and adds
  the editor; malformed metadata still refuses a content update.
* `fork/build/bb/apps/server/test/services/p6r/native-acceptance.test.ts`:
  machine accepted authorship is unchanged across pending reservation,
  restart, promotion, retry, and cancellation; no delivery-time provider
  lookup or current-person substitution occurs.
* Keep the existing two-person/concurrent lineage tests as regression coverage:
  one request's verified person must never appear on another request, and
  machine fallback must not introduce process-global current-person state.

## Dirty-work inventory and overlap

The workspace is intentionally dirty. Existing authored work includes the
untracked `fork/patches/0023-fix-p6r-simple-sender-wrappers.patch` and its
modified `fork/patches/series`, `fork/patches/sha256`, and
`fork/result-tree.lock`; preserve all four. The materialized
`fork/build/bb` tree is clean and remains disposable output. The current
0023 payload overlaps `native-authorship.ts` and
`native-message-authorship.test.ts`; N must not overwrite it. The ADR and
identity plan are also existing authored documents. No production source was
changed during this discovery.
