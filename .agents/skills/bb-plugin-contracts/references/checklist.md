# Contract design checklist

Use this list to author or review a cross-plugin contract. Each item names where
the two existing instances answer it, so a new contract can copy a proven shape
instead of inventing one. `PS` = `community-plugins/packages/bb-provider-settings`,
`CR` = `community-plugins/packages/bb-context-recognition` (`CONTRACT.md`), `TB` = `plugins/plugins/thread-brief`.

## Shape

- [ ] One-paragraph purpose and an explicit "this package is not…" list (PS `CONTRACT.md` intro, §12).
- [ ] Ownership table with no duty in two columns (PS §1).
- [ ] Closed DTOs: unknown fields rejected on input, tolerated on output (PS §7, CR §5.1, §6.1).
- [ ] Stable identifiers with grammar and length limits; the supplier echoes requested identities and the host rejects unrequested ones (CR §6.2).
- [ ] Published `LIMITS` for counts, bytes, timeouts, concurrency and depth (CR §8, PS enumeration).
- [ ] Safe link and target types instead of raw URLs or paths (CR §3.3).
- [ ] Closed issue/reason codes (PS "Issue codes", CR §3.4).

## Protocol

- [ ] Fixed method names, one `describe` plus versioned operation methods (PS §7, CR §4.1, §5.1, §6.1).
- [ ] Describe envelope parsed tolerantly; details decoded only under the negotiated version; fixtures for `[1]`, `[1,2]`, `[2]`, `[]`, malformed (PS §8).
- [ ] Error classification table mapping native status and body shape to per-supplier kinds (PS §8).
- [ ] Unknown outcome rule for any write: one fresh read, reconcile by content, no auto-retry (PS §8 "Save outcome").
- [ ] Read paths never write and never load expensive catalogs (PS §7 Read).

## Recognition (text surfaces)

- [ ] Recognition (linkify) and presentation (resolve) are separate stages; resolve depends on identity only (CR §5, §6).
- [ ] Linkifiers are pure: text, excluded ranges and a consumer-built context bundle in; candidates with span, canonical identity, confidence and provenance out (CR §5.1–5.3).
- [ ] Inference is visible: a closed provenance basis plus a short explanation (CR §5.2).
- [ ] Deterministic consumer arbitration with typed-over-generic fallback (CR §5.4).
- [ ] Reserved namespaces for consumer built-ins (CR §3.1).

## Discovery and isolation

- [ ] `plugins.list()` once per pass; probe only plausible candidates; key by target plugin id (PS §8 enumeration).
- [ ] Bounded lanes and per-call timeouts, plus an overall budget (CR §8; PS has per-probe bounds only).
- [ ] Per-supplier result states; one failing describe never discards other suppliers' results (PS progressive `onRow`; TB currently aborts the whole pass on a transient describe failure).
- [ ] Generation token and abort of stale passes (PS §8).
- [ ] Triggers named: mount, refresh, reconnect, plugin lifecycle; no polling (PS §8, TB `plugins-changed`).
- [ ] Zero suppliers renders a complete, normal experience.

## Rendering and performance

- [ ] Suppliers return data the host can always render. Hosted components go only through a registry with owner-bound props, an error boundary and a data fallback, never by DOM scanning (CR `design/presentation-registry.md`; PS §11).
- [ ] Markdown from suppliers is sanitized by the host; schema validity is not trust (CR §6.2).
- [ ] Expensive work happens once on the server where possible, not per viewer (TB document model).
- [ ] Interaction-deferred loading: unopened rows/cards do no extra reads (PS §9).
- [ ] Shared controls never use slot-scoped hooks; a bundle-scan test enforces it (PS §2).

## Identity and writes

- [ ] Handlers take explicit input; no caller identity required (PS §7).
- [ ] No authorization added solely against trusted plugins (identities ADR).
- [ ] Storage stays with the owner; no request input changes a write destination (PS §7).

## Evidence

- [ ] Package self-tests on emitted entries (PS `bun run test`).
- [ ] Conformance kit drives each adopter's real registered handlers through `createFakePluginHost` (PS §13).
- [ ] Host tests cover zero, one, failing, slow, malformed and multiple suppliers.
- [ ] Live machine proof of the composition, labelled separately from source conformance.
