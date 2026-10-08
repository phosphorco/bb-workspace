# External activation execution — 2026-10-08

Activation and recovery ownership transferred from BB threads to the external
managing agent at Cole's request. The executing session was session-62.scope,
outside bb.service. Both owner and steward froze before activation; neither
launched an activation runner. The external agent executed the handoff steps.

## Running composition

- CLI: **0.45.0**.
- Runtime: `515fddf7238579ac31a0321e1fd6d44d66d9f2f3`.
- Runtime tree: `81da17d778dcf19648c77a726b7f5cd41ec2d3f0`.
- Upstream: `c9649eae71edd2a9da097f8325dde25d8260e5b1`.
- Fork: `0009598ca09e1e1e7b614ab88188286f69d6f36e`.
- Organization plugins: `65ef176c72ebc0d13b18fc9a7a67233caf2196d5`.
- Community plugins: `87e781c08f059ad2868b3ac9a555a817fe9813df`.
- Start requested 2026-10-08 09:46:09 UTC; epoch milliseconds 1791452769824.
- New service MainPID 2233337; active, health OK, NRestarts 0 at verification.

## Completed

The evidence directory is `/home/ubuntu/.local/share/bb-activation-20261008`.

- Fresh P7 snapshot saved before stopping.
- Consistent stopped backup: 34 databases, all quick_check OK, ledger 138.
  Backup completed in 139 seconds. Retain `backup/` until acceptance and soak close.
- Runtime and both plugin collections installed and built successfully in place.
  Pre-existing dirty source files preserved; no stash/reset/clean.
- Migration: 138 -> 149, all prior ledger entries retained, latest 1791422663905.
- Four bundled plugins inserted disabled as documented.
- Inventory gate PASS: 77 rows unchanged, exactly expected additions and rename.
- Plugin gate PASS at two-minute readiness: 67 running before and after, no errors.
  An early sample before that window showed starting plugins and failed the
  load comparison; it was not used as the final readiness result.
- Primary and owned listeners share the server PID; daemon listener present.
- Owned Host and literal Host return 200; unexpected Host returns 403.
- Local machine identity is identical to the pre-stop snapshot.
- Post-start provider-verified user events observed. These alone do not establish
  Cole's personal-device identity gate.
- Version and gate results sent with BB CLI to owner thr_h5jwmx59qk and steward
  thr_px9i8ajvcy. They may perform read-only acceptance; external agent retains
  activation/recovery ownership.

## Pending and limitations

- Full Serve request from bb-machine cannot resolve bb-next.banjo-tint.ts.net:
  system DNS and Tailscale internal resolver return no record, and this host's
  netmap ExtraRecords omits this service. Serve configuration still targets
  127.0.0.1:38888; post-start verified-person traffic is present. No DNS or
  Tailscale configuration was changed. Personal-device probe requested from Cole.
- G6: Cole's personal-device identity and scratch-message verification pending.
- G7: prompt-rules runs and sampled logs have no prompt middleware failures;
  panel/render functional acceptance requested from BB owner/steward, pending.
- G8: external systemd timers `bb-upstream-monitor-30m` and
  `bb-upstream-monitor-16h` scheduled at 2026-10-08 10:16:09 UTC and
  2026-10-09 01:46:09 UTC. These collect health, service/plugin/version and
  retained-log performance evidence and send a CLI report if BB is reachable.
  They do not mutate service/data or perform unattended rollback.
- Startup errors inspected: early plugin-starting requests, disconnected/suspended
  hosts, and existing invalid-skill/protocol-mismatch warnings. Baseline comparison
  is in external-warning-comparison.json. No claim of complete long-term acceptance.
- Workspace gitlinks have NOT been promoted or pushed. Promotion remains after
  G6/G7 acceptance per handoff. This receipt is uncommitted.

Rollback remains the original handoff R1-R6: after migration, mandatory data
restore plus old source rebuild. Code-only rollback is invalid. Retain failed
files if rollback is needed; account for the post-backup lost-write window.
