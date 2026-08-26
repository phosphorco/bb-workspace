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
