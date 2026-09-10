# Transcript amendment: source assessment

As of 2026-09-10. This is a source assessment, not a second progress tracker.
Intent and progress belong to [message-transcripts.plan.pkl](../message-transcripts.plan.pkl)
and its sibling ledger. The [approved ADR](../../docs/adrs/2026-09-identities-and-multiplayer.md)
defines the format. This records the pre-implementation assessment; current execution evidence is in the plan ledger.

The September 9 deployment fixed machine fallback and child creation. Its passing
receipts do not prove this newer format, and its Slack review missed the separate
initial-request renderer. Preserve those receipts and correct that coverage gap.

## Concrete gaps and owners

| Lane | Current source | Required change |
| --- | --- | --- |
| Contract and assembly | Native `withP6rNativeAuthorContext`; shared identity external-contribution API; plugin prompt inputs | Decide which existing boundary renders each message. Specify sender label, optional native reference, context, original body, and attachment association. Prove one envelope, not core plus plugin nesting. Prefer pure renderers and existing metadata; justify any schema/API addition before adding it. |
| Native BB | `fork/build/bb/apps/server/src/services/p6r/native-authorship.ts:42`; `services/threads/thread-send.ts:643` | Replace `from` bookends with `sender`; preserve group boundaries, unknown author behavior, original/editor choice, machine labels, command dispatch, queue/retry semantics. Trace CLI tell/fork/child prefixes and attachment assembly as part of the same producer audit. Update existing patch 0016 rather than adding another patch. |
| Slack initial requests | `plugins/plugins/rosetta-slack/conversation-requests.ts:128`; `server.ts:2136` | Replace request authority preamble, source/revision dump, and UNTRUSTED body framing with one envelope per accepted message. Resolve readable source labels with native references; existing stored request inputs have user IDs, not a captured display-name field. Decide whether existing accepted prompt snapshots are sufficient before adding storage. Preserve ordered request membership and revisions. |
| Slack follow-ups and retrieved context | `plugins/plugins/rosetta-slack/server.ts:2445`; `slack.ts:253,271,286,405` | Use the same renderer for initial/follow-up/edit/delete paths; stop slugifying handles; separate original body from file/attachment rendering; move previews, excerpts, coordinates and useful diagnostics to attached material. Remove blanket UNTRUSTED banners and repeated authority prose. Keep chronological/source facts and request-versus-retrieval delivery semantics. |
| Agentation and other producers | `community-plugins/plugins/agentation-mentions/lib/identity.ts:78`; related server dispatch; shared package examples/docs | Move Agentation from `from` to `sender`, with optional attached annotation context and no hidden mention expansion. Audit other installed producers for old wrappers and blanket trust labels; migrate concrete matches. The GitHub example is a format example, not a requirement to build a GitHub integration. |
| Verification and promotion | Existing source-only Slack checks and live native child receipts | Assert fully assembled model inputs, not only helper strings. Inspect actual provider inputs after delivery; preserve structured authors, source references and multimodal attachment identity. Verify Slack on an already configured deployment or use a clearly labeled controlled integration witness. Do not claim live Slack coverage from bb-machine, where it is not installed. |

## Acceptance examples and cases

Cover the ADR's exact Slack and GitHub examples; a native person and a machine;
an initial message and subsequent messages with identical structure; two people
in one batch; no attachments versus links/files/images; quoted/retrieved messages
with their own author; Unicode names and escaped label delimiters; source-native
reference with unavailable profile; edits and deletion events; unknown history;
retries, queued messages and restart; and native compact/clear dispatch.

Check the final prompt after external-contribution, mention expansion, native
wrapping and provider adaptation. There must be no double wrapper, empty attached
block, author JSON, blanket UNTRUSTED banner, or repeated sender-authority prose.
Keep meaningful agent-role/tool instructions separate. Do not remove independent
Slack credentials, ordered request/revision handling, deduplication or cancellation
as part of a rendering change.

This assessment originally preceded implementation. The execution plan now owns
the changes, checks and delivery receipts. No new integration or separate
authorization subsystem is required; preserve concurrent authored work.
