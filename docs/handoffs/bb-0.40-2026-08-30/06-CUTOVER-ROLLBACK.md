# Later production cutover and rollback

This is prepared for tomorrow's staging evidence but is not authorization to
execute against Rosetta.

## Promotion order

1. Exercise the exact combined staging composition.
2. Commit and push selected fork, plugins, and community-plugin trees.
3. Prove committed tree hashes equal tested trees.
4. Advance workspace gitlinks.
5. Run `./bin/check --role staging`.
6. Commit and push the workspace promotion receipt.
7. Obtain explicit production GO.
8. Update the single `rosetta-machine` normal pin to that receipt.
9. Normal checks out the exact receipt and passes `./bin/check --role normal`.
10. Only then perform live migration/deployment.

## Live gate 1 — migrated read-only

- stop ingress/background/server/daemon/provider/router writers;
- capture final manifests/checksums/disk/backup;
- run only the migration-only bridge from the pinned artifact;
- start 0.40 with writes still blocked;
- verify health, machine visibility, plugins, active/inert manifests, ledger,
  FK/integrity/checksums, and mutation-free bridge rerun.

Paired rollback remains available here.

## Live gate 2 — first 0.40 write

Before enabling writes, record either:

- paired rollback with exact old DB/server restore and rehearsed out-of-band
  daemon 171-to-153 reinstall; or
- explicit forward-only recovery with its exact artifact and command.

Record GO owner and timestamp. Then converge protocol 171, enable writes, run
two-client write scenarios, and soak.

## Rollback

Before the first write:

1. stop all writers;
2. restore the consistent pre-upgrade DB as one unit;
3. quarantine target WAL/SHM;
4. restore exact 0.39 server artifact;
5. perform rehearsed out-of-band daemon downgrade to protocol 153;
6. verify ledger, runtime, plugins, router, and machine connection;
7. preserve failed-upgrade evidence.

After any 0.40 write, old-DB rollback may lose data and is forbidden without
explicit acceptance of that loss.

## Stop conditions

Stop if source target, receipt/hash/schema, participant equivalence, authority
inventory, SDK generation, server/daemon convergence, backup restore, disk/WAL,
or tested-versus-committed tree identity differs from the evidence. Do not
improvise a broader migration or authority model during deployment.
