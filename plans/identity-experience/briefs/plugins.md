# Providers and portable plugins sub-orchestrator

> Policy update — 2026-09-09: the approved [Identities and multiplayer ADR](../../../docs/adrs/2026-09-identities-and-multiplayer.md)
> governs this trusted shared deployment. Use verified people when available,
> applicable carried attribution next, and a stable machine actor otherwise;
> missing or failed person verification must not block ordinary operations.
> Never relabel fallback as a verified person or redirect pending personal-state
> writes to another owner. Independent access checks and data validation remain.
> Earlier rejection requirements below are superseded; versioned API descriptions
> and test receipts remain historical evidence, not proof of ADR implementation.


Read common.md first. Own reconciliation node `reconcile-plugins`; write only `plans/identity-experience/evidence/plugins.md`.

Investigate bb-identity package, provider-neutral consumption, Tailnet provider settings/health/name, selected plugin parity, state/view-as/recovery, Notifications/ntfy/Slack, Agent Connect residual acceptance, public packaging and same-artifact baseline/fork proof. Community Agentation Mentions currently directly calls identity-boundaries; package registry lookup most recently returned 404. These are hypotheses to verify, not a license to copy declarations or fake identity. Do not resurrect retired plugins (Learning, Chronoscope, Phosphor Checkouts, Prompt Stacks, Snippets, org Perspectives, FirstMate). Community Perspectives is selected.

Delegate a Terra high fast worker to inventory concrete provider-specific consumers and package/distribution constraints, read-only. You independently map feature and multi-client acceptance, preserving completed Agent Connect live evidence. Avoid one worker per plugin where one mechanical transform suffices. Need explicit target policy, current actor versus viewed subject, immutable operations, outage/no-singleton fallback, and portable local-user semantics. Provider label changes preserve plugin ID/config/state; a display rename is not containment. Return exact owned footprints, dependency contracts, and live tests that need humans/external-delivery authorization.
