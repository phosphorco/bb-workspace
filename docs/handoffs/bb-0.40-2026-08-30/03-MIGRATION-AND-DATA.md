# Migration and data runbook

## Exact known receipts

| Migration | Timestamp | SHA-256 |
| --- | ---: | --- |
| historical identity | `1787517263970` | `303073917afaade57ab1072f09d51da7f62c42df71cc4e3009906b21b6d40709` |
| historical facets | `1787520353659` | `e051e9e2591a08907d9b53bb1243a11d5c1384f07a131c4a2a9367b0b4954cce` |
| upstream 0107 | `1787331095369` | `da63f96688d22f8b573b0673d1ba9e72051fde268f27052607231cb25bfae584` |
| upstream 0108 | `1787613751578` | `0ae872521ffd026ae67358c2ab016176711bf7477aa77060076c1100a0b30790` |
| upstream 0109 | `1787680413251` | `c9ced750de5290719e05a9289ab15f65eddec720c212f6691d8a4a85d3d372d4` |

Drizzle uses the greatest timestamp. The historical identity receipt therefore
causes ordinary migration to skip upstream 0107 unless an explicit bridge
applies it.

## Required manifests

1. **Rosetta legacy:** exact two historical receipts plus known identity/facet
   schema and data invariants.
2. **Active 0.40:** upstream 0.40 prefix plus the generated post-0109 identity
   migration. Fresh and adopted databases must match this active manifest.
3. **Rosetta inert facets:** exact allowlisted old facet receipt/tables/indexes/
   rows, permitted only on adopted Rosetta and referenced by no active object.

Fresh and adopted physical databases are not identical because only Rosetta
retains inert facet objects.

## Bridge contract

The migration-only command must:

- obtain an OS lock keyed by canonical DB path before opening SQLite;
- prove server, daemon, provider, router, and every other writer is stopped;
- bind no network listener and perform no ordinary startup writes;
- re-read complete ledger/schema under the lock;
- reject unknown/mismatched receipts and `_bb_p6r_*` staging artifacts;
- use one `BEGIN IMMEDIATE` transaction;
- apply exact upstream 0107, 0108, 0109, the identity corrective delta, and
  exact receipts in that transaction;
- require absent timestamps before receipt insertion;
- validate before one commit, checkpoint, close, reopen read-only, verify, exit;
- allow a target-state second invocation to recognize but mutate nothing; and
- make normal startup refuse legacy state with an actionable bridge command.

Do not port the generalized old staging-recovery engine. If one transaction
exceeds rehearsal thresholds, stop and redesign before production.

## Upstream 0107 preflight

Record the packaged SQLite version and inspect every `sqlite_schema` dependency
on generated `events.tool_name`, including indexes, triggers, views, and
generated expressions. Only the exact reviewed allowlist may remain before the
column is dropped. Preserve downstream identity columns.

## Preservation evidence

Use deterministic streaming checksums ordered by durable primary key for:

- events and all retained identity columns;
- actors and collaborators;
- threads, queues, interactions, edits, and deferred records;
- marketplace fixtures;
- all 360 observed participant relations;
- every `p6r-appearance:*` value in `app_theme`;
- prompt-stack settings; and
- Thread Progress phase, projection, and section state.

Capture counts, stable keys, and value hashes before and after. Seed a populated
post-0109/pre-identity fixture for deferred and marketplace preservation tests.

## Backup and restore gate

- Close all DB/WAL/SHM handles.
- Require a non-busy `wal_checkpoint(TRUNCATE)`.
- Record source/backup canonical paths, devices, byte sizes, SHA-256, and free
  space.
- Use and assert `synchronous=FULL` for the bridge; restore/assert runtime mode.
- Restore via a temporary file and same-filesystem atomic rename.
- Quarantine target WAL/SHM before reopening.
- Test real file-backed process kills before transaction, during rewrite,
  before commit, and after commit.
- Require `foreign_key_check`, `integrity_check`, manifest equality, checksums,
  and a mutation-free rerun.

Production free space must exceed measured backup + rewrite + WAL + restore
artifact use plus an explicit margin. The current Rosetta snapshot does not yet
meet an approved gate.
