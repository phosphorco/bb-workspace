# React lifecycle and updates

Use one BB-owned host component for every ECharts instance. Leaf figures supply a compiled figure and normalized callbacks; they do not initialize ECharts, own observers, or choose merge flags.

## Contents

- [Separate the lifetimes](#separate-the-lifetimes)
- [Initialize only when usable](#initialize-only-when-usable)
- [Resize from the host element](#resize-from-the-host-element)
- [Clean up the exact instance](#clean-up-the-exact-instance)
- [Apply compiled updates deliberately](#apply-compiled-updates-deliberately)
- [Keep React out of the rendering loop](#keep-react-out-of-the-rendering-loop)
- [Test sequences, not screenshots](#test-sequences-not-screenshots)

## Separate the lifetimes

Treat these as different lifetimes:

1. **React host lifetime** — the mounted container and its adapter-owned resources.
2. **ECharts instance lifetime** — fixed by initialization-bound choices such as renderer and any pinned-version theme behavior.
3. **Compiled structure lifetime** — coordinate systems, component families, IDs, field bindings, and interaction meaning.
4. **Value lifetime** — rows and resolved presentation values that can update without changing structure.
5. **Local runtime lifetime** — valid legend, zoom, hover, and selection presentation state.

Represent initialization-bound choices with a deterministic `instanceKey`. Represent compiled topology and semantics with a deterministic `structuralSignature`. Do not use a React `key` to force remounts for ordinary value updates.

Keep the chart instance, last applied compiled figure, observer, pending resize frame, and event unbind functions in refs or effect-local state. Keep durable application state outside ECharts. See [compiled-figure-and-identity.md](compiled-figure-and-identity.md) for the compiled boundary.

## Initialize only when usable

Create the instance in one `useLayoutEffect` or equivalent pre-paint host lifecycle. Restrict that synchronous phase to sizing, instance creation, first option application, and event binding; ordinary data updates do not need to recreate the instance before paint.

The initialization sequence is:

1. Resolve the owned host element.
2. Read its content size once.
3. If width or height is not positive, leave the instance absent.
4. Start observing the host even while it is zero-sized.
5. When a later observation reports a positive size, initialize once using the latest compiled figure.
6. Bind ECharts and ZRender events once for that instance.
7. Apply the first option with a non-lazy full replacement.

An initially hidden tab, collapsed panel, or not-yet-laid-out grid cell is a normal state. Do not initialize a 0×0 chart and hope a window resize repairs it. Do not add a polling timer. The host `ResizeObserver` is the reveal signal.

Pass the measured width and height at initialization when the pinned ECharts adapter supports it. This avoids depending on a second layout read inside initialization. Choose the renderer before this call; changing it requires disposal and reconstruction.

Guard asynchronous or scheduled callbacks with an effect-local `disposed` flag and the exact instance they were created for. React development remounts must produce the same result as an ordinary unmount followed by a mount.

## Resize from the host element

Observe the owned host element, not ECharts-generated SVG, canvas, or wrapper children. Child observation can turn drawing changes into resize feedback loops.

Use one observer and one pending animation frame per mounted chart host:

```text
ResizeObserver notification
  -> read the newest positive host size
  -> compare with the last applied size
  -> store it as the pending size
  -> schedule at most one requestAnimationFrame
  -> initialize if absent, otherwise resize once
```

Concrete rules:

- Ignore zero and negative dimensions, but retain the last positive applied size.
- Normalize dimensions consistently and ignore unchanged values. Use a small documented tolerance if fractional layout jitter repeatedly crosses browser rounding boundaries.
- Coalesce split-pane drags and layout cascades into one `resize()` call per frame.
- Cancel the pending frame during cleanup.
- Read the latest pending size inside the frame rather than closing over the first observer entry.
- Do not mirror width and height into React state merely to call `resize()`.
- Do not listen to global `window.resize` as the primary signal; sidebars, grids, fonts, and disclosures can resize a chart without changing the window.

If a supported browser or host requires device-pixel-ratio handling beyond element resize, put it in one version- and platform-tested adapter path. Do not multiply global listeners across every chart by default.

## Clean up the exact instance

Cleanup is part of correctness, not optional optimization. The owner that creates a resource removes it:

1. Mark the effect disposed.
2. Disconnect `ResizeObserver` and any bounded theme or motion subscriptions.
3. Cancel pending animation frames and scheduled work.
4. Remove every ECharts and ZRender handler registered on the instance.
5. Dispose that exact ECharts instance.
6. Clear shared refs only if they still point to that instance or controller.
7. Clear the last-applied compiled figure and local adapter bookkeeping.

Do not let a stale cleanup null a newer instance created after an initialization-bound change. Do not depend on `dispose()` to remove application listeners whose ownership is ambiguous; keep explicit unbind functions.

Exercise repeated mount/unmount, plugin reload, route changes, Strict Mode remount, and hidden-to-visible transitions. Retained instances, duplicate events, or growing observer counts are failures even when the chart still looks correct.

## Apply compiled updates deliberately

`setOption()` patches a long-lived global model. The host—not a bundle author or leaf chart—selects the strategy from deterministic compiled metadata.

| Change | Host strategy | Local state policy |
| --- | --- | --- |
| First application | `notMerge: true`, `lazyUpdate: false` | Start from declared defaults |
| Values or resolved styling changed; signature is stable | Normal merge by explicit component IDs | Preserve only still-valid local state |
| Components were added, removed, or retyped | Targeted `replaceMerge` for the affected families | Reapply compatible state explicitly |
| Field bindings, coordinate system, or interaction meaning changed | Full replacement with `notMerge: true` | Drop invalid local state |
| Renderer or another initialization-bound choice changed | Dispose and initialize a new instance | Restore only state validated across rebuild |

Use explicit stable IDs for datasets, grids, axes, series, visual maps, legends, zoom components, and graphics. Array position and display name are not component identity.

The structural comparison should return a decision, not merely a boolean:

```ts
type UpdateDecision =
  | { kind: "merge" }
  | { kind: "replace-families"; families: readonly string[] }
  | { kind: "full-replacement"; reason: string }
  | { kind: "rebuild-instance"; reason: string };
```

Keep the first implementation conservative. A full replacement for an uncertain structural change is safer than accidentally retaining a removed series or obsolete interaction state. Tighten the diff only after sequence tests prove it.

Do not:

- call `clear()` before every update;
- feed `getOption()` back into compilation;
- use `notMerge: true` for every value change, which discards the benefit of stable identities;
- use `lazyUpdate` to conceal synchronous work without measuring when the result becomes visible;
- rely on the `silent` flag as the dashboard's feedback-loop prevention mechanism.

Snapshot and restore local viewport state only through a narrow BB-owned representation. Merging happens to preserve some ECharts state, but that is not a product contract.

## Keep React out of the rendering loop

React should decide which compiled figure exists. ECharts should handle imperative drawing and transient pointer behavior.

- Compile outside the host and pass one immutable `CompiledFigure` with stable references when its meaning has not changed.
- Store the latest callbacks and application runtime in refs so event handlers bind once per instance.
- Do not copy hover, pointer coordinates, animation frames, chart size, or raw ECharts events into broad React state.
- Publish only normalized application intents that another BB surface actually renders or stores.
- Keep renderer registry calls module-scoped and stable.
- Memoize leaf hosts only after compiled objects and callbacks are stable; fresh objects defeat the boundary.
- Avoid chart-local providers, global listeners, and polling. Shared host services belong at the narrowest common surface.
- When a newer generation supersedes work, ignore or cancel the obsolete result before applying it.

A quiet chart performs no periodic work. Closed tabs and unmounted plugin surfaces own no observers, frames, chart instances, or timers.

## Test sequences, not screenshots

At minimum, cover:

- zero-sized mount, then reveal;
- visible mount, resize burst, unchanged resize, zero size, then reveal;
- first option application exactly once;
- stable-signature value and theme update;
- 4 series → 2 → 0 → reordered 3;
- field-binding or coordinate-system change;
- renderer change and exact instance rebuild;
- option update interrupted by a newer generation;
- repeated mount/unmount and React development remount;
- unrelated ancestor mutations that must not update the chart;
- event handlers before and after structural replacement;
- valid and invalid local-state restoration.

Record the ECharts version, renderer, instance key, structural signature, selected update decision, component IDs, mark count, and observer/listener counts in bounded development diagnostics. Assert semantic compiled structure and lifecycle outcomes; do not make generated SVG or `getOption()` the public snapshot contract.
