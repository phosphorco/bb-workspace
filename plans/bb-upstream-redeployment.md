# BB upstream redeployment decision

Date: 2026-09-24. Owner: BB workspace deployment on `bb-machine`.

## Identity behavior to preserve

The approved [identities and multiplayer ADR](../docs/adrs/2026-09-identities-and-multiplayer.md)
defines identity resolution as best-effort attribution in a trusted shared host.
Use a verified person when available, applicable carried attribution next, and a
stable machine actor otherwise. Missing, unusable, or unavailable person evidence
must not reject an otherwise valid ordinary browser, CLI, SDK, child-thread,
plugin, or background operation. Invalid evidence must not become a verified
person. Keep existing independent network and plugin credentials and ordinary
operation validation. Do not introduce signing, identity leases, a proxy-person
admission gate, or a new authorization protocol to fix attribution.

The deployed incident came from a verified-person requirement on the dedicated
Tailnet listener. The corrective machine fallback is now part of the same
logical fork patch that introduces the listener. The selected behavior is
machine fallback on both local and Tailnet listeners.

## Current observed state

- The service was active and local `/` responded HTTP 200 on 2026-09-24.
  `/api/v1/system/p6rIdentity` responded HTTP 200 on both local port 38886 and
  dedicated Tailnet port 38888 without person evidence.
- The fork queue has 32 entries. Its result tree remains
  `ff7f2f8a76f84883e68d5c503d512d0570cae0f6` after collapsing the
  listener and fallback into patch 0034; `fork/scripts/verify` replayed the
  queue to that exact tree.
- The pinned upstream is `78804e79d280998a3b4c3c965ec1b5845703bc0e`.
  Upstream `main` was at `fdd3de3b19b97e6cd1ef7300cbb54711431249d3`
  when checked on 2026-09-24, 110 commits ahead. A deployment of the pinned
  tree is not yet an update to that latest version.
- The live source's focused native-authorship suite passes 14 tests, including
  machine fallback and provider-unavailable paths.
- The running checkout remains at `4f2ac0d322712dcf523483a63800a1ee7195699a`
  with five authored source edits. It is not the selected fork materialization.
- Analytics was found enabled despite the earlier hold, then disabled through the
  live plugin command. It remains disabled until its host delta source and OS
  isolation are qualified.
- `rosetta-machine` operational checks and deployment docs still require
  anonymous Tailnet requests to return 401. That contradicts the ADR's stable
  machine fallback and would reject the corrected host during apply/verify.
  Reconcile these expectations before deployment; preserve independent network
  and plugin-credential checks.
- A separate fleet thread rehearsed a copy of the live SQLite DB from 124 to
  137 core migrations plus three P6R sidecar migrations, with clean integrity
  and representative row-count checks. Its online pre-copy is not an atomic
  deployment backup, and it used an older candidate; it is useful evidence,
  not final-target qualification.

## Redeployment sequence

1. Rebase the 32-patch fork queue onto the latest chosen upstream revision,
   preserving patch 0034's stable machine fallback. Preserve and review the
   live-checkout edits against it; incorporate intended behavior in durable
   patches and keep unrelated authored work intact. Reverify the result tree.
2. Reconcile the fork, plugin, community-plugin, and workspace source receipts.
   Exercise the combined selected SDK and direct plugins. Publish child commits
   before the workspace gitlinks, as required by `AGENTS.md`. Reconcile
   `rosetta-machine` health/apply checks and docs with machine fallback before
   using them to gate the rollout.
3. Rehearse the exact final candidate's forward migration against a copy. Make
   a consistent quiesced backup of the live database and final non-core-state
   delta, and verify that it can be opened. The migration is
   upgrade-only; a rollback means restoring the pre-upgrade database together
   with the previous runtime.
4. Build the selected source in the canonical `fork/build/bb` path using a
   preservation-safe in-place procedure, then restart the one `bb.service`.
5. Check local and Tailnet HTTP health; verify machine fallback without person
   evidence, a normal invalid request returning validation error rather than
   401, a verified-person request if available, CLI and child-thread behavior,
   selected plugin loading, and Analytics disabled. Check logs and migration
   state before declaring completion.

The server rollout does not need a new identity security layer. Existing desktop
GTK, template-pack infrastructure, and opt-in Context Magnet Inspector receipt
limitations remain separately disclosed; none establishes a person-admission
requirement for this host.

## Current execution constraint

Automatic approval review rejected a second temporary materialization outside
the authorized workspace/proof paths. The exact fork replay verification still
passed. The existing normal checkout is dirty, and `fork/scripts/materialize`
refuses to overwrite it. Before a live switch, use an approved in-place method
that preserves those edits; do not erase the checkout to make the script pass.
