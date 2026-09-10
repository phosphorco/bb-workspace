# Subscription Router Usage reload readiness

Node: "usage-reload-readiness"  
Reviewed: 2026-09-09  
Scope: read-only readiness receipt. No build, reload, install, enable,
disable, host activation, provider restart, or Router state command was run.

## Evidence boundary

The installed plugin source probe returned:

~~~text
subscription-router
  requested: path:/home/ubuntu/bb/plugins/plugins/subscription-router
  resolved: path:/home/ubuntu/bb/plugins/plugins/subscription-router
  engines.bb: >=0.37
  engines.bbPluginSdk: >=0.4.6
  installed: 2026-08-20T13:18:20.907Z
  history: none
~~~

The canonical source is at /home/ubuntu/bb/plugins/plugins/subscription-router
on source commit af9834a7c1ec3dd0d88458bcb2da5d07af20e93d. Its generated package
manifest pins this exact, fork-qualified SDK archive:

~~~text
archive: /home/ubuntu/bb/plugins/sdk-artifacts/get-bb-plugin-sdk-0.4.47+phosphor.c30b12255a7f.sdk.a4652a585b5c.tgz
name: @get-bb/plugin-sdk
version: 0.4.47+phosphor.c30b12255a7f.sdk.a4652a585b5c
sha256: 79ef00173ebb3ffa1c7f9bd9a4e20eeae3f00915aa0b645db8ea328e6b988599
source receipt: c30b12255a7f9f098e7bf9b6d1999410e7956785
~~~

The existing generated dist/app.meta.json and dist/server.meta.json both
report SDK 0.4.15, BB 0.39.0, and plugin 0.1.0. Therefore the installed
plugin is currently running, but its existing app/server artifacts are not
evidence of a build against the selected SDK archive. The old SDK metadata must
not be accepted as the post-integration proof.

The active host-side Router was inspected without invoking it. Its launcher
currently names:

~~~text
launcher: /home/ubuntu/.codex-subscription-router/lib/router-command
Bun:      /home/ubuntu/.local/share/mise/installs/bun/1.3.14/bin/bun
generation: 3e686f662c4545ddf1665233f7bbf3e2d8f7e15e100ed827cb5e956d5a472c46
SQLite:   available=true
~~~

The generation manifest hashes all ten host files and records Bun 1.3.14.
Every one of those ten hashes matches the current canonical source's
host/*.mjs file. This proves host-source/generation parity, not that the
plugin's app/server bundle has been rebuilt or that every already-running
provider adopted the generation. The current process census contains 62
process arguments naming generation 3e686f… and 2 naming the older
generation 1adbcc8973088c0a8a0a0f9e577b425f808fb359ad3dff7f8b254a217d54ffd6.
The runbook's rule applies: atomic activation affects new launches; process
adoption needs a separate census and must not be inferred from plugin status.

The durable Router receipts say SQLite is authoritative, the JSON cutover is
complete, and the immutable JSON backup is retained. state.db, its WAL/SHM,
and account homes are operator data, not caches. No direct status, doctor,
state verify, or other Router command was run here because status can reap a
dead lease and the lane must not touch the active Router.

bb plugin list currently reports subscription-router@0.1.0 running from the
canonical source, with an existing rpc install failed diagnostic because mise
could not resolve the Codex executable. That is distinct from a reload error;
the post-build proof must capture a successful reload and a clean running
status. The separate message-timings-nerd plugin is also running from
community-plugins; this lane did not reload, stop, or restart it and must not
disrupt the separate message-timestamps activity or shared runtime.

## SDK-qualified build probe

After the SDK-artifact lane and source integration have qualified the selected
archive, run from /home/ubuntu/bb:

~~~sh
SDK_ARCHIVE=/home/ubuntu/bb/plugins/sdk-artifacts/get-bb-plugin-sdk-0.4.47+phosphor.c30b12255a7f.sdk.a4652a585b5c.tgz
SDK_VERSION=0.4.47+phosphor.c30b12255a7f.sdk.a4652a585b5c
test -s "$SDK_ARCHIVE"
test "$(sha256sum "$SDK_ARCHIVE" | awk '{print $1}')" = \
  79ef00173ebb3ffa1c7f9bd9a4e20eeae3f00915aa0b645db8ea328e6b988599

bun --cwd plugins install --frozen-lockfile
bun --cwd plugins run sync:check
bun --cwd plugins run sdk-types:check
bun --cwd plugins run --filter '@phosphor/bb-plugin-subscription-router' typecheck

bb plugin build ./plugins/plugins/subscription-router

for meta in \
  plugins/plugins/subscription-router/dist/app.meta.json \
  plugins/plugins/subscription-router/dist/server.meta.json; do
  jq -e --arg sdk "$SDK_VERSION" \
    '.pluginId == "subscription-router" and
     .sdkVersion == $sdk and .builtWith.pluginSdkVersion == $sdk' "$meta"
done
~~~

The build passes only when the exact archive hash, package resolution, sync
and SDK checks, focused typecheck, and both emitted metadata files agree. The
engines.bbPluginSdk range alone is insufficient; it permits the currently
stamped 0.4.15 and does not identify the fork contract. Do not run
bb plugin types, because its purpose is to repin package-based plugins to the
CLI SDK rather than preserve this workspace-selected fork archive.

## Reload, source-path, and running-status probes

These are the only live plugin probes needed after the qualified build:

~~~sh
bb plugin reload subscription-router
bb plugin source subscription-router
bb plugin list
~~~

Capture the reload exit status and output. Pass criteria are:

1. reload exits successfully without a reload/build/SDK error;
2. bb plugin source subscription-router reports both requested and resolved as
   path:/home/ubuntu/bb/plugins/plugins/subscription-router;
3. bb plugin list reports subscription-router@0.1.0 running; and
4. the running report is not being used to claim provider-process adoption.

The source-path check is deliberately separate from the build check: a source
update, build, install, plugin reload, and provider-process restart are
different boundaries. Preserve the current message-timings-nerd process and
the shared BB runtime while collecting these observations.

For host-generation and provider ownership, use the host-specific probe after
the plugin reload is accepted:

~~~sh
bb subscription-router doctor HOST_ID --json
~~~

Record only redacted operational fields. Require healthy=true, a deployment
digest matching the plugin's host source bundle, the expected pinned Bun path
and version, codex.active=true, the configured shim targeting
~/.codex-subscription-router/lib/router-command, and a routed Codex version
that passes the host's mise/executable policy. The doctor provenance is scoped
to the host command environment; it does not prove that an already-running
provider opened the new generation.

For that separate adoption proof, inventory provider/router PIDs and executable
arguments before and after the controlled provider release, and require every
surviving process to name the intended generation, Bun, account home, rollout,
and released lease. The current 1adbcc… processes mean that a future report
must either show their controlled exit or explicitly record an approved old/new
overlap; it must not silently report all providers as updated.

## Usage range and reconnect probes

The Usage page is the Usage nav slot at app.tsx:1282-1289. Its client
contract is in usage-page.tsx:250-272 and rpc-contract.ts:183-254,306-315.
Exercise it in one browser tab only, without restarting BB or a provider:

1. Open Usage. The initial request must be usage({ rangeDays: 30 }).
2. Select 7d, 30d, and 90d one at a time. Each request must return a
   schema-valid snapshot whose rangeDays, startsAt, and endsAt match the
   selected day window. Check totals, daily rows, models, accounts, evidence,
   estimation, and operations rather than only the chart rendering.
3. While a range request is pending, the previous snapshot must remain visible,
   with Refreshing <N>-day usage. If the request fails, the page must show
   the retry action and retain the previous range's snapshot; it must not clear
   historical values or silently replace them with zeroes.
4. Cause only the current browser connection to transition
   reconnecting -> connected (for example, a controlled client-tab network
   interruption). On reconnection, the selected range must issue one fresh
   usage request and settle back to the same range without disturbing the
   Router, provider processes, or the separate message-timestamps thread.

The Usage RPC is a projection read. It does not refresh provider quotas. The
page's manual Refresh button repeats the selected usage RPC; it is not the
machine/provider refresh operation.

## Provider-refresh probe

Use the Settings-equivalent command only after the qualified plugin is loaded:

~~~sh
bb subscription-router status HOST_ID --json
~~~

The plugin CLI routes this to the host's status --refresh --observed-codex
command. host/router.mjs:1388-1415 and host/accounts.mjs:141-225 show that
the refresh initializes each account, reads account/read with
refreshToken: false, and for ChatGPT accounts reads
account/rateLimits/read, then persists the non-secret snapshot and timestamp.
It is therefore a provider-refresh/state-snapshot probe, not a plugin reload.

Pass criteria, using redacted JSON only:

- command exits zero and every expected account has a structured snapshot;
- connected ChatGPT accounts have non-null rate limits and no refresh error;
- providerAccountId remains stable, snapshotUpdatedAt advances, and account
  and route counts do not unexpectedly change; and
- a subsequent Usage read remains schema-valid. Do not expect the Usage
  operations sample to change immediately: the server's hourly sampler calls
  passive status and writes router history separately (server.ts:538-567).

## Retained-data probes

### BB Usage retention and idempotence

Before the future reload, capture redacted 7/30/90-day Usage snapshots. After
reload, allow the plugin's startup backfill to settle, then capture the same
three ranges again. server.ts:426-536 proves the backfill reads retained
client/turn/requested, turn/started, turn/completed,
thread/tokenUsage/updated, and thread/identity events in ascending pages of
500, scans both archived and unarchived hidden Codex threads, and fences
in-flight work on disposal. thread.idle ingests a changed Codex thread and
the hourly task samples Router status.

The before/after comparison must show no loss or duplicate counting for
unchanged data: canonical turn identity is
[provider, providerThreadId, providerTurnId], independent of local account
slot (usage-reconciliation.ts:173-176), and the projection primary key and
merge logic are idempotent (usage-projection.ts:140-170,190-205,283-309).
Allow only expected increases from genuinely new retained events. Check that:

- observed totals and completed/incomplete counts are preserved;
- evidence.label remains observed-lower-bound when retained facts exist;
- earliestObservedAt, latestObservedAt, replay/discontinuity/conflict/
  pruned counters, and account coverage remain explainable;
- provider-account attribution does not split when a local slot changes; and
- 7-day totals are no greater than the corresponding 30-day totals, which are
  no greater than 90-day totals for nonnegative aggregate fields at the same
  capture time.

Do not compare capturedAt as an exact value. Pricing is evaluated at read
time, and the snapshot window is day-boundary based
(usage-projection.ts:385-415,541-588).

### Router durable-state retention

The host runbook's post-activation evidence, to be run by the owning
live-runtime lane rather than this lane, is:

~~~sh
/home/ubuntu/.codex-subscription-router/lib/router-command state verify
/home/ubuntu/.codex-subscription-router/lib/router-command \
  thread inspect PROVIDER_THREAD_UUID
/home/ubuntu/.codex-subscription-router/lib/router-command doctor
~~~

Require SQLite backend, valid=true, integrityCheck="ok", clean foreign
keys, WAL/FULL synchronous settings, expected schema/material counts, and a
present recorded rollout when the inspected provider thread is known to exist.
thread inspect is metadata-only; it must not resume, repair, dump rollout
contents, or search every account home. Preserve account homes, state.db, WAL
files, retained rollouts, and the immutable JSON migration backup. The runbook
explicitly rejects interpreting a missing recorded path as proof of deletion.

For the controlled fresh-process canary, create one retained diagnostic thread,
complete one small turn, resume it once, verify route ownership and rollout
discovery, then verify the lease is released and the retained Usage projection
contains the turn. This is a future owner-controlled provider test, not a
permission for this lane to create or restart anything.

## Current conclusion

Readiness is documented, not passed. The canonical source path and host Router
generation are identified, and the host generation matches its current host
source files. The plugin's existing app/server artifacts remain stamped SDK
0.4.15; the exact fork SDK-qualified build, reload, source-path/running
proof, Usage range/reconnect proof, provider-refresh proof, and retained-data
before/after proof are still future gates. No active Router, provider process,
message-timestamps activity, plugin source, or plan ledger was modified.
