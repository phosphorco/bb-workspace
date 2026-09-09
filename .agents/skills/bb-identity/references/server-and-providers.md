# Server and providers

Read the relevant sections of [CONSUMERS.md](../../../../plugins/packages/bb-identity/CONSUMERS.md)
and exact declarations in [bb.d.ts](../../../../plugins/packages/bb-identity/bb.d.ts).

Create one `bindBbIdentity(bb)` per plugin factory. Handle the factory Result;
register identity-dependent RPCs and resources through that binding. Keep the binding tied
to plugin disposal. `binding.rpc.register` gives handlers a `BbInvocation`;
Open `invocation.person()` for actor-scoped work and dispose the opened request.
The legacy method name can return a machine actor; inspect the actor kind when
person-specific behavior is required. Background work uses the shared machine
fallback, never an invented person or fabricated scope.

For personal resources register `policy: {kind: 'self-only'}` for writes and,
where preview is intended, `readPolicy: {kind: 'collaborators'}` for reads.
An actor-only React policy alone cannot enforce this on the server. All trusted
collaborators may read shared information; correct target/author identity still
matters for writes. A queued or external action is not a person invocation.

Providers verify evidence and return issuer/subject/presentation. Host-issued
ingress facts and selected credential bytes are distinct. Directory search and
lookup are independently optional, and canonical keys are normalized by the
package/host. Consumers must not call `identity-boundaries` by name to obtain
what the shared profile/directory/participant contract should provide.

Use session presentation for self when appropriate; missing directory support
does not erase a resolved actor. Preserve coverage, cursor, unavailable and
partial statuses for other lookups. Validate provider records and history
entries instead of asserting their types. Each lookup record must match its
requested issuer/subject; a well-formed profile for someone else is still an
invalid lookup response. Preserve requested key ordering, including duplicates. Never manufacture a person reference
from a display name or unvalidated raw key.

Prove the real path: public client route -> public server binding -> supplied
provider/participant callback. A browser host returning a plausible DTO bypasses
this composition and cannot prove it works. Check callback counts, positive
collaborator reads, denied foreign writes, and new operations after disposal.

The `/bb` entry registers native RPC/state routes and exposes `http.route` for
feature HTTP APIs. Its handler receives the SDK HTTP context and a package-issued
invocation. Interactive routes require local host auth; external routes must
validate their credential before effects. Keep streamed work inside the response
lifetime: completion, cancellation, abort and disposal release its resources.
Identity fetch route mappings are explicit; registration does not infer them.
Use `background(invocation => endpoint.search/profiles/participants(...))` for
nonperson evidence reads. Background attribution does not imply a person;
owner and route policies still govern writes.

Provider wrapper objects may be recreated on every enumeration. Fence async reads
by the declared provider generation, not object identity. Direct profile lookups
must work before search. A version-specific host adapter may decode its host's
canonical key only after exact current-source `person` round-trip validation;
feature plugins continue treating identity keys as opaque. Bound caches and clear
them at generation changes; late results cannot repopulate a retired generation.

For feature-owned durable writes outside a state resource, retain the issued
write target across awaited preparation and call `binding.server.commits.validate`
with the exact owner/session/address scope inside the synchronous transaction.
A later commit must still match the captured namespace, actor, owner and current
lifecycle. An equivalent copied target does not fail solely because it lacks
private issuance provenance; trusted-process identity forgery is not a supported
security boundary.

A baseline SDK declaration may omit the optional enhanced protocol while the
candidate host provides it at runtime. Feature code passes its public `bb` to
`bindBbIdentity`; it does not add fork fields to generated SDK types or inspect
raw protocols itself. Check the actual host injection and the explicit target
SDK witness before calling this a capability gap. A true baseline without the
protocol cannot activate an IdP; report that unsupported provider boundary while
keeping ordinary portable features usable.

Credential-only service calls retain their independent integration access checks. Background
delivery may use ordinary SDK RPC with feature-issued route credentials; the
receiving handler validates them before mutation and never opens an ambient
person. Use the common machine fallback for attribution; do not invent a background
person or duplicate actor resolution in the feature. Actor-scoped nested calls use PersonRequest.callPlugin so their original
request and destination generation remain fenced.

A feature Codec can adapt its own JSON schema with decode returning validated
Result literals and encode producing validated JSON. The absence of a generic
Zod adapter is not a missing identity primitive. Do not cast unknown DTOs to
avoid that boundary.

For enhanced HTTP, core owns response-body completion and the package follows
its scope signal. For a baseline HTTP host, the package owns that completion.
Do not stack two independent owners that each release the same scope on EOF:
the inner release can abort the outer reader before EOF reaches the client.
Test the actual package through the host dispatcher, including cancellation;
separate fake package and raw-host tests can both pass while composition fails.
