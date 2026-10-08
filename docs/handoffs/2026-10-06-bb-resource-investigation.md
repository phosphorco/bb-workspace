# BB resource investigation — 2026-10-06

This is a diagnostic handoff, not a remediation or a claim that every cause has been isolated. The leading findings are synchronous participant-projection rebuilding during facet queries, a growing Thread Manager request backlog, and a separate Background Jobs cancellation loop that executes systemd commands on the server although the affected terminals belong to Rosetta.

## Scope and preserved evidence

Inspected the running bb-machine server, PID **1202163**, and its local databases, logs, runtime bundles, and source. No jobs were cancelled, services restarted, plugin settings changed, or runtime/source fixes applied. Two approximately 20-second V8 profiles temporarily enabled the loopback inspector; port 9229 was verified closed afterward. Profiling adds overhead.

Evidence directory: `/home/ubuntu/.local/state/bb-diagnostics/2026-10-06-resources/`. This is a local, untracked collection; it is not automatically available on another machine. Logs and profiles contain internal identifiers and paths. It deliberately excludes job command/output text and credential values.

| ID | Artifact | What it establishes |
| --- | --- | --- |
| E1 | `server-first.cpuprofile`, `profile-first-meta.json`, `profile-first-summary.json`, `mapped-first-spawns.txt` | First profile: 18:51:14–18:51:35 UTC; 20.85 seconds represented by sample deltas |
| E2 | `server.cpuprofile`, `profile-meta.json`, `profile-summary.json`, `mapped-spawns.txt` | Second profile: 18:56:03–18:56:24 UTC; 20.96 seconds represented by sample deltas |
| E3 | `logs-five-minutes.json`, `log-counts.json` | Fixed structured-log window: 18:50:43.715–18:55:43.715 UTC |
| E4 | `background-jobs-evidence.json` | Read-only job/terminal database fields and local systemd state at 18:55:26 UTC |
| E5 | `system-snapshot.json` | Memory, disk, CPU topology, process list without arguments, pressure and five vmstat samples |
| E6 | `runtime-manifest.json`, `runtime-snapshots/`, `source-snapshots/`, `workspace-status.txt` | Bundle hashes/copies, source maps where present, inspected source copies, dirty-workspace provenance |
| E7 | `bb-resource-current-plugins.json`, `bb-resource-current-threads.json`, `bb-resource-machines.json` | Earlier contextual snapshots; not contemporaneous with both profiles |

Local time is UTC+2. E3 overlaps E1 but ends before E2. CPU percentages below are **sampled elapsed time in the main V8 isolate**, not whole-machine utilization, process CPU accounting, request counts, or child-process runtime. Inclusive percentages overlap their descendants and must not be added together. A single long native call can contribute many samples. Async stack boundaries can lose the initiating request.

The fork was clean at `4d9b909690dcc3ae7df03d8432b08b7142f0a8f5`. Workspace and plugin repositories contained authored changes. Runtime bundles, rather than a dirty source tree alone, anchor profile attribution. Source-map line positions did not consistently match current TypeScript lines; use the preserved bundles, function names, and source snapshots together. No unrelated changes were modified.

## 1. Participant projection rebuilds: strongest measured foreground bottleneck

**Observed evidence.** E2 attributed **35.47%** inclusive sampled time to `executeThreadFacetQuery`, including **31.22%** in `ensureNativeParticipantProjection`. Within that path, `readP6rParticipantTargets` accounted for **16.41%** and the batch replacement transaction **13.46%**. Garbage collection separately accounted for **27.49%** of total sampled time; the profile does not identify which caller allocated all collected objects.

E3 contained **60 slow-query records**: 33 selecting thread ID, creation time and event JSON across thread IDs; 27 selecting archived threads pending teardown. The former query shape matches the participant-history read. This correspondence supports the profile but does not attach each logged query to a particular dashboard request.

**Source-supported mechanism.** In `fork/build/bb/apps/server/src/services/threads/thread-facet-query.ts`, `executeThreadFacetQuery` calls `ensureNativeParticipantProjection` on every returned page (around lines 431–498). That function reads contribution records and historical participant events, parses and validates their JSON, constructs participant profiles, and calls `replaceCoreParticipantProfilesBatch`. `participant-projection.ts:33` reads qualifying `client/turn/requested` event data without a history limit. `packages/db/src/data/thread-facets.ts:341` performs synchronous replacement transactions. The page path does not first check whether the existing projection is current. Thread count per page therefore does not bound historical event work per thread.

**Diagnosis, confidence: high for measured cost; medium for full causal chain.** Repeated dashboard/facet reads appear to be paying reconstruction and write costs that grow with thread history. Allocation from JSON parsing/schema validation is a plausible contributor to GC, but attributing all GC to this path would exceed the evidence. The first profile did not show this as dominant, so workload changes matter.

**Recognition and next discriminating test.** Look for this exact profile stack, recurring history-read SQL, repeated projection transactions on unchanged threads, and request latency increasing with historical event volume. In an isolated reproduction, count rebuilds and rows parsed for repeated identical requests. Compare a verified current-projection read against the existing path and measure latency, writes, allocations, and correctness after edits/deletions. This is an investigation target, not approval to change the fork; workspace fork policy still applies.

## 2. Thread Manager requests accumulate: measured symptom, amplification hypothesis

**Observed evidence.** E3 recorded **26 event-loop-stall windows**, with maximum delay **3,923.8 ms**. The first recorded stall listed two active `/thread-manager/rpc/dashboard` requests; the last listed 27. Later windows also included archive operations, recency requests, and other work. These are active instrumented request frames, not necessarily separate browser tabs or 27 CPU-bound operations.

**Source-supported mechanism.** `plugins/plugins/thread-manager/server.ts:468` pages facet queries and then loads participant/error details. Relevant thread changes publish dashboard invalidations, coalesced on a one-second timer. `app.tsx:499` loads the dashboard through a query; visible-page realtime events invalidate it. The shown `queryFn` does not forward an abort signal to `rpc.call`. Query-library deduplication/cancellation behavior, transport behavior, and the number of clients have not been established.

**Diagnosis, confidence: medium.** Expensive requests may outlive incoming refreshes or UI changes, accumulating server work and amplifying the projection bottleneck. Multiple clients, bulk archive activity, downstream failures, and stale active frames are alternatives to a single runaway polling loop. These observations do not prove a memory leak or a particular browser is responsible.

**Next test.** Correlate request IDs, client/session IDs, parameters, starts, finishes and cancellations. Measure active requests while one visible dashboard is open, while hidden, and during a bounded bulk action. Verify whether invalidation cancels only client observation or also stops server work. Check concurrency/coalescing before adding another refresh mechanism.

## 3. Background Jobs cancellation retries: confirmed recurring work and host mismatch

**Observed evidence.** E1 attributed **3,692.9 ms / 17.71%** to native process launches in Background Jobs' cancellation path: about 1,864 ms under `requestSystemdStop` and 1,829 ms under `inspectSystemdUnit`. E2 again sampled this path, approximately **861.2 ms / 4.11%**. These are launch costs in the server, not time spent waiting for the launched programs to finish.

E4 identifies three jobs marked `cancelled` with `completed_at = NULL`:

- `job-muwu5iop-5acc3a39` → `term_ikpv6dg95p`
- `job-muwu7c19-45b569dc` → `term_pmc2bpcr3i`
- `job-muwu91zw-19705664` → `term_ffzyyf3vw9`

All three terminal records still said `running` and belonged to **`host_qvhpk86rp6` / Rosetta**, not the local bb-machine host. The named systemd units were locally `not-found`, `inactive`, `dead`, with MainPID 0. **Local absence says nothing definitive about the units on Rosetta.** Remote unit state was not inspected.

**Source-supported mechanism.** `background-jobs/server.ts:869` selects unfinished/cancelled jobs every supervisor iteration and sleeps one second after processing. Cancellation calls `requestAndReconcileCancellation`; `lib/systemd-containment.ts:99` and `:103` spawn local `/usr/bin/systemctl --user stop/show` without selecting the terminal's host. Reconciliation leaves a non-exited terminal unsettled in this case, so it remains eligible for another iteration. The runtime bundle confirms these commands and caller paths, independently of source-map line offsets.

**Diagnosis, confidence: high that retries waste work; medium-high that host/state mismatch sustains these particular retries.** The local control target and remote terminal owner disagree. Cached terminal state may also be stale. The evidence does not justify marking the remote job complete or deleting its record. Large-process spawn overhead is a possible explanation for expensive launches, but kernel tracing was not performed and its exact cause is unproven.

**Next test / likely repair direction.** Inspect these units and terminal sessions on their owning host first. Reproduce remote-host cancellation and unit-disappearance cases in tests. Validate host-correct control, explicit reconciliation of unavailable units versus stale terminals, and bounded retry/backoff. Preserve completion/cancellation correctness; do not blindly finalize the three records.

## 4. Other measured contributors

| Contributor | Evidence | Initial interpretation / next check |
| --- | --- | --- |
| Thread Progress plan observation | E1: 1,185.4 ms / 5.68% native spawn self time under `observed-plan.ts` | Source scans visible local environments, runs Git and a selected plan tool, and repeats after a five-second sleep plus work. Check unchanged-environment repetition and cache/invalidation opportunities. Not evidence the child tools themselves are runaway. |
| Git credential resolution | E1: 800.0 ms / 3.84% native spawn time under `runGh`; also present in E2 | `resolveGitCredentials` executes `gh auth token` and `gh api user`; profile includes host-environment/plugin-host-RPC callers. Count unnecessary repeated resolutions and credential freshness requirements before proposing caching. No credential output was captured. |
| Machine Monitor fleet overview | E1: 879.5 ms / 4.22% native query self time under `readFleetOverview`; E2 about 2.15% | A synchronous overview query is measurable. Inspect its query plan, rows examined and invalidation frequency. Result-row bounds alone do not bound scan cost. |
| Archived-thread cleanup query | 27 slow-query records in E3; native work visible in both profiles | Recurrent baseline overhead. Inspect the correlated terminal lookup and indexes with `EXPLAIN QUERY PLAN`; no claim yet that an index is missing. |

## 5. Findings that should not be mislabeled as CPU culprits

- **Capacity:** E5 showed approximately 51 GiB available memory, 117 GiB free on root, and no swap-in/out in the sampled one-second intervals. CPU retained substantial headroom even during the busier second profile (58–76% idle in that short vmstat sample). Five GiB occupied swap alone does not mean current swap pressure. The first vmstat row is a since-boot average and is not an interval sample. This evidence favors an application/main-thread bottleneck over RAM exhaustion or whole-machine CPU saturation; it does not exclude brief unsampled pressure.
- **Protocol mismatch:** E3 has seven daemon protocol rejection records; E7 identifies disconnected Palani with rejected version 207 versus server 219. That is an actual connectivity issue, not proof it accounts for major CPU use. Rosetta is a different host.
- **Noise and downstream failures:** E3 has 48 invalid-skill warnings about `thread-brief/skills/.gitkeep`, provider-usage HTTP 404, archive failures, and several `fetch failed` records. These merit separate functional triage; the snippets do not establish their initiating cause. Do not infer that all failed fetches share one outage.
- **Timeline/UI suspects:** Earlier logs showed timeline building and message-timing/recency work, but E3 contained no `Thread timeline build blocked` records. Timeline logging has thresholds and per-thread suppression, so absence is not zero cost. These profiles do not support naming timeline construction as the dominant culprit in the sampled windows.
- **Cumulative plugin handler duration is not CPU time:** it includes awaiting I/O and overlapping handlers. Similarly, event-loop logs' `currentWork` is active asynchronous work; `slowestWork` tracks completed instrumented synchronous sections. Neither is a comprehensive CPU attribution mechanism.

## Reproduction and handoff

Open the two `.cpuprofile` files in a CPU-profile viewer. The preserved `analyze-profile.py` and `map-profile.cjs` explain aggregation and source-map attribution; their paths currently target the original `/tmp/bb-diagnostic-20261006` collection, so adapt them to the durable directory and preserved bundles if rerunning later. `profile.mjs` targets the inspected PID and local inspector port and is a record of the method, not a general-purpose collector to run against an arbitrary future server.

Compare profile windows separately. Do not sum nested percentages, count samples as process launches, or infer remote process death from local systemd state. Prefer tracing/instrumentation and isolated reproductions before toggling production plugins or changing state. No remediation has been tested or deployed as part of this investigation.
