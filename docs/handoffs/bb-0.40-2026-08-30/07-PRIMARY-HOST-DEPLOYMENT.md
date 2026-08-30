# BB 0.40 primary-host deployment runbook

This is the controlling end-to-end procedure for moving normal BB consumption
from Rosetta to `bb-machine`. It covers implementation, rehearsal, promotion,
live deployment, ingress transfer, and rollback. It does not itself authorize
cutover.

## Topology and authority

- `bb-machine` is temporarily isolated while it hosts upgrade development and
  validation. At approved cutover it becomes the normal primary BB host.
- Rosetta remains the live primary until cutover. After acceptance it is
  rollback-only.
- Only one host may claim normal BB ingress.
- The canonical workspace is `/home/ubuntu/bb`; the only runtime source is
  `/home/ubuntu/bb/fork/build/bb`.
- Temporary replay worktrees are review/build inputs, never runtime sources.
- `CUTOVER GO` is required before stopping Rosetta or mutating production data,
  services, role policy, or ingress.
- Before the first 0.40 write, record an explicit irreversible-write decision.
  `CUTOVER GO` does not silently waive this second gate.

## Fixed inputs

- Workspace handoff: `81b55a14b31983017451994b8946c4f8bf349044`
- Fork WIP preservation: `b3f486c8f9c15c4353ece5b609041426a0734941`
- Plugin WIP preservation: `e8cc4c7a50effbd6b721dfb585a8d6f89cc37821`
- Provisional port checkpoint: `f2a3fdc36` (not a promotion commit)
- Exact target: `desktop-v0.40.0` at
  `f3cab2dd8c5c4be6d450be318550f3a04c8c3a1f`
- Target downstream daemon protocol: `171`

Preservation commits are recovery evidence, not workspace gitlink targets.

## 1. Preserve and inventory

1. Preserve the provisional port on a non-promotion staging branch or as a
   pushed fork-overlay checkpoint. Do not push it to upstream `get-bb/bb`.
2. Record its exact parent, tree, target, and verification evidence.
3. Inventory every authored patch candidate and dirty path. Record owner,
   retained invariant, target 0.40 symbol/path, tests, dependency order, and
   disposition.
4. Keep the logical replay worktree intact until reviewed logical patches have
   been exported and verified.
5. Never discard, clean, stash, or overwrite authored work.

## 2. Complete the core port

Implement a discriminated accepted origin: human with durable actor snapshot,
internally authorized agent, internally authorized system, or legacy unknown.
Public inputs must never select actor, assurance, provider authority,
agent/system origin, external-plugin origin, or sender-thread authority.

Inventory and test every acceptance path:

- ordinary create, fork with input, plugin spawn/create, seed without run, and
  provisioning/retry;
- immediate, queued, deferred, deferred retry, edit, and replacement;
- interaction response, compact, and internal agent/system events.

Require a source/test witness classifying every low-level append. Persist the
actor snapshot but strip request assurance before durable storage. Canonical
identity is immutable authority/provider plus subject, never display handle.
Identical handles remain distinct identities. Claimed identity permits
attribution, not trusted authorization or durable preference ownership.

Add durable deferred idempotency. A stable acceptance key is consumed in the
same transaction as event or queue creation; retry returns the original result;
re-deferral retains the key; migrated legacy rows use deterministic keys and
remain legacy unknown.

## 3. Enforce provider and socket lifetime

- Bind authenticated sockets to provider identity and lease generation.
- Close and require re-authentication on provider release/replacement.
- Reject stale resolver/socket callbacks.
- Atomically update typing, presence groups, reference counts, and subscriptions
  on claimed switch/clear.
- Test multi-tab, multi-socket, disconnect, reconnect, replacement during
  resolution, and stale messages.
- Keep daemon, browser realtime, and terminal socket lifetimes distinct.

## 4. Build the migration-only bridge

The bridge must acquire an OS lock keyed by one explicit database path before
opening BB state, verify that all writers are stopped, open no listeners, and
perform no normal startup writes. Under exclusive ownership it re-reads the
complete schema and ledger, uses `BEGIN IMMEDIATE`, and recognizes only an
empty/fresh supported database, the exact Rosetta legacy state, or the exact
target state. Unknown receipts, schemas, hashes, or staging artifacts fail
closed.

Apply the target 0107-0109 work plus the reviewed identity/0110 correction in
the designed atomic sequence. Timestamp-present/hash-different receipts are
fatal. Preserve allowlisted historical facet objects and rows as inert evidence
and prove no active source, query, view, trigger, index, SDK, or application
path references them. Validate before commit and exit before normal startup.
Normal startup must refuse the legacy state with an actionable bridge command.

Evidence must include the packaged SQLite version; exact ledger and active/inert
manifests; `events.tool_name` dependencies; integrity and foreign-key checks;
ordered checksums for affected identity, event, thread, queue, deferred,
interaction, marketplace, palette, prompt-stack, and facet data; WAL checkpoint
and synchronous-mode evidence; mutation-free second invocation; real
file-backed crash tests; and exact backup/restore artifacts.

## 5. Add minimal plugin capabilities

Expose only server-derived request actor context with assurance, request-bound
thread actions, durable turn-author context read from the accepted unit, and a
narrow participant field only if equivalence evidence requires it. External
webhook authentication remains handler-owned and uses a disjoint server-derived
external-plugin actor namespace.

Request-bound actions capture a private frozen actor and fail after settlement,
abort, plugin generation replacement, or reload. Reject cross-plugin use and
caller actor inputs. Record an external actor and accepted unit atomically.

Resolve route auth before the BB identity provider. Local/core-authenticated
routes may resolve request actors; token, external, and none routes must not
expose secret headers to the resolver; none remains read-only. Revalidate the
plugin generation before invocation.

Adapt identity-boundaries, notifications, ntfy, sticky-notes, Thread Progress,
thread-manager, agent-connect, fake hosts, and every generated declaration
consumer. Regenerate declarations only from the final target materialization.

## 6. Keep deliberate deferrals out of the critical path

Unless separately justified, defer active generic facets, general member APIs,
native personal palettes, native prompt stacks, pane-width polish, generalized
migration recovery/cache work, patches 0032 and 0033, and Recovery Mobile or
execution-reassignment work unrelated to the identity-first release. Preserve
their data and authored candidates without porting them.

Retain stored multiplayer author rendering. Compare canonical actor keys, not
handles; prefer the stored author presentation over broad participant-count
plumbing; preserve explicit legacy-unknown behavior.

## 7. Produce the canonical candidate

1. Split the logical port into reviewable downstream patches.
2. Update the fork series, hashes, target lock/submodule pin, documentation, and
   result-tree receipt.
3. Materialize only through fork tooling into `fork/build/bb`.
4. Run fork verification and the exact frozen install, typecheck, test, and
   production build, including focused identity, authorship, migration,
   provider-lifecycle, protocol, and plugin-boundary suites under packaged
   runtimes.
5. Resolve or defer the Recovery Mobile whitespace failure; it cannot remain
   in a promoted stack.
6. Refresh plugin SDK declarations, sync workspace definitions/references, and
   run organization-plugin typecheck, test, and build checks.
7. Run community-plugin install, test, typecheck, and build checks.
8. Direct-load only canonical plugin paths and prove the loaded sources.
9. Exercise the combined runtime on `bb-machine` without production ingress.

## 8. Rehearse with a production copy

Using a consistent Rosetta copy without mutating Rosetta, rehearse backup,
transfer, checkpoint, bridge, startup, validation, shutdown, restoration, and
mutation-free rerun. Measure downtime and peak disk use. Exercise all accepted
origin paths, two-client identity/state synchronization, provider replacement,
plugin reload, and protocol convergence. Prove a 153/170 daemon updates to the
verified 171 artifact before command-session admission or enqueue. Rehearse the
manual downgrade/reinstall required for old-runtime rollback.

Record when paired rollback ends and forward recovery becomes authoritative.

## 9. Commit, push, and create the promotion receipt

1. Commit and push the exact tested fork and plugin trees, plus community
   changes if any.
2. Prove pushed commit trees equal tested trees.
3. Update workspace topology documentation: `bb-machine` becomes normal at
   cutover and Rosetta becomes rollback-only.
4. Advance workspace gitlinks to the tested pushed children.
5. Run `./bin/check --role staging` while `bb-machine` remains isolated.
6. Commit and push the exact workspace promotion receipt.
7. Prepare and review `rosetta-machine` role/pin changes without applying them.
8. Record SHAs, tests, migration evidence, protocol hashes, rollback artifacts,
   expected downtime, risks, and deferrals.

## 10. Obtain the live gates

Do not begin live work without an explicit `CUTOVER GO`. Reconfirm remote
reachability, disk/backup capacity, exact receipt and child gitlinks, clean
normal composition, bridge/protocol artifact hashes, current ingress ownership,
rollback commands, and maintenance-window ownership.

Before the first 0.40 write, record a separate explicit decision naming either
the rehearsed rollback and accepted consequences or forward-only recovery. Log
the first-write timestamp.

## 11. Deploy after CUTOVER GO

1. Fence Rosetta ingress, background producers, router integrations, and other
   writers through managed service controls.
2. Stop Rosetta BB server, daemon, providers, and all database users; verify no
   handles remain.
3. Checkpoint and validate the final WAL; capture and hash the immutable final
   database backup and forensic WAL/SHM set; record final ledger evidence.
4. Securely transfer the final database to `bb-machine`; keep its production
   ingress disabled.
5. Put `bb-machine` on the exact workspace promotion receipt and verify all
   child HEADs equal its gitlinks.
6. Run `./bin/check --role normal`.
7. Install and verify the canonical runtime and protocol-171 artifacts.
8. Run the migration-only bridge, then all post-migration read-only checks.
9. Start managed BB services without production ingress; verify health, daemon,
   plugins, providers, router, protocol convergence, and zero writes.
10. Stop at the first-write gate if its decision is not recorded.
11. Remove Rosetta's normal ingress claim and apply its rollback-only role.
12. Apply the exact normal workspace pin to `bb-machine`, grant it primary
    ingress, and prove it is the only endpoint owner.
13. Run live normal-role acceptance, then one bounded identity-attributed write;
    record its timestamp and durable result.
14. Verify router, terminal, provider, plugin, queue, deferred, and realtime
    operation. Monitor logs, resources, daemon connectivity, database/WAL, and
    reconnects through the defined soak.

## 12. Roll back or recover

Before the first 0.40 write, paired rollback removes `bb-machine` ingress,
stops it, restores Rosetta's old role/ingress, and restarts the untouched old
database/artifact. Verify normal service and preserve failed-upgrade evidence.

After a 0.40 write, do not casually switch back. Use rehearsed forward repair,
or obtain explicit approval to restore the pre-cutover database and lose or
reconcile later writes. Ordinary daemon self-update will not downgrade 171;
old-runtime recovery requires the rehearsed manual daemon reinstall plus exact
database and artifact restoration.

## 13. Completion criteria

The upgrade is complete only when `bb-machine` runs the exact workspace
receipt, child HEADs match its gitlinks, `./bin/check --role normal` passes,
production data and protocol evidence pass, plugins load from canonical paths,
identity/authorship live checks pass, ingress resolves only to `bb-machine`,
Rosetta is rollback-only, the soak succeeds, and final evidence records the
receipt SHAs, first-write time, and rollback status. A server merely starting is
not completion.
