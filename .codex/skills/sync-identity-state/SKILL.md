---
name: sync-identity-state
description: Design, implement, or review multi-client synchronization for identity-scoped settings and other optimistic UI state. Use when local edits, server revisions, realtime updates, reconnects, migrations, or multiple browsers can race.
---

# Sync Identity State

Treat synchronization as an explicit state machine. A debounce can reduce traffic,
but it cannot establish ordering or prevent stale state from replacing newer work.

## Establish the model

Name these values before changing code:

- **Owner:** the stable principal key whose record is being edited. Do not use a
  browser, installation, display name, email, or impersonated/view-as identity as
  the write owner. Previewing another owner is read-only unless the product
  explicitly authorizes delegated writes.
- **Desired state:** the newest state selected by the local user, rendered
  optimistically.
- **Acknowledged state:** the last server-confirmed state and server revision.
- **In-flight mutation:** the desired snapshot currently being saved, tagged with
  a monotonically increasing local generation.
- **Pending mutation:** the latest desired snapshot that superseded the in-flight
  mutation. Coalesce intermediate snapshots instead of retaining an unbounded
  FIFO queue.
- **Remote state:** a server snapshot discovered by load, realtime, reconnect, or
  conflict. It is authoritative only relative to its revision and only when no
  newer local intent must be preserved.

Keep the owner key, server revision, and local mutation generation independent.
A server revision orders durable records. A local generation orders this
client's intent. Neither can substitute for the other.

## Required invariants

Design transitions so that all of these remain true:

1. A response for an older owner or an obsolete load generation cannot affect
   the current owner.
2. A load or realtime notification cannot replace desired state while a local
   mutation is dirty, pending, or in flight.
3. At most one save per owner is in flight from a client, and the pending slot
   contains only the latest desired snapshot.
4. A save uses the revision of the acknowledged state it was based on.
5. A successful save advances acknowledged state and revision. It updates the
   rendered state only if no newer local generation exists.
6. A conflict advances acknowledged state to the returned server snapshot. If
   newer local intent exists, preserve it and retry/rebase it against the new
   revision; otherwise render the server snapshot.
7. Duplicate, self-originated, or older realtime events do not trigger redundant
   loads. A newer remote revision is loaded immediately only while clean; while
   dirty, remember that a refresh is needed after local writes settle.
8. Switching identities cancels timers, invalidates old callbacks, and starts a
   new owner session. Never send an old owner's pending state under a new owner.
9. Editing before identity resolution is either disabled or retained as explicit
   pending intent. It must not be silently overwritten when identity resolves.
10. Migration participates in the same atomic revision protocol as ordinary
    writes. A legacy read followed by an unguarded copy is a write race.

## Client transition shape

Use a small controller or reducer rather than distributing synchronization across
uncoordinated effects and refs. The controller should own:

- owner session/generation;
- acknowledged revision and snapshot;
- desired snapshot and local generation;
- dirty, in-flight, and pending status;
- debounce timer;
- deferred remote revision or refresh-needed flag;
- disposal and owner-change invalidation.

On a local edit, render it immediately, increment the local generation, replace
the pending snapshot, and restart a short trailing debounce (commonly 250–500
ms). If a save is already in flight, do not start another; the latest pending
snapshot begins after it settles. Product-specific boundaries such as blur,
dialog close, or drag completion may flush immediately.

Capture the owner, expected server revision, local generation, and snapshot in
each request. Validate all four when its response returns. Do not let React
closure freshness or promise completion order implicitly define correctness.

Realtime events should contain at least the owner and revision. An optional
origin/client ID can suppress self-notifications cheaply, but correctness must
not depend on it. If channels cannot be owner-scoped, discard events for other
owners before loading.

Local storage is a cache or offline fallback, not a second authority. Namespace
it by owner and schema version. Record enough metadata to distinguish a clean
server-confirmed cache from unsynchronized local intent.

## Server transition shape

Store one versioned envelope per stable principal, for example:

```text
{ schemaVersion, revision, value }
```

Save with compare-and-set semantics:

```text
if current.revision != expectedRevision:
  return conflict(current.revision, current.value)
write { revision: current.revision + 1, value }
publish { owner, revision: current.revision + 1 }
return saved(current.revision + 1, value)
```

The comparison and write must be atomic across every process that can access the
record. An in-memory promise queue only serializes one runtime; use a database
transaction, conditional update, or genuine storage CAS when multiple runtimes
can share storage.

Resolve the actual authenticated principal on every write. Reads may support an
explicit view-as principal, but return whether that view is read-only. Prefer a
canonical principal key and migrate legacy aliases within the same serialized or
transactional operation as saves.

Avoid incrementing revisions or publishing when the normalized value is
semantically unchanged. This limits feedback loops and makes revisions describe
meaningful durable transitions.

## Test interleavings, not source patterns

Build deterministic tests with controllable promises or a fake transport. At a
minimum cover:

- rapid edits coalesce into one save;
- edit B occurs while edit A is in flight;
- A succeeds and emits realtime before B saves;
- a delayed load returns after a newer local edit;
- conflict arrives while a newer local edit is pending;
- duplicate, older, self, and other-owner realtime events;
- disconnect/reconnect while dirty;
- identity resolution or owner switch while dirty;
- legacy migration racing the first edit;
- unmount/disposal with a debounce or request outstanding;
- two clients saving from the same revision.

Assert both rendered state and durable state after every interleaving. Also assert
request counts and revisions so a passing UI test cannot hide a synchronization
storm.

When reviewing an existing implementation, write at least one concrete event
timeline for each suspected race. If correctness depends on which promise wins,
which effect runs first, or whether realtime is fast enough, the state machine is
incomplete.
