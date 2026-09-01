# Ownership and contracts

Read this reference when defining or reviewing the boundary between authored BB configuration, trusted adapter code, and ECharts. It applies to analytical figures, diagnostics, timelines, resource monitors, and other BB surfaces.

## Contents

- [The ownership boundary](#the-ownership-boundary)
- [Representation layers](#representation-layers)
- [Designing an authored contract](#designing-an-authored-contract)
- [Compiler and host responsibilities](#compiler-and-host-responsibilities)
- [Capability growth](#capability-growth)
- [Boundary review](#boundary-review)

## The ownership boundary

Treat ECharts as a trusted rendering dependency, not as an authoring language or application state store.

| BB owns | ECharts owns |
|---|---|
| Versioned authored schema and validation | Drawing and layout |
| Canonical application data and its identity | Coordinate systems and scales |
| Semantic selection and command state | Hit testing and low-level events |
| Menus, references, permissions, and undo | Transient emphasis and animation |
| Accessible exact-value surfaces | Canvas or SVG implementation |
| Export policy and trusted filenames | Image rendering from a chart instance |
| Mounting, updates, observation, and disposal | Internal component models |

An ECharts feature belongs in BB only when the adapter can preserve this division. If adopting it requires authors to supply executable configuration or makes ECharts' internal model the only source of truth, the integration is at the wrong boundary.

## Representation layers

Keep these values separate even when an initial implementation is small:

```text
AuthoredFigureSpec
    + CanonicalFigureData
    + resolved BB theme and capabilities
        → trusted compiler
        → CompiledFigure
        → shared ECharts host

ECharts or ZRender event
        → compiled identity lookup
        → ChartIntent
        → BB command, menu, or application state
```

Use the following names across BB ECharts adapters:

- **`AuthoredFigureSpec`**: durable, serializable, strictly validated intent. It can come from source code, a plugin manifest, or an agent-authored artifact.
- **`CanonicalFigureData`**: application-owned data plus schema, generation, and stable keys. It is the truth for exact inspection and data export.
- **`CompiledFigure`**: trusted, ephemeral ECharts option plus identity maps and adapter metadata. See [compiled-figure-and-identity.md](compiled-figure-and-identity.md).
- **`FigureRuntimeState`**: local presentation state such as zoom, legend visibility, or hover.
- **`ChartIntent`**: a BB-owned semantic event derived from a raw ECharts or ZRender event.

Do not persist a compiled option or `getOption()` result. Do not infer canonical data or application state by reading ECharts back.

## Designing an authored contract

An authored contract should express recurring user intent with a small vocabulary. A diagnostics surface might use:

```ts
type AuthoredFigureSpecV1 = {
  version: 1;
  id: string;
  title: string;
  mark:
    | { kind: "bar"; orientation?: "horizontal" | "vertical" }
    | { kind: "line"; curve?: "linear" | "monotone" };
  encoding: {
    x: { field: string };
    y: { field: string };
  };
  interactions?: {
    contextMenu?: boolean;
    localZoom?: boolean;
  };
};
```

The exact vocabulary is workload-specific. The safety rules are shared:

1. Parse into a closed object schema and reject unknown keys.
2. Bound strings, arrays, nested depth, data cardinality, and serialized size according to the workload.
3. Resolve field names and encodings against `CanonicalFigureData` before compiling.
4. Validate combinations, not only individual fields: the mark, field types, renderer lane, and interaction promises must be compatible.
5. Construct trusted ECharts objects field by field. Never spread an authored object into an option.
6. Keep schema versions independent from the ECharts package version. Migrate authored specs, not raw options.

Do not expose any of the following as generic authored escape hatches:

- `option`, `seriesOption`, `toolboxFeature`, or arbitrary component fragments;
- functions, callback source, formatter source, transform expressions, or `renderItem`;
- raw HTML, CSS, URLs, regular expressions, or rich-text token definitions;
- event names, event handlers, actions, or ZRender elements;
- `notMerge`, `replaceMerge`, `lazyUpdate`, renderer initialization options, or animation thresholds.

Trusted formatters and custom marks are acceptable as named, versioned capabilities implemented in BB code. The authored spec selects a capability and supplies narrowly validated parameters; it never supplies implementation code.

## Compiler and host responsibilities

The compiler owns semantic validation and translation:

```text
validated spec + canonical data + theme + capability registry
    → resolved field bindings
    → deterministic component IDs
    → bounded plotted data in final order
    → trusted option and event policy
    → CompiledFigure
```

Compilation should be a total, deterministic function over validated inputs. It should report a useful validation error instead of producing a partly valid chart. In development, freeze compiled structures or otherwise prevent accidental mutation after publication.

The shared host owns imperative lifecycle and version-sensitive operations:

- initialize only at non-zero size;
- choose the renderer before initialization;
- apply updates according to compiled structural information;
- bind and unbind ECharts and ZRender events once per instance;
- observe the host element, theme, visibility, and reduced-motion inputs;
- dispose exactly once and rebuild when an initialization-bound choice changes.

Do not distribute these responsibilities among individual bar, line, and scatter React components. Those components may choose a spec or layout, but they should render through the same host.

The application shell owns actions produced by the chart:

- turn a normalized `ChartIntent` into a native BB menu or command;
- authorize reference, navigation, and export actions;
- preserve semantic state across chart replacement;
- supply keyboard equivalents and an exact-value representation;
- decide what can be copied, exported, persisted, or sent to an agent.

## Capability growth

Add a new ECharts feature in this order:

1. Name the BB-level user or application intent.
2. Decide whether it is durable authored intent, runtime presentation state, or an application command.
3. Add the narrowest schema or host capability that expresses it.
4. Register only the chart and components required by the capability.
5. Compile stable structure and datum identity.
6. Normalize its events to BB-owned types.
7. Test malformed specs, structural updates, cleanup, accessibility, and any renderer-specific behavior.

Do not use a generic passthrough field to avoid evolving the contract. A small strict contract can acquire new versions; an unrestricted option blob cannot be made safe or portable after the fact.

## Boundary review

Before accepting an integration, verify:

- The public surface can be serialized as data and contains no executable or presentation-language escape hatches.
- Unknown properties and unsupported combinations fail validation.
- Canonical data remains available without mounting ECharts.
- Every application action resolves through BB-owned identity and authorization.
- Native BB UI owns menus, focus, clipboard, references, and commands.
- The compiler, registry, and host are shared rather than recreated per chart kind.
- `getOption()`, raw events, array positions, and generated SVG/canvas nodes are never application truth.
- Schema evolution is decoupled from ECharts upgrades.
- Exact inspection and essential actions do not require pointer access to the graphical surface.
