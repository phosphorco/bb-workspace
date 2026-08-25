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
  its status and current commit have been inspected. `bin/setup-role` is safe
  only because it refuses dirty or divergent initialized children.
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
