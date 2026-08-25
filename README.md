# bb-workspace

`bb-workspace` is the one visible working tree for Phosphor's BB fork and both
plugin collections. It is a thin private superproject: the three source trees
are Git submodules, and a commit here records one promotable composition.

## Clone a host workspace

Authenticate the host for the private Phosphor repositories, then clone only to
the canonical path:

```sh
git clone https://github.com/phosphorco/bb-workspace.git ~/bb
cd ~/bb
./bin/setup-role --staging   # bb-machine
# or: ./bin/setup-role --normal
```

`setup-role` refuses dirty children. Normal setup also refuses to move an
already initialized child away from its current commit. Staging setup refuses
an initialized child that is not already on `main`, and only fast-forwards
`main`. The command is intended to make a fresh clone match its role safely.

Run `./bin/status` before editing. Run `./bin/check --role staging` on
`bb-machine`, or `./bin/check --role normal` on the normal host. Add `--runtime`
once `fork/build/bb` has been materialized to verify the visible runtime path.

## Layout

```text
~/bb/
├── AGENTS.md
├── bin/
├── fork/                 phosphorco/bb-fork
│   ├── upstream/         fork's pinned upstream submodule
│   └── build/bb/         visible runnable materialization
├── plugins/              phosphorco/bb-plugins
└── community-plugins/    phosphorco/bb-community-plugins
```

The BB service must run from `~/bb/fork/build/bb`. Direct-loaded plugin source
must come from the two visible plugin directories above. There is no supported
hidden deployment tree.

## Edit and promote

Staging is an authored workspace: edit the child repositories directly, build
and reload in place, and allow dirty state to remain obvious. Normal is selected
by one `bb-workspace` commit in `rosetta-machine`.

For a promotion:

1. Verify the combined behavior on staging.
2. Commit and push each selected child repository change.
3. From this root, stage the updated child gitlinks and commit the composition.
4. Push the workspace commit.
5. Advance the single `MACHINE_BB_WORKSPACE_REV` normal-host pin in
   `rosetta-machine` and deploy through its runbook.

Read `AGENTS.md` before operating across repositories. Launch repository-aware
agents from this root so the cross-repository constraints are in scope.
