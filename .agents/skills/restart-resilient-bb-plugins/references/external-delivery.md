# External delivery and transactional outbox

Use this pattern when a BB plugin accepts an external event or must eventually send an API result. The plugin owns a small durable operation machine because a BB agent transcript cannot atomically commit an external delivery intent with plugin business state.

## Boundary and states

In one local transaction, record the accepted input or business transition and an outbox row with a stable operation key, destination, payload or immutable payload reference, state, attempt count, next attempt, and source identity. A unique key makes local retry or duplicate input reuse the row. A background service claims due rows, performs the external call, and records the remote receipt. On startup, reconcile rows left in `sending`; classify retryable, permanent, and indeterminate outcomes. Expose pending, retry, delivered, cancelled, and dead-letter states to the operator.

Rosetta Slack is a concrete BB example: its delivery outbox has a unique `operation_key`; terminal work and delivery rows are queued in one SQLite transaction; startup recovery moves `sending` rows to `retry`; `bb.background.service("queue-worker")` drives delivery lanes; a successful Slack timestamp is the delivery receipt. See [outbox schema](../../../../plugins/plugins/rosetta-slack/state.ts), [transactional enqueue and recovery](../../../../plugins/plugins/rosetta-slack/state.ts), and [queue worker and delivery](../../../../plugins/plugins/rosetta-slack/server.ts). It also uses a derived Slack `client_msg_id` ([outbound post](../../../../plugins/plugins/rosetta-slack/slack-outbound.ts)); verify the remote system's actual deduplication contract before claiming exactly-once sending.

The difficult window is remote acceptance followed by a lost response. A local `sending` row is not proof of remote delivery or non-delivery. Reconcile by remote operation key/receipt when possible; otherwise surface an indeterminate state and choose a retry policy that reflects duplicate risk. A successful local queue write means accepted for later work, not that Slack or another destination received it.

An external event ID can make inbox and work records idempotent without making a downstream BB thread spawn idempotent. Rosetta Slack has a stable Slack work ID, but records `spawn_started_at` before `threads.spawn` and the thread ID only after the response. If that response is lost, it reports a possible orphan instead of safely retrying. For transparent recovery with exactly one thread, BB would need a server-enforced spawn key bound to that work ID and the immutable spawn request. Treat this as a separate boundary from the delivery outbox.

Do not copy Rosetta Slack's schema or retry counts into another plugin by default. Use the smallest durable record that represents that plugin's own operation and authorization boundary. Preserve source/owner identity on delayed work; a later credential or owner change must not silently retarget the operation.

## Useful witnesses

- Duplicate input and concurrent enqueue produce one local operation row.
- Crash before claim, after claim, after remote acceptance before receipt, and after receipt before local completion each have a defined recovery result.
- Permanent rejection stops retries; transient failure retries within a bounded budget; exhausted work is inspectable.
- A delivered state requires the remote receipt, not merely a successful request dispatch.
