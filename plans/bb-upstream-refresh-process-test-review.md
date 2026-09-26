# Upstream refresh: process-heavy test inventory review

## Scope and evidence

Read-only diagnosis only; no source, lock, provider-state, host-limit, or live-service changes.

- Inventory: `corepack pnpm exec turbo run test --concurrency=1 --continue=always` in `/tmp/bb-upstream-refresh.84BJxg/bb`.
- Primary log: `/tmp/bb-upstream-refresh.84BJxg/full-test-inventory-after-contract.log`. ACP is 4680–5170, parity begins 5543; early capacity messages are 2586–2621 and plugin-build Go thread failure is 8941.
- Replay HEAD `ecd4538d333ce7b2ea8858fd9025a60b5d7f9e1f` has local DB migration edits. Its ACP/parity/bridge difference from target only touches protocol assembly/requests and ACP native-roots tests, not launch or Vitest scheduling.
- Matched frozen target: `78804e79d280998a3b4c3c965ec1b5845703bc0e` at `/tmp/bb-upstream-target-acp.JM8G7s/bb`. Earlier direct replay and exact-target ACP runs passed 325/325. That corroborates scheduling, but waives no gate. A later capped replay at `15af1b4d9` passed the probe file 4/4 but still failed recorded conformance, 324/325; that supersedes any claim that outer Vitest caps alone are sufficient.

## Cause classification

Turbo `--concurrency=1` serializes tasks, not processes inside a Vitest task. ACP partitions files into shared/isolated projects. Provider parity runs `it.concurrent.each` with configured `maxConcurrency: 16`. Each can in turn start Node/Go bridge children.

The capped ACP result exposes a second, independent fan-out beneath Vitest: upstream `packages/provider-bridge-protocol/src/testing/parity.ts:984` implements `replayRecordedCells` as an unbounded `Promise.all`. `runFirstPartyRecordedConformance` passes all eight `RECORDED_CONFORMANCE_CELLS` into it (`first-party-replay.ts:312-325`), so one `bridge.recorded-conformance` test starts eight source-loaded bridge/esbuild child trees. The matched target contains the same unbounded `Promise.all`.

The log establishes OS allocation failure before semantic assertions:

- ACP: Node Worker `EAGAIN`, `pthread_create: Resource temporarily unavailable`, and Go `failed to create new OS thread (have 15 already; errno=11)` (2586–2621); then `spawn .../node EAGAIN` for `bridge-worker-entry.ts` running provider-acp (5144–5151).
- Parity: repeated `spawn .../node EAGAIN` for provider-claude-code bridge workers (8244–8279).
- Plugin-build: Go thread creation errno 11 (8941); the reported capped `VITEST_MAX_WORKERS=1 vitest --no-file-parallelism` retry passed its five builtin-host-artifact tests.

Live read-only cgroup observations rule out a persistent *service* cap: `pids.max=69847`, `pids.current=978`, `pids.peak=2597`, `pids.events.max=0`; `memory.max=max`, no OOM events or pressure; shell `RLIMIT_NPROC=232826`. The exact parent/global limit that emitted EAGAIN is not visible here. This is transient shared process/thread pressure (or an unseen parent limit), not evidence of an ACP protocol regression. Do not raise host limits.

### Causally covered failures

All 16 ACP failures follow unavailable fake-agent/bridge launches: probe tests receive EAGAIN instead of ENOENT/timeout/success; discovery falls back to `acp-default`; MCP start/connection fails; conformance skips/fails where no session or turn opened; recorded conformance times out after child failure. The independent capped 325/325 results are the needed corroboration, not a claim that test names are inherently safe.

All 38 provider-parity failures are replay stalls/exits while waiting for initialize or planned events. Their explicit EAGAIN worker errors, combined with concurrent cell replay, causally cover the ACP-cursor, Claude Code, Codex, and Pi cascade. They are not 38 evidence-backed recording changes.

Independent remaining gates:

- `@bb/server-contract` 1/79 is missing P6R intentional-optional allowlist entries (5260–5321), requiring its contract owner.
- `bb-app` 11/147 is the separately reported unbounded reload-fetch/accidental-loopback failure class (8520–8614), requiring its config-test owner.
- The inventory stopped at 21m33; no later package is accepted.

## Supported complete schedule

Retain every package and assertion; isolate the three process-heavy packages from the ordinary graph:

```sh
corepack pnpm exec turbo run test --continue=always --concurrency=1 \
  --filter=!@bb/provider-bridge-acp \
  --filter=!@bb/provider-parity \
  --filter=!@bb/plugin-build
```

When that graph is idle, run the omitted packages alone, against the same checkout/dependencies:

```sh
corepack pnpm --dir packages/plugin-build exec vitest run \
  --config vitest.config.ts --maxWorkers=1 --maxConcurrency=1 \
  --no-file-parallelism

GOMAXPROCS=1 corepack pnpm --dir packages/provider-bridge-acp exec vitest run \
  --config vitest.config.ts --maxWorkers=1 --maxConcurrency=1 \
  --no-file-parallelism

corepack pnpm --dir packages/provider-parity exec vitest run \
  --config vitest.config.ts --maxWorkers=1 --maxConcurrency=1 \
  --no-file-parallelism
```

`--maxConcurrency=1` is material for parity’s `it.concurrent.each`; `--maxWorkers=1 --no-file-parallelism` bounds Vitest process/file fan-out for all three. This is necessary but insufficient for ACP's internal eight-cell `Promise.all`.

For the next ACP-only bounded check, add the Go runtime's supported scheduler cap to the same command; the bridge preserves inherited environment variables when it spawns its ACP child (`withoutBridgeRuntimeEnv` removes only Electron/recording values):

```sh
GOMAXPROCS=1 corepack pnpm --dir packages/provider-bridge-acp exec vitest run \
  --config vitest.config.ts src/bridge/bridge.recorded-conformance.test.ts \
  --maxWorkers=1 --maxConcurrency=1 --no-file-parallelism
```

`GOMAXPROCS=1` controls the esbuild Go runtime's execution parallelism and is inherited by the source-loaded bridge's esbuild process; it does not alter recorded inputs, bridge behavior, or a timeout. Do not rely on the package-private `ESBUILD_WORKER_THREADS` switch: it only concerns esbuild's JavaScript helper threads and does not cap the Go process that crashed.

## Bounded witness and repair

A deterministic failing witness would require deliberately saturating the host, so do not fabricate one. Use this narrow capacity canary first; it directly covers ACP fake Node launches that previously returned EAGAIN:

```sh
corepack pnpm --dir packages/provider-bridge-acp exec vitest run \
  --config vitest.config.ts src/probe.test.ts --maxWorkers=1 \
  --maxConcurrency=1 --no-file-parallelism
```

Then run the already demonstrated five-test plugin-build cap check. If the GOMAXPROCS ACP witness passes, repeat the complete ACP package with the same environment, then capped parity, and finally the remaining graph. Any capped failure is a real failure for source diagnosis, not a reason to retry with larger timeouts.

No product-source repair follows from the original outer-worker evidence, but the new internal fan-out is an upstream test-harness defect. The faithful durable repair is limited to test-support sources: add an explicit bounded replay-concurrency option to `ReplayRecordedCellsOptions` in `packages/provider-bridge-protocol/src/testing/parity.ts`, implement a bounded worker loop instead of its `Promise.all`, and have `runFirstPartyRecordedConformance` in `first-party-replay.ts` request `1` for the eight ACP cells. Add a test proving every selected cell is replayed exactly once and results stay deterministically ordered. Keep provider-parity's own explicit concurrency owner separate. No bridge/protocol behavior, recordings, fixtures, or timeout should change.

Pre-generating a bridge artifact is not an equivalent workaround: the test intentionally spawns `bridge-worker-entry.ts` with the `tsx` source loader, and each child owns its own esbuild service. A parent prewarm cannot be inherited by those processes; switching to `dist` would test a different launch path.

## Update: capped Codex parity is a fixture-integrity regression

The subsequent capped provider-parity run at replay `15af1b4d9` removed the
capacity symptom but finished 41/56: the remaining 15 failures are stable
`agentMessage.phase` (`commentary` or `final_answer`) differences.  They are
not covered by the process-capacity classification above.

`ef7159ef6` (`feat(provider-codex): preserve agent message phase`) deliberately
introduced this downstream semantic feature: Codex parsing retains phase,
`deltaItemShapeSchema` accepts it, and the delta assembler emits it on both
agent-message open and close events.  The matched upstream target
`78804e79` has none of those changes, so the feature is downstream-retained,
not an upstream behavior to retire.

The replayed event side is correct.  Its Codex `provider->bridge` recordings
contain the phases and the current source emits them.  The expected side is
stale: `packages/provider-parity/src/index.ts` assembles its recorded input
through `withCurrentBridgeLane`, which replaces `bridge->runtime` with each
`bridge->runtime.current.ndjson` lane.  Commit `be17466e2`
(`feat(plugins): serve versioned lazy frontend artifacts`) resolved the
recording side of an in-progress conflict by removing the phase fields from
15 Codex current lanes, while leaving the phase-producing source intact.  The
same commit's diff for `approval-allow` removes phase from commentary and
final-answer open/close items.  This makes parity compare a current replay
against pre-phase expected output.

The smallest repair belongs to the owner integrating `be17466e2`: restore only
the phase-preserving hunks from `ef7159ef6` in these existing fixtures (do not
alter the comparator, schemas, or production translation):

- `packages/provider-bridge-protocol/recordings/codex/{approval-allow,approval-deny,archived-resume,compaction,empty-rollout,fork,missing-rollout,plan-mode,resume,steer,stop-interrupt,subagent,turn-tools,user-question,web-search}/bridge->runtime.current.ndjson`

The normal capped provider-parity matrix is the regression test: it compares
the generated current bridge stream to exactly these lanes.  Restore the
fixture hunks from the retained semantic-feature commit (not via a live
provider re-recording), then rerun the scheduled capped parity command.  Do
not delete phase fields from the producer merely to match stale recordings.

### Read-only repair review

The submitted repair was independently checked without running tests.  It
modifies exactly those 15 Codex current lanes; each of the 72 changes is an
`agentMessage.phase` addition, with `commentary` or `final_answer` as the only
values.  After recursively removing `phase` from each embedded JSON-RPC line,
every repaired line is byte-equivalent in structure and data to its pre-repair
version.  Phase event identities and values exactly match clean
`fece0d5c047e32879d5af279dc1dafda4b672905`
(`feat(provider-codex): preserve agent message phase`); the pre-repair lanes
had zero phase fields.  `git diff --check` is clean and the affected fixture
set contains no conflict markers.  This is approved as phase-only fixture
restoration; the capped provider-parity gate remains required.

## Update: remaining Claude conformance and CLI fork failures

The sequential-remainder log
`/tmp/bb-upstream-refresh.84BJxg/test-remainder-gomaxprocs1-02020cdb1.log`
contains two distinct capacity failures and five CLI failures that capacity
controls cannot resolve.

### Claude recorded conformance

At lines 3975–3978, the source-loaded Claude bridge loses its esbuild service
to `spawn .../esbuild EAGAIN`; only then does
`bridge.recorded-conformance.test.ts` reach its unchanged 240-second aggregate
test timeout (4033–4055).  The bridge error is causal; the timeout is merely
the unresolved async replay after the bridge died.

This is a test-harness fan-out beneath Vitest's worker cap.  The one
`runFirstPartyRecordedConformance` call passes all eight
`RECORDED_CONFORMANCE_CELLS` to `replayRecordedCells`.  Its `Promise.all` starts
eight `replayRecording` calls simultaneously.  Each starts a source-loaded
Node bridge; each bridge independently launches esbuild (and may launch its
recorded provider child).  `GOMAXPROCS=1` reaches those children and limits each
Go service's scheduling, but it cannot reduce eight separate service/process
trees.  The frozen upstream target `78804e79` has the identical `Promise.all`,
so this is an upstream harness defect rather than a replay-only migration.

Recommended source footprint, if granted:

- `packages/provider-bridge-protocol/src/testing/parity.ts`: add a positive,
  explicit `maxConcurrentReplays` option and replace `Promise.all` with a
  bounded worker loop that writes results by selected-cell index.
- `packages/provider-bridge-protocol/src/testing/first-party-replay.ts`: pass
  `maxConcurrentReplays: 1` for the shared first-party conformance runner.
  This covers ACP, Claude Code, Codex, and Pi callers without editing provider
  implementations or recordings.
- `packages/provider-bridge-protocol/src/testing/parity.test.ts`: use small
  synthetic recordings/bridges to prove peak active replay count is one,
  every selected cell runs once, and returned output remains selected-cell
  order.

Keep the existing 60-second per-cell and 240-second test deadlines initially;
the change affects launch parallelism, not protocol or timing semantics.  Do
not increase a deadline to hide EAGAIN.  If a healthy capped run later exceeds
240 seconds, record per-cell timings and make a separate, evidence-backed
deadline decision.  The next bounded package gate is:

```sh
GOMAXPROCS=1 VITEST_MAX_WORKERS=1 corepack pnpm --dir plugins/provider-claude-code exec vitest run \
  --config vitest.config.ts --maxWorkers=1 --maxConcurrency=1 --no-file-parallelism
```

### CLI

The CLI command in the remainder log is plain `vitest run` (3299–3408), and
then emits seven Vitest `forks.js` `spawn node EAGAIN` unhandled errors
(3671–3792).  Turbo's task concurrency and `GOMAXPROCS` do not cap Node fork
creation.  Isolate this package as an ordinary process-heavy gate using
explicit Vitest options, rather than trying to change CLI production code:

```sh
GOMAXPROCS=1 VITEST_MAX_WORKERS=1 corepack pnpm --dir apps/cli exec vitest run \
  --config vitest.config.ts --maxWorkers=1 --maxConcurrency=1 --no-file-parallelism
```

The five reported CLI assertions are independent and must remain visible after
the capacity rerun: four `plugin-build.test.ts` expectations assume
artifact-format v1/direct `dist/app.*`, while the replay contains v2 generated
artifact paths/metadata; `plugin-new.test.ts` expects no SDK-publication
warning but its test reached the registry.  They need their respective
artifact-test and deterministic-registry-fixture owners, not a worker-limit
workaround.
