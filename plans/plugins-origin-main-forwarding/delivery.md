# Delivery receipt — pending runtime qualification

## Delivered source integration

- Preservation commit: `e1247f9 feat(plugins): preserve local integration work before upstream merge`
- Merge commit: `2e4c96b merge: reconcile origin/main plugin updates`
- Follow-up fix: `af9834a fix(subscription-router): use public plugin SDK import`
- `origin/main` is an ancestor of the merge commit.
- `bun run sync:check` passes.

The merge adopts origin/main's shared public SDK/generator model, removes the
obsolete copied plugin SDK declarations, retains the local Router/thread feature
work, adopts current upstream Agent Connect and Rosetta conflict resolutions,
and preserves the local retirements of Sticky Notes plus upstream-retired
organization plugins. The generator definition, rather than generated manifests
or declaration copies, is the source of truth.

The follow-up corrects the malformed `@bb-bb-bb/plugin-sdk/app` import in the
Router entrypoint to the public `@get-bb/plugin-sdk/app` specifier. It was found
by the independent delivery review and committed locally; it does not remove
the SDK archive or compatible-runtime qualification requirement.

## Current operational state

Subscription Router remains enabled and reports `running` from the canonical
path `path:/home/ubuntu/bb/plugins/plugins/subscription-router`. Its loaded app
bundle is still SDK `0.4.15`; this is the already-running generation, not a
post-merge build/reload receipt.

## Blocking qualification

`bun run sdk-types:check` fails because the merged source requires
`get-bb-plugin-sdk-0.4.47+phosphor.c30b12255a7f.sdk.a4652a585b5c.tgz`, but that
archive is absent from `/home/ubuntu/bb/sdk-artifacts`; installed resolution
remains `0.4.15`. Consequently, identity typecheck/test and a safe post-merge
Router build/reload are not yet valid. The existing Router generation was left
running rather than reloading an unqualified build.

## Explicitly not performed

No child commit was pushed. The workspace gitlink was not updated. No normal
host promotion, production cutover, or live Usage acceptance was attempted.

## Release condition

Provision the exact shared SDK artifact with its expected digest, run dependency
resolution, pass `sdk-types:check` plus bb-identity and relevant plugin tests,
then build/reload Subscription Router and prove its canonical source path and
Usage lifecycle. Only after that evidence should the delivery/review and any
separate promotion decision be completed.
