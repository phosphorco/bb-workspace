# Predicates and cross-filtering

Read this reference when an analytical figure can select, filter, exclude,
brush, or coordinate with another query-backed figure. The general ECharts
adapter still owns event normalization and datum lookup; this layer defines
what a selection means to the relational system.

Use the shared [`CompiledFigure`, datum identity, and `ChartIntent`
model](../../bb-echarts/references/compiled-figure-and-identity.md); do not
create an analytics-only chart event layer.

## Contents

- [Keep view state and analytical state separate](#keep-view-state-and-analytical-state-separate)
- [Use a finite typed predicate algebra](#use-a-finite-typed-predicate-algebra)
- [Declare selection bindings](#declare-selection-bindings)
- [Compile predicates at the query boundary](#compile-predicates-at-the-query-boundary)
- [Canonicalize state and cache keys](#canonicalize-state-and-cache-keys)
- [Invalidate through a dependency graph](#invalidate-through-a-dependency-graph)
- [Coordinate highlight and cross-filter](#coordinate-highlight-and-cross-filter)
- [Prevent feedback loops and stale commits](#prevent-feedback-loops-and-stale-commits)
- [Verify semantics, not ECharts payloads](#verify-semantics-not-echarts-payloads)

## Keep view state and analytical state separate

Use distinct stores and commands for:

| State | Examples | Owner | Query effect |
|---|---|---|---|
| `FigureRuntimeState` | zoom, legend visibility, hover, brush preview | figure host/coordinator | none |
| `DashboardFilterState` | tool kind, outcome, provider, committed time interval | dashboard coordinator | dependent queries rerun |
| canonical query state | snapshot generation, parameters, applied predicates, coverage | query engine | defines analytical truth |

A wheel zoom is not a time filter. A legend toggle is not a categorical
exclusion. A live brush is not a committed predicate. Promotion must be an
explicit command such as **Filter to visible range** or the declared end of an
apply-on-end brush.

Expose the distinction in UI and inspection text:

- “Zoomed to 10:00–11:00” describes local viewport state.
- “Filtered to 10:00–11:00” describes the query population.
- **Reset zoom** and **Clear filters** clear only the state they name.
- Image export may capture the viewport; data export follows its declared
  canonical-result policy.

## Use a finite typed predicate algebra

Do not accept SQL fragments, JavaScript expressions, authored callbacks,
regular expressions, or arbitrary operator names as filters. Use a small
versioned algebra that can be validated independently of SQL:

```ts
type Scalar = string | number | boolean | null;

type FieldRef = {
  catalogId: string; // trusted analytical schema, not a SQL relation name
  field: string;
};

type DashboardPredicate =
  | { kind: "eq"; field: FieldRef; value: Scalar }
  | { kind: "in"; field: FieldRef; values: readonly Scalar[] }
  | {
      kind: "range";
      field: FieldRef;
      gte?: Exclude<Scalar, null>;
      gt?: Exclude<Scalar, null>;
      lte?: Exclude<Scalar, null>;
      lt?: Exclude<Scalar, null>;
    }
  | { kind: "is-null"; field: FieldRef; value: boolean }
  | { kind: "not"; clause: DashboardPredicate }
  | { kind: "and"; clauses: readonly DashboardPredicate[] }
  | { kind: "or"; clauses: readonly DashboardPredicate[] };
```

Set explicit limits for tree depth, total clauses, serialized bytes, and `in`
cardinality. Reject non-finite numbers and invalid temporal values. Validate
operator compatibility against the trusted field catalog: ranges require an
ordered type, null tests require a nullable field, and values must coerce
without loss under a documented rule.

Add an operator only when it represents a recurring analytical operation with
clear SQL, cache, accessibility, and export semantics. Do not grow this into a
general expression language.

## Declare selection bindings

A gesture becomes semantic only through a validated binding in the authored
analytical contract:

```ts
type SelectionBinding = {
  id: string;
  gesture: "point" | "multi-point" | "interval-x" | "interval-y" | "rect";
  mode: "preview" | "apply-on-end";
  predicate:
    | { kind: "eq"; field: FieldRef; valueFrom: string }
    | { kind: "in"; field: FieldRef; valuesFrom: string }
    | {
        kind: "range";
        field: FieldRef;
        lowerFrom: string;
        upperFrom: string;
      };
  affects: "dashboard" | { linkedGroupId: string };
};
```

At compile time:

1. resolve the predicate field through the trusted field catalog;
2. validate each `*From` field against the typed `CanonicalQueryResult` schema;
3. ensure the needed raw values survive shaping in the `CompiledFigure` datum
   metadata;
4. verify the gesture is supported by the selected renderer/density lane;
5. build a `CompiledEventPolicy` containing only the approved binding IDs.

At event time, resolve the hit through the current `CompiledFigure.datumIndex`.
Read the binding values from trusted datum metadata or typed provenance, never
from `params.name`, pixels, tooltip text, `seriesIndex`, or a persisted
`dataIndex`.

For aggregated marks, a binding applies the mark's declared group values. It
does not guess at contributing rows. When a mark requires a detail population,
use the typed provenance and authorized detail-query path defined in
[analytical schema and provenance](analytical-schema-and-provenance.md).

## Compile predicates at the query boundary

The predicate compiler should return SQL owned by the application plus bound
values:

```ts
type CompiledPredicate = {
  sql: string;
  parameters: readonly Scalar[];
  referencedFields: readonly FieldRef[];
};
```

Resolve every `FieldRef` to an allowlisted expression in a trusted query
template. Parameterize every scalar. Never interpolate selected values,
identifiers, or serialized predicate text into authored SQL. Large `in` sets
should be rejected or moved into an adapter-owned bounded temporary relation;
they must not become an enormous generated statement.

Apply one intentional null policy. In particular, SQL three-valued logic means
`NOT (field = ?)` does not include nulls. If product semantics require “not
equal, including missing,” represent that explicitly rather than silently
rewriting every `not`.

The query result must report the canonical predicate state actually applied,
not merely the draft interaction that requested it.

## Canonicalize state and cache keys

Canonicalize valid predicates before equality, URL state, cache lookup, or
dependency comparison:

- flatten nested `and` and `or` nodes;
- remove duplicate clauses and duplicate `in` values;
- sort commutative children and set values by a typed deterministic encoding;
- normalize ranges and reject contradictory bounds;
- use one representation for empty/all/none states;
- preserve types, including the difference between `"1"` and `1`;
- exclude interaction IDs, display labels, and origin figures from semantic
  equality.

A query cache key should include at least:

```text
snapshot generation
+ query/template version
+ ordinary query parameters
+ canonical projection of predicates read by this query
```

Local viewport state does not belong in this key unless the user explicitly
promoted it to a predicate.

## Invalidate through a dependency graph

The dashboard coordinator, not ECharts, owns query dependencies:

```ts
type QueryDependency = {
  queryId: string;
  readsFilterFields: readonly FieldRef[];
  readsBindingIds?: readonly string[];
  ignoresBindingIds?: readonly string[];
};
```

On a committed predicate revision:

1. canonicalize the complete `DashboardFilterState`;
2. diff the old and new state by field/binding;
3. identify only dependent query nodes;
4. reuse results whose dependency-specific cache keys are unchanged;
5. cancel or supersede obsolete runs;
6. compile affected figures from the results of one accepted revision;
7. publish result, coverage, and filter metadata together.

An explicitly unfiltered denominator or comparison baseline may ignore a
binding. Declare that exception so inspection, references, and exports can
explain it; do not obtain it through accidental cache reuse.

Many visualizations may consume one query. Requery the query node once, then
recompile its consumers. Never run extraction or the same query once per
visualization.

## Coordinate highlight and cross-filter

Use two phases for responsive linked figures:

```text
immediate phase
  resolved semanticKey
    -> coordinator preview state
    -> each CompiledFigure.semanticIndex
    -> local ECharts highlight/downplay actions

analytical phase
  declared selection binding
    -> typed predicate
    -> dependency-aware queries
    -> new `CanonicalQueryResult` values
    -> recompiled figures
    -> restore highlight by semanticKey when still valid
```

`echarts.connect()` can synchronize supported visual actions, but it cannot
define relational filtering, query invalidation, or semantic identity. Never
link figures by matching array positions. Use a proven `semanticKey`, and omit
one rather than inventing cross-generation identity.

Live brush events should update only a bounded preview or selected-count UI.
Commit at the declared end boundary. Do not run DuckDB for every pointer move
unless measurement proves the query cheap and cancellation prevents obsolete
results from publishing.

## Prevent feedback loops and stale commits

Carry an envelope outside the semantic predicate:

```ts
type CoordinatorEnvelope<T> = {
  originFigureId: string;
  interactionId: string;
  baseDashboardRevision: number;
  sourceResultGeneration: string;
  payload: T;
};
```

The coordinator should:

- deduplicate `interactionId`;
- reject commits from a result generation that is no longer current;
- assign one monotonically increasing dashboard revision per accepted
  semantic change;
- prevent coordinator-issued visual actions from re-entering the selection
  commit path;
- ignore a repeated canonical predicate state;
- allow late query results to populate a cache, but never publish them over a
  newer accepted revision;
- clear or reconcile previews when their source generation disappears.

Do not store origin metadata inside the canonical predicate or cache key. It
prevents transport cycles, not semantic equality.

## Verify semantics, not ECharts payloads

Test at least:

- each operator across compatible, incompatible, null, and boundary values;
- depth, clause, cardinality, and byte limits;
- deterministic canonicalization and cache keys;
- SQL parameter binding with hostile scalar text;
- sorted, stacked, reduced, duplicate-label, and empty compiled data;
- preview versus apply-on-end behavior;
- zoom versus explicit range-filter promotion;
- one changed predicate invalidating only its dependent query nodes;
- one query feeding several figures without duplicate execution;
- baseline queries that intentionally ignore a binding;
- linked figures with different local ordering and the same semantic key;
- echoing visual actions, repeated interaction IDs, stale generations, aborted
  runs, and out-of-order results;
- keyboard controls and exact-table actions producing the same typed predicate
  as pointer gestures.

Assert canonical predicates, dependency decisions, accepted revisions, and
compiled semantic lookup. Raw event snapshots and ECharts array indices are
diagnostics, not the product contract.
