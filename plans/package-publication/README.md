# Package publication: bb-identity and bb-provider-settings

**Plan:** [../package-publication.plan.pkl](../package-publication.plan.pkl). It is the source of truth for intended work.
**Ledger:** `/home/ubuntu/.bb/thread-storage/thr_i7xakgdxdd/package-publication.ledger.jsonl`. It records every observation and decision.
**Live state:** `workbench plan tick plans/package-publication.plan.pkl --ledger <ledger>`. History: `workbench plan recall` (same flags).
**Steward:** BB thread `thr_i7xakgdxdd`. This page summarises; when it disagrees with the ledger, the ledger wins.

## Goal

`@phosphorco/bb-identity` and `@phosphorco/bb-provider-settings` move out of private `phosphorco/bb-plugins` into public `phosphorco/bb-community-plugins` and get published to npm from there with provenance and trusted publishing.
- **API:** production API unchanged. The only additions are the Cole-approved `/testing` conformance entries.
- **Consumers:** plugins in both repos pin exact npm versions. Perspectives is delivered.
- **Done means:** CI green, and the workspace fully checked, reloaded, promoted and clean.

## Why the redesign (Cole, 2026-10-04)

Moving the packages as they were would have shipped a design flaw: the dependency pointed the wrong way.
- `bb-provider-settings` contained a registry of its 8 consumers that reached into plugins in both repos. 23 of its 253 consumer tests were already failing on `main`, unnoticed.
- `bb-identity` hosted a thread-progress browser fixture in the same way.

Cole asked for an architectural fix and allowed ruthless pruning of implementation-bound tests:
- dependencies run only **plugins → packages → SDK**;
- each package ships a `/testing` conformance kit;
- each plugin owns short tests written against that kit;
- campaign proof material is archived rather than shipped.

## Decisions

| Decision | By | Record |
|---|---|---|
| Move both packages to community; publish via OIDC + provenance | Cole | brief, ledger |
| Inverted consumer testing; additive `/testing` entries; prune implementation-bound tests | Cole | ledger note, DESIGN.md §8 |
| Test triage and kit API, with binding amendments R1–R4 | provider-settings campaign (`thr_qjduvhha3z`) | [test-triage.md](/home/ubuntu/.bb/thread-storage/thr_i7xakgdxdd/package-publication/test-triage.md), campaign ACCEPTANCE.json |
| Archive goes in the **private** plugins repo (bb-workspace is public) | steward | DESIGN.md §8 |
| Kit separates `notApplicable` (omitted, with reason) from `skip` (a visible gap) | steward | plugins `ecbb41d` |
| Future Threads accepts captured requests without execution provenance (real bug) | steward | conf-a commit `9abf529` |
| Perspectives emergency runtime bridge | campaign (option A) | [RECEIPT.md](/home/ubuntu/.bb/thread-storage/thr_i7xakgdxdd/package-publication/perspectives-bridge-20261004/RECEIPT.md) |
| **Open:** public history, fresh import or preserved | **Cole** | `history-policy` selector |

## Done (with evidence)

1. **Plan reviewed:** 7 review rounds by `thr_xsy2sz2pvp`, ending PASS. The design is accepted.
2. **Owner coordination:** the campaign accepted the move and a package-edit freeze, and handed over Perspectives delivery.
3. **Private publish workflow retired:** plugins `041ff12`, before any package push.
4. **Triage accepted** by the campaign, sha256 `c533535…`.
5. **Evidence archived:** plugins `df440b7`, `evidence/package-publication/`. 370 files (268 disk-only), each verified against its original. Includes verbatim per-item limits and the failure logs (`archive-check.sh`: pass).
6. **Test kits:** plugins `cfba0af` and `ecbb41d`.
   - provider-settings: `./testing` (DOM-free) and `./testing/react`, driving the real owner implementation through the SDK fake host, with self-tests and negative self-tests.
   - identity: `createIdentityWireFake` and `defineStateStorageConformance`.
   - Production `dist` is byte-identical (`kit-check.sh`: pass).
7. **Perspectives restored** after the 21:09 service restart, using a temporary, recorded bridge accepted by the campaign. Settings unchanged.

## In flight: plugin-owned conformance (`plugin-conformance`)

Integration branch: `pkgpub/conformance` (`~/.cache/pkgpub-work/integrate/plugins`).

| Worker | Plugins | State |
|---|---|---|
| conf-a `thr_6bk2t73x2r` | rosetta-slack 300/300, future-threads 78/78, review-to-disposition 88/88 | merged |
| conf-b `thr_xgia6e35ym` | github-review 101, sticky-notes 101, btw 46, plugin-provider-settings 6 (its first tests) | merged |
| steward | rosetta settle race (new SDK context's Read was untracked); 10/10 runs now pass | `085a23e` |
| conf-c `thr_vashkadphd` | thread-progress, including the identity inbox on `createIdentityWireFake` | running |

**Next, in one commit:** remove the central registry and the private-plugin suites from both packages, add `evidence/package-publication/DISPOSITION.md` (one row per removed file), and update the wiring. Then `conformance-check.sh`, followed by the campaign confirming behaviours [1]–[7].

## After that

1. **Cole's history ruling**, then a revision of the move node and its oracle, then re-review.
2. **Move both packages** into `community-plugins/packages`:
   - deliver Perspectives byte-identically;
   - verify real resolution and retire the bridge (`bridge-check.sh`).
3. **Publish workflow:** extend `publish.yml`, add a `dry_run` receipt, validate on push.
4. **Cole bootstraps 0.1.0** (temporary `NPM_TOKEN` and tags), then configures trusted publishers.
5. **Plugins consume exact npm versions**; `packages/` and the old wiring are removed.
6. **Wrap-up:** references, CI green, peer freeze, strict drain, full check, reloads, Perspectives receipt, promotion, final clean, report.

## Standing constraints

- **Peer work:** never discard, stash or publish another thread's work. No fork edits. No npm publish without Cole.
- **Check scripts:**
  - every oracle judges freshly fetched `origin/main` in a verification-only worktree;
  - `lib.sh` pins the toolchain to `plugins/mise.toml` (Node 26.3.0, Bun 1.3.14), because the workspace root resolves Node 22;
  - each oracle has a recorded known-failure witness.
- **Bridge:** `plugins/packages/bb-provider-settings` stays until `bridge-retired` passes.
