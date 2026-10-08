# Publication and proof

## Where the package lives

- Source: `community-plugins/packages/<name>`, an npm workspace listed before
  `plugins/*` so libraries build first (`community-plugins/AGENTS.md`).
- Registry: npm as `@phosphorco/<name>`, released by the community repository's
  release workflow. Organization plugins consume the published version
  (`plugins` commit `7d9ec55` moved bb-identity and bb-provider-settings this
  way).
- Consumers pin an exact registry version. In community-plugins npm links it to
  the local workspace; elsewhere it resolves from the registry. Never `file:`,
  `link:` or tarball specifiers; BB Git installs run `npm install --omit=dev`.
- Runtime imports belong in `dependencies`; React and the SDK are optional
  peers; Zod is a dependency.
- Keep `exports` and peer ranges stable within a version. A changed public
  contract is a new package version; a changed wire meaning is a new protocol
  version or method name.

`@phosphorco/bb-brief-references` (in `plugins/packages`, never published) is
superseded by `@phosphorco/bb-context-recognition` and is retired when Thread
Brief adopts the new package.

## Build

Emit every public entry with Bun.build (automatic JSX runtime, production
define), then declarations with `tsc`. Never bundle React, React DOM, jsdom or
the SDK. Testing entries import sibling public entries as externals so a
consumer's kit and production code share one module instance
(`bb-provider-settings/PACKAGING.md`). Never commit `dist/`.

## Adopting the contract in a plugin

1. Add the exact registry pin; regenerate the lock (`npm ci` or
   `bun install --frozen-lockfile` per repository).
2. Register handlers in the plugin's server with the package's register helper.
   Keep storage, policy and source access in the plugin.
3. Add the conformance kit to the plugin's own tests, driving the real
   registered handlers through `createFakePluginHost`.
4. Run the repository checks named in its `AGENTS.md`.
5. Prove the composition on a running host, then record which proof you have.

## Proof levels

| Level | Shows | Does not show |
| --- | --- | --- |
| Package tests | Schemas, codecs, clients and kit behave on emitted entries | Any adopter is correct |
| Adopter conformance | That plugin's real handlers meet the contract | Host discovery, loading, network or UI |
| Host tests | Discovery, isolation and rendering with fakes | A real supplier loaded by BB |
| Live machine proof | The composition on a running BB | Other hosts or versions |

Name the level in every completion claim.
