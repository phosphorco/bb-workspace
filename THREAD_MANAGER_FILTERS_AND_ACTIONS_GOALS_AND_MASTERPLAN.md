# Thread Manager Filters and Actions: Goals and Master Plan

## Purpose

Thread Manager is BB's fleet workspace for finding, inspecting, selecting, and
safely acting on many threads. This plan adds provider/model/reasoning
visibility, filtering, and grouped execution reassignment without weakening the
bounded-load, review-before-mutation, partial-failure, accessibility, or native
thread-inspection behavior that already defines the plugin.

The work spans two canonical child repositories:

- `fork/`: BB server, database query, public API, SDK contract, tests, and fork
  patch materialization.
- `plugins/`: Thread Manager RPC, pure transformation logic, React UI, styling,
  tests, documentation, and canonical plugin reload.

The workspace root remains the composition authority. Existing dirty work in
either child is authored work and must remain visible and undisturbed.

## What Thread Manager Is Today

Thread Manager is more than a bulk-action toolbar. Its existing product
contract includes all of the following:

1. **A bounded fleet dashboard.** The default query covers a trailing activity
   window (currently three days), with explicit widening for older/archive
   questions. Hidden pages do not poll or refetch merely because realtime state
   changed.
2. **Authoritative and provisional data.** The host sidebar snapshot paints an
   immediate provisional active-thread view. Selection and mutations remain
   disabled until the plugin's authoritative dashboard query arrives.
3. **Client and server filters with deliberate ownership.** Cheap presentation
   filters use TanStack's client row model. Project/archive, participant facet,
   and historical error queries stay server-owned because they affect the
   authoritative result partition.
4. **Sorting, pagination, and all-matching selection.** Selection spans the
   filtered row model rather than only the visible page, and survives page
   navigation. Shift ranges and a select-all header support fleet operations.
5. **Inspection without navigation churn.** A click chooses the active preview,
   hover temporarily peeks, double-click opens, and BB's native read-only
   `ThreadChat` owns timeline rendering.
6. **Bulk review before effects.** Every action receives an alphabetized,
   editable final target review. Archive resolves cascaded children and side
   chats. Message delivery exposes queue/steer semantics and honestly labels
   irreversibility.
7. **Reversible and irreversible actions.** Archive, pin, read state, and related
   actions use bounded Undo/Redo over only the threads actually changed.
   Follow-up sends are explicitly irreversible.
8. **Partial success as a first-class result.** Bulk work is concurrency-bounded,
   records per-thread failures, keeps skipped targets selected, and presents a
   concise outcome.
9. **Realtime and cache discipline.** The plugin owns one TanStack Query client,
   invalidates its fleet snapshot as a unit, avoids background refetch while
   hidden, and leaves native thread caches to BB.
10. **Dense-list and accessibility contracts.** Stable table renderers preserve
    focused controls. One shared dialog owns focus trapping/restoration. Native
    elements, live regions, keyboard selection, narrow layouts, and semantic
    theme tokens remain required behavior.

The execution feature must compose with every one of these contracts.

## Requested Product Outcome

A user can:

1. Scope the authoritative dashboard as they do today.
2. Filter by provider.
3. Filter by effective model.
4. Filter by effective reasoning level.
5. Select individual, ranged, paginated, or all matching threads.
6. Open a **Change execution** review.
7. See selected threads grouped by provider, then current model, then current
   reasoning level.
8. Assign a target model and/or reasoning rule to each source group.
9. Override a model-level reasoning choice for a particular source-reasoning
   subgroup.
10. Review the exact effect counts and exclusions before committing.
11. Apply the changes as sticky thread execution overrides with bounded,
    race-aware, partial-success semantics.
12. Keep failed or concurrently changed threads selected for correction/retry.

Existing threads cannot change provider. Provider sections constrain target
models to that provider and to catalogs valid for the selected threads'
host/environment routes.

## User-Facing Semantics

Every target field has three semantically distinct states:

- **Keep**: omit the field; preserve the thread's current configured behavior.
- **Clear override (use next-turn fallback)**: send `null`; clear the sticky
  thread override. The resulting fallback is the last recorded execution value
  before the matching-provider project default, not necessarily the project
  default itself, and the review shows that resulting value.
- **Explicit value**: set the chosen model or reasoning level as a sticky
  override.

The mapping hierarchy is:

```text
Provider
└── Source model
    ├── Target model: Keep | Clear override | provider model
    ├── Default target reasoning: Keep | Clear override | valid effort
    └── Source reasoning
        └── Target reasoning: Use model choice | Keep | inherited | effort
```

A source-reasoning choice overrides the source-model reasoning choice. “Use
model choice” is UI-only shorthand for the source-model reasoning rule; it is
never sent on the wire. If a model changes while reasoning is `Keep`, the
server's existing model-change reconciliation may still change an incompatible
persisted reasoning override; preflight shows that exact outcome. The dialog
compiles rules into per-thread patches, then asks the server to preflight them
before claiming exact counts. Threads for which both fields compile to `Keep`
are counted as unchanged and are not sent to apply.

Changing an active thread's sticky execution setting affects its next turn. It
does not rewrite history or interrupt the current turn.

## Data and API Architecture

### Read path

First make the documented trailing attention window real at the authoritative
facet-query boundary. Today Thread Manager fetches every facet page and applies
`sinceDays` in plugin memory. Add a server-owned `latestAttentionAt` cutoff to
the query scope, include it in cursor semantics, add/verify its supporting
index, and preserve explicit all-time widening. Execution projection must not
land on top of the unbounded default scan.

Do not call `threads.defaultExecutionOptions` once per row. Extend the existing
paged authoritative thread query with an opt-in experimental execution summary,
or add an equivalently paged batch read that the dashboard can join in one pass.
The public member must use the repository's `experimental_` naming and API audit
process.

For each returned thread, expose compact, server-resolved primitives:

- resolved/unresolved state and a machine-readable unresolved reason;
- nullable effective model;
- nullable effective reasoning level;
- persisted model override or `null`;
- persisted reasoning override or `null`;
- independent model and reasoning provenance (`thread-override`, `last-turn`,
  `project-default`, `builtin-default`, or `unresolved`);
- latest relevant request sequence, matching project-default revision/value,
  route identity, and an opaque versioned witness over every input that can
  affect the displayed execution state;
- a dedicated monotonic execution revision for conditional writes; generic
  thread metadata clocks such as read state and title are deliberately absent;
- provider and environment/host routing already carried by the thread row.

The server must preserve the exact existing-thread resolution semantics used by
the next turn. It should query the selected page as a batch using current event
indexes and project/thread records, decode at most the latest relevant execution
event per thread, and perform no provider/host discovery.

Execution inclusion is opt-in so ordinary thread-list consumers do not pay its
query, decoding, or payload cost. The latest-event database helper returns only
the latest eligible request row for every selected ID in variable-safe batches;
it does not issue one statement per thread or load every historical request
event. One malformed thread row becomes one unresolved summary rather than
failing its whole page.

### Catalog path

The dashboard does not load destination model catalogs. Opening Change
execution loads catalogs lazily, deduplicated by the smallest route that can
change availability (provider plus host/environment route). Catalog work is
bounded by unique routes, never by selected-thread count.

For a mixed-route source group, the UI uses models and reasoning efforts valid
for every target thread, or presents explicit support counts and exclusions.
It never implies a fleet-wide choice is valid when the server will reject most
of the group.

Catalog identity is provider + host + workspace path only when that provider's
catalog is workspace-dependent, plus the provider registration/bridge identity
already carried by BB's model-list memo. Preserve raw model IDs,
`routeProviderId`, and selected-only/retired status. Fallback rows returned with
`modelLoadError` are not reassignment targets. The bounded route batch has an
explicit loading/retry state and returns verified, error, or empty status per
route. Catalog probing is capped at 100 routes and four concurrent host probes,
so a pathological one-environment-per-thread selection cannot open unbounded
host work or one plugin RPC per route.

### Mutation path

Do not dispatch one public HTTP/plugin SDK request per thread. Add experimental
batch **preflight** and **apply** methods.

Preflight accepts explicit per-thread patches plus the dashboard witness. It
batch-rereads execution inputs, classifies already-stale targets, loads and
validates catalogs outside any database transaction, applies the shared native
resolver/reconciliation policy, and returns deterministic per-thread proposed
outcomes plus an opaque server-issued apply token. Only this response may be
labeled an exact review.

Apply accepts only preflighted items and their token. Inside one immediate
transaction it rereads every relevant execution input and performs an atomic
conditional write. A token/witness mismatch is `stale`; two concurrent applies
cannot both claim to have changed the same reviewed state. No host/catalog
await occurs while a transaction is open.

The server must:

1. cap and deduplicate targets (5,000 maximum in this version, with the action
   accessibly disabled and explained at 5,001 rather than silently truncating);
2. batch-resolve their current execution state;
3. skip missing, provider-mismatched, or stale-since-review targets;
4. group remaining patches by provider/host catalog route;
5. load each catalog once;
6. validate model and reasoning combinations with the same policy as the
   single-thread update;
7. persist all valid overrides with conditional set-based work in one immediate
   transaction; a write failure rolls back would-be successes and classifies
   them with retryable `write-conflict` or `transaction-failed` outcomes while
   preserving independently invalid/stale classifications;
8. avoid starting/stopping/reconfiguring runtimes during the batch;
9. return discriminated, deterministically ordered `succeeded`, `unchanged`,
   `stale`, and `failed` outcomes with stable codes, retryability, and final
   values;
10. emit one canonical execution-config notification for native/cross-client
    caches plus one aggregate Thread Manager invalidation.

The native single-thread route and the bulk route share pure validation and
resolution logic so behavior cannot drift.

## Thread Manager Integration

### Dashboard model

Extend `ThreadCard` with stable execution primitives and one combined execution
presentation. Provider/model/reasoning choice lists and counts are derived once
per immutable dashboard response.

Provider, model, and reasoning filters remain client-owned because the
authoritative bounded partition is already loaded. They participate in reset,
empty-state, pagination reset, search, selection, and view-customization logic.
The filter cluster is a labeled fieldset with stable IDs, deterministic option
counts, raw model-identity disambiguation, and an Unknown/unresolved choice.
Search includes execution presentation; sorting gives unknown and retired
entries deterministic positions.

Selection is backed by a separate ledger of ID, last-known card, and execution
witness rather than only the current response map. Filtering or paging may hide
selected rows without deleting them. A refresh that makes a row unavailable
retains it as unavailable. Review freezes a snapshot. Clear is explicit;
successful changes are removed after apply, while stale/failed/unavailable
targets remain selected. The bulk bar reports visible, hidden, and unavailable
selected counts.

### Table

Prefer one sortable **Execution** column rather than three extra dense columns.
Its cell shows provider, model, and reasoning compactly without introducing
per-row menus, queries, providers, dialogs, or timers. Module-scoped TanStack
column renderers remain stable.

### Review dialog

Mount one shared execution dialog only after the action is requested. Build its
groups in one linear pass over the reviewed selection. Keep group renderer
identity stable and state keyed by source tuple. Preserve Escape, Tab,
Shift-Tab, initial focus, close focus restoration, long-label wrapping, and
narrow/coarse-pointer behavior.

This version admits at most 250 distinct source groups and 100 distinct
execution routes into the editor, in addition to the 5,000-thread mutation
cap. Larger heterogeneous selections remain selected but must be narrowed
before catalog loading. The caps keep DOM/control count and provider route
latency explicit instead of treating a thread-count limit as a rendering bound.

The review displays:

- selected and unchanged counts;
- provider/model/reasoning source groups and thread counts;
- target model and reasoning controls;
- route/catalog exclusions;
- a server-preflighted exact summary before Apply;
- a clear statement that changes affect the next turn;
- no misleading Undo promise; this version is reviewed and race-safe but not
  Undoable. After an unknown response, refetch and present current state rather
  than blindly replaying.

The mapping dialog owns catalog/group state in a child React boundary so edits
do not rerender the table. It remains one shared plugin-owned dialog and stacks
its controls on compact/coarse-pointer layouts without mounting a second mobile
surface. It has a stable heading/description/Cancel focus target, guards close
while applying, restores focus only to a connected element, exposes route
loading and errors through a polite live region, stacks controls at narrow
widths, respects safe areas/`100dvh`, and remains usable under text zoom and IME
composition.

### Results and cache

Apply one mutation, patch or refetch the dashboard once, coalesce the caller's
own canonical notification, publish one Thread Manager change notification,
retain skipped/stale rows selected, and announce the result through the
existing status/error surface. Network/schema failure keeps review and
selection intact. Do not trigger one dashboard refresh per changed thread.

An ordinary preflight transport/schema failure keeps the editable mapping and
selection intact. An unknown apply response is different: it may have committed,
so the UI keeps selection, invalidates the one-use review tokens, refetches
authoritative state, and requires a fresh preflight rather than risking blind
replay.

Execution changes affect only explicitly selected IDs. They do not cascade
through parents, children, forks, or side chats. Active, idle, archived, and
hidden public threads are eligible; deleted/missing threads fail. Unknown rows
remain filterable/selectable but cannot compile an update until preflight
resolves them.

## Performance Invariants

1. Ordinary dashboard load performs zero provider model-catalog calls.
2. The feature adds no polling, global tick, or settled-idle timer.
3. The new execution read/preflight/apply paths perform no per-thread HTTP,
   plugin RPC, SDK, or host calls. Existing participant/error-history and
   legacy-action fan-out remain separately recorded baseline debt.
4. Execution-state work grows linearly with the already-bounded dashboard rows
   and is batched per page/query.
5. Catalog calls are bounded by unique provider/host routes.
6. Preflight and apply are one public request each and use a variable-safe,
   sublinear number of database statements/transactions rather than one
   statement per thread.
7. Filter derivation is built once per dashboard snapshot, not per row render.
8. Opening the dialog is `O(selected threads)`. Editing a rule updates only the
   bounded rule maps; per-thread patch expansion runs once when Review is
   requested, not on every select change.
9. Closed dialog infrastructure is not multiplied across rows.
10. One mapping edit does not remount or rerender the underlying table.
11. One aggregate cache/realtime invalidation follows a completed batch.
12. Hidden-page behavior remains stale-without-refetch.

## Correctness and Race Invariants

1. A reviewed thread is updated only through an atomic conditional write if its
   provider, route, overrides, latest-request sequence/value, matching project
   default revision/value, and effective execution still match preflight.
2. A provider cannot be changed in place.
3. `Keep`, `Clear override (use next-turn fallback)`, and explicit values remain
   distinct on the wire and in tests.
4. Model-only updates preserve/reconcile reasoning exactly as the native route
   does.
5. Reasoning-only updates validate against the effective target model.
6. Mixed model/reasoning updates validate atomically per thread.
7. Catalog failures affect only the relevant route group and are retryable.
8. Partial success never clears failed, stale, or unavailable targets from
   selection.
9. Active work is neither interrupted nor silently reconfigured mid-turn.
10. Active, idle, archived, and hidden public threads are eligible without
    hierarchy cascade; deleted/missing threads fail explicitly.
11. Concurrent batches, new accepted turns, project-default changes, native
    picker/CLI changes, and same-millisecond metadata writes cannot make stale
    apply succeed.
12. Unrelated title, read-state, visibility, hierarchy, and lifecycle metadata
    writes cannot make an otherwise-current execution preflight fail stale.

## Implementation Phases

### Phase 0: Establish evidence and review

- Capture workspace/child status, materialized result tree, active plugin
  source, and relevant dirty overlaps.
- Create this plan and the companion ledger before implementation.
- Ask an independent context agent to review the proposed architecture and
  incorporate or explicitly reject each material concern.

### Phase 1: Pure domain and database batch resolution

- Extract/share exact effective-execution resolution semantics.
- Add a batch database/service path over a bounded set of thread IDs or query
  page.
- Cover override/default/last-execution precedence, missing history, archived
  threads, and source witnesses.
- Inspect query plans and event-row counts on representative and stress data.

### Phase 2: Experimental SDK contracts

- Add opt-in execution data to the authoritative thread query or a paged batch
  read.
- Add batch preflight/apply and structured results.
- Update API audit documentation and generated/bundled SDK declarations.
- Add CLI inspection/filtering and bulk execution update/clear support plus its
  guide/skill documentation.
- Repair the native existing-thread picker to call the sticky update path; the
  plugin is not a substitute for native correctness.
- Increment the host-daemon protocol only if the actual daemon wire changes;
  HTTP/plugin SDK-only changes must not cause an unrelated bump.
- Ask a second independent context agent to review contract boundaries,
  compatibility, and tests before plugin integration.

### Phase 3: Thread Manager data/filter integration

- Extend dashboard RPC schemas and cards.
- Add provider/model/reasoning filters and reset/view-customization behavior.
- Add combined execution presentation and sorting/search coverage.
- Preserve provisional-data selection safety and bounded window behavior.
- Add the retained selection ledger and 5,000-target boundary behavior.

### Phase 4: Mapping compiler and bulk action

- Implement pure grouping, rule precedence, catalog intersection/support, exact
  patch compilation, and result summarization modules.
- Add focused tests before wiring React.
- Add the lazy shared review/preflight/apply dialog and batch RPC.
- Preserve partial-success selection and single invalidation behavior.

### Phase 5: Verification and live exercise

- Fork: focused DB/service/route/SDK tests, Turbo typecheck/build for affected
  packages, fork verify/materialize workflow, and relevant broader suites.
- Plugin: sync, references, SDK types, typecheck, tests, and build.
- Performance: fixed 0/100/1,000/5,000-row fixtures; dashboard load, filter to
  paint, Select All, dialog open, one mapping edit, apply; database statement
  count, host call count, long tasks, and retained heap.
- Accessibility: keyboard/focus, screen reader names/status, text zoom, narrow
  layout, reduced motion, light/dark/custom palette.
- Runtime: build/reload only from the canonical organization-plugin path,
  confirm `bb plugin source thread-manager`, and exercise a safe representative
  batch against staging data.
- Ask independent context agents for performance/UI review and final
  requirement-by-requirement audit.
- Record the fixture/database hash, exact fork result tree/plugin source/browser,
  viewport/DPR/theme/motion/pointer mode, cold/warm cache and visibility state,
  raw artifacts, and separate production versus render-attribution lanes.

## Verification Evidence Required for Completion

- Tests that fail without the batch read/write behavior and pass with it.
- Query/call-count witnesses proving no per-thread host/API fan-out.
- Plugin tests proving all filters, selection semantics, grouping precedence,
  `Keep`/inherit/explicit compilation, stale skips, and partial results.
- A production build and canonical plugin source/reload witness.
- A current workspace status showing unrelated dirty work preserved.
- Ledger entries recording architecture reviews, implementation discoveries,
  verification commands/results, remaining limitations, and final audit.
- Atomic concurrent-batch/new-turn/project-default tests; preflight-token
  tamper/staleness tests; canonical notifications; unresolved/malformed history;
  selected-only/retired and Pi/route-provider identity; route-local catalog
  failures; 0/1/5,000/5,001 boundaries; transaction rollback; response-loss
  refetch; native picker and CLI parity; and final disposition of every review.
- `./bin/check --role staging`, every exact plugin AGENTS command, fork
  verify/materialization and affected Turbo gates, canonical plugin build and
  reload, and live source confirmation.

## Explicit Non-Goals

- Changing a thread's provider in place.
- Rewriting historical turns to claim a different model.
- Interrupting active work to force an immediate runtime change.
- Loading all-time thread history by default.
- Building a second thread table, model picker, or design system outside Thread
  Manager's existing plugin-owned route body.
- Treating concurrency-limited N+1 calls as an acceptable batch architecture.
