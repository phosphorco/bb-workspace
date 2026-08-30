# BB 0.40 primary-host handoff — 2026-08-30

This directory is the self-contained handoff for preparing BB 0.40 on
`bb-machine`, validating it in isolation, and—only after explicit approval—
making `bb-machine` the normal primary host. Rosetta remains live until that
cutover and becomes rollback-only afterward.

Start an agent from `/home/ubuntu/bb`, give it [`AGENT_PROMPT.md`](AGENT_PROMPT.md),
and have it execute
[`07-PRIMARY-HOST-DEPLOYMENT.md`](07-PRIMARY-HOST-DEPLOYMENT.md), using the
earlier numbered documents as its supporting design and evidence record.

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
8. [`07-PRIMARY-HOST-DEPLOYMENT.md`](07-PRIMARY-HOST-DEPLOYMENT.md)

Run `scripts/preflight.sh` before changing anything. Use
`scripts/capture-evidence.sh /an/explicit/output/directory` at each durable
checkpoint. `scripts/verify-handoff.sh` validates this bundle.

The child-repository source snapshot is published at the same branch name in
both repositories:

- `phosphorco/bb-fork`: `handoff/bb-0.40-2026-08-30` at
  `b3f486c8f9c15c4353ece5b609041426a0734941`
- `phosphorco/bb-plugins`: `handoff/bb-0.40-2026-08-30` at
  `e8cc4c7a50effbd6b721dfb585a8d6f89cc37821`

These are WIP preservation snapshots, not promotion branches. Fetch and inspect
them; select/rework commits deliberately rather than switching staging runtime
to an unverified snapshot wholesale.

## Target

- Release: `desktop-v0.40.0`
- Upstream commit: `f3cab2dd8c5c4be6d450be318550f3a04c8c3a1f`
- Current upstream base: `5205d98a74ed5a22469e521cf1f86b00b8232827`
- Current runtime: BB `0.39.0`
- Planned downstream protocol: `171`, based on upstream protocol `170`

## Success

Preparation is successful when `bb-machine` has a reproducible 0.40 candidate,
the reduced fork and adapted plugins pass their checks, and a production-copy
migration plus rollback rehearsal has an evidence record. Deployment is
successful only after an approved cutover leaves `bb-machine` running the exact
normal workspace receipt, primary ingress resolves only to it, and Rosetta is
recorded as rollback-only.
