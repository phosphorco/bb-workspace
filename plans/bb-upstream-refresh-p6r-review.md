# P6R behavioral-seven diagnosis — target `78804e79d280998a3b4c3c965ec1b5845703bc0e`

Date: 2026-09-22  
Scope: read-only diagnosis in `/tmp/bb-upstream-refresh.84BJxg/bb`. This is
not a replay patch or an approval to activate P6R.

## Evidence

The supplied focused gate was run against the current dirty target:

```sh
corepack pnpm exec turbo run test --filter=@bb/server -- \
  test/services/p6r/native-message-authorship.test.ts \
  test/services/p6r/mention-target-service-paths.test.ts \
  test/services/plugins/plugin-p6r-admission-boundary.test.ts \
  test/services/plugins/plugin-sdk.test.ts
```

Result: 26 passing and 7 failing tests. The direct REST producer case and the
plugin admission-boundary suite pass. The seven failures split into three real
data-path defects, one lifecycle defect needing an owner trace, and one
unrelated migration regression.

The accepted identity ADR remains the decision rule: capture attribution when
the message is accepted, preserve it across queue/retry/restart, and allow a
producer-owned sender envelope to pass without a host machine wrapper. This is
best-effort attribution, not a new person-verification gate.

## 1. SDK producer rendering is a real defect (P1)

`identity-protocol.ts` creates the correct, generation-local boolean:
`producerMessageRenderingEnabled` is set by
`experimental_useProducerMessageRendering()` and returned as a closure. But
`plugin-runtime.ts:1442-1453` unconditionally gives every plugin the shared
`boundSdk`; it never uses that closure. `plugin-api.ts:375-425` wraps metadata,
fork, spawn, get, and list only. Consequently `threads.send` and
`threads.queuedMessages.create` send no header.

`native-request.ts:28-59` deliberately suppresses native/machine authorship
only for a POST to one of those two endpoints that carries
`x-bb-p6r-message-rendering: producer`. With no header it correctly applies
the machine fallback, which is why `plugin-sdk.test.ts:1219` sees a wrapper
around the raw producer envelope.

Minimal implementation footprint:

- `apps/server/src/services/plugins/plugin-runtime.ts`: retain the bound base
  URL/fetch and create a per-plugin SDK transport whose fetch closure reads
  that generation's boolean **at request time**. It must add the header only
  for POST `/api/v1/threads/:id/send` and
  `/api/v1/threads/:id/queued-messages`. A dynamically-read closure is
  required because the test intentionally retains `bb.sdk` before enabling the
  producer hook. Do not set a process-wide flag and do not add an author field
  to the SDK API.
- `apps/server/test/services/plugins/plugin-sdk.test.ts`: retain the current
  producer-vs-untouched-plugin test and add/keep coverage for both send and
  queued creation after retaining the SDK before the hook.

No public SDK/package change is required: `createNodeBbSdk` already accepts a
fetch implementation. Preserve its timeout behavior when wrapping fetch.

## 2. Queued authors/editors are stored, then dropped (P0 provenance loss)

Acceptance is correct: `queued-messages.ts:280-284` calls
`captureP6rNativeAuthors`, and `packages/db/src/data/queued-thread-messages.ts:643-655`
serializes authors/editors. `thread-queued-messages.ts:136-172` reads them
back as the inline payload.

Both delivery routes discard that payload:

- The idle provider fast path builds only the normal send payload at
  `queued-messages.ts:535-572`, then appends
  `client/turn/requested` at `594-607` without `p6rAuthors`/
  `p6rEditors`, and builds provider input without
  `withP6rNativeAuthorContext`.
- The general drain path calls `attemptDispatch` at `806-837` without its
  `p6rAuthors`/`p6rEditors` arguments. `attemptDispatch` can preserve them
  when it requeues or invokes `sendThreadMessage`; it simply receives none.
- A queued first turn has a second loss: `admitPendingThread` constructs the
  provision request without the two fields (`dispatch-attempt.ts:811-823`) and
  `launchAdmittedThread` also omits them in the `requestThreadProvision` call
  (`882-902`). That loses the author before both the event and provider input.

This directly explains the two drained-row failures at
`native-message-authorship.test.ts:415` and `:506`. It violates the ADR even
though the DB row itself still has the original author/editor.

Minimal implementation footprint:

- `apps/server/src/services/threads/queued-messages.ts`: derive a
  group-aligned attribution vector from the *claimed serialized rows* (one
  slot per original input group; retain `null` slots). Pass it to the fast
  path's request event and `withP6rNativeAuthorContext`, and to the general
  `attemptDispatch` call. Omit an all-null vector so producer-owned raw input
  stays raw. Do not re-resolve the current native identity during drain.
- `apps/server/src/services/threads/dispatch-attempt.ts`: include the attempt
  authors/editors in `ThreadProvisionRequestArgs`, and forward those fields in
  `launchAdmittedThread`. This makes a pending first turn use the frozen
  claim rather than only its stale start context.
- `apps/server/test/services/p6r/native-message-authorship.test.ts` and
  `apps/server/test/services/p6r/mention-target-service-paths.test.ts`:
  preserve existing two-author, original-author/latest-editor, retry, and
  scheduled-first-plus-follow-up coverage; add an assertion that the provider
  command has exactly one sender envelope per claimed input group.

## 3. `client/turn/requested` versus `client/thread/start` is not a safe
test-only migration

Target `thread-provisioning.ts:241-281` writes the canonical
`client/turn/requested` event, with authors/editors/mentioned targets, and
then `:285-345` writes a legacy `client/thread/start` lifecycle event. The
latter is intentionally parsed as legacy in `thread-events.ts:173-181` and
`:616-620`; it cannot represent P6R author fields.

The create assertion failures (`native-message-authorship.test.ts:236` and
`mention-target-service-paths.test.ts:226`) find no current request at their
immediate observation point. Treat this as a timing/first-admission
integration failure to investigate, not permission to change the tests to
query only `client/thread/start`: doing so masks the missing author and
mentioned-target proof.

The first source defect to fix is independently visible:
`launchAdmittedThread` drops the already-admitted authors/editors before
calling `requestThreadProvision`. After that fix, the tests should wait for
the accepted current request (or the `thread.start` command that proves its
admission) and assert the canonical event. Retain legacy-event read support;
do not restore a legacy write as the source of truth.

## 4. Scheduled first-turn group claim loss is a double-admission bug (P0)

`native-message-authorship.test.ts:691-742` fails with
`queued_message_claim_lost` at `dispatch-attempt.ts:739`. This is not a
competing-drain result. In the no-hook/send-now path,
`continueThroughCoreWaits` calls `admitPendingThread` at
`dispatch-attempt.ts:493-500`, which consumes the claimed group and moves the
thread. It stores `admitted.value` but never sets `admitted.ran`. The later
first-dispatch block therefore calls `admitPendingThread` a second time at
`:638-653`; the second `consumeClaimedRows` cannot find the same token and
correctly throws claim-lost. The DB comparison itself is correct
(`queued-thread-messages.ts:1481-1525`).

Fix `continueThroughCoreWaits` to use the same one-admission state transition
as the hook `commitAdmission` path: provide `pendingStartCommit`, authors, and
editors to the first call, set `admitted.ran = true`, and let the later block
reuse `admitted.value`. Do not retry or release a failed claim as a workaround.
The regression test must prove that two scheduled-first/follow-up rows share
one claim token, are consumed once in the same transaction as the canonical
request, and retain `[alice, bob]` in both event and provider command.

Minimal footprint: `apps/server/src/services/threads/dispatch-attempt.ts` and
`apps/server/test/services/p6r/native-message-authorship.test.ts`; no DB claim
code change is indicated.

## 5. Hidden-plugin fork failure is outside the P6R authorship patch

`plugin-sdk.test.ts:1435` fails while `threads.fork` reports malformed queued
content (`thread-queued-messages.ts:45-72`), not a P6R author parse or an
identity assertion. It appears alongside dirty DB events/schema/migration work
in the replay target. Keep it as a separate migration-owner regression:
identify the exact `qmsg_*` writer and its serialized `content` before
changing the strict parser. Do not weaken prompt validation or fold this into
the producer-header change.

## Regression acceptance

After scoped fixes, rerun the focused gate above and require all 33 tests.
In particular verify:

1. retained producer SDK, hook enabled later: send and queued creation carry
   raw producer content, no machine author;
2. untouched plugin SDK: same endpoints keep machine fallback;
3. queue DB author/editor snapshot survives edit, process/reopen, claim,
   fast drain, general drain, and retry without re-admission;
4. a grouped scheduled first turn and follow-up consumes exactly once and
   preserves both sender positions;
5. canonical `client/turn/requested` carries create/send/queued authors and
   mentioned targets. Legacy `client/thread/start` remains compatibility-only.
