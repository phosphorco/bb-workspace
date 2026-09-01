# Analytical schema and provenance

Read this reference when defining query output grain, field roles, row identity, aggregated marks, coverage, drill-through, filtering, or analytics references. It specializes the general [`CanonicalFigureData`, `CompiledFigure`, and datum identity model](../../bb-echarts/references/compiled-figure-and-identity.md) for relational results.

## Contents

- [Start with the analytical question and grain](#start-with-the-analytical-question-and-grain)
- [Model typed dimensions and measures](#model-typed-dimensions-and-measures)
- [Keep four identities distinct](#keep-four-identities-distinct)
- [Represent aggregated provenance](#represent-aggregated-provenance)
- [Carry snapshot and coverage meaning](#carry-snapshot-and-coverage-meaning)
- [Compile interaction metadata](#compile-interaction-metadata)
- [Use provenance for detail without data leakage](#use-provenance-for-detail-without-data-leakage)
- [Schema and provenance review](#schema-and-provenance-review)

## Start with the analytical question and grain

Define one sentence for the question and one sentence for the row grain before writing SQL or selecting a chart.

```text
Question: Which capabilities account for the most failed invocations?
Result grain: One row per capability key in the selected snapshot and predicates.

Question: How did capability activity change by day?
Result grain: One row per calendar day in the declared timezone and range.
```

The grain determines which fields may be dimensions, which values are measures, which rows can be compared, what a mark means, and how a user can inspect contributing facts. A query that mixes grains without an explicit role—such as detail rows plus a total row—should be split or tagged with a closed result variant.

For every query, record:

- population and bounded source snapshot;
- row grain and grouping dimensions;
- measure definitions, units, denominators, and null policy;
- time zone, bucketing rule, and interval inclusivity;
- ordering and tie-breaking contract;
- exact versus approximate computation;
- coverage limits and known unknowns;
- supported semantic predicates and detail path.

Do not infer agent effectiveness from tool reliability fields. Invocation counts, failures, latency, and repeated attempts are diagnostics unless the data model contains a defensible outcome methodology.

## Model typed dimensions and measures

`CanonicalQueryResult.columns` should preserve logical types and analytical roles rather than exposing only names:

```ts
type AnalyticalColumn = {
  name: string;
  logicalType: "string" | "boolean" | "integer" | "decimal" | "date" | "timestamp" | "duration";
  nullable: boolean;
  role: "dimension" | "measure" | "identifier" | "provenance";
  unit?: "count" | "percent" | "milliseconds";
  aggregation?: "count" | "sum" | "min" | "max" | "mean" | "p50" | "p95" | "p99";
};
```

This is a representative internal model, not a required public bundle schema. Keep `AuthoredFigureSpec` small; resolve its field names against the richer trusted schema.

Measures need definitions. A `failure_rate` should declare whether it is a ratio or a value already multiplied by 100, its numerator, its denominator, and its zero-denominator behavior. A `p95_ms` should identify the duration population and null exclusion policy. Formatting does not supply these semantics.

Dimensions need domain rules. A displayed capability label may not be a canonical tool identity. Historic Analytics facts currently lack reliable tool owner/server/version and actual skill-read provenance; represent those values as `unknown`, not reconstructed guesses.

## Keep four identities distinct

Use separate names because the guarantees differ:

1. **Snapshot generation** identifies the bounded source fact set.
2. **Query-result generation** identifies source generation plus query contract, parameters, predicates, and authorization scope.
3. **`datumKey`** deterministically identifies one row or synthetic datum inside that `CanonicalQueryResult` generation.
4. **`semanticKey`** identifies the same domain entity or group across generations or figures, but only when the schema proves it.

`datumKey` is result-scoped. Construct it before ECharts from the query identity and a collision-safe canonical encoding of the row's declared key fields. When the declared grain is not unique, either add deterministic tie-breakers or include a stable occurrence ordinal from the final ordered result. Never silently use a display label as a unique key.

`semanticKey` is optional. A capability kind may be a semantic group across a volume and latency figure; a result row number is not. Namespace semantic keys by entity type and scope so that `tool:native:command` cannot collide with an unrelated label. Do not promise cross-generation identity for a group whose definition, bucketing timezone, or query version changed.

Database row IDs, source event IDs, `seriesIndex`, `dataIndex`, and pixels are neither automatic semantic identity nor safe user-facing capabilities. ECharts positions only locate an entry in the current `CompiledFigure.datumIndex`.

## Represent aggregated provenance

Most analytical marks summarize many source facts. An aggregated bar needs enough provenance to answer “what population contributed to this value?” without embedding all contributing rows.

Use a narrow workload-owned union, for example:

```ts
type AnalyticalProvenance =
  | {
      kind: "group-predicate";
      queryId: string;
      generation: string;
      group: Readonly<Record<string, Scalar | readonly Scalar[]>>;
      appliedPredicates: readonly DashboardPredicate[];
      measure: {
        field: string;
        aggregation: string;
        numeratorField?: string;
        denominatorField?: string;
      };
      contributingCount?: number;
    }
  | {
      kind: "authorized-row-set";
      queryId: string;
      generation: string;
      token: string;
      contributingCount: number;
    };
```

A group predicate should be compiled from trusted dimensions and typed values, not copied as SQL text. A row-set token is a server-owned, scoped lookup capability with a bounded lifetime and generation; it is not a client-authored relation name or list of sensitive IDs.

Provenance must include the already-applied dashboard predicates and population context. “Failures for tool X” under provider Y and a 14-day window is not the same datum as the unfiltered lifetime group. Include measure semantics so a context menu or analytics reference can distinguish a count, rate, and percentile over the same group.

If a mark combines several result rows during trusted compilation, create synthetic `datumKey` and provenance from the complete contributing key set or a bounded lookup token. Do not retain only the first row.

## Carry snapshot and coverage meaning

Coverage is part of analytical meaning, not dashboard decoration. Attach it to `CanonicalQueryResult`, exact tables, exports, and durable references.

For the current bounded Analytics loader, useful coverage includes:

- source generation and snapshot update time;
- requested date range;
- candidate, selected, and successfully loaded thread counts;
- fact count;
- event cap and number of truncated threads;
- degraded status and preserved-stale thread reads;
- last full reconciliation time;
- whether the result is a final bounded snapshot or a cold partial newest-thread prefix.

“Final” means complete for the declared bounded loader window, not full BB history. A newest-thread prefix is recency-biased coverage, not a random sample and not an estimate of the final population. A degraded snapshot may mix fresh facts for successful threads with preserved facts for failed rereads; say so.

Unknown provenance should remain visible as unknown. Missing historic server/version identity or unobserved skill-content reads are coverage limitations, not null categories to silently exclude.

## Compile interaction metadata

The analytics compiler should emit `InteractiveDatumMeta` from the same final ordered records used by the ECharts dataset:

```ts
type InteractiveDatumMeta = {
  datumKey: string;
  generation: string;
  semanticKey?: string;
  values: Readonly<Record<string, Scalar>>;
  capabilityIds: readonly string[];
  provenance: AnalyticalProvenance;
};
```

The `CompiledFigure` should also retain:

- its `structuralSignature`;
- `plottedDatumKeys` and final datum order;
- `plottedCount` and `totalCount` or a truthful lower bound;
- canonical accessible rows;
- declared export data;
- reverse semantic lookup for cross-highlighting.

`structuralSignature` includes field bindings, grouping/bucketing meaning, selection mapping, and trusted mark topology. It does not change merely because a count changes. The result generation lives on datum metadata and canonical data; it should not force a structural replacement by itself.

Raw ECharts event fields are immediately resolved through the current `CompiledFigure`. A `ChartIntent` copies the immutable datum target needed by the action. If the chart advances generations while a menu is open, the target remains the old explicit generation and must be reauthorized or declared stale rather than retargeted by index.

## Use provenance for detail without data leakage

Filtering, drill-through, copy-to-chat, and export are separate authorized capabilities. Possessing a plotted aggregate does not automatically grant unrestricted source-row access.

For an inspection action:

```text
InteractiveDatumMeta
    -> validate capability and current authorization
    -> resolve generation-scoped group predicate or row-set token
    -> execute a separate bounded detail contract
    -> return redacted canonical detail rows plus coverage
```

Prefer a typed detail-query contract over dynamically editing the aggregate SQL. It can reuse curated relations, true parameter binding, deadlines, row caps, and authorization. Do not place prompts, paths, tool arguments, free-text errors, or hidden source rows in chart data, SVG attributes, copied reference text, or client provenance.

An analytics reference may preserve exact bundle/query/visualization identity, selected canonical row, measure semantics, parameters, generation, and coverage. Its resolver must check current authorization and return bounded context. A reference is not permission to resurrect data that retention or access policy no longer allows.

## Schema and provenance review

Before shipping a query-backed figure, verify:

- the question and row grain are explicit;
- dimensions, measures, units, denominator, null, timezone, and ordering rules are defined;
- `datumKey` uniqueness is tested with duplicate labels and nulls;
- `semanticKey` is absent unless cross-generation meaning is proven;
- aggregate provenance recreates a typed group or authorized bounded row set;
- coverage accompanies values in UI, references, tables, and exports;
- partial, truncated, degraded, and unknown states remain distinguishable;
- query changes invalidate incompatible result and semantic identities;
- sort, stack, split, filter, and reduction preserve exact datum lookup;
- stale-generation events and open menus do not silently target new data;
- detailed rows require a separately authorized, redacted, bounded resolution path.

Test provenance by resolving a mark back to its intended group under several predicate sets. A chart that looks correct but opens the wrong population is analytically incorrect.
