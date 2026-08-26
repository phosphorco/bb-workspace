# Thread Progress: fine-grained temporal reactivity and sidebar scaling

Status: proposal based on the August 26, 2026 React Scan capture and a
read-only source/dependency inspection. No repository files were changed.

**Post-review decision correction:** this contribution recommends TanStack,
but the authoritative program records it only as the leading candidate until
A0 resolves exact peers, builds the candidates, and proves cleanup/publication
through the allowed adapter boundary. The evaluated effect-atom 0.7.0 peer
range is a version-line risk, not a demonstrated build failure. Exact-second
timer accessible names/titles may not be bucketed without a reviewed product
and accessibility decision.

## Outcome and recommendation

Use **TanStack Store 0.11.x** for this problem, with direct
`@tanstack/store` and `@tanstack/react-store` dependencies. Keep wall-clock
time inside a subscriber-aware deadline scheduler; expose only stable,
rendered presentation values through `useSelector`. **A selector for raw
`now`, `nowMs`, a one-second epoch, or a global clock version is forbidden.**

`effect-atom` is a capable alternative and the team's familiarity with it is
valuable, but its Effect/Stream/runtime/finalizer machinery is not justified
for this synchronous presentation clock. More importantly, current
`@effect-atom/atom-react@0.7.0` peers on Effect `^3.22.1`, while this workspace
currently resolves Effect 4.0.0-rc.108. That is a concrete integration mismatch,
not a stylistic objection. Reconsider effect-atom if Thread Progress later owns
effectful streams/services and the workspace has one compatible Effect line.

## Measured facts, source facts, and limits

### Measured facts

- The production capture at 1440x1000 had 200 mounted rows, 27 groups, and two
  sections. Each of four steady one-second ticks produced about 19,388 render
  records and 11,583 `didCommit` records; stable repeats were about
  19,373/11,564. These are React Scan records, not native React duration.
- Adding six rows increased Dialog, MenuProvider, Popper, and Presence records
  by exact row multiples. The display popover itself cost 77 records, while a
  row-wide display-policy change caused another roughly 19,400-record cascade.
- Quiet non-Thread-Progress controls produced zero settled renders. This makes
  the sidebar clock a demonstrated local cause, not evidence of a general BB
  idle loop.

The raw capture and its instrumentation qualifications are recorded in
[react-performance-program.md](/home/ubuntu/bb/docs/react-performance/react-performance-program.md:56).

### Source facts explaining the cascade

- `ProgressInbox` owns `now` as React state
  ([progress-inbox.tsx](/home/ubuntu/bb/plugins/plugins/thread-progress/components/progress-inbox.tsx:264))
  and writes it every second
  ([progress-inbox.tsx](/home/ubuntu/bb/plugins/plugins/thread-progress/components/progress-inbox.tsx:430)).
- That `now` is a dependency of whole-section derivation, including the recent
  membership cutoff
  ([progress-inbox.tsx](/home/ubuntu/bb/plugins/plugins/thread-progress/components/progress-inbox.tsx:652)),
  then is passed through each list and row
  ([progress-inbox.tsx](/home/ubuntu/bb/plugins/plugins/thread-progress/components/progress-inbox.tsx:1123),
  [progress-inbox.tsx](/home/ubuntu/bb/plugins/plugins/thread-progress/components/progress-inbox.tsx:1241)).
  Every row recalculates recency, curtain, four feature opacities, and status
  text from it
  ([progress-inbox.tsx](/home/ubuntu/bb/plugins/plugins/thread-progress/components/progress-inbox.tsx:1836),
  [progress-inbox.tsx](/home/ubuntu/bb/plugins/plugins/thread-progress/components/progress-inbox.tsx:2122)).
- Time does not change every displayed value each second. The compact timer is
  bucketed to five seconds below one minute, then minutes, hours, and days
  ([sidebar-progress.ts](/home/ubuntu/bb/plugins/plugins/thread-progress/lib/sidebar-progress.ts:127)).
  Recent-display and curtain windows end at six hours and ten minutes
  ([sidebar-display.ts](/home/ubuntu/bb/plugins/plugins/thread-progress/lib/sidebar-display.ts:1)).
- Modifier-key state is also lifted into `ProgressInbox` and propagated through
  every row
  ([progress-inbox.tsx](/home/ubuntu/bb/plugins/plugins/thread-progress/components/progress-inbox.tsx:287),
  [progress-inbox.tsx](/home/ubuntu/bb/plugins/plugins/thread-progress/components/progress-inbox.tsx:522),
  [progress-inbox.tsx](/home/ubuntu/bb/plugins/plugins/thread-progress/components/progress-inbox.tsx:1918)).
  A global interaction can therefore revisit each row and all of its closed
  Radix infrastructure even when only control visibility/tab order changed.
- BB's app build enables the React Compiler
  ([vite.config.ts](/home/ubuntu/bb/fork/build/bb/apps/app/vite.config.ts:13)),
  but the plugin builder's app path uses its own esbuild compilation and has no
  corresponding React Compiler stage. Compiler-generated bailouts therefore
  cannot be assumed for plugin code; explicit stable sources, stable props, and
  narrow `memo` boundaries remain necessary.

### Independent collection amplification

- One row calls `useSidebarThreadActions` directly and calls it again in both
  `ThreadActionsMenu` and `ThreadActionsButton`
  ([progress-inbox.tsx](/home/ubuntu/bb/plugins/plugins/thread-progress/components/progress-inbox.tsx:1795),
  [thread-actions-menu.tsx](/home/ubuntu/bb/plugins/plugins/thread-progress/components/thread-actions-menu.tsx:35),
  [thread-actions-menu.tsx](/home/ubuntu/bb/plugins/plugins/thread-progress/components/thread-actions-menu.tsx:132)).
  It also calls `useSidebarThreadSplit`.
- Each actions call derives a full `threadId -> ThreadListEntry` map through
  `useThreadEntryMap`
  ([plugin-sidebar-hooks.ts](/home/ubuntu/bb/fork/build/bb/apps/app/src/lib/plugin-sidebar-hooks.ts:132));
  split reaches the same helper through `useSidebarThreadEntry`
  ([plugin-sidebar-split.ts](/home/ubuntu/bb/fork/build/bb/apps/app/src/lib/plugin-sidebar-split.ts:23)).
  Thus the current component shape can create four duplicate whole-sidebar maps
  per mounted row when host sidebar data changes. This is independent of the
  one-second clock and should not be hidden inside the temporal refactor.
- Ungrouped and grouped root rendering builds suffix arrays with
  `slice(index + 1)` per item
  ([progress-inbox.tsx](/home/ubuntu/bb/plugins/plugins/thread-progress/components/progress-inbox.tsx:1267),
  [progress-inbox.tsx](/home/ubuntu/bb/plugins/plugins/thread-progress/components/progress-inbox.tsx:1303));
  nested children call an `indexOf` plus suffix `slice` per child
  ([thread-nesting.ts](/home/ubuntu/bb/plugins/plugins/thread-progress/lib/thread-nesting.ts:151)).
  For an ungrouped list this retains O(n^2) copied IDs (19,900 at 200 rows;
  77,028 at 393 rows).

## Reactivity-tool decision matrix

The organizational statement that the team uses effect-atom elsewhere is
accepted as an input, not presented as a repository measurement.

| Criterion | TanStack Store | `effect-atom` | Decision impact |
| --- | --- | --- | --- |
| Fine-grained synchronous derivation | `createStore`/atoms plus `useSelector`; selectors notify React only when their selected result changes. The installed adapter accepts any stable `{get, subscribe}` source ([useSelector.ts](/home/ubuntu/bb/plugins/node_modules/@tanstack/react-store/src/useSelector.ts:12)). | Derived atoms read other atoms; `Atom.family` returns a stable atom per key. Official source uses weak references/finalization where available. | Both satisfy row/section granularity. |
| Subscriber lifecycle | Core atoms unlink computed dependencies when unwatched ([atom.ts](/home/ubuntu/bb/plugins/node_modules/@tanstack/store/src/atom.ts:56)), but do not expose first/last-subscriber callbacks. A small `TemporalSource` wrapper must start/stop scheduler registration in `subscribe`. | Atoms auto-dispose/reset when unused by default; `keepAlive` opts out. `get.addFinalizer` and scoped Effect finalizers directly express timer/listener cleanup. | effect-atom is richer; TanStack needs about one small adapter. |
| Per-key state | Use a plugin-owned `Map<ThreadId, TemporalSource>` with explicit eviction after last unsubscribe; no hidden unbounded family cache. | Official `Atom.family` provides stable per-key references and uses `WeakRef`/`FinalizationRegistry` where available ([official source](https://github.com/tim-smart/effect-atom/blob/main/packages/atom/src/Atom.ts#L1251-L1295)). | Both work; explicit eviction is easier to test deterministically. |
| Effect/Stream scheduling | Use one ordinary min-heap and one `setTimeout`; synchronous `Date.now()` recomputation only for due sources. | Official docs support `Stream.fromSchedule`, Effect scopes, interruption, and finalizers ([effect-atom README](https://github.com/tim-smart/effect-atom#working-with-streams)). | Effect/Stream power is unused by this synchronous, in-memory deadline problem. A one-second Stream would be the same bad global clock in a different library. |
| Visibility/finalizers | Wrapper clears its deadline on last unsubscribe; a singleton visibility listener pauses/resumes the heap. | `get.addFinalizer` naturally removes listeners; official docs explicitly show this pattern ([effect-atom README](https://github.com/tim-smart/effect-atom#wrapping-an-event-listener)). | effect-atom has the nicer primitive, but this alone does not offset compatibility/cost. |
| Current compatibility | Current dirty lockfile already contains 0.11.1 transitively, but Thread Progress does not declare it. React 19 is supported. Direct declarations are still required. | Current 0.7.0 peers on Effect `^3.22.1`, React 18/19, and `scheduler`; its atom package also declares Effect platform/experimental/RPC peers ([atom-react package](https://github.com/tim-smart/effect-atom/blob/main/packages/atom-react/package.json), [atom package](https://github.com/tim-smart/effect-atom/blob/main/packages/atom/package.json)). Workspace Effect resolves to 4.0.0-rc.108 ([bun.lock](/home/ubuntu/bb/plugins/bun.lock:1255)). | TanStack has no version-line conflict. Transitive availability from unrelated dirty work must not be relied upon. |
| Dependency/bundle surface | Locally installed package directories measure about 240 KiB (`store`) + 236 KiB (`react-store`). Registry unpacked sizes observed on 2026-08-26 were 123,093 + 63,848 bytes. | Registry unpacked sizes were 713,793 (`atom`) + 96,490 bytes (`atom-react`), before Effect and scheduler. Local Effect alone occupies about 49 MiB unpacked. These are disk/unpacked figures, **not bundle bytes**; tree-shaking may remove much of them. | Require an esbuild metafile and compressed `app.js` delta in the prototype. TanStack is the lower-risk starting surface. |
| Team familiarity | Not established by repository evidence. | Team reports prior use in other products. | Favors effect-atom operationally, but does not resolve the Effect 3/4 mismatch or create a need for effectful scheduling. |

Recommendation confidence is **medium-high**, conditional on the 200-row
prototype. If effect-atom is prototyped, it must use derived/family atoms that
publish presentation values, not `Stream.fromSchedule(Schedule.spaced(1000))`
or any atom exposing raw time.

## Proposed TanStack architecture

### 1. Sources expose presentation, never time

Create a sidebar-owned `TemporalScheduler` and stable keyed sources:

```ts
type RowTemporalPresentation = Readonly<{
  timerText: string
  timerDescription: string
  rowOpacity: number
  addonOpacity: number
  curtainTone: RowCurtainTone | null
  curtainOpacity: number
  hillOpacity: number
  topicOpacity: number
  stickerOpacity: number
  changeProfileOpacity: number
}>

rowTemporalSource(threadId)       // Store/SelectionSource<RowTemporalPresentation>
sectionEligibilitySource(id)      // Store/SelectionSource<readonly ThreadId[]>
```

`get()` returns the last structurally stable presentation object. `subscribe()`
increments a reference count, computes the current snapshot, and registers its
next deadline; unsubscribe cancels registration and evicts the keyed source
when its count reaches zero. `useSelector` selects primitives or the whole
interned object with explicit equality. A due recomputation that produces an
equal snapshot returns the old object and causes no React update.

Do **not** put `nowMs`, `clockTick`, or a changing global version in any Store.
The scheduler may read `Date.now()` while computing a due snapshot, but raw time
never crosses the reactive boundary.

### 2. Schedule the next output change

Each pure calculator returns `{presentation, nextDeadlineMs}`. The scheduler
keeps one min-heap and one browser timeout for the earliest subscribed deadline;
equal deadlines are batched.

- Timer text: next five-second boundary below one minute, then the next minute,
  hour, or day boundary matching `formatCompactTimer`.
- Timer description/title: use the same meaningful bucket as visible text.
  Exact per-second aria-label churn is neither required for `role="timer"` nor
  desirable; recompute immediately on focus if exact elapsed time is needed.
- Recent feature visibility: next rounded displayed-opacity change and final
  expiry. Linear ten-minute/six-hour fades may move to CSS animation so React
  is needed only at semantic start/end; retain the pure calculation as the
  reduced-motion and visibility-resume fallback.
- Recency emphasis: schedule only when the rounded value actually changes, or
  at its interpolation breakpoint. Never approximate this with a fixed global
  one-second tick.
- Static/error/pinned/blocking rows with no changing presentation get
  `nextDeadlineMs: null`.

All temporal formulas remain pure and take an explicit `nowMs` in tests. Only
the scheduler owns real time.

### 3. Section expiry is not row presentation

`recentWithinMs` changes **membership**, section counts, emptiness, grouping,
and potentially whether a row mounts. A row opacity/timer source must not own
that transition. For each mounted section, derive stable eligible root IDs from
thread activity and schedule exactly the earliest
`activityAt + recentWithinMs` still in the future. At that deadline recompute
that section only and schedule its next expiry.

Collapsed sections still need the section source because their count and
empty/non-empty state remain visible. Their row presentation sources should be
unsubscribed because their rows are unmounted. A section with
`recentWithinMs === null` has no temporal deadline.

### 4. Visibility and lifetime rules

- No mounted subscribers: no heap entry, timeout, observer, or retained
  per-thread source after a short deterministic eviction point.
- `document.visibilityState !== "visible"`: clear the active timeout. On return,
  recompute each subscribed source once at the current time, batch changed
  publications, discard expired deadlines, then arm only the earliest next one.
- Collapsed/unmounted rows unsubscribe automatically. Start with mounted-row
  lifetime as the correctness boundary.
- Viewport suspension via `IntersectionObserver` is a second optimization, not
  a prerequisite: pause offscreen row deadlines, but always treat focused,
  dragged, menu-owning, or intersecting rows as visible. On re-entry recompute
  before revealing stale presentation. Section deadlines never pause merely
  because their rows are offscreen.
- Plugin reload/unmount disposes the scheduler, visibility listener, observer,
  timeout, heap, and keyed source maps. Tests assert all six are empty.

### 5. Contain interaction controls

Split a row into a stable shell and narrow reactive leaves:

- `RowTemporalPresentation` is the only temporal subscriber. Its update must
  not render `ThreadActionsMenu`, dialogs, comments, DnD wrappers, or the row
  shell.
- A display-policy change may update the affected visual leaf in each row, but
  must not remount/re-render closed menu/dialog/provider trees.
- Modifier-key state belongs in a small controls leaf. CSS may handle visual
  reveal; a selected boolean may update only control `tabIndex`/accessibility.
  It must not be a prop on `ProgressThreadList`/`ThreadRowEnvironment`.
- Hoist one host actions object to the list boundary and provide stable
  ID-taking callbacks. Do not call the actions hook three times per row.
  Preserve per-row split hooks until the host SDK offers a shared keyed source.
- Because plugin builds lack React Compiler containment, add explicit `memo`
  only after props are stable. A fresh suffix array, environment object, or
  inline callback defeats the boundary and is an acceptance-test failure.

## Phased, independently implementable checklist

### A0 — Frozen prototype and tool ratification (Track A; no host changes)

- [ ] Add both candidates to isolated 200-row prototypes using identical pure
      temporal calculators and scripts.
- [ ] Record render/commit counts, idle callbacks, timer count, heap size,
      production `app.js` raw/compressed delta, and esbuild metafile inputs.
- [ ] Include hide/show, unmount/remount, 200 simultaneous deadlines, and
      clock-jump cases.
- [ ] Reject any prototype in which rows select raw time or a global tick.

Acceptance: recommendation is ratified with archived raw output; no prototype
has a one-second full-tree commit; all resources reach zero after unmount.

### A1 — Pure temporal snapshots/deadlines (Track A; parallel with B1/B2)

- [ ] Extract row presentation and next-deadline calculators from JSX.
- [ ] Add fake-clock tests at 5 s/1 m/1 h/1 d timer boundaries, 10 m curtain
      expiry, 6 h recent expiry, interpolation breakpoints, failure/blocking
      states, backward/forward clock jumps, and exact equality/no-op cases.
- [ ] Add independent section-expiry calculation/tests.

Acceptance: every dynamic snapshot reports its earliest meaningful next change;
static snapshots report null; one millisecond on either side of every boundary
has deterministic expected output.

### A2 — TanStack scheduler and leaf subscriptions (Track A)

- [ ] Declare `@tanstack/store` and `@tanstack/react-store` in the generated
      workspace definition/catalog and Thread Progress dependencies; regenerate
      manifests/lockfile rather than editing generated files.
- [ ] Implement keyed `TemporalSource` lifecycle, min-heap batching, page
      visibility pause/resume, and plugin disposal.
- [ ] Remove top-level `now`, the one-second interval, and `now` from
      `ThreadRowEnvironment`.
- [ ] Subscribe only temporal leaves with stable selectors; keep section
      eligibility on its separate source.

Acceptance: no global interval remains; no selector exposes raw time; one due
row cannot render the inbox/list/unrelated rows; hidden/unmounted state has no
armed timeout; all existing visual/accessibility tests pass.

### A3 — Interaction containment (Track A, independent after stable row props)

- [ ] Move Alt/modifier selection into the controls leaf and use CSS for purely
      visual reveal.
- [ ] Isolate display-policy visual leaves from closed menus/dialogs.
- [ ] Add tests for keyboard tab order, hover, Alt down/up, blur, context menu,
      dropdown, rename, comments, sticker dialog, drag, split, and compact mode.

Acceptance: display popover opening remains small; changing a policy renders at
most the affected leaves; unrelated rows do not render for one-row interactions.

### B1 — Linear sibling metadata (Track B; fully parallel with A1/A2)

- [ ] Replace suffix ID arrays with a stable list descriptor plus index/range,
      or precompute the required foreground-following targets in one reverse
      pass per presented sibling list.
- [ ] Add 0/1/200/393-row allocation and correctness tests for grouped, nested,
      search-filtered, and backgrounded lists.

Acceptance: O(n) construction and retained IDs; no per-row `slice(index + 1)`
or `indexOf`+slice; existing bulk-action ordering remains exact.

### B2 — Shared host sidebar lookup/actions (Track B; host SDK owner)

- [ ] Move `threadId -> entry` derivation to one cache/source per sidebar query
      snapshot, shared by actions, entry, and split consumers.
- [ ] Let Thread Progress acquire actions once per list/plugin instance, or add
      a stable ID-keyed SDK action source that does not rebuild a map per hook.
- [ ] Prove that unchanged thread DTOs and keyed selections retain identity.

Acceptance: one map build per host sidebar snapshot, not per row/hook; one row
update notifies only its keyed consumers; delete/archive confirmation, route
repair, split gesture, compact behavior, and mutation state remain correct.

### A4 — Optional viewport suspension/CSS fades (Track A; after A2 baseline)

- [ ] Add IntersectionObserver suspension only if A2 misses idle/dense-deadline
      budgets; do not couple section eligibility to viewport visibility.
- [ ] Prototype CSS-driven linear fades and reduced-motion fallback.

Acceptance: no stale flash on re-entry/focus, no missed section expiry, and a
measured improvement over A2. Otherwise omit this phase.

## React Scan regression budget

Use the same production build, React Scan 0.5.7 attachment order, 1440x1000
viewport, 200 rows, 27 groups, two sections, and frozen interaction scripts.
Archive raw render records and `didCommit`; callback time is diagnostic only.

| Scenario | Hard budget |
| --- | ---: |
| 10 s settled, no meaningful deadline due | **0 Thread Progress render records; 0 commits** |
| One row timer/opacity deadline | **<= 8 render records; <= 4 `didCommit`; 0 renders in `ProgressInbox`, `ProgressThreadList`, unrelated row shells, menus, or dialogs** |
| One section recent-membership expiry | **<= 40 render records plus rows actually mounted/unmounted; no render in unaffected sections** |
| 200 simultaneous timer boundaries | **<= 1,000 render records; <= 400 `didCommit`; one batched React commit; no menu/dialog/provider count growth** |
| Open display popover | **<= 100 render records** (current measured control: 77) |
| Change one display policy across 200 rows | **<= 1,000 render records; <= 400 `didCommit`; only affected visual leaves** (current: about 19,400) |
| Alt down/up in modifier mode | **<= 1,000 render records total; only controls leaves; no row-shell/menu/dialog renders** |
| Open one row menu / rename / comment | **<= 150 render records per action; 0 renders in unrelated rows** |
| Hidden document for 10 s | **0 renders; 0 commits; 0 armed temporal timeouts** |
| Unmount/plugin reload | **0 retained subscribers, keyed sources, heap entries, observers, listeners, or timeouts** |

Also retain two scaling assertions: adding six inert rows must add **zero** work
to a one-row temporal deadline, and a host sidebar snapshot update must build
the entry map once regardless of 200 versus 393 mounted rows.

## Cross-track dependencies and integration order

- A1 and B1/B2 are parallel. A1 consumes plain thread/progress facts and does
  not need host SDK changes.
- A2 can land before B1/B2, but its row memo budget is provisional while fresh
  suffix arrays and duplicated host hooks remain. Do not weaken A2's idle-clock
  gate because of Track B.
- A3 needs stable row props from B1 and benefits from shared actions in B2.
  If B2 is delayed, hoist actions inside the plugin as an interim plugin-only
  containment step; do not duplicate or bypass host safety flows.
- Track E owns the frozen fixture, raw React Scan comparison, compressed bundle
  delta, and combined production gate. It must measure A and B separately before
  their combined result so improvements remain attributable.
- React Compiler support in the plugin builder is a possible future host track,
  not a dependency of this plan. The architecture must remain performant under
  today's non-compiler plugin build.

Recommended integration order: **A0 ratification -> A1 + B1/B2 in parallel ->
A2 -> A3 -> optional A4 -> Track E combined verification**.
