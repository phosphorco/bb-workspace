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
