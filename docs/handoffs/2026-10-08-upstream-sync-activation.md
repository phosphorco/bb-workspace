# bb-machine upstream sync activation handoff — 2026-10-08

Purpose: activate the bb-fork refresh onto upstream `c9649eae7`, with the
organization and community plugins ported to Plugin SDK 0.6.29, on
`bb.service`. Verify it with stop conditions, and restore the previous
runtime and data if a gate fails. This document is written for a managing
agent with no prior context. Do every step in order. Do not improvise around a
failed check: stop and report.

Owner thread to report to (use `bb thread tell <id> "<message>"`, never `wait`):
- Evaluation owner: `thr_h5jwmx59qk`
- Sync steward (wrote this runbook; all evidence): `thr_px9i8ajvcy`

Cole must approve activation and the outward pushes. Nothing below is
authorized until the owner thread says so.

Paths used throughout:

```sh
EV=/home/ubuntu/.bb/thread-storage/thr_px9i8ajvcy/upstream-sync    # evidence and notes
ACT=$EV/activation                                                  # activation scripts
WIN=/home/ubuntu/.local/share/bb-activation-20261008                # this activation's files (create it)
NODE=/home/ubuntu/.local/share/mise/installs/node/22.21.1/bin/node
```

Run every command in a shell with these BB session variables unset, so no
step talks to a different BB or thread:

```sh
unset BB_CLI BB_ENVIRONMENT_ID BB_HOST_DAEMON_PORT BB_PROJECT_ID BB_SERVER_URL BB_THREAD_ID BB_THREAD_STORAGE
```

(Unsetting `BB_THREAD_STORAGE` hides `$EV` from tools that read it. The scripts
take explicit paths, so this is intended.)

## What is being activated

| Component | Commit | Notes |
| --- | --- | --- |
| Upstream base | `c9649eae71edd2a9da097f8325dde25d8260e5b1` | `fork/upstream.lock`, from `desktop-v0.44.0` (`9c9bae7f3`) |
| Fork overlay | `0009598ca09e1e1e7b614ab88188286f69d6f36e` (pushed `origin/main`, 2026-10-08) | 47 patches. 0022, 0027, 0030 and 0048 absent (see `fork/DOWNSTREAM.md`, "Refresh to upstream c9649eae7") |
| Materialized runtime | `515fddf7238579ac31a0321e1fd6d44d66d9f2f3`, tree `81da17d778dcf19648c77a726b7f5cd41ec2d3f0` | `result-tree.lock`; pinned as `refs/bb-fork/materialized/81da17d778dc` in `fork/upstream` |
| Previous runtime (rollback) | `8e94d6804145f37c3c39b017308b396f98b0837b`, tree `f16a2fd2b2211869e58cf8f212a6f7b681d99bdc` | currently checked out in `fork/build/bb`; pinned as `refs/bb-fork/materialized/f16a2fd2b221` |
| Plugin SDK artifact | `sdk-artifacts/get-bb-plugin-sdk-0.6.29+phosphor.81da17d778dc.sdk.86b45b082135.tgz`, sha256 `3afe34fcdae29a383f4725fc4cb0213dd1dca4adf390a9628385d4be10cba114` | with `.provenance.json` and `sdk-0.6.29-checks.json` (workspace, untracked) |
| Organization plugins | pushed `origin/main` `65ef176c72ebc0d13b18fc9a7a67233caf2196d5` (2026-10-08): `07607f4`, `c8f9dd0` (consumer bump, with the definition test fix), `65ef176` (bun.lock for the published packages) on `3706c6a` | SDK 0.6.29 selection, composer ports (thread-brief, plan-graph, diffs, sticky-notes, future-threads, agentation, review-to-disposition), zod 4.6.5, consumer bump to the packages below |
| Community plugins | pushed `origin/main` `87e781c08f059ad2868b3ac9a555a817fe9813df` (2026-10-08, rebased onto the Figma commit `1b94197`; pre-rebase `2c0bfa8`) | `@phosphorco/bb-provider-settings` 0.1.1 and `@phosphorco/bb-identity` 0.2.0 (peer ranges, Zod `roles` fix with test, CHANGELOG) |
| Packages to publish | `$EV/artifacts/phosphorco-bb-provider-settings-0.1.1.tgz` (`b9afb5edaf6d38a0665d1eeddfdf613678ca72c739a37f9c7090292e283d10f4`), `$EV/artifacts/phosphorco-bb-identity-0.2.0.tgz` (`ac7579a39becf2327c4e09d4d733db8a51324f1828c179cc664de183d2e34725`) | packed with npm 10.9.4; repacking 2c0bfa8 reproduces both digests |

What changes on first boot, in brief:
- Migration bridge 0142 (`0142_zippy_reavers`). The ledger goes from 138 to
  149 rows and every prior row is retained.
- Four new bundled plugins: `bb-account`, `bb-ai`, `bb--prompt-library` and
  `bb--storage-retention`, all pre-inserted disabled (step A5).
- `provider-usage` is renamed `bb--provider-usage`, keeping its enablement.
- Upstream #4761 DNS-rebinding protection: only localhost, literal IPs and the
  `BB_APP_URL` host are accepted; everything else gets 403.

With `bb-account` and `bb-ai` off, server AI tasks (thread titles, commit
messages) and connect's account client stay inert. This is intended.

## Preconditions (all must hold; stop and report otherwise)

P1. Outward steps 1–4 complete (next section), each confirmed by the owner
thread. Step 5, the workspace commit, comes only after the post-boot gates pass.

The pushed child commits are the receipt. The workspace gitlinks are not
advanced until the combined runtime has been exercised, so every check below
reads the children's `origin/main`, never the workspace gitlinks:

```sh
FORK_SHA=0009598ca09e1e1e7b614ab88188286f69d6f36e
PL=65ef176c72ebc0d13b18fc9a7a67233caf2196d5
CP=87e781c08f059ad2868b3ac9a555a817fe9813df
```

P2. Each child's `origin/main` is the pushed receipt. Inspect first and never
reset, stash or clean:

```sh
cd /home/ubuntu/bb && ./bin/status
for r in fork plugins community-plugins; do git -C /home/ubuntu/bb/$r fetch -q origin; done
test "$(git -C /home/ubuntu/bb/fork rev-parse origin/main)" = $FORK_SHA && \
test "$(git -C /home/ubuntu/bb/plugins rev-parse origin/main)" = $PL && \
test "$(git -C /home/ubuntu/bb/community-plugins rev-parse origin/main)" = $CP && echo P2-OK
```

If a child's `origin/main` moved past these SHAs, stop and report. The newer
commits were not part of the proven composition.

P3. The candidate ref matches the pushed fork's `result-tree.lock`:

```sh
test "$(git -C /home/ubuntu/bb/fork show origin/main:result-tree.lock | tr -d '[:space:]')" = \
     "$(git -C /home/ubuntu/bb/fork/upstream rev-parse 'refs/bb-fork/materialized/81da17d778dc^{tree}')" && echo P3-OK
```

If the overlay was re-exported (for example, rebased) and the tree differs,
stop: the candidate must be re-materialized and re-proven.

P4. `community-plugins` must have no uncommitted `package-lock.json` change.
The figma work by Cole's Figma integration workstream was dirty there on
2026-10-08:

```sh
git -C /home/ubuntu/bb/community-plugins status --porcelain -- package-lock.json   # must print nothing
```

If it prints anything, stop and report. Do not stash, commit or move it.
Fallback (b): wait until that work's author commits or moves it.

P5. Free space on `/` of at least 50 GiB. That covers the backup (~19 GiB) plus
room to set aside a failed database during a rollback (~19 GiB):
`df -h /`.

P6. The scripts exist: `ls $ACT/{backup.mjs,migrate.mts,preinsert.mjs,inventory-gate.mjs,plugin-load-gate.mjs,restore.mjs}`.

P7. Capture the pre-activation state while the service still runs:

```sh
mkdir -p $WIN && cd $WIN
systemctl --user show bb.service -p MainPID -p ActiveEnterTimestamp -p ActiveState > pre-service.txt
bb plugin list --json > pre-plugins.json
curl -s http://127.0.0.1:38886/api/v1/system/p6rIdentity > pre-identity.json
for r in fork plugins community-plugins; do echo "$r $(git -C /home/ubuntu/bb/$r rev-parse HEAD)"; done > pre-heads.txt
git -C /home/ubuntu/bb/fork/build/bb rev-parse HEAD 'HEAD^{tree}' >> pre-heads.txt   # expect 8e94d6804 / f16a2fd2
git -C /home/ubuntu/bb/fork/build/bb status --porcelain                              # must be empty
```

## Outward order (adopted; each step by the owner's batch, not by this runbook)

1. Publish `@phosphorco/bb-provider-settings` 0.1.1 and `@phosphorco/bb-identity`
   0.2.0, using exactly the two tarballs above (`npm publish <tgz>`). Confirm
   with `npm view @phosphorco/bb-provider-settings@0.1.1 dist.integrity` (and
   the same for bb-identity).
   Steps 2 and 3 run in scratch worktrees laid out like the workspace, so the
   plugins' relative SDK path (`../../../sdk-artifacts/…`) and the candidate CLI
   resolve. Retire `$S` after step 3:

   ```sh
   S=/home/ubuntu/.local/share/bb-sync-push-20261008
   mkdir -p $S/sdk-artifacts $S/fork/build
   cp /home/ubuntu/bb/sdk-artifacts/get-bb-plugin-sdk-0.6.29+phosphor.81da17d778dc.sdk.86b45b082135.tgz $S/sdk-artifacts/
   ln -s /home/ubuntu/bb/fork/build/proof-bb $S/fork/build/bb     # candidate CLI, tree 81da17d7
   git -C /home/ubuntu/bb/community-plugins worktree add $S/community-plugins sync/sdk-0.6
   git -C /home/ubuntu/bb/plugins worktree add $S/plugins sync/sdk-0.6
   ```
2. Push community-plugins. P4 must hold first. Plan (a): once the figma work has
   landed on `origin/main`, rebase `sync/sdk-0.6` onto it, then regenerate the
   lock with `npm install --package-lock-only`. Rerun `npm ci && npm run build &&
   npm run test && npm run typecheck` (build first: on a fresh checkout the
   workspace packages' `dist/` must exist before test and typecheck), then push
   `sync/sdk-0.6:main`. Done 2026-10-08: pushed `87e781c`. If the
   figma work has not landed by the activation window, use fallback (b): wait.
   Do not push around it. Option (c), skipping community, is rejected: it would
   leave unproven loads of agentation-mentions and perspectives on SDK 0.6.29.
3. Push plugins. In `$S/plugins` (never commit in `/home/ubuntu/bb/plugins`):
   - run `bun install` so `bun.lock` resolves the published packages, and commit only `bun.lock`;
   - run `bun install --frozen-lockfile`, then the checks listed in `plugins/AGENTS.md`;
   - rebase onto fresh `origin/main` if it moved, then push `sync/sdk-0.6:main`.
4. Push fork `main` (`0009598ca`). Done 2026-10-08: plugins `3706c6a..65ef176`
   and fork `868992635..0009598ca`.
5. Moved: the workspace commit runs after the post-boot gates pass (see "After
   the gates"). The workspace contract advances gitlinks only after the
   combined runtime has been exercised.

## Stopped window

Expected downtime is about 6 minutes:
- stop ≤ 15 s;
- backup ~2.5 min;
- code ~2 min;
- migrate ~10 s;
- pre-insert < 1 s;
- boot ~1 min.

Every in-flight agent turn on bb-machine ends at A1 (`KillMode=control-group`).
Background jobs in `bb-background-jobs.slice` survive. Warn active users first.

A1. Stop:

```sh
systemctl --user stop bb.service && systemctl --user is-active bb.service   # expect inactive
```

A2. Back up core and plugin state, consistently, while stopped. The script uses
VACUUM INTO from read-only connections, quick_checks every copy, tars the
remaining plugin files and writes `manifest.json` with sha256 and the ledger.
This step must finish before anything below changes data.

```sh
$NODE $ACT/backup.mjs /home/ubuntu/.bb $WIN/backup
# expect the final line {"totalMs":…,"databases":N,"coreLedger":{"n":138,"latest":1790230932026},…}
```

Stop condition: a non-zero exit, or `coreLedger.n` other than 138. Start the
service again (`systemctl --user start bb.service`, still on the old code) and
report.

A3. Code. The service is stopped, so nothing executes these files.

```sh
cd /home/ubuntu/bb/fork/build/bb
git status --porcelain                                    # must be empty
git checkout --detach refs/bb-fork/materialized/81da17d778dc
git rev-parse 'HEAD^{tree}'                               # 81da17d778dcf19648c77a726b7f5cd41ec2d3f0
cd /home/ubuntu/bb/fork && ./scripts/check-p6r-namespace build/bb "$(cat upstream.lock)"
cd /home/ubuntu/bb/fork/build/bb && pnpm install --frozen-lockfile && pnpm build      # ~7 s + ≤ 45 s

# PL and CP are the pushed child SHAs from P1 (not workspace gitlinks).
git -C /home/ubuntu/bb/plugins status --short             # inspect; dirty files must not be in the incoming diff
git -C /home/ubuntu/bb/plugins fetch origin && git -C /home/ubuntu/bb/plugins merge --ff-only $PL
cd /home/ubuntu/bb/plugins && bun install --frozen-lockfile && bun run build          # build ~12 s
git -C /home/ubuntu/bb/community-plugins status --short   # P4 again
git -C /home/ubuntu/bb/community-plugins fetch origin && git -C /home/ubuntu/bb/community-plugins merge --ff-only $CP
cd /home/ubuntu/bb/community-plugins && npm ci && npm run build                       # build ~10 s
```

Stop condition: any refusal (dirty overlap, non-fast-forward, install or build
failure). Go to Rollback; A2 has completed, but no data has changed yet, so
the database restore can be skipped. Restore only the code (Rollback R4–R5).

A4. Migrate with the candidate's own DB entrypoint (G1-rehearsed: 9.7–10.1 s,
138 → 149, every prior row retained):

```sh
cd /home/ubuntu/bb/fork/build/bb/apps/server
pnpm exec tsx $ACT/migrate.mts /home/ubuntu/.bb/bb.db /home/ubuntu/.bb $WIN/migrate-report.json
# expect {"migrateMs":…,"before":138,"after":149,"retained":true,…}
```

Stop condition: a non-zero exit (exit 2 means the ledger is not 149 with every
prior row retained). Go to Rollback.

A5. Pre-insert the four bundled rows, disabled (owner decision). Each row
carries the values the candidate's own boot wrote in the proof runtime.
`bb-account` and `bb-ai` get `enabled=0, enabled_follows_default=0`;
`bb--prompt-library` and `bb--storage-retention` get upstream's defaults
(`enabled=0`, follows default).

```sh
$NODE $ACT/preinsert.mjs /home/ubuntu/.bb/bb.db /home/ubuntu/bb/fork/build/bb/packages/bb-app/server/dist/builtin-plugins
# expect "before": 78, "after": 82, and four rows with enabled 0
```

Stop condition: a non-zero exit. Go to Rollback.

A6. Start:

```sh
systemctl --user start bb.service
```

## Post-boot gates (in order; any FAIL is a stop condition → Rollback)

G1. Service health. Expect `active`, a new PID, and `NRestarts=0` after two minutes:

```sh
systemctl --user show bb.service -p MainPID -p ActiveState -p NRestarts
curl -s http://127.0.0.1:38886/health                     # {"ok":true,…}
ss -ltnp | grep -E ':3888[678]\b'                         # 38886, 38888 (same pid) and 38887
```

Also check the newest server log (`ls -t ~/.bb/logs/server*.log | head -1`) for
startup errors.

G2. Ledger 149 (read-only):

```sh
$NODE -e 'const {DatabaseSync}=require("node:sqlite");const d=new DatabaseSync("/home/ubuntu/.bb/bb.db",{readOnly:true});console.log(d.prepare("select count(*) n, max(created_at) latest from __drizzle_migrations").get());d.close()'
# expect { n: 149, latest: 1791422663905 }
```

G3. First-real-boot plugin inventory (stop condition). Compare the backup with
the booted database:

```sh
$NODE $ACT/inventory-gate.mjs $WIN/backup/bb.db /home/ubuntu/.bb/bb.db
```

PASS requires all of the following:
- exactly five rows added: the four pre-inserted rows, still disabled, plus
  `bb--provider-usage`;
- exactly `provider-usage` removed;
- every other row with unchanged enabled, source, root dir, version and removed_at.

This was rehearsed on a private copy, giving 78 → 82 with 77 unchanged. The
negative controls (no pre-insert, or a rewritten root_dir) FAIL.

G4. Plugin loads (stop condition):

```sh
bb plugin list --json > $WIN/post-plugins.json
$NODE $ACT/plugin-load-gate.mjs $WIN/pre-plugins.json $WIN/post-plugins.json
```

PASS means:
- every plugin that was running before is running again;
- no plugin is in an error state;
- the four new plugins are disabled.

G5. Host checks on the owned Tailnet listener (38888), and through Serve:

```sh
curl -s -o /dev/null -w '%{http_code}\n' -H 'Host: bb-next.banjo-tint.ts.net' http://127.0.0.1:38888/api/v1/system/p6rIdentity   # 200
curl -s -H 'Host: 127.0.0.1:38888' http://127.0.0.1:38888/api/v1/system/p6rIdentity | grep -o '"evidence":"[a-z-]*"'        # 200, "evidence":"machine"
curl -s -o /dev/null -w '%{http_code}\n' -H 'Host: evil.example' http://127.0.0.1:38888/api/v1/system/p6rIdentity               # 403
curl -s -o /dev/null -w '%{http_code}\n' https://bb-next.banjo-tint.ts.net/api/v1/system/p6rIdentity                          # 200, not 403
```

Stop condition: a 403 through Serve. It means Serve's forwarded Host is no
longer the `BB_APP_URL` host.

G6. Identity attribution:
- `curl -s http://127.0.0.1:38886/api/v1/system/p6rIdentity` must show
  `"evidence":"machine"` with the same `identity.key` as `$WIN/pre-identity.json`.
  The machine key is stable across restarts.
- Cole opens https://bb-next.banjo-tint.ts.net from a personal device. The same
  endpoint must show `"evidence":"provider-verified"`, key
  `p6r-person:v1:identity-boundaries%2Ftailnet:7687404831074587`.
- Cole sends one message in a scratch thread. The newest provider-verified
  `client/turn/requested` event must carry that key (read-only):
  `$NODE $EV/scripts/author-evidence-3.cjs /home/ubuntu/.bb/bb.db | head -3`.

Stop condition: a machine actor for Cole through Serve. The ADR fallback keeps
the system usable, but report it before continuing.

G7. p6r prompts. Production user: `prompt-rules`.
- `bb plugin list` shows `prompt-rules` running.
- The newest server log has no "Prompt Rules requires a BB core update"
  warning and no `Prompt "…" middleware … failed` warnings after one ordinary
  turn in a scratch thread.
- The prompt-rules panel's recent inputs show that turn's renders.

G8. Slow-query and timeline baseline:
- Run `python3 -I /home/ubuntu/.bb/thread-storage/thr_r8j48s5bzp/p1/post-restart-checks.py --since=<A6 epoch ms> <newest server logs>`
  at +30 min and again at ~16 h.
- Compare with `thr_r8j48s5bzp/p1/deploy/plus30/restart-to-now.json`, the
  current runtime 30 min after its restart:
  - 0048 old OR form: 0/h;
  - participant-target reads: 2/h;
  - timeline blocks: 130.6/h including suppressed;
  - `thr_munpi2xj8i`: 16.1/h.
- Patch 0048 is retired because upstream #5127 replaces the sweep with a
  UNION. The script's split-form counter therefore stays 0, and its old-OR
  counter must also stay 0.

Stop conditions:
- the old OR form reappears;
- participant-target reads above 10/h sustained over the first hour;
- timeline blocks above 286/h (the pre-0051 rate) over the first hour;
- new recurring error classes in the server log.

Report every gate result to the owner thread.

## After the gates: workspace commit (outward step 5)

Do this only after G1–G7 pass and the owner confirms; G8's +30 min check may
follow. In `/home/ubuntu/bb`:
- inspect `./bin/status` first;
- stage only the three gitlinks (fork `0009598ca`, plugins `65ef176`,
  community-plugins `87e781c`), the `sdk-artifacts/` tarball, its
  `.provenance.json` and `sdk-0.6.29-checks.json`, and both handoff docs
  (`docs/handoffs/2026-10-08-upstream-sync-prework.md` and this file);
- leave other untracked and modified workspace files alone;
- commit as a promotion receipt and push `main`.

Then run `./bin/check --role normal`.

## Rollback

**The previous runtime refuses the migrated database, so data restore is
mandatory once A4 has run.** In the private rehearsal, `8e94d6804`'s DB
entrypoint against the 149-row ledger failed closed with
`Unsupported legacy identity/context migration history: a later migration is
not an exact target migration`. Code-only rollback cannot work.

Measured for the 16.0 GB core database:
- copying the backup into place took 19 s;
- verifying both files with sha256 took 83 s;
- `restore.mjs` with built-in verification took 35–46 s for core.

The previous runtime's entrypoint on the restored copy was a no-op: 138 → 138,
quick_check ok, 0 FK violations, 15.9 s.

The rollback code path:
- checkout 0.35 s;
- `pnpm install --frozen-lockfile` 6.9 s;
- `pnpm build` 42.8 s cold (0.5 s when turbo-cached).

Expected total rollback is about 4 minutes.

R1. Stop:

```sh
systemctl --user stop bb.service && systemctl --user is-active bb.service   # inactive
```

R2. (Optional, read-only.) Record what the lost-write window contains before
restoring. Note the newest threads and events created after the backup time in
`$WIN/backup/manifest.json` `createdAt`, so users can recreate them.

R3. Restore core and plugin databases. Current files are renamed
`*.failed-activation-<stamp>` (kept, not deleted). Every restored file is
verified against the manifest sha256, and its permissions are kept:

```sh
$NODE $ACT/restore.mjs $WIN/backup /home/ubuntu/.bb
```

`$WIN/backup/plugins-files.tar` (caches, toolchains, logs) is not unpacked. The
previous runtime regenerates what it needs. Extract single files from it only if
a plugin reports missing non-database state.

R4. Previous runtime code:

```sh
cd /home/ubuntu/bb/fork/build/bb
git status --porcelain                                    # inspect; must be empty
git checkout --detach refs/bb-fork/materialized/f16a2fd2b221
git rev-parse 'HEAD^{tree}'                               # f16a2fd2b2211869e58cf8f212a6f7b681d99bdc
pnpm install --frozen-lockfile && pnpm build
```

R5. Previous plugin code. Use the heads recorded in `$WIN/pre-heads.txt`;
inspect status first, and never reset, stash or clean:

```sh
git -C /home/ubuntu/bb/plugins status --short
git -C /home/ubuntu/bb/plugins checkout --detach <plugins head from pre-heads.txt>
cd /home/ubuntu/bb/plugins && bun install --frozen-lockfile && bun run build
git -C /home/ubuntu/bb/community-plugins status --short
git -C /home/ubuntu/bb/community-plugins checkout --detach <community head from pre-heads.txt>
cd /home/ubuntu/bb/community-plugins && npm ci && npm run build
```

Both children are left detached on purpose. Returning them to `main` is the
owner's decision after the incident review.

R6. Start and verify:
- `systemctl --user start bb.service`;
- G1 health;
- ledger is back to 138 (G2 query);
- `bb plugin list` shows the same plugins running as `$WIN/pre-plugins.json`;
- report to the owner thread.

The workspace gitlinks were not advanced (step 5 runs only after the gates
pass), so the workspace still records the restored composition. The children's
`origin/main` now carry the refreshed commits. Reverting them is the owner's
decision.

**Lost-write window.** Everything BB and its plugins write to `~/.bb` between A2
(backup) and R1 is lost on restore:
- threads, messages, events, queued messages, settings and plugin storage.

The failed files are kept beside the restored ones for forensic export.
External effects made inside the window are not undone: Slack posts, GitHub
comments, push notifications and provider-side sessions remain. Plugins whose
cursors rewind (for example, inbound Slack or GitHub sync) may reprocess items
they received in the window. Keep the window short: run the gates promptly and
decide on rollback within the first hour. Tell Cole about anything delivered
externally in the window.

Partial failure before A4 (A2 or A3 stop condition): no data changed. Use R4 and
R5 only, then start.

## Known residuals

- **Loopback-keyed Tailscale header trust** is a pre-existing property, not a
  sync regression. Trust in `tailscale-user-*` headers depends on the loopback
  remote address, not on which listener received the request. The primary
  listener (38886) therefore also resolves a person when Host is the owned host.
  0034's change lines are byte-identical to the 0.44 queue, so live behaves the
  same today. The owner is flagging this to Cole separately.
- If Serve ever forwards Host rewritten to `127.0.0.1:38888`, requests stay
  accepted (literal IP), but attribution degrades to the stable machine actor.
  identity-boundaries only verifies a person when the authority equals
  `BB_TAILNET_IDENTITY_OWNED_HOST`. Today, live Serve preserves Host: the private
  copy holds Cole's Tailnet person on `client/turn/requested` events up to
  2026-10-08 01:26:58Z under the same check.
- `bb.mention.context-header` prompt rendering was not exercised at runtime (it
  needs a plugin mention-context supplier). 0047's unit tests cover it.
- Pre-existing plugin test failure, not fixed, with old-SDK baseline evidence:
  subscription-router has 1 ("shared Workbench hook installation … revokes
  future launches"). thread-brief's 2 baseline failures no longer reproduce:
  all 268 pass on pushed `65ef176`, with each of the 30 suites run separately.
- thread-progress's pre-existing baseline failure disappeared once bb-identity
  0.2.0 shared the plugin's Plugin SDK instance (widened peer range, one SDK
  copy).

## Verification notes

Fork:
- Every exported patch typechecks on its own and in order (47/47,
  `$EV/evidence/percommit-typecheck-*.txt`).
- Full suite: 20,357 tests passed across 92 packages
  (`$EV/evidence/phase3-final-test-summary.txt`).
- G3 focused identity gate: 702/705, plus 5 new tests (`$EV/G3-REPORT.md`).
- Per-patch placement (interdiff) audit: `$EV/placement-audit.txt`.
- Lost-upstream-test audit: `$EV/lost-tests-audit.txt` (0 lost).
- Resolution log: `$EV/RESOLUTION-LOG.md`.
- `fork/scripts/verify` passes at `0009598ca`.

G1 migration rehearsal (private copy, entrypoint only):
- 9.9 s; ledger 138 → 149, originals retained; rerun is a no-op (7.1 s);
- quick_check ok; 0 FK violations; peak growth +0.42 GB;
- negative control: the live ledger would have failed without the 0.44 receipt
  allowlist.
- Report: `$EV/evidence/g1-rehearsal-report.json`.

G4 reconcile rehearsal (option A, harness, evidence only):
- `$EV/evidence/g4a-reconcile-report.json` and `g4a-preinsert-report.json`.
- The runbook's SQL pre-insert replaces the harness on live: run from source,
  the harness rewrites builtin root_dir, which the first boot would revert.
- Its forward rehearsal: `$EV/evidence/restore/positive-migrate-report.json`,
  `inventory-gate-positive.txt` (PASS) and `inventory-gate-rehearsal.txt`
  (negative controls FAIL).

Restore rehearsal:
- `$EV/evidence/restore/` holds `timing.txt`, `r4-*.json`, `r5.log` (the previous
  runtime refusing the 149 ledger) and `restore-script-rehearsal.txt`.
- Rollback build and plugin build timings: `rollback-code-timing.txt` and
  `plugin-build-timing.txt` in the same directory.

Phase 6 runtime proof: `fork/build/proof-bb` at `515fddf72`, state
`/home/ubuntu/.local/share/bb-fork-proof`, ports 39886/39887 and owned listener 39888.
- Tailnet evidence: `$EV/evidence/tailnet/SUMMARY.md`. Covers both Host forms,
  403, machine fallbacks, invalid and non-distinct port, occupied secondary
  port, and strace bind order.
- p6r prompt evidence: `$EV/evidence/p6r-prompts/SUMMARY.md`. Covers fresh and
  resumed sessions, protected mentions with fallback, accepted-input retry
  without rerender, and unload/reload, all captured as provider-bound input.

Launcher deviation:
- These runs used the steward's systemd launcher `$EV/proof-tools/proof.sh`,
  not `fork/scripts/proof-runtime`, which is not in today's tree. Fresh proof
  state therefore booted with bundled defaults.
- Builtin state per check:
  - Tailnet Host and startup checks: all default-enabled builtins running,
    plus identity-boundaries. No account, credentials or normal state
    (isolated HOME and data directory).
  - p6r prompt cases: every builtin disabled except
    environment-personal-workspace and environment-project-checkout; bb-account
    and bb-ai disabled (mirroring A5); plus identity-boundaries and the two
    proof fixtures.
- Live Serve was not probed.

Test environment:
- Isolated HOME and disk-backed TMPDIR for all runs. Fault-barrier tests need
  `TMPDIR=/tmp`.
- These BB session variables were scrubbed for every test and proof run, and
  must be for activation: `BB_CLI BB_ENVIRONMENT_ID BB_HOST_DAEMON_PORT
  BB_PROJECT_ID BB_SERVER_URL BB_THREAD_ID BB_THREAD_STORAGE`.

## Constraints

- Never stash, reset, clean or discard anything in `/home/ubuntu/bb` children.
  Dirty trees are authored work (the figma work in `community-plugins`; the
  thread-progress test and the ledger lock in `plugins`).
- Open `~/.bb` databases read-only except in A4, A5 and R3. Never run ANALYZE or
  `PRAGMA optimize` on the live database.
- Do not make `fork/build/bb` anything other than the existing worktree, and do
  not create a second runtime checkout.
- Keep `$WIN/backup` until the owner closes the soak.
- `fork/build/proof-bb` (ports 39886–39888) is a candidate venue, not the
  runtime. Leave it alone.
