# Decisions and scope

## Core motivation

The fork exists to represent real people correctly in a multiplayer system.
Provider-qualified identity, acceptance-time authorship, presence, and durable
human/agent/system origin belong in core because browser or plugin code cannot
reconstruct them safely after queueing, deferral, restart, or profile changes.

Optional feature policy, state synchronization, projections, and presentation
should remain in plugins where a narrow safe host capability exists.

## Non-negotiable 0.40 outcomes

1. Immutable authority is `(providerId, subject)`; profile fields are snapshots.
2. Every core write resolves a server-authored request actor or explicitly has
   none. Browser input cannot select a principal.
3. Request actors carry `trusted-provider`, `local-operator`, or `claimed`
   assurance. Claimed attribution is never verified authorization or a durable
   settings owner.
4. A discriminated accepted origin is human, agent, system, or legacy unknown.
5. Every accepted unit persists its origin/actor in the same acceptance
   transaction across create, fork, provisioning, immediate, queued, deferred,
   edit, replacement, interaction, and compact paths.
6. Deferred acceptance is durably idempotent across crash and retry.
7. Request-bound plugin sends expire after handler settlement/abort or plugin
   reload/disposal. No durable plugin authorship grant ships in this release.
8. Plugin-external actors use a tagged authority kind that cannot collide with
   BB providers and commit atomically with the accepted unit.
9. Agent-tool `turnAuthor` comes only from the stored accepted unit.
10. Provider WebSockets bind provider id and lease generation and close for
    re-authentication on provider replacement/release.
11. Server and daemon converge together on protocol 171 before commands enqueue.
12. Normal runs only an exact committed workspace receipt.

## Deliberate deferrals

- Generic Thread Facets as active schema/SDK/query authority.
- Native configurable prompt stacks and prompt-box modifications.
- Native per-person palette, roster, Electron, and mobile parity.
- Broad member roster or durable authorship-grant SDKs.
- Facet-specific generalized query-cache work.
- Patch 0032 unless its owner proves a release-critical invariant.
- Mixed protocol 170/171 command compatibility.
- A general migration engine for unknown/fleet database states.
- A malicious-plugin sandbox; installed backend and same-origin app plugins
  remain trusted code.

Historical facet, palette, prompt-stack, phase, and section data is preserved
and checksummed. Preservation does not imply active support or an import path.

## Supported database starts

Only these starts are supported:

1. an empty database; and
2. Rosetta's exact recognized legacy database.

Unknown receipts, hashes, schemas, or recovery artifacts fail closed.

## Participant policy

Always render a timeline unit from its stored accepted author. Add a narrow
thread participant field only after a production-copy equivalence report
accounts for all 360 preserved facet relations and defines inclusion, ordering,
pagination, snapshot choice, deletion/archive, and legacy-null behavior.
