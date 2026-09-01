---
name: bb-echarts-analytics
description: Design, build, review, or debug query-backed analytical dashboards in BB that use ECharts with DuckDB or another relational engine. Use for safe analytical bundle contracts, canonical query results, SQL boundaries, provenance, cross-filtering, query reduction, analytics references, and data export. Do not use for generic ECharts surfaces without analytical queries.
---

# BB ECharts Analytics

This skill extends `bb-echarts`. Apply the general ECharts ownership, lifecycle, identity, interaction, accessibility, and performance rules, then add the relational boundaries below.

The canonical query result is analytical truth. ECharts receives a compiled, bounded view of that result; it does not own aggregation, filtering, ordering, provenance, or export semantics.

## Route by concern

- For allowlisted relations, parser-backed SQL validation, parameters, execution limits, typed results, and snapshot metadata, read [references/query-security-and-results.md](references/query-security-and-results.md).
- For result grain, dimensions, measures, stable keys, aggregated-mark provenance, coverage, and generation identity, read [references/analytical-schema-and-provenance.md](references/analytical-schema-and-provenance.md).
- For top-N behavior, ordering, downsampling, truncation disclosure, tail metrics, and query-versus-render work, read [references/query-reduction-and-ordering.md](references/query-reduction-and-ordering.md).
- For typed predicates, selection bindings, local versus semantic state, query dependencies, cross-highlighting, and cross-filtering, read [references/predicates-and-cross-filtering.md](references/predicates-and-cross-filtering.md).
- For right-click-to-chat capsules, precise datum references, authorized resolution, canonical CSV, and image export context, read [references/analytics-references-and-export.md](references/analytics-references-and-export.md).
- For bounded dashboards, tool reliability, time series, tables, rare events, cold previews, stale-while-refresh behavior, and performance gates, read [references/workload-recipes.md](references/workload-recipes.md).

## Analytical invariants

1. Keep the authored bundle strict, versioned, declarative, and independent of raw ECharts options.
2. Execute only bounded read-only queries over curated relations. Validate every relation and table function with a real SQL parse tree; parameterize values rather than interpolating them.
3. Represent query output as typed columns, canonical rows, deterministic result-scoped `datumKey` values, generation and parameter metadata, coverage, and applied predicates.
4. Validate visualization field bindings and numeric measures against the returned schema before compiling.
5. Preserve SQL result order unless the public analytical contract explicitly says otherwise. Express ranking and top-N selection in SQL, and disclose every plotted/exported subset as “N of M.”
6. Give aggregated marks semantic provenance sufficient to filter, inspect, export, or execute an authorized bounded detail query. Never use pixels or chart indices as provenance.
7. Separate local zoom, legend, hover, and brush preview from committed typed dashboard predicates.
8. Let a dashboard coordinator own predicate canonicalization, dependency-aware requerying, caching, revisions, and feedback-loop prevention. ECharts connection APIs are visual coordination only.
9. Create analytical references from immutable capsules that bind the clicked datum to its bundle version, query, parameters, result generation, coverage, row, visualization, and related views. Resolve capsules under current authorization at send time.
10. Export canonical query data with declared scope. A plotted-row table follows plotted order; a complete-result CSV must be clearly labeled and independently bounded.
11. Reduce or sample in the query pipeline only when the workload justifies it, and never present a biased preview as a representative estimate. Keep rare-event and tail metrics exact unless approximation is explicit.

## Define meaning before interaction

For each analytical figure, establish the question, result grain, dimensions and measures, stable datum key, meaning of click and brush, allowed predicates, contributing-row lookup, local-only state, dashboard-wide state, export relation, exact accessible representation, expected maximum marks, and coverage semantics.

Compile validated figure intent plus a typed query result into an ephemeral `CompiledFigure` containing the ECharts option, structural signature, datum index, plotted rows and keys, export rows, total rows, renderer, and event policy. The canonical query result remains the source for tables, references, and exports.
