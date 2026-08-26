# Populated-thread navigation: performance contribution

**Post-review protocol and source correction:** the main program's E0 protocol
(seven recorded runs with median/p95, increasing the count if baseline
stability requires it) supersedes this contribution's two-warm-up/ten-run and
p90 suggestions. Upstream links below explain ancestry but are not proof of
the tested downstream composition; implementation must cite the exact
materialized result-tree SHA plus downstream patch and follow the fork patch
series workflow. Aggregate provider names remain a leading hypothesis until
C0 archives per-surface counters and commit attribution.

## Executive finding

The supplied production capture is consistent with **multiplicative per-message UI infrastructure** dominating Home → populated-thread navigation, not with one unusually slow message renderer. The most direct safe sequence is:

1. hoist the tooltip provider from every `MessageActionBar` to one timeline/surface owner;
2. keep action triggers eager but make closed tooltip/menu/popover content lazy;
3. validate and graduate the existing opt-in timeline windowing path for large threads;
4. only then split the monolithic thread-detail/app-shell cascade, using a new profile to identify which parent updates still penetrate the timeline.

Tracks 1, 2, and the measurement harness can proceed in parallel. Windowing graduation depends on the harness and interaction/accessibility coverage. Parent-cascade cleanup should use a post-overlay/windowing profile so it does not optimize render records that those earlier tracks have already removed.

## What is measured versus inferred

### Supplied production measurement (measured fact)

The isolated Home → populated-thread navigation contains:

| Metric | Observed |
|---|---:|
| Render records | 4,591 |
| Distinct fibers | 2,039 |
| React commits | 29 |
| Collector callback time | 105.3 ms |
| Largest commit callback counts | 1,644 and 1,082 |
| Dominant repeated layers | per-message Tooltip / Popper / Presence / Menu / Dropdown |

Derived arithmetic, not an additional measurement: the largest two commits contain 2,726 callbacks, **59.4%** of all render records. Collector callback time averages 0.0229 ms per record. That callback total is instrumentation overhead; it must not be presented as React render duration or user-visible latency.

### Code-supported facts

- Every desktop `MessageActionBar` currently creates its own `TooltipProvider`, then one `Tooltip` root/content tree per inline action ([MessageActionBar.tsx:718](/home/ubuntu/bb/fork/upstream/apps/app/src/components/thread/timeline/MessageActionBar.tsx:718), [MessageActionBar.tsx:725](/home/ubuntu/bb/fork/upstream/apps/app/src/components/thread/timeline/MessageActionBar.tsx:725)). The provider is only an alias of Radix's provider ([tooltip.tsx:8](/home/ubuntu/bb/fork/upstream/packages/shared-ui/src/components/ui/tooltip.tsx:8)). This matches the profile's repeated provider/tooltip signatures.
- Closed overlay content is expressed eagerly in the React element tree: every desktop action includes `TooltipContent` ([MessageActionBar.tsx:387](/home/ubuntu/bb/fork/upstream/apps/app/src/components/thread/timeline/MessageActionBar.tsx:387), [MessageActionBar.tsx:415](/home/ubuntu/bb/fork/upstream/apps/app/src/components/thread/timeline/MessageActionBar.tsx:415)); both desktop overflow variants include `DropdownMenuContent` and all items ([MessageActionBar.tsx:733](/home/ubuntu/bb/fork/upstream/apps/app/src/components/thread/timeline/MessageActionBar.tsx:733), [MessageActionBar.tsx:761](/home/ubuntu/bb/fork/upstream/apps/app/src/components/thread/timeline/MessageActionBar.tsx:761)). Radix may withhold closed portal DOM, but React still constructs and reconciles the component layers recorded by the profiler.
- Each mounted action bar also owns two width observers, collision-boundary state, compact/coarse subscriptions, expansion state, and effects ([MessageActionBar.tsx:473](/home/ubuntu/bb/fork/upstream/apps/app/src/components/thread/timeline/MessageActionBar.tsx:473), [MessageActionBar.tsx:481](/home/ubuntu/bb/fork/upstream/apps/app/src/components/thread/timeline/MessageActionBar.tsx:481)). User and assistant messages mount the bar in normal flow ([ConversationMessageContent.tsx:538](/home/ubuntu/bb/fork/upstream/apps/app/src/components/thread/timeline/ConversationMessageContent.tsx:538), [ConversationMessageContent.tsx:717](/home/ubuntu/bb/fork/upstream/apps/app/src/components/thread/timeline/ConversationMessageContent.tsx:717)).
- Compact coarse-pointer rendering already avoids desktop tooltip trees entirely ([MessageActionBar.tsx:623](/home/ubuntu/bb/fork/upstream/apps/app/src/components/thread/timeline/MessageActionBar.tsx:623)). Any optimization must preserve that specialized path rather than reunifying it with desktop.
- Timeline row windowing already exists and is explicitly opt-in ([ThreadTimelineRows.tsx:135](/home/ubuntu/bb/fork/upstream/apps/app/src/components/thread/timeline/ThreadTimelineRows.tsx:135)). It lazy-loads TanStack Virtual only when enabled, a scroll element exists, and the list reaches the threshold; otherwise it fully realizes every item ([TimelineWindowedItemsLoader.tsx:50](/home/ubuntu/bb/fork/upstream/apps/app/src/components/thread/timeline/TimelineWindowedItemsLoader.tsx:50), [TimelineWindowedItemsLoader.tsx:85](/home/ubuntu/bb/fork/upstream/apps/app/src/components/thread/timeline/TimelineWindowedItemsLoader.tsx:85)). Top-level thresholds are 40 items compact and 60 wide ([ThreadTimelineRows.tsx:2165](/home/ubuntu/bb/fork/upstream/apps/app/src/components/thread/timeline/ThreadTimelineRows.tsx:2165)).
- The windowed path renders row wrappers as height placeholders and mounts `MemoizedTimelineRowView` only for realized rows ([ThreadTimelineRows.tsx:2195](/home/ubuntu/bb/fork/upstream/apps/app/src/components/thread/timeline/ThreadTimelineRows.tsx:2195)). It preserves the latest row, unread divider, search-expanded rows, prepend scroll anchor, and outline target ([ThreadTimelineRows.tsx:2104](/home/ubuntu/bb/fork/upstream/apps/app/src/components/thread/timeline/ThreadTimelineRows.tsx:2104)). Exact stable-ID height measurements survive unmounts, while estimates seed unseen placeholders ([ThreadTimelineRows.tsx:2038](/home/ubuntu/bb/fork/upstream/apps/app/src/components/thread/timeline/ThreadTimelineRows.tsx:2038), [ThreadTimelineRows.tsx:2231](/home/ubuntu/bb/fork/upstream/apps/app/src/components/thread/timeline/ThreadTimelineRows.tsx:2231)).
- Production reads the experiment and passes it to the row renderer ([ThreadTimelineSurface.tsx:182](/home/ubuntu/bb/fork/upstream/apps/app/src/components/thread/timeline/ThreadTimelineSurface.tsx:182), [ThreadTimelineSurface.tsx:226](/home/ubuntu/bb/fork/upstream/apps/app/src/components/thread/timeline/ThreadTimelineSurface.tsx:226)), but the default remains false ([experiments.ts:35](/home/ubuntu/bb/fork/upstream/packages/domain/src/experiments.ts:35)). Existing tests cover the fully mounted control, nested virtualization, and always-realized search/outline targets ([ThreadTimelineRows.windowing.test.tsx:138](/home/ubuntu/bb/fork/upstream/apps/app/src/components/thread/timeline/ThreadTimelineRows.windowing.test.tsx:138), [ThreadTimelineRows.windowing.test.tsx:150](/home/ubuntu/bb/fork/upstream/apps/app/src/components/thread/timeline/ThreadTimelineRows.windowing.test.tsx:150), [ThreadTimelineRows.windowing.test.tsx:171](/home/ubuntu/bb/fork/upstream/apps/app/src/components/thread/timeline/ThreadTimelineRows.windowing.test.tsx:171)).
- There is a second, non-windowing compact optimization based on `content-visibility`; it deliberately does not arm on WebKit because scroll corrections are unsafe without scroll anchoring ([timeline-row-containment.ts:5](/home/ubuntu/bb/fork/upstream/apps/app/src/components/thread/timeline/timeline-row-containment.ts:5), [timeline-row-containment.ts:26](/home/ubuntu/bb/fork/upstream/apps/app/src/components/thread/timeline/timeline-row-containment.ts:26)). It reduces browser layout/paint work but cannot reduce React fibers because rows stay mounted.
- The thread-detail owner is a broad controller: it subscribes to thread/bootstrap/environment/pending-interaction/timeline and many panel states ([ThreadDetailView.tsx:513](/home/ubuntu/bb/fork/upstream/apps/app/src/views/thread-detail/ThreadDetailView.tsx:513), [ThreadDetailView.tsx:637](/home/ubuntu/bb/fork/upstream/apps/app/src/views/thread-detail/ThreadDetailView.tsx:637), [ThreadDetailView.tsx:858](/home/ubuntu/bb/fork/upstream/apps/app/src/views/thread-detail/ThreadDetailView.tsx:858)). On every render it constructs fresh `metadata`, `secondaryPanel`, and `timeline` object literals passed through a non-memoized `ThreadDetailSecondaryContent` ([ThreadDetailView.tsx:2876](/home/ubuntu/bb/fork/upstream/apps/app/src/views/thread-detail/ThreadDetailView.tsx:2876), [ThreadDetailView.tsx:2912](/home/ubuntu/bb/fork/upstream/apps/app/src/views/thread-detail/ThreadDetailView.tsx:2912), [ThreadDetailView.tsx:2976](/home/ubuntu/bb/fork/upstream/apps/app/src/views/thread-detail/ThreadDetailView.tsx:2976), [ThreadDetailSecondaryContent.tsx:61](/home/ubuntu/bb/fork/upstream/apps/app/src/views/thread-detail/ThreadDetailSecondaryContent.tsx:61)). This is a credible cascade path, but the supplied aggregate profile does not prove which of those parent updates caused each commit.
- App layout itself subscribes to location/route state ([AppLayout.tsx:397](/home/ubuntu/bb/fork/upstream/apps/app/src/components/layout/AppLayout.tsx:397), [AppLayout.tsx:413](/home/ubuntu/bb/fork/upstream/apps/app/src/components/layout/AppLayout.tsx:413)). It already contains a useful isolation precedent: sidebar state lives in a narrow bridge specifically to avoid re-rendering the route/timeline subtree ([AppLayout.tsx:133](/home/ubuntu/bb/fork/upstream/apps/app/src/components/layout/AppLayout.tsx:133), [AppLayout.tsx:141](/home/ubuntu/bb/fork/upstream/apps/app/src/components/layout/AppLayout.tsx:141)).

### Interpretation (proposal-driving inference)

The repeated overlay signatures plus the 59.4% concentration in two commits make per-message multiplicity the highest-confidence first target. Provider hoisting and lazy closed content reduce component count without changing which rows are visible. Windowing has greater upside but a wider correctness surface. Parent-cascade cleanup is likely valuable for later commits and live updates, but requires render-reason evidence before restructuring.

## Work packages

### T0 — Reproducible production benchmark and attribution (parallel foundation)

**Scope.** Turn the supplied navigation into a fixed scenario: same production build, database/thread ID or immutable fixture, viewport, device pixel ratio, pointer mode, plugin registrations/message actions, cache state, timeline-windowing setting, and start/end marks. Record both React profiling data and browser navigation/paint metrics. Run control and candidate in alternating order; use at least 10 measured warm runs after two warm-ups, reporting median and p90. Preserve raw traces.

Add counters for loaded rows, conversation messages, action bars, action triggers, tooltip providers/roots/content, dropdown roots/content, realized window rows, query status transitions, and route-content paint. Attribute every React commit to its triggering update where tooling permits. Collector enabled/disabled A/B runs quantify instrumentation perturbation.

**Acceptance criteria.** Re-running unchanged control produces median render-record, fiber, commit, and collector totals within ±10%; row/action counts are identical; no query or plugin boot differences occur between variants. A trace is rejected rather than averaged if the thread refetches differently, plugins differ, the window size changes, or the route starts from a different cache state.

**Dependency.** None. All optimization tracks depend on this for performance acceptance.

### T1 — Hoist the timeline tooltip provider (parallel, low risk)

**Scope.** Remove `TooltipProvider` from `MessageActionBar` and install one provider with `delayDuration={300}` around the timeline action-bar population, preferably at the narrowest owner shared by native and embedded timeline rows. Do not hoist globally unless a profile proves a global provider is cheaper and behaviorally equivalent. Keep provider configuration local to this surface; direct stories/tests must supply the provider explicitly.

This should reduce one provider subtree per mounted message to one per timeline without changing buttons, tooltip roots, portal scoping, action ordering, or mobile behavior.

**Correctness risks and tests.** Radix provider state is shared, so moving the boundary can change skip-delay behavior when moving rapidly between messages. Test first tooltip delay, adjacent-action hover handoff, leave/re-enter delay reset, multiple simultaneously mounted thread panes, embedded side chat, portal collision boundary, and unmount during navigation. Verify compact coarse-pointer output still contains no tooltip trees.

**Acceptance criteria.** Exactly one message-action tooltip provider per rendered timeline (not per message); tooltip accessible names and 300 ms initial delay remain; all existing `MessageActionBar` interaction tests pass. In the fixed profile, provider callbacks/fibers fall by at least 90%, overall render records fall by at least 8%, and commits/p90 navigation time do not regress by more than 5%.

**Dependency.** T0 for the performance gate. Independent of T2 and T3 at implementation time, but rebase conflicts with T2 in `MessageActionBar.tsx` should be planned.

### T2 — Lazy closed overlay content while keeping triggers eager (parallel, medium risk)

**Scope.** Introduce shared, tested lazy-content behavior rather than ad hoc conditions at each callsite:

- Tooltip roots/triggers stay mounted so pointer and keyboard semantics are unchanged; create `TooltipContent` only after that tooltip begins opening. Retain it through Radix's close lifecycle/animation, then discard it.
- Dropdown/popover roots and triggers stay mounted; menu/popover item trees are absent before first open. On close, retain through focus restoration and exit animation, then either unmount or retain only if measurements show reopen churn is preferable.
- Do not add one document listener, observer, or external-store subscription per closed action. Avoid replacing the focused trigger DOM node when realizing content.
- Preserve `usePortalScopeProps`, collision boundaries, menu typeahead (`textValue`), disabled states, copy feedback, and plugin action order.

The current responsive dropdown uses a persistent drawer shell on compact viewports ([dropdown-menu.tsx:141](/home/ubuntu/bb/fork/upstream/packages/shared-ui/src/components/ui/dropdown-menu.tsx:141), [dropdown-menu.tsx:164](/home/ubuntu/bb/fork/upstream/packages/shared-ui/src/components/ui/dropdown-menu.tsx:164)). Its required app-root/deferred-realization behavior must remain intact; lazy menu children should integrate with that shell, not bypass it.

**Correctness/accessibility risks and tests.** Immediate conditional unmount can cancel close animation and Radix close autofocus; controlled-state mistakes can make first click a no-op; delayed content can miss same-frame keyboard navigation. Test mouse click, touch tap, Enter/Space/ArrowDown open, Escape close, outside pointer close, Tab/Shift+Tab focus restoration, typeahead, disabled actions, first-open positioning, collision handling, plugin actions, copy toast/check state, reduced motion, compact drawer, and two open surfaces. Assert closed content/items are absent from the DOM and accessibility tree, while triggers retain correct `aria-label`, `aria-haspopup`, `aria-expanded`, and focus order.

**Acceptance criteria.** Before interaction, zero tooltip-content and menu-item instances exist for message actions; first interaction performs the requested action/open in one input sequence with no focus loss. Open overlay visual readiness is within one animation frame of the control and tooltip timing remains 300 ms. In the fixed closed-overlay navigation profile, Tooltip/Popper/Presence/Menu/Dropdown render records fall by at least 60%, overall render records fall by at least 20%, collector callback time falls by at least 20%, and commits/p90 navigation time do not regress by more than 5%.

**Dependency.** T0. Coordinate shared-file ownership with T1. T2 should land before setting final windowing budgets because it changes realized-row cost.

### T3 — Action-bar deferral through existing row windowing; graduate large-thread virtualization (higher risk)

**Scope.** Do **not** build another timeline virtualizer. Exercise the current experiment on the production fixture and close its gaps, then graduate it for sufficiently large populated threads behind a staged rollout. Offscreen rows already omit `MemoizedTimelineRowView`, which automatically defers the entire `ConversationMessageContent` and `MessageActionBar` ([ThreadTimelineRows.tsx:2202](/home/ubuntu/bb/fork/upstream/apps/app/src/components/thread/timeline/ThreadTimelineRows.tsx:2202)). Preserve fixed placeholders and the existing measurement cache.

For lists below the windowing threshold, keep visible action triggers eager. If residual profiling still shows action bars material at fewer than 60 rows, add a **near-viewport action-bar realization gate** with the same-height `h-5`/`h-7` slot placeholder, generous overscan, and immediate realization for the active/search/selection row. Do not use hover-only mounting: absent buttons cannot be reached by keyboard. Any per-action-bar gate must demonstrate that its observer/state overhead is smaller than the removed overlay work.

**Correctness/accessibility/interaction risks and tests.** Variable markdown/images/diffs can correct placeholder heights and jump scroll; streaming rows change height; prepending history must preserve the anchor; search/TOC targets must exist before scroll; selection/menu state must dismiss cleanly when a row is evicted; expanded rows, nested delegations, unread divider, latest streaming row, inline edit, copy/menu focus, browser find, screen-reader virtual cursor, and Tab traversal across unrealized controls require explicit decisions. Test Chromium, Firefox, and Safari/iOS separately; do not infer windowing safety from the compact `content-visibility` path, whose WebKit caveat is documented.

Add integration/E2E coverage for: initial bottom anchor; scroll upward/downward without jumps; resize/orientation/font load/image load; prepend older page; search to loaded and unloaded history; TOC navigation; streaming append and terminal topology replacement; expand/collapse nested rows; open overlay then scroll row out; inline edit; back/forward scroll restoration; split panes and embedded chat. Run axe plus keyboard-only and screen-reader smoke tests. Decide and document whether offscreen message actions are intentionally excluded from sequential Tab order; if not acceptable, windowing cannot graduate until an accessible navigation model exists.

**Acceptance criteria.** For a qualifying large thread, realized top-level rows remain bounded by viewport + documented overscan + `alwaysMountedKeys`, independent of total loaded row count. No anchor correction exceeds 8 px after settling; no cumulative visible jump exceeds 16 px during prepend, resize, image/font settlement, or streaming replacement. Search/TOC reaches the correct row on first request, the latest/active row never disappears, and no open overlay leaves orphaned focus. Zero uncaught errors/warnings and no accessibility violations are introduced.

Performance gate on the fixed capture, after T1/T2: median render records ≤2,500 (45.5% below the 4,591 control), distinct fibers ≤1,400 (31.3% below 2,039), collector callback time ≤65 ms (38.3% below 105.3 ms), and p90 commits ≤29. The two largest commits combined must contain ≤1,400 callbacks (48.6% below 2,726). Also require p90 route-content paint and interaction-ready time to improve by at least 15%; callback reductions alone are insufficient.

**Dependency.** T0, then T1/T2 for stable per-realized-row cost. May proceed in parallel with T4 once its controls exist, but rollout should not combine T3 and T4 initially.

### T4 — App-shell/thread-detail parent-cascade isolation (measure first, medium/high risk)

**Scope.** Add commit attribution/render-reason logging, then isolate only proven cascades. Likely seams are:

1. Split the timeline controller/view boundary out of `ThreadDetailViewInternal` so terminal, browser, metadata, merge-base, dialog, and secondary-panel query/state updates do not recreate the timeline branch.
2. Replace the inline `timeline={{...}}` object with a memoized descriptor or, preferably, a memoized `ThreadTimelinePane` owner that receives stable primitive/callback inputs. Apply the same treatment separately to metadata/panel objects; do not use a large custom comparator over mutable objects.
3. Memoize `ThreadDetailSecondaryContent` only after its `footer`, `header`, `renderHostedPanel`, and object props have stable identities. A superficial `memo()` with fresh object/element/function props will not isolate anything.
4. Move route-derived header/chrome subscriptions into narrow shell bridges, following the existing sidebar bridge precedent. Do not hide legitimate route identity changes: `ThreadTimelineRowsComponent` intentionally keys the timeline owner by thread ID ([ThreadTimelineRows.tsx:2221](/home/ubuntu/bb/fork/upstream/apps/app/src/components/thread/timeline/ThreadTimelineRows.tsx:2221)), and thread navigation must reset per-thread selection, measurements, and scroll state.
5. Prefer event-time accessors/atoms or selector subscriptions for state only needed by handlers. The existing draft accessor documents and avoids a prior surrounding-tree subscription cascade ([ThreadDetailView.tsx:994](/home/ubuntu/bb/fork/upstream/apps/app/src/views/thread-detail/ThreadDetailView.tsx:994)); reuse that pattern where evidence supports it.

**Correctness risks and tests.** Over-stabilization can produce stale action eligibility, wrong thread IDs, stale plugin actions, missed query updates, or retained per-thread state across navigation. Test Home → thread, thread A → B, back/forward, split-pane focus, sidebar toggle, secondary-panel open/close, terminal updates, new timeline rows, runtime status transitions, pending interactions, plugin registration changes, action handlers, inline edit, and archive/rename commands. Every memo boundary needs a test showing relevant state crosses it and irrelevant state does not render the timeline.

**Acceptance criteria.** Render-reason evidence shows secondary-panel-only, terminal-only, metadata-only, sidebar-only, and unrelated app-shell updates do not render `ThreadTimelineSurface`, `ThreadTimelineRows`, or existing conversation rows. Timeline data/runtime/plugin-action changes still render the affected scope on the same commit. On the fixed Home → thread navigation after T1–T3, reduce remaining commits by at least 20% (target ≤23 from the original 29) or document why the commits are required; do not accept a change solely for object-allocation reduction. No stale UI in the interaction matrix and no p90 metric regresses by more than 5%.

**Dependency.** T0 and a post-T1/T2/T3 attribution profile. Structural implementation can be developed in parallel with T3, but performance evaluation and rollout must be isolated so regressions are attributable.

## Cross-track dependency and rollout map

| Track | Can start with | Must wait for | Primary shared surface | Rollout |
|---|---|---|---|---|
| T0 benchmark | immediately | nothing | harness/trace artifacts | control only |
| T1 provider hoist | T0 design | T0 gate for acceptance | `MessageActionBar`, timeline owner | ship independently |
| T2 lazy content | T0 design | T0 gate; coordinate T1 edits | shared tooltip/dropdown + action bar | ship independently after interaction audit |
| T3 windowing graduation | code audit immediately | reliable T0; final budgets after T1/T2 | timeline rows/window loader | experiment → cohort → default-on |
| T4 cascade isolation | attribution instrumentation immediately | post-optimization profile for final scope | thread detail/layout boundaries | one seam per change |

Recommended landing order is T0 → T1 → T2 → T3 → evidence-selected T4 seams. T1 and T2 may be built concurrently on separate ownership boundaries, but should be measured separately and together. T3 and T4 should never first appear in the same production cohort.

## Benchmark controls and stop conditions

- Use a production bundle and the same React profiling/collector build for control and candidate. Development Strict Mode and test DOM results are not performance evidence.
- Freeze server/API responses or verify identical request counts, payload row counts, response timing class, cache freshness, plugin generations, and WebSocket invalidations. A bootstrap/cache miss must not be compared with a cache hit.
- Freeze viewport, DPR, zoom, font state, theme, sidebar/panel state, pointer coarse/fine state, reduced-motion setting, browser/version, CPU/power mode, and window focus.
- Separate cold chunk-loading runs from warm navigation runs. T3's lazy virtualizer chunk can improve initial bundle cost while adding first-use suspension; report both.
- Report medians and p90s plus raw run values for React commits/records/fibers, collector time, commit duration, long tasks, route-content paint, interaction-ready, layout shifts/scroll corrections, heap delta, and DOM node count.
- Preserve the original capture as the baseline. Rebaseline only when the fixture or instrumentation intentionally changes, with both old and new controls recorded.
- Stop and revert/disable a track if keyboard activation takes two inputs, focus is lost/orphaned, search/TOC fails once, scroll correction exceeds budget, an action becomes stale, accessibility violations increase, or any key p90 regresses >5%, even if render records improve.

## Expected outcome

Provider hoisting and lazy closed content are the safest direct response to the observed Tooltip/Popper/Presence/Menu/Dropdown multiplicity. The existing virtualizer is the correct vehicle for action-bar deferral on genuinely large threads, but only after its scroll, search, focus, and assistive-technology contract is strong enough to graduate from an experiment. App-shell cleanup should be the final attribution-led pass: it can reduce remaining cascade commits, but it should not be used as a substitute for removing thousands of repeated per-message overlay fibers.
