# Events, menus, and application references

Read this reference when a BB ECharts surface needs clicks, context menus,
selection, commands, or a precise reference that can be copied or attached to
chat. It covers application-level interaction. Query provenance and
contributing-row semantics belong in the sibling `bb-echarts-analytics` skill.

## Contents

- [Normalize at the renderer boundary](#normalize-at-the-renderer-boundary)
- [Resolve identity before acting](#resolve-identity-before-acting)
- [Item and blank-canvas context menus](#item-and-blank-canvas-context-menus)
- [Native BB menus and capabilities](#native-bb-menus-and-capabilities)
- [Precise application references](#precise-application-references)
- [Attach references to BB chat](#attach-references-to-bb-chat)
- [Keyboard and non-pointer parity](#keyboard-and-non-pointer-parity)
- [Binding and cleanup](#binding-and-cleanup)

## Normalize at the renderer boundary

ECharts and ZRender events are renderer payloads, not application state. Read
the minimum fields needed to resolve a target, then emit a BB-owned intent.
Do not let raw event objects escape the adapter or enter React state. Use the
shared `InteractiveDatumMeta`, `ChartHitTarget`, and `ChartIntent` vocabulary
from [compiled-figure-and-identity.md](compiled-figure-and-identity.md).

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
  | { kind: "ClearFigureInteraction"; figureId: string };
```

Coordinates are an ephemeral menu anchor. They are never target identity. Keep
the event vocabulary small and application-oriented; add an intent because the
application has a new command, not because ECharts exposes another event name.

Use the pinned ECharts and ZRender declarations for exact event types. Example
code from a different release is not a substitute for repository truth.

## Resolve identity before acting

Every interactive compiled datum needs application identity. `seriesIndex`,
`dataIndex`, display name, color, and pixel position describe the current
rendering and can change after sorting, filtering, merging, downsampling, or a
new generation.

Use `datumKey` only together with its canonical-data `generation`. Add a
`semanticKey` only when the application can prove cross-generation identity.
Keep display labels in canonical values or application presentation metadata;
they are never lookup keys.

The compiler should expose a runtime lookup in the final plotted order:

```ts
type DatumIndex = ReadonlyMap<string, readonly InteractiveDatumMeta[]>;

function resolveDatum(
  index: DatumIndex,
  seriesId: string,
  dataIndex: number,
): InteractiveDatumMeta | undefined {
  return index.get(seriesId)?.[dataIndex];
}
```

The index is only a bridge from the immediate ECharts hit to application
identity. Never persist the index, use it across compiled generations, or put a
raw data index in a copied reference. When ECharts-side transforms make final
order ambiguous, remove the transform, build an explicit post-transform map,
or perform the shaping in the application before compilation.

## Item and blank-canvas context menus

Item and blank-canvas menus come from different event layers:

- Bind the ECharts `contextmenu` event for a datum or component hit.
- Bind ZRender `contextmenu` on `chart.getZr()` for the drawing surface.
- Treat a ZRender event with a target as non-blank; the item path owns it.
- If the pinned version delivers both paths for the same native event, dedupe
  by native event identity.
- Call `preventDefault()` on the underlying browser event only when the
  application will actually handle the menu.

```ts
function bindFigureContextMenus(
  chart: ECharts,
  figureId: string,
  resolve: (seriesId: string, dataIndex: number) => InteractiveDatumMeta | undefined,
  emit: (intent: ChartIntent) => void,
): () => void {
  const onItem = (params: EChartsContextMenuParams) => {
    const native = params.event?.event;
    const seriesId = typeof params.seriesId === "string" ? params.seriesId : "";
    const datum = resolve(seriesId, params.dataIndex);
    if (!native || !datum) return;

    native.preventDefault();
    emit({
      kind: "OpenContextMenu",
      target: { kind: "datum", figureId, seriesId, datum },
      clientX: native.clientX,
      clientY: native.clientY,
    });
  };

  const onCanvas = (event: ZRenderContextMenuEvent) => {
    if (event.target || !event.event) return;
    event.event.preventDefault();
    emit({
      kind: "OpenContextMenu",
      target: { kind: "canvas", figureId },
      clientX: event.event.clientX,
      clientY: event.event.clientY,
    });
  };

  chart.on("contextmenu", onItem);
  chart.getZr().on("contextmenu", onCanvas);
  return () => {
    chart.off("contextmenu", onItem);
    chart.getZr().off("contextmenu", onCanvas);
  };
}
```

This is a structural example. Replace the placeholder event types with the
installed version's types and preserve the shared host's binding lifecycle.

## Native BB menus and capabilities

ECharts should report the hit; BB should decide which commands exist and
render them through the plugin's established native menu primitives. Do not
use the ECharts toolbox, authored formatter HTML, or a tooltip as an
application command surface.

Resolve commands from a narrow capability model:

```ts
type FigureMenuCapability =
  | { kind: "inspect"; label: string }
  | { kind: "copy-reference"; label: string }
  | { kind: "add-reference-to-chat"; label: string }
  | { kind: "export-data"; label: string }
  | { kind: "export-image"; label: string }
  | { kind: "reset-viewport"; label: string };

type ResolveFigureMenu =
  (target: ChartHitTarget) => readonly FigureMenuCapability[];
```

Typical ownership is:

| Target | Candidate commands |
|---|---|
| Datum | Inspect, application action, copy reference, add to chat |
| Series | Inspect series, copy figure reference, export represented data |
| Canvas | Export image/data, open exact table, reset local viewport |

The table is not a promise that every chart has every command. Authorization,
available identity, and application policy decide the actual list. Disabled
commands should explain why they are unavailable; commands should not appear
merely because ECharts technically supports an action.

The native menu owns focus entry and restoration, arrow-key navigation,
escape-to-close, viewport collision, mobile presentation, loading/error state,
and confirmation or undo where the command requires it. Keep menu state outside
the chart instance so a chart update cannot strand an open overlay.

## Precise application references

An application reference identifies the thing the user acted on and the
minimum context needed to interpret it. It is not a screenshot coordinate or a
serialized ECharts option.

```ts
type FigureReferenceV1 = {
  version: 1;
  pluginId: string;
  figureId: string;
  generation: string;
  target:
    | { kind: "figure" }
    | { kind: "series"; seriesId: string }
    | { kind: "datum"; seriesId: string; datumKey: string; semanticKey?: string };
  label: string;
};
```

Choose the reference scope explicitly. A datum key may be stable only within a
document revision, result generation, deployment, or user account. Record that
scope in the application's stored capsule or resolver rather than implying
global permanence.

Recommended flow:

```text
immediate chart hit
    -> stable application target
    -> permission-aware reference capsule
    -> opaque reference ID
    -> copy, inspect, or attach to chat
    -> resolve in the current authorization context
```

Keep copied text concise, such as an application-owned versioned token or URL.
Store rich or sensitive context behind the resolver. Validate reference IDs,
bound their lifetime and payload size, and fail visibly when the target was
deleted, is no longer authorized, or no longer exists in the promised scope.
Never broaden access because someone possesses a copied token.

Generic plugins may include domain fields, a document revision, or a bounded
value snapshot. Query text, query parameters, result generation, population
coverage, and contributing-row provenance are analytics-reference concerns;
use `bb-echarts-analytics` when those are required.

## Attach references to BB chat

BB offers two different composer primitives:

- `useComposer().addQuote(text)` adds bounded immutable text that is already
  sufficient to understand the selection.
- `useComposer().insertMention({ provider, id, label })` inserts a durable
  application entity whose server-side mention provider resolves context when
  the message is sent.

For a resolvable chart entity, register the provider on the server:

```ts
bb.ui.registerMentionProvider({
  id: "figure-reference",
  label: "Figure references",
  search: () => [],
  async resolve(referenceId) {
    const context = await resolveAuthorizedFigureReference(referenceId);
    return { context };
  },
});
```

Then insert the reference from the plugin app:

```ts
composer.insertMention({
  provider: "figure-reference",
  id: referenceId,
  label: referenceLabel,
});
composer.focus();
```

The `id` is the provider's item ID, not the full context. Resolution happens at
send time and may block sending with a visible error, so return actionable
stale/deleted/authorization errors. An empty `search` is appropriate when
references are only inserted programmatically from the figure.

“Copy reference” and “Add to chat” should use the same capsule and resolver.
Do not let clipboard text and chat mentions describe subtly different targets.

## Keyboard and non-pointer parity

Do not try to make every generated SVG path or canvas mark into a bespoke
keyboard widget. Provide application-owned controls over the same stable target
model:

- an adjacent native exact table with row actions;
- a visible figure-actions button for canvas-level commands;
- native selection controls when selection is essential;
- a menu button or row action that invokes the same capability resolver as
  right-click;
- focus restoration to the invoking control after a menu closes.

Essential inspect, reference, export, reset, and application commands must not
require hover or right-click. If a pointer gesture supports a semantic action,
name its keyboard equivalent in the figure contract and test both paths against
the same emitted intent.

## Binding and cleanup

Bind ECharts and ZRender listeners once per chart instance in the shared host.
Handlers should read current application callbacks from refs rather than
forcing rebinding on every React render. Cleanup must call `off()` with the
same event name and function identity before disposal.

Test repeated mount/unmount, React development remount behavior, figure changes
while a menu is open, item/blank event deduplication, and a stale event arriving
after a new compiled generation. The stale event must not resolve against the
new generation's datum index.
