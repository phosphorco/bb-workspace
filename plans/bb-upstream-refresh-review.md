# BB upstream refresh: downstream redundancy review

## Scope and method

Reviewed on 2026-09-22 against the current dirty downstream queue in
`fork/patches/` and the supplied disposable target worktree
`/tmp/bb-upstream-refresh.84BJxg/bb` at
`78804e79d280998a3b4c3c965ec1b5845703bc0e`. The old upstream pin is
`267938526dfcbc0edb228ce827b5bec202c1af97` (279 target commits behind).

This review did not change the queue, target worktree, locks, runtime, or host.
It used two deliberately conservative checks for every current patch:

1. stable `git patch-id` against every non-merge target-range commit;
2. `git apply --reverse --check` and, if that failed, `git apply --check` in
   the target tree.

An identical title, related upstream commit, or a clean forward apply is **not**
treated as upstream equivalence. Only an exact reverse apply is `upstreamed`.

## Dispositions

| Patch | Target-tree result | Disposition | Evidence / required replay treatment |
| --- | --- | --- | --- |
| 0001 identity kernel | conflict | conflicting; owner review | Target has similarly scoped `c6ec25c` but not the patch identity; preserve the selected shared-workspace identity ADR rather than substituting title-matched upstream behavior. |
| 0002 retained identity facets | conflict | conflicting; owner review | Same conclusion; target has `645c7c0` with the subject but no exact content. |
| 0003 identity compatibility witnesses | clean forward apply | retain | Reapply its witnesses after the identity rebase. |
| 0004 verified mentions | conflict | conflicting; owner review | Target has similarly scoped `e49802f`; replay must keep recipient-vs-author separation. |
| 0005 built sidecar migrations | conflict | conflicting | Reconcile migration ordering/content; never drop migration coverage from title overlap. |
| 0006 plugin presentation compatibility | conflict | conflicting | Target has related `ad5b2e9`; rebase against current SDK/plugin presentation surface. |
| 0007 sidebar participants/guidance | conflict | conflicting | Target has related `29ccb20` and a new plugin thread-list architecture; rebase with the sidebar test surface. |
| 0008 execution cache invalidation | clean forward apply | retain | No exact target equivalent found. |
| 0009 reviewed admission boundary | clean forward apply | needs owner | Target contains a same-subject auth commit (`9b03b76`), but this patch remains forward-applicable. Preserve the approved no-person-gate behavior unless the owner demonstrates semantic equivalence. |
| 0010 active Agent Connect queues | conflict | conflicting | Rebase against current queue lifecycle. |
| 0011 pending call history | clean forward apply | retain | No exact target equivalent found. |
| 0012 Pkl highlighting | conflict | conflicting | Rebase on current editor/Monaco integration. |
| 0013 migration-fixture rewind | conflict | conflicting | Reconcile with target migrations before any test-only retirement. |
| 0014 deterministic downstream integration tests | conflict | conflicting | Rebase test harness changes; not an upstreamed feature claim. |
| 0015 P6R best-effort attribution | conflict | needs owner | Target contains similarly scoped `e9e9dab`; shared-workspace fallback attribution is ADR-governed and must not regress to person verification. |
| 0016 Tailnet identity selection | conflict | needs owner | Target’s machine/provider architecture changed materially; validate configured-Serve selection and machine fallback rather than dropping it. |
| 0017 ACP native-root test isolation | clean forward apply | retain | Preserve the isolated test boundary. |
| 0018 sidebar layout provider | conflict | conflicting | Target has related `17f2ffd`; replay against the new sidebar/plugin architecture. |
| 0019 Codex agent-message phase | conflict | conflicting | Target has related `fece0d5`; compare optional phase semantics during rebase. |
| 0020 workflow-shell test isolation | clean forward apply | retain | Preserve ambient-state isolation. |
| 0021 virtualized path-browser cleanup | clean forward apply | retain | Keep deterministic cleanup, then run it against target's new thread-list/plugin UI. |
| 0023 plugin-route external CORS | conflict | needs owner | Target has related `5f3122a`; security semantics need direct review because no exact patch identity/reverse apply exists. |
| 0024 Modal Tailnet OIDC | clean forward apply | needs owner | Technically clean, but target has broad machine/provider lifecycle changes. Retain only after owner validates scoped OIDC/node admission against those contracts. |
| 0025 Context Magnet contribution trace | conflict | needs owner | Target contains related `2e1196f`; compare redaction, pagination, and receipt semantics before choosing upstream replacement versus rebase. |
| 0026 Context Magnet provider admission | conflict | needs owner | No exact target equivalent; host-created IDs and append-only settlement evidence remain a required decision point. |
| 0027 editor thread-storage host routing | exact reverse apply; stable patch-id target `283e6d7baf3ebce7802673ddbbcb01f072151c1e` | upstreamed; drop | The full current patch is already in the target. Do not replay it; add a target-presence check to the replay receipt. |
| 0028 versioned lazy frontend artifacts | conflict | retain semantics; rewrite | See dedicated analysis below. |

## Patch 28: retain semantics, rewrite implementation

Patch 28 is not upstreamed: its stable patch ID is
`bf04188e0caa3b36413c3a3a4f35db6bc40753c4`, with no target-range match, and
it does not reverse-apply to the target. Its source commit is
`e27fa39783b983900cb5083d3f202fde5fbb6dbb`, which is not an ancestor of the
target.

The target still has only artifact format 1:

- `apps/server/src/services/plugins/app-bundle.ts` declares/accepts
  `artifactFormatVersion?: 1` and reads `dist/app.meta.json`, `app.js`, and
  `app.css` directly;
- `packages/plugin-build/src/plugin-artifact-meta.ts` emits format 1;
- no target route or bundle service has a generation URL, a manifest-listed
  chunk map, per-file hash validation, bounded generation retention, or
  expired-generation response.

Upstream commit `a5a81ce246b61c94ef6445e7e82c23a87f30bebb` (*Shrink bundled
plugin artifacts by 75%*, #3996) is useful performance groundwork, not an
alternative. Its `packages/plugin-build/src/build-plugin-app.ts` change adds
the Zod locale stub plugin; it does not add chunk manifests or generation
serving. The replay must retain that change while rebasing 28's direct edits to:

- `packages/plugin-build/src/build-plugin-app.ts` and
  `plugin-artifact-meta.ts`;
- `apps/server/src/services/plugins/app-bundle.ts`, `plugin-runtime.ts`, and
  `plugin-service.ts`;
- `apps/server/src/routes/plugins.ts`.

Required replay evidence: a small entry has no deferred visualization/engine
dependency; v2 metadata lists every content-hashed JS/CSS chunk; path escape,
symlink/regular-file, byte-size, and SHA-256 checks fail closed; stale
generation requests return 410 rather than mixing artifacts; and a rebuild
does not reintroduce the bundle-size work from `a5a81ce`.

## Newly available upstream performance work

These target commits should be preserved and exercised, not overwritten by
downstream replay:

| Commit | Upstream improvement | Downstream risk / replay check |
| --- | --- | --- |
| `a5a81ce` | Shrinks bundled plugin artifacts by 75%. | Patch 28 touches the builder; retain the Zod locale-stub path and measure entry/chunk output. |
| `593bb7d` | Stops plugin app bundles parsing icon barrels. | Keep plugin build import scoping when adding lazy chunks. |
| `ebb6429` | Restores browser boot bundle headroom by 5%. | Patch 28 and analytics lazy dashboard must retain a small boot entry. |
| `9ee3821` | Resumes interrupted sidebar refreshes. | Rebase sidebar patches 7/18 with refresh behavior intact. |
| `127e5bc` | Restores plugin branch-picker compact sizing/search debounce/label collapse. | Do not overwrite selector interaction work while replaying plugin UI changes. |
| `9516da5`, `3bcba17`, `38657df` | Moves the thread list into a plugin and changes its loading/benchmark architecture. | Re-run patches 7, 18, and 21 against this UI; their historical paths are not a compatibility oracle. |
| `7499fc7`, `10231cd` | Bounds/recover thread-storage watchers and shutdown lifecycle. | Patch 27 is upstreamed; do not replay older routing code over these fixes. |
| `fd1b86a`, `84a960c` | Avoids main-thread shimmer repaint and speeds streaming thread rendering. | Guard against UI replay regressions with target benchmarks/profiles. |

## Decision gates

1. Drop only patch 27 now; its exact current content is already at target.
2. Rebase the clean technical retains, preserving their assertions.
3. Before rebasing patches 1, 2, 4, 9, 15, 16, 23–26, obtain/record the
   applicable identity, CORS, machine/OIDC, and Context Magnet semantic rulings.
4. Treat patch 28 as security and performance work: it needs a target-native
   rewrite plus emitted-artifact proof, not a source-only lazy-import test.

## 2026-09-24 addendum: latest `main` at `fdd3de3b`

The table above describes the earlier `78804e79` target; it is not a disposition
for the newer target. `git ls-remote origin refs/heads/main` returned
`fdd3de3b19b97e6cd1ef7300cbb54711431249d3` on 2026-09-24, 110 commits
ahead of the selected upstream pin. None of the 32 retained downstream patch
IDs is an exact patch-ID duplicate of those new upstream commits. This does
not establish semantic non-overlap: 62 paths changed on both sides.

The consequential overlaps in the isolated replay are:

| Downstream | New upstream behavior | Replay disposition / gate |
| --- | --- | --- |
| `0018` sidebar layout provider | Upstream replaced the old sidebar components with a bundled Navigation plugin and `SidebarNavigationModel`. | Port provider consumption into the new model and route native reorder callbacks to the provider. The added model regression test passes 52/52; fold its test-only fixup into `0018` before exporting. |
| `0001`, `0007`, `0015` identity and P6R | Upstream added AI-service registration and SDK surfaces alongside new plugin navigation APIs. | Preserve both upstream AI-service surfaces and downstream identity/attribution. Keep the machine-actor fallback for requests lacking usable person evidence; focused P6R checks pass 35/35. |
| `0028` immutable lazy artifacts | Upstream changed plugin build/runtime internals and SDK version to `0.5.24`. | Retain v2 manifest/chunk validation without reverting upstream build improvements; builder and server app-bundle focused suites pass 13/13 each. Emitted-entry and cold-browser proof remain open. |
| `0029` optional reload | Upstream changed bb-app config tests (`BB_LOG_LEVEL`). | Keep the current upstream setting and the bounded optional reload behavior. Full bb-app verification remains open. |
| `0034` owned Tailnet listener | Upstream changed server boot/configuration. | Preserve upstream `BB_APP_UPDATE_MODE` and downstream owned-listener wiring. No live listener or anonymous-401 rollout claim is made from a source replay alone. |

This is still a candidate review, not a durable selection. The isolated replay
advanced to tree `80a097ecc4b127d953cce97c871aa741d11cbe30` after a
target-native server fixup: forced model-catalog refreshes now retain upstream's
bounded error detail, a removed OpenAI runtime-config property is not
reintroduced, and the test reads the current provider fallback declaration.
Server typecheck and all 21 affected catalog tests pass. Its earlier sidebar
test-only fixup and this server fixup must be folded into their logical patches
before export. The normal fork locks and running host remain unchanged. SDK
declarations/runtime build, Provider Codex 340/340, full workspace typecheck
(99/99 tasks), and full build (60/60 tasks) pass. Full test inventory,
direct-plugin compatibility, and host-database-copy migration checks remain
acceptance gates.
