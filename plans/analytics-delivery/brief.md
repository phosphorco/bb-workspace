# Analytics follow-up: from isolated components to the complete product

Cole requested this follow-up on September 8, 2026 (September 9 UTC). It plans
the remaining delivery; creating it does not start agents, tests, installs,
benchmarks, browser sessions, publication, or host promotion.

Cole subsequently authorized execution in parallel BB threads. All newly
employed child threads use provider `codex`, model Luna, reasoning `xhigh`, and
service tier `fast`; this supersedes the earlier Terra/high worker preference.
Children send STARTED, bounded checkpoints, source receipts, results and
blockers to the parent with `bb thread tell`. Never use `bb wait`. Start ready
implementation lanes as their dependencies clear; blocked lanes may perform
explicitly assigned read-only preparation, but may not begin implementation
before parent clearance. Keep heavy verification serialized independently of
source-work parallelism.

Use [analytics-delivery.plan.pkl](../analytics-delivery.plan.pkl) for intended
work and its sibling ledger for new observations. The original
[plan](../analytics.plan.pkl) and [ledger](../analytics.ledger.jsonl) remain
unaltered historical evidence, including failed runs. On execution, use this
follow-up as the single remaining-work queue; do not dispatch overlapping old
and new node owners. Stable IDs are retained for unchanged obligations, but
their historical completion states are not copied into the new ledger.

## Destination

A user opens an existing or authored Analytics dashboard. One demand-owned
retained projection feeds one shared backend execution service for UI and
agents. Tables/charts show exact canonical results and honest coverage. After
refresh, range or bundle edits, a captured mark still exports and resolves in
chat to its original execution, query, bundle, datum and source coverage.

All existing builtins, SQL authoring, native-command/turn analysis, topbar,
loading illustration, accessible tables, CSV/SVG export, copy and mention
workflows survive. Browser fact downloads and browser-owned DuckDB cease on
the completed path. Performance, recovery and clean-install compatibility are
measured on the actual integrated product.

## Carry forward, do not restart

| Existing work | Reuse and remaining obligation |
| --- | --- |
| Runtime choice, accepted execution contract, source-history probes, bounded runner and historical controls | Reuse after current-file review; do not rerun historical feasibility merely to populate a fresh ledger. |
| Isolated query runtime and exact operation/observer tests | Source-reviewed and independently passed, then formal verification timed out. Diagnose and obtain a current formal pass; do not erase either observation. |
| Retained staging primitive | Four focused synthetic SQLite tests passed: file reopen/resume, rollback, canonical replay and bounds. This is not a source adapter, extractor, retention policy or active publication. |
| Reference, UI, composition, performance and migration instruments | Useful artifacts, but real bindings/coverage are incomplete. Self-tests are assertion-wiring evidence only. |
| Current app/server | Still use browser execution and the 200/80/500 recent prefix. The user-facing cutover is unfinished. |

Baseline reviewed query identities are index `a3a0abd5`, worker `87de0f37`,
helper `335d6aa6`, suite `541fdf83`, binding `58f6afe1`. Staging identities are
store `85310ca6`, staging `34d39ea4`, tests `8c9f8391`. Full hashes and exact
receipts are in the original ledger. These are historical anchors, not pins
to restore over newer authored work. The initial carry-forward review verifies
current identities and explicitly accounts for drift.

## Delivery sequence

1. **Recover a safe frontier.** Confirm current source/evidence and host budget.
   Close concrete RPC/host/storage/test-routing seams. Retained extraction and
   query verification can proceed independently; contract-based UI and host
   work need not wait for final benchmarks.
2. **Finish the missing backend/product pieces.** Retained SDK reconciliation
   and publication; authoritative execution records; reference resolver; UI
   execution consumer. Each owns its real operation tests and normal binding.
3. **First product milestone: `retained-dashboard-roundtrip`.** A real builtin
   dashboard, real public-source adapter over synthetic data, real SQLite,
   real isolated worker and real browser prove the complete retained
   dashboard-to-reference path. Include more than 200 threads/500 events,
   append/omission, shared UI/agent work, captured-context mutation and restart.
   This is a milestone, not completion of the whole project.
4. **Complete the cutover.** Exercise every builtin and installed authored
   bundle, pointer/keyboard, export/mention, refresh/error/navigation workflow.
   Remove obsolete routes only when all consumers have migrated.
5. **Qualify and review.** Rerun integrated component proofs, measure workload
   distributions and contention, prove migrations/clean packaging, then judge
   the complete outcome against both ledgers.

The graph distinguishes artifact availability from verification. Instrument
readiness is a substantive review, not a demand for a not-yet-built downstream
product to pass. Composition still requires verified real components, and
final acceptance still requires the real integrated, performance and
compatibility proofs.

The per-query response must carry the immutable execution definition alongside
its canonical result. The host returns the same definition it persists, and
the UI uses those captured query and figure definitions for historical menus,
references and exports. The result alone cannot establish figure identity;
the current mutable bundle is not a substitute. This handoff preserves
per-query capture and does not promise historical replay of the whole dashboard
layout. Queries may have distinct snapshots, which the UI must disclose.

## Non-negotiable implementation and test boundaries

- Preserve the accepted pinned Wasm child and parser-derived two-phase
  admission, exact original SQL/parameter/policy provenance, strict bridge
  equivalence, locked bootstrap, bounded queues/results, child-local source
  transaction and observed lifecycle. Fix demonstrated failures; no rewrite
  of a working component merely to make this plan look new.
- Keep `analytics_index_state` plus `tool_execution_facts_v1` as one active
  publication until an explicitly reviewed compatible change. Rows,
  checkpoints, version, generation and coverage publish atomically. Staging
  is paged and globally bounded/reclaimable; raw SDK events are not a second
  retained data lake. See the [publication handoff](../analytics/retained-publication-boundary.md).
- An omitted thread, unchanged timestamp, abort, auth failure or arbitrary
  404 is not deletion/completeness evidence. Exact SDK `thread_not_found`
  confirmation, observed-as-of reconciliation, retention expiry, staged
  rewrite and finite upgrade epochs need actual tests. Source cursor must
  advance over non-fact events too. No mixed projection version may be
  labeled globally upgraded; incomplete work remains visible.
- Defaults remain the accepted contract's 90-day retention and one-hour
  demand freshness, not a continuous-update SLA or a claim that all 90 days
  are complete. Failed refresh preserves good data. Passive/idle views do
  not start periodic extraction.
- UI/agent requests use host-owned saved definitions and identity admission.
  Clients cannot assert trusted SQL, rows, scope or reference context. Reuse
  public bb-identity if configured and fail explicitly on configured identity
  failure; do not invent private tenancy or patch the fork.
- Each binding calls concrete operations; expected facts/results/context are
  test-owned. Keep malformed-envelope, wrong-result, wrong-lineage, failure,
  rollback and cleanup negatives. No report-shaped adapter, `gatesComplete`,
  fake observer or self-test can qualify product behavior.

## Acceptance map and ownership

| Gap | Owning node and required evidence |
| --- | --- |
| No real retained pipeline | `retained-fact-projection`: typed public-source fixtures; beyond caps; append/rewrite/deletion/expiry; budgeted resume; crash/reopen; failed reads; upgrade isolation; no-op generations; overlapping demand/no idle work. |
| Query formal timeout | `isolated-query-service`: frozen-source bounded normal run retaining every current assertion, with timeout diagnosis if needed. |
| Missing host authority/persistence | `authoritative-execution-service`: ordinary service admission, frozen source identity, actual worker execution, immutable persisted records, shared-work identity and expiry/recovery. |
| Missing immutable references | `immutable-reference-service`: real repository/resolver, exact datum and historical context after edits/restart, scope/forgery/expiry failures and legacy behavior. |
| Old browser execution path | `execution-backed-ui`, `compose-plugin`, `complete-workflow-cutover`: actual browser/ordinary RPC, preserved UX, one shared backend, no remaining fact-download/browser-engine consumers. |
| Missing reproducible browser driver | `browser-verification-tooling`: directly pinned Analytics-owned test driver and required fixture tools, exact registry/lock provenance and package-local Chromium policy; no sibling-workspace or global-driver fallback. Tool readiness does not prove UI behavior. |
| No complete user proof | `retained-dashboard-roundtrip`, then `integrated-regression-proof`: real vertical slice first, full workflow matrix and current-source component reruns before final acceptance. |
| Partial performance instruments | `qualification-instruments` then `performance-proof`: 25k/250k/1m; 1/10/30 views; shared/distinct; 1/4 clients; 0/1/5/20/80 changed threads; cold/warm/stale; cancellation, active host baseline, idle and resource gates. |
| Packaging/migration uncertainty | `qualification-instruments` then `compatibility-proof`: actual installed child assets/version, legacy bytes and migrations, rollback/reopen, clean install and community/staging checks. |

Component Actions own their suite-specific tests and bindings. The boundary
owner alone edits shared suite registration/browser binding routing first;
later owners implement disjoint routed modules. Shared fixture/helper edits
require a bounded ownership reassignment and review of consumers. Execution
and reference stores export their own migration definitions; composition
registers them without competing writes to the retained store's migrations.

The browser-tooling prerequisite owns Analytics' manifest and community lock
before the identity dependency and later composition owners. The full UI
browser gate depends on that reproducible toolchain; already granted pure
export/component source preparation can continue within its bounded footprint,
but cannot land or verify the complete UI node while tooling is missing.
Existing jsdom evidence remains component-only. The real browser oracle must
exercise the public compiler's one-series figure and actual update decisions,
not the old synthetic two-series removal fixture. Browser setup and launch
require their own coordinated bounded execution receipt; this plan revision
does not install dependencies or launch a browser.
The cutover Action intentionally follows earlier app/server owners. Performance
and compatibility instrument work has separate files from workflow work.

`host-execution` and `vertical-slice` are new suites to implement and register,
not existing tests. Existing extraction/browser/qualification bindings also
need implementation. All Mechanical commands are acceptance targets; checking
this Pkl file does not run them or imply that they pass.

## Safe execution and failure policy

Use one coordinated heavy-test lane, even when source work has disjoint owners.
No affected source edits during a frozen evidence run. Capture full source
hashes, command, mode, outcome, closed failure stage and confirmed cleanup.
Inspect disk and competing workload first; do not kill unrelated work or clear
shared caches. Keep the user's dirty workspace and operator runtime state.

The query suite's existing cap is 120 seconds, with a 300-second runner total.
A timeout is nonpassing, not evidence of a specific product defect or automatic
permission to raise limits. Localize before another run; do not repeat until
green. Aggregate integration/performance work that cannot fit the current
total must be split into reviewed, independently supervised named cases before
running, with all cases required by the oracle. Do not silently reduce samples
or drop workload cells. Benchmark distributions require the accepted sample
counts and policies, including warm p95 below one second. Any promised-outcome
change belongs to Cole.

Later source changes trigger affected reruns. The final graph requires an
integrated regression pass after cutover because plan fingerprints alone do not
detect arbitrary source drift. Performance fixes return to the owning Action,
invalidate affected evidence explicitly, and are followed by the relevant
integration/qualification reruns.

Tests use generated fixtures and a controlled composer sink; they never send
real external messages or read operational history without separate scope.
Clean-install proof uses disposable fixtures, not a second deployment.
Publication, commits/pushes, normal-host promotion, new fork/SDK APIs and
unrelated cleanup remain outside this plan's execution grant.

## Running the plan

From `/home/ubuntu/bb`:

```sh
workbench plan recall plans/analytics-delivery.plan.pkl
workbench plan check plans/analytics-delivery.plan.pkl
workbench plan tick plans/analytics-delivery.plan.pkl
```

Begin with `carry-forward-review`; it is a real read-only review, not a new
feasibility project. Use `land`, named `verify`, and actual reviewer judgments
as work completes. Do not copy old evidence as new passing records. A scoped
assignment is not active until acknowledged. When execution is requested,
continue BB message-passing coordination under the existing workspace rules.

Completion requires the normal integrated workflow, all mandatory evidence,
and a final review accounting for both ledgers. No percentage derived from
node counts substitutes for that outcome.
