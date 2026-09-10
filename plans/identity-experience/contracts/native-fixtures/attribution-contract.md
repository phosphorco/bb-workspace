# Native attribution contract fixture — proposed v1

> Policy update — 2026-09-09: the approved [Identities and multiplayer ADR](../../../../docs/adrs/2026-09-identities-and-multiplayer.md)
> governs this trusted shared deployment. Use verified people when available,
> applicable carried attribution next, and a stable machine actor otherwise;
> missing or failed person verification must not block ordinary operations.
> Never relabel fallback as a verified person or redirect pending personal-state
> writes to another owner. Independent access checks and data validation remain.
> Earlier rejection requirements below are superseded; versioned API descriptions
> and test receipts remain historical evidence, not proof of ADR implementation.


**Status:** proposal for the `native-contract` oracle. It is not a current API,
implementation grant, migration, or runtime-test claim. Root and the plugins
coordinator review this fixture; `compose-native` owns every shared export, DB
schema/migration, generated snapshot, and patch-series handoff.

`P` source citations below mean the selected preview materialization at
`/home/ubuntu/bb-service/fork/build/bb` (comparison evidence, not the selected
implementation workspace).

## Contract purpose and boundaries

Core owns only captured native acceptance facts, their atomic persistence and
their faithful projection through native execution. The core must not import
`@phosphorco/bb-identity`, name an identity provider, authenticate an external
integration, or choose a feature's personal-state policy. A plugin verifies an
external subject; core derives its canonical namespace from the registered
plugin owner and records the supplied source. Callers cannot select another
plugin's namespace.

This replaces neither the existing 0016 native sender nor its Identity settings
page. It reconciles the sender's person-only `p6rAuthors` with the P6R
contribution path's external origin and editor vocabulary. It does not create a
presence API or personal-appearance storage.

Current facts motivating the proposal:

- The native route captures a provider-admitted author and revalidates it before
  persistence: [P native-request](/home/ubuntu/bb-service/fork/build/bb/apps/server/src/services/p6r/native-request.ts:28).
  The current `P6rMessageAuthor` accepts only a provider-verified person:
  [P author schema](/home/ubuntu/bb-service/fork/build/bb/packages/domain/src/p6r-message-author.ts:3).
- Queue content update overwrites the only `p6rAuthors` field:
  [P queue update](/home/ubuntu/bb-service/fork/build/bb/packages/db/src/data/queued-thread-messages.ts:625).
  Accepted-message edit captures the current request actor as a new author:
  [P accepted edit](/home/ubuntu/bb-service/fork/build/bb/apps/server/src/services/threads/thread-edit-message.ts:525).
- P6R already namespaces external asserted sources and has `latestEditor` in its
  sidecar, but its initial path sets editor equal to author:
  [P P6R protocol](/home/ubuntu/bb-service/fork/build/bb/apps/server/src/services/p6r/identity-protocol.ts:100),
  [P P6R acceptance](/home/ubuntu/bb-service/fork/build/bb/apps/server/src/services/p6r/native-acceptance.ts:58).
- Current model formatting is agent-only text per group, while the command only
  forwards `input`/`inputGroups`: [P formatting](/home/ubuntu/bb-service/fork/build/bb/apps/server/src/services/p6r/native-authorship.ts:37),
  [P command](/home/ubuntu/bb-service/fork/build/bb/apps/server/src/services/threads/thread-commands.ts:261).
  Tool provenance advertises only `partial` and may return `unknown`:
  [P provenance](/home/ubuntu/bb-service/fork/build/bb/apps/server/src/services/p6r/identity-protocol.ts:141).

## Proposed data contract

The following names are deliberately proposal-only. They describe one additive,
namespaced envelope (`p6rAttributionV1`) rather than new top-level product
concepts or a second dispatcher.

```ts
type P6rPresentationV1 = {
  displayName: string; handle: string | null; avatarUrl: string | null;
};
type P6rActorSnapshotV1 = {
  key: string;                       // opaque canonical key
  presentation: P6rPresentationV1;
} & (
  | { evidence: "provider-verified";
      identity: { kind: "person"; issuer: string; subject: string } }
  | { evidence: "integration-asserted";
      identity: { kind: "external"; pluginId: string; subject: string } }
);

type P6rOriginV1 =
  | { kind: "person"; actor: P6rActorSnapshotV1 }
  | { kind: "external"; actor: P6rActorSnapshotV1 }
  | { kind: "agent"; agentId: string | null }
  | { kind: "system"; reason: string }
  | { kind: "unknown"; reason: "legacy" | "upstream-unattributed" | "missing-source" };

type P6rGroupAttributionV1 = {
  originalAuthor: P6rOriginV1;        // immutable after acceptance
  latestEditor: P6rActorSnapshotV1 | null;
};

type P6rRetryInvocationV1 = {
  originalRequestId: string;
  attempt: number;
  invokedBy: P6rOriginV1;             // explicit person/system/agent/unknown origin
};

type P6rInteractionResolutionV1 = {
  interactionId: string;
  resolvedBy: P6rOriginV1;            // explicit nonperson origin, never ambiguous null
};

type P6rAttributionV1 = {
  version: 1;
  groups: readonly P6rGroupAttributionV1[]; // exactly aligned to inputGroups
  retry?: P6rRetryInvocationV1;
  interactionResolution?: P6rInteractionResolutionV1;
};
```

Rules:

The decoder must require outer person/external kind to match actor.identity.kind
and evidence; reject mismatches, invalid canonical keys and over-limit fields.
Reuse current bounded core codecs rather than accept arbitrary strings. No new
local-user/upstream-default assurance literal is introduced here: baseline
operations retain the existing admitted default semantics; missing historical
facts stay unknown. If native default-person snapshots are selected, add an
explicit host-issued variant through shared-contract review, never a claimed
person fallback. Invocation/resolution records are event-specific facts: expose
them to tools only through an exact causal link, not globally to all tools.

1. On direct/queued acceptance, core constructs `originalAuthor` from a captured
   core admission or a validated plugin external-origin operation. A client
   cannot submit this envelope or select a person key. An external name is not a
   person and must retain its plugin ID/source label.
2. `latestEditor` is the actor responsible for the visible revision: initially
   equal to the captured human/external author when that fact exists; on an edit
   it changes only in the same transaction as content and history rewrite.
   `originalAuthor` never changes. Legacy/unknown history remains `unknown`;
   it is never filled with the retryer, editor, operator, or current profile.
3. Reorder, grouping, scheduling, queue claim/drain, fork retention and retry
   copy group records without author resolution. A retry writes a separate
   `retry` invocation fact; its `invokedBy` cannot alter any group source.
4. Interaction resolution records `resolvedBy` with the resolution/lifecycle
   event. It does not author the prompt, tool call, queued text, or provider
   turn. Existing current behavior has no native resolver capture at the result
   settlement boundary ([P command result](/home/ubuntu/bb-service/fork/build/bb/apps/server/src/internal/command-results.ts:48)).
5. Every new producer supplies explicit origin or explicit non-human/unknown.
   Optional absence is only a legacy-read representation, never a new-write
   shortcut.

## Provider, model, and tool projection

At the last common execution point, `P6rAttributionV1.groups.length` must equal
the exact provider-facing `inputGroups.length`. If ungrouped input is used, the
contract normalizes it to a single group before validating alignment. It carries
the same structured group records to these consumers:

| Consumer | Required projection |
| --- | --- |
| Transcript/timeline | Original author, latest editor when distinct, and textual external-source label. Historical unknown remains unknown. Rendering may resolve a current profile only as presentation; it may not rewrite the snapshot. |
| Provider/model | Structured metadata or generated agent-only presentation derived solely from the envelope. One group gets one label. It is idempotent: retry/resume must not add duplicate labels. Raw event input remains unmodified. |
| Tool context | A server-admitted correlation receives the plural group records and retry/interaction facts. It returns `unknown`/`partial` when the correlation or durable source is absent; it never substitutes the currently connected actor. |

For newly accepted native paths selected by this campaign, absence of the
required causal tool correlation fails completion. Honest partial/unknown is a
compatibility/error representation, not a passing replacement for the required
new-path plural author/editor oracle.

Attachments are valid group content even when no text block exists. Their group
still gets exactly one attribution record and must survive attachment staging;
the daemon already stages groups as groups ([P attachments](/home/ubuntu/bb-service/fork/build/bb/apps/host-daemon/src/command-handlers/prompt-attachments.ts:278)).

### Proposed command augmentation

If the shared-contract review selects a daemon wire extension, for ordinary
`thread.start` and `turn.submit` only add optional
`p6rAttribution?: P6rAttributionV1` beside—not inside—`input` and
`inputGroups`. The server validates group alignment before event commit; the
daemon validates it again after attachment staging and passes it to provider and
server-admitted tool correlation. Adding this wire field requires the normal
host-daemon protocol version bump and compatibility witness.

Do not parse authorship out of text. Do not replace the upstream dispatcher.
Standalone `/compact` and `/clear` retain their current structured command
input and parser behavior; they receive no synthetic sender prefix. Grouped
accepted-message edit remains refused until separately selected, exactly as the
current explicit refusal does ([P grouped refusal](/home/ubuntu/bb-service/fork/build/bb/apps/server/src/services/threads/thread-edit-message.ts:217)).

## Current APIs versus proposed contract

| Area | Current selected preview | Proposed v1 boundary |
| --- | --- | --- |
| Native author | `p6rAuthors: (P6rMessageAuthor|null)[]`, provider-verified person only | `groups: P6rGroupAttributionV1[]`, preserving person, external, non-human, or unknown origin. |
| Queue edit | Route captures current author and DB overwrites `p6rAuthors` | Preserve `originalAuthor`; atomically update `latestEditor` and content. |
| Accepted edit | Re-send captures editor as a new author | Read retained original attribution; update editor only during the history rewrite. |
| Retry | Reads original authors; current native caller is dropped | Copies full group provenance and records independent `retry.invokedBy`. |
| External send | P6R path has plugin-namespaced asserted author/sidecar | Adapter maps the already-validated P6R external origin into the same core envelope; no browser person fallback. |
| Tool context | P6R correlation/provenance can be partial or unknown | Carries plural envelope only when a concrete durable correlation exists; preserves partial/unknown otherwise. |
| Participants | P6R contribution listing is partial history, not presence | Rebuilds durable author/editor index from visible attribution; no claim about online presence. |

## Exact future source seams (handoff only)

`compose-native` should choose the final declaration location and own writes,
but the current caller seams are bounded:

- Domain/event/queue/daemon contracts: `packages/domain/src/{p6r-message-author,thread-events,queued-message}.ts`, host-daemon contract declarations and migration/schema inputs.
- Native acceptance and lifecycle: `apps/server/src/services/p6r/{native-request,native-authorship,native-acceptance,identity-protocol,participant-projection}.ts`; `apps/server/src/services/threads/{dispatch-attempt,thread-send,queued-messages,turn-retry,thread-edit-message}.ts`; route actions and pending-interaction settlement.
- Execution and correlation: `apps/server/src/services/threads/thread-commands.ts`, host-daemon thread command handler/attachment staging, and `p6r/tool-correlation-registry` plus provenance reader.
- Read projection only after the contract settles: thread-view/timeline DTOs and `P6rMessageAuthorLabel` successor. Do not treat this as a grant for a new settings, theme, or presence implementation.

## Review oracle and unresolved choices

Root and plugins coordinator should review `attribution-cases.json` against
actual callers and decide:

1. Is retry invoker durable execution metadata only, or also a visible timeline
   fact? Either decision leaves original author/editor unchanged.
2. May an external integration edit a contribution it owns, and if so, which
   verified integration operation supplies the editor snapshot? No free-form
   external editor field is accepted.
3. Is `latestEditor` set to original author at initial acceptance (the proposed
   convention) or null until a distinct edit? Consumers must not infer one from
   a missing field.
4. Must the host daemon receive the envelope for every supported provider, or
   can a provider-specific adapter consume server-side structured data while
   still feeding the same tool correlation? Choose one before changing the wire.

Acceptance is caller review plus later executable fixtures, not this document.
Required fixtures cover direct send, steer, mixed queue/restart, attachment-only
group, accepted edit, retry, interaction resolution, external assertion,
unknown history, compact/clear, and grouped-edit refusal. No historical test or
controlled preview is asserted as live proof here.
