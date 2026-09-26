# Analytics must not compete with interactive BB

Date: 2026-09-22
Status: Accepted direction; implementation incomplete
Decision owner: Cole Lawrence

## Context

Adding a dashboard or analytical feature through an agent must not require the
user or feature author to reason about BB database locks, caching, refresh
storms, or boot performance. The Skills addition exposed an unsafe extension
point: it registered thread lifecycle handlers that awaited a globally queued
catalog capture and whole-project event traversal. Its local per-page bounds
did not bound the complete operation. A dashboard feature gained the ability to
perform operational work independently of the shared Analytics loader.

Separately, all 42 enabled frontend bundles loaded at app boot. The measured
plan-graph and machine-monitor bundles accounted for about 41% of plugin bytes.
Ordinary first paint was protected, but late imports and registrations caused
long tasks and layout shifts. A lazy React component cannot defer bytes when
the build still emits one eagerly imported artifact.

These observations establish unsafe paths and frontend costs. Cumulative RPC
durations alone do not prove CPU attribution or database lock contention.

## Decision

Ordinary analytical features are declarative definitions executed by a shared
platform. They do not own source collection, schedules, cache invalidation,
database connections, worker pools, or arbitrary frontend JavaScript.

The enforceable target is: adding a feature cannot add work to interactive BB
request/lifecycle paths, open its operational database, increase the aggregate
analytics resource budget, or add executable bytes to an unopened surface.
Collection has a finite cost; literal zero machine overhead is not promised.

### One bounded source supply

Only a trusted collector may obtain operational data. It exports curated,
redacted, versioned facts to an analytics-owned store. Collection is incremental,
checkpointed, and independent of the number of features and viewers. Prefer an
asynchronous feed from existing persisted events; otherwise centrally admit
bounded reads. User operations never await analytics work. Collection failure
or backpressure causes stale/incomplete analytics, never an unbounded queue or
a synchronous catch-up scan.

Bound total requests, bytes, rows, elapsed time, queue size and retained storage
across the entire operation. A page cap, output LIMIT, or last-week predicate is
not an aggregate resource limit. Cancellation must stop follow-on reads and
publication; an unresolved request continues to occupy its concurrency slot.

New datasets from existing exported facts use isolated transformations. A new
operational source is a platform capability change with its own reviewed
collection budget, not another feature-local SDK loop.

### No operational database in the execution lane

Queries and transformations receive immutable analytics snapshots. They have
no operational database mount, general BB SDK credential, host RPC capability,
or unrestricted filesystem/network access. Read-only operational database access
is insufficient: long readers can still retain snapshots and obstruct WAL
maintenance. The collector closes bounded reads before analytical work begins.

Run analytics in a separately constrained process/service with aggregate OS
CPU, RSS, process, disk and I/O controls. Database memory settings, JavaScript
heap limits, worker threads and cooperative timeouts do not establish this
isolation by themselves. Prefer a separate machine where stronger resource
isolation is needed. A same-machine deployment must measure remaining shared
resource interference and fail closed if required controls are unavailable.

### Cache and scheduling are platform responsibilities

The runtime derives cache keys from source scope, immutable dataset generation,
projection/query/policy versions, normalized bound parameters and result limits.
Time-relative queries use a shared snapshot endpoint. Authors cannot bypass
caching with clocks, random values, arbitrary keys, or custom refresh loops.
Unsupported volatile queries are rejected from the ordinary feature lane.

All consumers share one bounded scheduler and identical in-flight work. Limits
are aggregate, not multiplied by feature, runtime instance, user or browser tab.
Use fair admission, bounded queues, failure cooldowns, and actual process
termination at hard deadlines. A cancelled subscriber does not cancel work
still needed by another subscriber. Cache eviction and result/reference retention
are separately bounded.

Serve the last successful generation while refresh awaits admission. Publish
new generations atomically and reject obsolete results. Coverage/failure metadata
may change without changing cached row identity and must still reach the UI.
Manual refresh uses the same limits; it is not a bypass.

### Frontend additions are definitions, not boot dependencies

Navigation metadata and stable reserved layout must be available without
executing feature code. Load the shared analytics renderer on demand, with
bounded charts, tables, interactions and exports. Unopened analytical additions
cause no extra executable requests during normal BB boot.

Heavy optional renderers require independently served, versioned chunks and an
artifact contract that supports them. Merely adding React.lazy to a single-file
bundle is not acceptance evidence. Preserve existing focus, error recovery,
navigation and layout semantics while changing loading boundaries.

### Default product tradeoffs

- Fast interactive queries use the last seven days of retained facts, subject
  to independent byte/row budgets.
- Freshness targets one hour and may lag under pressure. Display the as-of time.
- Cold datasets show Preparing data. They never force a host scan from a query.
- Older history and exports are bounded background jobs under the same budget.
- Missing, capped, stale, failed, approximate and complete coverage are distinct.
  A partial recent prefix is not a representative sample.
- Skills catalog state is current evidence. Do not infer historical activation,
  historical catalog revisions or causal effectiveness from it.

Numeric execution and host latency budgets are provisional until measured on
the deployment hardware. Features may request less work, never raise limits.

## Enforcement and acceptance

The normal feature artifact contains a strict versioned definition and no
executable backend entrypoint, unrestricted SQL, imports, callbacks or CSS.
The installed runtime validates it and owns execution. Feature-author guidance
helps discovery; capability restrictions and production-path tests establish
safety. An agent allowed to rewrite the runtime itself can remove protections,
so runtime/source-adapter changes receive separate acceptance gates.

Verify cache reuse and scope separation, many distinct queries/viewers, refresh
spam, expensive joins, oversized results, failed/stuck source reads, cancellation,
worker crashes, bounded retention, offline startup and process recovery. Require
measured BB request/navigation latency under saturated analytics load as well as
analytics latency. Record hardware, sources, fixtures, instrumentation and raw
samples; a fast fixture or an isolated worker test is not composed-host proof.

For ordinary boot, adding a definition must cause zero additional executable
requests. For direct analytics navigation, measure useful content paint and
long tasks, not just an empty shell's FCP.

## Migration and current limits

First remove feature-owned lifecycle capture and independent unbounded scans,
and enforce finite admission/cooldowns on remaining transitional work. Do not
replace awaited lifecycle work with detached promises that outlive their DB
invocation. Preserve retained evidence and explain freshness limitations.

Then migrate Skills onto the shared bounded data supply and isolated query
service; close legacy SDK/database escape paths. Reuse the existing execution
contract, parser admission, worker and retained-projection work, but do not
claim those foundations are the live composition until integration is verified.

Finally move frontend registration to metadata and support lazy artifacts;
move Mermaid and chart engines behind their actual surface boundaries. A
temporary containment fix is not completion of the doctrine.

This ADR supersedes feature-local performance policies and the isolation/freshness
parts of older Analytics plans where they conflict. The trusted shared-workspace
[identity ADR](2026-09-identities-and-multiplayer.md) continues to govern identity;
analytics must not introduce a new identity gate for ordinary operations.
