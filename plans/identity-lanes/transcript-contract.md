# Transcript rendering contract

Execution contract for [message-transcripts.plan.pkl](../message-transcripts.plan.pkl).
The approved ADR owns syntax and semantics. This document allocates rendering,
not authorization. Root alone writes the ledger, seals artifacts and deploys.

- Native person/machine messages: native-authorship.ts renders sender bookends
  per existing group. Preserve original body, unknown authors, commands and
  multimodal ordering; do not parse body text to decide whether it is already wrapped.
- Fork external contributions: native-acceptance.ts stores authorEvidence in
  contribution receipts and passes prompt inputs through without native p6rAuthors.
  Integration producers therefore own their per-message envelopes. Verify this
  via actual native acceptance/provider input tests, including queue and retry.
- Slack: one plugin-local pure renderer shared by initial, follow-up and context
  paths. Opening label slack:@Cole with optional <@U123>; closing slack:@Cole only.
  No slugification; unavailable name uses source-native identifier. Separate original
  body from enrichment; attached omitted when empty. Preserve native file/image inputs.
- Agentation owns its captured-author message envelope; do not reintroduce hidden
  author mention expansion. Core need not gain a general envelope parser or new DTO.
- Shared binding owns generic external envelopes by default. Producers select
  `bindBbIdentity(bb, { externalMessageRendering: "producer" })` to retain their
  own rendering. Upstream normalization still registers source provenance but adds
  no competing prefix. This is binding configuration, with no wire/DB field or tag sniffing.
- Native assembly owns `<attached>` around mention resolution. Resolvers return
  plain retrieved context, retaining source authors within that context. They do
  not add another attachment boundary or impersonate the requesting sender.
- No new DB/schema/SDK protocol requirement is established. Existing accepted input
  snapshots preserve rendered labels; Slack has source user IDs and profile lookup.
  Profile failure cannot block sending. Any gap requiring a new field comes back to root.
- Contract tests exercise assembled input, with body preserved and percent escaping
  for generated label delimiters/newlines. Source-native angle brackets are intentional
  syntax; validate/escape their generated contents. Keep role/tool instructions outside
  the message envelope, and useful source/retrieval context inside attached material.

Native/slack/consumer implementation lanes have disjoint source ownership. Root
owns shared artifact pinning after source changes and integrates review findings.

## Design review disposition

The gather_perspectives panel (thr_th57yhtvtb) confirmed the ownership approach.
Its additional obligations are assigned to the lanes: native mention enrichment
must belong to the correct message attachment group; Agentation mention resolution
and reply history must not nest or misattribute envelopes; Slack already-reserved
payloads must remain byte-for-byte retryable across deployment.

Preserve native image/file PromptInput objects through formatting. Provider
capabilities remain those of the existing adapters: Codex supports image inputs
and local file references; other adapters may represent attachments as paths or
text markers. This campaign does not implement new provider attachment capabilities.
Final evidence must inspect actual selected-provider output and name limitations;
an intermediate PromptInput assertion is not proof of universal multimodal support.

Live plugin inventory confirms identity-boundaries and thread-progress running
on bb-machine, with neither rosetta-slack nor agentation-mentions installed. Their
assembly witnesses must be identified as controlled unless an existing configured
deployment can be exercised within authorization. No Slack credentials, app install,
or outbound human communication is inferred from transcript implementation.

## Real SDK transport correction

The actual plugin SDK uses loopback HTTP; its native send/queue routes initially
added a machine frame around Agentation producer envelopes. The retained HTTP
regression proves this gap. Producer mode therefore also configures a
plugin-scoped host identity extension hook for SDK message delivery. A private
presentation hint on send and explicit queue-create requests suppresses the
redundant native batch author/frame, matching external producer ownership.
Actual captured annotation and reply authors remain in the producer's structured
records. This does not discard an accepted native person's attribution or rewrite
old messages. Absent native batch authors remain absent through drain/retry.

Keep ordinary native/CLI fallback and explicit idle queue behavior. The hint is
not a credential, authority assertion, signature or lease. Do not inspect body
tags. No new DB column, durable render flag or public SDK payload field is needed.
An older enhanced host lacking the optional hook must report incompatibility for
producer mode rather than silently nesting; plain upstream has no native frame
to suppress. Repack the shared library after implementing this correction.
