# Native experience sub-orchestrator

> Policy update — 2026-09-09: the approved [Identities and multiplayer ADR](../../../docs/adrs/2026-09-identities-and-multiplayer.md)
> governs this trusted shared deployment. Use verified people when available,
> applicable carried attribution next, and a stable machine actor otherwise;
> missing or failed person verification must not block ordinary operations.
> Never relabel fallback as a verified person or redirect pending personal-state
> writes to another owner. Independent access checks and data validation remain.
> Earlier rejection requirements below are superseded; versioned API descriptions
> and test receipts remain historical evidence, not proof of ADR implementation.


Read common.md first. Own reconciliation node `reconcile-native`; write only `plans/identity-experience/evidence/native.md`.

Investigate provider-neutral Identity settings, personal palette/favicon inheritance, author versus editor, model/tool context, native commands, queue/retry/restart, participants versus live presence, desktop/mobile/accessibility/performance. Compare latest selected rewrite with governing plan and old IA proposal. The new page and native sender patch already exist; do not plan a duplicate. Shared theme editing policy remains unchanged; machine fallback, never a fabricated verified person. Core must not import the shared plugin identity package or named providers.

Delegate a Terra high fast worker to inspect author/editor persistence and queue/native command/tool-context gaps, read-only. You independently inspect settings/presence and narrow upstream hooks. Return exact acceptance conditions and dependency boundaries that let theme, attribution and presence workers proceed independently after shared contracts are agreed. Distinguish accepted original author, editor, retry invoker and external asserted author; preserve upstream grouped-edit refusal unless separately selected.
