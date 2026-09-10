# Analytics 80/20: delivery intent and acceptance

This brief accompanies [the executable plan](../analytics.plan.pkl). The Pkl
definition owns work and dependencies; its sibling ledger owns observations,
rulings and completion. This document supplies acceptance context, not another
status tracker. Run plan commands from `/home/ubuntu/bb`.

## Destination and scope

One shared, retained typed fact dataset feeds a bounded backend DuckDB service.
UI and agents use the same query execution path. Versioned declarative bundles
connect multiple visualizations to each query. Every result has immutable
execution context; exact tables, exports and chart-to-chat references resolve
that context consistently.

The priority workflows are investigating failures and slow/repeated use. Keep
the existing three built-ins, native-command analysis, installed authored
bundles, ECharts adapter, topbar, loading illustration, accessible exact tables,
CSV/SVG export and mention/token workflows. This is an incremental replacement
of execution and provenance internals, not authorization to discard authored
work or rewrite the entire plugin.

Cole authorized execution on September 8 through BB child threads using Codex
Terra, high reasoning, fast service tier. Children report starts, results and
blockers by message passing; never use `bb wait`. The orchestrator records
assignments and acceptance evidence in the ledger. Package publication and
normal-host promotion remain outside this delivery. Roles are ownership labels,
not claims that agents have been assigned. Technical choices belong to the
implementer; changes to the promised product outcome belong to Cole. Use
`adjudicate` only for an actual recorded reviewer judgment.

Production work is scoped to `community-plugins/plugins/analytics`, with scoped
dependency edits in the community repository. The plan and ledger live in the
workspace. Fork/SDK or identity-package changes, publication and host promotion
require separately scoped work if evidence reveals they are needed. Preserve
the dirty workspace and exact current plugin workflows before implementation.

## Architectural decisions

### Selected implementation runtime (September 8)

Use the existing pinned DuckDB-Wasm dependency in one plugin-owned Node child,
with an explicitly packaged child entry. An unmodified-engine probe enabled
the core JSON serializer through fixed trusted `LOAD json`, with unsigned,
community, automatic-install and automatic-load settings disabled. External
access was then disabled and configuration locked before parsing all eleven
built-in queries and five structural adversarial inputs as bound data. A
separate disposable fixture passed source and real BB-built `dist/server.js`
child execution and package-file inclusion checks. The fixture reused the
installed dependency; it is not clean-install evidence.

This selects an implementation path, not a production-qualified runtime.
Bootstrap is fixed, one-shot and inaccessible to dashboard authors. Complete
AST admission, capability-denial tests, scheduling, measured memory behavior,
worker recovery and clean installation remain delivery acceptance. The
generated Wasm linear-memory maximum is 4 GiB; DuckDB's `memory_limit` is a
separate database policy, not a hard process-RSS ceiling. Do not promise an
unmeasured smaller bound or an OS sandbox. Native DuckDB remains excluded by
the current community-plugin native-dependency/install policy, despite its
successful scratch benchmarks. The ledger links independent selection proof.

### Preserved product and data decisions

- Shared backend execution is the selected direction after the native/Wasm
  comparison above. A process is not automatically a filesystem/network
  sandbox. Demonstrate the supported grammar, capability restrictions and
  explicit resource enforcement in the production acceptance suites.
- Keep ordinary SQL authoring with a complete parser for the accepted grammar.
  Do not silently substitute a substantially less expressive DSL. If no safe
  compatible path qualifies, record the blocker and revisit the contract.
- Start with plugin-owned SQLite facts/checkpoints and the simplest measured
  handoff to the query worker. Add immutable columnar exports only if the probe
  establishes an advantage worth their publication/recovery complexity. No
  Rust extractor or mandatory Parquet layer is presumed.
- Retention is distinct from freshness and from query range. Propose 90-day
  retention to support the existing 90-day control, with explicit incomplete
  backfill coverage. Establish cost before freezing that default. Never claim
  a calendar window is complete based on the most recent 80 threads.
- Preserve the current one-hour pull freshness default while measuring. Cole's
  earlier five-minute idea and subsequent hourly suggestion are not a settled
  hard freshness SLA. Define `maxAgeMs` as a refresh trigger on demand; a passive
  open page is not promised continuous freshness. Use an explicit refresh
  action and show actual as-of/coverage.
- Shared-host data scope follows BB's current high-trust, equal-information
  model. Do not add private tenant roles. Establish actual request admission,
  host/snapshot scope, actor attribution and redaction. Use the public
  `@phosphorco/bb-identity` package for identity integration if needed; configured
  identity failure must not silently fall back. Public package availability is
  a probe input, not an assumption or authorization to publish it.
- Retained facts are recoverable projections; saved bundles and reference
  capsules are user-authored artifacts. Specify separate migration, retention
  and rollback policies. An expired result may resolve its captured historical
  context when policy permits, but must not pretend the source snapshot can
  still be rerun.

## Inputs and findings to reproduce

The September 7 review inspected the working tree and reported 47 passing
Analytics tests and a passing typecheck. These are historical observations, not
fresh passing evidence for this graph. Relevant source anchors:

| Finding | Source and implication |
| --- | --- |
| Recent-cohort extraction | `server.ts`: 200 candidates, 80 selected threads, 500 selected events per thread; `store.ts` deletes facts outside selected membership. Retention cannot be established by merely raising the cap. |
| Incomplete SQL traversal | `sql-policy.ts`: expression parentheses are skipped. `SELECT coalesce((SELECT count(*) FROM information_schema.tables), 0) AS n FROM tool_execution_fact_v1` passed policy and executed on a synthetic in-memory database; so did the same expression using `range(10)`. |
| Queue exclusivity failure | `browser-engine.ts` exclusive method: hold A, queue B, cancel B, enqueue C; C starts before A finishes. The review reproduced this using the extracted production method. |
| Reference context race | `app.tsx` combines the menu's prior result with current dashboard range/generation; `server.ts` reads current bundle SQL on capsule creation. |
| Moving-window cache mismatch | `store.ts` filters by request-time `Date.now()`; browser materialization identity has generation/range length without a fixed endpoint. |
| Evidence gap | Existing tests cover units, synthetic SQLite throughput and some DuckDB binding. They do not establish end-to-end distributions, hard cancellation/resource limits or retained-history scaling. |

Inspect the current source again when work begins; concurrent authored changes
may have altered these observations. Preserve exact revisions and relevant
dirty-file fingerprints with reproduced evidence. Never label an import error
or crash as a successfully reproduced assertion failure.

## Acceptance map

All commands named in the graph's future `test/architecture` directory are
acceptance instruments to implement. They do not exist or pass merely because
this plan checks. Instrument review precedes their use as completion evidence.

| Outcome | Required witness / suite |
| --- | --- |
| Reusable retained history | `extraction`: page beyond 200 threads and 500 events, age a thread out of the recent cohort without losing retained facts, finish resumable cold backfill, enforce retention, and report partial coverage. Verify relevant append/mutation/delete/rewind semantics through the public SDK. |
| Crash-safe refresh | `extraction`: interruption before/after checkpoint and publication; replay is idempotent, facts/coverage agree, failed reads retain good facts, unchanged pulls do no event rereads when supported, overlapping pulls share one run. |
| Safe, bounded SQL | `query-runtime`: accepted CTE/window queries and rejected nested/quoted/qualified/table/scalar external paths through the complete grammar; unknown syntax fails closed. Verify no unauthorized file/network/extension access, bounded intermediate memory/CPU, timeout recovery and next-query success in the selected process runtime. |
| Correct scheduling and reuse | `query-runtime`: A/B/C cancellation witness now passes; one subscriber leaving does not kill shared work. Bound queued work and result bytes. Identical query/parameters/snapshot/scope reuse execution; distinct endpoints or scope cannot collide. |
| Historical analytical identity | `references`: immutable bundle/query revisions, schema/measure bindings, full parameters, range endpoints, snapshot/projection revision, coverage, selected datum and other consumers of the query. Server resolves its own result; no trusting posted row/SQL claims. |
| Honest source semantics | `references` and `end-to-end`: distinguish query-result truncation from source coverage, degraded refresh and incomplete backfill. Keep unknown historic tool versions/skill reads unknown. |
| Trust and retention | `references` and `migration-packaging`: enforce actual shared-host request scope and attribution; reject forged or mismatched execution/datum identities; test missing/deleted/expired references and identity-failure behavior without inventing permission tiers. |
| One visual-to-chat workflow | `end-to-end`: actual chart and keyboard row actions, range changes, refresh/bundle edit while menu open, copy token, composer insertion/send-time resolution through the real provider, and matching exports. Use a controlled composer sink; never send real external messages. |
| ECharts lifecycle | `ui`: hidden/revealed mount, compatible update, structural replacement, repeated mount/unmount, no duplicate handlers, clean observers/frames and bounded render work. Image capture agrees with the exported execution revision. |
| Performance under scale | `performance`: distributions and peak resources for 25k/250k/1m synthetic facts, representative local redacted data where in scope, 1/10/30 views, shared versus distinct queries, 1/4 clients, and 0/1/5/20/80 changed threads. Include repeated navigation and slow/cancelled queries. |
| Existing users keep working | `migration-packaging`: current built-ins and authored bundle fixtures, v1 references and prior databases; recovery after worker/reload failure, retained rollback artifacts and clean package installation. Full community tests/typecheck/build and workspace composition checks follow. |

## Proposed performance budgets

These are initial engineering targets, not guarantees or owner-approved SLAs.
The execution-contract review must freeze feasible budgets, hardware and dataset
shapes after the probe. Record changes and rationale in the ledger before final
measurements; never lower a threshold merely to turn a failed run green.

- Warm p95 time to useful dashboard below 1 second on the named reference
  device/host; record sample count (at least 30 warm runs), p50/p95/max.
- Shared-view case: 1, 10 and 30 visualizations consuming the same queries cause
  no extra extraction or duplicate SQL execution for identical inputs. Rendering
  cost and total marks remain visible separately.
- Stale snapshot displays immediately; at most one extraction per source scope.
  Track changed/skipped counts and test at least 80% fewer event reads when at
  most 20% of the selected source cohort changed, subject to validated SDK
  invalidation semantics. Daily reconciliation is measured separately.
- Start with the existing 2-second SQL deadline and 500-row result cap. The probe
  must set additional byte, memory, queue, worker kill/recovery and export limits;
  a row cap alone is insufficient. Do not stress the live host beyond a bounded
  safe probe budget.
- Measure cold engine startup, cold history backfill convergence and first
  useful data separately. Do not invent a cold-start guarantee before measuring.
- Measure source fetch/bytes, projection, publication, transfer, query queue and
  execution, first paint, interaction, host event-loop delay, CPU and peak RSS.
  Propose at most 10% p95 degradation in a controlled concurrent BB responsiveness
  workload; establish a reproducible baseline before using that gate.
- No source extraction while unused. Explicitly own query-worker lifetime:
  demand-start, bounded cache, shutdown when no consumers/work need it according
  to the accepted lifecycle contract. Report any intentional warm retention;
  do not describe retained memory as zero resource use.

## Delivery boundaries and recovery

After the runtime ruling, refine runtime-specific tasks and oracles explicitly;
Selectors do not activate branches. Contract and harness unlock independent
extractor, query, reference and UI implementations. They have separate file
footprints; `compose-plugin` owns their shared server/RPC wiring and waits for
their artifacts and evidence. Integration, performance and compatibility proofs
then run against the real composition. A source change requires rerunning its
affected evidence even when plan fingerprints remain green.

The September 8 sequencing correction separates the verified bounded runner
and historical witnesses from full suite review. Produced harness files plus
the verified execution contract and runner allow implementation and test-owned
bindings to develop together. Each implementation still needs its normal real
suite to pass; full substantive harness review additionally gates composition.
An absent binding, a failing oracle, or a green controlled self-test is never
production acceptance. This changes sequencing, not the acceptance map above.

Defer new chart types, cross-filtering, arbitrary executable dashboard code,
adaptive layouts, sampling/approximation, canonical skill effectiveness scoring,
mandatory Rust/Parquet, and generic cross-plugin chart framework extraction.
Keep current features; deferred additions must not be confused with removing
existing behavior. If a public event contract cannot support retained history,
record the exact gap and revise the dependent plan instead of reading private
operational SQLite or silently shipping incomplete coverage as complete.

The final outcome review includes unresolved ledger notes, migration/rollback,
public dependency availability, source semantics and performance evidence. It
is neither a package publish step nor normal-host promotion. Follow the workspace
child-first commit/push and tested gitlink promotion policy if later delivering
commits. No generated `dist/`, operator `~/.bb/` state, raw events, credentials
or sensitive benchmark fixtures belong in source control.

## Commands

```sh
workbench plan check plans/analytics.plan.pkl
workbench plan recall plans/analytics.plan.pkl
workbench plan tick plans/analytics.plan.pkl
# Once the named instrument exists and its dependencies are satisfied:
workbench plan verify plans/analytics.plan.pkl --node feasibility-evidence --cwd /home/ubuntu/bb --timeout 10m
```
