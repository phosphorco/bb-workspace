# External contributions and provenance

Read [CONSUMERS external recipe](../../../../community-plugins/packages/bb-identity/CONSUMERS.md#external-contributions-and-history)
and the current `/bb` and `/server` declarations before implementing a producer.

The integration verifies its credential and maps an external subject. Core
namespaces it by the sending plugin; it never becomes a BB person by sharing
a name. Before dispatch reserve a feature-owned durable operation containing
immutable subject/presentation, target, mode, exact input and operation ID.
Keep that row independent from rotatable/revocable credentials.

Caller idempotency keys bind to one immutable payload. Concurrent same-key
requests share reservation/finality; changed payload rejects. Preserve legacy
callers when migrating an API, with explicitly weaker one-shot retry guarantees
if they lack a key. Add retry-safe inputs/outputs without removing old workflows.

Use `binding.server.sendExternal` and `lookupOperation`. Select external prompt
rendering once when constructing the binding: `host` (the default) adds one sender
envelope, while `producer` preserves a producer-owned envelope and `<attached>`
context. The binding does not sniff text for existing frames; the external
subject remains structured provenance, and producer mode still registers it.
On enhanced hosts, producer mode also enables the optional plugin-scoped SDK
rendering hook so ordinary sends and explicit queued messages keep producer-owned
frames. Older enhanced hosts without that capability report incompatibility;
plain upstream remains supported. The transport hint is presentation metadata,
not a credential. Preserve explicit queue semantics and test the actual SDK HTTP
path, including SDK references obtained before binding initialization.
Submitted/rejected are final; pending remains pending; unknown/expired/unsupported
is uncertainty.
Only an authoritative absent-final result can allow retry of the same operation
under current authority and matching immutable input. A host queue must retain
that same operation as pending until acceptance or terminal cancellation; queued
work must never be reported as a final rejection while it can still execute.
Never generate a new ID
because a response or observer was lost. Rotation does not reauthor old work or
implicitly grant the successor authority over the old subject.

A fresh reservation may dispatch its first send without operation lookup; an
upstream host can support sending while lookup is unsupported. Record dispatch
intent before sending. After possible dispatch, require reconciliation for any
retry. Replay a validated feature-persisted final even after host receipt expiry,
and validate immutable request equality before returning that replay. Re-read the
durable winner after concurrent reservation; never dispatch a losing candidate ID.

On restart, decode persisted IDs, author, prompts, mode and receipt evidence
before using them. Match a retained receipt to its exact operation row. Corrupt
rows remain retained uncertainty; they never become a fresh reservation. When
adding a dispatch marker to an existing table, treat older rows conservatively
as possibly dispatched unless durable evidence proves otherwise.

Acceptance and observing a response are different durable states. Correlate a
call by operation -> execution/turn evidence, then native events. Identical text
and matching nickname are not correlation. Grouped contributions can share a
turn; report shared/partial evidence honestly. Validate history page metadata,
entries and correlation before accepting `known` evidence. A declaration on
`/server` is not proof the same member is exposed by `/bb`.

Verify modes against native behavior instead of mapping by similar names.
Baseline hosts may provide source-labelled submission without guaranteed
deduplication or operation lookup. Preserve useful native workflows and make
limits visible at the relevant operation. A missing exact-correlation mechanism
requires a concrete supported-API investigation, not a text-matching fallback
presented as authoritative or removal of the call feature.

Preserve native send modes explicitly. AUTO is not interchangeable with start
or steer-if-active on an active thread. Verify the public type, adapter validator,
enhanced protocol input and native dispatch together before claiming mode parity.

Call observation starts after acceptance but has its own durable identity and
original event cursor. Do not capture a new tail cursor on a replay: that can
skip the accepted call's output. Wait for pending operation history within a
bounded, cancellable observer; duplicate attempts of one turn do not imply
multiple outputs. Preserve explicit shared-output semantics for multiple turns.
A baseline SDK acknowledgement without native identifiers cannot prove exact
correlation; retain useful read/stream access and visible uncertainty without
inventing a text match or issuing another send.

Follow bounded history continuation cursors rather than repeatedly reading the
first page. Apply cancellation/deadlines during a pending history read as well
as between polls. One correlated turn does not establish exclusive authorship:
grouped original/generated inputs can share that turn. Preserve unknown scope
unless the evidence positively establishes stronger ownership.

For core queue integration, exercise the real active-thread dispatcher and normal
queue drain. A low-level send function may reject a mode that the dispatch
checkpoint supports by retaining a queued row. Keep queue reservation and final
receipt promotion in their native transactions. Fast drain paths must preserve
those callbacks for every reserved row, including an external row after an
ordinary lead. Retain each row's actual input-group position and frozen author
when promoting a mixed batch; commit participant projection with promotion.

An accepted request can precede its exact native turn link. After validating the
history query/cursor, expose pending while retained, otherwise-intact operation
evidence is awaiting that link. Do not classify missing contributions, empty
attempts, generated context without causal mapping, or ambiguous accepted-input
events as pending. Verify the transition using the matching native request ID,
then observe its exact turn; do not substitute the latest turn or message text.

A finite-call lease also belongs to the request/response lifecycle. Release it
when execution omits the event field, fails before observation, or completes or
cancels its response. A lazy stream iterator may never start, so its finally
block alone cannot own cleanup. Use execution and response completion signals,
not a next-tick timeout. Test the served helper against the installed plugin
bundle as well as the source factory; bundled dependency copies can differ.
