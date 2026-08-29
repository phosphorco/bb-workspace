# Prompt for the `bb-machine` staging agent

You are preparing Phosphor's canonical BB workspace on `bb-machine` for an
identity-first upgrade from BB 0.39 to exact upstream 0.40.

Start in `/home/ubuntu/bb`. Read `/home/ubuntu/bb/AGENTS.md` and every affected
child `AGENTS.md`. Then read this handoff directory in the order listed by its
README and run `scripts/preflight.sh` before changing anything.

Your authorized objective is to:

1. establish a safe canonical staging workspace;
2. reconcile explicitly selected source history without losing authored work;
3. freeze a reproducible 0.39 recovery receipt;
4. build the exact 0.40 baseline;
5. implement the reduced identity/authorship/migration/protocol port;
6. adapt and verify plugins against the exact generated SDK;
7. exercise the combined staging runtime; and
8. rehearse the upgrade and rollback on a consistent Rosetta database copy.

Do not mutate Rosetta, change `rosetta-machine`, claim normal ingress, force
push, reset, clean, stash, overwrite dirty work, or advance workspace gitlinks
before tested child commits are pushed. Stop at the Phase 10 promotion proposal
unless the operator gives separate production authorization.

Maintain an evidence directory outside the Git workspace. Report progress at
phase exits, including exact SHAs, commands, results, risks, and STOP/GO status.
Unknown receipts, schemas, ownership, or authority paths fail closed.
