# Preserve functionality while isolating its cost

Follow-up to the October 7 resource audit. This analysis traces current implementation intent and distinguishes functionality from its execution mechanism. It is not an approved fork implementation plan. No runtime changes or performance fixes were made.

## Machine monitoring

**Required outcome:** trustworthy measurements, truthful freshness/coverage, accurate rolling windows, independently useful live health and historical views. More viewers must not change sampling semantics. Monitoring must continue while all browser tabs are hidden or closed. An unavailable source must not become a healthy-looking cached value.

**Current implementation:** Machine Monitor already owns `/home/ubuntu/.bb/plugins/machine-monitor/data.db`, separate from `bb.db`. Both were confirmed open in server PID 1202163. `plugin-api.ts:908` creates plugin databases with better-sqlite3, WAL, and a 5-second busy timeout. Machine Monitor passes that connection to its stores and `SqliteTimelineQuerySource` (`server.ts:138`). Database-file isolation already exists; synchronous execution remains in BB's process/main thread. The profiles establish query cost, not a lock conflict against the main database. WAL is not event-loop isolation, and `async` around a synchronous database call does not move that call off-thread.

The fleet coordinator supplies important existing protections: independent collection lanes, global concurrency 8 with 2 slots reserved for core work, per-lane backoff, session/sequence identity, generation checks, write-before-notify, and no host collection triggered by browser reads. Nominal intervals are core 30 seconds, directories 15 minutes, inventory 24 hours with start/reconnect refresh; memory has a 60-second diagnostic interval and a 5-second pressure interval. These describe implementation, not newly selected freshness requirements.

**Why the overview repeats work:** `timeline-query.ts:835` deliberately bypasses a generation-only cache because freshness changes with wall-clock time. Its query computes latest observations plus a five-minute CPU sample average. Even without a new sample, the window changes as old samples expire. Blind generation caching would therefore be wrong. This explains the implementation choice without making a per-viewer synchronous historical query necessary.

**Better division of responsibility:** a trusted collection lane records observations independently of viewers; an isolated monitoring execution process owns ingest, retention and historical queries; a committed current-health projection serves viewers. Maintain rolling-window membership on sample arrival and expiry, preserving the chosen average definition. Freshness/connection/error metadata should advance even if numeric values do not. Historical charts consume a named generation and explicit range. Separate current-health admission from expensive history/export work so chart requests cannot starve sampling. A browser subscribes to committed updates; hidden browsers may stop display work without stopping measurement or alert evaluation.

A separate process moves blocking work off BB's event loop. OS CPU/memory/I/O limits and fair admission are additionally needed to prevent contention through shared hardware. A worker thread alone does not establish full isolation. A replica or separate file queried synchronously from BB is also insufficient. Prefer an existing supported plugin/service boundary; implementation capabilities must be verified before selecting a concrete deployment.

**Accuracy contract to preserve:** host identity, collector boot/session, sequence, observation time, server receipt time, metric definition, units, sample interval, freshness deadline and coverage/gaps. Rate metrics need counter deltas and monotonic intervals; restart/reset must not look like zero usage. Rolling averages need a specified sample-weighted or time-weighted definition—changing that silently is a semantic change. Directory walks are interval observations, not atomic filesystem snapshots. Display known limitations rather than implying continuous precision from periodic sampling. Preserve current sampling while defining per-metric freshness requirements; do not substitute hourly analytics freshness for operational health.

The accepted analytics isolation ADR already supports a shared bounded collector, isolated execution, committed generations and aggregate—not per-tab—budgets. Its default one-hour analytical freshness must not be applied to this user's explicit operational monitoring requirement. Failure isolation means monitoring can report a real gap while BB remains usable; it cannot promise fresh data from an unreachable machine.

## Thread Progress

**Required outcome:** correct working/idle/waiting states, ordering and per-viewer preferences, cumulative active duration, summaries with provenance, and the optional observed plan-completion marker.

These have different truth sources. Lifecycle transitions determine activity; time labels derive from timestamps; summaries are derived background work; manual preferences are authored state. The observed hill marker is an environment-level plan projection: `ProgressHill` reads `progress.observedPlan.complete / nodes` to show graph completion alongside a separately predicted phase.

**Current cost:** `refreshObservedPlans` lists visible threads, groups environments, discovers candidate plans, invokes Git to assess recency, and invokes Workbench/Bun for the selected plan. The supervisor repeats after work plus a five-second sleep. This preserves compatibility with authoritative plan tooling, but repeatedly evaluating unchanged inputs is independent of the essential activity-state guarantee. It also operates only on eligible primary-host environments; claiming universal plan coverage would be incorrect.

**Better division:** keep lifecycle correctness and durable summary delivery independent of the plan evaluator. Share one plan result per environment/input revision; subscribe to the relevant plan, ledger, repository and evaluation dependencies through supported watchers, with bounded reconciliation after watcher gaps/reconnects. Include tool/schema versions and all effective dependencies in invalidation; an mtime-only cache is not automatically sufficient. If a plan depends on time or external facts, explicitly supply those dependencies or use a bounded validation cadence. Run the authoritative evaluator outside the interactive process, retain provenance and last evaluation status, and publish only changed results. Unknown or failed evaluations must not become 0% or 100% completion.

The inbox's global `progress-changed` refresh is a separate cost. Coalesce requests, apply deltas keyed by thread/revision, and reconcile from a snapshot after reconnect. Hidden display suppression must not stop server-side state tracking, pending questions, summary work or notifications. Shared projections must preserve viewer-specific identity/filter/preference boundaries.

## Git credentials and contributed host environment

**Required outcome:** remote checkouts, Git commands, environment setup, terminals and agents can authenticate using the intended credential and author identity, while respecting user/project overrides and credential rotation/revocation.

`resolveHostEnvironment` generates built-in Git credentials only for non-primary hosts when `machineGitCredentialsEnabled` is enabled. `resolveGitCredentials` executes `gh auth token` and `gh api user` to obtain authentication and author identity. Environment merging deliberately lets user/project values override built-ins. Callers include project source setup, lifecycle scripts, terminals, live commands, thread runtime configuration, host-environment synchronization, and plugin host RPC.

**Why monitoring incurs credential work:** `callPluginHostRpc` resolves contributed environment before dispatching a host plugin call. Monitoring and brief reads use that general transport. Thus the profile's Git work can be a dependency cost of a read that does not itself perform Git. It is not evidence that Git authentication is useless. The existing host-environment sync mechanism already supplies versioned replacements on configuration/connection changes, but its presence does not prove every RPC can safely rely on that snapshot.

**Correctness requirements for reducing work:** distinguish the lifetime of an authenticated environment from that of an individual read; share identical in-flight resolution; preserve host/project/identity scope and override precedence; explicitly handle rotation, logout, revocation, reconnect and failures. An arbitrary long token TTL, indefinitely serving a failed refresh, or removing credentials from every plugin call is not an adequate design. Check which plugin operations truly need authenticated tools and whether existing supported environment-sync/host capabilities can supply the required semantics. Reducing redundant plugin host calls is immediately within plugin scope; altering core resolution requires separate capability and fork-policy review. No core patch is proposed here.

## Thread Manager, Message Timings, Briefs and Background Jobs

| Feature | Function to preserve | Work-placement implication |
| --- | --- | --- |
| Thread Manager participants | Correct participant filters and names after contributions, edits, rewrites and deletion | Rebuilding participant history on every page serves correctness but makes read cost grow with history. A revision-checked materialized projection should be advanced from authoritative changes, with explicit repair/reconciliation. Authorization-sensitive uses must not silently accept stale membership. This diagnoses core behavior; a concrete core change still requires policy review. |
| Message Timings | Correct request/turn timing and honest incomplete history | Preserve anchors and pagination coverage. Reuse results by relevant lifecycle/history revisions, not every unrelated event; isolate backfills and keep existing concurrency/admission limits. Do not invent missing timestamps to make a faster view. |
| Thread Brief | Read actual remote thread documents and update mounted views when files or recognition context change | Existing shared leased watches are preferable to per-tab file polling. Preserve ownership, reference counts, reconnect and lease expiry. Cleanup timeouts need remote-state tracing; stopping the watcher parent indiscriminately can break correctness. |
| Background Jobs | Supervise real commands and deliver terminal/completion/deadline state reliably | Ownership and terminal reconciliation are essential; retrying the wrong machine is not. Separate UI subscriptions from durable supervision. Coalesce remote output reads and back off failures without dropping eventual completion delivery. |

## Validation before changing behavior

Measure four dimensions separately: correctness of the value/state, age of its evidence, completeness of its coverage, and interference with interactive BB. A fast stale answer does not satisfy all four.

Use identical fixtures to compare one viewer against many viewers, with no source changes and with sustained changes. Collection/evaluation counts should follow source changes and chosen measurement cadence, not tab count. Test hidden tabs, reconnection, counter resets, credential rotation, watcher loss, remote timeouts and cancelled subscribers. Saturate historical queries while checking sampling deadlines and BB interaction latency. Check isolation failures and queue bounds as well as average performance.

Prioritize preserving authoritative supply and removing repeated derivation. UI visibility gating is useful containment, but cannot replace a properly shared and isolated backend.
