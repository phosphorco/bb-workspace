# BB server performance remediation — handoff (2026-10-07)

Owner thread: `thr_h5jwmx59qk` (evaluation steward). Report to it with
`bb thread tell thr_h5jwmx59qk "<message>"`. Never use `bb thread wait`.

This hands off remediation of the main server performance problems. It is
grounded in two evidence sets: the 2026-10-06 CPU-profile investigation
([docs/handoffs/2026-10-06-bb-resource-investigation.md](2026-10-06-bb-resource-investigation.md),
evidence in `/home/ubuntu/.local/state/bb-diagnostics/2026-10-06-resources/`)
and the 2026-10-07 log and driver measurements in
`/home/ubuntu/.bb/thread-storage/thr_h5jwmx59qk/` (`bun-migration-evaluation.md`
section 6, `top-slow-queries.json`, `top-slow-queries.mjs`, `sqlite-driver-bench.mjs`).

## Outcome

The live bb-machine server (`bb.service`, `~/bb/fork/build/bb`) stops spending
most of its main-thread time on a handful of repeated synchronous reads, with
a measured before/after on the same signals: "Slow DB query" rate and p50/p99,
"Thread timeline build blocked the event loop" rate, and event-loop stall
windows. Memory (7.36 GB RSS, 6.27 GB anonymous) is a secondary signal to
watch, not the primary target.

## What the evidence established (do not re-derive)

- No lock contention: zero `SQLITE_BUSY`, "database is locked", or `SqliteError`
  across 2.8 GB of server logs and the 7-day journal. The "locked" experience
  is the single-threaded event loop running synchronous reads and projections.
- Slow queries (>=100 ms) in the last ~16 h of logs: 76 k sampled, p50 113 ms,
  p90 163 ms, p99 322 ms, max 4.6 s, 99.9% `select ... all()`.
- Swapping SQLite drivers does not help: better-sqlite3 and bun:sqlite run the
  same SQLite 3.53 engine and timed within +-13% on the real queries. The bun
  migration is explicitly out of scope for this work.
- The database is 16.7 GB: 135,737 threads (134,342 archived), 5.6 M events,
  68 k terminal sessions (all `exited`).
- The hottest CPU path in the 2026-10-06 profiles, participant projection
  rebuilds (`executeThreadFacetQuery` -> `ensureNativeParticipantProjection`
  -> `readP6rParticipantTargets`, ~31% inclusive), lives in fork patches
  0002, 0004 and 0015, not in upstream. GC was a further ~27%.

## Prioritized targets

### P1. Archived-thread teardown sweep (largest log signal)

`listArchivedThreadsPendingTeardown` (`fork/upstream/packages/db/src/data/threads.ts:1361`)
is called by `runThreadProvisioningOrphanCleanupSweep`
(`fork/upstream/apps/server/src/services/system/periodic-sweeps.ts:304`, registered
with `cadenceMs: 0`, i.e. every sweep tick). 5,666 slow runs in ~16 h at
174 ms average, each returning ~6,600 rows after scanning 134 k archived
threads with an `EXISTS` on `terminal_sessions`. That is about one second of
main-thread blocking per minute from one sweep.

Start with the root cause, not the index: the sweep re-finds the same ~6,600
"pending teardown" rows every tick, so teardown is not draining. Establish
why (which status keeps them pending, whether the teardown work fails or is
skipped) before changing the query. Then reduce the cost in this order:
drain or stop re-selecting rows that cannot be torn down; give the sweep a
real cadence; make the predicate index-friendly (partial indexes are cheap
here since nearly all terminal sessions are `exited`). Measure with
`top-slow-queries.mjs` against fresh logs.


> Correction 2026-10-07 (from @thread:thr_r8j48s5bzp, verified read-only): the "~6,600 rows per tick" figure came from the owner's benchmark binding the wrong status list ('idle' instead of 'stopping'). The live query selects 22 rows (archived, not deleted, status 'pending'); all 68,071 terminal sessions are 'exited' so the EXISTS arm matches nothing. The 141-174 ms cost is the plan: the OR forces a range scan of ~134 k archived threads via threads_archived_status_idx with a correlated EXISTS per row. Splitting the two arms into separate queries uses threads_active_maintenance_idx (0.12 ms) and a terminal-session join (12 ms); a partial index on terminal_sessions could take it under 1 ms.

### P2. Participant projection rebuilds (largest profiled CPU)

Fork-owned code (patches 0002/0004/0015). The 2026-10-06 handoff section 1 has
the profile attribution and the slow-query shape (`select thread_id, created_at,
data from events where thread_id in (100 ids) and type = ?`, 270 ms avg in
the 2026-10-07 logs). Make the projection incremental or cached so a facet
query does not rebuild it synchronously; keep the identity ADR semantics
intact (verified people, carried attribution, machine actor fallback).

### P3. Event reads and timeline builds on the main thread

Per-thread event reads with `json_replace`/`json_extract` projection
(`fork/upstream/packages/db/src/data/event-output-truncation.ts`) and timeline
builds blocked the loop 937 times in 16 h (>=150 ms, up to ~390 ms, often
~1,200 event rows and ~470 KB per build). Options to evaluate: cheaper
projection, paging limits, or moving these reads to a worker thread with its
own read-only connection. This is upstream code; see constraints.

### P4. Plugin-side amplifiers (our repos, no fork policy cost)

From the 2026-10-06 handoff: the Thread Manager dashboard request backlog
(`plugins/plugins/thread-manager/server.ts` around line 468, no abort signal
forwarded, one-second invalidation coalescing) and the Background Jobs
cancellation loop that repeatedly spawns systemd commands for jobs that are
`cancelled` with `completed_at = NULL`. Both live in `plugins/` and can ship
independently.

## Constraints

- Read `/home/ubuntu/bb/CLAUDE.md` and run `./bin/status` before any change.
- Fork changes are a last resort. P2 and P4 are already ours (fork patches and
  our plugin repos). P1 and P3 touch upstream code: prefer an upstream PR to
  `get-bb/bb` and propose the smallest fork patch only with Cole's explicit
  approval, naming the lines and the upstream-sync cost. Report the proposal
  to the owner thread before writing it.
- Never modify `~/.bb` data, run migrations against the live database, or
  restart `bb.service` without Cole's confirmation relayed through the owner
  thread. Open the live database read-only for diagnosis, as
  `sqlite-driver-bench.mjs` does.
- Do not stash, reset, clean or move any child repository. Dirty trees are
  authored work.
- `fork/build/proof-bb` on ports 39886-39888 with separate state is the
  authorized proof venue; it is not currently materialized. Follow
  `fork/plans/bb-fork-local-proof.md` to create it if you need a running
  candidate.
- Verification for the fork: `fork/README.md` scripts, then install, typecheck,
  test, build in `fork/build/bb`. For `plugins/`: the checks in its `AGENTS.md`.
  Exclude Electron desktop tests.

## Working agreement

1. First message back: your plan for P1 root cause (what you will inspect, what
   you expect to find, what you will not touch), before any edit.
2. Report each measured finding and each proposed fork patch to the owner
   thread; do not wait for a reply to continue diagnosis, but do wait before
   writing a fork patch or touching production.
3. Maintain your own `$BB_THREAD_STORAGE/BRIEF.md`.
4. Deliverables: before/after measurements per target, commits in the right
   child repositories (not pushed or promoted without Cole), and a short
   summary of what remains.
