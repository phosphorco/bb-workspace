# BB workspace contract

This repository is the canonical composition and working root for Phosphor's
BB fork and plugins. The child directories are real source repositories held
as Git submodules; this repository contains no duplicate BB source.

## Topology

- `fork/` is `phosphorco/bb-fork`, including its pinned `upstream/` submodule
  and its in-place runnable materialization at `build/bb/`.
- `plugins/` is `phosphorco/bb-plugins`.
- `community-plugins/` is `phosphorco/bb-community-plugins`.
- `bin/` contains workspace-only inspection and safe setup commands.

On a BB host this repository must be cloned at `/home/ubuntu/bb` (`~/bb` for
the `ubuntu` user). The default BB service and CLI run from
`~/bb/fork/build/bb`; direct-loaded plugins resolve only from
`~/bb/plugins/plugins/` or `~/bb/community-plugins/plugins/`.

## Fork changes are a last resort

Deliver features through native BB and plugins, not the fork. Use
`plugins/` or `community-plugins/` with the public Plugin SDK, existing
surfaces (composer banners, panel and header actions, Sticky-Notes-style
anchored overlays, thread storage, host watchers, plugin storage), and shared
packages such as `bb-identity`. Prefer a slightly worse design, such as an
overlay instead of a reflowed layout or a documented DOM dependency, to a
fork patch.

Do not plan, propose, or write a change to `fork/` (or its materialized
`build/bb`) unless the plan proves that **no usable experience at all** is
possible without it. The justification must name the missing capability, show
why each native/plugin alternative cannot work at all (not just less well),
give the smallest patch and its upstream-sync cost, and obtain Cole's explicit
approval before implementation. "Cleaner", "more robust", "better UX", or
"first-class slot" do not qualify. See [fork/README.md](fork/README.md#fork-changes-are-a-last-resort).

## Non-negotiable invariants

- BB is edited, built, tested, and supported in place inside this workspace.
- Do not create a second deployment checkout, revision-named source directory,
  hidden plugin copy, or alternate default runtime source.
- Treat dirty child repositories as authored work. Never automatically stash,
  reset, clean, discard, relocate, or overwrite it.
- Never run `git submodule update`, switch branches, or move a child HEAD until
  its status and current commit have been inspected. `bin/setup-role` refuses
  dirty children, refuses to move an initialized normal child, and advances an
  initialized staging child only when it is already on `main` and can
  fast-forward.
- A workspace commit is a promotion receipt: its three gitlinks identify one
  tested BB composition. Commit and push child changes first, then advance the
  corresponding gitlink here.
- Machine role and ingress policy belong in `rosetta-machine`, not in workspace
  branches or generated files.
- `fork/build/bb` is materialized output owned by `bb-fork` tooling. Do not make
  it a fourth submodule or replace the visible path with a hidden deployment.
- Keep `~/.bb/` as operator-owned runtime state. It is not source and must not
  be committed here.

## Deployment roles

### Temporary same-machine fork proof (Cole, 2026-09-05)

Cole explicitly selected Rosetta on separate ports for the new fork's temporary
proof. For this task only, `fork/build/proof-bb` is an authorized visible candidate
worktree alongside the existing normal `fork/build/bb`. Use server/daemon/dev-UI
ports 39886/39887/39888 and separate proof state; follow
`fork/plans/bb-fork-local-proof.md`. This scoped exception permits candidate edits,
builds and proof runs there without moving the dirty normal or upstream trees.
It does not select another default runtime, change machine roles, or authorize
normal-host promotion. The remaining preservation and promotion rules still apply.

`bb-machine` is an independent normal deployment on the evolving workspace
`main` branch. Its canonical workspace remains directly editable, dirty state
must remain visible in `bin/status`, and its dedicated ingress is
`svc:bb-next`. It does not claim or modify Rosetta's `svc:bb` deployment.

A frozen normal host instead checks out an exact committed `bb-workspace`
revision. Its top-level submodule HEADs must equal that workspace commit's
gitlinks. A dirty tree must be reported, never erased.

For either model, verify the combined behavior, commit and push every selected
child change, then update and push the three workspace gitlinks. Evolving hosts
advance their declared branch; only explicitly frozen hosts advance a
`MACHINE_BB_WORKSPACE_REV` pin in `rosetta-machine`.

## Agent working directory

Start Codex and other repository-aware agents from the workspace root, for
example `codex --cd ~/bb`. This root file owns cross-repository policy. Child
`AGENTS.md` files add repository-specific rules, but starting inside a child
Git root may omit this parent contract.

Before changing anything, run `./bin/status`. Keep a cross-repository task in
one workspace and identify which child repositories it touches. Do not use
unrelated worktrees as runtime or plugin sources.

Shared repository skills live under `.agents/skills/<name>/SKILL.md` so Codex
and other skill-aware agents discover the same guidance. Reserve provider-
specific directories such as `.codex/` for guidance that cannot be shared.

For identity-aware plugin work, start with the progressive
[bb-identity skill](.agents/skills/bb-identity/SKILL.md). It routes to public
package contracts, task-specific recipes and current verification limits. Use
the shared package for identity/synchronization; keep product schemas and storage
with the feature.

## Build caches and temporary verification

Keep Go's shared build and module caches warm for ordinary builds. A different
worktree or thread does not by itself require a private `GOCACHE` or `GOMODCACHE`.
If a test needs cache isolation, keep its source and proof logs separately and
retire the exact generated cache directories when the harness finishes, including
failure and cancellation paths. Do not use repeated shared-cache clearing as
routine disk maintenance. The disk-usage skill covers native expiration and
safe scratch retirement.

## Verification

Analytics work must follow the accepted
[performance isolation ADR](docs/adrs/2026-09-analytics-performance-isolation.md).
Ordinary analytical additions are declarative: no feature-owned host scans,
lifecycle collectors, cache/refresh loops, database handles, worker pools, or
eager frontend dependencies. Transitional containment is not proof of complete
isolation; preserve and disclose freshness/coverage limitations.

Run the checks relevant to every changed child before handoff.

- Workspace composition: `./bin/check --role normal` on `bb-machine`; use
  `--role staging` only on a host explicitly assigned that role
- Fork: follow `fork/README.md`; verify and materialize through its scripts,
  then run the BB install, typecheck, test, and build commands in
  `fork/build/bb/`.
- Organization plugins: from `plugins/`, run `bun install --frozen-lockfile`,
  then the sync, references, SDK types, typecheck, test, and build checks in its
  `AGENTS.md`.
- Community plugins: from `community-plugins/`, run `npm ci`, `npm run test`,
  `npm run typecheck`, and `npm run build`.

Do not advance this repository's gitlinks until the exact selected child
commits have been pushed and the combined runtime has been exercised.

## Authorized implementation checkout on Rosetta

Cole selected `/home/ubuntu/bb-service` as the implementation home for the
current identity campaign and its isolated preview. Work there in place and
preserve the existing `/home/ubuntu/bb` source, `bb.service`, `svc:bb`, proof
runtime, and normal credentials. The preview uses only its existing ports and
`/home/ubuntu/.local/share/bb-service-preview` state. This explicit local
exception does not change the canonical path or deployment policy on
`bb-machine`; deploying a normal host is a separate action.
