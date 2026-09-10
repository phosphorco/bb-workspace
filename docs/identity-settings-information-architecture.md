# Identity settings information architecture

Status: proposed product and scope specification. This document authorizes no
runtime change, deployment, provider migration, or normal-host promotion.

## Summary

The identity-enabled BB fork should have one core **Identity** settings page for
the things a person can see or choose about their identity in BB. This includes
the current identity presentation and a personal appearance override.

The current `identity-boundaries` plugin should be presented in the product as
**Tailnet Identity**. Its settings remain the deployment's provider
configuration: they determine how the server establishes trusted Tailnet
identities, rather than how an individual appears or works in BB.

This is an information-architecture and product-boundary change. It does not
make Tailnet a core requirement and does not move Tailscale-specific request
verification into core.

## Motivation

Today two Settings locations both look like identity configuration:

- `/settings/p6rIdentity` is a core, remote-session page. It shows a
  provider-established identity when one is trusted; otherwise it lets a
  remote browser choose a claimed display name for attribution and presence.
- `/settings/plugins/identity-boundaries` is the declarative configuration
  page for the Tailnet provider. Its owned Serve host, recognized login, and
  sender-tag values affect server-wide identity admission.

The distinction is technically sound but not evident in the navigation. It
also leaves an existing core feature without a UI: the server already supports
a per-principal theme and favicon override, but the ordinary Appearance page
only writes the shared default.

The resulting experience should tell a person three clear things:

1. who BB believes they are in this session;
2. which settings are theirs alone; and
3. which provider, if any, is establishing that identity and where an operator
   configures it.

## Feature

### Core Identity page

The identity-enabled fork's core Identity page is the home for user-facing,
fork-native personal identity settings. It should contain:

- **Your identity.** Show the current trusted provider profile (name, handle,
  avatar, and provider) when available. Preserve the existing claimed-identity
  editor for eligible remote sessions, with its current non-authority warning.
- **Your appearance.** For an eligible provider-established or claimed
  principal, select an available palette and favicon preference as that
  principal's personal override. Offer an explicit **Use shared default**
  action that removes the override.
- **Identity provider.** Identify the active provider and distinguish a
  trusted provider from a claimed or local-operator session. When the selected
  provider has a configuration page, offer an operator-oriented link to it.

The personal appearance control uses the same built-in, custom, and
plugin-contributed theme catalogue as the existing Appearance page. It does
not make themes themselves per-person artifacts in this phase.

The existing Appearance page continues to manage the shared default for
backward compatibility. Its scope must be labeled as shared. This proposal does
not change who is permitted to edit that shared setting; a separate product
decision is required before making it operator-only.

Local-operator and unauthenticated sessions retain the existing shared-default
semantics. The UI must not suggest that they have a personal override when the
server will reject one.

### Tailnet Identity provider page

Retain the existing plugin id, configuration keys, persistence, and route for
compatibility. Change its human-facing name and copy to **Tailnet Identity** so
the page communicates its actual purpose:

- the configured owned Tailscale Serve host;
- the recognized Tailnet login/tag policy; and
- the sender presentation tag used by the provider.

The page is provider/deployment configuration. It must say that changes can
affect authentication for every remote user and may invalidate trusted Tailnet
sessions. It is not the place for a user to edit their profile or appearance.

## Product boundary

```text
Core Identity settings                     Tailnet Identity plugin settings
---------------------------------------    ---------------------------------
Identity presentation for this session     Tailscale Serve admission setup
Claimed identity presentation (remote)     Directory/provider configuration
Personal theme and favicon override        Trusted-header and directory logic
Portable identity-enabled BB experience    One concrete identity provider
```

Core continues to own generic identity facts, admitted request authority, and
per-principal preference resolution. A provider continues to own its external
verification, credentials/configuration, directory refresh, and provider
lifecycle. This preserves the public `bb-identity` model: a deployment selects
one boundary provider, but a future provider need not be Tailnet-specific.

Do not move Identity Boundaries into core merely to combine the Settings
experience. That migration should be considered only after an explicit product
decision that Tailnet is a mandatory BB capability, with its separate
operational and upstream-sync cost.

## Existing foundation

The fork already has the server half of personal appearance:

- a namespaced row per PrincipalKey in the existing `app_theme` table;
- authenticated `PUT` and `DELETE /settings/p6r-personal-appearance` routes;
- effective appearance resolution of personal override, then shared default;
- validation against built-in, custom, and plugin-contributed themes; and
- a bounded `p6rPaletteRoster` response intended for a future UI or plugin.

The current first-party app and CLI do not expose a personal-appearance flow.
The ordinary settings and `bb theme` surfaces write the shared default.

## Scope and high-level plan

### 1. Confirm the product contract

- Define the exact copy and visibility for trusted, claimed, local-operator,
  and unauthenticated sessions.
- Decide whether the initial page only shows the current provider's status and
  deep-links to its configuration, or whether core needs a generic
  provider-settings-section slot. Do not hard-code the `identity-boundaries`
  plugin id into core as a permanent integration contract.
- Specify the personal-appearance state returned to the app: eligibility,
  effective selection, and whether the current person has an explicit override.
  The UI must not infer these facts from a roster of other people.
- Preserve the distinction between a person's personal override and the
  shared-default setting.

### 2. Complete core appearance surfaces

- Extend the server/API contract only as needed for the current person's
  personal-appearance state and explicit set/clear actions. Preserve existing
  routes and effective `/system/config` behavior for compatibility.
- Add an SDK surface for reading, setting, and clearing the personal override.
  This must make the personal-versus-shared target explicit.
- Add corresponding CLI support. The command design is intentionally open, but
  it must not silently change the shared default when a caller intends a
  personal preference, or vice versa.
- Keep the existing storage scheme unless a concrete migration need is found;
  no database migration is expected for the UI work alone.

### 3. Build the core Identity UI

- Evolve the existing core Identity settings section into the page described
  above, retaining its current claimed-identity behavior.
- Reuse the appearance picker's catalogue and accessible control patterns, but
  give the personal selection independent loading, error, save, and reset
  state. Do not use a client-side identity key as authority; let the server
  resolve the request principal.
- Label the existing Appearance page as the shared default and add reciprocal
  guidance between the two pages so people understand the scope of each write.
- Keep the view responsive and keyboard accessible. A palette change should
  refresh the effective theme only for the requesting identity, while a shared
  default change retains its existing broadcast behavior.

### 4. Clarify the provider UI

- Rename the Identity Boundaries plugin's display name and settings-page copy
  to **Tailnet Identity**, without renaming its package/plugin id or deleting
  its existing route.
- Add provider-status/deep-link presentation from the core Identity page when
  it is supported by the selected provider configuration contract.
- Keep Tailnet-specific Serve-header validation, directory state, refresh, and
  provider registration in the plugin. No identity authority behavior changes
  in this step.

### 5. Verify and document

- Server tests: personal selection, fallback, clear, invalid theme, trusted
  provider, claimed identity, local operator, and no-principal paths.
- App tests: correct page visibility, personal save/reset, shared-default copy,
  error/retry behavior, and no accidental shared write.
- SDK and CLI tests: explicit personal/shared intent and backwards-compatible
  existing theme commands.
- Plugin tests: unchanged provider configuration semantics plus renamed
  presentation and link behavior.
- Run the fork's relevant Turbo typecheck, test, and build gates; run the
  organization-plugin generator, SDK-type, typecheck, test, and build gates if
  the plugin changes. Update the fork patch series and materialization receipts
  only after the selected combined composition is verified.

## Likely repositories and surfaces

| Area | Expected scope |
| --- | --- |
| `fork/` overlay | Server route/contract, SDK, CLI, settings navigation and UI, focused tests, then durable patch export if selected. |
| `plugins/` | Identity Boundaries display/copy and possibly a generic provider-settings presentation hook; no change to Tailnet authority unless separately approved. |
| `bb-identity` package | No change is assumed. Revisit only if the selected-provider status/configuration link requires a missing generic public contract. |
| workspace docs | This specification and any user/operator guidance selected during implementation. |

## Non-goals

- Making Tailnet identity mandatory or moving its implementation into core.
- Changing identity admission, PrincipalKey construction, trusted-header
  handling, directory reconciliation, or provider generation lifecycle.
- Adding a new identity provider, multi-provider priority system, or login UI.
- Exposing the bounded palette roster as an ordinary user's list of others'
  preferences. A separate administrator/social presentation use case must
  justify that surface.
- Changing existing custom-theme authoring or plugin theme ownership.
- Promoting the current dirty workspace or preview composition.

## Acceptance criteria

The feature is complete when an eligible remote person can see their current
identity, choose a personal palette/favicon preference, and return to the shared
default from the core Identity page; the same action is available through an
explicit SDK and CLI surface; the shared Appearance setting remains
backwards-compatible and clearly labeled; and Tailnet provider configuration is
clearly named, linked, and still separated from personal settings.
