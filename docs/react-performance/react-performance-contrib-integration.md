# React performance: measurement, verification, and integration contribution

## Scope and evidence status

This is the measurement/integration track. It proposes a reproducible way to decide whether each performance change is real, preserves behavior, and can be merged without another track invalidating its result. It does **not** report new benchmark numbers; no candidate implementation was run for this contribution.

**Post-review scope correction:** the authoritative execution scope is the
plugin-local A0-A3/B1-B2 program in
[react-performance-program.md](/home/ubuntu/bb/docs/react-performance/react-performance-program.md).
Thread Progress dependency candidates belong in
`plugins/tools/workspaces-sync/definition.ts` and are generated with
`bun run sync:fix`; this program does not add a store to the fork app. The
fork-wide G/D/L/T/P migration material below is retained only as exploratory
analysis and must not be executed under this program. The P/R harness,
verification matrix, and rollback principles remain useful subject to the
single E0 protocol in the main program.

### Measured/verified repository facts

- The app root imports React and ReactDOM at the top of `main.tsx` and mounts under `StrictMode` ([`apps/app/src/main.tsx:1`](/home/ubuntu/bb/fork/build/bb/apps/app/src/main.tsx:1), [`apps/app/src/main.tsx:56`](/home/ubuntu/bb/fork/build/bb/apps/app/src/main.tsx:56)). Therefore React Scan cannot be added after `main.tsx` has begun evaluating.
- The fork already has a deterministic scale fixture command. Defaults are 12 projects, 1,200 threads, 400,000 events, and seed 1 ([`seed-perf-db.ts:28`](/home/ubuntu/bb/fork/build/bb/packages/scripts/src/commands/seed-perf-db.ts:28)); it accepts an explicit data directory and refuses the production data directory ([`seed-perf-db.ts:87`](/home/ubuntu/bb/fork/build/bb/packages/scripts/src/commands/seed-perf-db.ts:87), [`seed-perf-db.ts:137`](/home/ubuntu/bb/fork/build/bb/packages/scripts/src/commands/seed-perf-db.ts:137)). `BB_DATA_DIR` is an explicit runtime override ([`runtime.ts:247`](/home/ubuntu/bb/fork/build/bb/packages/config/src/runtime.ts:247)).
- `pnpm start:worktree` serves optimized production artifacts while retaining checkout-specific development data/ports and disables telemetry ([`debugging-and-qa.md:3`](/home/ubuntu/bb/fork/build/bb/docs/debugging-and-qa.md:3), [`run-dev.ts:85`](/home/ubuntu/bb/fork/build/bb/packages/scripts/src/commands/run-dev.ts:85)). This is the correct timing lane; ordinary Vite development is not.
- The app already ratchets boot and `SplitWorkspaceRoute` raw/Brotli closure bytes at 10% above a measured payload ([`bundle-budget.json:9`](/home/ubuntu/bb/fork/build/bb/apps/app/bundle-budget.json:9), [`bundle-budget.json:78`](/home/ubuntu/bb/fork/build/bb/apps/app/bundle-budget.json:78)), and the checker rejects missing compression output and forbidden eager packages ([`check-bundle-budget.mjs:50`](/home/ubuntu/bb/fork/build/bb/apps/app/scripts/check-bundle-budget.mjs:50), [`check-bundle-budget.mjs:161`](/home/ubuntu/bb/fork/build/bb/apps/app/scripts/check-bundle-budget.mjs:161)).
- The app's Vitest suite defaults to Node but partitions DOM tests into isolated workers ([`vitest.config.ts:17`](/home/ubuntu/bb/fork/build/bb/apps/app/vitest.config.ts:17)); the shared harness explicitly isolates jsdom/happy-dom because DOM globals, portals, focus, and listeners leak between files ([`vitest.shared.ts:86`](/home/ubuntu/bb/fork/build/bb/vitest.shared.ts:86)). New component tests must use the DOM environment and restore clocks/globals.
- The fork requires Turbo for build and typecheck, including filtered package work ([`fork/upstream/AGENTS.md:48`](/home/ubuntu/bb/fork/upstream/AGENTS.md:48)). The root scripts expose Turbo-wide `typecheck`, `test`, and `build` ([`package.json:25`](/home/ubuntu/bb/fork/build/bb/package.json:25), [`package.json:39`](/home/ubuntu/bb/fork/build/bb/package.json:39)).
- `@tanstack/react-store`/`@tanstack/store` are present only transitively in the fork lock through TanStack Router at 0.9.3 ([`pnpm-lock.yaml:19905`](/home/ubuntu/bb/fork/build/bb/pnpm-lock.yaml:19905)); the app does not declare either as a direct dependency ([`apps/app/package.json:20`](/home/ubuntu/bb/fork/build/bb/apps/app/package.json:20)). The organization-plugin lock also has 0.11.1 transitively through React Table ([`plugins/bun.lock:929`](/home/ubuntu/bb/plugins/bun.lock:929)). These transitive copies do not constitute a selected app-store API.
- The organization-plugin repository has a direct Effect catalog, but that is a different Bun workspace and is not evidence that the fork app already ships Effect ([`plugins/package.json:27`](/home/ubuntu/bb/plugins/package.json:27), [`plugins/package.json:79`](/home/ubuntu/bb/plugins/package.json:79)). Cole's statement that effect-atom is used in other company products is stakeholder context, not a fact established by this checkout.

### Primary external evidence

- React Scan says it must be imported before React/ReactDOM and uses `react-scan/all-environments` to run in production ([React Scan installation](https://github.com/aidenybai/react-scan/blob/main/docs/installation/create-react-app.md)). Its headless instrumentation documentation says normal production/non-`__PROFILE__` builds can expose commits but zero `actualDuration`; a profiling build is needed for fiber durations, and attaching React DevTools can replace the same profiling hook ([React Scan package README](https://github.com/aidenybai/react-scan/blob/main/packages/scan/README.md)). It also warns that render logging can add significant overhead.
- effect-atom identifies `@effect-atom/atom-react` as its React package, supports derived atoms and Effect-backed atoms, and is MIT licensed ([effect-atom README](https://github.com/tim-smart/effect-atom), [license](https://github.com/tim-smart/effect-atom/blob/main/LICENSE)).
- TanStack Store describes itself as a framework-agnostic signals store, provides the React package `@tanstack/react-store`, and documents selector-based fine-grained React updates; its repository is MIT licensed ([official overview](https://tanstack.com/store/latest/docs/overview), [React example](https://tanstack.com/store/latest/docs/framework/react/examples/stores), [repository](https://github.com/TanStack/store)).

Everything below is a **proposal** until the harness and thresholds are committed and a quiet baseline is recorded.

## Reproducible performance harness

### Two builds; never mix their numbers

1. **P (production timing/bundle lane):** build and launch with the repository's optimized `start:worktree` path, no React Scan, React DevTools, Vite HMR, source maps extension, or browser extensions. Collect navigation/interaction latency, Long Animation Frames/long tasks, heap after forced-idle stabilization, and the existing bundle closure results. This is the release-like verdict.
2. **R (render-attribution lane):** a separate profiling-mode entry loads `react-scan/lite` instrumentation before dynamically importing the existing `main.tsx`, and aliases ReactDOM to the profiling build. The bootstrap module itself must import neither React nor anything that can import a renderer. Assert at startup that profiling hooks are available; a `profiling-hooks-status.available === false` run is invalid, not a zero-render success. Collect commit count, rendered fibers/components, render reasons (only when explicitly enabled), and commit/fiber durations.

The full React Scan overlay is allowed only for exploratory diagnosis. Automated R runs use its headless interface with logging and animations off. Do not compare P milliseconds with R milliseconds: R changes the renderer and the instrumenter adds work. Compare P-before to P-after and R-before to R-after, then use R only to explain a P result. Keep React DevTools detached for R because it competes for the profiling channel.

Acceptance for harness wiring: a deliberate leaf-state update appears in R with the expected component identity; a deliberate 50 ms main-thread block appears in P; disabling the profiling alias makes the R preflight fail; and the P output contains neither React Scan nor the profiling renderer in `bundle-stats.json`.

### Immutable fixture and environment

- Create one canonical fixture outside all operator data, e.g. `/tmp/bb-react-perf-fixture/source`, with `pnpm seed:perf -- --data-dir <source> --reset --projects 12 --threads 1200 --events 400000 --seed 1`. Record fork SHA/result tree, lockfile hash, schema/migration identity, fixture parameters, browser binary/version, OS/kernel, CPU model/governor, Node/pnpm versions, viewport, DPR, and harness commit in `run-manifest.json`.
- Stop all BB processes before seeding/checkpointing. After WAL checkpoint, hash `bb.db` and preserve the source read-only. Before **each candidate and each repetition**, clone/copy it to a unique run directory and launch all server/daemon processes with that explicit `BB_DATA_DIR`. Never append to the source fixture and never point at `~/.bb` or the checkout's normal dev database.
- Pin the primary performance viewport to **1440×900, deviceScaleFactor 1**, fixed light theme, locale `en-US`, UTC, reduced motion, and a pinned Chromium revision. Use **390×844, DPR 1** as a separate compact correctness/performance cell; do not pool desktop and compact samples. Disable CPU/network throttling for the gate, animations/transitions through the harness stylesheet, notifications, provider activity, telemetry, browser extensions, and live plugins not in the scenario.
- For cold navigation, start a fresh browser context and clear HTTP cache; for warm interaction, perform one unrecorded navigation and retain cache. Label these separately. Wait for websocket connected, network idle, two animation frames, and a 500 ms no-long-task quiet window before starting a scenario. Abort a sample on reconnect, background job activity, unexpected console error, missed fixture hash, visibility change, or host load average above logical core count.
- Run one warm-up plus **7 recorded samples** per scenario/candidate in alternating order `A B B A ...`; report median and p95 (all samples), not the best run. Save raw JSON/trace plus manifest. One machine, one browser revision, and no concurrent build/test/benchmark activity are mandatory. Existing timeline guidance likewise warns oversubscription can move normalized results by 10–20% ([`debugging-and-qa.md:158`](/home/ubuntu/bb/fork/build/bb/docs/debugging-and-qa.md:158)).

### Fixed scenarios

All selectors should be role/name or stable product test IDs; never sleep to guess completion.

| ID | Setup and action | P measurements | R attribution and correctness |
|---|---|---|---|
| S0 boot | Fresh context → fixture project landing page | navigation-to-shell-ready, LCP, long tasks/LoAF, boot bytes | initial commits/renders; shell, sidebar, header present |
| S1 list navigation | Select fixture project; scroll thread list 3 viewports; open a known late row | input-to-next-paint, long tasks, created DOM nodes | renders by row/list/shell; correct selected row and route |
| S2 thread switch | Alternate between two preselected large threads five times (warm cache) | click-to-stable timeline, p95 interaction | commits and unrelated sidebar/timeline renders; title/timeline match target |
| S3 realtime append | Inject the same deterministic 20-event batch through the normal server path | event-received-to-paint, LoAF, heap delta | renders per append; ordering, dedupe, scroll-follow semantics |
| S4 composer | Focus, type fixed 120 characters, open mention menu, choose item, cancel draft | per-keystroke INP/event duration, menu latency | composer vs. unrelated subtree renders; focus, caret, keyboard operation |
| S5 panels/plugins | Open/close right panel, then one representative `threadPanelAction.component` and one `messageDirective` | click-to-paint and long tasks | host/plugin boundary renders; tab, focus return, native fallback |
| S6 list mutation | Archive/unarchive or otherwise update one fixture thread via normal UI/API | mutation-to-correct row, layout shift | only affected selectors/rows update; order/count/selection remain correct |

For S5 use the plugin-surface names exactly as documented by the plugin contract ([`plugins/AGENTS.md:70`](/home/ubuntu/bb/plugins/AGENTS.md:70)). Run the same frozen plugin builds in A and B; a plugin track gets its own paired baseline.

### Proposed regression budgets

First record three clean baseline sessions on separate quiet runs. Freeze the median-of-session medians in a reviewed JSON baseline; do not tune it after seeing a candidate. A candidate passes only if behavior is correct and:

- P: no scenario median regresses by more than **5% and 8 ms** (both tolerances must be exceeded to fail); no p95 regresses by more than **10% and 16 ms**; no new >50 ms long task/LoAF attributable to the changed path; retained heap after the scenario and idle/GC is no more than **5% or 2 MiB** above baseline.
- R: targeted leaf updates must not increase total commit count or rendered-component count by more than **5%**; components declared unaffected by that scenario have **zero new renders**. Any intentional trade (fewer expensive renders but more cheap commits) requires the corresponding P win and an explicit review note.
- Bundle: existing raw/Brotli budgets and forbidden-package gates pass. The chosen reactivity dependency's incremental boot and `SplitWorkspaceRoute` closure bytes are reported even if under the existing 10% ceiling; a budget increase is never bundled into a performance PR merely to make it pass.
- Improvement claims require at least **10% and 16 ms** median P improvement in the target scenario, or at least **20%** fewer targeted R renders with no P regression. Smaller changes may merge for maintainability but must not be presented as measured performance wins.

These thresholds are proposed starting ratchets, not measured facts. If baseline coefficient of variation exceeds 5%, fix the harness/noise before relaxing a product budget.

## Superseded fork-wide reactivity exploration (not execution scope)

This gate precedes the fine-grained-reactivity implementation. No track may introduce a home-grown module singleton plus `useSyncExternalStore`, a second atom library, or context-as-global-store while the gate is open.

### Dependency, license, and build verification

For each candidate, pin the exact direct production dependency in the **fork app** (not just a transitive lock entry) on an isolated prototype commit and regenerate only `pnpm-lock.yaml`:

1. Record package/version, resolved tarball integrity, direct and transitive production dependency delta (`pnpm list --prod`), React/ReactDOM/Effect peer ranges, published module formats/exports, `sideEffects`, TypeScript declarations, release date/maintenance signal, security advisories, and license texts via `pnpm licenses list --prod --json` plus upstream LICENSE. Both candidates currently advertise MIT, but lock-resolved artifacts must be checked.
2. Run a clean frozen install and Turbo app typecheck/test/build. Inspect duplicate packages with `pnpm why`. For effect-atom, explicitly report whether it adds a second/incompatible `effect` runtime and its Brotli closure cost; company familiarity is a positive operational input, not permission to waive this check. For TanStack Store, do not count the router's transitive 0.9.3 as dependency cost unless the direct selected version dedupes to it.
3. Run the existing app bundle checker and record incremental boot/route bytes. Reject a candidate that reaches an unintended eager closure, needs a license exception, fails React 19/types/build, or requires unsupported bundler aliases in the production lane.

### Targeted prototype parity benchmark

Build two throwaway implementations behind the **same typed adapter and component fixtures**. They must model the actual hot graph, not counters: 1,200 keyed thread summaries; independent selected thread, progress/phase, participant/presence, manual order, group collapse, and per-row menu state; derived visible/grouped/sorted rows; a 20-event batch; one-row update; selection change; and subscribe/unsubscribe during virtualized scroll. Use stable identical input objects and semantic equality rules.

Run identical unit tests and S1/S2/S3/S6 P+R scenarios. Compare:

- correctness under batch/update/unsubscribe, no tearing, deterministic derived order, error propagation, and React StrictMode remount cleanup;
- affected leaf renders, unrelated leaf renders, commits, P interaction latency, retained subscribers/heap, and production raw/Brotli delta;
- adapter complexity (source lines and concepts), type inference, test ergonomics, devtools/diagnostics, ownership/maintenance, and fit with existing Effect expertise.

Decision rule: correctness, license/build compatibility, and zero unrelated-row renders are hard gates. Among passers, select on P latency and bundle/heap evidence; treat a difference below the harness noise floor as a tie, then decide by integration simplicity and company operational familiarity. Publish the raw result table and an ADR before implementation.

**Acceptance criterion:** the selected library—TanStack Store **or** effect-atom—directly owns fine-grained source state, derived state, batching, subscriptions, and React selectors/hooks for the migrated hot graph. The adapter may name domain operations but may not implement an ad hoc external store, custom listener registry, or parallel reactivity engine. TanStack Query remains server-cache ownership where appropriate; bridge it once at a boundary rather than mirroring every value through React context.

## Superseded fork-wide track map (not execution scope)

| Track | Parallelizable implementation | Required focused tests / acceptance | Cross-track dependency |
|---|---|---|---|
| M: harness | Fixture creator, browser driver, trace summarizer, manifest/baseline schema | Self-tests for fixture hash refusal, P/R mode detection, quiet-window abort, selector failures, and deterministic summary; S0–S6 baseline twice with ≤5% CV | Starts first; no product track may claim a win before M freezes baseline |
| G: reactivity gate | TanStack prototype and effect-atom prototype can be built in parallel by separate owners | Shared contract suite plus prototype parity benchmark and dependency/license/build report; ADR selects exactly one | Depends on M; blocks D and any store dependency merge |
| D: data/reactivity | Domain state graph, query-to-store bridge, keyed selectors/families | Node unit tests for batching, stable identities, derived order, event dedupe, teardown, StrictMode-equivalent subscribe cycle; no ad hoc store | Depends on G; API contract freezes before U/L/P consume it |
| L: list/sidebar | Row selector boundary, grouping/order derivations, virtualization integration | jsdom component tests: update one row renders only that row; selection, keyboard navigation, scroll anchor, archive/undo, compact drawer behavior; S1/S6 budgets | Depends on D API; may proceed in parallel with T after API freeze |
| T: thread/timeline | Thread switch and event append boundaries | unit tests for projection/order/dedupe; DOM tests for switch, stream append, follow-scroll/manual-scroll; S2/S3 budgets | Depends on D API; server projection changes also run provider corpus gates |
| C: composer/panels | Local draft/menu state and right-panel boundaries | DOM tests for focus/caret, typing, mention selection/cancel, Escape/focus return, tab/ARIA state; S4 and native panel part of S5 | Can start after M; must rebase onto D only if it consumes selected store |
| P: plugin surfaces | Host/plugin subscription seam and representative plugin consumers | plugin pure unit tests plus mounted component tests for `threadPanelAction.component`, `messageDirective`, fallback/unload/reload, accessible names/focus; plugin S5 paired run | Depends on stable fork SDK/host seam and D; plugin repo final build/reload must use canonical source |
| A: accessibility/interaction | Keyboard and screen-reader audit scripts/manual protocol | axe (zero new serious/critical), tab order, focus visibility/return, Escape, selection/expanded/live-region semantics at both viewports; no lost pointer/touch behavior | Runs per UI track and again after combined integration |

Tracks may code in parallel after their dependency freezes, but **measure serially**. Each track records its result against the same clean baseline commit and fixture; after any upstream merge it reruns its target scenarios. Nobody rewrites the shared baseline, fixture, harness, lockfile, or root instrumentation concurrently. Assign single owners for those files and for generated plugin manifests/SDK types. Do not run Turbo/build/install or another browser benchmark on the benchmark host during sampling.

## Verification matrix

| Gate | D | L | T | C | P | Final combined acceptance |
|---|:---:|:---:|:---:|:---:|:---:|---|
| Focused Node/unit tests | ✓ | ✓ | ✓ | ✓ | ✓ | All affected packages green; tests fail on the pre-fix witness where applicable |
| Isolated DOM/component tests | selector adapter | ✓ | ✓ | ✓ | ✓ | Accessibility and interaction assertions at 1440×900 and 390×844 |
| P scenarios | S2/S3/S6 | S1/S6 | S2/S3 | S4/S5 | S5 | S0–S6, 7 samples each, all regression budgets pass |
| R scenarios | S2/S3/S6 | S1/S6 | S2/S3 | S4/S5 | S5 | Profiling preflight valid; unaffected-render assertions pass |
| Bundle/dependency | selected tool | route closure | route closure | route closure | plugin bundle | Existing `check:bundle`, license report, and incremental byte report pass |
| Fork filtered Turbo | affected package(s) | `@bb/app` | app/server/thread-view as touched | `@bb/app` | SDK/app as touched | `pnpm exec turbo run typecheck test build --filter=<each affected package>`; use Turbo, never direct package typecheck/build |
| Fork full suite |  |  |  |  |  | From materialized `fork/build/bb`: frozen install, `pnpm typecheck`, `pnpm test`, `pnpm build`; also `./scripts/verify` and namespace/materialization checks required by [`fork/README.md:12`](/home/ubuntu/bb/fork/README.md:12) |
| Org plugins |  |  |  |  | ✓ | From `plugins/`: frozen install, `bun run sync:check`, `references:check`, `sdk-types:check`, `typecheck`, `test`, `build` ([`plugins/AGENTS.md:20`](/home/ubuntu/bb/plugins/AGENTS.md:20)); build/reload touched plugins and prove `bb plugin source` resolves canonical source ([`plugins/AGENTS.md:45`](/home/ubuntu/bb/plugins/AGENTS.md:45)) |
| Community plugins, if touched |  |  |  |  | ✓ | `npm ci`, `npm run test`, `npm run typecheck`, `npm run build` ([`community-plugins/AGENTS.md:7`](/home/ubuntu/bb/community-plugins/AGENTS.md:7)) |
| Workspace composition |  |  |  |  |  | `./bin/check --role staging`, combined staging exercise, and exact child SHAs recorded; do not advance gitlinks before child commits are pushed ([`AGENTS.md:70`](/home/ubuntu/bb/AGENTS.md:70)) |

If only the fork changes, plugin suites are still required when the changed SDK/host surface can affect installed plugins. If no plugin or SDK boundary changes, document why plugin checks were not applicable rather than silently omitting them. Slow Turbo output should go to a file as required by the fork guidance ([`fork/upstream/AGENTS.md:55`](/home/ubuntu/bb/fork/upstream/AGENTS.md:55)).

## Superseded fork-wide merge order (not execution scope)

1. Land M harness mechanics and freeze baseline data without changing production bundles. Validate it against the unchanged tree.
2. Land G's ADR and only the selected direct dependency/adapter skeleton. Reject and remove the losing prototype completely; verify lockfile/license/bundle deltas.
3. Land D state graph and query/event bridge with contract tests. Freeze its public adapter.
4. Land L and T in either order; after the first merges, rebase and rerun the second's paired target scenarios. They may not update baseline expectations to absorb each other.
5. Land C once its combined S4/S5 results pass against the D/L/T head.
6. Land fork SDK/host seam before P, regenerate SDK types through the documented tool, then land organization/community plugin consumers. Exercise build/reload from canonical workspace paths.
7. Run A plus the full matrix on the exact combined child commits. Exercise staging, push children, then advance workspace gitlinks as one tested composition. Performance baseline ratchets may move **down** to record headroom only in a final, separately reviewed commit; upward moves require explicit approval and rationale.

## Rollback and bisect

- Keep M, G/D, L, T, C, and P as independently revertible commits/PRs. Do not combine behavior changes, dependency selection, generated SDK output, and baseline relaxation in one commit. Tag each benchmark artifact with the tested commit and parent.
- A regression found before promotion: revert the newest track, restore the prior lockfile through that revert, rebuild, clone a fresh fixture run directory, and rerun its target P/R cells plus S0. Never “fix” it by refreshing the baseline.
- A plugin regression: revert the plugin consumer first; if the host seam is backward-incompatible, revert the paired fork seam and SDK generation together. Reload and prove `bb plugin source` again.
- A post-integration regression: bisect child repositories first using a deterministic, non-interactive single-scenario harness exit code. Start with correctness/unit/bundle gates (cheap), then P timing (7-sample confirmation only for suspected boundary commits). If all children pass individually, bisect workspace composition/gitlinks because the failure is cross-track.
- A noisy timing bisect result is “inconclusive,” not good/bad. Repeat on a quiet host; use R render-count changes to narrow suspects but confirm the culprit in P. Retain the last-known-good artifact/manifests and exact workspace gitlinks for rollback.
- Production rollback advances the normal-host workspace pin back to the last tested workspace receipt; it does not independently move a child checkout. This preserves the workspace promotion invariant ([`AGENTS.md:49`](/home/ubuntu/bb/AGENTS.md:49)).
