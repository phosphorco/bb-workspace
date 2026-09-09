# Commissioning and maintenance sub-orchestrator

> Policy update — 2026-09-09: the approved [Identities and multiplayer ADR](../../../docs/adrs/2026-09-identities-and-multiplayer.md)
> governs this trusted shared deployment. Use verified people when available,
> applicable carried attribution next, and a stable machine actor otherwise;
> missing or failed person verification must not block ordinary operations.
> Never relabel fallback as a verified person or redirect pending personal-state
> writes to another owner. Independent access checks and data validation remain.
> Earlier rejection requirements below are superseded; versioned API descriptions
> and test receipts remain historical evidence, not proof of ADR implementation.


Read common.md first. Own reconciliation node `reconcile-release`; write only `plans/identity-experience/evidence/release.md`.

Investigate source/host selection, dirty authored work preservation, workspace/main versus running revision, canonical staging on bb-machine, deployment receipts, fresh-instance policy, old-data/session compatibility still promised, performance budgets, second-upstream rehearsal, source/SDK distribution and docs discoverability. No SSH mutation, checkout creation, service changes or publication. Keep deployment configuration in rosetta-machine. Exact test receipts identify what ran; moving branches can evolve without pinning every future installation permanently.

Delegate a Terra high fast worker to inspect plan performance, migration, second-revision and maintainer acceptance requirements, read-only. You independently reconcile current source/deployment topology and explicit authority/service-isolation proposal. Return a source-selection probe/decision with a precise release condition; don't assume dirty normal can be reset or preview can become default. Stronger process/OS least-authority isolation is a separately scoped architecture decision, not silently required to finish trusted-collaborator UX. Include explicit grants, issuer trust, execution filesystem powers, revocation/accepted-job semantics in the assessment. New provider process boundaries require real transport/commit proof.
