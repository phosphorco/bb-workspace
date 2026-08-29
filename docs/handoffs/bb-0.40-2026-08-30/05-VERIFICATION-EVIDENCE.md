# Verification and evidence

Create a dated evidence directory outside the Git workspace and use the capture
script at every checkpoint. Never record credentials or full environment dumps.

## Evidence index template

```text
checkpoint:
operator/agent:
started_at:
completed_at:
workspace_sha:
fork_sha:
upstream_sha:
plugins_sha:
community_plugins_sha:
materialized_result_tree:
bb_version:
server_protocol:
daemon_protocol:
database_manifest:
database_backup_sha256:
test_commands:
test_results:
disk_before_after_peak:
known_failures:
decision: GO | NO-GO | STOPPED
```

## Identity and authorship scenarios

1. Human A immediate send stores A and daemon speaker A.
2. A queues; B validly edits; content and actor change atomically to B.
3. B stale edit changes neither.
4. A deferred send survives restart and B unblocks it; author remains A.
5. Crash after deferred accept produces one unit on retry.
6. Agent/system origin stores no invented human.
7. Public create/fork/send cannot choose agent/system/plugin/actor authority.
8. Provider reject/throw/malformed never falls back to claimed/local.
9. Provider replacement cannot relabel in-flight results.
10. Same handle across providers stays distinct; handle rename keeps identity.
11. Token/external/none routes skip resolver and hide secret headers.
12. Captured request action fails after settle/abort/reload in real/fake hosts.
13. Plugin-external actor cannot impersonate a BB/provider principal.
14. Tool `turnAuthor` matches accepted create/immediate/queue/deferred/edit and
    stays null for legacy unknown.
15. Provider sockets close on lease replacement; multi-tab claimed rebind is
    coherent.

## Database scenarios

- Empty DB reaches active target through ordinary journal.
- Rosetta copy reaches the same active target plus unchanged inert manifest.
- Unknown/mismatched/duplicate receipts fail before mutation.
- Kill during the single transaction leaves exact legacy state.
- Two migrators have exactly one owner.
- Second invocation mutates nothing.
- Checksums, pragmas, checkpoint, FK, and integrity pass.

## Protocol/runtime scenarios

- 153 and synthetic 170 daemon upgrade to exact 171 artifact.
- No command session/enqueue before convergence.
- No invalid-message reconnect loop.
- Server, daemon, launcher, and CLI report one revision.
- Two workspaces resolve independent login-shell PATHs with safe fallback.

## Plugin scenarios

- All named request-actor consumers compile and load.
- Thread Progress section state converges across two clients/reconnect.
- Facet absence causes no crash loop.
- Prompt Shelf and Prompt Stacks submit through request-bound actions.
- Agent Connect external auth/send cannot inherit ambient BB identity.
- Historical deferred-feature data remains checksummed.

## Required staging receipts

- `./bin/check --role staging --runtime`
- fork verify, namespace, delta, install, typecheck, tests, build
- organization sync/references/SDK/typecheck/tests/build
- community install/tests/typecheck/build
- plugin source-path proof and representative live probes
- production-copy migration and rollback evidence
