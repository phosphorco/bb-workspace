# Compiled figure and identity

Read this reference when implementing a compiler, choosing update boundaries, resolving chart events, coordinating figures, or creating durable references. The goal is a rich trusted artifact between canonical BB data and the imperative ECharts host.

## Contents

- [Why the option is insufficient](#why-the-option-is-insufficient)
- [Recommended artifact](#recommended-artifact)
- [Structural and component identity](#structural-and-component-identity)
- [Datum identity](#datum-identity)
- [Compilation sequence](#compilation-sequence)
- [Event lookup](#event-lookup)
- [Identity and update tests](#identity-and-update-tests)

## Why the option is insufficient

An `EChartsCoreOption` describes rendering, but it does not reliably answer:

- whether a new option is a value-only update or a semantic replacement;
- which application datum a hit represents after sorting or shaping;
- which rows are plotted, omitted, accessible, or exportable;
- which BB commands are valid for a target;
- which semantic item corresponds to a mark in another chart;
- whether an old menu target or reference belongs to the current generation.

Do not make the React host rediscover these facts from the option. Compile them once from the authored spec and canonical data.

## Recommended artifact

Adapt the following shape to the workload without collapsing its responsibilities:

```ts
type Scalar = string | number | boolean | null;
type RendererKind = "svg" | "canvas";
type ComponentFamily =
  | "dataset"
  | "series"
  | "xAxis"
  | "yAxis"
  | "grid"
  | "legend"
  | "visualMap"
  | "dataZoom"
  | "graphic";

type ComponentStructure = {
  family: ComponentFamily;
  id: string;
  kind: string;
  bindingSignature: string;
};

type InteractiveDatumMeta = {
  // Stable inside one canonical-data generation.
  datumKey: string;
  generation: string;
  // Stable across generations only when the application can prove it.
  semanticKey?: string;
  values: Readonly<Record<string, Scalar>>;
  capabilityIds: readonly string[];
  provenance?: unknown; // Replace with a narrow workload-owned union.
};

type DatumLocator = {
  seriesId: string;
  dataIndex: number;
};

type CompiledFigure = {
  figureId: string;
  option: EChartsCoreOption;
  renderer: RendererKind;
  structuralSignature: string;
  structure: readonly ComponentStructure[];
  datumIndex: ReadonlyMap<string, readonly InteractiveDatumMeta[]>;
  semanticIndex: ReadonlyMap<string, readonly DatumLocator[]>;
  plottedDatumKeys: readonly string[];
  plottedCount: number;
  totalCount: number;
  eventPolicy: CompiledEventPolicy;
  accessibleData: CanonicalFigureData;
  exportData: CanonicalFigureData;
};
```

`accessibleData` and `exportData` may reference the same immutable canonical data or different explicitly labeled bounded views. They must not be reconstructed from `series.data`.

`provenance` is intentionally workload-owned. A diagnostics chart may store a process or metric locator; analytics may store a query/result reference. Keep it typed, bounded, generation-aware, and safe to authorize. Never put arbitrary source rows or executable expressions in it.

## Structural and component identity

Assign every long-lived ECharts component an explicit deterministic `id`:

- datasets;
- coordinate systems and grids;
- axes;
- series;
- legends, visual maps, and zoom components;
- trusted graphic groups or custom-series structures.

Derive an ID from durable figure structure, such as `figureId + role + binding`, not array position or a displayed title. A display label can change without making the component a new component.

The structural signature is a canonical digest or serialization of facts that change update semantics:

- figure kind and coordinate system;
- component families, stable IDs, and kinds;
- field/encoding bindings;
- stack, grouping, axis, dataset, and transform topology;
- interaction mapping and selection meaning;
- trusted custom-mark implementation version.

Do not include ordinary values, row counts, resolved colors, transient hover, or display-only text unless changing them truly invalidates component state. Keep renderer and other initialization-bound choices as explicit fields; the host uses them in its instance key even if the structural signature also records them for diagnostics.

Keep the structured input used to compute the signature, not only an opaque hash. The host can then distinguish:

- value-only merge by stable IDs;
- targeted `replaceMerge` for removed or retyped component families;
- full semantic replacement;
- instance rebuild for renderer or other initialization-bound changes.

Bundle or component authors never choose these strategies.

## Datum identity

Use separate names for separate guarantees:

- **`datumKey`** identifies one canonical datum within a specific `generation`. It must be deterministic for that generation.
- **`semanticKey`** identifies the same domain entity or group across updates or figures. Supply it only when the application can prove that meaning.
- **`dataIndex`** is a transient position in one compiled ECharts series. It is a lookup coordinate, never identity.

A good datum key is built before ECharts from stable application fields or a deterministic keyed encoding. Do not use the displayed label alone when labels can collide. Do not use a database row ID unless it is an appropriate application capability.

For aggregated or synthetic marks, the datum metadata must still explain what the mark means. Prefer compact typed provenance or an authorized lookup token over embedding every contributing record.

Build `datumIndex` in the final compiled series order. If the compiler sorts, buckets, splits, stacks, samples, or expands data, perform that shaping before constructing the option and identity map. Avoid ECharts-side transforms for interactive figures when they make final source mapping ambiguous.

When using a dataset, include only a harmless opaque lookup handle in chart data if the pinned ECharts event path requires one. Resolve that handle through an adapter-owned map; do not place sensitive metadata in `params.data`, generated SVG attributes, tooltips, or exported chart state.

## Compilation sequence

Use a deterministic sequence:

1. Resolve authored schema version and defaults.
2. Resolve all field bindings against `CanonicalFigureData`.
3. Validate mark, field types, interactions, renderer lane, and limits together.
4. Shape and bound data in BB code, preserving the contract's declared order.
5. Create deterministic structural component IDs.
6. Create `datumKey`, optional `semanticKey`, and typed provenance for every interactive mark.
7. Build the ECharts dataset and series from the same final ordered records used by `datumIndex`.
8. Construct trusted tooltip, ARIA, theme, and interaction options.
9. Build `eventPolicy`, reverse semantic lookup, accessible data, and export data.
10. Compute structured topology and `structuralSignature`.
11. Freeze or otherwise guard the result from mutation in development.

Selection of a top-N subset or downsample is part of canonical shaping. Preserve upstream order unless the contract explicitly declares another ordering rule, and expose `plottedCount` versus `totalCount` whenever reduction occurs.

## Event lookup

Normalize raw events at the adapter boundary:

```ts
type ChartHitTarget =
  | {
      kind: "datum";
      figureId: string;
      seriesId: string;
      datum: InteractiveDatumMeta;
    }
  | { kind: "series"; figureId: string; seriesId: string }
  | { kind: "canvas"; figureId: string };

type ChartIntent =
  | { kind: "OpenContextMenu"; target: ChartHitTarget; clientX: number; clientY: number }
  | { kind: "ActivateDatum"; target: Extract<ChartHitTarget, { kind: "datum" }> }
  | { kind: "PreviewSelection"; figureId: string; datumKeys: readonly string[] }
  | { kind: "SetLocalViewport"; figureId: string; viewport: unknown };
```

For a component event:

1. Confirm the event kind is allowlisted by `eventPolicy`.
2. Resolve an explicit `seriesId`; do not translate from `seriesIndex` unless a compiled series-index table exists for that exact generation.
3. Validate the reported datum position or opaque handle.
4. Resolve metadata through the current `CompiledFigure`.
5. Copy the resolved metadata needed by the action into an immutable target. A menu that remains open must not silently retarget when new data arrives.
6. Emit a `ChartIntent`; discard the raw event after extracting pointer coordinates and safe diagnostics.

For empty-canvas behavior, listen to ZRender and require no hit target. Prevent duplicate handling when a component event and ZRender observe the same native event.

Coordinate linked emphasis by `semanticKey`. Each compiled figure uses `semanticIndex` to translate that key to its local series/data locations before calling `dispatchAction()`. Never coordinate charts by matching array indexes.

If an event cannot be resolved exactly, ignore it or surface bounded diagnostics. Do not guess from a label, pixel position, or stale index.

## Identity and update tests

Test behavior across sequences, not only an initial option:

- same structure with changed values and reordered canonical rows;
- series counts changing `4 → 2 → 0 → 3`;
- a series keeping its ID while its binding changes;
- duplicate display labels with distinct datum keys;
- sort, split, stack, reduction, and null-heavy inputs;
- a stale generation event or an open menu followed by a new generation;
- linked figures with different local ordering but the same semantic keys;
- unsupported or missing series IDs and out-of-bounds data indexes;
- reduced plotted data with truthful `plottedCount` and `totalCount`;
- repeated compilation producing identical IDs and signatures.

Assert the semantic compiled structure and resolved intents. `getOption()` snapshots, generated SVG, and ECharts array positions are not the product contract.
