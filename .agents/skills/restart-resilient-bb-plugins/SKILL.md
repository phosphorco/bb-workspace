---
name: restart-resilient-bb-plugins
description: Design or review BB plugins whose background work, external deliveries, or agent tasks must survive BB host restarts. Use for durable handoffs, retries, reconciliation, and long-running BB thread coordination; skip for work completed within one request with no delayed effects.
---

# Make BB plugin work recover after restart

Choose the smallest durable owner for the work. A returned tool call, a running JavaScript promise, a timer, and an in-memory child-notification batch are not durable owners. Name the durable record, the process that resumes it, the evidence that an effect happened, and the outcome when that evidence remains uncertain.

| Work shape | Starting point |
| --- | --- |
| External event or API send, such as Slack | Persist an inbox/outbox operation and receipt; recover claimed work on startup. Read [external delivery](references/external-delivery.md). |
| Deterministic multi-step agent script | Check BB's opt-in Workflows plugin: persisted runs/calls, replay, bounded retries, and status. Read its [contract](../../../fork/build/bb/plugins/workflows/README.md) before adding a second runner. |
| Open-ended research or synthesis over several BB turns | Use an ordinary coordinator thread with child threads, native completion reports, scheduled reconciliation, and a full result artifact. Read [agent coordination](references/agent-coordination.md). |
| Short request with no work after its response | Keep it in the request; do not add a journal or coordinator solely for consistency of style. |

These patterns can compose: an external inbox may create a BB thread, and an outbox may deliver its eventual answer. Give each boundary its own stable operation identity and receipt. Do not assume one system's acknowledgement proves the next system accepted the work.

## Work backward from a recoverable result

1. Draw the crash windows from input acceptance through final consumption. For each boundary, ask what a fresh process can enumerate and how it distinguishes pending, accepted, failed, and unknown.
2. Persist intent before irreversible external work. Reconcile an ambiguous response against the same operation before retrying. A unique local key prevents duplicate local rows; exactly-once external effects require a supported remote idempotency or reconciliation contract.
3. Use BB's durable thread, queue, storage, or workflow records before adding plugin-owned state. Order separate writes so the recovery wake is confirmed before creating work that would otherwise be orphaned by a restart; carry a marker and request identity across both effects. Add a journal only for facts those records cannot reconstruct, and name that fact. Avoid a process-local detached promise as the sole orchestrator after a tool returns.
4. Keep liveness separate from evidence. A notification or scheduled message wakes an agent; persisted thread/output, queue row, external receipt, or artifact establishes what happened. Reconcile authoritative state on every wake.
5. Bound attempts, time, and cost. Treat delayed wake-ups as targets rather than strict deadlines. Define partial, failed, indeterminate, cancelled, and operator-recovery outcomes where applicable.
6. Prove the real restart seam, including response loss after commit, duplicate wake-ups, failed queue rows, host offline, and a result written before its notification. Keep database reopen, unit fault injection, and full process restart evidence distinct. A fake implementation of the desired protocol is a specification fixture; count it as implementation evidence only when assertions exercise product code through a real or injected boundary.

Decide separately whether each BB thread creation must be unique. A native plugin tool call currently has no restart-stable invocation ID in its tool context; normalized provider turn/call IDs can change when the bridge is reconstructed. An external inbox may already have a durable event ID that supplies a stable operation key. Neither kind of key makes the current `threads.spawn` safe to retry after an ambiguous response: a plugin-side lookup followed by spawn cannot enforce one child under concurrent attempts.

When duplicate work is tolerable, reconcile committed children and report an uncertain launch or disclose duplicates that cannot be ruled out. When one child per operation is required, specify and prove server-enforced spawn idempotency using the appropriate stable key and an immutable request fingerprint. Do not infer a native tool-call key from repeated arguments, since separate calls may have identical inputs.

For BB commands and current queue behavior, inspect `bb guide threads`, `bb thread ... --help`, and the running fork. Source-level details in the references are examples of current contracts, not a substitute for checking the target BB version.

## Improve this skill from real use

When an active agent finds this guidance confusing or unable to cover its task, report the exact task, the instruction or missing distinction, the chosen durable boundary, and the observed result. Propose the smallest wording or reference change supported by that evidence. Keep one plugin's incidental constraints out of universal rules.
