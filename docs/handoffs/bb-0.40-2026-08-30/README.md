# BB 0.40 staging handoff — 2026-08-30

This directory is the self-contained handoff for preparing BB 0.40 on
`bb-machine` while Rosetta remains the normal 0.39 host.

Start an agent from `/home/ubuntu/bb`, give it [`AGENT_PROMPT.md`](AGENT_PROMPT.md),
and have it execute [`02-EXECUTION-RUNBOOK.md`](02-EXECUTION-RUNBOOK.md).

## Authorization boundary

The staging agent may:

- initialize and validate the canonical `~/bb` workspace on `bb-machine`;
- reconcile explicitly selected source branches without discarding dirty work;
- port, build, test, and run BB 0.40 in `fork/build/bb` on `bb-machine`;
- adapt organization and community plugins in their canonical workspace paths;
- rehearse the migration on a consistent copy of Rosetta's database; and
- commit and push reviewed staging branches.

The staging agent may not:

- mutate Rosetta's live database;
- update the normal-host `rosetta-machine` pin;
- claim `svc:bb` away from Rosetta;
- force-push, reset, clean, stash, or overwrite authored work;
- promote workspace gitlinks before selected child commits are tested and
  pushed; or
- accept the first live 0.40 write.

Those actions require a later explicit production GO.

## Reading order

1. [`00-CURRENT-STATE.md`](00-CURRENT-STATE.md)
2. [`01-DECISIONS-AND-SCOPE.md`](01-DECISIONS-AND-SCOPE.md)
3. [`02-EXECUTION-RUNBOOK.md`](02-EXECUTION-RUNBOOK.md)
4. [`03-MIGRATION-AND-DATA.md`](03-MIGRATION-AND-DATA.md)
5. [`04-PLUGIN-PORT-MAP.md`](04-PLUGIN-PORT-MAP.md)
6. [`05-VERIFICATION-EVIDENCE.md`](05-VERIFICATION-EVIDENCE.md)
7. [`06-CUTOVER-ROLLBACK.md`](06-CUTOVER-ROLLBACK.md)

Run `scripts/preflight.sh` before changing anything. Use
`scripts/capture-evidence.sh /an/explicit/output/directory` at each durable
checkpoint. `scripts/verify-handoff.sh` validates this bundle.

The child-repository source snapshot is published at the same branch name in
both repositories:

- `phosphorco/bb-fork`: `handoff/bb-0.40-2026-08-30` at
  `d890479d90baa63a415d400ddb89e7c43668bd37`
- `phosphorco/bb-plugins`: `handoff/bb-0.40-2026-08-30` at
  `44d934d32f2562df6ea2e430c5dcfaef25cecba8`

These are WIP preservation snapshots, not promotion branches. Fetch and inspect
them; select/rework commits deliberately rather than switching staging runtime
to an unverified snapshot wholesale.

## Target

- Release: `desktop-v0.40.0`
- Upstream commit: `f3cab2dd8c5c4be6d450be318550f3a04c8c3a1f`
- Current upstream base: `5205d98a74ed5a22469e521cf1f86b00b8232827`
- Current runtime: BB `0.39.0`
- Planned downstream protocol: `171`, based on upstream protocol `170`

## Success for tomorrow

Tomorrow's work is successful when `bb-machine` has a reproducible 0.40
staging runtime, the reduced fork and adapted plugins pass their checks, and a
production-copy migration plus rollback rehearsal has an evidence record.
Rosetta should still be unchanged at that point.
