# BB React performance playbook

Read this reference when diagnosing a BB React performance issue, planning a
non-trivial optimization, or reviewing a change that affects timers, dense
lists, overlays, navigation, or plugin/host boundaries.

## Diagnose the shape of work

Classify the witness before choosing a fix:

| Shape | Useful control | Likely causes |
| --- | --- | --- |
| Settled idle work | Observe the same surface with timers/polls disabled or the plugin absent | lifted clocks, polling copied into React state, unstable external-store snapshots |
| Large navigation mount | Compare empty and populated fixtures with identical cache/plugin state | per-row providers/overlays, eager closed content, missing windowing, broad route owners |
| One-row update fans out | Update one keyed entity without changing order | global context/store selection, whole-map recreation, unstable derived objects |
| Interaction cascade | Open one menu, press a modifier, or change one display policy | lifted interaction state, fresh callbacks/environments, closed dialog/menu trees inside the invalidated boundary |
| Browser work without React work | Compare production traces with render attribution | layout, paint, `content-visibility`, images/fonts, scroll correction |

Count mounted rows/messages/action bars and the repeated infrastructure per
row. Scaling evidence is stronger than a component name alone. Add temporary
counters or render-reason attribution when aggregate profiling cannot identify
the owning call site.

## Renderer identity and focused controls

A controlled input that loses focus, caret position, selection, or composition
while typing is evidence of a remount, not merely a rerender. Check element and
renderer identity before adding memoization:

- Record the focused DOM node and confirm whether it is the same node after an
  interaction and after any debounced query response.
- Inspect headless-library render adapters. TanStack Table's React renderer
  treats function-valued headers and cells as component types; recreating an
  inline function changes the component type even when the column ID and React
  key remain stable.
- Do not put controlled input values in a `useMemo` dependency list that
  recreates columns containing inline renderer functions. `useMemo` does not
  make the value stable when one of those dependencies changes.
- Prefer module-scoped or otherwise stable column definitions and named
  renderers. Supply live values and actions through typed table meta, controlled
  table state, or a narrowly selected context. For genuinely configurable
  tables, create the definition set once per stable configuration rather than
  globally sharing incompatible behavior.
- Verify ordinary typing, caret edits, text selection, IME composition, and the
  debounced/server-refresh boundary. Attribute visible-row commits separately:
  preserving the input node should also avoid rebuilding every cell renderer
  before data or filter membership actually changes.

## Temporal reactivity

Model time as scheduled presentation changes rather than reactive wall time.
A pure calculator should return:

```ts
type DeadlineValue<T> = Readonly<{
  value: T
  nextDeadlineMs: number | null
}>
```

Useful rules:

- Values are stable when presentation is equal; return the previous object.
- Schedule timer text at the next formatting boundary: seconds bucket, minute,
  hour, or day as the product requires.
- Schedule section membership at the earliest expiry belonging to that
  section. Collapsed sections may still need count/emptiness deadlines while
  their rows remain unsubscribed.
- Static/error/pinned states with no temporal presentation return no deadline.
- Pause the active timeout while hidden. On visibility return, recompute each
  subscribed source once, batch changed publications, and arm only the earliest
  next deadline.
- Use immediate logical disposal plus a documented short physical eviction
  grace if Strict Mode remount would otherwise churn keyed sources.
- Test timer clamping, simultaneous deadlines, stale heap generations,
  unmount/remount, plugin reload, hidden/visible transitions, sleep/resume, and
  forward/backward wall-clock jumps.

If exact elapsed seconds appear in `aria-label` or `title`, they remain a real
presentation deadline until product and accessibility reviewers approve a
different semantic contract.

## Dense-list and host SDK boundaries

Avoid work that is multiplied by both row count and collection size:

- Build `id -> entity` maps once per immutable query/snapshot, not once per
  hook instance or row.
- Prefer keyed selectors/sources so one entity update notifies only consumers
  of that key.
- Acquire stable actions at a list/plugin boundary and pass IDs to callbacks
  when this preserves host safety flows.
- Replace `items.slice(index + 1)` per row with an index/range descriptor or a
  single reverse pass. Avoid nested `indexOf` plus suffix copying.
- Measure allocation/construction at 0, 1, representative, and stress row
  counts. Test grouped, nested, filtered, backgrounded, and reordered lists.

An SDK optimization should begin behind the existing contract. Add a public
member only when evidence requires it; BB experimental APIs must follow the
repository's naming, audit documentation, SDK generation, and fork-before-
plugin integration rules.

## Plugin RPCs, polling, and supervisors

An active request lineage is evidence that work was waiting during a stall,
not proof that it blocked the event loop. Correlate lineages with synchronous
query timings, `lastWork`/`slowestWork`, handler self-time when available, and
a fixed control/candidate run. Cumulative plugin handler duration can mostly be
queue time when plugins call back into a congested BB server.

When a React surface appears frozen but render work is quiet, distinguish a
listening process from a serving one. Time the local health, app/API, and UI
routes separately; inspect the UI socket backlog, server CPU, and event-loop
delay. A health route can answer while the UI waits behind synchronous plugin
work. Restarting a stalled server child is a recovery probe, not proof that the
load source has gone away; observe the replacement after startup settles.

Realtime events and mounted accessories can multiply one RPC across every open
browser client. Count calls per event and per client, then identify the actual
server cost before adjusting React subscriptions. Slow-query logs may miss a
continuous stream of synchronous queries below their threshold. A short native
CPU sample can identify SQLite work; a short JavaScript profile can identify
its caller. Treat temporary local inspector access as operational state and
close it after the probe.

For a hot query, compare `EXPLAIN QUERY PLAN` and timed results on realistic
data, then verify output equivalence. A small result or page size does not
bound scanned rows or the complete history walk. SQLite may reorder joins in a
way that defeats an apparent time filter; use materialization or join-order
controls only when the measured plan requires them. For startup, reconnect, or
timer reconciliation, check whether any IDs need work before scanning history,
coalesce overlapping passes, bound per-page fan-out, preserve catch-up after a
reconnect, and stop follow-on reads on cancellation.

Treat a timer in a mounted plugin surface as per-client work. Before polling:

- key a bounded server cache by the smallest stable identity and coalesce
  concurrent loads with single-flight;
- make invalidation generation-safe so old work cannot repopulate new state;
- when a refresh waits for obsolete in-flight work, retry the current
  generation after either fulfillment or rejection;
- guard every async UI result by the thread/host/session identity that started
  it, use non-overlapping recursive polls, pause while hidden, refresh promptly
  after reconnect, and dispose timers and owned remote resources on unmount;
- invalidate at both sides of a mutation when partial failure can change the
  observed external state.

Client identity guards are not authorization or ownership checks. RPCs that
read, write, or close terminals must validate caller inputs against
server-owned session records before acting.

Background supervisors must turn permanent delivery failures into durable
state transitions. An overdue row left enabled after a terminal error becomes
a hot loop even when each sweep is bounded. Classify only exact structured
status/code/details combinations, let structured fields outrank message
fallbacks, preserve transient retry behavior, and test lifecycle-event misses
as well as the normal event path.

## Overlays and populated timelines

For message or row actions:

1. Hoist providers to the narrowest surface sharing their configuration.
2. Keep triggers mounted so pointer and keyboard semantics are immediate.
3. Delay tooltip/menu/popover content until opening. Retain it through exit
   animation and focus restoration; do not replace the focused trigger.
4. Preserve portal scope, collision boundaries, typeahead text, disabled state,
   action order, compact drawers, reduced motion, and multiple panes.
5. Validate BB's existing timeline-windowing path for large threads before
   inventing a new observer or virtualizer.

Test first open with pointer, touch, Enter, Space, and ArrowDown; Escape and
outside close; Tab/Shift+Tab restoration; typeahead; collision positioning;
compact/coarse-pointer output; two timelines; and scrolling a row out while an
overlay is open.

Windowing correctness includes initial bottom anchor, prepend, variable
markdown/image/font height, streaming replacement, search/outline targets,
nested rows, unread/latest rows, browser-history restoration, split panes, and
an explicit sequential-Tab/screen-reader policy. Use Chromium for a pinned
performance gate and available Firefox/Safari/iOS hosts for correctness when
graduating windowing.

## Measurement contract

Freeze one protocol before product changes:

- immutable copied database/fixture and recorded hash;
- exact fork result tree, plugin sources, browser revision, OS/runtime, viewport
  and DPR, locale/theme/motion, pointer mode, cache mode, and feature flags;
- instrumentation bootstrap before React, with a preflight that proves the
  expected profiling capability;
- deterministic role/name or test-ID interactions and explicit readiness/quiet
  conditions rather than sleeps;
- alternating control/candidate order, warm-ups, enough samples for stable
  median/tail estimates, and invalidation on reconnect, visibility change,
  fixture mismatch, console error, or different boot/query state;
- raw traces, counters, manifest, summary, and tested commit retained together.

Keep two lanes:

| Lane | Build | Verdict metrics |
| --- | --- | --- |
| Production | optimized runtime, no profiling instrumenter | input/navigation-to-paint, long tasks/LoAF, layout behavior, retained heap, raw/compressed bundle closure |
| Attribution | profiling renderer and headless React Scan before React | commits, unique fibers, render callbacks/records, component identities and reasons |

Do not compare milliseconds between lanes. React Scan callback spans include
instrumentation overhead, and missing duration/unnecessary-render fields are
unknown rather than zero/false.

Define regression predicates algebraically. For example, a noisy metric may
fail only when both its relative and absolute thresholds are exceeded. Freeze
targets after baseline stability is known; targeted reductions plus no
production regression are safer initial gates than speculative total-render
percentages.

## Review checklist

- Is the claimed cause measured, source-supported, or merely inferred?
- Can one update reach only the leaf/key that changes?
- Does any broad state contain raw time, modifier state, or fresh collection
  objects?
- Does work grow linearly with rows, or is global work repeated per row?
- Are closed providers, portals, menus, dialogs, or tooltip contents multiplied?
- Are memo boundaries defeated by fresh props or callbacks?
- Are accessibility semantics and first-interaction behavior preserved?
- Do unmount, reload, visibility, Strict Mode, and clock changes clean up every
  resource?
- Was the change verified in both production and attribution lanes?
- Are fork patches, plugin manifests, SDK output, and canonical reload handled
  through their owning workflows?
