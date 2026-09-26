# BB upstream refresh baseline

Cole requested the latest BB core, review of downstream correctness, and a
later separately coordinated host restart. He is considering a smaller fork
in future; this does not authorize silently removing custom behavior.

Target observed from fetched `get-bb/bb` origin/main on 2026-09-22:
`78804e79d280998a3b4c3c965ec1b5845703bc0e`.
Latest fetched versioned release: desktop-v0.43.3,
`e865697f56bea89f3413dd4cc7fae964850d20a0`, 107 commits behind target.
Current upstream pin: `267938526dfcbc0edb228ce827b5bec202c1af97`,
279 commits behind target. Fetch updated origin/main and versioned tags;
moving desktop-latest/nightly tags were rejected and were not overwritten.

Workspace HEAD: 5f025fe0387eefb09353e18a278010237117633e.
Fork HEAD: f3a49bccd0ff3d56a95089ad66a8228578a62940.
Plugins HEAD: 054d555a3750125c0bacf48f93bb733a26adf34c.
Community HEAD: 4677a85e5b09bac9f7451498feaea47c57501378;
workspace records 128a0e632d7fac9d18f4aea6be77a29e0ef37c1c.
All source repositories have authored dirty work. Preserve it. Current fork
queue includes uncommitted patches 24–28, all part of this replay review,
not automatic approval for removing their behavior or host activation.

Pre-refresh artifact patch 0028 checksum:
b6a5f24ed81de6393a3b439b9267f9574f3581f4e6e2c91c8a281afb91e22ca9.
Pre-refresh selected result tree: d482997fe16d6353cad047ad2825d04ccdbf86b7.
Runtime /home/ubuntu/bb/fork/build/bb is clean at
4f2ac0d322712dcf523483a63800a1ee7195699a and must remain untouched.

Only a unique disposable source-authoring/replay worktree may be used for
candidate work. It is not a deployment/plugin source. Preserve an exact
preimage of the current patch queue/locks before replacing them.
Parent owns upstream submodule movement, final checks and publication.
Children use existing Codex Terra/high/fast BB threads and explicit messages;
never use bb wait or poll completion. Root is sole plan-ledger writer.

Analytics remains disabled. No reload, restart, live DB migration, or host
promotion is authorized during this preparation phase.

## 2026-09-24 refresh target

Cole reconfirmed that latest upstream BB is the goal and asked to rebase and
check our work for errors. `git ls-remote origin refs/heads/main` in
`fork/upstream` returned `fdd3de3b19b97e6cd1ef7300cbb54711431249d3`.
That commit is present locally as `origin/main`, 110 commits ahead of the
currently selected upstream `78804e79d280998a3b4c3c965ec1b5845703bc0e`.
This dated observation supersedes the older target above; it is not a moving
branch promise. Recheck remote main before final selection.

`./bin/status` reports dirty workspace, fork, plugin, and community-plugin
repositories. The fork has 32 downstream patches, including the single
combined Tailnet-listener/machine-fallback patch 0034. Its verified selected
tree is `ff7f2f8a76f84883e68d5c503d512d0570cae0f6`. The normal
`fork/build/bb` checkout is separately dirty and must not be reset, cleaned,
or used as the replay authoring tree. The approved identity behavior is stable
machine attribution when person evidence is absent or unusable; otherwise
valid requests must not be denied solely for that reason. Analytics remains
disabled. This refresh authorizes isolated source replay and verification,
not live materialization, migration, restart, or publication yet.
