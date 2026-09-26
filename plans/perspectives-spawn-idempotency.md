# BB core contract: idempotent child spawn

## Recommendation

Use a BB-issued `toolInvocationId` in native plugin-tool context and an optional
`idempotencyKey` on thread creation. The server persists a unique, scoped spawn
record before creating a child; replay with the same key and request returns
that operation's child or its durable outcome. Separate tool calls receive
different invocation IDs even when their arguments are identical. This is the
smallest contract that gives the Perspectives coordinator one child per
explicit invocation across concurrent calls and host restarts.

## Identity and API

`ToolCallRequest` already carries `threadId`, `providerThreadId`, `turnId`, and
`callId` alongside a transport `requestId` ([provider-types.ts:152](/home/ubuntu/bb/fork/build/bb/packages/domain/src/provider-types.ts:152)); the host-daemon schema forwards the four native identity fields and drops `requestId`
([session.ts:761](/home/ubuntu/bb/fork/build/bb/packages/host-daemon-contract/src/session.ts:761)). The internal route has that tuple when it invokes a plugin tool, but currently passes only thread, project, and abort signal in `PluginAgentToolContext` ([tool-calls.ts:103](/home/ubuntu/bb/fork/build/bb/apps/server/src/internal/tool-calls.ts:103), [backend-contract.ts:993](/home/ubuntu/bb/fork/build/bb/packages/plugin-sdk/src/backend-contract.ts:993)).

Add `toolInvocationId: string` to that context. Define its identity as the
opaque deterministic ID of `(threadId, providerThreadId, turnId, callId, tool)`;
exclude `requestId` and `sessionId`, which are transport/session scoped. The
provider contract must promise these native fields remain the same when the
same tool invocation is retried or resumed. If an adapter cannot promise that,
BB must persist and restore the ID before invoking the plugin. Existing code
preserves the tuple into the tool-call request ([runtime-provider-requests.ts:137](/home/ubuntu/bb/fork/build/bb/packages/agent-runtime/src/runtime-provider-requests.ts:137)), but does not establish restart-stable replay semantics. The server correlation registry is a process-local `Map` ([tool-correlation-registry.ts:64](/home/ubuntu/bb/fork/build/bb/apps/server/src/services/p6r/tool-correlation-registry.ts:64)); it cannot provide this guarantee.

Add optional `idempotencyKey` to `CreateThreadRequest` ([threads.ts:101](/home/ubuntu/bb/fork/build/bb/packages/server-contract/src/api/threads.ts:101)). `ThreadSpawnArgs` inherits create-request fields and `spawnJson` forwards remaining arguments, so the SDK can expose the field without a separate call shape ([areas/threads.ts:252](/home/ubuntu/bb/fork/build/bb/packages/sdk/src/areas/threads.ts:252), [areas/threads.ts:755](/home/ubuntu/bb/fork/build/bb/packages/sdk/src/areas/threads.ts:755)). Perspectives should pass `ctx.toolInvocationId` (or that ID plus a stable operation suffix if one tool call intentionally spawns multiple children).

Scope the key by **server-trusted caller/plugin identity + parent thread + key**;
require and validate the parent for plugin child spawns. Do not use request
`originPluginId` by itself as the security principal: it is a create-request
field, while the plugin SDK currently injects attribution in its wrapper
([plugin-api.ts:337](/home/ubuntu/bb/fork/build/bb/apps/server/src/services/plugins/plugin-api.ts:337), [base.ts:384](/home/ubuntu/bb/fork/build/bb/apps/server/src/routes/threads/base.ts:384)). The route must receive/derive trusted plugin identity from its server-owned tool/SDK context and verify the parent is accessible. Fingerprint the schema-normalized semantic caller request (parent, project, origin, input, execution/environment options, visibility, title, metadata and scheduling fields) before dynamic mention/environment resolution, excluding the key and transport fields. Same scope/key with a different fingerprint returns `409 idempotency_conflict`, before any new child or dispatch side effect.

## Persistence and state transitions

Add an independent `thread_spawn_idempotency` table (or equivalently named
ledger) with a unique index on `(caller_id, parent_thread_id, idempotency_key)`.
Store the fingerprint, state, original `thread_id` (nullable and **without a
cascading foreign key**), terminal error/result, and timestamps. Keep any
initial-start payload only while needed for recovery, then clear it. The record
must outlive the child row: current dispatch failure physically deletes the
new thread ([thread-create.ts:448](/home/ubuntu/bb/fork/build/bb/apps/server/src/services/threads/thread-create.ts:448)); thread plugin metadata also cascades with deletion and is keyed only by child/plugin ([schema.ts:644](/home/ubuntu/bb/fork/build/bb/packages/db/src/schema.ts:644), [schema.ts:648](/home/ubuntu/bb/fork/build/bb/packages/db/src/schema.ts:648)). Neither is an idempotency ledger.

Use short SQLite immediate transactions; never hold a database transaction
across provider, environment, or other async dispatch work:

1. After request and caller validation, atomically insert the unique key claim
   (`claimed`). A conflicting insert loads the winner and compares fingerprints.
2. In a transaction, compare-and-set the claim, create the pending child, save
   its `thread_id`, and persist a durable first-start intent; commit before
   dispatch. This needs a transaction-aware thread insertion path: `createThread`
   currently owns its transaction and notifies after it commits
   ([threads.ts:281](/home/ubuntu/bb/fork/build/bb/packages/db/src/data/threads.ts:281)), while startup context and first dispatch happen later
   ([thread-create.ts:412](/home/ubuntu/bb/fork/build/bb/apps/server/src/services/threads/thread-create.ts:412), [thread-create.ts:417](/home/ubuntu/bb/fork/build/bb/apps/server/src/services/threads/thread-create.ts:417)). A loser/replay must observe the same child or wait/re-read the claim, never insert another.
3. A compare-and-set lease elects one dispatcher for the durable start intent.
   Mark `dispatching` before calling dispatch; settle as `accepted` or a durable
   terminal failure. Replays during a live dispatch lease return the same child
   as pending and do not dispatch again. After lease expiry, reconcile the
   child, start intent, queue, and turn state before deciding whether dispatch
   is safe to resume; never allocate another child.

State model: `claimed -> dispatch_pending -> dispatching -> accepted`; terminal
`create_failed`, `dispatch_failed`, or `deleted`. Expired, ambiguous dispatch
becomes durable `launch_uncertain` unless reconciliation proves an outcome.
On a known create/dispatch failure, store a stable error before or atomically with the existing child
cleanup. The current create route returns the thread on success ([base.ts:384](/home/ubuntu/bb/fork/build/bb/apps/server/src/routes/threads/base.ts:384)); preserve its normal response shape. A successful replay returns the same `ThreadResponse` and ID (HTTP 200 is sufficient); a pending replay returns that same child in its current pending state. `accepted` means BB accepted the durable start/queue intent, not that the provider completed work. A terminal failure/deletion replay returns the saved API error/outcome, including the original child ID when one existed. A key reused with different input returns 409.

If dispatch may have reached the provider but its acknowledgement is lost,
record `launch_uncertain` with the same child ID and expose that bounded outcome
on replay. Reconcile against durable child/turn/queue state before deciding it
started or failed; do not create another child or blindly resend an ambiguous
first dispatch. On physical child deletion, retain/update the ledger to
`deleted` (or retain `dispatch_failed` if that was the cause); replay must not
respawn it. A fresh explicit invocation has a fresh ID and may create a new
child. This guarantees at most one child per key, not exactly-once external
provider execution or notification delivery.

For callers omitting `idempotencyKey`, keep current create semantics, status,
and response unchanged. Never infer a key from input text or plugin metadata.

## Candidate files

- Identity and context: `fork/build/bb/packages/domain/src/provider-types.ts`,
  `fork/build/bb/apps/server/src/internal/tool-calls.ts`,
  `fork/build/bb/packages/plugin-sdk/src/backend-contract.ts`.
- Trusted plugin scope and request plumbing: `fork/build/bb/apps/server/src/services/plugins/plugin-api.ts`,
  `fork/build/bb/packages/server-contract/src/api/threads.ts`,
  `fork/build/bb/packages/sdk/src/areas/threads.ts`,
  `fork/build/bb/apps/server/src/routes/threads/base.ts`.
- Atomic storage and lifecycle: `fork/build/bb/packages/db/src/schema.ts`,
  a focused `packages/db/src/data/thread-spawn-idempotency.ts` module and its
  export, `fork/build/bb/apps/server/src/services/threads/thread-create.ts`,
  plus transaction-aware insertion in `fork/build/bb/packages/db/src/data/threads.ts`.
- Migration: next generated Drizzle SQL (current journal ends at
  `0119_soft_pandemic` ([`_journal.json`:839](/home/ubuntu/bb/fork/build/bb/packages/db/drizzle/meta/_journal.json:839))), its generated snapshot, and
  `packages/db/src/migration-history.ts` when the migration is published.
- Tests: extend
  `fork/build/bb/apps/server/test/internal/internal-events-tool-calls.test.ts`,
  `fork/build/bb/apps/server/test/threads/thread-create-seed-without-run.test.ts`,
  `fork/build/bb/packages/db/test/data/threads.test.ts`,
  `fork/build/bb/packages/server-contract/test/contract.test.ts`,
  `fork/build/bb/packages/plugin-sdk/src/__tests__/public-types.test.ts`, and
  `fork/build/bb/packages/sdk/test/public-types.test.ts`; add focused
  `thread-spawn-idempotency` DB and server tests if these existing suites do
  not isolate the cases below.

The current implementation grant for `core-spawn-idempotency` omits the domain
identity schema, internal tool-call route, trusted plugin wrapper, and migration
artifacts listed above. Include those paths before assigning implementation.

## Focused fault-injection proof

1. Assert a repeated native tool-call tuple across a host restart yields the
   same `toolInvocationId`; changed `callId`/turn yields a different ID even
   with identical arguments. Also prove `requestId`/`sessionId` changes do not
   change the invocation ID. If provider replay cannot preserve the tuple, fail
   until the ID mapping is persisted.
2. With a file-backed DB, race two same-scope/same-key/same-fingerprint spawns:
   one ledger row, one child, one durable start intent, and both callers resolve
   to the same child. Drop the first HTTP response after commit, close/reopen the
   DB, replay, and assert that same ID with no extra child or first-start intent.
3. Reuse the key with changed input/execution/parent: assert 409 and zero new
   side effects. Use two distinct invocation IDs with identical requests:
   assert two child IDs.
4. Inject failure after claim, after child+intent commit, during definite
   dispatch failure, and after BB dispatch/queue acceptance but before response.
   Verify only one dispatcher lease/first-start dispatch initiation and no
   second child; definite failures replay the stored terminal
   outcome after child deletion; ambiguous dispatch returns/reconciles the same
   child as `launch_uncertain` without blind redispatch.
5. Delete a successfully created child, restart, and replay: assert the durable
   deletion outcome and no replacement. Verify an omitted key still follows the
   existing 201 create path. Forge another plugin/parent scope and assert it
   cannot retrieve or collide with the original operation.

Limits: the replay guarantee depends on stable native provider call identity;
providers that issue a new call identity after restart are a new invocation
unless BB persists the mapping earlier. Key/tombstone retention must exceed the
provider replay/recovery horizon (permanent compact tombstones are safest).
The contract deduplicates BB child creation and start intent; without a
downstream idempotency primitive it cannot promise exactly-once provider work.
