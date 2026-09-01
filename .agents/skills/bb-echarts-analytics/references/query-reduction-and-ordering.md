# Query reduction and ordering

Read this reference when limiting query output, choosing top-N behavior, plotting bars or time series, adding previews, sampling or downsampling, or deciding whether work belongs in DuckDB, canonical shaping, or ECharts.

## Contents

- [Preserve analytical order](#preserve-analytical-order)
- [Make top-N a query contract](#make-top-n-a-query-contract)
- [Separate result, mark, and display bounds](#separate-result-mark-and-display-bounds)
- [Use different policies for bars and lines](#use-different-policies-for-bars-and-lines)
- [Keep rare events and tails exact](#keep-rare-events-and-tails-exact)
- [Label sampling and partial coverage truthfully](#label-sampling-and-partial-coverage-truthfully)
- [Disclose N of M](#disclose-n-of-m)
- [Place work in the right layer](#place-work-in-the-right-layer)
- [Reduction tests and performance gates](#reduction-tests-and-performance-gates)

## Preserve analytical order

SQL result order is undefined without `ORDER BY`. If order affects ranking, chronology, identity, the exact-value table, export, or the visual story, make it part of the query contract.

Use deterministic tie-breakers:

```sql
ORDER BY failures DESC, p95_ms DESC, capability_key ASC
```

For time series, order by the actual typed bucket and return a display label separately when needed. Ordering by formatted text is safe only when the format is explicitly sortable, such as an ISO date under a declared calendar.

Preserve that order through `CanonicalQueryResult`, `CanonicalFigureData`, `CompiledFigure.plottedDatumKeys`, ECharts dataset construction, the accessible table, and plotted-row export. Do not sort inside ECharts or sort a copied subset in the compiler unless the authored analytical contract explicitly delegates a presentation-only order.

The current Analytics prototype's “take the first 24 bars, then sort those 24” pattern is neither a true top-24 nor faithful query order. Remove this hybrid. Either the SQL selects and orders the top N, or the compiler preserves the bounded result as returned.

## Make top-N a query contract

Top-N selection changes which groups are represented; it is analytical work. Express ranking, ties, and the “other” population in SQL or a trusted relational query plan.

Define:

- the ranked measure and direction;
- deterministic tie-breaking;
- whether ties may exceed N;
- whether null groups are ranked, grouped, or excluded;
- whether an “Other” row is omitted or computed from the remainder;
- the population and predicates used for both top groups and total;
- whether the exact-value table/export contains the top subset or complete bounded result.

Do not fetch an arbitrary prefix and call it top-N. Do not aggregate “Other” from only the returned prefix. If top-N groups must be stable across linked figures, compute the group set once and share it as a typed dependency rather than letting each chart rank a different measure independently.

Outer `LIMIT maxRows + 1` remains a safety cap. It does not define analytical ranking and should not be the only `LIMIT` behind a claim such as “Top 20 tools.”

## Separate result, mark, and display bounds

These bounds answer different questions:

1. **Source bound** — how much curated fact data the loader exposes.
2. **Query execution bound** — deadline, intermediate-work policy, and maximum returned rows.
3. **Canonical result bound** — rows retained for tables, references, and export.
4. **Mark bound** — rows or synthetic marks compiled for one visualization.
5. **Display-density policy** — labels, tick frequency, symbols, and local viewport.

Name and measure them separately. A 500-row query cap does not mean 500 bars are legible. A 24-bar visual bound does not justify truncating a 90-day line to 24 days. Hiding labels is not data reduction.

One `CanonicalQueryResult` may drive several figures with different safe mark bounds. Each `CompiledFigure` records its plotted keys/count and total result count. The canonical result remains available for its declared exact table and export even when a figure plots a truthful subset.

## Use different policies for bars and lines

Categorical bars and ordered time series have different semantics.

### Bars

Prefer a small, query-ranked set with stable labels and an optional explicitly computed “Other.” Set the bar limit from layout, label length, interaction requirements, and measured SVG/Canvas cost. If a table needs more groups than the chart, retain a larger bounded canonical result and label the plotted subset.

### Lines

Preserve temporal order and the selected interval. A shared categorical cap is usually wrong. For a daily 90-day range, a line policy should support the required bucket count or the query should choose a coarser bucket intentionally. The current built-in daily query allows 120 rows, so a generic 24-mark compiler cap silently changes the dashboard's meaning.

For longer or higher-frequency series, reduce in the query pipeline with a declared rule:

- aggregate into wider time buckets with explicit timezone and boundaries;
- select min/max/envelope values when spikes must remain visible;
- use a measured, trusted downsampling algorithm when visual shape is the stated goal;
- retain first/last points and gap/null semantics intentionally.

Downsampling output is a new canonical plotted dataset with provenance to its source interval. It is not an ECharts animation or layout option. Local `dataZoom` changes the viewport over available points; it does not recover data discarded by query reduction.

## Keep rare events and tails exact

Failure discovery, affected-thread counts, repeat sequences, and p95/p99 latency are sensitive to omission. A small sample can entirely miss rare failures, break adjacency, and destabilize tail quantiles.

Default rules:

- compute rare-event counts from the full declared bounded snapshot;
- preserve within-turn sequence before calculating repeated adjacent use;
- compute tail latency from the exact bounded population unless an approximate algorithm is explicitly named and justified;
- rank problem groups from exact measures, not a visual sample;
- keep zero-event and null-duration rules explicit.

“Exact” means exact for the declared loader coverage and query semantics, not all historic BB activity. Coverage caps and degraded reads still qualify every result.

If an approximate quantile or sketch becomes necessary at larger scale, expose the method, error/accuracy contract, merge behavior, and population. Do not format it identically to an exact value without an approximation label.

## Label sampling and partial coverage truthfully

Sampling can be useful for dense exploratory geometry, but only when its statistical and interaction meaning is explicit. Record:

- population and sampling unit;
- random, stratified, systematic, reservoir, or deterministic method;
- sample size and seed or repeatability rule;
- whether weights are required;
- whether estimates or only sampled observations are shown;
- known bias and metrics that must not use the sample.

A newest-thread prefix is a recency-biased partial result, not a probability sample. Show it as exact values for the disclosed partial coverage. Do not extrapolate rates, affected-thread counts, top rankings, or tail distributions from it.

For cold first use, progressive indexing is usually more useful than running an approximate DuckDB query over the same expensive extraction:

```text
load newest bounded prefix
    -> publish generation labeled partial with actual coverage
continue the same extraction without rereading the prefix
    -> atomically publish final bounded generation
```

For warm use, keep the prior final generation visible while a pull refresh runs. Sampling the SQL is only justified when measured query execution—not extraction, transfer, or engine startup—dominates time to first useful result.

Never call a partial generation “representative,” and never let a late partial response replace a final generation.

## Disclose N of M

Whenever canonical or plotted rows are reduced, users need to know what they are seeing.

Use the strongest truthful form available:

- `Showing 20 of 83 capabilities` when an exact total is known;
- `Showing 20 of at least 21 returned groups` when `maxRows + 1` proves only a lower bound;
- `Showing 24 of 50 query rows; query covers 80 recent threads` when figure and source bounds differ;
- `Partial: 16 of 80 selected threads indexed` for a cold prefix.

Do not display “N of M” with an invented M. Detecting one extra row proves truncation, not the complete total. Obtain an exact total through a trusted bounded count query or return a lower-bound type in `CanonicalQueryResult.totalRows`.

Place disclosure beside the figure and repeat relevant scope in exact tables, exports, and analytics references. A tooltip-only note is insufficient. When ranking is top-N, say what measure selected it. When a line is downsampled, say the bucket or method rather than only the point count.

## Place work in the right layer

Use this division:

| Work | Owner |
|---|---|
| joins, filters, aggregation, windows, quantiles, bucketing, ranking, top-N, statistical sampling | DuckDB or trusted relational plan |
| typed schema, generation, `datumKey`, `semanticKey`, coverage, provenance, exact result/order, declared reduction metadata | `CanonicalQueryResult` / `CanonicalFigureData` |
| safe mark-specific shaping, stable component IDs, `InteractiveDatumMeta`, plotted subset bookkeeping, `structuralSignature` | trusted compiler producing `CompiledFigure` |
| axes, layout, marks, labels, hit testing, emphasis, local viewport | ECharts |
| predicates, query dependencies, revisions, cancellation, cross-filtering, references, export authorization | BB dashboard coordinator/application |

Prefer query work when a transformation changes analytical membership or meaning. The compiler may perform a small deterministic presentation transform only when it is part of the figure contract, bounded, identity-preserving, and reflected in plotted/export metadata.

Avoid ECharts transforms for interactive analytical data when sorting, filtering, stacking, or sampling makes final datum-to-source mapping ambiguous. Never make `FigureRuntimeState`, `dataZoom`, legend visibility, or a `ChartIntent` silently alter canonical totals. Promote a local selection to a typed semantic predicate explicitly and requery dependent nodes.

## Reduction tests and performance gates

Test semantic outputs and distributions, not only rendered snapshots:

- deterministic order with ties, duplicate labels, nulls, and reordered input;
- top-N before limit, explicit “Other,” and exact/lower-bound totals;
- bar result limits distinct from line point limits;
- requested 1-, 14-, and 90-day time ranges with gaps and timezone boundaries;
- rare failures present outside an arbitrary prefix;
- p95/p99 and repeat-sequence differences between partial and final coverage;
- stable `datumKey` and provenance after reduction;
- exact table/export order matching their declared scope;
- stale final, partial, final, and obsolete-response transitions;
- SVG/Canvas interaction behavior at each measured mark bound.

Measure extraction, transfer, materialization, SQL, conversion, compilation, ECharts update, and first paint separately. Change the layer whose measured cost dominates. A faster sampled query is not a performance win when extraction is the expensive stage, and an ECharts large/progressive mode is not a win if it removes required datum identity or context-menu hit testing.
