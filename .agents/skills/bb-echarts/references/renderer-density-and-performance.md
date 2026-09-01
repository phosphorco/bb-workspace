# Renderer, density, and performance

Choose a rendering lane from the workload and required behavior, then keep it stable for the ECharts instance. Density is an application contract: it determines what data is shown, which interactions remain exact, and what the user can export or reference.

## Contents

- [Start with a workload contract](#start-with-a-workload-contract)
- [Reduce before changing render semantics](#reduce-before-changing-render-semantics)
- [Choose SVG or Canvas by evidence](#choose-svg-or-canvas-by-evidence)
- [Treat progressive and large modes as capability changes](#treat-progressive-and-large-modes-as-capability-changes)
- [Keep work proportional](#keep-work-proportional)
- [Measure the whole lifecycle](#measure-the-whole-lifecycle)

## Start with a workload contract

Before selecting a renderer or optimization, record:

```ts
type RenderingWorkload = {
  figureKind: string;
  resultRows: number;
  estimatedMarks: number;
  visibleFigureCount: number;
  requiresPerDatumHitTesting: boolean;
  requiresDatumReferences: boolean;
  requiresBrushIdentity: boolean;
  requiresSvgExport: boolean;
  usesLabelsOrHeavyEffects: boolean;
  expectedUpdateRate: "sporadic" | "interactive" | "streaming";
  platformClass: "desktop" | "mobile";
};
```

`resultRows` and `estimatedMarks` are different. A row can produce several series marks, symbols, labels, graphic elements, or stacked segments. Axes, ticks, annotations, and simultaneous figures also contribute to layout and paint cost.

Name the required interaction matrix before optimizing. A renderer lane is unacceptable if it makes a required click, context-menu datum reference, brush identity, keyboard equivalent, or export unreliable.

Put thresholds in one named, versioned policy. Do not scatter `markCount > N` checks through figure compilers. Avoid policies that oscillate around a threshold: renderer changes rebuild the instance and can invalidate local state.

## Reduce before changing render semantics

Prefer semantic reduction in the owning data layer over renderer tricks:

1. Filter to the relevant population and time range.
2. Aggregate or bucket at the grain the question needs.
3. Select top-N or representative categories with a declared ordering and an explicit remainder policy.
4. Downsample continuous series with an algorithm chosen for the analytical meaning.
5. Bound the result and disclose `showing N of M` or equivalent coverage.
6. Keep an exact canonical result or detail path for tables, exports, inspection, and references when the product promises it.

Do not slice whatever rows arrived and call the result “top N.” Do not reorder a sliced prefix in the chart adapter. The producer should make ordering and reduction truthful before compilation.

For generic monitoring or streaming surfaces, use a bounded ring buffer and compact older history into stable buckets. For query-backed analytics, perform grouping, windows, and sampling in the relational engine. In both cases:

- preserve extrema and discontinuities when they matter;
- record the reduction method and original/visible counts;
- ensure selected marks map to stable source identity or declared aggregate provenance;
- avoid recomputing the entire history for one appended point;
- never imply a reduced preview is a statistically representative sample unless the sampling design proves it.

The graphical lane may be reduced while an adjacent exact representation remains available. Keep those scopes explicitly labeled rather than silently mixing plotted rows with export rows.

## Choose SVG or Canvas by evidence

Renderer selection is initialization-bound.

| Consideration | SVG is often a useful candidate | Canvas is often a useful candidate |
| --- | --- | --- |
| Workload | Bounded marks; several simultaneous small figures | Dense marks or effects shown by measurement to favor raster drawing |
| Output | Crisp vector output and inspectable DOM are required | Raster output is acceptable |
| Interaction | Exact behavior has been verified for the SVG lane | Exact behavior has been verified for the Canvas lane |
| Cost shape | DOM/node and style costs remain bounded | Redrawing and backing-store memory remain bounded |

These are candidates, not a universal mark threshold. Chart kind, labels, effects, browser, device pixel ratio, visible figure count, update frequency, and ECharts version can reverse a simple rule of thumb.

For a renderer policy:

- benchmark the actual BB card dimensions and dashboard multiplicity;
- include low-end or mobile hardware if supported;
- keep the chosen renderer stable until an initialization-bound input changes;
- rebuild deliberately when it changes;
- retain semantic identity and event normalization in either lane;
- promise SVG image export only from a tested SVG path, or create a bounded off-screen SVG render from the same compiled truth.

Register only the supported series, components, features, and renderers through `echarts/core`. Evaluate raw and compressed production bundle closure alongside runtime performance; a fast chart that forces a large unused registry into every BB surface is not a complete win.

## Treat progressive and large modes as capability changes

ECharts progressive and series-specific large modes are not transparent speed switches. Their exact behavior is series- and version-sensitive, and they may change rendering, animation, hit testing, event payloads, or supported styling.

Before enabling an optimized lane, test this matrix with the pinned version:

| Capability | Ordinary | Progressive candidate | Large candidate |
| --- | ---: | ---: | ---: |
| Item hover and click resolve stable identity | test | test | test |
| Right-click resolves the exact datum | test | test | test |
| Brush or selection returns usable identity | test | test | test |
| Tooltip and emphasis remain correct | test | test | test |
| Animation and interruption are truthful | test | test | test |
| Image export reaches a known steady state | test | test | test |
| Repeated updates release memory | test | test | test |
| Keyboard-accessible parallel actions agree | test | test | test |

If an optimized mode loses a required capability, choose query/source reduction, a different mark, or a clearly labeled overview/detail design. Do not silently downgrade interaction because the chart crossed a hidden threshold.

Keep raw ECharts indices diagnostic-only in every lane. Sorting, transforms, progressive work, or series splitting can make positional identity unsafe; resolve through the adapter's final compiled datum map.

## Keep work proportional

A long-lived chart should be quiet while its inputs and container are unchanged.

- Do not poll or animate solely to prove the chart is alive.
- Pause upstream polling or streaming work when the owning BB surface is hidden if the product contract permits, then reconcile once on reveal.
- Avoid copying or reshaping the complete dataset in both React and the chart host on every update.
- Reuse canonical typed results and stable compiled structures; perform one deliberate final shaping pass that also creates identity metadata.
- Coalesce resize and theme notifications per frame.
- Apply only the component families that changed; do not reconstruct the ECharts instance for values alone.
- Avoid `showSymbol`, labels, shadows, gradients, and per-item styling at densities where they add large work without conveying information.
- Bound tooltip, selection, and debug payloads. Never log full options or datasets during routine operation.
- Limit concurrent chart initialization on dashboards with many figures; preserve the first-use and accessibility contract when deferring offscreen work.

React render counts and ECharts drawing cost are separate. A memoized host can still do expensive `setOption()` work, and a cheap option update can still be preceded by broad React recomputation. Measure both boundaries.

## Measure the whole lifecycle

Freeze the fixture, data counts, ECharts version, renderer, build mode, browser revision, OS, viewport, device pixel ratio, theme, motion preference, cache state, and visible figure count. Alternate control and candidate runs and retain raw traces.

Measure at least:

- module load and registry bundle closure;
- first nonzero size to first completed useful render;
- same-structure value update;
- structural replacement and renderer rebuild;
- resize burst during split-pane drag;
- pointer, tooltip, zoom, brush, and context-menu latency for enabled features;
- reduced-data preparation and allocations;
- image export to completed capture;
- repeated mount/unmount and retained heap;
- hidden-to-visible reconciliation;
- ordinary and stress density with one and many visible figures.

Use two lanes:

| Lane | Purpose | Useful verdicts |
| --- | --- | --- |
| Production build without profiling instrumentation | User-visible performance | input/update-to-paint, long tasks, frame stability, heap, raw/compressed closure |
| Render-attribution build with instrumentation installed before React | Ownership diagnosis | React commits, component identities, render reasons, update fan-out |

Do not compare milliseconds across the lanes. Profiling instrumentation changes timing.

Report distributions, not one favorable run. Establish median and tail behavior, then define algebraic gates with both relative and absolute tolerances. A renderer or reduction policy graduates only when its capability tests pass and it improves the workload it is intended to serve without regressing ordinary figures.
