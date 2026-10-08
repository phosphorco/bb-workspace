# bb-machine restart handoff — 2026-10-08

Purpose: restart `bb.service` on bb-machine so the staged performance patches
take effect, verify, and roll back if anything is wrong. Everything needed is
already staged; this document is for an agent picking up cold.

Owner threads to report to (use `bb thread tell <id> "<message>"`, never `wait`):
- Evaluation owner: `thr_h5jwmx59qk`
- Remediation steward (wrote the runbook, has all evidence): `thr_r8j48s5bzp`

Full runbook with per-subset detail:
`/home/ubuntu/.bb/thread-storage/thr_r8j48s5bzp/p1/deployment-runbook.md`
Post-restart check script (read-only over logs):
`/home/ubuntu/.bb/thread-storage/thr_r8j48s5bzp/p1/post-restart-checks.py`
Baseline for comparison: `.../thr_r8j48s5bzp/p1/deploy/baseline-checks.json`
Recorded heads: `.../thr_r8j48s5bzp/p1/deploy/heads.txt`

## What is being deployed

Four fork patches, already applied and built in the live checkout
`/home/ubuntu/bb/fork/build/bb` (HEAD `8e94d6804`, tree
`f16a2fd2b2211869e58cf8f212a6f7b681d99bdc`, working tree clean):

| Patch | What | Expected effect |
| --- | --- | --- |
| 0048 | Archived-teardown sweep query split (packages/db) | the `select "archived_at", "environment_id", "id", "status" from "threads" where ... exists (` query disappears from the slow log (was 355/h at ~170 ms) |
| 0049 | Participant projection watermarks, fork-owned sidecar table `p6r_participant_watermarks` (one CREATE TABLE at server start, no backfill) | after one first-pass burst, participant-target reads drop to ~0/h (was 6.8/h at ~263 ms); dashboard calls stop rebuilding projections |
| 0050 | INDEXED BY hint on delegating item lookup | timeline group-context stage shrinks on large threads |
| 0051 | Incremental timeline ordering context (per-process cache, 120k-row cap) | timeline "blocked the event loop" rate falls from ~286/h; heaviest thread `thr_munpi2xj8i` from ~154/h toward 0 |

Also already live (no restart needed, done 2026-10-07): plugins `background-jobs`
and `thread-manager` rebuilt and reloaded from `/home/ubuntu/bb/plugins`
(commits 09abccb, 3542a47, 68633f7, d2c74d3, pushed to origin/main). They will
simply reload at restart.

Nothing in the fork is pushed and the workspace gitlinks are not advanced yet.
That is intentional: promotion happens after the restart is exercised.

## Why the restart loads everything

- `~/.config/systemd/user/bb.service` ExecStart runs
  `node 22.21.1 ~/bb/fork/build/bb/packages/bb-app/dist/bb-app.js`; that dist
  was rebuilt at 23:57 on 2026-10-07 from the S3 tree.
- The steward verified the restored dist contains the sweep split, the
  watermark table, the index hint, the ordering trim, and the sidecar
  migration file `packages/bb-app/server/dist/services/p6r/drizzle/0003_participant_watermarks.sql`.
- The unit has `KillMode=control-group`: server and host daemon restart
  together, and every in-flight agent turn on bb-machine ends. Background jobs
  under `systemd-run` in `bb-background-jobs.slice` survive.

## Restart

```sh
systemctl --user restart bb.service
```

## Immediately after (in order)

1. `systemctl --user show bb.service -p MainPID -p ActiveEnterTimestamp -p ActiveState`
   Expect `active` and a new PID (old was 1202152, running since 2026-10-06 14:53).
2. `bb status` from `/home/ubuntu/bb`. Expect the project and environment to resolve.
3. Server log: `ls -t ~/.bb/logs/server*.log | head -1`. Look for startup errors
   and for one sidecar migration applied. Read-only check on the main database
   (open with `readonly: true`, never write):
   `select count(*) from __p6r_migrations` -> 4;
   `select count(*) from p6r_participant_watermarks` -> 0 at first, growing to
   ~1,400 after the first dashboard pass.
4. UI smoke: open the app, open a thread, open the Thread Manager dashboard.
   The FIRST dashboard pass rebuilds every thread's participant projection once
   to fill its watermark (same cost as before the patch; a burst of
   participant-target reads in the log). That is expected, not a regression.
5. Teardown functional check: archive a scratch thread that has a running
   terminal; it must still be torn down after the 30 s undo grace plus one
   10 s sweep tick.
6. At +30 min: `python3 /home/ubuntu/.bb/thread-storage/thr_r8j48s5bzp/p1/post-restart-checks.py`
   on the newest log and compare with the baseline file. At ~16 h repeat.

Report each result to both owner threads.

## If something is wrong

Signals that mean roll back: the service fails to reach `active`; startup
errors mentioning `p6r_participant_watermarks`, `__p6r_migrations`, or
`listArchivedThreadsPendingTeardown`; archived threads with terminals never
tearing down; timelines failing to render or showing wrong ordering; sustained
new errors in the server log that were not present before.

Rollback is code-only. No data rollback: the sidecar table and its ledger row
are ignored by older code. Do not drop the table (that would be a `~/.bb` write).

```sh
cd /home/ubuntu/bb/fork/build/bb
git checkout --detach 6a0f73a8fec9e6d578d89da2ee1bc9a9a8e697eb   # pre-patch, tree 006c86fe
pnpm build
systemctl --user restart bb.service
```

Partial rollback targets (keep lower patches): 0048 only `42201185e`,
0048+0049 `1f49771a9`, 0048-0050 `30ea59f6b`.

Plugin rollback if Background Jobs or Thread Manager misbehave: in
`/home/ubuntu/bb/plugins`, `git revert` the four commits (never reset), then
`bb plugin build ./plugins/<id>` and `bb plugin reload <id>`.

## Constraints

- Never stash, reset, clean, or discard anything in `/home/ubuntu/bb` children;
  dirty trees are authored work (`plugins/` has another author's dirty test file).
- Never write to `~/.bb` data or run migrations by hand; open databases read-only.
- Do not push `fork/` or advance workspace gitlinks; that is a separate
  promotion step the owner thread handles after the restart is exercised.
- The proof worktree `fork/build/proof-bb` (ports 39886-39888) is a candidate
  venue, not the runtime; leave it alone.
