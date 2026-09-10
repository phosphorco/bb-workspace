# Automatic Tailnet identity — 2026-09-10

Deployed in `/home/ubuntu/bb`, not `/home/ubuntu/bb-service`.

Root cause: the service already declared `BB_TAILNET_IDENTITY_OWNED_HOST`, but
the newer host required a separate `BB_P6R_IDENTITY_BOUNDARY` configuration.
The plugin loaded without registering a provider. Its directory could not expose
canonical person keys without registration, producing an empty picker as well as
machine-only attribution. The local Tailscale directory itself has four usable
people; earlier refresh errors were not the current root cause.

Patch 17 derives standard loopback Serve ingress and identity-header mapping from
the existing owned-host setting. Explicit custom boundary configuration wins;
invalid explicit configuration still reports an error. No credential changes,
new opt-in JSON, session-expiry gate, or claimed-person fallback were added.

- Fork receipt: `689e2ad30945374c9ff878bf1d2583b8ec50151b`.
- Running source: `cfaa89f3cc6e870c732ebb5f8abff5bcfe6d82ca`.
- Verified replay/runtime tree: `97b7424adc86e23c2b0351c3cc9267488beef35d`.
- Config regression failed before the fix; all 113 config tests pass after it.
- Provider regressions: 29 pass. Server/config typecheck: 6 tasks pass.
- In-place production build: 13 tasks pass. Service restarted at 13:43:50 EDT.
- Live: 43 running plugins, no plugin errors, four directory recipients.
- The next user message arrived attributed to `cole@phosphor.co` instead of
  `machine:rosetta`. Browser sidebar rendering still benefits from user confirmation.

The [fresh-host witness](automatic-tailnet-witness.mts) exercises the canonical
host/plugin with the new default configuration: real directory, controlled
Serve headers resolving a person, and local/unknown-user machine fallback.
It is not a substitute for real-browser ingress evidence.

Logs under `/home/ubuntu/.bb/thread-storage/thr_ateba9rdkp/`:
`tailnet-canonical-config.log`, `tailnet-provider-regressions.log`,
`tailnet-server-typecheck.log`, `tailnet-canonical-witness.log`,
`tailnet-fork-verify.log`, `deploy-tailnet-default.log`.

Unrelated canonical Thread Links edits were preserved. The initial small
`bb-service` candidate and witness remain there, uncommitted and undeployed;
its older dirty identity campaign was not incorporated or restarted. Normal
deployment is exclusively the canonical workspace. Existing proof services and
credentials were left unchanged.
