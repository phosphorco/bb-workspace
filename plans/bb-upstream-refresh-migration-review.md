# Upstream refresh: migration bridge review

Reviewed 2026-09-22 against the read-only replay at
`/tmp/bb-upstream-refresh.84BJxg/bb` (target `78804e79d280998a3b4c3c965ec1b5845703bc0e`).
This is an implementation review, not evidence from a live database. No source
or database was changed.

## Evidence reviewed

- `packages/db/src/migrate.ts`: legacy timestamp admission at lines 168 and
  1203, per-migration application at 593, post-Drizzle column bridge at 1234,
  and ordering in `migrate()` at 1651.
- `packages/db/drizzle/0131_zippy_reavers.sql`: uses `CREATE TABLE IF NOT
  EXISTS` and `CREATE [UNIQUE] INDEX IF NOT EXISTS` for the identity/context
  schema.
- `packages/db/test/migrate.test.ts`: the bridge fixture builder at 302 and
  the two bridge tests at 5855.
- The historical 0119--0122 fixture SQL agrees with the preserved historical
  migration source reviewed for this purpose, apart from a terminal newline.

## What is sound

`applyMigrationStatements()` executes every target migration's SQL and inserts
its `__drizzle_migrations` row in one SQLite transaction. Consequently a normal
failure while applying one manually replayed 0119--0127 migration rolls that
migration back, and a process crash between *completed* replayed migrations can
resume from their durable markers without duplicating a target migration.

The normal Drizzle batch is also transactional in the installed SQLite dialect.
The existing happy-path test proves a complete historical ledger can reach 0131,
retains selected identity/context rows, and can be invoked again without
duplicating the selected trace row.

These are useful properties, but they do not prove the full bridge is atomic or
that arbitrary databases bearing one of the old timestamps are safe inputs.

## Findings

| Severity | Finding | Evidence and effect | Required disposition |
| --- | --- | --- | --- |
| High | The post-Drizzle schema reconciliation is not atomic and has no durable bridge-complete marker. | `drizzleMigrate()` can commit 0131, then `applyIdentityAndContextMagnetSchemaBridge()` adds nine columns one statement at a time. A crash after any `ALTER` leaves the migration ledger at 0131 while the schema is only partly compatible. A later retry is intended to finish it, but an intervening reader sees an inconsistent contract. | Make reconciliation one transactional, validated migration/bridge with an explicit completion record, or fail closed before exposing the DB until validation succeeds. Add fault-injection/reopen tests after each guarded `ALTER` and after Drizzle commits but before reconciliation. |
| High | Legacy admission is timestamp-presence only. | A single matching old `created_at` activates the replay; the old row hash is not checked, and no legacy schema fingerprint is checked. `markMigrationApplied()` similarly treats any existing target timestamp as applied before final target validation. A corrupted, foreign, or holey old ledger can therefore be classified as this known legacy fork and progress past it. | Admit only a coherent, documented legacy history plus a schema fingerprint. Define supported partial histories explicitly; fail closed with a repair/export instruction for unknown, mixed, or contradictory ledger/schema states. Test one-old-marker, holes, wrong old hashes, and a mixture of old and target rows. |
| High | Existing identity/context objects can silently retain wrong constraints or indexes. | 0131 uses `IF NOT EXISTS`; SQLite will not alter an existing table, and an existing index with the same name is retained. The later bridge only checks/adds listed columns. It does not compare table definitions, foreign keys, primary/unique keys, checks, or index column/order. | After the bridge, validate `table_info`, `foreign_key_list`, `index_list`, and `index_info` against the expected 0131 contract (or rebuild affected tables in a separately atomic, data-preserving migration). A mismatch must fail closed rather than claim 0131 is applied. Include same-name wrong-index, absent FK, and absent unique-key fixtures. |
| Medium | Foreign-key enforcement is disabled across manual replay and no integrity check precedes re-enable. | `migrate()` sets `PRAGMA foreign_keys = OFF` before the replay and simply turns it back on in `finally`. SQLite does not retroactively validate orphaned rows when enforcement is re-enabled. Several replayed/0131 objects add foreign keys. | Run and enforce `PRAGMA foreign_key_check` before successful completion, with an explicit remediation path for pre-existing violations. Exercise an orphaned legacy fixture and prove no successful migration silently leaves it. |
| Medium | The fixture proves one clean full preimage, not the migration's stated compatibility surface. | `createLegacyIdentityAndContextMagnetHistory()` creates target 0000--0118 from the current files, applies all four legacy markers at once, and inserts synthetic hashes of the form `legacy-<timestamp>`. It seeds selected identity/context rows only. It does not model partial/mixed history, historic marker hashes, duplicate or orphaned data, or schema drift. | Preserve a byte-for-byte old database fixture (or build it from the old release migration runner), then add a matrix for every supported partial state and a corrupt/unknown rejection matrix. Do not use passing synthetic fixtures as evidence for arbitrary field databases. |
| Medium | Data-bearing replayed migrations have no preservation assertions. | The manual set includes migrations that create constrained tables and move settings data. In particular, the environment-variable migration copies matching `app_settings_values` rows and deletes the source rows in the same target migration transaction. The bridge test neither seeds nor asserts that move, target 0119 catalogs, thread lifecycle columns, attachment rows, pruning data, queued-message additions, image metadata, indexes, or checks. | Add data fixtures for each replayed migration: success, uniqueness conflict/rollback, and retry. Assert source-to-destination counts and values, required indexes/constraints, and no duplicate records after reopen/retry. |
| Medium | Downgrade is not an available safety valve. | The bridge adds columns/tables and the replay includes data-moving work; no down migrations or reversible bridge ledger are supplied. | State upgrade-only support explicitly. Require a verified pre-upgrade backup/restore path and test restoring a preimage; do not promise in-place downgrade. |

## Acceptance test matrix

Before accepting the source upgrade for existing databases, run these focused
tests in addition to the reported clean and full-legacy synthetic cases:

1. Inject failure after every manual 0119--0127 application, after the Drizzle
   batch, and after every post-Drizzle `ALTER`; close/reopen and retry. Assert
   an identical final schema, ledger, indexes, foreign-key check, and data set.
2. Test the supported partial legacy histories individually and cumulatively,
   plus holes, wrong legacy hashes, a target timestamp with a wrong hash, and a
   foreign timestamp. Unknown or incoherent states must stop before data work.
3. Test already-existing same-named tables/indexes with missing unique/FK/check
   constraints. The migrator must validate/rebuild safely or reject them; it
   must never silently mark 0131 as complete.
4. Seed real data for every replayed target migration, especially the
   settings-to-environment-variable move and its constraint-failure rollback.
   Assert source/destination conservation and idempotent retry.
5. Test legacy orphans while foreign keys are disabled and require an explicit
   `foreign_key_check` failure before success.

## Review conclusion

The bridge has a credible incremental retry mechanism for each *target migration*
but is not yet demonstrated safe for the whole claimed legacy compatibility
surface. The high-severity admission and schema-validation gaps can cause a
foreign/corrupt or partially drifted database to be silently treated as a known
preimage. Resolve or explicitly scope those cases out with fail-closed behavior
before treating the replay's 611 passing synthetic upgrade tests as release
evidence.

## Remediation re-review (2026-09-22)

The replay now materially resolves three original findings:

- legacy rows are admitted as exact known hashes and an ordered legacy prefix;
- the guarded post-Drizzle additions, schema checks, foreign-key check, and
  `bb_schema_bridge_completions` record execute in one SQLite transaction;
- focused tests now cover supported prefixes, malformed rows, one drifted
  index, and fresh-process retry after injected failures.

The transactional marker closes the earlier partial-column crash window: a hook
failure inside that transaction rolls back the added columns and completion
table, and the retry path is fail-closed until the completion record can be
written.

The following gaps remain before the current validation can be called a full
0131 schema contract.

| Severity | Remaining gap | Concrete evidence | Required follow-up |
| --- | --- | --- | --- |
| High | The 0131 validator verifies only a small subset of structural constraints. | `assertIdentityAndContextMagnetSchema()` checks all 15 table *names*, the nine bridge-column *names*, three of the 13 named indexes, and two of the 13 foreign keys declared by `0131_zippy_reavers.sql`. It does not verify base column type/null/default/primary-key shape, the remaining ten indexes, remaining eleven foreign keys, or table-level keys. Existing `CREATE ... IF NOT EXISTS` statements will preserve a same-named malformed object. | Represent the complete 0131 contract in the validator: every column's type/null/default/PK position, every named index's uniqueness and ordered columns, and every FK target/actions. Add malformed-table, wrong-FK, wrong-unique, and wrong-index fixtures for each object family. |
| High | The exact-ledger test is existential, not cardinality-safe, and still ignores unknown rows at or before the final legacy timestamp. | Legacy and target hash checks use `some(...)`; `__drizzle_migrations` has no uniqueness constraint on `created_at`. A duplicate record at a known timestamp can include one accepted hash and one foreign hash. The later-row rejection deliberately skips all rows with `created_at <= latestLegacyCreatedAt`, allowing a branch-local/foreign older row to coexist silently. | Require exactly one approved row for every admitted legacy/target timestamp and reject any unrecognized ledger row unless it is an explicitly documented compatibility exception. Add duplicate-correct-plus-wrong-hash and unknown-earlier-timestamp tests. |
| Medium | Fault coverage does not exercise each real guarded addition or preservation under retry. | The test has one `afterColumnAdded` hook that throws at the first addition reached. It does not iterate the column name/ordinal. Its fresh-process cases begin from a clean database, rather than a data-seeded legacy/preexisting-schema case. | Force failure after every actual bridge column alteration and immediately before commit, then reopen/retry a seeded compatible preimage. Assert legacy rows, ledger cardinality, full schema contract, and foreign-key integrity after retry. |
| Medium | The new global `foreign_key_check` is sensible but its bridge-specific rejection path is not demonstrated. | `assertForeignKeyIntegrity()` runs both inside the bridge transaction and after migration, but the identity/context test block has no orphaned parent/child fixture. | Seed an orphan in an affected identity/context relation while `foreign_keys` is off; assert completion-marker rollback and a descriptive failure, then prove a repaired database succeeds. |

The original data-bearing replay and upgrade-only backup/restore coverage gaps
also remain. The reported 73 focused tests are positive regression evidence,
but they do not yet cover the full contract above.

## Final remediation re-review (2026-09-22)

The latest replay revision resolves the ledger cardinality and early-unknown-row
findings with a global duplicate-timestamp check and fail-closed early-row
admission. It also adds the target 0123 rollback/reopen test. The schema
validator now checks all 13 named 0131 indexes (owning table, ordered columns,
and uniqueness), all 14 declared foreign keys (target and actions), and the
nine bridge columns' type, nullability, and default. This is a substantial
improvement over the prior subset validation.

One structural limitation remains: there is no equivalent target-native proof
for the base shape of the 15 identity/context tables. `CREATE TABLE IF NOT
EXISTS` does not validate an existing table, and the bridge currently does not
validate those tables' non-bridge columns, defaults/nullability, or composite
primary-key order. A same-named base table can therefore pass the new
table/index/FK checks while retaining a missing or incompatible non-bridge
column or key definition. No other migrator path in the reviewed source
compensates for that omission.

Treat the upgrade as fail-closed for the now-checked indexes, foreign keys,
bridge columns, and ledger. Keep the base-table shape as an explicit remaining
compatibility limitation until it is represented as complete `table_info` / PK
contracts (or a controlled table-rebuild migration) with negative fixtures.

## Structural-contract closure re-review (2026-09-22)

The final replay revision closes the base-table limitation above. It derives the
15 identity/context table contracts from the checked `0131_zippy_reavers`
migration SQL, then validates exact column count/order, type, nullability,
default, and ordered primary key. The two accepted historic append orders are
limited to the receipt and snapshot tables, are complete fixed lists, and still
require the same count and per-column definitions. All 13 named indexes and all
14 declared foreign keys/actions remain separately verified.

I found no target-native same-name schema-drift bypass remaining in the reviewed
bridge scope: `CREATE TABLE IF NOT EXISTS` is now followed by the derived table
contract, the explicit index/FK contract, and bridge-column validation before
the transactional completion marker is written. The replay author reports
focused migration tests 79/79 and a fresh full DB suite 631/631 green; those
test results were reported to this review, not independently rerun here.
