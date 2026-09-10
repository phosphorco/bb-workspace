# Public distribution and consumer fixture contract

> Policy update — 2026-09-09: the approved [Identities and multiplayer ADR](../../../../docs/adrs/2026-09-identities-and-multiplayer.md)
> governs this trusted shared deployment. Use verified people when available,
> applicable carried attribution next, and a stable machine actor otherwise;
> missing or failed person verification must not block ordinary operations.
> Never relabel fallback as a verified person or redirect pending personal-state
> writes to another owner. Independent access checks and data validation remain.
> Earlier rejection requirements below are superseded; versioned API descriptions
> and test receipts remain historical evidence, not proof of ADR implementation.


Scope: the selected organization source is
`plugins@862aee51269d87ebcc307ecd7c69a002c0fd8d6a` (whose identity-package
source remains at parent `4ecd8b0bddc248cfd19ab94362cbba8937ba375b`); selected
community source is `community-plugins@31498646dbd7d6ce08ce6fabe0488a444cbc589d`.
This fixture specifies public contracts and acceptance witnesses. It does not
claim a new package release, a live identity session, or a host deployment.

## 1. Public-package import contract

`@phosphorco/bb-identity` declares these packaged public entry points (this is not a registry-publication claim):

| Import | Supported use |
| --- | --- |
| `@phosphorco/bb-identity` | shared DTOs/codecs such as `ActorSnapshot`, `PersonReference`, and `identityKeyCodec` |
| `/model` | opaque keys/IDs, codecs, `SendInput`, acceptance/operation and provenance types |
| `/host` | provider-owned `ExternalAuthorInput` and provider protocol types |
| `/server` | request-bound `PersonRequest`, issued targets, commit validator, server/endpoint interfaces |
| `/state` | feature-owned state definition/storage, mutation, operation reconciliation and drafts |
| `/client` | headless connection/view/state-binding interfaces |
| `/react` | Provider/context and declared display/view controls |
| `/bb` | `bindBbIdentity`, issued invocation, native RPC/HTTP/state/provider composition |
| `/testing` | public test support only |

This follows the generated `exports` map and shipped declarations/runtime
(`packages/bb-identity/package.json@4ecd8b0:L24-L75`). `bb-binding-runtime`,
adapter implementations, package-private paths, a raw `UpstreamDriver`, copied
SDK declarations, and a provider-plugin RPC are not consumer imports.

Concrete selected consumers demonstrate the intended narrow imports:

- Agent Connect: `/model`, `/host`, `/bb`; it binds at its factory
  (`plugins/agent-connect/server.ts@862aee5:L16-L17,L205-L213`).
- Notifications: `/model`, `/server`, `/bb`; its current principal comes from
  the binding-issued key (`plugins/notifications/server.ts@862aee5:L44-L55`).
- ntfy: `/model`, `/server`, `/bb`; it does not import a named provider
  (`plugins/ntfy/server.ts@862aee5:L1-L24`).
- Thread Progress: `/model`, `/state`, `/client`, `/react`, `/bb`; only its
  feature supplies schema, storage and conflict policy.
- Identity Boundaries: `/bb` for its selected provider implementation. Its
  issuer/settings are allowed to be Tailnet-specific because it is the provider,
  not a portable consumer (`plugins/identity-boundaries/server.ts@862aee5:L178-L245`).
- Community Agentation Mentions: root types and `/bb` only
  (`plugins/agentation-mentions/lib/identity.ts@3149864:L1-L18`,
  `server.ts@3149864:L13-L15`). Its source test prohibits direct
  `identity-boundaries`, `current-profile`, and `getIdentityProfile`
  (`test/public-identity-boundary-source.test.ts@3149864:L14-L20`).

## 2. Consumer authority and lifetime contract

At each plugin factory, call `bindBbIdentity(bb)` once, unwrap the declared
`Result`, and dispose that binding with plugin disposal. Register an interactive
person operation with `binding.rpc.register`; the handler receives an issued
`BbInvocation` and may open `invocation.person()` only for that request. A
background or external handler has no ambient person. These are the declared
interfaces (`bb.d.ts@4ecd8b0:L22-L75,L107-L146`).

For personal feature data, a handler obtains `PersonRequest.target` with an
explicit selection/policy. A write must preserve that issued target through
preparation and call `binding.server.commits.validate` in the feature's
synchronous transaction; a copied target, client actor, or previous session is
not valid (`server.d.ts@4ecd8b0:L8-L44`). `self-only` is the selected personal-resource write
policy, supplied explicitly; `collaborators` is selected only for an explicit shared read/write
feature policy. View selection is data, not authority.

Capability absence on ordinary upstream uses the stable default user; a
configured enhanced identity failure must use the shared host
machine actor for new intent, without redirecting a pending person-owned write
to another subject. The older blocking declaration (`bb.d.ts@4ecd8b0:L140-L146`)
is an implementation gap, not the acceptance target.
Provider credentials, ingress configuration, directory naming and health remain
with Identity Boundaries. The Tailnet provider explicitly reports missing owned
host, expired evidence, wrong authority and stale directory as non-success
outcomes (`lib/provider.ts@862aee5:L166-L219`); portable feature consumers must
surface that state rather than parse a Tailnet key or reconstruct a profile.

## 3. Immutable external and captured-author contract

### External Agent Connect contribution

Agent Connect verifies its own connection credential and persists one exact
`ExternalAuthorInput` plus `SendInput` under one `OperationId` before
`sendExternal`; subject, presentation, target thread, mode and content are the
same immutable operation identity (`CONSUMERS.md@4ecd8b0:L186-L212`; public
types `server.d.ts@4ecd8b0:L45-L57`). A loss/timeout is reconciled through
`lookupOperation` using that same ID; an `unknown` or `pending` result does not
authorize a new ID or repeat send. History presentation may name an author only
when the bounded provenance query is `known`, complete, one-item and matches the
event; current selected source implements those checks
(`plugins/agent-connect/message-api.ts@862aee5:L30-L60`).

### Captured Agentation author

Agentation stores an immutable request-bound actor/presentation/evidence
snapshot at the first interactive durable write, or an explicit
`unavailable`/`unauthenticated`/`incompatible` record
(`plugins/agentation-mentions/server.ts@3149864:L501-L542`; `lib/afs.ts@3149864:L118-L179`).
Later dispatch groups by that stored value and presents it as historical,
source-labelled feedback—not a new authenticated send (`lib/identity.ts@3149864:L46-L131`).
An old `authorIdentityId` is retained as `legacy-unresolved`; it is never
converted to a current person identity.

Neither contract permits a display name, text match, later viewer, rotated
credential, or provider directory lookup to become authorship evidence.

## 4. Distribution and dependency-order contract

1. Generate the package manifest/tsconfig only through
   `tools/workspaces-sync`; `bb-identity` is a library, not a plugin.
2. From the selected organization composition, build and pack the library with
   `bun pm pack`. Its archive must contain the declared JS and declaration
   entries, README and license; consumers must import only the installed archive
   (`PACKAGING.md@4ecd8b0:L1-L27,L64-L82`).
3. Record source commit, package path, archive SHA-256, resolved lock entry and
   consumer package version before building any dependent plugin. The current
   preview artifact is
   `phosphorco-bb-identity-0.1.0.7964b11db94d.tgz`, SHA-256
   `7964b11db94d0d19e5631659c03368a98d57eb62284890f7fe62479d4520522e`, from
   `plugins@4ecd8b0` (`/home/ubuntu/bb-service/sdk-artifacts/...provenance.json:L1-L8`).
4. Install that resolved package into organization and community consumers,
   build them, then record the *installed/loaded* plugin bytes and metadata.
   A source revision match alone is insufficient.
5. For a published community plugin, release a resolvable identity package
   before selecting the plugin artifact, or use another self-contained,
   explicitly supported artifact layout. The selected Agentation manifest's
   `file:../../../sdk-artifacts/...tgz` only works in the preview sibling layout
   (`plugins/agentation-mentions/package.json@3149864:L77-L89`; preview README
   requires that sibling path at `L48-L52`). It is not an npm-registry or
   standalone-community-checkout contract.

## 5. Same-artifact baseline/fork parity witnesses

Release owns these host/install proofs. Both hosts must load the same identity
archive and byte-identical plugin artifact recorded by digest; tests must report
the actual loaded paths/hashes.

| Case | Positive witness | Negative witness |
| --- | --- | --- |
| Ordinary baseline | Install the packed plugin; default-user personal feature read/write succeeds under its documented singleton convention. | No identity boundary/provider is configured; no consumer import or host probe crashes. |
| Enhanced valid provider | Same bytes resolve a host-issued person, run self-only mutation, and show provider presentation from the public session. | A foreign self-only target/write is denied; a copied target cannot validate at commit. |
| Enhanced configured outage | Same bytes retain ordinary non-identity UI and any recoverable draft. | Provider resolution failure yields carried or machine attribution and ordinary work continues. Malformed protocol data is still validated. Pending person-owned writes retain their target and conflict semantics; new machine intent uses an explicit machine subject. |
| Agent Connect | Same immutable operation becomes accepted or explicitly indeterminate, then reconciliation reads the same operation/history. | Lost response/observer cannot trigger a second external send or text-derived author. |
| Agentation | Authenticated person A captures feedback; reload/delivery keeps A's immutable source label. | Person B cannot replace A; an unavailable identity stores explicit unavailable provenance, never B/default-user. |
| Community package delivery | Fresh install resolves all declared public entries and builds Agentation from the distribution artifact. | A clean consumer without the preview sibling archive must fail the pre-release portability gate rather than silently source-link or publish a broken `file:` dependency. |

The preview receipt proves all nine identity entries were installed and the
archive SHA reproduced (`preview/unpublished-port/closeout.json:L137-L151`).
It also records 401 identity-dependent browser calls and explicitly limits
coverage to “auth-required; shell only” (`L173-L302`), so it satisfies none of
the authenticated positive witnesses above.

## 6. Unresolved product/release choices

1. **Distribution selection:** publish `@phosphorco/bb-identity` before the
   community plugin, or select an alternate portable artifact mechanism. Keep
   the preview local archive out of the public-release claim.
2. **Notifications Tailnet legacy branch:** keep the exact historical Tailnet
   alias migration as compatibility-only, or select a feature-owned migration
   policy for other historical issuers. Do not generalize it by decoding opaque
   keys. Current source is otherwise opaque-key based, but its legacy decoder
   is Tailnet-specific (`plugins/notifications/identity-contract.ts@862aee5:L60-L99`).
3. **Provider experience:** choose the user-facing label/health presentation
   for the existing `identity-boundaries` plugin while preserving its plugin ID,
   settings keys, stored state and issuer mapping. A cosmetic rename does not
   make provider configuration portable.
4. **Live authorization:** authenticated multi-person/provider-outage and real
   external-delivery witnesses require the designated human/external grant; no
   package mock, local default-user fixture, or 401 shell screenshot is a
   substitute.
