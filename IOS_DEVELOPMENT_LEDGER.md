# BB Recovery for iOS: Development Ledger

This ledger records meaningful discoveries, decisions, pivots, milestones, and
verification evidence for `IOS_GOALS_AND_MASTERPLAN.md`. Entries are append-only
in spirit: later entries may supersede earlier decisions, but should explain why
rather than silently rewriting the history.

## 2026-08-29 — Goal established

The product goal was established as a high-performance, stability-first iOS
recovery client for BB. It should preserve the most useful native Expo mobile
experience while deliberately excluding broad BB feature parity.

The highest-value surface is the organization supplied by the organization
plugin `plugins/plugins/thread-progress`, reimplemented as native React Native
UI without its Diffs presentation. The other essential collaboration feature is
correct identity: per-thread participants and durable per-message authorship,
including trusted Tailnet identity-provider behavior.

## 2026-08-29 — Local-first retention clarified

The desired cache is not a short-lived React Query optimization. Everything in
the supported recovery surface for a recently active thread should be acquired
proactively and persisted locally. A thread or topic remains protected for at
least 72 hours after meaningful activity. After that it becomes eligible for
ordinary eviction; it is not deleted merely because the clock crossed the
boundary.

This led to the decision that SQLite, explicit completeness manifests, and
durable attachment files must own recovery data. TanStack Query remains useful
for request/UI coordination but cannot be the durability boundary.

## 2026-08-29 — Durable guarded outbox added to the product model

Partially loaded screens must still allow composition. On Send, user-authored
content must be persisted before the editor clears and must survive process
termination.

Automatic delivery is permitted only when the authoritative thread head can be
validated within a one-minute delivery window and has advanced by no more than
five completed turns or 60 seconds of meaningful remote activity relative to
the observed context. Unsafe or expired sends become `review-required`; they
are neither discarded nor silently delivered.

A client-side read followed by an ordinary send was rejected because it has a
time-of-check/time-of-use race. The plan now requires atomic server validation
and append, an idempotency key, and revalidation immediately before any
server-side queued injection.

## 2026-08-29 — Source location pivot

The initial location suggestion was `~/bb/plugins/apps/ios`. Inspection of the
workspace contract showed that `bb-plugins` is a plugin monorepo whose product
units live under `plugins/<id>`. The recovery client consumes a plugin backend
but is not a plugin.

The planned package location is therefore `apps/recovery-mobile` in the BB
result tree, materialized at
`/home/ubuntu/bb/fork/build/bb/apps/recovery-mobile`. `recovery-mobile` avoids
the confusing generated path `apps/ios/ios` and leaves room for React Native
tooling even though the delivery target is iOS only.

Durable changes must be represented in the `bb-fork` ordered patch series. The
existing `fork/build/bb` is materialized output and is not the editing
authority.

## 2026-08-29 — Baseline facts recorded

- Workspace root: `/home/ubuntu/bb`
- Pinned upstream commit: `5205d98a74ed5a22469e521cf1f86b00b8232827`
- Observed materialized BB commit before recovery work:
  `fad910912ce04d25ebe0e1541e4d9a676f4cbeb7`
- Observed materialized BB tree:
  `fc618fd8adc3c43cdbf0680fca3079cce9fc7278`
- Dirty prospective `fork/result-tree.lock` value at the same observation:
  `250b81df6969f7b3faf96150be8601b1754f40e2`
- Active thread-progress source:
  `/home/ubuntu/bb/plugins/plugins/thread-progress`

The pinned upstream `apps/mobile` is already a substantial native React
Native/Expo application rather than a wholesale WebView wrapper. The current
materialized result adds downstream identity, Thread Facet, mobile participant,
and message-author behavior that is not all present in the pinned upstream
directory. Therefore the recovery baseline must be derived from the current
logical materialized result, not copied blindly from `fork/upstream/apps/mobile`.

The workspace, `fork`, materialized BB tree, and `plugins` repository all
contain existing dirty authored work. Recovery development must not reset,
stash, clean, overwrite, or silently absorb unrelated changes.

## 2026-08-29 — Initial master plan drafted

`IOS_GOALS_AND_MASTERPLAN.md` now defines:

- the recovery motivation and product boundaries;
- stability, performance, caching, organization, identity, partial-data, and
  guarded-delivery goals;
- a durable local architecture;
- six implementation phases plus baseline Phase 0;
- a first meaningful cached/offline vertical slice;
- correctness, performance, and repository verification gates;
- major risks and a full-product completion definition.

The next action is an independent three-agent review focused respectively on
coherence, feasibility, and sequencing. Their findings will be reconciled into
the master plan and recorded in this ledger before implementation begins.

## 2026-08-29 — Three-agent architecture review completed

Three independent Luna XHigh reviewers examined the master plan without editing
the workspace:

1. Product and architectural coherence
2. Repository and technical feasibility
3. Dependency sequencing and verification quality

All three judged the direction strong and feasible. All three also gave a
conditional no-go to treating the first draft as implementation-frozen. Their
independent findings converged on the same foundational gaps:

- current core thread/sidebar and plugin realtime contracts are not replayable
  or revision-complete enough to prove a complete 72-hour local mirror;
- the proposed boolean cache manifest could not prove completeness across
  timeline ranges, actor/participant state, plugin projections, interactions,
  attachments, and tombstones;
- SQLite and durable attachment behavior are net-new native capabilities that
  need crash/process-restart spikes before persisted UI depends on them;
- principal acquisition differs by Direct, Connect, and trusted Tailnet route
  and must be explicit before identity-owned writes;
- current send APIs have neither a client idempotency key nor the proposed
  sequence/turn/activity guards, so guarded delivery requires a new atomic
  server contract and persistence;
- a distinct iOS bundle cannot assume access to the ordinary mobile app's
  SecureStore profiles or safely compete for the same deep-link scheme;
- product reduction and bundle-closure checks must happen before meaningful
  performance measurements, not only at final release.

The reviews also found reusable foundations: the native Expo shell, profile
connection flow, timeline schemas and pagination primitives, pure timeline row
models/renderers, FlashList windowing, actor/participant snapshots and avatar
fallbacks, generic plugin RPC transport, and the core native Thread Facet triage
surface.

## 2026-08-29 — Sequencing pivot accepted

The master plan was revised from a UI-first Phase 1 to this order:

```text
Phase 0  Baseline, package, contract/risk spikes, and performance harness
Phase 1  Durable identity/persistence kernel and early bundle reduction
Phase 2  First meaningful cached-first native slice
Phase 3  Versioned native thread-progress contract and sidebar
Phase 4  Complete protected working set and durable partial composer
Phase 5  Atomic guarded delivery and recovery UI
Phase 6  Release closure, full measurement, and side-by-side iOS delivery
```

The key adjustment is that schema, authority, and crash-consistency decisions
must precede the first persisted UI. The first user-visible slice remains
product-specific rather than becoming a database demo: it will show cached
native thread shells, a bounded authoritative timeline range, actor attribution,
one cached “My progress”/core-fallback projection, explicit partial states, and
a persisted draft after an offline process restart. It will explicitly not yet
claim complete 72-hour coverage, attachment completeness, full thread-progress
parity, or automatic sending.

## 2026-08-29 — Completeness and activity model corrected

The master plan now treats completeness as a per-domain, per-range claim against
authoritative watermarks. `lastSuccessfulSyncAt` is diagnostic only. Timeline
coverage, gaps, oversized placeholders, actor/participant revision, plugin
projection revisions, queue/interaction cursors, attachment-specific state, and
tombstones are represented independently.

Retention activity and conversation-context activity were split:

- server-authored retention activity protects the supported local working set;
- server-authored conversation context controls guarded message delivery.

A comment can therefore keep a thread in the 72-hour working set without
pretending it changed the model context. Reads and refetches advance neither
clock.

## 2026-08-29 — Guarded-send recovery semantics expanded

The initial outbox state sketch did not cover a lost response after server
acceptance. The revised plan adds durable `accepted`, `queued`, `reconciling`,
and `delivered` meanings. A client idempotency key maps to a server-persisted
owner/thread/result record. After an ambiguous response, Recovery looks up that
record rather than issuing an uncorrelated send.

`delivered` now means the durable user-message event is present in the
authoritative timeline, not that the provider completed a turn. Runtime-queued
delivery carries the accepted guard baseline and revalidates it atomically when
consumed exactly once. Missing or ambiguous baseline data fails closed into a
recoverable review state.

## 2026-08-29 — Review reconciliation milestone

`IOS_GOALS_AND_MASTERPLAN.md` was updated to incorporate the three reviews:

- added a glossary and independent-enrollment/deep-link rules;
- recorded the materialized commit/tree and dirty result-tree mismatch;
- replaced boolean completeness with domain/range authority;
- made Phase 0 contract and native durability spikes mandatory;
- moved the persistence kernel before cached UI;
- made the first meaningful slice both technically honest and visibly useful;
- moved full 72-hour completeness after native thread-progress integration;
- expanded guarded-send crash and idempotency semantics;
- added deletion, attachment, bundle-closure, daemon-protocol, and exact-gate
  requirements.

The plan is now ready for Phase 0 execution. Exact Phase 0 commands, fixtures,
selected source receipt, and provisional performance thresholds remain to be
produced as Phase 0 artifacts; they are not yet claimed complete.

## 2026-08-29 — Phase 0 fork composition verified

Before creating recovery source, the currently authored `bb-fork` patch queue
was verified in isolation with:

```sh
cd /home/ubuntu/bb/fork
./scripts/verify
```

The command completed successfully, including the adversarial and downstream
P6R namespace checks, and proved the prospective patch queue at tree:

```text
250b81df6969f7b3faf96150be8601b1754f40e2
```

This explains the earlier difference between the existing materialized checkout
tree (`fc618fd8...`) and the dirty `result-tree.lock`: other authored patches are
valid but have not yet been rematerialized into `fork/build/bb`. Recovery work
must build on the verified prospective tree, append its own deliberate patch,
and leave the existing materialized checkout untouched until a coordinated
rematerialization is safe.

## 2026-08-29 — Second Phase 0 investigation set started

Four Luna XHigh tasks were started after review reconciliation:

1. choose a hard-fork source/scaffold strategy compatible with the thin overlay;
2. specify the executable Expo SQLite and durable-file crash spike;
3. design the smallest authoritative recovery synchronization contract;
4. design the guarded-send/idempotency transaction and race witnesses.

These tasks are read-only and must return evidence before source or contracts
are changed. This is a deliberate effect of the review: implementation is
paused at the points where a wrong source boundary, schema, or server authority
would create expensive rework, while safe Phase 0 evidence continues.

## 2026-08-29 — Exact mobile source receipt selected

An isolated temporary materialization of the verified prospective patch queue
produced commit `0d3a894dd3e3a2f0c1bc6202c991ceb6ac7c06a6`. Within that
composition, the selected logical `apps/mobile` source subtree is
`d5d5f4542f5e26e30a40048a1a0bd11265aa6c8f` (770 tracked files,
approximately 6.4 MB). This receipt, not the stale dirty materialization under
`fork/build/bb`, is the Recovery source. The temporary checkout is
patch-authoring input only and is never a runtime or deployment source.

## 2026-08-29 — Independent hard-fork package strategy accepted

Phase 0 compared a thin wrapper that imports `apps/mobile` internals with a
one-time independent snapshot. The wrapper was rejected: mobile has no stable
public exports, and roughly 340 files rely on package-local `@/*` imports. It
would silently couple Recovery to ordinary mobile changes and defeat its value
as a regression-resistant fallback.

Recovery will begin as a full tracked snapshot at `apps/recovery-mobile`,
carried in the ordered `bb-fork` patch series, then be pruned in small compiling
patches. Generated native directories, dependency stores, Expo state, and build
output are excluded. It receives package name `@bb/recovery-mobile`, display
identity “BB Recovery,” bundle identifier `app.getbb.recovery`, scheme
`bb-recovery`, and a separate EAS project. The first release uses its custom
scheme only; ordinary BB universal-link claims are omitted until routing can be
made unambiguous.

## 2026-08-29 — Persistence spike contract selected

`expo-sqlite` is not installed in the current SDK 57 mobile package and its
exact compatible version was absent from the offline package cache. It must be
resolved and locked from the registry rather than guessed. Node 22's built-in
`node:sqlite` supplies real file-backed SQLite 3.50.4 tests, allowing migration,
rollback, WAL, integrity, keyed-observer, and attachment crash protocols to run
on this Linux host without importing React Native.

Native SQLite, FileSystem, and Crypto imports will live behind adapters. Durable
files use the application document directory, not an OS-purgeable cache.
Attachment rows may reference only content that has been staged, read back,
hashed, size-checked, and renamed to a final content-addressed path. Startup
reconciliation preserves outbox intent and referenced payloads while repairing
or removing safe orphans.

Expo FileSystem exposes no fsync/flush guarantee. Phase 0 therefore claims
process-restart and transactional durability, not power-loss durability. A
stronger claim is a future native-module gate. Xcode, CocoaPods, `simctl`, and
an iOS simulator are unavailable here, so the native process-kill witness must
run on a macOS builder even when Node proofs pass.

## 2026-08-29 — Recovery synchronization contract selected

The first authoritative server contract will be a bounded, versioned combined
snapshot rather than offset pagination, ephemeral realtime, or a premature
general sync framework:

```text
POST /recovery/snapshot
```

It returns a narrow recovery-domain core revision, deletion generation,
identity namespace, explicit timeline ranges/gaps/oversized rows, tombstones,
and plugin availability. A typed experimental thread-progress RPC,
`experimental_getRecoveryProjection`, supplies one revisioned transactional
projection for progress, comments, background state, and sections. Core and
plugin reads use bounded revision rechecks and report `partial` or `retry`
rather than false coherence.

The complete protected 72-hour working set later adds a durable keyset change
feed, `GET /recovery/changes`. Realtime remains a wake-up signal only. Expired
cursors force a fresh snapshot; history rewrites advance a generation and
invalidate incompatible pagination. Plugin unavailability preserves stale
cached data with an explicit degraded state and is never converted into an
authoritative empty projection.

## 2026-08-29 — Guarded delivery adopts safe ambiguity semantics

The existing host/daemon protocol can carry a stable request ID, so guarded
delivery does not initially require a daemon wire-version change. It cannot,
however, durably deduplicate a provider command after a committed dispatch
whose daemon response is lost. Retrying such an unknown result could duplicate
user input.

Recovery will provide exactly-once durable admission and queue consumption in
the BB database, but will not claim exactly-once provider injection. Once a
request event is committed and dispatch becomes ambiguous, the server never
automatically sends that command again. It reconciles against durable accepted
or rejected events and moves unresolved outcomes to `review-required` after
the deadline. Strict retryable exactly-once injection is deferred until a
versioned daemon protocol provides durable request-ID deduplication.

Guard comparison also requires a durable per-thread context head. Existing
derived completed-turn counts can decrease after history rewrites, so the new
head uses an ever-completed root-turn counter, a context revision bumped by
rewrites/resets, server-authored context and retention timestamps, and the
monotonic event head. Guard deadlines are stamped from first server receipt;
offline device creation time remains diagnostic unless a future server-issued
lease defines authoritative offline time.

## 2026-08-29 — Independent Recovery package baseline materialized

The first durable implementation patch is now present in `bb-fork`:

```text
0034-feat-recovery-mobile-add-independent-native-baseline.patch
sha256 ac53ec72aac16e73df4885ae9ac3cce3857e10375ab405532b73e52910f4cffd
result tree 07ed843cd625cb219f3166f14e3e7a88eea01c6d
```

It creates `apps/recovery-mobile` from the selected logical source subtree,
adds its pnpm importer and Turbo tasks, and leaves `apps/mobile` unchanged.
The baseline uses `@bb/recovery-mobile`, display name “BB Recovery,” slug and
scheme `bb-recovery`, and bundle ID `app.getbb.recovery`. Ordinary universal
links, the existing EAS project ID, and the ordinary App Store submission
profile were deliberately removed. Independent EAS enrollment remains an
external distribution task rather than a borrowed credential claim.

Verification in the isolated materialization:

```text
pnpm install --frozen-lockfile                  passed
turbo typecheck/test/lint @bb/recovery-mobile  passed
tests                                           857 passed
lint                                            0 errors, 19 inherited warnings
Expo public config                              no associated domains; no EAS project
fork/scripts/verify                             passed at 07ed843c...
```

One scheme-renaming test initially retained uppercase `BB://`; it failed as it
should, was corrected to `BB-RECOVERY://`, and the full suite then passed. The
copied baseline still contains intentionally excluded ordinary-mobile features
and WebView dependencies; this is an untrimmed source receipt, not a claim that
Recovery's bundle-closure gate is complete. Reduction follows in compiling
patches so behavior loss remains attributable.

## 2026-08-29 — Durable persistence kernel landed

The second Recovery patch is now in the verified fork queue:

```text
0035-feat-recovery-mobile-add-durable-persistence-kernel.patch
sha256 48b06a3d336ce9c50b97ade8f7e35ed76e1d5b60b37f48075d8f0abe7431698f
result tree 9b637a6ddb5defe0bcf7b011a218ca7e1a6b93ce
```

Expo selected and locked `expo-sqlite ~57.0.2` for SDK 57. The patch adds
shared async database contracts, Expo and Node SQLite adapters, transactional
migrations, profile/owner namespaces, observed records, outbox intent,
attachment metadata, and post-commit keyed observation. It also adds a native
document-directory file adapter and content-addressed attachment protocol.

Real file-backed Node tests prove WAL reopen, `integrity_check=ok`, migration
idempotence and injected rollback, committed record/outbox survival, key-scoped
notification with no event on rollback, attachment read-back/hash/rename before
DB reference, orphan-final cleanup, and missing-payload degradation without
losing outbox intent. These tests do not upgrade the recorded fsync limitation
or substitute for the macOS process-kill witness.

## 2026-08-29 — First cached-first native slice landed

The third Recovery patch is now in the verified fork queue:

```text
0036-feat-recovery-mobile-hydrate-cached-recovery-reads.patch
sha256 f16328b7ddfe1e4d56740d317a465e7cd1fd8c9723961028531ae3ffafc77d89
result tree 9395abab075989f8d53bc64b1954ab944071ac5e
```

Recovery now opens and migrates SQLite during app boot, persists the last
server-authored principal context for each profile, and fences cached records
by that principal namespace. Core sidebar bootstrap, bounded thread shell, and
latest timeline responses hydrate TanStack Query from SQLite before/while the
network refreshes. Existing timeline payloads retain server-authored actor
snapshots, so cached user-message attribution remains visible. Sidebar and
timeline surfaces retain usable cached rows and explicitly label a failed
refresh instead of replacing data with a full-screen error.

This slice deliberately exposes composition as local-draft-only: the new-thread
and follow-up composer controls retain edits but their send paths are disabled
in the rendered Recovery UI until guarded delivery exists. It does not claim
that the inherited MMKV draft store is already principal-partitioned SQLite,
nor that every non-composer mutation in the untrimmed baseline has been removed.

Final host-available verification:

```text
Recovery typecheck/test/lint                    passed
tests                                           864 passed in 129 files
lint                                            0 errors, 19 inherited warnings
Expo iOS prebuild --no-install                  passed
generated Xcode bundle                          app.getbb.recovery
generated URL schemes                           bb-recovery, exp+bb-recovery
fork/scripts/verify                             passed at 9395abab...
```

This Linux host cannot run CocoaPods, Xcode compilation, `simctl` termination,
or a real/simulator iOS launch. The first slice is therefore source-, contract-,
Node-durability-, and prebuild-verified, but its native runtime/process-kill
witness remains a named macOS gate rather than an implied success.

## 2026-08-29 — Bounded recovery snapshot foundation landed

The fourth Recovery patch is now in the verified fork queue:

```text
0037-feat-recovery-mobile-add-bounded-snapshot-contract.patch
sha256 c51ce1bb8051ab3aac37dcf67f74c74a002c64858ad923842e031ca2b45d374d
result tree 2821d058cf5d67407164dbc89a10375b0551b928
```

It adds a strict version-1 `POST /recovery/snapshot` contract, core server
route, and public SDK area. Requests are capped at 12 distinct thread IDs and
40 timeline segments per thread. The response carries a server-resolved cache
owner, sidebar bootstrap, missing-thread entries, and individually coherent or
retry-marked timeline observations with event heads and complete/windowed
projection coverage. Large inline output still uses the existing bounded
timeline preview path.

The whole snapshot intentionally reports `partial` with
`sidebar-revision-unavailable`: current BB has no revision spanning sidebar
metadata and timeline events, so this patch does not claim false cross-domain
coherence. It also does not yet provide deletion generations, tombstones,
plugin thread-progress data, or a change cursor.

Recovery now has a dormant network-to-SQLite refresh seam. It verifies the
server cache owner against the local principal namespace, atomically persists
the sidebar, snapshot diagnostics, and only coherent timelines, and rolls the
whole observed-record batch back on failure. No eager foreground/background
fan-out is enabled by this patch; a later measured scheduler and 72-hour
working-set policy will call the seam.

Verification receipts:

```text
affected server/contract/SDK/mobile typecheck       passed
server-contract full suite                          64 passed
SDK full suite                                      101 passed
Recovery full suite                                 868 passed in 130 files
Recovery lint                                       0 errors, 19 inherited warnings
server + SDK build                                  passed
recovery route focused suite                        2 passed
snapshot SQLite focused suite                       4 passed
fork/scripts/verify                                 passed at 2821d058...
```

The full server suite completed with 2,003 passing tests and two failures in
the unrelated pre-existing `lifecycle-outcome.test.ts` expectation. That
fixture omits `newestActiveBackgroundCommandStartedAt: null`, which the current
thread activity object emits; the same two failures reproduce when that file is
run alone. Patch `0037` changes neither the lifecycle service nor that fixture,
so this mismatch is recorded as an existing suite limitation rather than
silently folded into the Recovery feature patch.

## 2026-08-30 — Seven-reviewer hardening pass landed

Seven independent reviewers examined the Recovery work for complexity,
correctness, sequencing, and coverage. Their strongest convergent findings
were cache/query ownership collisions across principals and server origins,
non-monotonic SQLite observation writes, a full-database integrity scan on the
launch path, interleavable Node SQLite transactions, inherited mutation
surfaces, unvalidated SDK snapshot payloads, and attachment reconciliation
that could remove referenced staging data.

The accepted fixes are recorded in the fifth Recovery patch:

```text
0047-fix-recovery-mobile-harden-cache-ownership.patch
sha256 199cbd69567d2a0042462d100c28e3f88fef4813d29226ef0293f6b603d87ec3
result tree c15498309f44d74443ad8561f7c645ea80c452f3
```

Recovery Query keys, persisted identity contexts, and observed records now
partition by normalized server origin plus canonical principal. Schema version
4 retains distinct contexts when a local profile ID is reused across origins.
Only live server identity may own new persistence, cached payloads are schema
validated before hydration, and revision/updated-at guards prevent older
direct reads from replacing newer snapshot observations. SQLite integrity is
an explicit diagnostic instead of launch work; Node operations and transaction
witnesses are serialized; failed native initialization is retryable; observer
exceptions cannot negate a committed write; attachment hashes compare source
to read-back bytes and reconciliation preserves referenced staging files.

The SDK parses the Recovery response contract. Timeline projections remain
honestly `windowed`; a paginated response cannot prove byte/range completeness.
Inherited primary server mutation menus and interaction forms are hidden or
read-only, and the default Recovery Maestro list no longer asserts ordinary
send behavior before guarded delivery exists. The dormant snapshot seam stays
dormant: wiring it now would create unbounded sidebar/thread fan-out without an
authoritative deletion/change cursor or measured response budget.

Verification receipts:

```text
Recovery typecheck                              passed
Recovery full suite                             879 passed in 132 files
server-contract + SDK focused/full tests        passed (67 + 102)
affected server/contract/SDK/mobile typecheck   passed
affected lint and server/SDK builds             passed
Expo iOS prebuild --no-install                  passed
patch replay + materialized tree receipt        passed
materialized upstream..HEAD diff --check        passed
```

The exact 47-patch composition's full server suite passed 2,016 tests and
retained the same two
unrelated `lifecycle-outcome.test.ts` fixture failures. The queue's namespace
adversarial unit witness passes, but the aggregate `fork/scripts/verify`
command still stops at an older allowlist-policy mismatch: patches `0037`–`0046`
introduced intentional generic Recovery and experimental execution exports
that are not yet listed in `check-p6r-namespace`. The checker now correctly
excludes the separately named Recovery application snapshot itself; canonical
server/package edits remain checked. This limitation is recorded rather than
mass-renaming inherited application APIs or broadly disabling the guard.

Deferred after review: principal-partitioning/migrating the inherited MMKV
composer drafts; an authoritative change/tombstone cursor and bounded refresh
scheduler; the final guarded-send/outbox state machine; bundle-closure
reduction; and macOS Xcode/simulator process-kill and launch-performance
witnesses. These are product correctness gates, not reasons to expand the
current patch with speculative schemas or custom security machinery.
