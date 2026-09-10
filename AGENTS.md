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

## Staging and normal roles

### Temporary same-machine fork proof (Cole, 2026-09-05)

Cole explicitly selected Rosetta on separate ports for the new fork's temporary
proof. For this task only, `fork/build/proof-bb` is an authorized visible candidate
worktree alongside the existing normal `fork/build/bb`. Use server/daemon/dev-UI
ports 39886/39887/39888 and separate proof state; follow
`fork/plans/bb-fork-local-proof.md`. This scoped exception permits candidate edits,
builds and proof runs there without moving the dirty normal or upstream trees.
It does not select another default runtime, change machine roles, or authorize
normal-host promotion. The remaining preservation and promotion rules still apply.

`bb-machine` is the staging workspace. Its three top-level child repositories
are ordinary editable checkouts, normally on `main`; dirty changes and feature
branches are allowed and must remain visible in `bin/status`. Build and reload
there before promotion. Staging does not claim `svc:bb` while Rosetta is normal.

The normal host checks out an exact committed `bb-workspace` revision. Its
top-level submodule HEADs must equal that workspace commit's gitlinks. A dirty
tree must be reported, never erased. Normal remains available while staging is
being edited or broken.

Promotion means: verify the staging behavior, commit and push every selected
child change, update the three workspace gitlinks to the tested commits, commit
and push this repository, then advance the single normal-host workspace pin in
`rosetta-machine`.

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

Run the checks relevant to every changed child before handoff.

- Workspace composition: `./bin/check --role staging` or
  `./bin/check --role normal`
- Fork: follow `fork/README.md`; verify and materialize through its scripts,
  then run the BB install, typecheck, test, and build commands in
  `fork/build/bb/`.
- Organization plugins: from `plugins/`, run `bun install --frozen-lockfile`,
  then the sync, references, SDK types, typecheck, test, and build checks in its
  `AGENTS.md`.
- Community plugins: from `community-plugins/`, run `npm ci`, `npm run test`,
  `npm run typecheck`, and `npm run build`.

Do not advance this repository's gitlinks until the exact selected child
commits have been pushed and the combined staging runtime has been exercised.
