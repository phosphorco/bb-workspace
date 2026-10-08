# Current resources and multi-tab amplification — 2026-10-07

Inspected bb-machine around 18:37–18:42 CEST. This is a fresh diagnostic sample, not a replay of yesterday's findings. No application code, settings, jobs or service lifecycles were changed. A temporary 20-second V8 profile used the loopback inspector, which was verified closed afterward.

Evidence lives at `/home/ubuntu/.local/state/bb-diagnostics/2026-10-07-resources/`: CPU profile and metadata, mapped spawn stacks, process interval sample, ten-minute logs, two plugin-stat snapshots and their deltas, current system/workspace status, served frontend bundles and hashes, runtime bundles/maps and selected source snapshots. This local collection is not committed or uploaded. The analysis scripts retain their original `/tmp/bb-resource-20261007` paths; adjust those when reusing the durable copy.

## Current measurements

- Load average initially 0.84 / 1.09 / 1.32 on 16 logical CPUs. Approximately 50 GiB memory available; 5 GiB occupied swap is not by itself evidence of active swapping. Memory/I/O pressure averages were zero at the initial read.
- Server PID 1202163 used **57.9% of one CPU** during a separate five-second process sample; RSS was approximately **6.7 GiB**. Its `ps %CPU` lifetime average was 81%, which should not be presented as current interval utilization. RSS is higher than yesterday's roughly 4.8 GiB but two snapshots cannot establish a leak.
- Last ten minutes at initial collection: **31 event-loop stall warnings, maximum 843.1 ms**; **12 timeline-build blocking warnings**; **69 slow-query warnings**. Warnings are thresholded and may be suppressed, so these are logged records rather than complete operation counts.
- Background Jobs repeatedly failed to read terminal output: **24 + 24 + 20 HTTP 504 records** for three jobs. Thread Brief had **14 watch-cleanup timeouts**. Machine Monitor recorded three collection timeouts for Rosetta. These support a remote-operation latency problem; they do not prove a common root cause or local CPU exhaustion.
- There were 24 established TCP connections to port 38886 at one instant. This is **not a browser-tab count**: local SDK calls, proxies and pooled connections confound that inference.

## Zombie and orphan triage

Persistent zombie: **PID 3906980**, `sh`, parent **3906968**, approximately 14 hours old, zero RSS and zero CPU. The parent is the daemon's live `bb-parcel-watcher-child.mjs`, approximately 979 MiB RSS, parented by host daemon PID 1202178. Its process sample did not show meaningful CPU consumption.

Briefly observed `gh` and `systemctl` zombies disappeared on later reads, consistent with normal child-exit/reaping windows. The persistent shell zombie remained across samples.

**Action:** no process killed. A zombie has already exited; SIGKILL cannot remove it. The parent must reap it, or exit so another parent can reap it. Restarting a working filesystem watcher just to remove one zero-resource entry has no demonstrated performance benefit. If persistent zombie count grows, inspect child-process exit handling and validate a controlled watcher recycle with subscription restoration/rescan. No live orphan was identified with enough evidence to justify termination; an old agent or watcher is not automatically abandoned work.

## Measured slowness and opportunities

The V8 profile represents **21.01 seconds** of sampled main-isolate elapsed time, including **47.48% idle**. Percentages are not whole-machine CPU percentages or child execution time. Native spawn samples include synchronous process-creation cost; sample counts are not launch counts.

| Path | Current evidence | Opportunity / uncertainty |
| --- | --- | --- |
| Core Git credential resolution | **3,346.9 ms / 15.93%** native spawn self time under `runGh → resolveGitCredentials`; host-plugin RPC callers appear in stacks | Each host RPC resolves contributed environment; credential resolution executes `gh auth token` and `gh api user`. Investigate shared in-flight resolution and a freshness-aware cache, or avoiding irrelevant resolution for reads. Exact kernel cause of expensive spawning remains unmeasured. This is core code; no fork change is authorized by this audit. |
| Thread Progress plan observation | **1,926.1 ms / 9.17%** native spawn self time in `observed-plan.ts` | Current source repeatedly discovers plans and invokes Git/plan tools, with a five-second sleep after its service sweep. Cache by actual plan/ledger/repository changes and restrict work to relevant environments. This is server background work, not necessarily multiplied by tabs. |
| Machine Monitor overview SQL | **2.74%** native query self time under `readFleetOverview` | Profile confirms measurable synchronous query cost. Inspect plan/rows scanned and overview invalidation frequency; result-row bounds do not bound database work. |
| Background Jobs cancellation control | About **215.5 ms / 1.03%** native spawn self time | Still present, but much smaller than yesterday's first profile. Today's more prominent symptom is terminal-output timeout/retry churn. Inspect owning-host state and apply bounded retry/backoff only while preserving completion delivery. |
| Thread Brief remote watches | 14 cleanup timeout records in initial ten-minute log window | Trace subscription ownership, remote host health and lease cleanup. Do not conclude that a local zombie caused these failures. |

A roughly **66-second handler-stat delta** showed Message Timings: 7 handlers / 3.90 seconds cumulative elapsed; Machine Monitor: 136 / 2.54 seconds; Thread Progress: 14 / 1.84 seconds. These are handler invocations, not necessarily frontend RPCs; elapsed time includes waits and overlap. They cannot rank CPU consumption. Historical Thread Manager maximum handler duration was about 260 seconds, but no Thread Manager activity appeared in this short delta, so yesterday's dominant facet-rebuild workload is not established as today's dominant workload.

## Multi-tab request amplification

This is a risk of **accidental request amplification by authenticated clients**, not evidence of an external DDoS. I did not open dozens of tabs or load-test production. Findings combine the actually served frontend bundles with current source. Browser cache versions and mounting behavior still need a controlled browser witness; dirty source alone is not deployment proof.

### Highest-priority frontend opportunities

**Thread Progress inbox:** `components/progress-inbox.tsx:956` sends `listProgress` from `refresh()`. The `progress-changed` handler around line 1041 invokes it without a visibility or in-flight guard; the served bundle confirms this handler. The request counter protects part of response application, not request admission. Separate comment visibility logic does not guard progress refreshes.

For N mounted clients and R progress broadcasts/second, this path can create approximately **N × R refresh attempts/second**, before downstream effects. That is a scenario formula, not a measured current rate. Hidden browser timer throttling does not guarantee realtime callbacks stop. Coalesce each client's refresh to one in flight plus one pending refresh, mark hidden views stale, and refresh once on visibility. Consider narrowly scoped responses and server-side sharing with identity/view permissions included in cache keys.

**Machine Monitor:** `app.tsx:517` refreshes overview on fleet invalidation and can reread the selected timeline. The served app has no `document.hidden`/`visibilityState` gate. The health surface also refreshes on every fleet event (`app.tsx:1122`). `fleet-client.ts:161` does coalesce overlapping overview requests **within one client instance**, and backend caching exists, so it would be wrong to call every tab's event a fresh full database scan. Nevertheless, mounted hidden tabs still generate request/response/serialization traffic and potentially detail reads. Defer hidden-tab overview/timeline/health refreshes and reconcile once when visible. Preserve freshness semantics and existing generation-aware caching.

### Expensive paths with existing defenses

**Thread Manager:** current served UI/source includes hidden-tab invalidation protection. A visible dashboard can still issue expensive facet/participant work, and the shown query function does not forward an abort signal. Multiple visible windows, rapid filter changes and reconnects deserve a bounded reproduction. Yesterday's profile established expensive participant rebuilds in the unchanged fork; that is historical evidence, not the dominant stack in today's sample. Assess server request cancellation/admission and identical-query coalescing before adding retries.

**Message Timings:** frontend skips hidden documents, coalesces changes for 2.1 seconds and prevents overlapping loads. Current server source has per-thread single-flight caching, concurrency 2 and 32-entry admission bound. A cache miss can still read up to 12 timeline pages; many distinct active threads can create expensive queued work. Preserve those safeguards and inspect unnecessary invalidation/full-history reconstruction. Today's handler delta shows latency but does not prove CPU dominance.

**Subscription Router:** visible-only polling, one request in flight, 15-second normal interval and five-second retry interval, with five-second server TTL/single-flight caches in source. Fifty truly visible clients would imply about 3.3 normal route-poll attempts/second before cache sharing, plus other requests. Hidden tabs are already guarded here. Retry/reconnect jitter and cross-client sharing could reduce synchronized bursts; treat this as a lower-priority gap than unguarded realtime refreshes.

**Background Jobs:** the panel's one-second interval only advances local elapsed-time labels; it does not fetch terminal state. Do not mistake this timer for one server request/second/tab.

## Suggested order and acceptance evidence

1. Add visibility-aware coalescing to Thread Progress and Machine Monitor through plugins; preserve user-specific data boundaries. Confirm served bundles after deployment.
2. Measure and reduce repeated credential resolution and plan-tool launches. Any core implementation requires the separate fork-policy review; this audit proposes no fork patch.
3. Trace Rosetta terminal/watch timeouts, including retry and cancellation ownership. Do not kill local processes as a substitute for remote-state diagnosis.
4. In an isolated preview, compare 1, 10 and 30 tabs with the same fixture: hidden tabs, visible windows, same thread, different threads, rapid switching and reconnect. Capture RPC starts/completions, backend in-flight work, event-loop delay and browser responsiveness. Expected behavior: hidden tabs do no routine refresh work; same-key requests coalesce; distinct-key concurrency/queues remain bounded; reconnects do not synchronize a burst; cancellation stops backend work where supported.

No production flood test, remedial code change, or service restart was performed. No evidence currently supports buying more RAM or indiscriminately killing processes as the first response.
