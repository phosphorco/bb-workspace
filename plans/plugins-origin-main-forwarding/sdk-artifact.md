# SDK artifact diagnosis and provision

The generator requires `@get-bb/plugin-sdk`
`0.4.47+phosphor.c30b12255a7f.sdk.a4652a585b5c` from
`get-bb-plugin-sdk-0.4.47+phosphor.c30b12255a7f.sdk.a4652a585b5c.tgz`.

The exact archive and its adjacent provenance receipt were found in the tracked
BB diagnostic worktree at source receipt
`c30b12255a7f9f098e7bf9b6d1999410e7956785`. The archive was copied without a
network download or repin to the canonical `sdk-artifacts/` directory only after
confirming its destination did not exist.

Canonical verification:

- SHA-256: `79ef00173ebb3ffa1c7f9bd9a4e20eeae3f00915aa0b645db8ea328e6b988599`
- Size: `545305` bytes
- Provenance receipt: `sdk-artifacts/get-bb-plugin-sdk-0.4.47+phosphor.c30b12255a7f.sdk.a4652a585b5c.tgz.provenance.json`

This provision supplies the selected generator input. It does not establish
dependency resolution, TypeScript compatibility, a Router build, reload, or
host-router adoption; those remain separate plan gates.
