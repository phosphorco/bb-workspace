# State, views, and recovery

Read [CONSUMERS state/view recipes](../../../../community-plugins/packages/bb-identity/CONSUMERS.md#one-preferences-feature),
[react.d.ts](../../../../community-plugins/packages/bb-identity/react.d.ts), and
[state.d.ts](../../../../community-plugins/packages/bb-identity/state.d.ts) for the task's exact types.

The feature supplies a stable `StateResource<T>` and transactional
`AtomicStateStorage<T>`. Persistent `DraftStorage<T>` is an explicit opt-in,
not a baseline requirement. Resource codec input and wire output may differ.
Defaults and edits must round-trip idempotently; do not use a forgiving repair
decoder to silently change corrupt recovery data.

Choose the smallest ownership model that matches loss cost. For a cheap,
re-creatable preference, keep one authoritative server value, one direct write
protocol, and explicit in-session error/retry/conflict handling. Omit `drafts`:
an unsaved edit is intentionally abandoned on reload or view replacement rather
than creating a browser-owned second truth, migration path, or recovery UI.
Add `DraftStorage` only when the loss cost of a real work product exceeds that
additional ownership, reconciliation, and failure surface. Do not add a
compatibility store “just in case.”

Compose `useBbIdentityClient()` -> continuously mounted `BbIdentity.Provider`
-> `BbIdentity.Context` -> `useIdentityStateBinding`. A client or binding may
be null during committed acquisition; render pending UI without unmounting its
Provider. If the feature opts into durable drafts, keep its draft adapter above
the replaceable Context. The Provider borrows the client, owns preservation
coordination, and must not assume a module-global view. Acquire active resources after commit; callback changes
must not change resource identity or publish an abandoned render's callback.

Render desired state from the binding snapshot, including a same-controller
conflict value when appropriate. A ready outer feature presentation does not
mean the controller is ready to edit. Expose explicit errors on blocked paths;
show recovery only for a feature that deliberately opted into durable drafts.
Keep viewed-subject read-only status separate from synchronization readiness;
a failed state read must not tell the actual owner to return to their own view.
Session stamps are opaque host-issued comparison tokens, not resource slugs.
Preserve encoded characters and compare the exact stamp. Test state reads and
writes with host-shaped stamps, not only short fixture identifiers.
Use package profiles for selected-subject labels and capability-gate view-as on
the default-user host. View-as changes the subject without impersonation.

Recovery actions capture the exact binding, owner session, and conflict token
or checkpoint revision when presented. Check that same scope after awaits.
`reconnect(expectedOwnerSession)` checks the captured owner, reconciles any original
uncertain operation, and reloads; it is not `client.refresh()` or a new save.
Display pending/error, not “Saved” merely because reconnect returns success.
The controller may resume ordinary pending edits after recovery.

SQLite owns committed state and exact receipts. Validate at commit inside the
same immediate transaction as CAS/import/receipt. Receipt replay and expiry
precede fresh mutation work. A failed receipt write rolls back the import too.
Initialization adopts an existing winner. For a no-draft preference, surface
the winner or a conflict directly; do not retain a losing local candidate in a
second store.

When deliberately enabled, draft storage must work after detach/network failure
without acquiring new server identity resolution. Persist the full
`PendingDraft`, including base, desired, generation and exact in-flight
mutation. Atomic revision-conditional deletion cannot erase a newer checkpoint.
Enumerate by full address plus actual actor across old controller sessions,
without automatically choosing one or expiring it.

For a feature that enables checkpoints, failed persistence needs feature-owned
export/retry and exact failure-generation acknowledgement. Acknowledgement is
presentation cleanup, not durable save. Provider-local coordination cannot
promise browser-death recovery before storage committed. Do not require live
RPC merely to preserve an already detached local draft.

Use the shared `/react` IdentityAvatar and IdentityLabel with already-resolved
profiles; they do not fetch per row. IdentityViewPicker borrows the surrounding
Provider/Context and owns bounded search/selection presentation. IdentityViewStatus
keeps return-to-self available independently of feature preparation/edit readiness.
Feature conflict and—when opted in—draft export and retry decisions remain
feature UI. Preserve
accessible labels and keyboard behavior when replacing a local picker, then run
the actual consumer matrix; package-only rendering does not establish parity.
