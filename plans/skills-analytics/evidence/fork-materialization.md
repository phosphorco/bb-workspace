# Fork skill-observation patch materialization

## Source receipt

- Upstream base: `267938526dfcbc0edb228ce827b5bec202c1af97`.
- Prior materialized queue commit: `3ca518dd2fd73e2e6011a5b0fc77525aff1e5919`.
- Prior result tree: `036bb9f48f606260634f64cd3385d522a8175232`.
- Result tree with the reviewed skill snapshot: `bfacd151959096718616ca80061c6b8de1fb715b`.

## Durable entry

`0022-feat-skills-observe-runtime-and-provider-lifecycle.patch` is appended
after the existing twenty-one patches. Its SHA-256 is
`b3691737520df2eaa3ffa8b14ec663b120721b362470b16dafad3da9ecbe1360`.
It contains the reviewed 29 tracked and five untracked runtime/provider skill
observation paths, exported from the dirty canonical upstream checkout without
modifying it.

## Checkpoint method

The registered disposable worktree
`/tmp/skills-fork-patch-materialization.RkgAcj/bb` began clean at the prior
receipt. The canonical tracked diff and each of the five known untracked files
were snapshotted separately, inspected, and applied only to that worktree.
The combined tree passed `git diff --check`. A temporary index and object store
inside the same checkpoint produced the binary full-index mail patch and result
tree; no canonical worktree, upstream index, or `fork/build/bb` file was edited.

## Verification status

The exact Workbench oracle is:

```sh
./fork/scripts/verify && node community-plugins/plugins/analytics/test/skills/acceptance.mjs --suite fork-materialization --timeout-ms 120000 --total-timeout-ms 300000
```

After granting the verifier permission to create its disposable Git worktree
metadata, the complete oracle passed. `scripts/verify` replayed all 22 patches
to `bfacd151959096718616ca80061c6b8de1fb715b`; the Analytics acceptance suite
independently matched the ordered queue entry, exact patch checksum, result-tree
receipt, and downstream documentation. Workbench recorded passing evidence as
`sha256:f5be116c7e4e454a6a965ea9e35efd67f8a762736cf5fa6e596ac3f7ed8de1f2`.
