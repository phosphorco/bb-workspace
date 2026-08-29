# Current state at handoff

Captured on 2026-08-29 in `America/New_York`. Re-run the preflight because
branches and disk usage may change before execution.

## Workspace composition

| Repository | HEAD | Recorded workspace gitlink | Local divergence from `origin/main` | State |
| --- | --- | --- | --- | --- |
| `bb-workspace` | `0d8c464eaf356fbbbd80571ef2a251269ab11e17` before this handoff commit | n/a | ahead 2, behind 1 | dirty only because child HEADs differ |
| `fork` | `8e86661c7b00504de005abffb66b46248e189f6d` | `a5aecfb15581d1a2d110c119af86d162c3ef1b42` | ahead 3, behind 2 | dirty |
| `plugins` | `200fc2b` at final snapshot | `6955afa822875e17b1e77b88810abcbf274b28ea` | ahead 19, behind 4 | dirty |
| `community-plugins` | `0e6290de8979d2b5562f8c6d76b5dec39494af75` | same | inspect again | clean |
| `fork/upstream` | `5205d98a74ed5a22469e521cf1f86b00b8232827` | same | detached | clean |

Do not merge, rebase, or update a child merely to make this table look clean.
Inspect the commits on both sides, attribute every dirty path, and preserve all
authored work.

## Remote preservation snapshots

All committed and dirty source material visible during this handoff was
preserved without modifying local child `main` or its real index:

| Repository | Remote branch | Snapshot commit | Meaning |
| --- | --- | --- | --- |
| fork | `handoff/bb-0.40-2026-08-30` | `d890479d90baa63a415d400ddb89e7c43668bd37` | fork HEAD plus dirty queue metadata, patches 0029/0030/0032, and full planning notes |
| plugins | `handoff/bb-0.40-2026-08-30` | `44d934d32f2562df6ea2e430c5dcfaef25cecba8` | plugin HEAD plus every remaining dirty/untracked source and generated file |

The final snapshot commits are explicitly WIP and were not represented as
tested. Their parents retain the individually authored commits. Use them as a
lossless comparison/recovery source, then split and verify selected work before
integration. Do not advance workspace gitlinks to the snapshot commits.

## Plugin commits settled during preparation

These commits are local plugin history and have focused verification:

| Commit | Purpose | Verification |
| --- | --- | --- |
| `b8db648` | Idle-aware Background Jobs scheduling | 11 tests, typecheck, build |
| `febdd0c` | Complete Thread Manager review/recovery helpers omitted by an earlier commit | 39 tests, typecheck, build |
| `4f28b93` | Add Snippets and Prompt Stacks plugins | 5 + 3 tests, both typechecks/builds, workspace sync and SDK checks |
| `6ff7e90` | Shared Plan Graph canvas and Plan Portfolio filtering | 98 + 154 tests, both typechecks/builds |
| `200fc2b` | Retain Subscription Router Claude account snapshots | committed by its active owner after the audit; re-verify with that owner |

No workspace gitlink was advanced for these commits or snapshots. They are not
a promotion receipt.

## Remaining dirty plugin cohorts

- `subscription-router`: recently active; source mostly committed at the final
  snapshot, but app styling/generated declarations remain dirty.
- `rosetta-slack`: recent server/state/test work; obtain owner confirmation.
- `thread-progress`: multiple interleaved feature, synchronization, facet, and
  presentation changes. Split by invariant before committing.
- `diffs`: a new host contract, host entrypoint, repository scanning/profile
  cache, tests, and generated workspace metadata. Review as one host-capability
  cohort.
- `thread-links` and `future-threads`: older UI changes and likely next safe
  candidates after focused review.
- repository-wide `types/bb-plugin-sdk*.d.ts`: generated from the current fork;
  commit once as one generated refresh only after source contracts settle.
- `bun.lock` and `tools/workspaces-sync/definition.ts`: contain remaining
  changes owned by the active cohorts. Do not stage them wholesale.

## Dirty fork state

The working patch queue currently names 32 candidates. README, DOWNSTREAM,
series hashes, and result-tree receipt are not reconciled. Untracked authored
patches include 0029, 0030, and 0032; patch 0031 is committed at fork HEAD.

Before moving upstream, produce the freeze table required by the execution
runbook and commit/push one reproducible 0.39 fork receipt.

## Runtime and capacity

- Materialized runtime: `/home/ubuntu/bb/fork/build/bb`
- Reported version: `0.39.0`
- Rosetta database at snapshot: `/home/ubuntu/.bb/bb.db`
- Database size: `4,932,374,528` bytes
- WAL size at snapshot: `58,269,192` bytes
- Filesystem free space: approximately `26 GiB` (`97%` used)

Twenty-six GiB is not an approved live-migration margin. The migration must be
rehearsed and its measured backup, rewrite, WAL, build, and recovery footprint
plus margin must fit before production GO. The preflight uses a conservative
40-GiB staging floor; production requires the measured gate, not that generic
number.
