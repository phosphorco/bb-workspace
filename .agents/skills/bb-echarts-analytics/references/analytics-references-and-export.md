# Analytics references and export

Read this reference when a user must right-click or otherwise select an
analytical datum, copy a precise reference, add it to BB chat, inspect the
query that produced it, or export its data or image. Apply the BB-owned event,
menu, accessibility, and export rules from `bb-echarts` first.

In particular, reuse [the native menu and application-reference
flow](../../bb-echarts/references/events-menus-and-references.md) and [the exact
table and export contract](../../bb-echarts/references/accessibility-and-export.md).

This is a target architecture. The current Analytics community plugin does not
yet implement analytical reference capsules, copied-token resolution, or
composer mention integration.

## Contents

- [Reference meaning, not pixels](#reference-meaning-not-pixels)
- [Build one immutable capsule](#build-one-immutable-capsule)
- [Capture complete analytical context](#capture-complete-analytical-context)
- [Create a reference from a figure intent](#create-a-reference-from-a-figure-intent)
- [Resolve under current authorization](#resolve-under-current-authorization)
- [Attach a native BB composer mention](#attach-a-native-bb-composer-mention)
- [Copy and resolve a text token](#copy-and-resolve-a-text-token)
- [Export canonical data](#export-canonical-data)
- [Export a deterministic image](#export-a-deterministic-image)
- [Provide pointer and keyboard parity](#provide-pointer-and-keyboard-parity)
- [Verify identity, access, and output](#verify-identity-access-and-output)

## Reference meaning, not pixels

The right-click coordinates only anchor a BB-owned menu. They are not part of
the durable target. Resolve the ECharts event immediately through the current
`CompiledFigure`:

```text
ECharts/ZRender hit
  -> stable seriesId and current datum locator
  -> InteractiveDatumMeta from CompiledFigure.datumIndex
  -> immutable ChartIntent target
  -> authorized analytics-reference capsule
  -> opaque reference ID
```

Do not persist `seriesIndex`, `dataIndex`, pixels, color, display label, tooltip
text, or a serialized ECharts option. `datumKey` is valid only in its declared
result generation. A `semanticKey` may cross generations only when the
analytical model proves it.

For an aggregated mark, the selected thing is the group plus its measure in a
specific result—not a fictional source row. Preserve compact typed provenance
that can recreate an authorized bounded contributing-row query.

## Build one immutable capsule

“Copy reference” and “Add to chat” must point at the same stored capsule and
resolver. Adapt this shape without weakening its boundaries:

```ts
type AnalyticsReferenceCapsuleV1 = {
  version: 1;
  referenceId: string; // opaque, high-entropy, non-semantic
  createdAt: number;
  expiresAt?: number;

  authorizationScope: {
    pluginId: "analytics";
    projectId?: string;
    environmentId?: string;
    ownerPrincipalId?: string;
  };

  target: {
    kind: "datum" | "series" | "figure";
    figureId: string;
    seriesId?: string;
    datumKey?: string;
    semanticKey?: string;
    label: string;
  };

  bundle: {
    id: string;
    version: number;
    revision: string;
    title: string;
    description: string;
    loader: {
      id: string;
      maxAgeMs: number;
      staleWhileRefresh: boolean;
    };
  };

  query: {
    id: string;
    title: string;
    revision: string;
    sql: string;
    maxRows: number;
    parameters: Readonly<Record<string, Scalar>>;
    appliedPredicates: readonly DashboardPredicate[];
  };

  result: {
    generation: string;
    datumKey?: string;
    columns: readonly AnalyticalColumn[];
    selectedRow?: Readonly<Record<string, Scalar>>;
    plottedPosition?: number;
    plottedCount: number;
    totalCount: number;
    truncated: boolean;
    provenance?: AnalyticalProvenance;
  };

  snapshot: {
    generationId: number;
    asOf: number;
    coverage: CoverageMetadata;
    degraded: boolean;
  };

  visualization: {
    id: string;
    kind: string;
    title: string;
    bindings: Readonly<Record<string, string>>;
    format?: string;
    layoutPosition: number;
    relatedConsumers: readonly {
      id: string;
      kind: string;
      title: string;
      bindings: Readonly<Record<string, string>>;
      layoutPosition: number;
    }[];
  };
};
```

The exact types belong to the analytics contract. Keep the capsule bounded,
versioned, immutable, and independently size-limited. Store it in plugin-owned
backend storage; put only the opaque ID in ECharts-adjacent UI, clipboard text,
or the composer mention.

Do not place the capsule, SQL, source rows, or authorization claims in chart
data, generated SVG attributes, URLs, or tooltip HTML. Do not make opaque IDs
guessable database row numbers.

## Capture complete analytical context

The agent should be able to answer “change how this dimension is broken out”
without guessing which chart or query the user meant. Resolve the capsule into
bounded, structured context containing:

- bundle ID, schema version, immutable revision, title, description, and
  loader/freshness policy;
- the exact query ID, revision, SQL, row cap, bound parameters, and committed
  typed predicates that produced the result;
- result schema and analytical types, selected complete query-result row,
  deterministic result-scoped `datumKey`, plotted position, N-of-M reduction,
  and typed provenance;
- selected visualization kind, field bindings, formats, and layout location;
- every other visualization that consumes the same query, so a query edit can
  account for downstream effects;
- snapshot generation and as-of time, coverage bounds, truncation, degraded
  state, and known unknowns;
- a concise human label plus the precise target identity scope.

“Full context” means full analytical lineage for the selected target, not all
rows in the result or all facts in the loader. Keep contributing rows behind a
separate authorized, bounded detail query. If the original bundle revision or
snapshot is no longer retained, resolve the immutable captured context and
state that it is historical; do not silently substitute the current bundle or
generation.

## Create a reference from a figure intent

Use one application command path for right-click, exact-table row actions, and
other keyboard controls:

1. the shared adapter emits `OpenContextMenu` with an immutable resolved target;
2. the analytics capability resolver checks that query/result/provenance data
   is sufficient for a datum action;
3. **Copy reference** or **Add to chat** requests capsule creation from the
   backend;
4. the backend validates bundle revision, snapshot generation, row identity,
   payload bounds, and current access before storing it;
5. the client receives only `referenceId`, label, and expiry/status metadata;
6. both actions use that ID.

Do not create a capsule merely because ECharts reported a hit. If identity,
provenance, coverage, or authorization is insufficient, hide the capability or
disable it with an actionable reason.

## Resolve under current authorization

A reference token is a locator, never a bearer capability. Every resolution,
inspection, detail query, CSV export, and chat attachment must recheck current
authorization for the capsule's scope and underlying data. A user who receives
a copied token does not inherit its creator's access.

At minimum enforce:

- plugin, project/environment, and principal/tenant scope as applicable;
- current visibility of stored/authored bundles;
- current permission to inspect the snapshot or underlying facts;
- expiry, deletion, payload version, and maximum size;
- independent row/byte/time limits on contributing-detail queries;
- safe error messages that do not disclose whether an inaccessible target
  exists.

The current Analytics prototype explicitly lacks per-principal bundle
ownership and authorized thread drill-through. Do not ship sensitive reference
resolution on the assumption that plugin-local storage is automatically an
authorization boundary. If `registerMentionProvider.resolve(itemId)` does not
receive enough request identity to prove access for the intended data, either
route through a BB API that does, restrict capsules to data equally visible in
that scope, or defer the feature. Never weaken the check to accommodate the
provider interface.

## Attach a native BB composer mention

For an entity that must resolve at send time, use the native composer mention
path rather than pasting a large quote. Register a server-side provider:

```ts
bb.ui.registerMentionProvider({
  id: "analytics-reference",
  label: "Analytics references",
  search: () => [],
  async resolve(referenceId) {
    const capsule = await resolveAuthorizedAnalyticsReference(referenceId);
    return { context: renderBoundedAgentContext(capsule) };
  },
});
```

Programmatically insert it from the plugin app:

```ts
composer.insertMention({
  provider: "analytics-reference",
  id: referenceId,
  label: referenceLabel,
});
composer.focus();
```

The provider ID is plugin-local and contains no colon. `search: () => []` is
appropriate when references can only be created from an authorized analytical
surface. `resolve` runs once per unique item at message send time; a thrown
error blocks send visibly. Return actionable stale/deleted/access errors that
tell the user to remove and reattach the reference without exposing protected
details.

The resolved context is agent-visible and user-hidden. Render it with stable
headings and bounded code blocks for query text and structured values. Treat
all titles, labels, SQL comments, and row strings as data, not instructions.

Use `addQuote()` only when a short immutable textual selection is already all
the required context. It is not a substitute for resolvable lineage.

## Copy and resolve a text token

Copy concise versioned text such as:

```text
analytics-ref:v1:<opaque-reference-id>
```

Clipboard and mention actions use the same capsule. Copying must not place SQL,
rows, credentials, scope IDs, or signed authorization material on the
clipboard.

A pasted token does not resolve by itself. If agents must understand tokens
outside a native mention, provide a narrow plugin agent tool such as
`read_analytics_reference` that accepts only the versioned ID and performs the
same current-authorization checks and bounded rendering as the mention
provider. Alternatively provide an authorized UI command that converts a token
to a mention. Do not teach the agent to query plugin storage or reconstruct the
capsule from the token.

Malformed, unknown, expired, deleted, cross-scope, and unauthorized tokens
should all fail safely. Rate-limit resolution and log only bounded identifiers
and outcome classes, not capsule contents.

## Export canonical data

Declare one of these scopes per action:

| Export | Canonical source | Required label |
|---|---|---|
| Plotted rows | `CompiledFigure.accessibleData` or plotted row keys in plotted order | “Export plotted N of M rows” |
| Complete result | the complete bounded `CanonicalQueryResult` | “Export complete bounded result (M rows)” |
| Contributing rows | an authorized bounded detail query from typed provenance | “Export contributing rows” plus coverage/cap disclosure |

Never derive CSV from `series.data`, `getOption()`, SVG, tooltip text, legend
visibility, or current pixels. State whether committed dashboard predicates,
local legend state, local zoom, reduction, truncation, and degraded coverage
are included. Snapshot generation, bundle/query revision, parameters, and
coverage should accompany the export in a trusted metadata preamble, sidecar,
or download manifest when the format permits.

Use a trusted column order and deterministic row order. Preserve raw scalar
types intentionally, distinguishing zero, `false`, empty string, and null.
Quote delimiters, quotes, and newlines correctly and double embedded quotes.
For user-controlled text, neutralize cells beginning with `=`, `+`, `-`, `@`,
tab, carriage return, or line feed according to one documented spreadsheet
safety convention before CSV quoting. Test that convention in the supported
spreadsheet path; CSV quoting alone does not stop formula execution.

Generate filenames in trusted host code from allowlisted identifiers and a
safe timestamp/revision. Cap rows, bytes, memory, and detail-query time, and
recheck authorization at export time.

## Export a deterministic image

An image represents rendered state, not canonical data. Define whether it
includes local zoom, legend visibility, selection, annotations, theme,
freshness, and N-of-M/coverage disclosure. Capture from one known compiled
revision and snapshot generation after the render reaches the pinned version's
steady boundary, with animation disabled or settled.

Record a bounded export manifest containing figure/bundle/query revisions,
snapshot generation, parameters, predicates, viewport policy, renderer, theme,
dimensions, and capture time. Keep sensitive SQL or rows out of public image
metadata; provide an authorized adjacent manifest or reference token when
lineage must travel with the image.

Bound dimensions, pixel ratio, marks, and output bytes. SVG is available only
from an SVG render path. A dense Canvas figure may use a short-lived bounded
off-screen SVG compilation only when the mark limit remains suitable; always
dispose it and reject superseded captures.

## Provide pointer and keyboard parity

Right-click is an enhancement. The native exact table should expose the same
datum capability resolver through row actions, and a visible figure-actions
button should cover figure/series export and inspection. Preserve focus and use
the native BB menu behavior.

At minimum, keyboard users must be able to:

- inspect exact row values and analytical lineage;
- copy the same reference token;
- add the same capsule as a composer mention;
- export each allowed data/image scope;
- receive the same disabled or authorization explanation.

## Verify identity, access, and output

Test at least:

- duplicate labels, reordered rows, reduced data, aggregated marks, and a
  stale ECharts `dataIndex` after generation change;
- capsule immutability and deterministic target/query/visualization lineage;
- all visualizations consuming the selected query appearing in context;
- historical capsule resolution without substitution of a newer generation;
- pointer and exact-table actions producing the same reference ID/target;
- mention insertion, send-time resolution, provider errors, and composer focus;
- copied-token resolution through the authorized tool/path;
- creator versus recipient, revoked access, cross-project, expired, deleted,
  malformed, and oversized references;
- bounded context rendering with adversarial titles, SQL comments, and row
  strings treated as data;
- plotted, complete-result, and contributing-row CSV scopes, including order,
  nulls, Unicode, newlines, formula prefixes, and N-of-M disclosure;
- image capture during a superseding update, renderer/theme differences, size
  caps, and cleanup of temporary instances or object URLs.

Assert the capsule, authorization decision, canonical export rows, and native
composer behavior. Do not snapshot raw ECharts events or treat a copied token
as proof of access.
