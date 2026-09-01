# Version and registry

Read this reference when introducing ECharts, adding a chart or component, investigating version-sensitive behavior, changing renderers, or reviewing bundle size. Repository truth and a fixed trusted registry take precedence over online examples.

## Contents

- [Establish repository truth](#establish-repository-truth)
- [Keep one fixed modular registry](#keep-one-fixed-modular-registry)
- [Separate wrapper responsibilities](#separate-wrapper-responsibilities)
- [Contain version-sensitive behavior](#contain-version-sensitive-behavior)
- [Add a capability](#add-a-capability)
- [Verify the integration](#verify-the-integration)

## Establish repository truth

Before designing against an API, record:

- the exact `echarts` package and lockfile version;
- React and any wrapper package versions;
- imported entry points and registered chart/component/feature modules;
- supported SVG and Canvas lanes;
- whether custom series, transforms, progressive mode, large mode, universal transitions, or ZRender events are involved.

Useful local checks:

```bash
rg -n '"echarts"|echarts@' package.json package-lock.json pnpm-lock.yaml yarn.lock
npm ls echarts 2>/dev/null || pnpm why echarts 2>/dev/null || true
node -p "require('echarts/package.json').version"
rg -n "from ['\"]echarts|echarts\.use|echarts\.init|setOption|getZr" src packages apps plugins
```

Inspect the installed type declarations and implementation for exact behavior. Then consult the matching upstream tag, official API/option manual, handbook, tests, changelog, and issues in that order. Community examples can suggest search terms but should not establish a BB adapter invariant.

Record the ECharts version in diagnostics and minimal reproductions. Do not say “ECharts supports this” when the verified statement is only true for a different release.

## Keep one fixed modular registry

Use `echarts/core` and register a deliberate tree-shaken catalog at module scope:

```ts
// echarts-registry.ts
import { BarChart, LineChart } from "echarts/charts";
import {
  AriaComponent,
  DatasetComponent,
  GridComponent,
  TooltipComponent,
} from "echarts/components";
import * as echarts from "echarts/core";
import { SVGRenderer } from "echarts/renderers";

echarts.use([
  AriaComponent,
  BarChart,
  DatasetComponent,
  GridComponent,
  LineChart,
  SVGRenderer,
  TooltipComponent,
]);

export { echarts };
```

Align the option type with the same catalog:

```ts
type SupportedOption = ComposeOption<
  | AriaComponentOption
  | BarSeriesOption
  | DatasetComponentOption
  | GridComponentOption
  | LineSeriesOption
  | TooltipComponentOption
>;
```

Registration at module scope is shared by all figures that import that registry. Do not call `use()` during React rendering or mount. Do not let authored configuration trigger dynamic imports or arbitrary registration.

Prefer one registry for a coherent plugin or surface. If BB needs materially different lightweight and dense lanes, expose a small number of explicitly named registries or lazy entry points with non-overlapping ownership; do not create a registry per chart instance.

Register only capabilities actually compiled by the trusted adapter. A new import has four costs:

1. JavaScript parse/download size;
2. new option and lifecycle behavior to own;
3. a larger security and accessibility surface;
4. a larger renderer and interaction test matrix.

## Separate wrapper responsibilities

Use narrow modules with one-way dependencies:

```text
authored schema + canonical data
        ↓
figure compiler → CompiledFigure
        ↓
shared React host
        ↓
ECharts version adapter
        ↓
fixed modular registry → echarts/core
```

- **Registry**: imports ECharts charts, components, features, and renderers; calls `use()`; exports the typed core surface.
- **Version adapter**: contains verified differences in initialization, update flags, events/actions, theme behavior, export, and disposal for the pinned release.
- **Compiler**: translates a strict BB contract and canonical data into `CompiledFigure`; it may use option types but should not mount an instance.
- **React host**: owns non-zero-size initialization, updates, observers, event binding, and disposal; it does not know workload-specific authored schemas.
- **Application adapter**: turns normalized chart intents into BB menus, commands, references, or state updates.

Avoid a broad third-party React wrapper when it hides initialization, update decisions, event cleanup, renderer replacement, or access to `getZr()`. A wrapper is acceptable only if its lifecycle contract is inspected against the pinned versions and BB still owns these boundaries. Do not add a second wrapper beside an existing shared host for one new chart kind.

Keep direct ECharts imports out of ordinary feature components. This makes it possible to audit package usage, change the pinned version, and measure the chart dependency from one boundary.

## Contain version-sensitive behavior

The following are adapter decisions, not public schema fields:

- initialization options and renderer selection;
- `setOption` merge, `replaceMerge`, `notMerge`, `lazyUpdate`, and `silent` behavior;
- component removal and matching rules;
- event payload and action shapes;
- theme switching or rebuild requirements;
- ZRender blank-canvas events;
- image export readiness and supported formats;
- progressive, large-mode, transition, and custom-series behavior;
- grid, axis-label containment, or other major-version option changes.

For each relied-upon behavior:

1. Verify it in installed types and source or the matching upstream tag.
2. Reduce surprising behavior to a minimal non-React reproduction.
3. Encode the conclusion in the version adapter or compiler.
4. Add a sequence or interaction regression test.
5. Link the exact official source or issue in a nearby code comment when the invariant is not obvious.

Do not scatter major-version conditionals through visualizations. If more than one ECharts version must be supported, expose a typed adapter selected once from package/build truth. Keep authored schema versions independent from this choice.

## Add a capability

When adding a new chart, component, feature, renderer, or action:

1. Confirm the user-level capability cannot be expressed by the existing catalog.
2. Define its narrow trusted compiler path and authored intent, if any.
3. Add only the required modular import and option type.
4. Confirm required companion components; examples often omit imports visible only in full source.
5. Verify its event identity and structural update behavior.
6. Test every supported renderer lane and any optimized-data mode it uses.
7. Measure the incremental production bundle and relevant runtime path.
8. Add accessibility and cleanup behavior before declaring it available.

Named trusted custom marks follow the same process. Their implementation lives in versioned BB code and is registered through the trusted adapter. An authored bundle may select an allowlisted name and parameters; it may not provide `renderItem` or graphics code.

## Verify the integration

### Minimal kernel reproduction

Use the exact package version, a fixed-size element, one explicit renderer, minimal registration, deterministic data, and the smallest failing `setOption` sequence. Compare value-only merge, targeted replacement, full replacement, and renderer lanes when relevant. Dispose explicitly.

Then reproduce through the BB host to separate ECharts behavior from compiler identity or React lifecycle behavior.

### Static and build checks

- Search for direct `echarts`, `echarts/core`, and renderer imports outside the registry boundary.
- Confirm registry imports and `ComposeOption` members describe the same catalog.
- Confirm unsupported chart kinds fail schema validation rather than causing dynamic registration.
- Build the production target and compare raw and compressed output before and after a registry change.
- Check for duplicate ECharts versions or a wrapper bundling its own copy.

### Runtime matrix

Exercise:

- cold mount and same-structure value updates;
- component removal, addition, reorder, and retyping;
- hidden-to-visible sizing and repeated mount/unmount;
- supported SVG and Canvas paths;
- reduced motion and theme changes;
- pointer and keyboard actions promised by the feature;
- any progressive, large, transform, transition, or custom-series lane;
- export after render and after a structural update.

When behavior is version-sensitive, the durable result is a registry/adapter invariant plus a regression test, not a copied example option.
