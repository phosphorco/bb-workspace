# Query security and canonical results

Read this reference when changing an authored analytics bundle, its SQL validator or executor, the DuckDB boundary, result caching, or the data passed to a figure compiler. It extends the general ECharts ownership contract: SQL produces analytical truth; ECharts receives only a bounded compiled view.

## Contents

- [Treat SQL as untrusted code](#treat-sql-as-untrusted-code)
- [Validate structure, not text patterns](#validate-structure-not-text-patterns)
- [Bind values as parameters](#bind-values-as-parameters)
- [Bound execution independently](#bound-execution-independently)
- [Publish a canonical typed result](#publish-a-canonical-typed-result)
- [Generation, coverage, and caching](#generation-coverage-and-caching)
- [Validate figure bindings against results](#validate-figure-bindings-against-results)
- [Security and result tests](#security-and-result-tests)

## Treat SQL as untrusted code

An analytics bundle is `AuthoredFigureSpec` plus query intent, not trusted database code. A safe query lane has all of these properties at once:

- exactly one read-only query statement;
- only curated relations and explicitly declared CTEs are readable;
- no filesystem, network, extension, catalog, environment, or attached-database access;
- no DDL, DML, procedural commands, pragmas, configuration changes, or side effects;
- no authored callbacks or fragments that bypass the relational contract;
- typed runtime values are bound separately from SQL text;
- wall time, rows, memory, concurrency, and result conversion are independently bounded.

Do not infer safety from the query starting with `SELECT` or `WITH`. A query statement can still invoke table functions, inspect catalogs, perform costly intermediate work, or hide disallowed sources in subqueries.

Keep materialization of the curated fact relation outside the authored query lane. A trusted loader may use a filesystem-like DuckDB API or `read_json_auto` to create `tool_execution_fact_v1`; that does not authorize bundles to invoke those functions.

## Validate structure, not text patterns

Use a DuckDB-compatible parser or another grammar-aware representation and traverse the complete statement tree before execution. The validator must understand every scope and relation source, including:

- top-level and nested `FROM` clauses;
- explicit joins and comma joins;
- subqueries, lateral sources, set operations, and nested CTEs;
- quoted and qualified identifiers;
- table functions and scalar functions that can access external state;
- CTE declaration order, visibility, and shadowing;
- statement kind, not merely the first token.

Allow only the curated relation names for the selected loader plus CTE names declared in the valid lexical scope. Treat table functions as denied unless a specific trusted query-contract version explicitly allowlists one. Deny ambiguous or unsupported syntax rather than guessing.

The Analytics prototype's regex checks are a useful early rejector, not a security boundary. Looking only for names following `FROM` or `JOIN` can miss comma-separated relations and other grammar forms; collecting every `name AS (` pattern does not model CTE scope; keyword blocklists cannot enumerate every external-access path. Keep cheap text checks only as defense in depth before the structural validator.

Do not prescribe a parser package until it has been tested against the exact DuckDB grammar BB accepts. The acceptance test is semantic coverage of the supported grammar and adversarial fixtures, not package popularity. If no compatible parser is available, narrow authored queries to a BB-owned relational AST or query builder rather than claiming unrestricted SQL is safe.

## Bind values as parameters

Values such as range length, selected dimensions, project scope, and typed dashboard predicates must not be interpolated into SQL text. Replacing `$range_days` with a decimal string is constrained in the current prototype, but it is not the reusable parameterization model.

Use the prepared/bound parameter API supported by the pinned query engine and driver:

```text
validated statement with placeholders
    + typed parameter schema
    + normalized parameter values
        -> prepare or bind
        -> execute
```

The trusted query contract owns placeholder names, types, nullability, ranges, list-cardinality limits, and defaults. A bundle may refer to declared parameters; it may not introduce arbitrary parameter names or choose SQL types. Resolve field references through an allowlisted analytical schema and bind predicate values separately.

Cache keys include the normalized validated query identity, every normalized parameter, the loader/snapshot identity, and any authorization scope. Do not share results merely because two raw SQL strings normalize to similar text.

## Bound execution independently

Layer controls because no single limit contains every cost:

1. Limit query and bundle size, count, nesting, supported syntax, and allowed relations before execution.
2. Run the engine in an isolated worker or process with the minimum capabilities, unsigned extensions disabled, and no unnecessary filesystem or network access.
3. Serialize work per bounded engine when concurrent queries would multiply memory or CPU unpredictably.
4. Apply a deadline and real cancellation. Treat cancellation as a lifecycle to verify, not a promise that all engine work stopped instantly.
5. Wrap the result with `LIMIT maxRows + 1` or an equivalent trusted cap to detect truncation.
6. Bound conversion and serialization as well as SQL execution; a safe Arrow table can still become an expensive object graph.
7. Cancel or discard an obsolete query when a newer dashboard revision supersedes it.

An outer row limit bounds returned rows, not scanned rows, join cardinality, sort memory, window work, or aggregate state. The structural query policy and engine resource envelope must contain intermediate work. A two-second cancellation and 500-row result cap are valuable prototype controls, but they do not repair an incomplete relation validator.

## Publish a canonical typed result

Do not collapse the engine result to untyped column names and JavaScript values. Publish an immutable `CanonicalQueryResult`, a query-backed specialization of `CanonicalFigureData`:

```ts
type CanonicalQueryResult = {
  queryId: string;
  queryContractVersion: number;
  columns: readonly {
    name: string;
    logicalType: string;
    nullable: boolean;
  }[];
  rows: readonly Readonly<Record<string, Scalar>>[];
  datumKeys: readonly string[];
  generation: string;
  snapshot: {
    generationId: number;
    snapshotUpdatedAt: number | null;
    range: Readonly<Record<string, Scalar>>;
  };
  parameters: Readonly<Record<string, Scalar | readonly Scalar[]>>;
  coverage: CoverageMetadata;
  appliedPredicates: readonly DashboardPredicate[];
  totalRows: number | { lowerBound: number };
  truncated: boolean;
};
```

Preserve the engine's logical type before coercion. JavaScript `number`, ISO text, and `null` are insufficient to distinguish integers, decimals, timestamps, dates, and identifiers. Reject duplicate output names and unsupported values. Make any lossy conversion, such as 64-bit integer to `number`, an explicit query-lane policy with tests.

The canonical result is the truth for validation, exact-value tables, analytics references, and data export. `CompiledFigure` may contain `plottedRows`, `exportData`, and `InteractiveDatumMeta`, but it must not replace or reverse-engineer this result from ECharts `series.data`.

## Generation, coverage, and caching

`generation` identifies one immutable result, not merely a chart render. Derive it from the fact snapshot generation, validated query identity, bound parameters, authorization scope, and result-contract version. A result from generation 12 with a 14-day range is not interchangeable with generation 12 at 90 days.

Carry snapshot metadata with the result:

- snapshot update and full-reconciliation times;
- selected and successfully loaded thread counts;
- fact count;
- threads that reached an event cap;
- degraded status and safe error summary;
- whether coverage is final, a bounded recent window, or a cold partial prefix.

The current store correctly increments its fact generation only when facts change and publishes fact replacement plus metadata atomically. Metadata may still change while facts and generation remain stable, such as a failed reread that preserves prior facts but marks coverage degraded. Therefore cache the immutable row payload by fact generation and parameters, while refreshing coverage/status metadata independently. Never let a cached result erase newer degraded or freshness information.

Late responses must not overwrite a newer dashboard revision. Compare requested and returned generation/parameters before publishing a `CanonicalQueryResult`; use an abort signal for resource savings and a sequence guard for correctness.

## Validate figure bindings against results

Bundle-schema validation can prove that `x` and `y` look like field names. Only the returned schema can prove that they exist and have compatible types.

Before compiling an `AuthoredFigureSpec`:

- resolve every field against the exact `CanonicalQueryResult.columns`;
- reject duplicate or missing fields;
- require numeric measures where the mark and formatter need them;
- validate temporal/categorical axes intentionally rather than from JavaScript value shape;
- validate that fields needed for `datumKey`, `semanticKey`, predicates, provenance, tooltips, exact tables, and export are present;
- fail the figure with a useful contract error instead of rendering partial or misleading data.

Then compile the validated spec and canonical result into a `CompiledFigure`. ECharts owns layout and hit testing only after this boundary.

## Security and result tests

Include accepted and rejected statements, not only keyword examples:

- nested curated CTEs and legitimate window queries;
- comma joins, catalog relations, qualified names, and quoted identifiers;
- table functions such as file readers, generators, scanners, and extension functions;
- disallowed statements hidden behind `WITH`;
- comments, strings containing keywords, Unicode whitespace, and multiple statements;
- unsupported recursive or lateral constructs;
- missing, repeated, extra, null, boundary, and wrong-type parameters;
- cancellation during scans, aggregation, sorting, and conversion;
- `maxRows`, `maxRows + 1`, and expensive zero-row outputs;
- duplicate result columns, large integers, decimals, dates, timestamps, nulls, and non-finite values;
- generation changes, metadata-only coverage changes, stale responses, and cache isolation by scope.

Tests should exercise the same validator and bound-execution path used in production. A regex unit test does not validate the SQL trust boundary.
