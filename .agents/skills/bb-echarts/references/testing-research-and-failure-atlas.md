# Testing, research, diagnostics, and failure atlas

Read this reference for ECharts lifecycle or interaction tests, unfamiliar or
version-sensitive behavior, hard-to-reproduce bugs, and performance/leak
diagnostics. The durable outcome of an investigation is an adapter invariant
plus a regression test, not an unexplained option tweak.

## Contents

- [Test the adapter by layer](#test-the-adapter-by-layer)
- [Use sequence and lifecycle matrices](#use-sequence-and-lifecycle-matrices)
- [Research the pinned version](#research-the-pinned-version)
- [Reduce surprising behavior](#reduce-surprising-behavior)
- [Capture bounded diagnostics](#capture-bounded-diagnostics)
- [Trace interactions end to end](#trace-interactions-end-to-end)
- [Failure atlas](#failure-atlas)
- [Close the research loop](#close-the-research-loop)

## Test the adapter by layer

Use the smallest layer that can prove the behavior:

1. **Schema/contract tests** reject unsupported and executable input.
2. **Compiler tests** assert stable IDs, field bindings, datum maps, structural
   signatures, plotted/export sets, and deterministic option structure.
3. **Update-policy tests** feed previous/next `CompiledFigure` pairs to the
   merge decision without a browser.
4. **Host lifecycle tests** use a real DOM/layout-capable browser when sizing,
   ResizeObserver, focus, canvas/SVG behavior, or disposal matters.
5. **Interaction tests** start from user input and assert the normalized BB
   intent, capability, command, or reference—not only an ECharts callback.
6. **Performance/leak tests** measure mount, update, resize, interaction,
   export, disposal, bundle bytes, retained instances, and idle work.

Mock ECharts only to test BB-owned policy. A mock cannot validate renderer hit
testing, layout, export, merge semantics, or event ordering. Conversely, avoid
full browser tests for pure stable-ID or capability-resolution functions.

Do not make `getOption()`, generated SVG structure, canvas pixels, tooltip DOM,
or ECharts' ARIA sentence the general snapshot contract. Assert the compiled
semantic structure and observable user behavior. Use a narrow visual regression
fixture only where geometry or theme fidelity is itself the requirement.

## Use sequence and lifecycle matrices

A clean first mount proves little about a long-lived chart. Exercise state
transitions:

```text
A: four series with stable IDs
B: same structure, changed values
C: two series
D: zero series / empty state
E: three series in a different order
F: same values with a different field binding
G: renderer or another initialization-bound choice changes
```

Verify the selected strategy for each transition: merge, targeted
`replaceMerge`, full replacement, or instance rebuild. Check that removed
components disappear and valid local state is preserved only when semantics
remain compatible.

Lifecycle matrix:

| Dimension | Cases |
|---|---|
| Initial size | normal, zero-sized then revealed, very small |
| React lifecycle | development remount, repeated mount/unmount, parent key change |
| Resize | unchanged notification, split-pane drag, rapid burst, zero, reveal |
| Theme/motion | initial theme, theme mutation, reduced motion before/after mount |
| Data | empty, one row, null-heavy, extreme values, bounded dense lane |
| Identity | sorted, filtered, reordered, reduced, duplicated display labels |
| Renderer | every supported SVG/Canvas capability lane |
| Interaction | datum, series, blank canvas, keyboard equivalent, stale event |
| Overlay | menu during update, escape, outside click, focus restoration |
| Export | steady, animating, superseded generation, over limit, unauthorized |

For resize, assert that the host element—not an ECharts-generated child—is
observed, zero/unchanged dimensions are ignored, work is coalesced, and no
observer or animation-frame callback survives cleanup.

For events, count bindings and unbindings. A handler should be bound once per
instance, read current callbacks safely, and never fire after disposal.

## Research the pinned version

Establish repository truth before searching the web:

```bash
npm ls echarts
node -p "require('echarts/package.json').version"
rg -n '"echarts"|echarts@' package.json package-lock.json pnpm-lock.yaml yarn.lock
rg -n 'from ["'"']echarts|echarts\.use|echarts\.init|setOption' .
```

Record modular entry points, registered charts/components/features/renderers,
wrapper packages, React version, renderer, and whether the path uses transforms,
large/progressive mode, universal transition, graphic, or custom series.

Use evidence in this order:

1. exact installed declarations, implementation, and tests;
2. matching upstream release tag;
3. official option and API manuals;
4. official handbook and full-source examples;
5. official changelog, upgrade guide, repository tests, and issues;
6. ZRender source for low-level events and renderer behavior.

Useful official entry points:

- [ECharts API](https://echarts.apache.org/en/api.html)
- [ECharts option manual](https://echarts.apache.org/en/option.html)
- [ECharts handbook](https://echarts.apache.org/handbook/en/)
- [ECharts source and releases](https://github.com/apache/echarts)
- [ECharts events and actions](https://echarts.apache.org/handbook/en/concepts/event/)
- [ECharts chart size and lifecycle](https://echarts.apache.org/handbook/en/concepts/chart-size/)
- [Canvas versus SVG](https://echarts.apache.org/handbook/en/best-practices/canvas-vs-svg/)
- [ECharts accessibility](https://echarts.apache.org/handbook/en/best-practices/aria/)
- [ZRender source](https://github.com/ecomfe/zrender)

Online examples often omit modular registration, initialization, event cleanup,
or version context. Translate their intent into the BB compiler/host; do not
copy an unrestricted option object into the public contract. Community posts
can supply search vocabulary, but a version-sensitive adapter decision needs an
official or installed-source basis.

## Reduce surprising behavior

First reproduce ECharts behavior without React or the application:

```text
exact package version
one fixed-size host
one explicit renderer
minimal modular registry
small deterministic data
one chart instance
smallest failing setOption/event/export sequence
explicit disposal
```

Vary only the implicated dimension: default merge versus `replaceMerge` versus
`notMerge`; SVG versus Canvas; animation on/off; ordinary versus progressive or
large mode. Preserve the whole failing sequence rather than loading only its
final state.

Then reproduce through the BB adapter. This separates an ECharts kernel fact
from a compiler, identity, lifecycle, theme, overlay, or application-state bug.
If browser automation is unavailable, state that limit explicitly; an SSR SVG
smoke test does not validate size observation, focus, pointer hit testing, or
Canvas.

## Capture bounded diagnostics

Make the adapter able to explain what it did without dumping sensitive data or
the entire option:

```ts
type FigureDiagnostic = {
  pluginId: string;
  figureId: string;
  figureSpecVersion: number;
  echartsVersion: string;
  renderer: "svg" | "canvas";
  generation: string;
  rowCount: number;
  plottedMarkCount: number;
  structuralSignature: string;
  componentIds: {
    datasets: readonly string[];
    axes: readonly string[];
    series: readonly string[];
  };
  updateStrategy: "merge" | "replace-merge" | "not-merge" | "rebuild";
  replaceFamilies?: readonly string[];
  size: { width: number; height: number };
  localState: {
    zoomed: boolean;
    legendOverrides: number;
    menuOpen: boolean;
  };
};
```

Useful development counters include live ECharts instances, active ECharts and
ZRender handlers, ResizeObservers, pending resize frames, off-screen export
instances, menu overlays, updates by strategy, and discarded stale exports or
events. Keep counters development-only or bounded/cheap in production.

Redact canonical row values, reference context, authored labels that may contain
secrets, full options, and raw events by default. An authorized debug export can
include more detail, but should remain bounded and versioned.

## Trace interactions end to end

An interaction trace should show where identity or intent changed:

```text
native event identity
  -> ECharts or ZRender event name
  -> stable figure/component/series IDs
  -> raw indices (diagnostic only)
  -> resolved InteractiveDatumMeta
  -> normalized ChartIntent
  -> resolved menu capabilities
  -> selected application command
  -> application revision/state transition
  -> optional reference capsule ID
  -> visual state restoration by stable identity
```

Include the compiled revision on both the event and datum-index side so a late
event cannot resolve against newer data. For an analytics dashboard, extend the
trace with query generation, predicates, dependencies, and provenance using the
`bb-echarts-analytics` skill; those are not universal ECharts requirements.

Trace state changes, not continuous pointer movement. Bound repeated messages,
hash or redact sensitive IDs where appropriate, and provide a user-visible way
to disable verbose diagnostics.

## Failure atlas

| Symptom | Likely cause | Inspect | Containment |
|---|---|---|---|
| Removed series remains visible | Default merge retained an old component | Stable IDs and update decision | Targeted `replaceMerge`; sequence test |
| Values attach to the wrong series | Matching relied on array order or names | Compiled IDs before/after | Explicit stable IDs |
| Old axis, dataset, legend, or graphic survives | Replacement omitted that component family | Structure diff and replace families | Include family or use full replacement |
| Zoom resets on every update | Full replacement/rebuild for value-only changes | Structural signature | Merge stable structure; restore valid local state |
| Zoom survives a semantically different figure | Merge preserved invalid local state | Field bindings and figure identity | Structural replacement; clear invalid state |
| Click opens the wrong item | `dataIndex` was treated as identity | Final plotted order and datum index | Resolve immediately to application identity |
| Stale click opens a new-generation item | Event and datum map revisions were not checked | Compiled revision in trace | Reject stale events |
| Datum menu works but blank menu does not | Only ECharts component events are bound | ZRender listener | Bind `getZr()` and require no target |
| Both menus open on one right-click | Item and ZRender paths handled the same event | Native event/target trace | Ignore targeted ZRender event; dedupe if needed |
| Browser menu appears with the BB menu | Default was not prevented on handled event | Underlying native event | Prevent only when opening BB menu |
| Menu closes or moves during chart update | Overlay state is owned by chart DOM | Overlay owner and anchor strategy | Keep native menu state outside the instance |
| Menu loses focus after close | No invoking control/return target | Focus trace | Native menu focus restoration |
| Right-click is the only way to act | Generated marks were treated as the UI | Exact table and figure actions | Add native keyboard path |
| Copied reference opens a different item | Pixel/index/display label was serialized | Reference capsule | Store scoped stable application identity |
| Chat reference loses context | Rich context was put only on clipboard | Mention provider resolution | Store capsule; resolve at send time |
| Possessing a reference bypasses access checks | Resolver trusted the token as authority | Authorization path | Re-authorize every resolve |
| Chart stays 0x0 after reveal | Initialized hidden or never resized | Host size at init/reveal | Non-zero guard plus host ResizeObserver |
| Resize loops or burns CPU | Generated child observed or unchanged sizes reapplied | Observer target/counters | Observe host; dedupe and coalesce |
| Memory grows after navigation | Missing disposal, observer cleanup, listener cleanup, or URL revocation | Live-resource counters | Centralized cleanup and remount test |
| Theme changes but labels keep old colors | Resolved theme values were not recompiled | Theme fingerprint and option | Recompile affected styling |
| Theme observer triggers constant updates | Broad mutations have no resolved fingerprint gate | Mutation/update trace | Compare coalesced resolved theme fingerprint |
| Animation persists under reduced motion | Preference checked only once or not compiled | Media listener and option | Reapply bounded no-motion policy |
| Interaction breaks in dense mode | Progressive/large mode weakened per-item behavior | Capability matrix | Reduce data or choose interactive lane |
| CSV differs from exact table | Export read chart state or a different subset | Canonical export relation | One declared canonical source and scope label |
| CSV opens as formulas | User text was quoted but not formula-neutralized | Serialized leading characters | Neutralize before quoting; regression fixtures |
| SVG export missing from Canvas chart | Renderer is initialization-bound | Renderer/export policy | Bounded off-screen SVG render or disable action |
| Image captures half a transition | Export started outside steady render state | Revision and render boundary | Disable animation/wait; discard stale capture |
| Repeated exports leak memory | Off-screen chart or object URL is retained | Export resource counters | Dispose/revoke in success and failure paths |
| Tooltip becomes an injection surface | Authored HTML/CSS/formatter reached ECharts | Schema/compiler | Structured fields and trusted renderer only |
| Bundle size jumps unexpectedly | Whole ECharts package or arbitrary catalog imported | Import graph/build artifact | Modular fixed registry via `echarts/core` |
| Tests are noisy across upgrades | Generated SVG or `getOption()` is the snapshot | Assertion target | Assert compiled semantics and behavior |

## Close the research loop

For each non-obvious finding:

1. record the exact ECharts/ZRender version and renderer;
2. preserve the minimal failing sequence;
3. classify the failed BB boundary: contract, compiler, identity, host lifecycle,
   update policy, renderer lane, menu/reference, accessibility, or export;
4. distinguish documented behavior, implementation-derived behavior, and a
   suspected upstream bug;
5. add the smallest adapter invariant that contains it;
6. add a regression test at the lowest reliable layer;
7. add a diagnostic field only if the failure was otherwise hard to observe;
8. link the matching official source, tag, changelog, or issue in the relevant
   code comment when the rule is version-sensitive.

Add a failure-atlas entry only when the symptom and containment recur across BB
ECharts surfaces. Keep one-off product rules in the owning plugin.
