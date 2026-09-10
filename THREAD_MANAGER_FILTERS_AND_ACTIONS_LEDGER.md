# Thread Manager Filters and Actions Ledger

This ledger records evidence, decisions, review findings, implementation
discoveries, verification results, and unresolved risks for
`THREAD_MANAGER_FILTERS_AND_ACTIONS_GOALS_AND_MASTERPLAN.md`.

## 2026-08-29 — Initial evidence

- Workspace root: `/home/ubuntu/bb`.
- Workspace branch/head: `main` at `81b55a14b31983017451994b8946c4f8bf349044`;
  dirty before this work began.
- Fork child: `main` at `8e86661c7b00504de005abffb66b46248e189f6d`;
  dirty before this work began.
- Materialized BB result HEAD:
  `fad910912ce04d25ebe0e1541e4d9a676f4cbeb7`; dirty before this work began.
- Plugins child: `main` at `200fc2b12b8c86d4f95c8b83d6b471d0b7bd1107`;
  dirty before this work began.
- Canonical installed Thread Manager source resolves to
  `path:/home/ubuntu/bb/plugins/plugins/thread-manager`.
- Thread Manager source files were clean at kickoff. Its generated SDK type
  declarations were already dirty as part of broader SDK work and must not be
  overwritten without reconciling their current source.
- Fork overlay metadata and several existing/untracked downstream patches were
  already dirty. Durable fork work must be added through the current ordered
  patch/materialization workflow without discarding or relocating those edits.

## 2026-08-29 — Root-cause evidence motivating the feature

- Thread `thr_4nngijxe5d` persisted `model_override = NULL`.
- Project `proj_kqnuxsd366` persisted default model `claude-fable-5`.
- The live provider process was launched with `--model claude-fable-5`.
- The native existing-thread picker changed component-local state but did not
  call the server's sticky execution update route.
- The plugin SDK already exposes single-thread `threads.update` fields for
  `model` and `reasoningLevel`, so a plugin can bypass that frontend omission.
- Thread list/facet rows expose `providerId` but not effective model/reasoning.
- Per-thread `defaultExecutionOptions` reads and per-thread updates would create
  unacceptable N+1 behavior.
- Live server logs also showed substantial plugin RPC fan-out and event-loop
  stalls, making fixed-call-count batch design a product requirement rather
  than a speculative optimization.

## 2026-08-29 — Initial architecture decisions

1. Preserve Thread Manager's bounded authoritative dashboard and client-owned
   presentation filters.
2. Add execution state only through an opt-in experimental public contract.
3. Resolve execution state in database/service batches without host discovery.
4. Load target catalogs lazily and deduplicate by provider/host route.
5. Add a true batch execution mutation; do not ship concurrency-limited
   per-thread SDK calls as the final architecture.
6. Use stale-snapshot witnesses to avoid overwriting changes made after review.
7. Keep `Keep`, `Clear override (use next-turn fallback)`, and explicit values
   distinct.
8. Keep the UI to one combined execution column and one shared lazy dialog.
9. Emit one plugin/dashboard invalidation per completed batch.
10. Treat active-thread changes as next-turn configuration only.

## Reviews

- Three independent plan reviews ran with Codex Luna at extra-high reasoning:
  product/completeness, backend/SDK/performance, and React/UI/accessibility.
- Accepted findings were incorporated into the plan: atomic CAS apply; complete
  per-field witnesses; server preflight before exact claims; corrected
  clear-override semantics; model-change reasoning reconciliation;
  provenance/route-aware outcomes; 5,000 hard boundary; canonical cross-client
  notification; unresolved states; discriminated results; catalogs outside
  transactions; verified/retired catalogs; retained selection; child-boundary
  dialog state; compact responsive behavior; CLI/native-picker parity; and
  expanded verification.
- The backend review proved the documented three-day window is currently
  applied only after all facet pages are fetched. Accepted: a server-owned
  attention cutoff plus index/query-plan verification is now a prerequisite.
- The absolute no-N+1 statement was narrowed to new execution paths. Existing
  participant/error-history and legacy-action fan-out remain baseline debt;
  refactoring every existing action is not required for this feature.
- Durable operation-result storage solely for response-loss idempotency was not
  adopted. Apply writes desired final states conditionally; after an unknown
  response the client refetches instead of blindly replaying.
- Full virtualization of the mapping tree was not adopted. The UI instead
  enforces 250 source-group and 100 route caps alongside the 5,000-thread write
  cap, and expands per-thread patches only when Review is requested. Larger
  heterogeneous selections remain retained and must be narrowed.

## Implementation discoveries

- Existing-thread model precedence is exactly: explicit request (not applicable
  to the dashboard) → thread model override → latest recorded execution model
  → matching-provider project default → missing-model failure.
- Existing-thread reasoning precedence is: explicit request → thread reasoning
  override → latest recorded execution reasoning → matching-provider project
  default → `DEFAULT_REASONING_LEVEL`.
- The dashboard summary can therefore resolve model/reasoning entirely from the
  database and provider registry. It must not call host discovery or the full
  permission-ceiling execution planner.
- Provider catalog probes already use a ten-minute process memo keyed by host,
  daemon session, provider registration revision, and the provider-list command.
  Non-workspace-scoped providers deliberately omit cwd so environments on one
  host share the memo. Workspace-dependent providers include cwd and remain
  distinct. The bulk path should reuse this facility rather than inventing a
  plugin cache with weaker invalidation semantics.
- Thread facet pages are capped at 100 rows and already hydrate their ordered
  IDs as a batch. Opt-in execution projection belongs at that hydration seam.
- Facet cursor digests must include the opt-in execution projection flag so a
  cursor cannot be replayed against a response shape with different requested
  semantics.
- `setThreadExecutionOverride` currently updates `threads.updated_at` but emits
  no realtime notification because no client surface rendered overrides when
  it was introduced. This feature needs an aggregate post-batch notification,
  not one notification per row.

## Verification log

- Focused fork typechecks are green for `@bb/db`, `@bb/domain`,
  `@bb/server-contract`, `@bb/sdk`, `@bb/server`, `@bb/app`, and `@bb/cli` at
  the current milestone.
- Focused service tests: execution facet + two-phase batch, 10/10 green.
- Database tests: thread facets 10/10; thread execution persistence/set-based
  batching in the broader thread suite; malformed legacy event lookup in the
  broader event suite.
- Native picker tests: `ThreadDetailPromptArea` and keystrokes, 31/31 green.
- Realtime tests: hub aggregate delivery 26/26 and app cache effects 62/62.
- CLI tests: update/facet output 16/16 and experimental batch commands 2/2.
- Server-contract batch boundary/duplicate tests 2/2.
- Thread Manager leaf typecheck is green; plugin suite is 44/44 after adding
  source-group precedence, cross-route model intersection, and reasoning-
  capability intersection coverage.
- `bb-app` and its dependency build graph completed successfully after the
  public SDK changes. Thread Manager's generated SDK declaration was refreshed
  through the canonical type generator, not hand-edited.
- Full plugin install/sync/reference/SDK/typecheck/test/build gates are green.
  The fork's full typecheck and build are green; the full test run's only
  remaining failure is the pre-existing provider-corpus timeline performance
  threshold under concurrent load. Durable materialization, runtime exercise,
  and final independent audit are tracked below.

## 2026-08-29 — Contract milestone review and disposition

- An independent Codex Luna extra-high review found the first bulk-apply cut
  still issued one UPDATE and one realtime list broadcast per changed thread,
  used provider-wide execution discovery, omitted host/workspace/catalog
  identity from its token, and exposed no transaction-failure result. These
  were accepted as release blockers.
- The reviewer observed a missing app realtime registry entry in its snapshot.
  That entry had already landed by review return; current app typecheck and
  aggregate-cache tests are green.
- Duplicate-ID rejection was also already present at the contract boundary;
  explicit duplicate and 5,000/5,001 tests were added so it cannot regress.
- Apply now performs bounded 200-row `VALUES`/`UPDATE FROM` CAS batches: a
  maximum request uses at most 25 UPDATE statements inside one immediate
  transaction. A missing affected row aborts and rolls back the request.
- A dedicated monotonic execution revision now advances on execution writes,
  including same-millisecond writes. Witnesses include that revision, override
  values, environment/workspace route, latest request sequence/value, and the
  matching project-default value/revision; generic thread metadata timestamps
  are intentionally excluded.
- Catalog loading now calls the targeted provider-model resolver and is keyed
  by provider, resolved host, workspace path only when required, and provider
  registration revision. The signed token includes that route identity and a
  normalized catalog fingerprint; apply reloads/rechecks it before opening the
  transaction.
- Raw provider/daemon errors are logged server-side and reduced to stable
  client messages/codes. Apply returns final override values plus stable
  `stale`, `rejected`, or retryable `failed` outcomes. Notifications occur only
  after commit.
- Successful batches publish one bounded thread-change payload per affected
  project. The payload reaches the list subscription once and every affected
  detail subscription; app cache effects expand its IDs to exact default-
  execution query keys.
- Deleted projects are excluded at the mutation projection join. Malformed
  legacy JSON is guarded with `json_valid` before JSON path inspection.
- Native single-thread override writes now use the targeted catalog resolver,
  skip no-op writes, check affected rows, and emit the same canonical execution
  change.
- The public SDK now exposes cancellable experimental args and properly named
  response types. The API audit records projection, batch, token, limit,
  catalog, notification, and CLI stabilization questions.
- The two batch routes now reject bodies above 8 MiB before eager JSON parsing;
  item, token, and string caps continue to bound the parsed shape.

## 2026-08-29 — Thread Manager integration milestone

- The server-owned attention cutoff now bounds facet census/query work before
  hydration; both global and project-leading attention indexes were generated.
- Dashboard execution projection adds no provider calls and no per-thread
  execution query. Provider/model/reasoning filters are client-owned over the
  bounded authoritative result and share the existing TanStack row model.
- Selection snapshots remain retained when a refresh/filter temporarily omits
  a chosen row. Successful/unchanged apply results are cleared; unavailable,
  stale, rejected, and transaction-failed IDs remain selected.
- The lazy child dialog now implements the requested hierarchy: model target,
  model-wide reasoning target, then per-source-reasoning inheritance/override.
  Its pure compiler distinguishes Keep, clear, and explicit values.
- Catalog results preserve raw model ID, route provider identity, and
  selected-only status. The dialog offers only the model and reasoning-
  capability intersections supported by every route represented in a source
  group; authoritative preflight remains the final validator.
- The plugin README documents bounded reads, filter ownership, two-phase apply,
  next-turn semantics, selection retention, catalog concurrency, and aggregate
  invalidation.

## 2026-08-29 — UI/performance milestone review and disposition

- A Codex Luna extra-high review found parent updates could rebuild all visible
  table rows because the TanStack options object was recreated. Options and
  selected snapshots are now memoized, so dialog/busy/notice changes do not
  churn the table wrapper; row selection and actual table state still update it.
- The reviewer identified the 5,000-thread cap as an insufficient DOM or route
  bound. The dialog now caps source groups at 250 and catalog routes at 100,
  skips unresolved rows during route derivation, and defers per-thread patch
  compilation until the explicit Review action.
- Supported reasoning capabilities had been present in the RPC but discarded
  in the UI model. They are now preserved and intersected across every selected
  route for the chosen target model; changing a model resets now-incompatible
  reasoning rules to Keep.
- Select All now derives indeterminate state only from matching rows. The bulk
  bar separately reports total, matching, filter-hidden, and unavailable
  selections.
- Whole-catalog RPC failure now has an alert and retry action. Route loading is
  a polite live status. The dialog has a description, stable Cancel focus,
  connected-element restoration, focusable preflight status, source-specific
  control names, `100dvh` fallback sizing, and safe-area padding.
- Mounted browser/component tests are not available in this plugin's current
  Node-only harness. Pure compiler/filter tests plus canonical runtime keyboard
  and narrow-layout exercise remain required evidence; adding a shared BB DOM
  harness is follow-up infrastructure rather than a plugin-local test shim.

## 2026-08-29 — Live runtime and execution-revision hardening

- The canonical Thread Manager plugin was built, reloaded from
  `~/bb/plugins/plugins/thread-manager`, and confirmed as the resolved runtime
  source. The materialized BB server was rebuilt/restarted so the new bounded
  facet contract was active.
- A read-only query of `thr_4nngijxe5d` showed no sticky model or reasoning
  override. Its displayed Opus 5 (1M)/medium values came from the last turn,
  confirming why the old frontend-only selection could later appear to revert
  to Fable. No bulk apply was performed against the live thread.
- That probe found a false-stale edge: the first preflight witness used the
  thread's generic `updated_at`, and opening/reading a thread advances that
  metadata clock. The schema now has an `execution_revision` defaulting to
  zero; only sticky execution writers advance it, and both witness construction
  and set-based CAS use it.
- Regression coverage captures a revision, updates `lastReadAt`, and proves the
  original revision still preflights/applies. Separate coverage proves true
  execution changes still stale an apply and same-millisecond writes advance
  the revision monotonically.
- The feature migrations now handle the facet migration behind a branch-local
  high-water mark, and migration rewind fixtures remove the later attention
  indexes/execution-revision column before replay. The full database suite is
  439/439 green; focused batch/facet service coverage is 10/10 green; DB,
  domain, server-contract, server, and app typechecks are green.
- The durable feature commit is `334532041` and the refreshed mail patch is
  `0038-feat-threads-add-bounded-execution-reassignment.patch` with SHA-256
  `473ef3957c45f557eee9d6cb7cebb412ee75a63349449f20d64ec595f3060e91`.
  All 38 checksums pass and a clean queue materialization produced result tree
  `44596fd2859fcc30bb6eef2a18957f3351a2b7e4`.
- On that exact disposable tree, frozen install, DB/server/app typechecks,
  125 focused migration/thread/query-plan tests, 10 execution/facet service
  tests, and the full 12-target build all pass. The staging workspace contract
  also passes with expected warnings for visible authored fork/plugin changes.
- A subsequent exact-tree monorepo typecheck reached an unrelated pre-existing
  Recovery overlay mismatch: `packages/bb-app/src/public-sdk.ts` does not yet
  implement the `recovery` member required by `BbSdk`. The feature-relevant
  DB/domain/server-contract/server/app/CLI/SDK checks remain green; the dirty
  staging tree contains separate Recovery work that masks this durable-queue
  gap, so it is recorded rather than folded into Thread Manager patch 0038.
- `scripts/verify` reaches the existing Recovery mobile whitespace witness and
  stops on `apps/recovery-mobile/app/dev/diff.tsx:48-49`; this predates and is
  unrelated to the execution patch.
- Query-plan assertions confirm the bounded global and project census uses
  `threads_attention_idx` and `threads_project_attention_idx`. A 5,000-thread,
  250-source-group compiler benchmark averaged 1.658 ms for grouping and
  1.939 ms for patch compilation over 100 runs.
- The post-build staging restart also exposed a separate ambient-load problem:
  the live server reached roughly 150% CPU while existing sidebar, timeline,
  terminal, provider-status, and plugin dashboard traffic reconnected. The
  database currently contains 4,539 live threads, including 445 inside the
  default three-day attention window. Health and follow-up read-only facet
  probes timed out under that backlog. Logs did not show per-thread provider
  work from the new execution projection, but this run is not valid latency
  acceptance evidence; retain the exact-tree query-plan/call-count/benchmark
  artifacts and investigate the broader existing sidebar/plugin load
  separately.

## Remaining risks and follow-ups

- Confirm the cheapest exact batch query for latest recorded execution options
  against the current event indexes and representative long-running threads.
- Confirm whether mixed environments on one host can share a catalog result or
  require environment-specific routing.
- Confirm archived-thread update policy through current server behavior and
  tests.
- Decide whether the batch action is intentionally non-undoable or whether a
  reviewed inverse can be made race-safe without misleading users.
- Keep the native picker fix in scope as a separate core correctness repair;
  Thread Manager must not become the only reliable single-thread path.

## 2026-08-29 — Final-audit remediation milestone

- A Luna extra-high final requirements audit of exact materialization 6 found
  three release blockers: batch clear validated reasoning against the model
  being cleared, the plugin catalog RPC still reached provider-wide discovery,
  and the plugin rewrote raw model/nested route identity. All three are now
  repaired in the canonical working trees; a new exact-tree audit remains
  required after patch regeneration.
- Projection construction now returns the true post-clear fallback model and
  reasoning separately from the current effective override. Preflight uses
  those values for native reconciliation and returns authoritative
  `nextEffectiveModel`, `nextEffectiveReasoningLevel`, and `unchanged` fields.
  Clearing the only available model fallback is rejected rather than producing
  an execution that cannot start.
- The public provider-model API has an opt-in targeted mode requiring an
  explicit provider. It accepts an explicit workspace path for primary or
  explicit-host workspace-scoped routes, returns the existing picker envelope
  with an intentionally empty provider roster, and skips installed-provider
  discovery and health fan-out. Streamer mode applies the same custom-model
  visibility policy as the aggregate public picker.
- Thread Manager now canonicalizes catalog routes by provider, resolved host,
  and workspace path only for workspace-dependent providers. It preserves raw
  `id`, `model`, nullable `routeProviderId`, reasoning capabilities, and
  selected-only status. Duplicate active/selected-only entries normalize with
  active precedence; ambiguous duplicate persisted model strings are hidden by
  the compiler and rejected by the shared server resolver.
- Catalog fingerprints now cover raw ID, persisted model string, nested route
  provider, selected-only status, and normalized reasoning capabilities. Apply
  bypasses the ten-minute picker memo and performs a fresh same-session probe,
  so provider retirement during the five-minute token window produces
  `catalog-changed` rather than applying stale catalog authority.
- Core preflight/apply enforce a 100-unique-route ceiling independently of the
  plugin. A 101-workspace Pi regression proves all rows become
  `catalog-unavailable` and **zero** `provider.list_models` calls are issued.
  Catalog loads remain capped at four concurrent routes.
- Transaction rollback now preserves stale, missing, and already-unchanged
  classifications discovered independently of the failed write. Unknown apply
  responses invalidate the authoritative dashboard and clear the old token
  review, requiring a new preflight before retry.
- The dialog gates catalog loading on the 5,000-thread, 250-group, and 100-route
  limits; disables mapping controls while preflight/apply owns a frozen draft;
  caps reviewed detail DOM at 200 rows; distinguishes subgroup Keep from Use
  model choice; disables Apply for an all-no-op review; and exposes route
  errors through an alert/retry state. Focus trapping now excludes disabled
  controls, has a dialog fallback, and preserves a stable busy status.
- Current post-remediation focused evidence: five server suites 67/67, the
  complete SDK suite 100/100, Thread Manager 46/46, and the Thread Manager leaf
  typecheck all pass. These are working-tree milestone checks, not substitutes
  for the pending frozen materialization, generated-SDK, full build, staging,
  runtime, and final independent-audit gates.

### Updated risk disposition

- Mixed environments on a host share a catalog only when the provider declares
  that its catalog is not workspace-dependent; otherwise workspace path is part
  of the key. This is now a domain-owned policy rather than a plugin guess.
- Archived/hidden public-thread eligibility, deleted-project exclusion, and
  non-cascading execution writes are covered by the core projection/write
  contract. A final broad-suite audit will verify that evidence remains present
  in the regenerated patch.
- The action remains intentionally non-Undoable. Race-safe preflight/apply,
  exact final-state review, and retained failures are the recovery contract.
- Route-error retry currently refetches the bounded route set rather than only
  the failed route. This cannot exceed 100 routes or four concurrent probes but
  remains a possible product refinement if final runtime evidence shows that
  retrying healthy routes is material.
- The catalog transport intentionally returns one bounded batch instead of
  issuing up to 100 plugin RPCs for progressive route results. The dialog has
  an immediate aggregate loading/retry state; the response preserves per-route
  verified/error/empty outcomes, and only affected source groups are disabled.
- The provider probe followed by the database transaction has an unavoidable
  provider-side time-of-check/time-of-use interval because the daemon protocol
  exposes no catalog generation CAS. Apply minimizes it with a fresh probe and
  binds the normalized catalog fingerprint in the signed token; it never awaits
  a host while the database transaction is open.

## 2026-08-29 — Completion-candidate review remediation

- Two additional independent Codex Luna extra-high reviews audited the exact
  backend contract and the mounted/live UI evidence. Their accepted findings
  were repaired before the final gates below.
- Native clear/reasoning reconciliation now accepts a project fallback only
  when the project's provider matches the thread's provider. The durable repair
  is patch
  `0043-fix-threads-keep-native-fallback-provider-scoped.patch`, SHA-256
  `e9c21eb26b86a9ac908fe9e59df382690724bae346fa45fc69a59ab44850b461`.
- Filtered Select All no longer delegates to TanStack's unfiltered all-row
  handler. It updates exactly the filtered row IDs, retains IDs hidden by other
  filters, and can remove one filtered subset without disturbing another.
- A reasoning subgroup explicitly set to **Keep current reasoning override** is
  excluded from change detection. Verified-empty catalogs now have an explicit
  explanation and disable Review rather than looking like a loading failure.
- Unknown apply responses close the stale review, preserve the selected IDs,
  invalidate authoritative data, and require a new preflight. Caller-generated
  mutation IDs suppress only the caller's own realtime echo, avoiding a second
  refetch while retaining cross-client invalidation.
- Catalog query data uses a ten-minute bounded cache for repeated editing, but
  apply always performs a fresh targeted provider probe before honoring a token.
- Catalog failures now disable only source groups that depend on the failed or
  empty route. A healthy group can still compile and preflight while the failed
  group remains Keep; a mounted two-route regression proves the outgoing patch
  contains only the healthy thread.
- Completion removes only selected IDs that Apply explicitly reports as
  `applied` or `unchanged`. Route-blocked and Keep groups, preflight problems,
  stale/failed results, and IDs omitted by a malformed partial response all
  remain selected. The mounted mixed-route regression now completes Apply and
  proves the blocked thread remains in `failedThreadIds` after the healthy
  thread succeeds.
- An unknown Apply response invalidates the one-use review, retains the full
  selection, closes the stale dialog, invalidates the authoritative dashboard,
  and posts a persistent manager-level alert stating that the mutation may
  have committed and requires a fresh review. A mounted response-loss
  regression proves the warning contract and review invalidation.
- The Review screen explicitly counts selected threads excluded because their
  mapping is Keep or unavailable and states that they remain selected, so
  route/catalog exclusions remain visible at the final decision point.
- The plugin now has a mounted JSDOM/React harness in addition to its pure Node
  suite. It covers frozen preflight state, the 200-row reviewed-detail DOM cap,
  subgroup Keep, verified-empty catalogs, dialog naming/descriptions, keyboard
  focus trapping, Escape, and connected focus restoration.
- Initial table pagination now mounts at most 100 rows instead of 1,000. Users
  may still choose 100, 250, 500, or 1,000 rows, and Select All continues to act
  on the complete filtered row model rather than only the mounted page. This
  bounds initial DOM without narrowing the requested bulk operation.

## 2026-08-29 — Final durable fork and runtime evidence

- All 44 entries in `patches/sha256` pass. A fresh reconstruction at
  `/tmp/bb-thread-manager-final.obrEQX/bb` applied the complete queue and
  produced Git tree
  `4f73ff3d3ae4d8c729ed079b68981c0b8780f36f`, exactly matching
  `result-tree.lock`.
- The final additive test patch is
  `0044-test-threads-cover-execution-contract-boundaries.patch`, SHA-256
  `b4df7287a321ad0d714561624f24b8c3385e9d0abb5737f927a6ea6f45e1754b`.
  It makes the targeted execution-query optionals explicit and pins request
  cardinality at zero rejected, one accepted, 5,000 accepted, and 5,001
  rejected. The complete `@bb/server-contract` suite is 9 files and 65/65
  tests green; both changed test files are byte-identical between the locked
  fresh reconstruction and canonical `fork/build/bb`.
- On the canonical materialized fork, the seven affected package typechecks
  (`@bb/db`, `@bb/domain`, `@bb/server-contract`, `@bb/sdk`, `@bb/server`,
  `@bb/app`, and `@bb/cli`) completed as 10/10 successful Turbo tasks. The
  production build completed as 12/12 successful tasks.
- The final focused fork run is green: five server suites 68/68, the complete
  public SDK suite 100/100, and the two native picker suites 31/31.
- `./scripts/verify` passes its namespace witness and then stops on the existing
  space-before-tab fixture at
  `apps/recovery-mobile/app/dev/diff.tsx:48-49`, introduced by the independent
  Recovery patch 0034. This is not in the Thread Manager patches; it is recorded
  instead of being silently repaired or attributed to this feature.
- `./bin/check --role staging` passes, reporting only the expected visible
  authored fork/plugin changes.
- The canonical BB service was rebuilt and restarted from
  `/home/ubuntu/bb/fork/build/bb`. Thread Manager was built and reloaded from
  `/home/ubuntu/bb/plugins/plugins/thread-manager`; `bb plugin source` reports
  both requested and resolved source as that exact path.
- A safe production two-phase apply used a thread whose persisted override was
  already `claude-sonnet-5`. Preflight returned `ready` with
  `unchanged: true`; apply returned `status: unchanged`; a read-only database
  check confirmed model `claude-sonnet-5`, reasoning `NULL`, and execution
  revision `0` remained unchanged. This exercises the real apply route without
  changing user state.

## 2026-08-29 — Final plugin gates

- `bun install --frozen-lockfile` completed with no dependency changes.
- Every exact plugin repository handoff command passes on the final source:
  `sync:check`, `references:check`, `sdk-types:check`, `typecheck`, `test`, and
  `build`.
- Thread Manager's leaf evidence is 48/48 pure Node tests plus 5/5 mounted React
  tests (53 total), followed by a clean leaf typecheck and plugin build.
- Generated package manifests, TypeScript project settings, SDK declarations,
  and the Bun lockfile are synchronized through their owning generators. The
  JSDOM/Bun test dependencies belong only to Thread Manager plus the shared root
  catalog; no accidental dependency changes remain in Chronoscope or
  Perspectives.
- Scoped `git diff --check` passes for the feature's fork, plugin, generated,
  and documentation files. Unrelated pre-existing authored work remains
  visible and untouched.

## 2026-08-29 — Fixed-scale performance evidence

The deterministic Node 22.21.1/Linux x64 fixture measured the same pure
filtering, selection-ledger, source-grouping, and patch-compilation functions
used by the UI. Each smaller fixture used 250 measured iterations and the
5,000-row fixture used 100, after 20 warmups. Values below are p95 milliseconds:

| Threads | Filter | Select All | Group | Compile | Retained heap |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 0 | 0.002 | 0.002 | 0.002 | 0.001 | 24,688 B |
| 100 | 0.015 | 0.004 | 0.105 | 0.087 | 172,264 B |
| 1,000 | 0.020 | 0.009 | 0.479 | 0.624 | 618,536 B |
| 5,000 | 0.093 | 0.036 | 2.679 | 3.489 | 2,905,784 B |

- The 5,000-row fixture produced 20 source groups and 5,000 patches. The
  mapping UI independently refuses more than 250 source groups or 100 routes,
  while the core contract rejects 5,001 targets and a 101-route request before
  issuing any provider calls.
- Database apply uses at most 25 set-based UPDATE statements for 5,000 rows;
  catalogs use at most 100 unique targeted routes with four concurrent probes;
  dashboard execution projection performs no provider calls. These counts are
  enforced by server/DB tests rather than inferred from elapsed time.
- Raw fixture JSON was captured at
  `/tmp/thread-manager-performance-fixtures.json`, SHA-256
  `15537bff505c2d7d54ecbc6dd514ea9a1869acf76eead1533fd25a749961155d`.

## 2026-08-29 — Final live browser and accessibility evidence

- Playwright 1.55 / Chromium 140 (build 1187), headless, visible document,
  device scale factor 1, 1440×900, dark scheme, and reduced motion loaded the
  canonical route on a cold page. The authoritative (non-provisional) dashboard
  became ready in 1.490 seconds with 377 current rows while mounting only the
  default 100-row page.
- The authoritative filters listed two providers, nine concrete models, zero
  unresolved models, four reasoning levels, and zero unresolved reasoning
  values. Counts are live and may change as threads start/finish.
- Filtering to Claude selected exactly all 90 matches. Filtering to Codex and
  selecting all retained those 90 as hidden and selected all 287 Codex matches,
  for 377 total. Returning to Claude and unchecking removed exactly those 90;
  the bulk bar retained 287 hidden Codex selections. Only 100 Codex rows were
  mounted, proving Select All was not page-limited.
- Live model filtering produced exactly 75 Fable matches and every rendered
  Execution cell matched; live reasoning filtering produced 124 high-reasoning
  matches while mounting the first 100, and every rendered cell matched.
- In this run provider filters completed in 294–546 ms, model/reasoning filters
  in 117–243 ms, Select All in 88–206 ms, dialog open in 135 ms, warm targeted
  catalogs in 8 ms, one mapping edit in 33 ms, and a 102-thread server
  preflight in 68 ms. The exact preflight
  reported every approved item already matched, kept Apply disabled as
  **No changes to apply**, and made no write.
- The full host page recorded 20 long tasks with a maximum of 149 ms and 116
  MB used JS heap after the interactions. Those numbers include the complete BB
  shell, sidebar, inspector, avatar loading, and ambient realtime traffic; the
  fixed pure-function and server call-count lanes above are the attribution
  evidence for this feature.
- The desktop dialog had an accessible name and description, `aria-modal=true`,
  stable Cancel focus, Shift-Tab wrapping, Escape close, and focus restoration
  to the invoker. The narrow audit started at 390×844 with 200% text, reduced
  motion, coarse pointer, light color scheme, and an injected custom semantic
  palette. The dialog was 350 px wide, body scroll width remained 390 px, and
  computed foreground/background matched the custom tokens.
- Twelve console errors were inspected: failed auxiliary loopback resources and
  Google-avatar CORS from using the raw `127.0.0.1` origin. None originated in
  Thread Manager's filter, catalog, preflight, or dialog code.
- Raw audit JSON is `/tmp/thread-manager-live-audit-final.json`, SHA-256
  `798b1bbab7e5e179585ab8e244c5a5ed07929e8f9ce9ee558e645b731def6734`.
  Desktop mapping, reviewed-result, and narrow/custom-palette screenshots have
  SHA-256 values
  `7010baea6b8c1364cc5f4165ddee6e28771863a3f5725db700098379c1683f22`,
  `155d8eec182c4b94a572f7e95e86335eb70016adacc1235f9317accd07051d14`,
  and
  `66c8207e119d6109dd2d808ba4bd6086cf5d013db00e905d797a6872c994383e`.

## Completion-candidate requirement disposition

1. Provider/model/reasoning discovery and filtering: proven by authoritative
   projection tests, plugin filter tests, and the live option/count audit.
2. Filtered selection with retained hidden subsets: proven by pure regression,
   mounted-page behavior, and the live cross-provider sequence.
3. Grouped model plus model-wide/subgroup reasoning mapping: proven by compiler
   tests, mounted dialog tests, and the live grouped Codex dialog.
4. Safe bulk reassignment: proven by bounded two-phase core tests, stale/token/
   rollback/notification coverage, CLI parity, and a production unchanged
   apply.
5. Performance: proven structurally by bounded dashboard/route/group/DOM/write
   limits and empirically by fixed 0/100/1,000/5,000 fixtures plus the live
   browser lane.
6. Accessibility/responsiveness: proven by mounted keyboard tests and the live
   dark, reduced-motion, narrow, 200%-text, light/custom-palette exercise.
7. Durability/deployment: proven by all patch hashes, exact locked-tree
   materialization, builds, canonical service/plugin reload, source resolution,
   and the staging contract.
8. Independent review: architecture, backend, UI/performance, contract
   milestone, completion UI evidence, and final-requirements reviews were all
   performed by separate Luna extra-high contexts. The final reviewer found two
   selection/response-loss blockers; both were repaired with mounted
   regressions, and its recertification reported no remaining Thread Manager
   release blocker. Every accepted finding is disposed above.
