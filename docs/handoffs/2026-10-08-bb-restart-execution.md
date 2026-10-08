# BB restart execution — 2026-10-08

Executed the restart authorized in the deployment-coordination conversation at
00:22:52 CEST (2026-10-07T22:22:52Z). MainPID changed from 1202152 to 202084.
Server and host daemon were ready at 00:23:24. ActiveState=active, NRestarts=0.

Live source was checked clean at 8e94d6804145f37c3c39b017308b396f98b0837b,
tree f16a2fd2b2211869e58cf8f212a6f7b681d99bdc. ExecStart points to its
bb-app entry; the packaged 0003_participant_watermarks.sql file is present.
No source edits, pushes, gitlink promotion, or manual data migrations were made.
Dirty children were preserved. This receipt is an uncommitted workspace handoff.

Immediate results:
- Local health: ok; launchId bd38d555-b9fc-4aaf-a956-b9d962795545.
- bb status: /home/ubuntu/.bb, no plugins needing attention. This standalone
  shell has no thread/project context, so those status fields remain null.
- bb-machine host_chtdmruc4g connected; root UI HTTP 200. This is an HTTP
  check, not a completed visual UI smoke.
- Read-only main DB: __p6r_migrations=4; p6r_participant_watermarks=0 at first.
- background-jobs and thread-manager: running, canonical plugins repo paths.
- Pre-restart active thread listed: thr_j2s7v7jrgn, execution stewardship.
  No background-job transient units were listed at the restart boundary.

Coordination deliveries were accepted as sent to remediation steward
thr_r8j48s5bzp and evaluation owner thr_h5jwmx59qk. The steward owns the
remaining visual app/thread/Thread Manager smoke and scratch-thread terminal
teardown check, and was instructed to report results to the evaluation owner.
Those functional results are pending at this receipt.

Durable scheduled prompts to the steward were accepted with waitingOn=time:
- 00:52:52 CEST (+30 minutes): qmsg_ba2hf7s8nx.
- 16:22:52 CEST (+16 hours): qmsg_sjrsay28tp.

Both prompts request the read-only post-restart log comparison, retained-window
coverage, watermark/plugin checks, and a report to the evaluation owner.
No claim is made that these future comparisons have run.

server.8.log was the newest file, but already contained pre-restart records.
Filter JSON records by time >= 1791411772000 and account for log rotations.
The initial observed error message was daemon protocol mismatch: 115 occurrences
in the preceding hour and two immediately after restart. It is pre-existing,
not evidence of a new performance-patch regression. No sidecar/teardown startup
failure was observed. Cold watermark fills and timeline cache builds remain
expected, as described in the original handoff.

Immediate evidence and delivery JSON are under /tmp/bb-restart-handoff/.
The original persistent handoff and the steward's deployment runbook continue
to own acceptance and rollback instructions. No rollback was performed.
