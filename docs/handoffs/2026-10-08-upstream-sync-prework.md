# Upstream sync prework: bb-fork 0.44.0 pin to current get-bb/bb main

Date: 2026-10-08. Owner thread: thr_h5jwmx59qk (Cole's "bb perf + redeployment" thread).
Status: research complete; execution delegated to a sync steward thread.

## 1. Outcome

Advance `fork/upstream.lock` from `9c9bae7f36a237c7e1b96de3d4c2186d13967686`
(tag `desktop-v0.44.0`, 2026-09-25) to a reviewed exact upstream commit near
current `main`, replay the 49-patch downstream queue onto it as logical
commits, regenerate the fork's migration bridge and SDK artifact, prove the
composition on `fork/build/proof-bb` and the organization plugins, and leave a
promotable source receipt. Activation (restart of the live service) is a
separate step that needs Cole's confirmation.

## 2. Measured facts (2026-10-08)

| Fact | Value |
| --- | --- |
| Pin | `9c9bae7f3` = `desktop-v0.44.0` |
| Upstream `main` head | `127fb7d58` (2026-10-07, "Accept an abort signal in experimental_discoverRpc #5163") |
| Commits behind | 466 (227 to `desktop-v0.45.0` at `129f62177`, 239 more to head) |
| Range diffstat | 2,989 files, +237,324 / -76,601 |
| Plugin SDK version | 0.5.29 at pin, 0.6.15 at v0.45.0, 0.6.29 at head |
| Upstream core migrations added | 0132_thread_drafts … 0141_moaning_vector (10 files) |
| Fork core migration | `0132_zippy_reavers` (when 1790230932026) carrying identity facets and Context Magnet tables |
| Live ledger (`~/.bb/bb.db`, read-only) | 138 rows; newest created_at 1790230932026, hash `75a11b641e07…` (the fork 0132) |
| Toolchain at head | pnpm 9.15.0, node >= 22.19.0 (live host runs 22.21.1) |
| Upstream CI | head `127fb7d58` failed only "Windows tests (server-1)"; `c9649eae7` (one commit earlier) fully green; `desktop-v0.45.0` fully green |

Evidence files in this thread's storage (`/home/ubuntu/.bb/thread-storage/thr_h5jwmx59qk/upstream-sync/`):
`upstream-commits-pin-to-main.txt` (466 first-parent titles), `patch-overlap-main.txt`
(per-patch path count, overlap with the upstream range, strict `git apply --check`),
`probe-main.txt` and `probe-v0450.txt` (`scripts/probe-upstream-replay` output).

## 3. Replay results

`scripts/probe-upstream-replay` stops at patch 0001 on both targets (3-way `git am`):

- v0.45.0: 6 conflicted paths (`apps/server/src/db.ts`, `routes/plugins.ts`,
  `services/plugins/plugin-runtime.ts`, `plugin-service.ts`,
  `test/internal/internal-events-tool-calls.test.ts`, `packages/db/src/data/index.ts`).
- main: those plus `services/threads/thread-send.ts`, `start-server.ts`,
  `packages/config/src/env-vars.ts`.

Strict apply against main: 9 of 49 patches apply unchanged
(0003, 0013, 0017, 0021, 0023, 0036, 0038, 0039, 0050). Everything else needs a
port. Largest static overlaps with the upstream range: 0015 (58 of 102 paths),
0001 (29 of 65), 0026 (20 of 36), 0025 (16 of 27), 0002 (15 of 22), 0004
(15 of 26), 0046 (15 of 20), 0018 (10 of 11). Overlap is a routing signal, not
a merge result. The 0049 "needs-port" result is an artifact of checking it
alone (it depends on files added by 0002/0015).

This matches the two prior refreshes (0.43.1 and 0.44.0): the identity kernel
(0001), attribution (0015) and Context Magnet (0025/0026) patches are always
semantic ports, not textual rebases. Their prior port boundaries are recorded in
`fork/plans/upstream-v0.43.1-sync.md` ("Semantic port boundaries") and
`fork/plans/upstream-refresh/replay-status.md`; reuse them.

## 4. Target recommendation

Target the exact commit `c9649eae7` (last fully green `main` commit, 2026-10-08,
one behind head). Fallback: `desktop-v0.45.0` (`129f62177`) if main-only
changes prove unstable during the port. Both require the same large ports; the
difference is SDK 0.6.15 vs 0.6.29 and migrations 0138-0141. Record the chosen
SHA in `upstream.lock` only after the full queue replays to a verified tree.

## 5. Known risks, ordered

1. **Migration index collision.** Fork `0132_zippy_reavers` occupies the index
   upstream now uses for `0132_thread_drafts`. The live database has the fork
   0132 applied (created_at 1790230932026, hash `75a11b64…`). Upstream 0132-0141
   all have `when` > that value, so the stock drizzle migrator will apply them
   after it. The fork bridge must become `0142_<generated>` with `when` greater
   than 1791414564985, with a fresh snapshot from upstream's generator, and
   `packages/db/src/migrate.ts` must accept the exact prior receipt (timestamp
   and hash) on an already-bridged database. This is the pattern of patches 0040
   and 0042 (see `fork/plans/reconciliation/upstream-sync-2026-09-26.md` and the
   core migration rehearsal next to it). The fork carries ~960 lines in
   `migrate.ts`; upstream touched that file twice in the range (#4606 deletes
   "expired compatibility paths", #4542).
2. **Plugin enablement and plugin-id migrations.** Upstream 0135 renames
   provider usage plugin ids, 0136 makes untouched bundled plugins follow their
   release default (#4649), 0140 stamps onboarding on existing installs. The
   rehearsal must confirm every directly-loaded plugin from `~/bb/plugins/plugins/`
   and `community-plugins/plugins/` stays enabled and resolvable after upgrade.
3. **SDK 0.5.29 → 0.6.x.** 28 organization plugins pin the fork-built tgz under
   `/home/ubuntu/bb/sdk-artifacts/` through `plugins/tools/workspaces-sync/definition.ts`
   (`sharedForkSdk`). A new tgz with provenance must be built from the clean
   candidate tree, then `bun run sync:fix && bun install && bun run sdk-types:check`,
   typecheck, test and build in `plugins/`. Community plugins pin published npm
   SDK versions (0.4.15 and 0.4.47) and only need their runtime checks.
4. **Upstream work overlapping our 0048-0051.** #4716 ("reuse root timeline
   ordering during child streaming") is in the range and conflicts with 0051 by
   design (see `fork/DOWNSTREAM.md`, refresh notes). Port 0051 on top of #4716 or
   drop it if upstream's change already removes the recomputation; measure
   before deciding. 0048, 0049, 0050 have small footprints. The three
   `phosphor/perf-*` branches in `fork/upstream` are PR candidates still based on
   the old main; retarget them after the sync if Cole opens the PRs.
5. **Removed upstream features our patches or plugins may touch.** Legacy JITI
   plugin loader removed (#1edc6b81d), Drafts plugin made native then reverted
   to manual queued drafts (#4337, #4455), bb cloud AI enabled by default
   (#4522), optional UI split with bundle budgets (#4512) which may collide with
   patch 0028 (versioned lazy artifacts) and the app layout seam (0018).
6. **Verification scale.** Prior runs hit `/tmp` inode exhaustion (tmpfs, 31 GB)
   during full test runs; use a disk-backed scratch directory for replay
   worktrees and test tmp, and retire it on exit. The database is 16.7 GB; a
   private copy for the migration rehearsal must live on `/` (112 GB free), not
   on `/tmp`.

## 6. Execution plan for the steward

Phase 0, plan (report before editing): read this file, `fork/README.md`
"Updating upstream", `fork/DOWNSTREAM.md`, `fork/plans/upstream-v0.43.1-sync.md`,
`fork/plans/upstream-refresh/replay-status.md`,
`fork/plans/reconciliation/*.md`, and `/home/ubuntu/bb/CLAUDE.md`. Confirm the
target SHA and report the per-patch port plan.

Phase 1, replay: disposable detached worktree of `fork/upstream` at the target
under a disk-backed scratch root. Replay the queue in order as logical commits.
Resolve 0001/0002/0004/0015/0025/0026 as current-architecture ports per the
recorded boundaries; fold obsolete compatibility-only patches; drop a patch only
when upstream contains its equivalent and `git apply --check -R` proves it.

Phase 2, regenerate: migration bridge as 0142 plus `migrate.ts` acceptance of the
prior receipt; p6r sidecar journal unchanged unless its schema moved; bundled
SDK declarations and templates with upstream generators.

Phase 3, verify source: `pnpm install --frozen-lockfile`, workspace typecheck
and build, DB package tests, server shared and isolated projects, plugin-build,
CLI, Codex provider; `scripts/check-p6r-namespace`. Then core migration
rehearsal on a private copy of `bb.db` (quick_check, foreign keys, ledger tail,
plugin enablement rows).

Phase 4, export: `git format-patch --full-index --binary`, replace
`patches/series`, refresh `patches/sha256`, advance `upstream/` gitlink and
`upstream.lock`, materialize to a fresh tree, record `result-tree.lock`, run
`scripts/verify`. Update README patch narrative and DOWNSTREAM.md (queue table,
exact receipt, refresh notes). Retain the preimage under
`fork/plans/upstream-refresh/preimage-2026-10-08/` as prior refreshes did.

Phase 5, plugins: build and pack the SDK tgz with provenance into
`/home/ubuntu/bb/sdk-artifacts/`, update `sharedForkSdk`, run the plugins
check sequence; fix plugin breakage in `plugins/` (never by fork patch); community
plugins `npm ci && npm test && npm run typecheck && npm run build`.

Phase 6, runtime proof: re-materialize `fork/build/proof-bb` from the new
receipt (ports 39886-39888, separate state, existing authorization in CLAUDE.md),
start it against a private database copy, exercise threads, plugin loading,
identity attribution, Tailnet listener, p6r prompts. Do not touch
`fork/build/bb`, `bb.service` or `~/.bb`.

Phase 7, handoff: commit on `fork/` main (not pushed until the owner says so),
`plugins/` commits, a runbook for activation mirroring
`docs/handoffs/2026-10-08-bb-restart-handoff.md`, and a report with SHAs,
tree hash, test counts and open gaps.

## 7. Constraints

- `/home/ubuntu/bb/CLAUDE.md` applies in full: never stash, reset, clean or
  discard dirty child trees (fork has untracked `ai-context.md`; plugins and
  community-plugins are dirty with other authors' work); `~/.bb` is operator
  state, open it read-only; no second deployment checkout beyond `proof-bb`.
- Identity ADR `docs/adrs/2026-09-identities-and-multiplayer.md` and the
  `bb-identity` and `restart-resilient-bb-plugins` skills decide conflicts in
  the identity, attribution and Tailnet patches.
- Migrations are append-only. Never rewrite applied history; never run ANALYZE
  or PRAGMA optimize on the live database.
- Electron desktop is out of scope; exclude its tests.
- No `bb.service` restart, no push of `fork/`, `plugins/` or workspace, and no
  change to `fork/build/bb` without confirmation relayed from the owner thread.
- Report with `bb thread tell thr_h5jwmx59qk "<message>"`; never `bb thread wait`.

## 8. Review gates added after the perspectives panel (2026-10-08, run thr_zvsefmiznz, partial coverage)

The full artifact is at `/home/ubuntu/.bb/thread-storage/thr_h5jwmx59qk/upstream-sync/perspectives-review-thr_zvsefmiznz.md`.
These gates are owner decisions and bind the steward.

G1, migration continuity (before export). The 0042 allowlist keeps both prior
bridge receipts (1790103658751 and 1790230932026, hash `75a11b64…`) in the
pre-Drizzle admission check and the later-ledger validation; the contract
lookup follows the new 0142 tag. The ported `migrate.ts` keeps upstream's
`bb_migration_existing_installation` preamble that 0134 depends on. Fixtures
through the public migration entrypoint: clean install; upgrade from a ledger
shaped like today's live one; immediate rerun is a no-op; injected failure
between Drizzle and bridge completion then close/reopen recovers. Assert every
original ledger row survives and representative identity and Context Magnet
rows compare equal. Measure elapsed time and peak file size (0138 inserts four
pruning-work rows per thread). Private copy by `VACUUM INTO` from a read-only
connection (not the backup API, which restarts on every foreign write); keep
that copy untouched and migrate a second copy.

G2, SDK conformance (before Phase 5 is accepted). Audit consumers first:
0.6.x emits declarations with `stripInternal`, making `useComposerView`, the
legacy text methods and `onDraftChange` internal, and the menu callback now
receives `{ composer }` not `{ view }`; sticky-notes, agentation and
future-threads are known hits. Port to the public composer API and check
mention and attachment preservation. `bb-identity` (`^0.4.15 || ^0.5.9`) and
`bb-provider-settings` (`>=0.5.29 <0.6`) exclude 0.6: run their conformance
under the candidate SDK, then update support ranges and pins through the
package delivery process in `plugins/AGENTS.md`. Reconcile Zod (upstream
`^4.6.5`, org override `4.3.6`) deliberately. Plugin builds must use the
candidate CLI: the org wrapper resolves `fork/build/bb` and deletes `BB_CLI`,
so build in a separate `plugins/` worktree under scratch with an explicit
candidate-CLI selection, never overwriting `dist/` that live BB is executing,
and assert emitted `sdkVersion`/`builtWith`. The SDK provenance must bind to the
final `result-tree.lock`.

G3, identity integration gate (Phase 1, after 0001/0002/0004/0015, before
continuing). Focused typecheck and tests before the rest of the queue: grouped
send, queue and retry with portable attachments and different authors
(upstream now remaps `inputGroups`; attribution indexes by group); queue edit
hold versus drain (hold, save, cancel, expiry, stale update, corrupt
attribution); machine fallback; immutable external receipts; verified mentions
as recipients; facet identity kinds; cold-start acceptance and rollback;
recovery; `/compact`. Translate the historical "0016" boundary to today's
consolidated 0015. Never restore removed native person-admission behavior.

G4, isolated runtime proof and recoverable activation. Phase 6 does not boot
the candidate against the production copy inside `proof-bb`; the proof recipe
(`fork/plans/bb-fork-local-proof.md`) forbids importing normal databases,
credentials, schedulers and outboxes. Split it: (a) migration rehearsal on the
private copy through the migration entrypoint only; (b) `proof-bb` runtime with
isolated state and fixtures per the recipe, covering Tailnet (verified person,
missing-person machine fallback, invalid port, occupied secondary port, recovery
only after both listeners bind) and p6r prompts (fresh and resumed sessions,
protected mentions, accepted-input retry without rerender, unload/reload
cleanup, provider-bound input captured with a controlled provider); (c) plugin
inventory compared before migration, after migration and after two boots. For
(c) the steward proposes an explicit isolated compatibility profile (which
settings disable provider spawning, host daemon, delivery and recovery) and
gets owner approval before booting anything against the copy. The activation
runbook replaces the code-only rollback with a rehearsed restore: previous
runtime and plugin artifacts plus a consistent backup of core and plugin state,
with the downtime and lost-write window recorded.
