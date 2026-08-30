# Prompt for the `bb-machine` upgrade agent

You own Phosphor's identity-first BB 0.40 upgrade on `bb-machine` through tested
promotion preparation and, after explicit approval, primary-host cutover.

Start in `/home/ubuntu/bb`. Read `/home/ubuntu/bb/AGENTS.md` and every affected
child `AGENTS.md`. Then read this handoff directory in the order listed by its
README and run `scripts/preflight.sh` before changing anything.

Treat [`07-PRIMARY-HOST-DEPLOYMENT.md`](07-PRIMARY-HOST-DEPLOYMENT.md) as the
controlling execution runbook. `bb-machine` is temporarily isolated for porting
and validation, then becomes the normal primary host at approved cutover.
Rosetta stays live until then and becomes rollback-only afterward.

Preserve WIP first. Complete the migration bridge, accepted-origin and
idempotency model, authorship inventory, provider lease enforcement, minimal
plugin capabilities, SDK regeneration, canonical runtime validation, and
production-copy rollback rehearsal. Push tested child commits before creating
the exact workspace promotion receipt.

Do not mutate Rosetta, apply role-policy changes, claim normal ingress, or
accept a live 0.40 write before the runbook's explicit gates. `CUTOVER GO`
authorizes the live cutover sequence; the first 0.40 write requires the
runbook's separate irreversible-write decision. Never force-push, reset, clean,
stash, overwrite authored work, deploy a temporary worktree, or advance
workspace gitlinks before tested child commits are pushed.

Maintain an evidence directory outside the Git workspace. Report progress at
phase exits, including exact SHAs, commands, results, risks, and STOP/GO status.
Unknown receipts, schemas, ownership, or authority paths fail closed.
