# Identity forward preflight

Audit basis: integrated `/home/ubuntu/bb/plugins` at `af9834a` (clean), with
`origin/main` at `c69595b`. This receipt is static inspection only. No
dependency install, source edit, build, reload, push, or ledger write was
performed.

## Public boundaries — static result

The shared package exposes the intended public boundary. Its package exports
the root and explicit `model`, `host`, `server`, `testing`, `state`, `bb`,
`client`, and `react` subpaths ([`packages/bb-identity/package.json:24`](/home/ubuntu/bb/plugins/packages/bb-identity/package.json:24)). Its public BB binding imports only the public `@get-bb/plugin-sdk` package ([`bb.d.ts:5`](/home/ubuntu/bb/plugins/packages/bb-identity/bb.d.ts:5)), narrows the supplied `BbPluginApi` to `BbIdentityApi` ([`bb.d.ts:27`](/home/ubuntu/bb/plugins/packages/bb-identity/bb.d.ts:27)), admits an interactive person only through `BbInvocation.person()` ([`bb.d.ts:38`](/home/ubuntu/bb/plugins/packages/bb-identity/bb.d.ts:38)), and owns RPC/HTTP/state/provider lifecycle through `BbIdentityBinding` ([`bb.d.ts:89`](/home/ubuntu/bb/plugins/packages/bb-identity/bb.d.ts:89)).

The browser contract is also public-package based: `IdentityStateBinding`
owns edit/flush/reconnect/recovery/conflict operations
([`client.d.ts:102`](/home/ubuntu/bb/plugins/packages/bb-identity/client.d.ts:102)),
and React consumers acquire it through `useIdentityStateBinding`
([`react.d.ts:109`](/home/ubuntu/bb/plugins/packages/bb-identity/react.d.ts:109)).
The affected consumers declare `@phosphorco/bb-identity: workspace:*` in
their generated manifests, including Agent Connect, Agentation, Identity
Boundaries, Notifications, ntfy, Rosetta Slack, and Thread Progress (for
example [`thread-progress/package.json:53`](/home/ubuntu/bb/plugins/plugins/thread-progress/package.json:53)).

No tracked copied SDK declarations remain (`git ls-files` found zero
`types/bb-plugin-sdk*.d.ts` files), and affected generated `tsconfig.json`
files contain only the local `@/*` alias; they do not path-map either SDK
package ([`thread-progress/tsconfig.json:12`](/home/ubuntu/bb/plugins/plugins/thread-progress/tsconfig.json:12)).

## Static source findings

### Must repair before qualification: malformed SDK imports

The integrated tree still contains actual source/test imports using malformed
package names instead of `@get-bb/plugin-sdk`:

- `@bb-bb-bb/plugin-sdk/app`: Thread Links app ([`thread-links/app.tsx:8`](/home/ubuntu/bb/plugins/plugins/thread-links/app.tsx:8)), BTW app ([`btw/app.tsx:20`](/home/ubuntu/bb/plugins/plugins/btw/app.tsx:20)), Thread Manager dialog ([`thread-manager/execution-change-dialog.tsx:3`](/home/ubuntu/bb/plugins/plugins/thread-manager/execution-change-dialog.tsx:3)), and the matching Thread Manager test mock ([`thread-manager/test/execution-change-dialog.test.tsx:34`](/home/ubuntu/bb/plugins/plugins/thread-manager/test/execution-change-dialog.test.tsx:34)).
- `@bb-bb/plugin-sdk`: BTW server ([`btw/server.ts:1`](/home/ubuntu/bb/plugins/plugins/btw/server.ts:1)), Thread Progress server ([`thread-progress/server.ts:1`](/home/ubuntu/bb/plugins/plugins/thread-progress/server.ts:1)), Thread Manager server ([`thread-manager/server.ts:1`](/home/ubuntu/bb/plugins/plugins/thread-manager/server.ts:1)), and the Thread Progress public-contract witness ([`thread-progress/test/bb-identity-public-contract.compile.ts:6`](/home/ubuntu/bb/plugins/plugins/thread-progress/test/bb-identity-public-contract.compile.ts:6)).

The Thread Peek README still documents copied declarations and the malformed
`@bb-bb/plugin-sdk` alias ([`thread-peek/README.md:100`](/home/ubuntu/bb/plugins/plugins/thread-peek/README.md:100)). It is stale documentation, not evidence that copied declarations remain.

The SDK checker rejects the exact legacy `@bb/plugin-sdk` spelling and public
SDK path aliases ([`tools/sdk-types/run.mts:67`](/home/ubuntu/bb/plugins/tools/sdk-types/run.mts:67), [`tools/sdk-types/run.mts:97`](/home/ubuntu/bb/plugins/tools/sdk-types/run.mts:97)), but that source scan does not match the malformed `@bb-bb*` spellings above. These are therefore independent source defects, not consequences of the missing archive.

### Feature-local identity synchronization

`thread-progress/lib/identity-state-sync.ts` retains a complete local
revision synchronizer: it keys events by `ownerPrincipalKey`, accepts local
`load`/`save` callbacks, and exposes `start`, `edit`, `remoteChanged`,
`reconnect`, `flush`, and `dispose` ([`identity-state-sync.ts:15`](/home/ubuntu/bb/plugins/plugins/thread-progress/lib/identity-state-sync.ts:15), [`identity-state-sync.ts:29`](/home/ubuntu/bb/plugins/plugins/thread-progress/lib/identity-state-sync.ts:29), [`identity-state-sync.ts:43`](/home/ubuntu/bb/plugins/plugins/thread-progress/lib/identity-state-sync.ts:43)). Its tests still instantiate it ([`identity-state-sync.test.ts:4`](/home/ubuntu/bb/plugins/plugins/thread-progress/test/identity-state-sync.test.ts:4)). This duplicates the shared `IdentityStateBinding` responsibility and must not be reattached to production UI or used as a qualification workaround.

The current production Thread Progress path is already on the shared package:
the component imports `BbIdentity`, `useIdentityStateBinding`, and
`useIdentityStateSnapshot` ([`thread-sections-identity-state.tsx:8`](/home/ubuntu/bb/plugins/plugins/thread-progress/components/thread-sections-identity-state.tsx:8)), creates the binding through `useIdentityStateBinding` ([`thread-sections-identity-state.tsx:311`](/home/ubuntu/bb/plugins/plugins/thread-progress/components/thread-sections-identity-state.tsx:311)), and the server registers the resource through `identity.value.state.register` with self-only writes and collaborator reads ([`thread-progress/server.ts:670`](/home/ubuntu/bb/plugins/plugins/thread-progress/server.ts:670)). The local synchronizer has no production import in the current source census; it is a residual helper/test seam, not an active runtime path.

The sidebar also has an identity-keyed `LatestSidebarViewStateWriter`
([`progress-inbox.tsx:855`](/home/ubuntu/bb/plugins/plugins/thread-progress/components/progress-inbox.tsx:855)). Its surrounding code explicitly scopes it to legacy sidebar presentation and keeps Thread Sections ownership/view selection package-issued ([`progress-inbox.tsx:821`](/home/ubuntu/bb/plugins/plugins/thread-progress/components/progress-inbox.tsx:821)); this is feature presentation state, not an alternate authority or Thread Sections state synchronizer.

## Separate external SDK archive blocker

The generator pins the required fork artifact to
`get-bb-plugin-sdk-0.4.47+phosphor.c30b12255a7f.sdk.a4652a585b5c.tgz` and
SHA-256 `79ef00173ebb3ffa1c7f9bd9a4e20eeae3f00915aa0b645db8ea328e6b988599`
([`definition.ts:4`](/home/ubuntu/bb/plugins/tools/workspaces-sync/definition.ts:4)). The checker requires that archive and hash before checking each generated manifest's exact file pin, resolved package version, TypeScript resolution, and browser fixture ([`run.mts:113`](/home/ubuntu/bb/plugins/tools/sdk-types/run.mts:113), [`run.mts:121`](/home/ubuntu/bb/plugins/tools/sdk-types/run.mts:121), [`run.mts:135`](/home/ubuntu/bb/plugins/tools/sdk-types/run.mts:135)).

That archive is absent at
`/home/ubuntu/bb/sdk-artifacts/get-bb-plugin-sdk-0.4.47+phosphor.c30b12255a7f.sdk.a4652a585b5c.tgz`. The installed package currently resolves to `@get-bb/plugin-sdk` `0.4.15` ([`node_modules/@get-bb/plugin-sdk/package.json:2`](/home/ubuntu/bb/plugins/node_modules/@get-bb/plugin-sdk/package.json:2), [`:3`](/home/ubuntu/bb/plugins/node_modules/@get-bb/plugin-sdk/package.json:3)), not the pinned fork version. This is an artifact/dependency qualification blocker and must remain separate from the malformed source imports above; installing or substituting another SDK was not attempted.

## Exact next qualification command

After the malformed imports/docs are corrected and the exact pinned archive is
provisioned, run from `/home/ubuntu/bb`:

```sh
bun --cwd plugins run sync:check && bun --cwd plugins run sdk-types:check && bun --cwd plugins run --filter '@phosphorco/bb-identity' typecheck
```

This preflight did not run that qualification command. The node proof to run
after this file is written is:

```sh
test -s plans/plugins-origin-main-forwarding/identity-preflight.md
```
