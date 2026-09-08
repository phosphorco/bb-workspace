# Unpublished plugin work port

Cole requested committing the authored work that can translate into the
`bb-service` packages. The source inventory records SHA-256 values for all 351
changed/untracked paths observed in the old `/home/ubuntu/bb` plugin checkouts.
Those source checkouts and normal runtime state remain unchanged.

The organization destination starts at `4ecd8b0` (including the already-published
Thread Manager preflight change); the community destination starts at `9ec81c2`.
Three-way source selection preserves the current SDK packages and recent fixes.

## Selected features

- Organization: Diffs repository discovery and composer summaries; Thread Manager
  execution filtering and bulk changes; Subscription Router recovery, account-home
  preservation and diagnostics; Background Jobs lifecycle cleanup; BTW reopening;
  simpler Thread Links; Future Threads polish; Thread Progress section repair;
  Agent Connect URL feedback and historical author presentation.
- Community: Analytics dashboards, validation, chart references and exports;
  Machine Monitor disk accounting and attachments; the new Cross References
  package; Sticky Notes citations; Agentation Mentions captured-author attribution;
  package collection and release wiring.
- Analytics' existing architectural contracts, discovery instruments and future
  acceptance scaffolding are preserved as authored source. Their documentation
  distinguishes implemented runtime checks from unbound future architecture
  suites; carrying the instruments does not claim that the proposed full-history
  backend is delivered.

## Integration choices

- Keep `@get-bb/plugin-sdk` package imports and generated organization manifests.
  Do not restore copied declarations, old path aliases, or retired plugins.
- Keep current Agent Connect durable calls, stream handling, request cleanup and
  configured public URLs. Resolve historical author presentation through the
  shared identity provenance reader, only for one complete contribution.
- Use `UrlLink`/`openUrl` on SDK 0.4.47. Cross References uses a native anchor
  with `openUrl`, because the pinned public CLI omits the declared `UrlLink`
  export from its build shim. Modified clicks retain native browser behavior.
  Forks reuse their source environment via
  the supported SDK. Preserve the host's `pending` state in BTW results.
- Thread Manager uses public environment/host catalog routing and refuses a bare
  workspace path without an environment. It accepts either per-thread or newer
  aggregate change events. The preview core still emits per-thread events.
- Keep identity-aware organization Sticky Notes. Its deletion in the older
  checkout is not a portable feature change; community citation work is retained
  independently. Perspectives' current community package supersedes the old
  duplicate changes.
- Package the unpublished identity library as an ordinary, hash-pinned local
  archive in `sdk-artifacts`, with a provenance receipt. The community package
  consumes that archive through npm, following the existing preview SDK layout.
  This is source delivery for the preview, not a registry release. A standalone
  child checkout needs the declared sibling archive directory.
- Analytics ships its isolated worker and parameter bridge in `query-runtime/`;
  the worker resolves from both source and the bundled server. Raw DuckDB errors
  remain redacted; verification tests check valid/invalid argument types across
  the real worker boundary.

## Verification

The Pkl plan and append-only ledger own task/evidence state. `validate.py` runs
each repository's required checks and saves command receipts and local logs.
It pins Node 22.21.1 for both native-addon installation and test/build execution,
independent of changes to the host's global mise selection.

`thread-manager-factory.mjs` runs the authored factory on the public SDK fake
host and checks catalog routing, unsupported-route refusal, RPC schema validation,
duplicate rejection, and preservation of catalog-change rejection results.
Additional runtime, packaging and preview evidence is recorded in `closeout.json`.

The Subscription Router's documented explicit executable setting requires a
separate core patch that is not present in this preview. The plugin's portable
history/retirement/health changes are included; no router installation, account
migration, credential operation or normal-host promotion is performed here.
