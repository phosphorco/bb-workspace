---
name: bb-plugin-contracts
description: Design, publish, adopt, or review a shared contract package that lets independently installed BB plugins supply data or behavior to a surface another plugin owns (providers, suppliers, contributors, registrants). Use for cross-plugin extension points such as provider-settings roles or Thread Brief reference suppliers; skip for logic shared only inside one plugin.
---

# Connect independent plugins through a published contract

When one plugin owns a surface and other plugins should be able to contribute
to it, do not import plugins into each other, add a fork slot, or share a
runtime singleton. Publish a small **contract package**: versioned data shapes,
a fixed RPC protocol, client and registration helpers, optional shared controls,
and a conformance kit. Each plugin bundles the package and talks to the others
only through RPC calls over the public SDK.

Two working instances, read them before designing a third:

| Instance | Host surface | Suppliers | Read |
| --- | --- | --- | --- |
| `@phosphorco/bb-provider-settings` | central "Role models" settings page plus each owner's local controls | plugins owning agent roles (Rosetta Slack, Perspectives, GitHub Review, Thread Progress, BTW, Sticky Notes) | [CONTRACT.md](../../../community-plugins/packages/bb-provider-settings/CONTRACT.md) |
| `@phosphorco/bb-context-recognition` (design accepted, not yet published) | any text surface; Thread Brief first | plugins that linkify mentions and/or resolve identities into cards (GitHub Review, Plan Graph) | [CONTRACT.md](../../../community-plugins/packages/bb-context-recognition/CONTRACT.md) |

For the raw transport (`bb.rpc.register`, `sdk.plugins.callRpc`, what BB does
not offer), see the plugins repository's `plugin-to-plugin-communication`
skill (`plugins/.claude/skills/plugin-to-plugin-communication/SKILL.md`). This
skill covers the layer above it: one published contract, many suppliers.

Use the [design checklist](references/checklist.md) when authoring or reviewing
a contract, and [publication and proof](references/publication-and-proof.md)
when releasing it or adopting it in a plugin.

## Decide the ownership first

Write the ownership table before any code. It is the contract's first section.

| Feature/supplier owns | Contract package owns | Host surface owns |
| --- | --- | --- |
| Its storage, keys, migrations | DTOs, codecs, bounds (Zod) | Discovery schedule and budgets |
| Its policy, routing, scheduling | Pure functions over explicit inputs | Rendering and layout |
| Which items it offers, and when | Fixed RPC names, describe envelope, version negotiation | Merging, ordering, dedup, caching |
| Its own failure semantics | Registration and owner-bound client helpers | Per-supplier error presentation |
| | Error classification, conformance kit | |

The package is not a store, registry, permission system or rule engine. If a
duty appears in two columns, the design is not finished.

## Rules that apply to every contract

- **Data by default; components through a registry.** Suppliers return
  bounded, schema-validated data (labels, Markdown excerpts, safe hrefs, typed
  targets) that every consumer can render. When the supplier's own UI is the
  point (a plan graph inside a brief), it may also pass a real React
  component: BB shares one React runtime across plugin bundles. Use the
  `bb-context-recognition` presentation registry (`design/presentation-registry.md`):
  - register from a content script, so the host disposes the registration on reload;
  - the resolution names the schema, and the consumer renders only the
    registration from the plugin that resolved it;
  - hosted components get owner-bound clients as props and never use
    slot-scoped hooks, because those follow the hosting slot;
  - each component sits behind an error boundary with the data card as fallback;
  - conformance renders the real component.

  Never mount into another plugin's DOM by scanning for elements.
- **Conventional RPC names, negotiated versions.** A `describe` call returns
  `{protocol, versions|providers, …}` and is parsed tolerantly; the client
  negotiates the highest shared version and decodes details only under it.
  Inputs are strict, outputs tolerate added fields, changed meaning needs a new
  method name. Register with `experimental_discoverable: true` as inert
  metadata; never call `experimental_discoverRpc` (unwired on this fork).
- **Discovery by listing, not configuration.** `sdk.plugins.list()`, then probe
  candidates with bounded concurrency and per-call timeouts. Key results by the
  *target* plugin id. Zero suppliers, 404 `unknown_method`, 503 disabled,
  timeouts and malformed output are normal per-supplier states, never a failure
  of the whole pass. Run discovery on mount, explicit refresh, reconnect or a
  plugin-lifecycle change; never poll.
- **Owner-bound clients.** Call a supplier with
  `sdk.plugins.callRpc({pluginId, method, input, outputSchema, signal})`. Never
  use slot-scoped hooks (`useRpc`, `useSettings`, `experimental_usePluginId`)
  inside shared controls: they resolve to the plugin hosting the slot, not the
  intended owner.
- **Identity is attribution, not authority.** Handlers take explicit input. Do
  not add caller checks to protect against trusted plugins; see the
  [identities ADR](../../../docs/adrs/2026-09-identities-and-multiplayer.md).
- **Separate recognition from presentation when text is involved.** A
  contributed recognition stage (linkify) is fine if it is pure: it sees only
  the text, excluded ranges and a fixed context bundle built by the consumer
  (thread, environment, git remotes/branch, existing links), does no I/O, and
  reports how any inference was made. A second stage turns canonical
  identities into presentation data. Do not limit recognition to literal
  prefixes; do not let recognizers read the machine.
- **Bounded everything.** Publish `LIMITS` (counts, bytes, timeouts, depth) in
  the package; enforce byte caps before parsing; prefer server-side resolution
  so the browser receives one ready model instead of fanning out per viewer.
- **Writes are honest about atomicity.** Fingerprint check-then-write is not
  atomic on native settings. An unknown outcome gets one fresh read reconciled
  by content; never auto-retry or attribute an unconfirmed save.
- **Entries by runtime.** Root entry: Zod only, no React or SDK runtime. `/bb`:
  SDK adapters taking injected `bb`/`sdk`. `/react`: optional peers.
  `/testing`: conformance kit, DOM-free unless `/testing/react`.

## Publish where every plugin can depend on it

Shared contract packages live in `community-plugins/packages/<name>`, publish
to npm as `@phosphorco/<name>`, and are pinned by exact registry version in
every consumer, including organization plugins. Never use `file:`, `link:` or
tarball specifiers. Package version and wire version are separate numbers. See
[publication and proof](references/publication-and-proof.md).

## Prove each side separately

The package tests itself; each supplier proves its integration with the
package's conformance kit against its *real* registered handlers; the host
proves zero, one, failing and multiple suppliers; a live machine run proves the
composition. Source conformance never stands in for host proof. Say which one
you have.

## Learn from adoption

When a supplier cannot express something, record the exact need and witness
before widening the contract. Prefer a new versioned method over loosening an
existing schema. Update the contract document, the conformance kit and this
skill's checklist together.
