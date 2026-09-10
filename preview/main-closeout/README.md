# Selected source closeout

This closes the selected `bb-service` work onto the repositories' `main`
branches. It is separate from completion of the larger
[identity experience campaign](../../plans/identity-experience/README.md).

The two corrective changes preserve message authorship through edits and
separate directory/presentation refresh from authentication revocation. Tests
must retain the original author, record the editor, keep native commands
unchanged, preserve live authority across harmless refresh, and reject a commit
after actual authentication revocation.

`check-packages.py` runs each collection's required install, test, type and build
checks with Node 22.21.1 and a controlled PATH. It removes inherited `BB_CLI`;
plugins retain their explicit SDK/CLI targets. Raw logs remain local. Curated
JSON receipts name exact commands, exit codes and tested source revisions.

The first community run failed Analytics' 25,000-fact serialization timing
assertion at 1047.9 ms against 1000 ms while the organization aggregate ran.
The unchanged community suite passed when rerun without that competing
aggregate. Both observations are retained; no threshold was relaxed.

`plan-transfer.json` records the hash-verified transfer from the old workspace.
The plan and its ledger here are now authoritative; the old copy is frozen.
Historical source and test anchors in those reports remain historical and do
not establish completion of planned features or the currently loaded runtime.

Normal Rosetta source, state and service are preserved. Local verification and
preview restart use the existing bb-service checkout, ports and state. Source
pushes do not change the other host's deployment or claim its runtime was
verified. The final composition receipt will identify pushed child commits,
materialized source tree, builds and local runtime checks.

`check-core.py` verifies the selected server, app, CLI, database, domain,
thread-view, contracts, SDK and host-daemon packages, then runs the production
build. The initial run built successfully but exposed two stale public-contract
expectations: the existing identity method and optional author/editor metadata.
Test-only patch 0019 corrects those explicit expectations; it does not loosen
validation. The subsequent receipt records the repeated matrix.

`seal-patch.py` exports only declared source paths through a temporary Git index;
it does not change the materialization's HEAD or shared index. Full patch replay
and a separate whole-tree comparison verify that the built source matches the
recorded result tree. Patch hashes and per-file hashes are retained alongside
the reviewed native test summary.

`check-runtime.py` checks the restarted preview's health, identity route, all
previously enabled plugins, built artifact hashes, and the unchanged normal
service PID. The browser harness in `preview/native-identity/browser.mjs` covers
phone/desktop settings layout and explicitly separates live connection state
from controlled ready-state presentation. Neither claims real two-person edit
acceptance or personal theme storage.

The complete matrix also exposed an omitted CLI skill index entry and a stale
palette count from the identity settings addition. Patches 0020 and 0021 cover
those discoverability expectations. Test execution uses Turbo's explicit loose
environment mode to preserve `BB_THREAD_MANAGER_PLUGIN_ROOT`, plus a private
`TMPDIR` beneath `/var/tmp`: this host has an unrelated `/tmp/.git` marker that
changes ancestor-discovery fixtures. Nothing under `/tmp/.git` was changed.
The three affected focused suites passed with these corrections before the
final aggregate rerun. `check-environment.py` reproduces that bounded check.
