# Execution runbook

Every phase has an entry gate, evidence, and exit gate. Stop on unknown state.

## Phase 0 — establish `bb-machine` staging safely

1. Start from `/home/ubuntu/bb` and read the root and child `AGENTS.md` files.
2. Run `scripts/preflight.sh` and `./bin/status` before changing anything.
3. On a fresh clean clone, run `./bin/setup-role --staging`. On an initialized
   workspace, inspect every child branch/HEAD/status before considering it.
4. Do not use Task Checkouts, hidden deployments, or another source directory
   as runtime/plugin sources.
5. Keep Rosetta normal and do not claim `svc:bb` on staging while Rosetta owns it.

Exit: `./bin/check --role staging` passes and every visible dirty path has an
owner.

## Phase 1 — settle and freeze the 0.39 source receipt

1. Fetch remotes without merging.
2. Inventory both sides of the recorded divergence in workspace, fork, and
   plugins. Never force-push or discard authored history.
3. Fetch the two `handoff/bb-0.40-2026-08-30` child branches and compare their
   snapshot commits with current `main`. They are preservation inputs, not
   branches to deploy wholesale.
4. Finish or explicitly defer each dirty plugin cohort from the current-state
   inventory. Refresh generated manifests/types only after their sources settle.
5. For every fork patch candidate present at freeze, produce:

   `candidate → retained invariant → exact 0.40 symbol/path → target logical patch → tests → disposition`

6. Reconcile fork README, DOWNSTREAM, series, hashes, and result-tree receipt.
7. Run fork verification/delta reporting and relevant plugin checks.
8. Commit and push the exact frozen child histories to reviewed branches.

Exit: one reproducible pre-0.40 recovery point exists remotely. Do not advance
workspace gitlinks merely to record staging branches.

## Phase 2 — prove pristine upstream 0.40

1. Pin target commit `f3cab2dd8c5c4be6d450be318550f3a04c8c3a1f`.
2. Create a dedicated fork overlay sync branch from the frozen overlay receipt.
3. After inspecting the nested submodule, register a temporary upstream
   worktree at the target commit. It is build/review input, never runtime.
4. Run frozen install, typecheck, tests, and build on unmodified 0.40.
5. Record migration high-water, protocol 170, package versions, generated SDK,
   and baseline failures.

Exit: upstream/environment failures are separated from downstream work.

## Phase 3 — implement migration and identity types first

Follow `03-MIGRATION-AND-DATA.md` before application porting. Generate the
post-0109 identity migration, implement the dedicated bridge, and prove empty
plus production-copy paths.

Exit: the database work is independently recoverable and second-run no-op.

## Phase 4 — port request identity authority

- canonical actor/principal serialization;
- exclusive provider registration and lease-safe resolution;
- route-auth ordering before identity resolution;
- request actor assurance;
- token/external/none secret isolation;
- provider socket lease binding and claimed presence rebind;
- real/fake plugin-host parity and negative tests.

Exit: no authored send consumes identity until the authority suites pass.

## Phase 5 — port accepted authorship

- require discriminated origin at low-level append/send constructors;
- inventory every bypass of `acceptThreadSendRequest`;
- cover create/fork/provisioning/send/queue/deferred/edit/interaction/compact;
- atomically persist actors and accepted units;
- add durable deferred acceptance keys;
- implement request-bound and plugin-external sends;
- restore durable tool `turnAuthor`;
- prove public input cannot choose agent/system/BB authority.

Exit: the call-site inventory is complete and all authority-negative tests pass.

## Phase 6 — port protocol/runtime and minimal presentation

1. Add durable speaker metadata only to necessary daemon commands.
2. Bump the coordinated protocol to 171.
3. Prove publish, advertise, download, verify, install, restart, reconnect, and
   refusal to establish/enqueue commands before convergence.
4. Port the isolated workspace login-shell PATH helper.
5. Always render stored authors by canonical actor key.
6. Produce participant equivalence evidence before adding a narrow read field.

Exit: server/daemon/CLI are one coherent artifact and presentation needs no
active facet authority.

## Phase 7 — adapt plugins after the exact SDK exists

Use `04-PLUGIN-PORT-MAP.md`. Prove generic facet code was not reintroduced.
Refresh SDK declarations from the final materialized target, adapt every named
consumer, and run organization/community checks.

Exit: source, generated contracts, plugins, and runtime agree on the same trees.

## Phase 8 — exercise canonical staging

1. Materialize only at `fork/build/bb`.
2. Direct-load plugins only from `plugins/plugins` or `community-plugins/plugins`.
3. Run all fork and plugin verification commands.
4. Exercise two-client identity, reconnect, create/fork, queue edit, deferred
   delivery, interaction, prompt shelf/stack, Thread Progress synchronization,
   plugin-external author, daemon update, and workspace PATH behavior.
5. Capture evidence with the provided script.

Exit: the combined staging runtime is behaviorally accepted.

## Phase 9 — rehearse production-copy upgrade and recovery

1. Obtain a stopped/consistent Rosetta copy through an operator-approved path.
   Never copy an open DB without its WAL state.
2. Run the migration bridge and exact 0.40 artifact against the copy.
3. Measure duration, DB/WAL/transient disk, checksums, integrity, and pragmas.
4. Prove the second bridge invocation mutates nothing.
5. Rehearse exact 0.39 database/artifact restore and out-of-band daemon
   171-to-153 reinstall.

Exit: upgrade and selected recovery path have executable evidence.

## Phase 10 — stop and prepare promotion proposal

Tomorrow's staging agent stops here unless separately authorized.

Produce the selected child SHAs, test evidence, database evidence, unresolved
risks, proposed workspace gitlinks, GO/NO-GO recommendation, downtime estimate,
and exact recovery command. Do not update Rosetta or `rosetta-machine`.
