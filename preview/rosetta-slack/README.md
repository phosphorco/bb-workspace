# Rosetta Slack deployment candidate

The queue repair is integrated into this workspace's SDK 0.4.47 composition.
The previous activation blocker was the normal host's SDK 0.4.15. Its version
guard remains intact. Preview now loads and reloads Rosetta from
`/home/ubuntu/bb-service/plugins/plugins/rosetta-slack` with no Slack credentials.

The missed mention was received and queued. An older request repeatedly failed
when the same Slack message was acquired through two different authorized read
paths. That oldest request starved later dispatches. The repair preserves both
immutable observations, bounds dispatch retries, separates queue workers, and
exposes current queue and recovery failures through HTTP, CLI, and settings.
The failure predates preview startup; preview had no Slack consumer.

The subsequent apparent self-reply loop had a different cause: each old human
message became a separate request even after the first recovery turn had seen
the whole conversation. Later turns saw fresh Rosetta replies as context and
were required to post another completion. No self-authored work items were
found in the reported thread.

The current candidate gives requests durable ownership of explicit, frozen
human inputs. It groups pending updates from the same sender in the same
conversation, preserves other senders' attribution, and treats fetched history
as context rather than new instructions. Retries retain the original inputs.
An agent can finish silently for acknowledgments or handoffs; direct questions
and receipt tests still call for a reply. Verified self-authored events are also
excluded at ingress. The reported live replay queue was contained separately;
this source change is loaded only in preview.

## Verification

- Frozen install, generated workspace sync, references, selected SDK types,
  aggregate organization typecheck, tests, and production build pass.
- All 182 Rosetta tests pass, including full SDK factory registration/reload
  and a real queue-worker regression with controlled Slack/BB responses.
- The affected identity browser fixture passes single and paired component
  checks. The fixture supplies both selected SDK original-component props and
  checks reload without assuming an exact count of concurrent notifications.
- Migration on a copy of the normal database preserved all 1,024 existing
  message evidence records, including every historical field; the formerly
  conflicting acquisition succeeds. That database remains private evidence.
- Actual preview installation and reload pass. All 48 enabled plugins run;
  normal `bb.service` retains PID 606208. HTTP health is 503 and CLI exits 1
  with exactly `Slack transport is unconfigured.` Nine worker lanes run with
  no retained errors or queued work.

The curated [runtime receipt](runtime.json) records endpoint results and bundle
hashes. [verification.json](verification.json) records the initial queue repair;
[request-lifecycle-verification.json](request-lifecycle-verification.json)
records the current request model, selected plugin commit, and complete checks.
The subsequent [review follow-up](review-followup.md) and
[review verification receipt](review-verification.json) cover ordering,
revision retention, immutable replay, and inbox-health corrections on top of
that initial request model.
Raw check logs remain in the originating BB thread storage under
`thr_95n9xtuqrf/deploy-candidate` and `thr_95n9xtuqrf/replay-loop`; they are
evidence, not deployment sources.

Recheck the isolated preview from this workspace:

```sh
python3 preview/rosetta-slack/check-preview.py --reload
python3 preview/cli.py rosetta-slack health
```

The second command intentionally exits 1 while preview has no credentials.
The probe verifies the expected unavailable state; it does not treat plugin
registration alone as proof that Slack responds. Health is a read-only endpoint
using BB's default local authorization, suitable for a host-local monitor.

## Deployment handoff

Promote this workspace's committed composition through the host's declared
deployment process. Do not install the new plugin alone into SDK 0.4.15 or
overwrite the authored normal checkout. The workspace gitlinks select the
tested fork, organization plugins, and unchanged community plugins together.

At cutover:

1. Preserve the existing BB runtime state and take a consistent backup while
   the old Slack consumer is stopped. Retain BB thread records, Slack queue,
   outboxes, and acceptance receipts together; do not substitute preview state.
2. Start the selected compatible composition using the deployment's retained
   state and credentials. Ensure exactly one runtime owns the Slack app.
   The schema migrations run on plugin load.
   Verify the configured agent provider can authenticate, too: a connected
   Slack transport cannot compensate for workers failing before their first
   turn. The normal bridge was switched to Codex on September 9 after its
   Claude workers reported an expired, unrefreshable OAuth session.
3. Check `bb rosetta-slack health` and the settings queue diagnostics. Readiness
   may remain degraded while requests or events stall, retry, or await unavailable
   BB workers. Retained failed requests and dead letters appear separately as
   incidents. Inspect the work IDs and remote acceptance before
   retrying anything. The historical missing-column delivery failure does not
   by itself prove that Slack never accepted that message.
   Operator-quarantined work is retained with an `operator-quarantine:<work-id>`
   metadata receipt. Inspect those records explicitly; they predate the new
   retry scheduler and must not be inferred from retry counts alone.
   Use `bb rosetta-slack requests` to inspect request ownership and grouped input
   counts. Health reports grouped inputs and silent completions separately.
4. Observe queued work advancing and inspect delivered Slack timestamps. A new
   human test mention can verify ingress through response after cutover. No live
   Slack send or reassignment of production credentials was performed here.

Keep post-cutover state if rolling back. Restoring an earlier queue snapshot
after a request or message was accepted can duplicate external work; reconcile
receipts before resuming an older consumer.

This closes the source, SDK, verification, and preview activation gaps for the
Rosetta repair. Normal-host promotion and real Slack delivery acceptance remain
deployment actions. Other preview workflow limitations remain documented in
[PREVIEW-TESTING.md](../PREVIEW-TESTING.md).
