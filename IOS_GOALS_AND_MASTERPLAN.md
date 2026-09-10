# BB Recovery for iOS: Goals and Master Plan

## Document status

- Status: execution underway; reviewer hardening landed
- Last updated: 2026-08-30
- Product name: working title, **BB Recovery**
- Intended package: `@bb/recovery-mobile`
- Intended materialized path: `fork/build/bb/apps/recovery-mobile/`
- Durable ownership: the `bb-fork` patch series, not the disposable materialized tree

This document is the durable product and engineering plan for a small,
native-first iOS client for BB. It is intentionally more stable and narrower
than the full BB web application. `IOS_DEVELOPMENT_LEDGER.md` records discoveries,
pivots, and completed milestones as implementation changes this plan.

## Implementation checkpoint

The `bb-fork` queue now contains five Recovery patches through `0047`,
producing result tree `c15498309f44d74443ad8561f7c645ea80c452f3`.
They establish the independent Expo package, durable SQLite/file kernel, cached
principal context, and bounded SQLite hydration for the core sidebar, thread
shell, and latest timeline. The new versioned recovery snapshot endpoint and SDK
bundle a principal-fenced sidebar with at most 12 requested latest timelines;
the client can atomically ingest coherent per-thread observations into SQLite.
The endpoint honestly reports the whole bundle as `partial` because BB does not
yet expose a sidebar-wide revision. Actor-rich cached rows remain usable during
refresh failure, and the rendered composers are draft-only until guarded
delivery is implemented. Linux-available typechecks, focused/full affected
tests, lint, build, patch-replay/diff verification, and iOS prebuild evidence
are recorded in the ledger; Xcode/simulator process-kill verification remains
a macOS gate.

The reviewer hardening pass scopes rendered Query and SQLite state by both
server origin and canonical principal, makes observed-record writes monotonic,
keeps full SQLite integrity scans off the launch path, validates SDK snapshot
responses, serializes the Node transaction witness, preserves referenced
attachment staging, and removes inherited primary mutation controls from the
Recovery UI. Snapshot scheduling remains dormant until authoritative
revision/tombstone and response-budget rules exist. The inherited MMKV composer
draft store is still not principal-partitioned and remains a blocker before
multi-principal draft dogfooding or guarded delivery.

This checkpoint is the first meaningful slice, not completion of Phases 1–2.
It still lacks a cross-domain authoritative revision, tombstones/change feed,
principal-partitioned SQLite drafts, bundle reduction/closure, native
thread-progress projection, the 72-hour working-set engine, automatic bounded
snapshot scheduling, and guarded server delivery. Exact receipts and
limitations live in `IOS_DEVELOPMENT_LEDGER.md`.

## Motivation

BB Recovery exists so that a user can reliably inspect and continue recent BB
work when the primary web client is slow, regressed, operationally unavailable,
or simply too complex for the immediate task.

The recovery client is not a web fallback embedded in a native shell. Its
critical interaction path must remain React Native: app navigation, thread
organization, timeline presentation, identity attribution, composition,
partial-data states, and pending delivery. Bounded native WebViews are not a
goal and should be absent from the initial product surface.

The motivating experience is:

1. The app launches quickly into locally cached, useful state.
2. Recent threads remain readable even when connectivity or the server is
   unavailable.
3. Thread organization matches the high-value parts of the organization-owned
   `thread-progress` plugin.
4. The user can see who participated and who authored each relevant message.
5. The user can compose immediately, even while a thread is partially loaded.
6. A submitted message survives navigation, reload, process death, and a slow
   reconnect, but is not silently delivered into materially changed context.

## Working terms

- **Server profile**: one Recovery enrollment containing a server origin,
  credential/session, stable server-instance identity, and last server-authored
  principal context. It is not an identity by itself.
- **Principal**: the canonical server-authored key that owns mutations and
  identity-scoped state. A display name, login, device, or profile label is not
  a principal.
- **Actor snapshot**: presentation captured durably with an authored event so
  historical attribution does not depend on the actor's current profile.
- **Protected thread**: a supported thread whose server-authored retention
  activity is within 72 hours, or which has another explicit protection such as
  unsynchronized intent.
- **Complete cache**: all declared domains for a protected thread are proven
  complete against an authoritative server watermark. It does not mean “the
  latest request succeeded.”
- **Recovery outbox**: device-durable user intent awaiting authoritative
  validation or reconciliation. It is distinct from BB's server runtime queue.

## Product goals

### G1. Recovery-grade stability

- The app must render from durable local data before network reconciliation.
- Previously cached content must not disappear behind a replacement loading
  screen during refresh.
- Screen lifecycle, React Query garbage collection, process termination, and
  iOS suspension must not own the durability of user-authored content.
- Failures must be contained to the affected region or operation. A plugin
  outage must not make the core thread list or cached timeline unusable.
- The settled app must be quiet when idle: no global clock propagation,
  repeated whole-list joins, or polling copied into broad React state.

### G2. Fast cached-first interaction

- Warm launch should present the cached sidebar without waiting for network
  requests.
- Opening a cached thread should present its cached timeline immediately.
- Synchronization must update keyed entities and visible projections rather
  than reconstruct every mounted row for a one-thread change.
- Long lists and timelines must retain the existing native windowing model.
- Expensive decoding and presentation objects should be bounded and reusable.

Phase 0 establishes representative hardware, fixtures, an unchanged control,
and provisional pass/fail budgets before feature performance is judged. Until
those are recorded, exact launch or interaction claims are targets to define,
not achieved facts. One invariant is immediate: after settling, the app should
produce no React work except a meaningful presentation deadline, a user action,
or an external data/lifecycle event.

### G3. Complete recent working set

For every discoverable supported thread with server-authored retention activity
in the preceding 72 hours, the client must proactively retain everything needed
to display its supported recovery experience while iOS grants the app execution
time:

- thread and project metadata needed for navigation and organization;
- complete supported timeline events and message bodies;
- durable message-author snapshots;
- participant summaries and identity presentation;
- thread-progress state, topic/activity presentation, comments, and section
  membership;
- supported core approval/question interactions and server queued text messages
  represented by the recovery UI; unsupported plugin-origin forms remain
  explicit unavailable cards rather than falsely complete data;
- local drafts and durable pending deliveries;
- supported message attachments and image payloads.

The 72-hour boundary is a protection floor, not a deletion deadline. Data only
becomes eligible for ordinary eviction after the boundary. Unsynchronized local
intent, drafts, pending interactions, unread or pinned content, and active reads
remain protected. Lightweight thread shells may be retained longer because they
preserve search and organizational continuity at low cost.

Retention activity is domain activity, not a cache read, local observation, or
routine refetch. It includes message/event arrival, relevant progress
transition, comment mutation, pending interaction, queued message, and
meaningful thread metadata mutation. The server owns this classifier and its
timestamp. It is deliberately distinct from conversation-context advancement
used by guarded sends: a comment can protect cached data without changing the
model context into which a message would be delivered.

Completeness is proven per domain and, where paginated, per contiguous range.
It includes timeline coverage and gaps, actor/participant revision, progress
and comment revision, section projection revision, supported queue/interaction
cursor, tombstones, and per-attachment status/hash. A protected thread is not
reported complete until every required domain is complete against the same
declared authoritative head or a contractually consistent set of revisions.

### G4. Native thread-progress organization

The app owns a React Native sidebar that consumes the backend data contract of
`plugins/plugins/thread-progress` without executing its web React bundle.

The target surface includes:

- ordered, named, and collapsible filtered sections;
- manual, recent, and per-section default ordering;
- exclusion of threads already claimed by earlier sections;
- project, participation, pinned, needs-attention, working, maximum-item, and
  meaningful-recency filters required by saved configurations;
- flat and title-derived grouped organization where it remains useful on a
  narrow screen;
- progress state, stable topic/current activity, waiting-on presentation,
  background state, and shared comments;
- per-principal section configuration and read-only perspective viewing;
- participant avatars and accessible names;
- cached last-known presentation with an explicit degraded state when the
  plugin is unavailable.

The recovery client explicitly excludes the Diffs change-profile matrix, diff
panel, and file-change/diff payload presentation. Its timeline may show a plain
fact that work changed files only when that fact is already part of a supported
message row; it does not fetch or render patches.

The current useful plugin methods include `listProgress`,
`listThreadParticipants`, `loadThreadSections`, `saveThreadSections`,
`loadSidebarViewState`, `listComments`, and `getCurrentIdentity`. They are a
starting inventory, not yet a stable native synchronization contract: several
payloads are unversioned or `unknown`, progress has no revision, and realtime
signals are not replayable. Phase 0 must choose and prove either a typed,
versioned combined recovery projection or retry-until-consistent snapshot rules
with equivalent correctness. Native parity preserves top-to-bottom claiming,
absorbing catch-all behavior, title-derived grouping, whole-snapshot revision
conflicts, actual-owner writes, and read-only View-as semantics.

### G5. Identity-correct collaboration

- The authenticated server resolves the canonical principal. The client never
  infers ownership from a display name, login, email, device, or Tailscale host
  name.
- Trusted Tailnet identity remains provider-authored and must not fall through
  to a parallel client-claimed identity.
- Per-person saved state is namespaced by stable principal key and server
  profile.
- Timeline attribution uses durable actor presentation snapshots so historical
  messages remain intelligible if a profile later changes.
- Participant sets use canonical principal keys for identity and presentation
  profiles for names and images.
- A read-only “View as” perspective never changes mutation authorship.
- Switching server profile or principal cannot dispatch pending work created
  for a different owner.
- A profile/principal switch changes the local namespace before any cached
  timeline, sidebar projection, draft, or outbox record can render. No stale
  frame from the previous owner is acceptable.

Each Recovery installation enrolls its own server profiles. A separate iOS
bundle must not assume it can read the ordinary BB mobile app's SecureStore
records. After enrollment or reconnect, Recovery fetches the server-resolved
principal context (currently exposed through system configuration) and persists
it with the server-instance identity. The supported route matrix—Direct/local,
BB Connect, and configured trusted Tailnet access—is proved in Phase 0.
`trusted`, `not-applicable`, `unavailable`, `rejected`, and anonymous/no-owner
remain distinct outcomes. A route with no canonical mutation owner is read-only:
it may display appropriately partitioned cached actor snapshots but may not
create identity-owned configuration, drafts, or sends. Tailnet identity is
accepted only from the server's configured trusted identity provider and owned
Serve route, never inferred by the client.

### G6. Partial loading without interaction paralysis

Thread screens are composed from independently available regions:

- cached thread shell and title;
- cached timeline blocks;
- explicit unavailable-history gaps;
- authoritative-head synchronization;
- composer and durable local outbox;
- older-history and attachment synchronization.

The composer depends on a stable thread identifier and resolved mutation owner,
not on full timeline rendering. Cached content remains visible while newer data
is checked. User-facing states should say what is usable, for example:

- “Showing cached messages · checking for newer activity”
- “Older history is still loading”
- “Available offline”
- “Some content has not been cached”

Routine synchronization should not produce noisy announcements or replace an
otherwise usable screen with a full-screen skeleton.

### G7. Durable, context-guarded message delivery

Submitting a message first commits a local outbox record. Attachment bytes are
copied into an app-owned staging file, flushed, hashed, and atomically renamed
before the SQLite transaction references the final path. Startup reconciliation
repairs or removes orphan staging files without deleting referenced payloads.
Only after the durable record exists may the composer clear. A pending delivery
therefore survives navigation, reload, and process termination. With no valid
authoritative context baseline, it remains `awaiting-context` and can never
dispatch automatically from an ambiguous baseline.

Each delivery captures:

- server profile and authenticated owner principal;
- thread identifier;
- content and durable attachment references;
- idempotency key;
- last observed authoritative event sequence;
- last observed completed-turn count;
- last observed conversation-context revision and timestamp;
- creation time and a 60-second delivery deadline;
- maximum advancement of five completed turns;
- maximum advancement of 60 seconds of meaningful remote activity.

The server supplies an authoritative tuple such as
`{ headSequence, completedTurnCount, contextRevision, contextActivityAt,
retentionActivityAt, serverNow }`. Exact field names belong to the contract
spike. Server sequence and counters are scoped to one thread and monotonic.
Reads do not advance them. The thresholds are inclusive: advancement of five
completed turns and 60 seconds is allowed; anything greater is not. Missing,
non-monotonic, stale, or ambiguous guard data fails closed.

The time guard measures remote conversation-context advancement, not merely
elapsed wall time since the user viewed an idle thread. Delivery is allowed only
while all guards hold. Validation, idempotency lookup, and append/conditional
queue acceptance are atomic on the server. If BB places the message in its
runtime queue, that durable queue item carries the accepted guard baseline and
the server revalidates it immediately before injection. Queue claim, guard
check, request-event append, queue deletion, and transition to `dispatching`
are one transaction. This provides exactly-once database admission. The
current daemon does not durably deduplicate provider commands after an unknown
response, so a committed ambiguous dispatch is never automatically retried.

Required states are deliberately small:

```text
awaiting-context -> accepted -> dispatching -> delivered
        |              |             |
        |              +-> queued ---+
        |                            |
        +----------------------------+-> review-required
                                     |
                                     +-> reconciling -> delivered |
                                                         review-required

review-required --edit/rearm--> awaiting-context
review-required --cancel------> cancelled
```

`accepted` means the server durably owns the intent. `queued` means runtime
injection is pending. `delivered` means the durable user-message event has been
appended and is visible in the authoritative timeline; it does not claim the
provider has finished a turn. A lost response moves `dispatching` to durable
`reconciling`. The client queries the server by idempotency key, and the server
returns the original durable result because it stores the key, owner, thread,
accepted record, and outcome atomically.

If dispatch was committed but the daemon outcome remains unknowable, neither
client nor server retries the provider command. Reconciliation waits for its
matching durable accepted/rejected event and then fails closed to
`review-required(ambiguous-dispatch)` after the deadline. Strict retryable
exactly-once provider injection requires a future daemon protocol with durable
request-ID deduplication and is not a Recovery v1 claim.

Transient failures may return to `awaiting-context` before the deadline.
Expiry, context advancement, deletion, authorization failure, or an ambiguous
unsafe state preserves the message as `review-required`; it is never silently
discarded or delivered.

## Explicit non-goals for the first product

- Full feature parity with the BB web application.
- A WebView-hosted copy of the BB application or web plugin runtime.
- Diffs, file browsing, workspace panels, or terminals.
- Plugin marketplace, plugin-management UI, and arbitrary plugin UI surfaces.
- Android distribution.
- New custom encryption, biometric, or device-revocation systems beyond the
  current BB connection handling and standard iOS protections.
- Guaranteed background execution while iOS suspends the app. Correctness may
  not depend on background time being granted.
- Caching Git worktrees, arbitrary host files, terminal scrollback, plugin
  bundles, or other data outside the supported recovery surface.
- Premature extraction of a generalized offline framework for features this
  client does not expose.

## Baseline and source ownership

The pinned upstream BB commit is
`5205d98a74ed5a22469e521cf1f86b00b8232827`. At plan review time the existing
materialized checkout was at commit
`fad910912ce04d25ebe0e1541e4d9a676f4cbeb7`, tree
`fc618fd8adc3c43cdbf0680fca3079cce9fc7278`, and `apps/mobile` was clean at that
commit. The dirty `fork/result-tree.lock` named a different prospective tree,
`250b81df6969f7b3faf96150be8601b1754f40e2`, because other authored patch-series
work was in progress. The verified prospective composition was then
materialized in an isolated temporary patch-authoring checkout at commit
`0d3a894dd3e3a2f0c1bc6202c991ceb6ac7c06a6`. Its selected logical
`apps/mobile` subtree is `d5d5f4542f5e26e30a40048a1a0bd11265aa6c8f`
(770 tracked files, approximately 6.4 MB). This is the exact Recovery source
receipt; the temporary checkout is never a runtime or deployment source.

The materialized result is not identical to `fork/upstream`: applied downstream
patches add the identity spine, Thread Facets, and mobile participant
presentation. Phase 0 must produce an explicit allowlisted receipt naming the
upstream commit, ordered patches, selected mobile tree, resulting tree, and
active plugin source. It may use an isolated temporary patch-authoring worktree
as development input, but never as a runtime or deployment source. It must not
copy the dirty materialized tree wholesale or silently absorb unrelated hunks.

The source package should be introduced as `apps/recovery-mobile` in the BB
result tree. It should not live under `plugins/apps/ios`:

- `bb-plugins` is contractually a plugin monorepo;
- the recovery app consumes plugin backend data but is not itself a plugin;
- co-locating the product app with the BB packages and contracts it consumes
  allows ordinary workspace builds and typechecking;
- a distinct app path prevents later upstream changes to `apps/mobile` from
  silently redefining the recovery product.

The initial package is a one-time full tracked snapshot of that selected mobile
subtree, followed by small compiling reduction patches. A thin package that
imports mobile internals is not acceptable: mobile has no stable public export
surface and hundreds of package-local `@/*` imports, so it would stay coupled
to the ordinary app. Dependency stores, generated native directories, Expo
state, and build output are never copied.

`fork/build/bb` is disposable materialized output and must not become the
durable editing authority. App additions and BB server-contract changes enter
the ordered `bb-fork` patch series, refresh its hashes and result-tree receipt,
and are rematerialized and verified through `fork` tooling. Existing dirty work
in the workspace is authored work and must be preserved.

The intended package remains React Native/Expo. Native iOS distribution does
not require abandoning Expo; config plugins or narrowly scoped Swift modules
remain available if a later essential integration needs them.

The independent app uses package name `@bb/recovery-mobile`, display identity
“BB Recovery,” bundle identifier `app.getbb.recovery`, custom scheme
`bb-recovery`, and a separate Expo/EAS project. Its first release omits ordinary
BB universal-link claims and uses the custom scheme only. It is re-enrolled
with BB rather than relying on cross-app Keychain sharing. Both installed BB
apps must coexist without competing for dispatch.

## Architecture

### Application layers

```text
React Native screens and virtualized lists
        |
keyed view selectors and UI coordination
        |
local repositories and outbox state machines
        |
SQLite records + durable attachment files + small MMKV preferences
        |
incremental reconciliation and authenticated BB SDK transport
        |
BB server + thread-progress backend + identity provider
```

SQLite is the durable read model. TanStack Query may coordinate requests and
short-lived presentation state, but Query garbage collection must not determine
offline availability. MMKV remains appropriate for small synchronous
preferences; credentials remain in the existing secure profile storage.

### Local ownership and partitioning

Every remotely derived or locally authored record is partitioned by stable
server-instance/profile namespace from the first migration. Identity-scoped
state and pending writes additionally carry the stable owner principal key;
null/unresolved ownership has an explicit read-only representation rather than
an inferred identity. Server revision, server event cursor, authoritative head,
covered range, and client mutation generation are distinct values and may not
substitute for each other.

Candidate durable domains are:

- server profiles and cache namespaces;
- threads, projects, parent/child links, and sidebar projections;
- timeline events and completeness ranges;
- actor snapshots, participant profiles, and participant membership;
- progress rows, comments, sections, and section revisions;
- attachment metadata and content-addressed local payloads;
- draft and outbox records;
- per-domain synchronization cursors, revisions, tombstones, and errors.

The durable domain model and first migration are a Phase 1 gate and must be
reviewed before persisted UI code depends on them. Actor snapshots,
coverage/gaps, tombstones, sync errors, attachment staging, drafts, and outbox
records are designed together even when later phases do not yet expose every
operation.

### Cache completeness

Each protected thread needs explicit per-domain coverage rather than an
inference from whatever happens to be present. The following is illustrative,
not a frozen TypeScript contract:

```ts
type ThreadCacheManifest = {
  schemaVersion: number;
  serverProfileKey: string;
  threadId: string;
  authoritativeHead: {
    sequence: number;
    retentionActivityAt: number;
    contextRevision: number;
    contextActivityAt: number;
    completedTurnCount: number;
  } | null;
  timeline: {
    coveredRanges: readonly { from: number; through: number }[];
    gaps: readonly { before: number; after: number }[];
    oversizedPlaceholders: readonly number[];
  };
  actorsAndParticipantsRevision: number | null;
  progressAndCommentsRevision: number | null;
  sectionProjectionRevision: number | null;
  interactionAndQueueCursor: string | null;
  attachments: Readonly<Record<string, {
    status: "missing" | "staging" | "complete" | "unavailable";
    hash: string | null;
  }>>;
  tombstoneGeneration: number | null;
  lastSuccessfulSyncAt: number | null;
};
```

The schema may evolve, but the product must always be able to distinguish
complete, partially cached, synchronizing, unavailable, deleted, and locally
dirty data. `lastSuccessfulSyncAt` is diagnostic and never proves completeness
or extends retention.

### Reconciliation and writes

Current sidebar bootstrap and ordinary thread-list APIs do not expose a replayable
snapshot revision or deletion generation; plugin realtime signals are ephemeral.
Timeline APIs provide useful head/delta/older-range primitives, but event/byte
budgets and oversized placeholders mean a successful page does not prove full
coverage. Phase 0 must decide and prototype the smallest versioned snapshot,
change-feed, Thread Facet cursor, head/range, attachment-manifest, and tombstone
contracts necessary to establish authority. The durable design then follows
these rules:

- apply related remote changes in a SQLite transaction;
- preserve tombstones so deletion is distinguishable from omission;
- refresh authoritative heads before filling older ranges;
- coalesce redundant refresh requests per keyed entity;
- never replace dirty local intent with a load or realtime response;
- serialize writes per owner/entity and retain only the newest superseding
  pending snapshot where whole-state configuration is being edited;
- restore reconciliation from durable cursors after restart;
- treat background execution as opportunistic only.

If existing endpoints cannot prove completeness or deletion, introduce the
smallest versioned server contract that can. Do not simulate correctness with
client timing.

The selected Phase 2 authority is a bounded, versioned
`POST /recovery/snapshot` contract. It returns the server/profile/perspective
namespace, narrow recovery-domain core revision, deletion generation, explicit
timeline coverage, tombstones, and plugin availability. Thread-progress adds a
typed experimental `experimental_getRecoveryProjection` RPC whose progress,
comments, background state, and sections are read as one versioned plugin
projection. Bounded core/plugin revision rechecks either prove coherence or
return explicit `partial`/`retry` state.

Patch `0037` lands the deliberately smaller v1 foundation for that design. It
returns the request principal as a cache-owner fence, the current sidebar, and
bounded latest-timeline observations with exact event heads and explicit
`complete`/`windowed` projection coverage. It does **not** invent the missing
sidebar revision, deletion generation, tombstones, plugin projection, or
cross-domain consistency: the overall response remains `partial` until those
authorities exist. This subset is suitable for safe cache warming, not guarded
delivery or proof of the complete 72-hour working set.

Phase 4 adds the durable keyset `GET /recovery/changes` feed needed for the
complete protected working set. Realtime is only a wake-up signal. Cursor
expiry requires a new snapshot, and history rewrites invalidate older cursors
through a history generation rather than allowing mixed revisions.

Server-authoritative deletion may purge cached message/attachment content
immediately even inside the 72-hour window. Recovery retains the minimum
tombstone necessary to prevent resurrection. Pending local intent remains
recoverable for review but cannot dispatch to a deleted or unauthorized thread.
Unread, pinned, draft, section, and active-read protections are scoped by server
profile, owner principal where applicable, and thread.

Attachment persistence uses an app-owned durable directory, not an OS-purgeable
temporary cache. Phase 0 proves the chosen Expo FileSystem and SQLite/WAL
behavior, file protection inherited from standard iOS application storage,
backup exclusion, hashing, quota behavior, two-phase staging, and orphan
recovery. Attachment size/type limits and unavailable placeholders are set from
that evidence; the first read slice does not claim attachment completeness.

Native persistence imports remain behind adapters so real file-backed Node
tests can use Node 22's `node:sqlite` without loading React Native. Expo
FileSystem exposes no fsync/flush primitive; Recovery v1 may claim transaction
and process-restart durability only after tests, not power-loss durability.
Native process-kill, file-protection, backup-exclusion, and Expo bridge proofs
must run on a macOS iOS builder because this Linux host has no Xcode simulator.

## Delivery sequence and gates

Each phase ends in evidence, not merely code presence. Sequencing may be
adjusted in the development ledger when implementation evidence warrants it.

### Phase 0 — Baseline, package boundary, and contract/risk spikes

Deliverables:

- this master plan and the development ledger;
- independent coherence, feasibility, and sequencing reviews;
- an exact allowlisted baseline receipt for upstream, ordered patches, selected
  mobile tree, result tree, and active thread-progress source;
- `apps/recovery-mobile` package created from the current native logical result;
- independent Expo identity, package name, iOS bundle configuration, enrollment
  semantics, and unambiguous deep-link strategy;
- no runtime or plugin source redirected to the new app.

Before durable UI schema or synchronization implementation, Phase 0 also
produces executable spikes or contract fixtures for:

- canonical principal resolution across each supported Direct, Connect, and
  trusted Tailnet route, including null/unavailable/rejected outcomes;
- authoritative snapshot/revision/tombstone semantics for core thread discovery
  and native thread-progress data;
- timeline head/delta/older-range traversal under event/byte budgets and
  oversized placeholders;
- Expo SQLite/WAL migrations, transaction interruption, simulator process-kill
  recovery, and observer behavior;
- attachment staging, hash verification, atomic rename, quota handling, and
  orphan cleanup;
- guarded-send context tuple, idempotency lookup/result semantics, queue
  injection, and the precise meaning of accepted/queued/delivered;
- production and render-attribution harnesses, representative fixtures,
  provisional latency/idle/fan-out budgets, and exact phase commands.

Exit gate:

- the untrimmed recovery package installs, typechecks, tests, and produces its
  enumerated native/prebuild artifact through repository orchestration;
- existing `apps/mobile` behavior and package identity remain unchanged;
- fork verification identifies the new package as durable patch content;
- risk-spike results choose or reject concrete contracts instead of deferring
  foundational authority to later phases;
- guarded-send work records whether it remains entirely server-side; any
  behavior crossing the host-daemon wire includes a protocol-version plan and
  mixed-version witness.

### Phase 1 — Durable identity and persistence kernel

Deliverables:

- first-version schema and migrations for server/profile namespaces, canonical
  principal context, threads, timeline ranges/gaps, actor snapshots,
  completeness/watermarks, tombstones, sync errors, attachment references,
  drafts, and the full outbox state machine;
- repository APIs and keyed observation that do not broadcast a database epoch
  through React;
- explicit read-only behavior for profiles with no mutation owner;
- staged-file and database recovery mechanics, even though attachments and
  sending are not yet exposed as complete product features;
- an early route/dependency closure audit and removal or compile-time exclusion
  of obvious WebView, Diffs, terminal, file, marketplace, and plugin-UI entry
  paths from the recovery bundle;
- a static closure test that Recovery imports neither the general web/plugin UI
  runtime nor `react-native-webview`.

Exit gate:

- empty and every shipped migration path pass;
- process termination around writes leaves a valid database and recoverable
  staged files/outbox rows;
- switching between two principals on one server cannot reveal or mutate the
  other namespace;
- partial history cannot be represented as complete;
- focused typecheck, tests, native/prebuild check, and static bundle-closure
  gate pass with exact commands recorded in the ledger.

### Phase 2 — First meaningful cached-first native slice

This is the first user-visible vertical slice. It is deliberately honest about
what is not yet complete:

Deliverables:

- launch into an intentionally reduced native recovery shell;
- enroll one Recovery-owned server profile and persist its server-authored
  principal context;
- reconcile and persist a bounded set of core thread shells plus one complete
  bounded timeline/range using actual server head/range authority;
- render cached thread/message content and durable actor attribution from
  SQLite before network refresh;
- render one cached native “My progress”/core Thread Facet projection or the
  explicit core-list fallback, without claiming full thread-progress parity;
- show empty, cached, synchronizing, gap/incomplete, offline, deleted, and error
  states without replacing usable cached content;
- persist a per-profile/principal/thread draft and restore it after process
  recreation; no automatic send is exposed yet;
- record warm-start, cached navigation, settled idle, gap fill, reconnect burst,
  and one-thread-update behavior in both measurement lanes.

Exit gate:

- a deterministic integration or native E2E witness enrolls/seeds while online,
  terminates the process, removes network availability, relaunches, and proves
  the cached sidebar/thread/actor/draft slice remains usable;
- visible partial ranges remain explicitly partial and later gap fill preserves
  stable unrelated rows and composer focus;
- the slice makes no claim of complete attachments, all protected threads,
  full plugin sections, or guarded delivery;
- measured results meet the provisional Phase 0 budgets or produce a recorded
  plan adjustment before scope expands.

### Phase 3 — Native thread-progress contract and identity-aware sidebar

Deliverables:

- typed, versioned native contract or proven consistent-snapshot protocol for
  required `thread-progress` backend data;
- native section projection and editor;
- identity-aware participant and needs-attention presentation;
- cached last-known and plugin-unavailable fallback;
- whole-snapshot revision/conflict handling, reconnect recovery, and read-only
  View-as behavior;
- no Diffs dependency or UI, and no import of the plugin frontend bundle.

Exit gate:

- representative plugin configurations produce the same ordered membership as
  the plugin's pure pipeline fixtures;
- per-principal revisions and conflicts are deterministic across two clients;
- one-thread progress changes do work proportional to the affected section and
  visible row set;
- the core cached thread list remains usable when the plugin is stopped or its
  RPC returns unavailable;
- plugin child tests, integration against the installed canonical plugin,
  source verification, and supported connection-mode witnesses pass.

### Phase 4 — Complete protected working set and durable composing

Deliverables:

- proactive discovery/completion queue for every discoverable protected thread;
- complete declared core and thread-progress domains against their authoritative
  revisions, including supported attachments, interactions, and server queued
  text messages;
- independently loadable timeline head, older ranges, and attachment regions;
- persisted composer drafts scoped by server, owner, and thread;
- accessible partial/offline presentation;
- stable virtualized row identities as ranges fill;
- server-authored retention activity, 72-hour protection calculation, and
  eviction eligibility/storage-pressure policy.

Exit gate:

- controlled fixtures prove the declared complete recent working set survives
  offline restart and its manifest proves every required domain;
- interrupted pagination, oversized placeholders, partial attachment failure,
  tombstones, and reconnects cannot create a false-complete state;
- a protected thread does not become eviction-eligible before 72 hours, and
  crossing 72 hours does not itself force deletion;
- protected local intent and configured exceptions survive eviction runs;
- composing remains available during older-history loading;
- process recreation preserves the draft and visible cached range;
- filling a gap does not remount unrelated visible rows or lose input state;
- profile/identity switching never exposes or submits another owner's draft.

### Phase 5 — Guarded outbox and atomic conditional delivery

Deliverables:

- expose the already persisted local outbox and attachment staging through the
  recovery composer;
- idempotent conditional-send server contract;
- atomic owner/context validation, idempotency recording, and append/conditional
  queue acceptance;
- durable lookup/reconciliation by idempotency key and guarded exactly-once
  server-side queue injection where applicable;
- review/edit/rearm/cancel UI.

Exit gate:

- process termination at every transition preserves exactly one recoverable
  intent;
- response loss enters `reconciling`, lookup recovers the original result, and
  retry produces exactly one server message;
- advancement by six turns, advancement beyond the activity threshold, expiry,
  deletion, and owner mismatch all prevent automatic delivery;
- advancement within both thresholds permits delivery;
- no outcome silently deletes the user's message.

### Phase 6 — Product reduction and iOS delivery

Deliverables:

- finish removal of excluded transitive surfaces and dependencies identified by
  the Phase 1 closure audit;
- independent app icon/name/bundle and EAS/TestFlight workflow;
- deep links required for supported thread navigation;
- measured cold/warm startup, cached navigation, list scaling, idle work,
  storage growth, and synchronization recovery;
- operational documentation for building and testing the recovery client.

Exit gate:

- a release build passes focused native E2E recovery scenarios;
- the full fork verification and affected server/mobile checks pass;
- the app can coexist with the ordinary BB mobile client;
- the resulting artifact contains no general web app or plugin UI runtime.

## Verification strategy

### Correctness witnesses

- SQLite migrations from empty and every shipped schema version.
- Transaction interruption and app termination around synchronization commits.
- Cache completeness across paginated history, event/byte limits, oversized
  placeholders, attachment-by-attachment failures, tombstones, and reconnects.
- Two-client identity-scoped section edits, conflicts, and realtime ordering.
- Profile and principal switching with dirty drafts and pending outbox records.
- Conditional-send interleavings with controllable promises and an atomic
  server transaction.
- Lost conditional-send responses followed by idempotency lookup and replay.
- Guarded queue acceptance followed by advancement before exactly-once
  injection.
- Duplicate, older, self-originated, and other-owner realtime events.
- Plugin unavailable, server unavailable, partial response, and stale cached
  presentation.
- Direct, Connect, and configured trusted Tailnet route outcomes, including a
  null principal that remains read-only.

### Performance witnesses

Keep two non-interchangeable lanes:

1. Production builds without profiling instrumentation measure launch or
   navigation to paint, interaction latency, native long work, memory, storage,
   and bundle closure.
2. Render-attribution builds measure commits, rendered rows, reasons, and
   fan-out. Profiler overhead is not reported as product latency.

Representative fixtures should hold viewport, cache state, plugin set, build
mode, and row/event counts constant. At minimum measure empty, typical, and
large sidebars; short and long timelines; settled idle; one-thread updates;
gap fill; reconnect bursts; and attachment completion.

Phase 0 records the device/simulator, dataset generators, raw-artifact location,
control/candidate alternation, exact commands, and provisional thresholds in
the development ledger. Later phases may revise a threshold only with measured
evidence and a recorded product decision; they may not redefine a failing
witness after seeing the candidate result.

### Repository gates

- Follow `fork/README.md` for durable patch creation, hashes, result-tree
  receipt, and materialization.
- Use Turbo for affected BB builds and typechecks.
- Run focused tests during a phase and the full affected fork checks before a
  release milestone.
- Add exact commands, expected artifacts, fixtures, and pass/fail thresholds to
  the ledger before declaring each phase started. “Relevant build” is not a
  sufficient verification record.
- Verify the active `thread-progress` source remains
  `/home/ubuntu/bb/plugins/plugins/thread-progress` when exercising integration.
- Run affected `bb-plugins` sync, SDK-type, typecheck, test, and build gates when
  the native thread-progress contract changes; exercise the installed canonical
  source rather than a task copy.
- Bump and test `HOST_DAEMON_PROTOCOL_VERSION` if any guarded-send or sync field
  changes the server/daemon wire. Do not bump it for a server-only transaction
  without a wire change.
- Never erase, reset, stash, or relocate unrelated dirty work.

## Primary risks and mitigations

### R1. Copying a large app creates immediate maintenance drag

Mitigation: first establish an unchanged build, then remove product surfaces in
small compiling steps. Keep reusable BB protocol/domain packages where they
preserve behavior, but do not import the web app or plugin frontend runtime.

### R2. Existing APIs cannot prove a complete local mirror

Mitigation: expose cache completeness explicitly. Add narrowly versioned delta,
head, range, or tombstone contracts only where current endpoints cannot prove
the required state.

### R3. “Offline capable” is mistaken for guaranteed iOS background sync

Mitigation: promise durability of acquired data and queued intent, not execution
time iOS has not granted. Synchronize aggressively while active and
opportunistically in granted background time.

### R4. Client-side guarded sends race remote updates

Mitigation: make validation and append atomic at the server, carry an
idempotency key, and revalidate before server-queue injection.

### R5. Identity presentation becomes write authority

Mitigation: partition and authorize with canonical server-authored principal
keys; treat names, images, and “View as” as presentation only.

### R6. Persistence improves durability but harms UI responsiveness

Mitigation: use bounded transactions, indexed keyed queries, stable selectors,
windowed lists, background decoding, and measured fixtures. Do not broadcast
whole-database or wall-clock epochs through React.

### R7. The new app accidentally becomes another deployment checkout

Mitigation: keep it as an app package in the canonical materialized BB result,
represented durably by `bb-fork` patches. Do not point `svc:bb`, the default BB
CLI, or plugin loading at it.

### R8. Independent iOS identity collides with the ordinary app

Mitigation: use a distinct bundle, Expo/EAS project, and unambiguous link route;
re-enroll profiles in Recovery rather than assuming cross-bundle SecureStore or
custom-scheme ownership.

### R9. Attachment persistence looks transactional but loses bytes

Mitigation: prove staged-file flush/hash/rename and orphan recovery before the
database references final files. Track each payload independently and render an
explicit unavailable state rather than a false-complete thread.

### R10. Successful requests are mistaken for authoritative synchronization

Mitigation: require versioned heads, coverage ranges, replayable cursors or
consistent snapshots, and tombstones. Realtime invalidation accelerates
refreshes but never proves that the client observed every change.

## Definition of product completion

The recovery app is complete only when current evidence proves all of the
following together:

- an independently installable iOS artifact exists;
- it remains native-first and excludes the general web/plugin UI runtime;
- recent supported thread data is proactively and completely cached with
  explicit completeness state;
- protected data is not eviction-eligible before 72 hours from the
  server-authored retention-activity watermark, subject only to authoritative
  deletion;
- the native thread-progress organization works without Diffs and degrades to a
  usable cached/core list;
- actor attribution and per-principal ownership are correct;
- partial screens remain usable and composition is not blocked by history
  loading;
- drafts, staged attachments, and every nonterminal pending-message state
  survive reload and process termination;
- guarded delivery is atomic, idempotent, and context-safe;
- representative stability, correctness, performance, and repository gates
  pass against the exact recorded composition.

Passing a copied-app build or one narrow persistence test is an intermediate
milestone, not completion of this plan.
