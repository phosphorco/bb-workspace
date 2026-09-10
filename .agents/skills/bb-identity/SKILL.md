---
name: bb-identity
description: Build, migrate, or review BB plugins using the shared bb-identity package for request identity, personal state, view-as, providers, external contributions, and provenance. Use for identity-aware plugin behavior and portable single-user/fork integration.
---

# Build plugins on bb-identity

Use `@phosphorco/bb-identity` as the shared identity and synchronization layer.
Features own their data model, storage, credential verification, and product UI.
Core owns best-effort request attribution and atomic native history. Follow the
[approved identities ADR](../../../docs/adrs/2026-09-identities-and-multiplayer.md):
this is a trusted shared workspace, with identity used for attribution.

Optimize core changes for upstream synchronization: remove person-admission
machinery and keep attribution and necessary lifecycle handling behind shared hooks. Plugin adoption does not by
itself require native app attribution, presence, provider formatting, or new
native UI. Treat those as separately selected product work. Retain acceptance
receipts and history when the public package promises them; do not shrink the
integration by weakening that contract. During fork updates, classify existing
independent fork features separately from the identity kernel before selecting
patches, and verify the actual selected composition rather than a mixed worktree.

## Start with the task

Read the [package entry map](../../../plugins/packages/bb-identity/README.md#entry-points)
and [current implementation status](../../../plugins/packages/bb-identity/STATUS.md).
Then load only the relevant reference:

| Task | Reference |
| --- | --- |
| Server handlers, provider integration, profiles or participants | [Server and providers](references/server-and-providers.md) |
| React, view-as, personal settings, offline drafts or retry | [State and React](references/state-and-react.md) |
| Agent Connect, Slack, external sends, operation history | [External contributions](references/external-contributions.md) |
| Porting an existing feature, testing, packaging, or completion claims | [Migration and verification](references/migration-and-verification.md) |
| Updating the fork's upstream base or reviewing core integration cost | [Upstream synchronization boundary](../../../fork/plans/bb-identity-upstream-sync.md) |

Exact signatures live in the public declaration files and generated export map.
Recipes explain composition; they are not permission to invent an unavailable
method. If implementation and declarations disagree, fix the shared contract
and executable witness before teaching consumers a workaround.

## Rules that apply across plugins

Identity forgery resistance is explicitly unsupported here. Do not add or retain
a check solely to prevent trusted code from fabricating attribution. Every
retained check must address a concrete attribution, lifecycle, data or owner-
consistency failure; history preservation is product behavior, not tamper proof.

- Import public package subpaths. A feature supplies `bb` to `bindBbIdentity`;
  it does not assemble raw adapters, scopes, route tables, or provider RPCs.
- Distinguish actual actor, viewed subject, and mutation target. Target selection
  is data, not authority. Capture the issued owner/session token for delayed UI.
- In this deployment, use verified people, applicable carried context, then a
  stable machine actor. Provider failure does not suspend ordinary new work.
  Portable interactive baseline behavior retains its host-scoped default user.
  Pending writes retain their captured owner; fallback never retargets them.
- Use the package controller and binding for identity-scoped synchronization.
  Do not add a parallel load/save effect, polling feed, or per-feature controller.
- Persist immutable operations and reconcile the same operation after uncertainty.
- Choose external prompt rendering at binding construction: the default `host` mode adds one sender envelope, while a producer that already owns an envelope and `<attached>` context must use `bindBbIdentity(bb, { externalMessageRendering: 'producer' })`. Never infer ownership by text sniffing or add per-send author metadata; both modes retain structured external provenance.
  A lost response, expired lookup, or observer timeout does not authorize resend.
- Explicit owners manage connection, view, subscription and draft lifetimes.
  Separate bundled plugins do not share a hidden module singleton.
- Decode untrusted wire data at the boundary. Resource storage receives typed
  values: canonicalize through encode/decode, not a second wire-only decode.
- Preserve existing user workflows. Record the old behavior and prove its new
  path before removing an implementation. Do not solve missing functionality
  by weakening declarations, hiding controls, or accepting silent loss.

## Learn from implementation friction

When a recipe fails, report the task, exact API/source boundary, smallest
timeline, and whether the problem is docs, package behavior, feature policy,
or fixture shape. Include the correction and a meaningful witness. Update the
one relevant reference after validating the correction; do not turn one fixture
mistake into a universal abstraction or broaden every consumer's API.

Keep temporary defects and acceptance status in `STATUS.md` and the closure
ledger. Keep durable authoring patterns here. Remove obsolete workarounds once
the shared implementation is corrected.
