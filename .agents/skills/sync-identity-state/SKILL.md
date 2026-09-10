---
name: sync-identity-state
description: Review or diagnose optimistic multi-client synchronization, owner changes, revisions, realtime, migrations and recovery. For BB plugin implementation, use the bb-identity package skill rather than rebuilding its controller.
---

# Synchronize identity-scoped state

For BB plugins, start with [bb-identity](../bb-identity/SKILL.md) and its
[state/React reference](../bb-identity/references/state-and-react.md). The package
owns connection, controller, view guards and recovery sequencing. A feature
supplies schema, transactional storage, drafts and merge/recovery presentation.
Do not reproduce these mechanisms in effects or a second synchronizer.

For a non-package state machine, or when reviewing the shared implementation,
name actual actor, subject/target, owner session, acknowledged version, desired
generation and exact in-flight mutation separately. A debounce reduces traffic;
it does not establish ordering or receipt finality.

## Review the transitions

- Late reads/writes must belong to the captured address and owner incarnation.
- A remote read cannot silently replace newer local desired intent.
- Keep at most one dispatched save per controller and coalesce unsent edits.
- CAS validates the acknowledged version atomically with the durable outcome.
- A conflict needs a feature-valid merge/accept-remote/needs-review decision;
  do not automatically resend a whole snapshot that may erase another edit.
- Distinguish not-dispatched persistence failure from uncertain native acceptance.
  Reconcile the same operation before any permitted retry; unknown is not absent.
- Realtime invalidates authoritative reads, with bounded/coalesced work. It is
  neither a replacement value nor proof that a local operation was accepted.
- Mandatory actor/session invalidation detaches immediately, then preserves.
  Voluntary discard cannot reverse an operation already accepted by the server.
- Initialization requires verified empty state and resolved ownership. Malformed,
  unreadable and ownerless legacy inputs are not absence.
- Migration, version changes and receipts share the feature transaction; a local
  promise queue does not prove atomicity across runtimes or storage systems.

## Test a concrete timeline

Use controlled promises and the real changed boundary. Useful cases include
edit B during save A; delayed read after a new edit; conflicting clients;
response loss after acceptance; actor A/B/A with held work; remount during draft
persistence; failed conditional deletion; and migration racing initialization.
Assert desired state, durable state, original operation ID and request counts
through settlement. A short sleep plus zero saves can pass when recovery failed.

Use actual browser IndexedDB for its transaction/lifecycle contract and mounted
React for resource ownership. Keep synthetic/controller, controlled SDK, packed
artifact, and live-host evidence distinct. See the
[verification reference](../bb-identity/references/migration-and-verification.md).
