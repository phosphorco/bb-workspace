# Identity experience campaign — execution contract

Cole requested reconciliation against the master plan, followed by BB child-thread execution: sub-orchestrators use provider `codex`, model `gpt-6-astra`, reasoning `low`; implementation workers use provider `codex`, model `gpt-5.6-terra`, reasoning `high`, service tier `fast`. Root is BB thread `thr_csw7br3yff`.

Read `/home/ubuntu/bb/AGENTS.md`, the relevant child instructions and identity skill. The root plan is `/home/ubuntu/bb/plans/identity-experience.plan.pkl`; its sibling ledger is authoritative execution evidence. Root alone edits the root plan and ledger. Lane reports are inputs, not parallel status databases.

## Current assignment: reconcile, do not mutate runtime

Start with source inspection and report corrections to the proposed scope. Root is drafting the graph while you investigate. You may write only your assigned lane report under `plans/identity-experience/evidence/`; workers may write their evidence in their BB thread storage. Do not edit product source, install dependencies, publish, commit, move child HEADs, change ingress, reload/restart services, or send to external people. Do not use a supplied principal ID or fabricated headers as live identity evidence.

Cole selected `/home/ubuntu/bb-service` as this campaign's implementation home. This supersedes the earlier comparison-only campaign restriction. The normal `/home/ubuntu/bb` tree has substantial authored changes and remains preserved. Use existing bb-service source, separate preview state and ports; no new checkout or worktree. First delivery node must verify local source/runtime identities, preserved dirty work and toolchain before assigning source writes. bb-machine SSH availability does not gate implementation here; later host promotion remains separate. A planning grant never overrides the user's actual authorization or preservation requirements.

Use these sources, distinguishing intention from evidence:
- `fork/plans/bb-fork-master-plan.md` (governing outcomes, especially 3, 5–10, 13).
- `docs/identity-settings-information-architecture.md` (proposal based on old source: claimed identity and already-existing personal appearance are NOT selected rewrite guarantees).
- `/home/ubuntu/bb-service/fork/plans/native-identity-settings-and-authorship.md` and selected materialization `fork/build/bb` there.
- Selected fork main `ad974140351d64e6ffc7df47005c7ce110d1dafa`; plugins main `4ecd8b0bddc248cfd19ab94362cbba8937ba375b`; community main `9ec81c2120760f3108be84f676a5a81cdaca2214`. Reverify if needed; these are observation anchors, not permanent deployment pins.
- Workspace remote main observed `333af6351cfb2ab2914f7758b1228f4eca3f4c61`, which still pins fork `20a6d47`, before the new native identity change. Local preview plugins are `90f91e1`; distinguish that from remote `4ecd8b0`.
- Package STATUS/completion ledger contain historical, now-stale deferrals. Do not reinstate completed Agent Connect work or claim historical controlled tests are current live proof.

## Message-driven coordination

Use only `bb thread spawn --parent-self` for your workers. Do not use provider-native subagents, workflows as a second dispatcher, or `bb wait` / `bb thread wait` loops. Start at most ONE worker per lane initially (three coordinators plus three workers plus root). Ask root before increasing concurrency. Sub-orchestrators do contract analysis/review while workers investigate distinct concrete seams.

Discover `bb thread spawn --help` and provider catalog; the verified initial worker tuple is:
`--provider codex --model gpt-5.6-terra --reasoning-level high --service-tier fast --environment env_cug27tifde --parent-self`.

Send an immediate STARTED message to root naming your lane and worker ID. Tell workers to message progress, contracts, blockers and completion back with `bb thread tell`. Root will send peer IDs; coordinate directly on shared seams and copy root on ownership changes. Do not block your own useful work waiting for a worker. If no independent authorized work remains, send a handoff and end the turn; a new explicit message resumes you.

Assignment messages must name plan/node, exact read/write footprint, accepted inputs, required output, oracle, and who owns integration. Report exceptions before crossing footprints. Only one owner edits a shared SDK contract, generator/lock, patch queue, or deployment at a time. Root serializes shared integration and ledger writes.

## Return format

Your lane report: current facts with source/receipt citations; corrections to root's gap inventory; obligation → proposed node → concrete acceptance oracle; narrow write footprints and dependencies; uncertain product decisions separated from technical choices; upstream maintenance cost; remaining live/portability limits. Include worker thread IDs and verified execution tuple. Use failed-witness → correction → same witness for known defects; never turn missing dependencies/crashes into intended failures.

No source result is complete solely because an agent says so. Root/lane reviewer inspects returned changes and independently checks their actual revision. No timestamps, profile values, tokens, or private messages need be copied into general evidence.
