# Complete the identity experience

This campaign turns the governing [master plan](../../fork/plans/bb-fork-master-plan.md) and Cole's subsequent decisions into executable obligations. It is not another implementation-status checklist: intended work lives in [identity-experience.plan.pkl](../identity-experience.plan.pkl), and observations/rulings live in its sibling ledger. Run `workbench plan recall plans/identity-experience.plan.pkl` to resume, or `tick` for the current frontier.

## Destination

Two authenticated people can use shared BB without confusing sender, editor, viewed subject, mutation owner or external author. Their settings persist and synchronize; queues, retries and daemon restarts retain accepted authorship; native commands keep upstream behavior. Providers remain interchangeable, portable plugins work on ordinary upstream BB, and operators can identify and reproduce the tested deployment. The downstream integration stays small enough to carry across a second upstream revision.

## Product boundaries carried forward

- Identity is provider-neutral. Tailnet remains an optional provider plugin, with provider-specific configuration and health. Preserve its plugin ID and stored configuration when changing its human-facing name to Tailnet Identity.
- Personal palette/favicon overrides inherit from the shared default and have explicit reset. Shared Appearance editing permissions are unchanged. No new palette authoring system or roster of other people's preferences is implied.
- The selected rewrite has no claimed-identity fallback. The older IA proposal (retained as uncommitted historical material in the older workspace) assumes old routes/storage and claimed identities; its ownership/navigation intent is useful, but those assumptions are superseded. Verify selected source before reusing implementation details.
- All admitted collaborators have equal information access. Explicit self-only versus collaborator-target policies prevent accidental owner changes; view-as is not authentication. This is not private tenancy or a plugin sandbox.
- Unknown historical authors stay unknown. Do not derive identities from handles, mentions, transcript text, local operator credentials or obsolete key encodings. Provider-issued alias evidence is required for legacy identity recovery.
- Keep native command parsing and grouped-message edit restrictions. Source-level plumbing alone is not a live two-person acceptance witness.
- Learning, Chronoscope, Phosphor Checkouts, Prompt Stacks, Snippets, organization Perspectives and FirstMate were deliberately retired. Do not reintroduce them through an old parity inventory. Community Perspectives is selected. Unrelated Analytics full-history architecture remains in its own plan.
- Fresh-instance deployment is selected. That removes an implied full production-data transfer from this rollout, not the master plan's bounded session portability, interruption, upgrade and honest legacy-ownership requirements.
- Stronger operation grants, verifier/worker OS containment and cross-process commit protocols are a separate scope decision. Assess them concretely; do not silently enlarge or declare them delivered by this product campaign.

## Start from evidence, not an old status file

At campaign creation the new Identity page/native author patch is on fork main `ad9741403`. The selected preview has controlled native lifecycle tests and mobile/desktop smoke; no human-ready result should be inferred from the automated tagged-host browser. Agent Connect has newer live queue/call/stream/retry evidence; old STATUS entries still calling these unavailable are historical.

During reconciliation a separate Cole-authorized lane pushed additional inputs:

| Repository | Input | Meaning |
| --- | --- | --- |
| organization plugins | `862aee51269d87ebcc307ecd7c69a002c0fd8d6a` | Portable authored features, based on `4ecd8b0`; current durable Agent Connect retained. |
| community plugins | `31498646dbd7d6ce08ce6fabe0488a444cbc589d` | Includes Agentation identity adoption and other portable work, based on `9ec81c2`. |
| workspace | `1bcd7577654f573cfcbc05068178449237a66977` | Shared identity archive and source-port evidence; gitlinks deliberately unchanged. |

All are on `bb/sdk-sharing-preview-thr_csw7br3yff`. Inspect `preview/unpublished-port/README.md` and `closeout.json` at that workspace commit. The archive is `sdk-artifacts/phosphorco-bb-identity-0.1.0.7964b11db94d.tgz`; it is not an npm publication. Later push confirmation supersedes the closeout's historical local-only wording. Those checks do not establish authenticated browser acceptance or a promoted composition. Subscription Router executable selection remains a separate missing core capability; no account migration was performed.

Cole selected `/home/ubuntu/bb-service` as the implementation home for this campaign. Its existing fork, organization plugins, community plugins and separate preview runtime are the target; `bb-machine` SSH access is not an implementation prerequisite. The local source preflight still checks actual revisions, dirty ownership, toolchain and loaded artifacts, and reconciles stale composition receipts before claiming a tested combination. Later deployment to another host remains a separate handoff.

The root `/home/ubuntu/bb` still has authored dirty work and is preserved. This campaign and its ledger now live in /home/ubuntu/bb-service/plans and are authoritative. The earlier /home/ubuntu/bb/plans copy is frozen historical evidence; do not write that ledger. Exact commits are evidence anchors; they are not permanent deployment version policy.

## Coordination

| Role | BB thread | Execution |
| --- | --- | --- |
| Root integration and plan/ledger writer | `thr_csw7br3yff` | Owns cross-lane contracts, grants, acceptance and promotion sequence. |
| Native identity and personal experience | `thr_hb39hm9bj6` | Codex `gpt-6-astra`, low. |
| Providers and portable plugins | `thr_a8bnpntna7` | Codex `gpt-6-astra`, low. |
| Commissioning and maintenance | `thr_wmg2gi249v` | Codex `gpt-6-astra`, low. |
| Implementation/reconciliation workers | Children of the appropriate coordinator | Codex `gpt-5.6-terra`, high, fast. |

All delegation uses BB child threads and explicit `bb thread tell` messages. No `bb wait`, provider-native subagent tree, duplicated polling orchestrator or independent ledger. One worker per coordinator initially; expand only through root's capacity/footprint review. Coordinators perform independent contract/review work while their workers run. When no work is ready, send a handoff and end the turn; messages resume work.

First-wave grants are report-only; [briefs/common.md](briefs/common.md) defines the operating contract. Future implementation Actions are not dispatch permission until their source and contract dependencies pass and root records their concrete footprint grant. Never use a generic plan path to authorize a write in the dirty normal checkout. SDK contract edits, generated manifests/locks, fork patch sealing and deployment have single owners.

## Evidence standards

- Every outcome needs a source identity, actual instrument and pass/fail/unsupported result. Review existing evidence for reuse; rerun when source or environment invalidates it.
- Controlled actors, mock transports, packed installation, browser rendering and real-human admission are distinct evidence classes. A 401 shell is not an authenticated feature pass.
- Known bugs need a specific failing witness and the same passing witness after repair. Missing imports, timeouts or crashed harnesses do not count as the intended negative.
- Record numeric performance budgets before implementation expansion, against a comparable unmodified target. Retain no per-message actor query, batched participants, no per-row roster queries, and no unchanged-read profile writes.
- Human participation, real external delivery, credentials and service interruptions have explicit operational prerequisites. Build harnesses and do independent work while those prerequisites remain open; never forge a human judgment.
- Root independently reviews returned artifacts and current checks. Source changes stale relevant evidence even if Workbench fingerprints do not reopen a completed node automatically.
- Final acceptance includes unresolved ledger notes and explicit decisions, not merely a green subset of nodes. Package publication, source push, tested composition and host promotion are separate events.
