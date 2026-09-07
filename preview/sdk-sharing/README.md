# SDK sharing migration verification

This work is confined to the Cole-authorized `/home/ubuntu/bb-service` preview.
The normal `/home/ubuntu/bb` composition and service are not migration targets.

Baseline declaration inventory: 53 organization plugin files (22,901,184 bytes)
and 11 community plugin files (4,650,265 bytes). The exact original bytes,
including dirty generated preview declarations, are preserved in
`previous-vendored-declarations.tar.gz`; `before.json` records each SHA-256.
The archive SHA-256 is
`2e89fd0bde3bc0fca09068788afc82e92a40514cb76ffb552c9ac9e81d897fda`.

Baseline source trees, reconstructed without changing shared Git indexes:

- Organization plugins: `18f38a13aa94df49075c57430035db1ae96df2c9`
- Community plugins: `076abc34aa37a8266f832b58a82dd6b84059325a`

These baselines retain the already-checked picker/preparation repair and all
generated preview changes. They allow a migration-only diff instead of conflating
this work with the prior user-visible repairs.

`audit.mjs` independently checks each plugin's direct SDK dependency, installed
public exports, exact package version, local archive hash where applicable,
absence of copied SDK declarations, and absence of SDK TypeScript path mappings.
It does not replace consumer typechecks, tests or runtime acceptance.

The selected fork archive and reproducible packing instructions are in
`../../sdk-artifacts/README.md`. Published SDK consumers retain explicit registry
pins. The portable identity package's own declaration entry points are legitimate
public APIs and are not part of the removed copies.

## Final checked state

All 35 plugin leaves resolve public SDK packages: 24 use the shared exact fork
archive, 10 use published 0.4.47, and Machine Monitor retains its 0.4.15 development
contract. Its selected-preview build stamps SDK 0.4.47; this is packaging
compatibility, not a claim that its declared and build targets are equal.

The final organization frozen install, generator/reference/SDK checks, aggregate
typecheck, tests and all 28 builds passed. Tests use an explicit Node 22.19 and
Bun 1.3.14 PATH with SQLite ABI127. The earlier ambient Node26 test failure is
superseded by `org-final-node22-test.log`. Community `npm ci`, aggregate
typecheck/tests and all seven explicit selected-CLI builds passed; see
`community-final-node22.log`. Post-build audits found zero copied SDK declarations.
The six mounted picker browser cases pass; previous picker/preparation source
and the seven core authentication repair files remain preserved.

The migration also corrects exposed stale contracts: Sticky Notes uses issued
identity and validates attention actions at commit; status-label consumers use
`presentation.label` with unchanged labels; Future Threads accepts numeric
settings while still requiring a string license key. Sticky Notes passed 61
tests on Node22, including registered-handler expiry protection, and independent
review. Its existing stored attention/outbox payloads remain unchanged.

Sticky Notes was reloaded successfully in the preview and reports running with
a compatible bundle and no status error. Both service PIDs remain unchanged;
47 preview plugins are running. No new attention message or notification was
sent as a test. This does not attest to every real Tailnet plugin workflow.

`sealed.json` identifies migration-only patches and verified replay trees. The
only deleted source paths are the 64 obsolete SDK copies. Source changes are committed on the review branch recorded in `commits.json`;
the normal composition is unchanged. The shared
archive needs no npm publication. `checks.json` records the bounded evidence.

## Repository receipt

The child commits in `commits.json` were pushed before the workspace gitlinks
were updated. The exact SDK archive and provenance are committed under
`../../sdk-artifacts/`. The fork records the complete core source as ordered
patches through `12-preview-auth-boundary.patch`; its verifier reproduces the
SDK source tree without changing the normal queue.

Logs, screenshots, baseline indexes, the preserved declaration archive and
migration-only patch exports remain local evidence and are excluded from Git.
Their paths above are local receipt references. The durable source is in the
child commits; old tracked declarations remain available in Git history.
