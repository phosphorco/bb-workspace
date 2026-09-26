# Skills Analytics core-fork rollback

## Authority and boundary

This receipt implements the ready `skills-core-fork-rollback` Action in
`plans/skills-analytics.plan.pkl`. It reverses only durable patch
`0022-feat-skills-observe-runtime-and-provider-lifecycle.patch` and its exact
canonical `fork/upstream` correspondence. It does not modify `fork/build/bb`,
any plugin repository, or patch 0023.

## Proven correspondence before reversal

- Upstream base identity: `267938526dfcbc0edb228ce827b5bec202c1af97`.
- Reversed patch SHA-256:
  `b3691737520df2eaa3ffa8b14ec663b120721b362470b16dafad3da9ecbe1360`.
- Before reversal, `git -C fork/upstream apply --reverse --check` accepted the
  exact patch, `git diff --check` passed, and the canonical dirty state was
  exactly 29 tracked plus five untracked paths. The reverse application then
  left both `git diff --quiet` and the untracked-file check clean.

The exact reversed file set was:

- `apps/host-daemon/src/injected-skills.ts`
- `apps/host-daemon/src/runtime-manager.test.ts`
- `apps/host-daemon/src/runtime-manager.ts`
- `apps/server/src/internal/events.ts`
- `apps/server/src/services/skills/injected-skills.ts`
- `apps/server/src/services/threads/thread-data.ts`
- `apps/server/src/services/threads/thread-events.ts`
- `apps/server/src/services/threads/thread-runtime-config.ts`
- `apps/server/src/services/threads/thread-storage.ts`
- `docs/provider-bridge-protocol.md`
- `packages/agent-runtime/src/runtime-provider-process.ts`
- `packages/agent-runtime/src/runtime.lifecycle.test.ts`
- `packages/agent-runtime/src/runtime.ts`
- `packages/agent-runtime/src/types.ts`
- `packages/domain/src/index.ts`
- `packages/domain/src/provider-event.ts`
- `packages/domain/src/skill-observation.ts`
- `packages/domain/src/thread-event-scope.ts`
- `packages/host-daemon-contract/src/commands.ts`
- `packages/host-daemon-contract/test/contract.test.ts`
- `packages/provider-bridge-protocol/src/assembler/delta-assembler.test.ts`
- `packages/provider-bridge-protocol/src/assembler/delta-assembler.ts`
- `packages/provider-bridge-protocol/src/index.ts`
- `packages/provider-bridge-protocol/src/requests.ts`
- `packages/provider-bridge-protocol/src/skill-observation.ts`
- `packages/provider-bridge-protocol/test/protocol.test.ts`
- `packages/thread-view/src/event-decode.ts`
- `plugins/provider-claude-code/src/bridge/__tests__/skill-instrumentation.test.ts`
- `plugins/provider-claude-code/src/bridge/bridge.ts`
- `plugins/provider-claude-code/src/bridge/context-usage.ts`
- `plugins/provider-claude-code/src/bridge/skill-instrumentation.ts`
- `plugins/provider-codex/src/bridge/bridge.calibration.test.ts`
- `plugins/provider-codex/src/bridge/bridge.skill-observation.test.ts`
- `plugins/provider-codex/src/bridge/bridge.ts`

## Durable queue and result identities

- Queue before rollback: patches 0001–0023, including Skills Analytics patch
  0022 and unrelated patch 0023; recorded result tree
  `12ceddac7f11bae2b7073d16cf6e403e57d73440`.
- Queue after rollback: patches 0001–0021 followed by unchanged patch 0023.
- Post-rollback result tree:
  `389616a89f941c38870eba2578374660771b3ad1`.
- The original pre-Skills 21-patch receipt remains
  `036bb9f48f606260634f64cd3385d522a8175232`. It is not the current lock
  because restoring it would discard the unrelated durable 0023 queue entry.
  A temporary index and object store replayed exactly the retained queue to the
  recorded post-rollback tree without creating a runtime checkout.
- Patch 0023 remains byte-for-byte unchanged with SHA-256
  `739e3fdeae4517ae0337b3022b17a3b9323721845271843e3890771a360f0124`.

## Verification status

The parent reran `./fork/scripts/verify` with the narrow disposable-worktree
permission. It passed the P6R namespace adversarial witness and downstream
namespace checks, and verified the retained patch queue at
`389616a89f941c38870eba2578374660771b3ad1`. This agent rechecked all other
exact-oracle conditions afterward: 0022 remains absent, `fork/upstream` remains
clean, `fork/build/bb` resolves to
`3ca518dd2fd73e2e6011a5b0fc77525aff1e5919`, and 0023 retains SHA-256
`739e3fdeae4517ae0337b3022b17a3b9323721845271843e3890771a360f0124`.

This agent cannot yet write Workbench Mechanical evidence: its own attempts to
invoke the approved verifier are rejected before process creation. The parent
must record the exact `workbench plan verify` result from a session holding the
same narrow permission; no fabricated artifact or evidence is recorded here.
