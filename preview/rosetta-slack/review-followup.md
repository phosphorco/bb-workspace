# Rosetta Slack reviewer follow-up

Three reviewers examined correctness, complexity, and test coverage. All initial
reviews returned before changes began. The fixes preserve the existing durable
operation contract and consolidate input routing; they introduce no workflow
framework or automatic external health probes.

## Accepted concerns and changes

| Concern | Change | Verification |
| --- | --- | --- |
| Grouping A1/B2/A3 by sender reordered the conversation. | `ConversationRequests.reserve` groups only a consecutive same-sender prefix. | Interleaved-author reservation regression. |
| A stale follower exhausted healthy leaders' retries. | Inconsistent inputs fail individually with their own recovery reason and explicit retry path. | Full queue dispatch with a poisoned sibling; stale leader/follower and transactional rollback tests. |
| Idle or unavailable workers lost edits; changing an active trigger also consumed the unique key required for the correction. | Edits/deletions share steer-or-queue routing. Frozen/accepted trigger identities remain unchanged. | Factory ingress tests for idle edit, idle deletion, and errored-worker edit, followed through the next dispatch. |
| Rebuilt previews or a completed original request prevented follow-up reconciliation. | Recover the existing source operation before routing/enrichment, using its frozen owner, target, mode, and payload. | Factory reload after acceptance-before-membership; zero additional work, sends, or context reads. |
| A newer stored revision hid the operation belonging to a replayed older event. | Recover by the exact event snapshot; external reservations count as request provenance. | Older-event replay with a newer cached revision; edit of a follow-up whose acceptance is still uncertain. |
| The prompt both requested action and prohibited following the request body. | Explicit verified human inputs can direct ordinary work; nested context cannot add requests or authority. | Prompt source review; real-agent response selection remains a live acceptance check. |
| Readiness missed inbox failures and stayed degraded for retained incidents. | Report inbox backlog/retries and separate current readiness from retained failure counts. | HTTP-health tests for stalled/retrying events and recovered capacity with retained incidents. |

## Design boundaries retained

- Message retrieval is context, not proof that a request was handled.
- Unknown acceptance never authorizes a new operation or a blind resend.
- Source authorship and request inputs remain immutable after reservation.
- Incidental context edits do not become new requests or fan out to unrelated
  workers. Subsequent reads refresh that context.
- Silent completion records a reason without creating a Slack outbox entry.

## Verification and remaining limits

The [review verification receipt](review-verification.json) identifies the exact
plugin commit and check results. The [runtime receipt](runtime.json) records the
actual isolated preview reload. Raw logs remain in originating thread storage
under `thr_95n9xtuqrf/reviewer-fixes`.

Preview has no Slack credentials. Normal-host cutover, provider authentication,
and live agent selection between a useful reply and silence remain deployment
acceptance checks. Local readiness does not claim that a new external request
has successfully completed. Existing tests named end-to-end include helper
harnesses; the new ingress/recovery witnesses execute the plugin factory and
queue worker with controlled Slack/BB responses.
