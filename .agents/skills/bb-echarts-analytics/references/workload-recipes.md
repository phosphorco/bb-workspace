# Analytics workload recipes

Read this reference when choosing query shape, result bounds, preview behavior,
freshness, disclosure, or performance gates for a concrete dashboard. These
are decision recipes, not new chart types. The `CanonicalQueryResult` remains
truth; ECharts renders a declared bounded view.

## Contents

- [Start with a workload budget](#start-with-a-workload-budget)
- [Share extraction and queries](#share-extraction-and-queries)
- [Tool reliability dashboard](#tool-reliability-dashboard)
- [Bounded time series](#bounded-time-series)
- [Bounded analytical tables](#bounded-analytical-tables)
- [Rare events and tail metrics](#rare-events-and-tail-metrics)
- [Cold recency-prefix previews](#cold-recency-prefix-previews)
- [Stale while refresh](#stale-while-refresh)
- [Choose exactness, reduction, and sampling](#choose-exactness-reduction-and-sampling)
- [Set performance gates](#set-performance-gates)
- [Disclose population and freshness](#disclose-population-and-freshness)
- [Exercise the workload matrix](#exercise-the-workload-matrix)

## Start with a workload budget

Before choosing a visualization, write down:

```text
Question and decision supported:
Source snapshot and freshness policy:
Population and coverage bounds:
Result grain:
Dimensions and measures:
Expected and maximum result rows:
Expected and maximum plotted marks:
Exact versus approximate metrics:
Ordering/top-N rule:
Canonical table/export relation:
Interaction and detail-query needs:
Cold, warm, stale, degraded, and empty behavior:
TTFUR, query, render, memory, and export budgets:
```

Do not use “large” or “fast” as a budget. A dashboard can have a small result
and an expensive scan, or a cheap query and an excessive mark count. Measure
extraction, transfer/materialization, SQL, compilation, render, and interaction
separately.

## Share extraction and queries

The extraction/loading configuration is many-to-one with queries, and each
query is many-to-one with visualizations:

```text
one loader snapshot
  -> several bounded queries
       -> several metric/chart/table consumers per query
```

Extraction never runs once per visualization. Query once per unique query,
parameter set, committed predicate projection, and snapshot generation; then
compile all consumers. Cache keys and diagnostics should make reuse visible.

Pull-based means no work while Analytics is unused. The first consumer may
trigger refresh according to the shared loader policy. A dashboard containing
more visualizations should add compilation/render work and only genuinely new
query work—not another source scan.

The current Analytics prototype is a useful bounded example, not a universal
constant: it considers 200 thread candidates, selects the 80 most recently
updated, reads at most 500 completed events per thread with four concurrent
reads, runs DuckDB with one worker query thread, and caps authored query output
at 500 rows. Preserve those limits when changing that plugin unless measurement
and product semantics justify a reviewed contract change.

## Tool reliability dashboard

Use typed, redacted execution facts to answer operational questions such as:

- how often a capability is invoked;
- failure/interruption rate with an explicit denominator;
- p50/p95/p99 duration where sample count is sufficient;
- affected-thread count;
- normalized error classes/signatures;
- adjacent repeated attempts or third-and-later use.

Recommended query behavior:

- aggregate in DuckDB at the intended capability/tool/provider grain;
- return the denominator and count beside every rate or tail metric;
- use explicit deterministic ordering, including tie-breakers;
- express top-N in SQL rather than slicing arbitrary chart input;
- reuse one grouped result for a chart and exact table when their meaning and
  order are identical;
- use typed provenance for an authorized bounded affected-thread/detail query;
- preserve unknown tool owner/version or skill-read state as `unknown` rather
  than inferring it.

These are reliability diagnostics. Do not label them “agent effectiveness” or
claim a tool/skill caused a better outcome without a separate defensible
outcome methodology and instrumentation.

For repeated use, define the partition and adjacency precisely—for example,
within one thread and turn ordered by event sequence. State whether the metric
counts sequences, invocations, or third-and-later occurrences.

## Bounded time series

Choose a bucket width that bounds points before rendering:

```text
time range / target point count -> supported bucket width -> DuckDB GROUP BY
```

For example, a 90-day daily series has at most about 90 buckets per group;
applying a generic 24-bar cap to it would silently change the analytical
contract. Give line/scatter/heatmap lanes their own measured limits.

Specify:

- timezone and bucket boundary;
- whether empty buckets appear as zero, null, or absent;
- partial first/last bucket behavior;
- ordering and duplicate-bucket policy;
- group cardinality and maximum total marks;
- raw versus smoothed values;
- exact-table/export scope.

Generate missing buckets in the query or trusted result-shaping layer when
continuity matters. ECharts should not invent analytical rows. Preserve SQL
order unless the public contract declares another order.

When a requested range exceeds the mark budget, choose a coarser query bucket,
a declared downsample, or a narrower user-selected range. Always disclose the
effective bucket width and N-of-M behavior.

## Bounded analytical tables

Tables are exact-value and action surfaces, not a dump of arbitrary query
output. Require:

- declared columns, types, labels, units, and trusted formatters;
- deterministic SQL order and tie-breakers;
- an explicit row cap plus `truncated`/total metadata;
- stable result-scoped row keys;
- null/missing/infinite value conventions;
- row actions derived from the same capabilities as chart datum actions;
- a labeled export relation.

Prefer keyset pagination backed by an authorized bounded query for larger
drill-downs. Do not raise the dashboard result cap merely to simulate an
unbounded data grid in React. Virtualize only when the bounded row count and
measured render cost justify it, while retaining logical row count, focus, and
canonical export semantics.

If a chart and table share a query but the chart plots a subset, label the
table as either the plotted subset or complete bounded result. Do not let two
consumers silently imply the same population when they differ.

## Rare events and tail metrics

Failures, error signatures, p95/p99 latency, and affected-entity counts are
especially sensitive to sampling and truncation:

- keep them exact over the stated bounded snapshot by default;
- include sample count and coverage beside a percentile;
- do not estimate rare-failure prevalence from a newest-thread prefix;
- do not compute a tail percentile from only a chart's plotted top-N rows;
- separate query-result row limits from the source population scanned by an
  aggregate;
- use deterministic top-K plus an “other” group only when its meaning is
  explicit and the omitted population remains inspectable;
- preserve normalized error class/signature privacy boundaries in detail UI
  and exports.

Approximate quantiles or sketches are valid only when the bundle declares the
method and error/coverage semantics, the UI labels them approximate, and a
benchmark shows exact calculation is the material bottleneck.

## Cold recency-prefix previews

When cold extraction dominates time-to-first-useful-result, progression belongs
in one indexing pass:

```text
newest bounded prefix
  -> atomically publish clearly labeled partial generation
  -> continue the same scan without rereading the prefix
  -> atomically publish the final bounded generation
```

The prefix is exact for the rows it contains but intentionally recency-biased.
Call it **partial recent coverage**, not a sample, estimate, or representative
preview. Never extrapolate its rates, affected-thread counts, rank, or tail
metrics to the final bounded cohort.

Publish actual coverage, such as loaded/selected threads, fact count, event
caps, and degraded reads. Give partial and final generations distinct IDs so a
late partial response cannot overwrite final data. “Final” means complete for
the declared bounded window, not all BB history.

A preview should be one continuous scan with bounded publication overhead. A
separate sampled query followed by a full reread usually pays extra work and
attacks the wrong stage when extraction dominates and DuckDB SQL is already
fast.

## Stale while refresh

For a nonempty stale snapshot:

1. render the last final generation immediately;
2. show its exact as-of time and a non-blocking **Refreshing** state;
3. single-flight one pull for all consumers of the loader;
4. continue serving the old final result if the refresh is slow;
5. atomically publish facts, generation, coverage, and status;
6. requery/recompile only after the new generation is accepted;
7. preserve the prior final generation on refresh failure and mark status
   degraded with an actionable retry path.

Freshness is a loader contract shared across its queries and visualizations,
not a timer per chart. A `maxAgeMs` threshold says when a pull should refresh;
it does not require continuous polling. Manual refresh may force the same
single-flight coordinator.

The current Analytics v1 loader defaults to one hour and allows 1 minute
through 24 hours with `staleWhileRefresh: true`. Treat that as this plugin's
policy, not a universal ECharts rule.

## Choose exactness, reduction, and sampling

Use this order:

1. project only required typed columns;
2. filter and aggregate in the relational engine;
3. choose an appropriate bucket/grain;
4. apply deterministic SQL ordering/top-N;
5. compile a truthful bounded plotted view;
6. consider declared downsampling or approximation only after measurement.

Query-side reduction is preferable to silent renderer degradation because it
can preserve analytical meaning, provenance, total counts, and export policy.
Do not use ECharts progressive/large behavior when it removes interactions the
figure contract requires; choose a different renderer lane or reduce the query.

Sampling can improve feedback only when the sampled stage is a material share
of latency and the sampled result has valid semantics. It is usually unsuitable
for rare failures, ranks, affected-thread counts, repeated-use sequences, and
tail percentiles. If used, disclose method, seed/repeatability, population,
sample size, uncertainty/error, and which actions/exports are unavailable.

## Set performance gates

Instrument the full path:

```text
candidate listing
-> event/fact extraction
-> projection and snapshot publication
-> serialization and server TTFB
-> transfer and DuckDB materialization
-> SQL queue/execution
-> `CanonicalQueryResult` shaping/compilation
-> ECharts first useful paint
-> interactions, refresh update, export, and disposal
```

Record distributions, not one stopwatch run. Useful counters include source
events/bytes, changed versus skipped threads, fact rows, generation, query rows,
marks, cache hits, cancellation, CPU, peak RSS/heap, worker startup, transfer
bytes, and degraded/truncated coverage.

Define gates from product requirements and representative hardware. Reasonable
provisional gates for the current Analytics slice, to be replaced by measured
distributions, are:

- warm p95 time-to-first-useful-result below 1 second;
- cold partial p95 below 2.5 seconds when progression is enabled;
- progressive final convergence no more than 10% slower than one uninterrupted
  final scan;
- at least 80% fewer source event reads on ordinary incremental refreshes;
- authored SQL bounded by its timeout and result cap;
- no source extraction, DuckDB worker, timers, or chart instances while the
  Analytics surface is unused.

Benchmark cold and warm starts; 0, 1, 5, 20, and all selected threads changed;
one versus many visualizations sharing queries; range and predicate changes;
hidden/revealed figures; and repeated navigation/disposal. A fast SQL number
does not excuse expensive extraction, transfer, rendering, or retained memory.

## Disclose population and freshness

Every analytical surface should make these questions answerable without
opening developer tools:

```text
What population does this represent?
As of what time and snapshot generation?
Which dashboard predicates and parameters were applied?
Is it final, stale, refreshing, partial, degraded, or truncated?
How many rows/marks are shown out of how many?
Which source/thread/event limits constrain coverage?
Is any metric sampled or approximate?
What does “unknown” mean here?
```

Useful concise patterns include:

- `As of 2:07 PM · final bounded snapshot · 80 threads · 5,631 facts`
- `Refreshing; showing prior final snapshot from 2:07 PM`
- `Partial recent coverage: 16 of 80 selected threads; not a sample`
- `Showing 24 of 87 result rows; ordered by failures descending`
- `11 threads reached the 500-event cap`
- `Degraded: 2 selected threads retained from the previous generation`

Keep exact metadata available to accessibility, references, query inspection,
and export manifests. Do not hide material coverage only in a tooltip.

## Exercise the workload matrix

For each built-in and authored workload, test:

- empty, one-row, ordinary, maximum bounded, null-heavy, and extreme values;
- exact SQL order, deterministic ties, top-N, truncation, and N-of-M labels;
- warm cache, cold load, stale-while-refresh, failed refresh, degraded retained
  threads, and superseding generations;
- one loader with several queries and one query with several visualizations;
- rare-event recall and p95/p99 against the final bounded population;
- preview versus paired final coverage without extrapolation;
- range/predicate changes and dependency-aware query reuse;
- exact table, analytical reference, CSV, and image metadata agreeing on
  generation, filters, reduction, and coverage;
- interaction latency and correctness in every renderer/density lane;
- repeated mount, navigation, worker/chart disposal, and zero unused work.

Treat divergences in population, order, generation, or coverage as correctness
bugs even when the chart looks plausible.
