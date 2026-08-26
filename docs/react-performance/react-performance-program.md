# BB React performance program

Status: Reviewed execution program; product implementation gated by E0/A0
Scope: BB host UI and organization plugins
Primary evidence: React Scan 0.5.7 production and isolated-fixture captures, August 26, 2026

## Executive summary

BB has two distinct React performance problems, not one general render loop:

1. The custom Thread Progress sidebar creates continuous idle work. A top-level
   one-second clock causes roughly 19,400 render records and 11,600 committed
   updates per tick with 200 mounted rows.
2. BB core is quiet after navigation settles, but opening a populated thread
   creates a large one-time cascade: 4,591 render records across 2,039 unique
   fibers and 29 commits in the representative 872-event fixture.

The evidence does not support blaming every custom plugin. Home, Settings,
Notifications, and a populated thread all produced zero React
renders during settled observation windows when Thread Progress was absent.
Opening the Notifications and Background Work plugin panels was comparatively
small.

The work should proceed in parallel tracks with narrow ownership:

- Track A: fine-grained Thread Progress temporal reactivity.
- Track B: Thread Progress data structures and host sidebar SDK fan-out.
- Track C: populated-thread message action and overlay architecture.
- Track D: app-shell parent-cascade containment.
- Track E: reproducible measurement and final integration.

Tracks A-D may develop independently against frozen fixtures and budgets.
Track E owns the final combined correctness, accessibility, typecheck, test,
build, and React Scan gates.

## Goals

- Eliminate continuous full-tree React work while BB is idle.
- Reduce populated-thread navigation work without changing visible behavior.
- Keep plugin APIs safe and general rather than adding a Thread Progress-only
  shortcut.
- Preserve keyboard, pointer, drag-and-drop, split-pane, menu, tooltip, dialog,
  accessibility, and compact-viewport behavior.
- Establish repeatable performance budgets that can detect regressions after
  the individual branches are integrated.

## Non-goals

- Rewriting BB's state management globally.
- Replacing React Query, Jotai, or the plugin SDK wholesale.
- Treating React Scan collector time as native React commit duration.
- Optimizing every small render before the measured dominant cascades.
- Combining all implementation work in one branch before each track has an
  independently measured result.

## Evidence and measurement limits

### Evidence index and audit status

The measurements below are reported results from the two original BB child
investigations, not a committed benchmark corpus:

| Investigation | BB thread | What is retained | Audit status |
| --- | --- | --- | --- |
| Thread Progress interactions | `thr_8mt7ahvkpy` | Final report, source correlations, fixture dimensions, and aggregate render/commit counts | Raw React Scan export, manifest, fixture hash, browser build, and script were not retained in parent storage |
| Idle/navigation controls | `thr_u5t7eret7d` | Final report, source correlations, fixture description, aggregate render/commit/mutation counts | Raw React Scan export, manifest, fixture hash, browser build, and script were not retained in parent storage |

The historical numbers are strong enough to prioritize reproduction, not to
serve as an auditable acceptance baseline. **E0 must reproduce each claimed
control/hotspot and archive the raw export, run manifest, fixture/database hash,
browser build, exact scenario script, row/action/provider counters, and result
summary before any product track can claim a win.** Missing evidence or a
profiling preflight failure invalidates a run. Until that happens, exact totals
in this document are labeled reported historical measurements.

### Reported production Thread Progress capture

At 1440×1000, the live packaged BB page mounted 200 Thread Progress rows, 27
groups, and two sections. Four steady-state clock commits in 3.4 seconds each
produced 19,388 render records and 11,583 records marked `didCommit`, for 77,552
render records total. Stable repeats remained near 19,373/11,564 per tick.

Adding six rows changed repeated provider counts by exact row multiples:

| Component family | Increase | Per added row |
| --- | ---: | ---: |
| Dialog | 30 | 5 |
| MenuProvider | 24 | 4 |
| Popper | 18 | 3 |
| Presence | 78 | 13 |

Interaction controls showed that the display popover itself was small (77
render records), while changing a row-wide display policy triggered a full
roughly 19,400-record cascade. Opening the host right panel required only 231
non-clock render records; opening Background Work required 362. The unrelated
Thread Progress clock then added another full commit.

### Reported isolated navigation capture

A production bundle under Node 22.22 used an isolated temporary database with
a copied 872-event thread and the current Notifications plugin.

| Navigation | Render records | Unique fibers | Commits | React Scan callback time |
| --- | ---: | ---: | ---: | ---: |
| Home → Notifications | 558 | 409 | 12 | 10.8 ms |
| Notifications → Home | 859 | 542 | 8 | 18.0 ms |
| Home → populated thread | 4,591 | 2,039 | 29 | 105.3 ms |
| Thread → Settings | 418 | 301 | 8 | 8.8 ms |

The populated-thread transition's two largest consecutive commits produced
1,644 and 1,082 render callbacks before the next DOM mutation delivery. The
dominant named families were Popper, PopperProvider, Presence,
TooltipProvider, Tooltip, TooltipPortal, MenuProvider, and DropdownMenu.

### Reported quiet controls

| Settled surface | Observation | React renders | Commits |
| --- | ---: | ---: | ---: |
| Home | 32.01 s | 0 | 0 |
| Notifications panel | 34.97 s | 0 | 0 |
| Populated thread | 35.24 s | 0 | 0 |
| Settings | 16.01 s | 0 | 0 |

Notifications' 15-second poll executed without causing a React render. These
controls establish that continuous idle rendering is specific to mounted
Thread Progress behavior rather than a general BB host loop.

### Instrumentation caveats

- React Scan was attached before React, as required.
- The production React 19.2.4 renderer reported profiling hooks unavailable,
  so `actualDuration`, source locations, and the unnecessary-render classifier
  were unavailable. `unnecessary: null` must not be read as false.
- React Scan callback spans and browser long tasks include instrumentation
  overhead. They are useful for relative severity, not production latency.
- Render counts, commit counts, cadence, DOM mutation controls, and scaling
  with row count are the primary evidence.

## Root-cause map

### Thread Progress clock propagation

- `ProgressInbox` owns a top-level `now` state and updates it every 1,000 ms:
  `/home/ubuntu/bb/plugins/plugins/thread-progress/components/progress-inbox.tsx:434`.
- `now` invalidates section derivation around line 652.
- It flows through the row environment and is consumed by every row's recency,
  curtain, feature-opacity, and status calculations around lines 1842-1880.
- Plugin bundles are built with esbuild's JSX transform, not BB's React
  Compiler pipeline, so compiler-generated bailouts do not contain this tree.

### Sidebar SDK and collection amplification

- Every row calls `useSidebarThreadActions()` and
  `useSidebarThreadSplit()`.
- Both paths derive a full thread-ID map through
  `/home/ubuntu/bb/fork/build/bb/apps/app/src/lib/plugin-sidebar-hooks.ts:133`.
- With 200 mounted rows and 393 visible unarchived threads, a sidebar-data
  update can perform roughly 157,000 duplicate `Map.set` operations before
  ordinary rendering.
- `followingSiblingIds` is built from suffix slices. An ungrouped 200-row pass
  allocates 19,900 IDs; 393 rows would allocate 77,028.

### Populated-thread overlay-multiplication hypothesis

- Desktop message actions create tooltip infrastructure per action near
  `/home/ubuntu/bb/fork/build/bb/apps/app/src/components/thread/timeline/MessageActionBar.tsx:376`.
- Each action bar also creates a TooltipProvider and up to two dropdown trees
  near line 719.
- The repeated provider families and source shape make per-message action bars
  the leading hypothesis. Aggregate family counts do not prove which action
  bars caused the largest commits; C0 must add per-surface counters and commit
  attribution before restructuring.

### App-shell parent-cascade hypothesis

The development investigation reported route-independent wrappers rendering
without their own described change, including AppRoutes, AppCommandProvider,
AppNavigationUrlHost, AppFileExternalNavigationHost, and SidebarStateBridge.
The raw render-reason export was not retained. Treat this as a hypothesis until
E0/C4 archives commit attribution; it is secondary to the two reported
hotspots.

## Reactivity tool decision

The fine-grained implementation must use a reactivity tool. The candidates are
TanStack Store and `@effect-atom/atom-react`.

The selected tool must satisfy all of the following:

- A row or temporal leaf never subscribes to raw `nowMs` if its rendered
  presentation has not changed.
- Derived subscriptions return stable primitives or structurally stable
  values with explicit equality.
- Section expiration is scheduled at the next meaningful deadline rather than
  reevaluated every second.
- Work stops, or becomes negligible, when the document is hidden and when no
  temporal consumers are mounted.
- Per-thread reactive state has bounded lifetime and deterministic cleanup.
- A selected plugin dependency is declared in
  `plugins/tools/workspaces-sync/definition.ts` and generated with
  `bun run sync:fix`; it must not rely on a transitive lock entry.
- A representative 200-row prototype meets the same React Scan budget before
  the tool decision is ratified.

### Decision matrix

| Criterion | TanStack Store | `effect-atom` | Program decision |
| --- | --- | --- | --- |
| Synchronous keyed selectors | `@tanstack/store` plus `@tanstack/react-store` provide a small store/selector boundary | Derived atoms and `Atom.family` provide equivalent fine-grained addressing | Both can prevent unrelated-row updates if selectors expose presentation rather than time |
| Lifecycle | Requires a small subscriber-aware scheduler adapter with explicit keyed eviction | Atom disposal and scoped finalizers model cleanup directly | effect-atom has the richer primitive; either still needs deadline semantics |
| Current workspace compatibility | Version 0.11.1 is already present transitively and supports React 19, but must be declared directly | `@effect-atom/atom-react@0.7.0` peers on Effect `^3.22.1`; the plugin workspace currently resolves Effect `4.0.0-rc.108` | TanStack has the lower integration risk today |
| Scheduling fit | One min-heap and one timeout are sufficient | Effect/Stream scheduling is powerful but unnecessary here | A one-second stream would reproduce the original bug in another abstraction |
| Team familiarity | Not established by repository evidence | BB's team uses effect-atom in other products | Favors effect-atom operationally, but does not erase the current version-line mismatch |
| Bundle impact | Smaller starting dependency surface; production delta still must be measured | Larger package/runtime surface before tree shaking; production delta still must be measured | Decide from the built bundle, not unpacked package sizes |

**Decision status:** undecided; TanStack Store 0.11.x is the leading candidate
for Thread Progress, conditional on A0. The evaluated
`@effect-atom/atom-react@0.7.0` candidate's Effect 3 peer range creates a
duplicate/version-line risk beside the workspace's Effect 4 release candidate,
but it is not a build-failure verdict. A0 must resolve exact peers, build both
candidates where feasible, and measure their production closure. Reconsider
effect-atom first if it can resolve one supported Effect line or if this state
graph genuinely needs Effect services/streams.

The prototype is a hard gate. The selected library must own snapshot storage,
equality, batching, and React notification. A small scheduler resource manager
may own deadlines, keyed lifetime, and first/last-consumer bookkeeping, but it
may not maintain an independent value graph or listener fan-out: publications
must flow through the selected library. If TanStack cannot provide deterministic
cleanup within that boundary, select effect-atom or record an explicit ADR that
relaxes the boundary. Both candidates are rejected if they publish raw time or
a global ticking version.

## Parallel work tracks

### Track A — Fine-grained temporal reactivity

Owner boundary: `plugins/plugins/thread-progress` temporal presentation and
its direct dependency declaration.

Primary outcome: no full sidebar commit on the one-second cadence.

Implementation packages:

- **A0 — Tool ratification:** build equivalent 200-row TanStack Store and
  effect-atom prototypes; record correctness, renders, cleanup, compressed
  bundle delta, and dependency compatibility. Ratify TanStack only after it
  passes.
- **A1 — Pure snapshots/deadlines:** extract pure calculators returning stable
  `RowTemporalPresentation` plus `nextDeadlineMs`; fake-clock test every timer,
  curtain, recency, opacity, accessible-name, and title boundary. Before
  bucketing exact-second timer descriptions, obtain an explicit reviewed
  product/accessibility decision. Otherwise preserve them as a narrow temporal
  leaf and include their per-second deadline in the budget.
- **A2 — Scheduler and leaf subscriptions:** one min-heap, one timeout, keyed
subscriber-aware sources, page-visibility pause/resume, deterministic
  disposal, and React subscriptions only in temporal leaves. Remove top-level
  `now` and the global interval.
- **A3 — Interaction containment:** move modifier state into a narrow controls
  leaf and isolate display-policy visuals from closed menus/dialogs.
- **A4 — Optional viewport/CSS work:** add viewport suspension or CSS fades
  only if A2 misses the frozen budgets and the added lifecycle complexity wins
  in measurement.

Hard architectural rule: no Store or selector may expose `nowMs`, a one-second
epoch, or a global clock version. Each source publishes a stable rendered
presentation and schedules only its next meaningful output change. Section
membership expiration is a separate keyed source scheduled at the earliest
`activityAt + recentWithinMs` deadline.

Lifecycle rule: use immediate logical disposal and a documented one-microtask
physical eviction grace to tolerate React Strict Mode unsubscribe/resubscribe.
Tests assert zero resources after that grace, not synchronously at unsubscribe.
Timer-clamping, system sleep/resume, forward/backward wall-clock jumps, and
stale heap generations are required scheduler tests.

### Track B — Sidebar data and host SDK scaling

Owner boundary: B1 is plugin-local ordering code; B2 is a BB fork host/SDK
track. B2 begins as an internal shared cache behind the existing SDK contract.
If a public member proves necessary, it must be named `experimental_`, added to
`docs/api_to_audit.md`, regenerated into SDK types, and land in the fork before
plugin consumption.

Primary outcomes:

- One shared thread-entry map per sidebar snapshot, not per hook instance.
- No quadratic suffix-array construction during render.
- Row subscriptions do not duplicate global query derivation.

Implementation packages:

- **B1:** replace per-row suffix slices with a stable list descriptor or one
  reverse-pass derivation. Construction and retained identifiers must be O(n).
- **B2:** derive one shared `threadId -> entry` map per host sidebar snapshot
  and expose stable ID-keyed actions/split access. A row update must notify only
  its keyed consumers.

### Track C — Populated-thread action architecture

Owner boundary: BB fork timeline/message action components.

Primary outcomes:

- Closed tooltips, menus, dropdowns, and portals do not multiply heavy provider
  trees per message.
- Offscreen action bars do not contribute the same mount cost as visible or
  focused messages.
- Keyboard and screen-reader affordances remain available.

Implementation packages:

- **C0 — Fixed navigation benchmark:** freeze the populated thread, viewport,
  pointer mode, plugin registrations, cache state, and action counts.
- **C1 — Provider hoist:** replace one TooltipProvider per MessageActionBar
  with one provider per timeline surface, preserving the 300 ms timing and
  multi-pane behavior.
- **C2 — Lazy closed content:** keep accessible triggers eager but realize
  tooltip/menu/popover content only as it opens, retaining it through focus
  restoration and exit animation.
- **C3 — Graduate existing windowing:** validate and stage the already
  implemented timeline windowing path for sufficiently large threads; do not
  create a second virtualizer.
- **C4 — Parent-cascade isolation:** only after C1-C3, use render-reason
  evidence to isolate proven ThreadDetail/app-shell cascades.

C1 and C2 can be developed concurrently with single ownership of their shared
integration only if C1 owns the timeline provider boundary, C2 owns a shared
lazy-overlay primitive outside the call site, and one named fork integrator
serializes the `MessageActionBar.tsx` edits. Otherwise C1 lands before C2. C3
depends on their stable per-realized-row cost. C4 deliberately follows the new
profile so it does not optimize work already removed by the earlier packages.

### Track D — App-shell cascade containment

Owner boundary: route-independent app providers and bridges.

Primary outcome: wrappers with no own change bail out during navigation.

This track begins only after Track C has a stable fixture, because shell work
must not obscure message-tree measurements.

### Fork-track durability rule

B2, C, and D share one fork patch-series owner. `fork/build/bb` is disposable
materialized output and `fork/upstream` is pinned input, not a durable edit
target. Work must follow `fork/README.md`: make the approved source change in
the fork workflow, export reviewed commits into the ordered `fork/patches/series`,
refresh patch hashes/result-tree lock, rematerialize, and run verify/namespace
gates. Material source citations and benchmarks must identify the exact
materialized result-tree SHA and downstream patch, not assume upstream and the
deployed tree are identical.

This rule also covers any E0 profiling bootstrap, build entry, or in-repository
harness change under `fork`. E0 begins with out-of-tree drivers/artifacts in
thread storage or a temporary directory. If a harness change must become
tracked fork code, it enters through the same patch-series owner and gates.

### Track E — Harness and final integration

Owner boundary: fixtures, measurement scripts, regression budgets, combined
verification, and integration order.

Track E maintains two lanes whose numbers are never mixed:

- **P, production lane:** optimized runtime without React Scan/profiling hooks;
  measures input-to-paint/navigation, long tasks/LoAF, retained heap, and
  production bundle closure.
- **R, render-attribution lane:** profiling ReactDOM plus headless React Scan
  loaded before React; asserts profiling hooks are available and records
  commits, identities, reasons, and rendered-component counts.

The harness uses an immutable copied fixture, pinned browser/viewport/DPR,
fresh run directory per sample, deterministic cache mode, a quiet-window
preflight, alternating control/candidate order, one warm-up, and seven recorded
runs. It reports median and p95 only; if three baseline sessions show more than
5% coefficient of variation or unstable p95, E0 increases the sample count
before freezing budgets. No track defines its own warm-up/sample/percentile
protocol. Raw traces and a run manifest are retained. A reconnect, fixture mismatch,
visibility change, unexpected error, or different query/plugin boot invalidates
the sample rather than being averaged away.

Two desktop cells remain distinct: `TP-200` at 1440×1000 preserves historical
sidebar comparability; `HOST-THREAD` at 1440×900 measures navigation. Chromium
is the performance gate. Firefox and Safari/iOS are mandatory C3 correctness
cells with named available test hosts before windowing graduates; their timing
numbers are not pooled with Chromium.

Fixed scenarios cover boot, list navigation, large-thread switching, realtime
append, composer/mentions, panels/plugin surfaces, and one list mutation. Track
E also owns accessibility, cleanup/leak, bundle/dependency, and canonical plugin
reload verification.

## High-level parallel checklist

### Foundation

- [ ] E0: freeze representative databases, browser revision, viewport/DPR,
      routes, pointer mode, plugins, cache state, interaction scripts, React
      Scan version, and result schema.
- [ ] E0: implement P and R preflights, invalid-sample rules, raw artifact
      retention, and harness self-tests.
- [ ] E0: record three clean baseline sessions from the exact materialized
      runtime; freeze reviewed budgets before testing candidates.
- [ ] A0: decide TanStack Store versus effect-atom using the same typed 200-row
      prototype, exact peer resolution, dependency/license/build report, and
      bundle measurement.

E0 reproduction is read-only/out-of-tree at this stage. A0 prototypes use
isolated temporary manifests/build inputs and must not edit, reset, regenerate,
or otherwise contaminate the currently authored dirty
`plugins/package.json`, `plugins/bun.lock`, or
`plugins/tools/workspaces-sync/definition.ts`. A selected dependency and
generated workspace change may land only after the E0 artifacts and A0 ADR are
reviewed and file ownership is coordinated.

### Parallel implementation

- [ ] Track A: isolate temporal reactivity and eliminate the idle cascade.
- [ ] Track B: share host thread lookup state and remove quadratic row props.
- [ ] Track C1/C2: hoist tooltip ownership and lazily realize closed overlay
      content while keeping accessible action triggers eager.
- [ ] Track C3: validate and stage the existing timeline windowing path for
      large threads.
- [ ] Track E: build repeatable tests and preserve baseline comparability.

Only D/C4 attribution instrumentation may start in this phase. D/C4 product
changes wait for the post-C profile.

### Track-local gates

- [ ] Each track has focused correctness tests for behavior it changes.
- [ ] Before handoff, each track runs affected-package typecheck, focused tests,
      and a production build; final integration repeats the full combined set.
- [ ] Each track demonstrates an isolated before/after React Scan capture.
- [ ] Each track stays within its declared ownership boundary or documents a
      cross-track API dependency.
- [ ] Accessibility and keyboard behavior are tested for changed controls.
- [ ] Store/scheduler work proves zero retained subscribers, keyed sources,
      heap entries, observers, listeners, and timeouts after disposal.
- [ ] Overlay work tests first-open pointer/keyboard behavior, Escape/outside
      close, focus restoration, typeahead, collision handling, compact drawer,
      reduced motion, and two simultaneously mounted timelines.
- [ ] Windowing work tests bottom anchoring, prepend, search/outline targets,
      streaming height changes, images/fonts, nested rows, browser history,
      open-overlay eviction, split panes, and screen-reader/Tab semantics.

### Integration order

1. Land E0 harness mechanics and freeze the unchanged baseline.
2. Land A0's ADR plus only the selected plugin dependency and adapter skeleton;
   remove the losing prototype completely.
3. Develop A1, B1/B2, and C1/C2 in parallel. Measure each independently.
4. Land B1/B2 before A3's final row-containment gate; land C1/C2 before C3's
   windowing budget is frozen.
5. Run A2/A3 and C3 against the merged upstream tracks. Start D/C4 only from
   the resulting post-optimization attribution profile.
6. Land fork SDK/host changes before plugin consumers, regenerate SDK types,
   then perform the full combined gate on exact child commits.

### Quantitative starting budgets

These are proposed ratchets and must be validated against quiet repeated runs,
not retrofitted after seeing a candidate:

- Thread Progress: 10 seconds containing only static rows and no
  presentation/accessibility/section deadline yields zero plugin
  render callbacks/commits; one row deadline yields at most eight render records and no
  inbox/list/unrelated-row/menu/dialog render; hidden document yields no armed
  temporal timeout; a 200-row display-policy change falls from roughly 19,400
  to at most 1,000 records.
- Populated-thread C1: median targeted tooltip-provider callbacks/fibers fall
  at least 90%, with no production median or p95 regression. The former 8%
  total-record target remains a provisional expectation until E0 freezes
  provider/action counts and variance.
- C2: median closed overlay family records fall at least 60%, with first
  interaction succeeding in one input sequence and no production median or
  p95 regression. The 20% total-record target remains provisional until E0.
- C3 after C1/C2: median render records at most 2,500, distinct fibers at most 1,400,
  collector callback time at most 65 ms, two largest commits at most 1,400
  callbacks combined, and production route-content/interaction-ready p95 at
  least 15% better.
- General production lane: a candidate fails when both the relative and
  absolute tolerance are exceeded—median +5% and +8 ms, or p95 +10% and +16
  ms. Heap fails only when both `delta > 5%` and `delta > 2 MiB`. No new
  attributable task over 50 ms. Render-attribution improvements never substitute for a
  production-lane regression.

### Final integration gate

- [ ] Rebase/integrate in the documented dependency order.
- [ ] Rebuild and reload affected organization plugins from their canonical
      `/home/ubuntu/bb/plugins` source.
- [ ] Run all fork and plugin checks required by their AGENTS.md files.
- [ ] From `fork/build/bb`, run the required frozen install, Turbo-filtered
      checks while developing, then full typecheck, test, build, verification,
      namespace, and materialization checks for the integrated result.
- [ ] From `plugins`, run frozen install, `sync:check`, `references:check`,
      `sdk-types:check`, typecheck, test, and build; build/reload touched plugins
      and prove their sources resolve from the canonical workspace path.
- [ ] Run community-plugin install/test/typecheck/build only if that child is
      touched, or document why it is not applicable.
- [ ] Run `./bin/check --role staging`; record exact child SHAs. Do not advance
      workspace gitlinks until selected child commits are tested and pushed.
- [ ] Run combined production React Scan scenarios and compare budgets.
- [ ] Exercise compact and desktop layouts, split panes, menus, dialogs,
      drag-and-drop, live updates, and plugin reload.
- [ ] Confirm no new idle loop on Home, plugin panels, or populated threads.
- [ ] Preserve the final raw measurements and summarize deviations.

## Open decisions

1. TanStack Store or effect-atom for temporal presentation.
2. Whether exact-second timer accessible names/titles must be preserved or may
   move to meaningful buckets after product/accessibility review.
3. Whether temporal opacity should be discrete state, CSS animation, or a
   reactive numeric bucket.
4. B2 starts as an internal cache; whether evidence ultimately requires an
   audited experimental API adjustment.
5. Whether message actions should be lazily mounted, virtualized with timeline
   rows, or both.
6. Which performance budgets are hard CI gates versus manually reviewed QA
   evidence until the harness proves stable across machines.

## Adversarial review disposition

Child thread `thr_unvxdet8jp` initially returned **not ready to execute**. Its
seven blocking findings were incorporated as follows:

1. Added an evidence index and made raw artifacts/manifests mandatory E0
   outputs; unretained claims are labeled reported/hypothesized.
2. Removed the fork-wide store migration from execution scope; reactivity is
   plugin-local, while B2 alone owns a fork host/SDK seam.
3. Changed TanStack from selected to leading candidate and defined the allowed
   scheduler adapter boundary.
4. Added an explicit accessibility decision for exact-second timer text and
   defined disposal grace semantics.
5. Added the fork patch-series durability rule and exact result-tree citation
   requirement.
6. Made E0 the only sample/percentile protocol, separated the two historical
   viewports, and made regression predicates algebraic.
7. Removed D from initial parallel implementation, serialized shared-file
   integration, resolved B2's default API posture, and added local typecheck,
   test, and production-build handoff gates.

The program is ready to begin **E0 evidence reproduction and A0 prototyping**.
Product implementation remains blocked until those two gates produce reviewed
artifacts and an ADR. The full review is retained in
[react-performance-review.md](/home/ubuntu/bb/docs/react-performance/react-performance-review.md).

## Contribution record

- Fine-grained sidebar/reactivity: child thread `thr_yp2sqzsawd`, with the full
  architecture, tool matrix, lifecycle, and budgets in
  [react-performance-contrib-sidebar.md](/home/ubuntu/bb/docs/react-performance/react-performance-contrib-sidebar.md).
- Populated-thread architecture: child thread `thr_9ezzhsj7mh`, with detailed
  work packages, interaction risks, and budgets in
  [react-performance-contrib-thread.md](/home/ubuntu/bb/docs/react-performance/react-performance-contrib-thread.md).
- Measurement and integration: child thread `thr_8wpb5yekff`, with the P/R
  harness, fixture protocol, verification matrix, merge order, and rollback
  strategy in
  [react-performance-contrib-integration.md](/home/ubuntu/bb/docs/react-performance/react-performance-contrib-integration.md).
- Consolidation: parent thread `thr_28v2cika22`.
- Adversarial review: child thread `thr_unvxdet8jp`, with findings and original
  verdict in
  [react-performance-review.md](/home/ubuntu/bb/docs/react-performance/react-performance-review.md).
