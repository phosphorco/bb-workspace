# Selected main release preflight

Read-only review by `thr_wmg2gi249v`, with worker `thr_gjbmajmmib` reused through explicit Codex `gpt-5.6-terra` / high / fast turn. No grandchildren. Cole's current grant selects `/home/ubuntu/bb-service` for repair/build/commit/push to origin/main; root `thr_csw7br3yff` owns integration, dependencies, checks, patch sealing and pushes. This reviewer only inspected metadata/source/receipts and wrote this nonsecret receipt. No source, branch, dependency or runtime changes; normal `/home/ubuntu/bb` untouched.

## Source and ancestry snapshot

Direct `git ls-remote` observations, without fetch or local ref changes:

| Repository | Local selected HEAD | Remote main | Remote preview branch | Relation |
| --- | --- | --- | --- | --- |
| workspace | `1bcd7577654f573cfcbc05068178449237a66977` | `333af6351cfb2ab2914f7758b1228f4eca3f4c61` | same as local | Diverged: one unique commit each |
| fork | `ad974140351d64e6ffc7df47005c7ce110d1dafa` | same as local | `96f4d7cc954d0b1fd07d4c7135500e96818ffd32` | Local already equals main |
| plugins | `81157cc34fb6d6f39687b399e6574fa7391607c8` | `4ecd8b0bddc248cfd19ab94362cbba8937ba375b` | `862aee51269d87ebcc307ecd7c69a002c0fd8d6a` | Main ancestor; two local commits beyond main; latest repair not on inspected remote refs |
| community | `31498646dbd7d6ce08ce6fabe0488a444cbc589d` | `9ec81c2120760f3108be84f676a5a81cdaca2214` | same as local | Main ancestor; one local commit beyond main |

All local branches were `bb/sdk-sharing-preview-thr_csw7br3yff`. Three child source repositories and fork/upstream were clean. Workspace had modified child gitlinks plus authored untracked `plans/` and `preview/native-identity/`. Root concurrently created `preview/main-closeout/check-packages.py`, `plan-transfer.json`, package logs and receipts; these are preserved. This receipt adds only its own path.

Workspace main's unique `333af63` changes AGENTS.md, README.md and fork/plugins gitlinks; local unique `1bcd757` adds source-port evidence/archive. Root must reconcile both histories/policy and selected gitlinks; a plain fast-forward of the current workspace branch to main is impossible. No force push is implied. Child remote containment is required for the final composition receipt, not a prerequisite to authorized local integration.

The visible fork materialization is based at `960255b98ce3dccdcb5754eb67a7f989236602a1` with 160 porcelain entries including applied overlay work. Do not interpret clean fork overlay repository as a clean materialization or erase those entries. Root's exact replay/tree comparison must distinguish selected patches from any new authored materialization work. This review did not attribute those 160 entries to new concurrent edits.

## Runtime and build safety

Read-only preview HTTP returned health 200 and six threads, all idle. Preview service remained active with PID 208908, working directory `/home/ubuntu/bb-service/fork/build/bb`. These are point-in-time observations, not a reservation against new tasks. No thread titles, content, credentials or launch environment values were retained.

`preview/restart-and-check.py` captures normal PID, refuses a restart if its threads query finds nonterminal work, restarts only `bb-service-preview.service`, checks health, and asserts normal PID unchanged. Its idle check has a race with newly accepted work and does not enumerate plugin background jobs/outboxes. Root should recheck immediately before any authorized restart and coordinate active users/tasks. Do not terminate someone else's work to make preflight green.

Restart is **not build-free**: `preview/launch.py` executes `scripts/start-bb.mjs`, which invokes runtime Turbo builds, bundled-plugin build/copy, then native-module preflight before server startup. Native preflight can repair dependencies. Therefore serialize restart against root's installation/build/patch-sealing work. Launcher selects preview state and ports 40886/40887; Tailnet preview is 40888. Leave normal/proof services, ports and credentials untouched. `preview/cli.py` is the selected CLI wrapper; bare BB remains this campaign's coordination CLI and is not the preview runtime control target.

Launcher and preview CLI pin Node 22.19.0. Existing port validator and new root checker pin 22.21.1. Both binaries independently reported Linux x64, modules ABI 127 and N-API 10. This difference alone is not an ABI mismatch. It does not prove installed native modules load under the actual launch process. The inspected server better-sqlite3 resolves inside bb-service's pnpm tree, and organization/community package roots also resolve within bb-service. Native artifact loading and full dependency closure remain root checks.

## Exact command ownership and evidence

Root's new [check-packages.py](check-packages.py) pins Node 22.21.1, Bun 1.3.14 and pnpm 9.15.0 on PATH and removes inherited `BB_CLI`. It runs:

- Organization: `bun install --frozen-lockfile`, `bun run references:sync`, `sync:check`, `references:check`, `sdk-types:check`, `typecheck`, `test`, `build`, then `sdk-types:check` again.
- Community: `npm ci`, `npm run test`, `npm run typecheck`, `npm run build`.

For fork root's [README](../../fork/README.md) requires overlay `./scripts/verify`, namespace checking, then in `fork/build/bb`: `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm test`, `pnpm build` (package manager 9.15.0, Node >=22.19.0). Run with root's selected explicit toolchain and sealed source. `scripts/verify` creates and removes a temporary verification worktree, so it is an executing verification action, not read-only inspection. `scripts/materialize` refuses an existing target: do not rerun it against the active materialization or delete that target. Root owns the preservation/replay procedure. Scoped tests may diagnose a failing aggregate, but do not relabel aggregate failure as success.

Observed current receipts, not commands executed by this reviewer:

| Receipt | Observed coverage / limit |
| --- | --- |
| [plugins-checks.json](plugins-checks.json) | Exact `81157cc`, Node22.21.1, all nine listed steps exit0. Log `plugins-6.log` explicitly includes passing malformed recovery-copy and proxy retry tests. |
| [community-plugins-checks.json](community-plugins-checks.json) | Exact `3149864`, Node22.21.1: npm ci0, test1; later typecheck/build not recorded at inspection. |
| `community-plugins-1.log` | Analytics 47 tests,46 pass,1 fail: `plugins/analytics/test/store.test.ts:57`, serialization of25k facts1047.9ms against `<1000ms`. Native load succeeded far enough to execute this in-memory SQLite test. This is a performance assertion failure, not a missing-native-module error. Preserve witness, investigate contention/implementation, repeat same case without weakening threshold merely to pass. |
| Prior `preview/unpublished-port/*checks.json` | All package steps previously green on older selected source; historical supporting evidence, superseded for current repair by new receipts above. |
| Native identity plan / prior preview docs | Scoped route, queue, retry, migration/typecheck/build and controlled browser claims. No new full-core check receipt inspected in this preflight. Older docs explicitly retain full-server-suite failures; root must obtain current selected-composition results and classify any failure precisely. |

## 81157cc repair review and focused tests

Worker report was independently reviewed against the six-file commit (192 insertions,10 deletions). Parent is exactly `862aee5`. Repair stable-reads malformed JSONL, preserves original bytes, produces a private recovered copy plus digest/line-number manifest, resumes it before assigning the recovered route, and tells caller to retry. It also fences post-disposal usage projection writes/errors. No repair execution against real provider state was performed by this lane.

Focused commands, from `plugins/plugins/subscription-router`, are `bun test --timeout 15000 test/session-migration.test.ts`, `bun test --timeout 15000 test/proxy.test.ts`, and `bun run typecheck`. The root aggregate already records both new positive recovery tests passing, so repeat only for a changed implementation or unresolved failure. New fixture coverage proves original preservation, private copy mode/parseability, manifest omission of malformed content, and first-request repair/second-request retry.

Meaningful remaining repair gaps: capacity error or recovered-resume failure must not select a broken recovered route; disposal during an awaited usage/status operation must not write after disposal; concurrent/no-clobber recovery and malformed metadata/truncated input need precise fixture coverage if those paths are claimed supported. Existing migration tests may cover shared helper behavior; do not call all helper behavior untested merely because the new test does not repeat it. Broad malformed-error text matching needs a valid unrelated-error refusal witness. No real Codex malformed-session repair or router/account migration was established by these fixtures. These gaps should be dispositioned by root based on selected delivery scope, not represented as blanket unknown functionality.

**Bounded review verdict:** neither worker nor parent found a confirmed production defect in `81157cc`. The optional coverage cases above do not block committing/pushing this already-tested slice. No additional implementation or test expansion is requested by this preflight.

### Subsequent root receipt

Independently read [community-plugins-retry.json](community-plugins-retry.json): exact `3149864`, Node22.21.1, test/typecheck/build all exit0. Root confirms this isolated retry used unchanged source and test budgets after the 1047.9ms failure under parallel load. Retain both observations; the failed run is historical evidence, not a current unresolved gate after the same checks pass unchanged. Root owns community push and later combined runtime validation; no push success is inferred from intent.

## Handoff and release condition

Reconcile workspace main, preserve concurrent authored work, seal the exact selected materialization and dependency artifacts, close current relevant failures, then root commits/pushes selected children before advancing/pushing workspace gitlinks. Recheck remote refs and source status immediately before push because concurrent work can evolve. A main-source receipt and a live preview receipt are distinct; record loaded build/SDK/plugin bytes after authorized startup/reload. Normal-host deployment is not performed by this preflight. bb-machine SSH no longer blocks this explicitly selected bb-service task.
