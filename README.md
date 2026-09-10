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
./bin/setup-role --normal    # bb-machine and frozen normal hosts
# or: ./bin/setup-role --staging
```

`setup-role` refuses dirty children. Normal setup also refuses to move an
already initialized child away from its current commit. Staging setup refuses
an initialized child that is not already on `main`, and only fast-forwards
`main`. The command is intended to make a fresh clone match its role safely.

Run `./bin/status` before editing. Run `./bin/check --role normal` on
`bb-machine`; use `--role staging` only on an explicitly assigned staging host.
Add `--runtime` once `fork/build/bb` has been materialized to verify the visible
runtime path.

## Layout

```text
~/bb/
├── AGENTS.md
├── bin/
├── docs/                 cross-repository programs and operating records
├── .agents/skills/       workspace-specific reusable agent guidance
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

The `bb-machine` normal deployment follows the evolving workspace `main`
branch, is edited and rebuilt in place, and publishes only `svc:bb-next`.
Rosetta's separate `svc:bb` deployment is unaffected. Frozen normal hosts are
selected by one `bb-workspace` commit in `rosetta-machine`.

For a promotion:

1. Verify the combined behavior on the selected deployment host.
2. Commit and push each selected child repository change.
3. From this root, stage the updated child gitlinks and commit the composition.
4. Push the workspace commit.
5. Deploy the evolving branch, or advance `MACHINE_BB_WORKSPACE_REV` only for
   an explicitly frozen host, through the `rosetta-machine` runbook.

Read `AGENTS.md` before operating across repositories. Launch repository-aware
agents from this root so the cross-repository constraints are in scope.

## Plugin authoring guidance

The [bb-identity skill](.agents/skills/bb-identity/SKILL.md) is the entry point for
portable request identity, personal state, view-as, providers and external
contributions. Its short task map loads only the relevant reference; package
[STATUS](plugins/packages/bb-identity/STATUS.md) separates implemented interfaces
from remaining feature and host proof. Other shared guidance lives under
`.agents/skills/`.
The [identity experience plan](plans/identity-experience/README.md) records the
remaining campaign and its ownership. The [selected-source closeout](preview/main-closeout/README.md)
links the tested composition, repair evidence, and isolated runtime checks;
those checks do not claim a deployment on another host.
