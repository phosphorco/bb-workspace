# Retained projection: next implementation boundary

This is a design handoff for `retained-fact-projection`, not an implementation
or acceptance receipt. The plan and ledger remain authoritative. It uses the
accepted execution contract and the public-source evidence in
`community-plugins/plugins/analytics/docs/architecture-evidence/probes/source/README.md`.

## Preserve the existing callers

`server.ts` currently selects a recent 200/80/500 prefix. `AnalyticsStore.commitSnapshot`
removes facts and membership outside that selection. Its current tests and the
query-runtime fixture deliberately use full-snapshot semantics. Introduce a
separate retained-publication operation; do not silently change those callers.
The server switches to the new operation during composition, after its own
source adapter and acceptance evidence exist. Append migrations; preserve all
existing migration SQL and authored bundle/reference records.

## Publication invariants

| Source observation | Permitted publication |
| --- | --- |
| Thread omitted from a list page or recent cohort | Preserve its retained facts and membership; omission is not deletion. |
| Successful append page | Publish projected facts and the corresponding sequence checkpoint atomically; replay must be idempotent. |
| Incomplete history rewrite or projection upgrade | Keep the previous published thread intact; persist bounded staging/resume state separately. |
| Completed replacement scan | Atomically replace that thread's facts, checkpoint, projection version, and coverage. |
| Read failure, abort, permission error, or non-specific 404 | Preserve good facts/checkpoints; record bounded failure/partial coverage and leave retry work pending. |
| Exact source `thread_not_found` confirmation | Remove only the confirmed thread's projection in the publication transaction. A notification is a trigger to confirm, not proof. |
| Facts outside the accepted retention interval | Expire by fact timestamp, independently of current list position or query range. |

Publication derives population totals and fact-generation changes from actual
stored state. Do not accept a caller's `factsChanged` or row-count assertion as
the truth of the new retained operation. Coverage revision may advance without
a fact-generation change. Crash checkpoints belong inside the real transaction;
failure between row updates and checkpoint updates must roll back both.

A staged rewrite must have explicit identity and completion conditions. Offset
enumeration is not a snapshot, and the source supplies no immutable event high
water mark. Neither reaching one empty page nor an unchanged `updatedAt` proves
global completeness. The accepted guarantee is eventual reconciliation after
source quiescence, with observed-as-of and incomplete coverage.

## Projection-version boundary

The query child compares the handoff's `factProjectionVersion` to the published
SQLite index state. Resumable upgrades therefore cannot publish a global new
version while retaining old-version facts without an explicit compatible
strategy. The data owner must specify per-thread staging/version state and an
atomic promotion rule before implementing upgrade publication. Preserve the
old usable publication on interruption; do not solve this by weakening the
query child's identity check.

The first design receipt proposes versioned retained facts and a publication
pointer. Before implementation, it must explain how that pointer and its
generation connect to the child's existing atomic read of
`analytics_index_state` plus `tool_execution_facts_v1`. Two independent
publication records are not an acceptable authority boundary. Specify the
cutover transaction and preserve the existing read contract until that cutover
has its own evidence.

Likewise, a whole-thread `stageCompletedReplacement({typedFacts})` call is not
a bounded staging interface. The revised design must append bounded pages,
persist resume state, and distinguish source-adapter completion evidence from
an arbitrary caller success flag. Upgrade promotion must specify a retained
membership epoch and handling of concurrent additions, deletions, and rewrites.
Identical replay must not advance fact generation merely because SQL writes
were issued.

## Demand and resource boundaries

Use the contract's retention and pull-freshness defaults, with explicit test
reductions. A stale demand may start one shared refresh; no periodic idle
extraction is implied. Bound list pages, selected work, event pages/bytes,
per-pull time, and staging. Persist progress so a bounded pull can resume after
reconstruction. A cap produces partial/degraded coverage, never silent success
or unbounded work to satisfy a test.

## Instrument corrections needed before extraction acceptance

The current extraction scenario uses synthetic `{sequence,value}` events and
normalized rows. Its normal binding is absent. Bind tests to the real public
source adapter, real fact projector, and real persistent store; assertions must
inspect full typed facts and independently chosen exact values. Do not add a
production API that exists only to return this synthetic test shape.

Retain the existing 201-thread/501-event, append/rewrite, omission/failure,
confirmed-delete, and interruption/replay cases. Add retention expiry, staged
rewrite interruption/reopen, projection upgrade interruption, shared overlapping
demand, no idle work, and bounded partial-progress cases. Coverage assertions
must come from those source operations and persisted state, not a fixture's
predeclared success label. Missing bindings and incomplete obligations remain
nonpassing. Synthetic controls alone are not production acceptance.
