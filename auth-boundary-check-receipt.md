# P6R configured-admission transport check

> Policy update — 2026-09-09: the approved [Identities and multiplayer ADR](docs/adrs/2026-09-identities-and-multiplayer.md)
> governs this trusted shared deployment. Use verified people when available,
> applicable carried attribution next, and a stable machine actor otherwise;
> missing or failed person verification must not block ordinary operations.
> Never relabel fallback as a verified person or redirect pending personal-state
> writes to another owner. Independent access checks and data validation remain.
> Earlier rejection requirements below are superseded; versioned API descriptions
> and test receipts remain historical evidence, not proof of ADR implementation.


Tree: `/home/ubuntu/bb-service/fork/build/bb`
Baseline selected index: `66a21`

Changed source:

- apps/server/src/routes/plugins.ts
- apps/server/src/server.ts
- apps/server/src/services/p6r/identity-protocol.ts
- apps/server/src/services/plugins/plugin-service.ts
- packages/plugin-sdk/src/rpc-contract.ts

Changed tests:

- apps/server/test/services/p6r/identity-protocol.test.ts
- apps/server/test/services/plugins/plugin-p6r-admission-boundary.test.ts (new)

Checks:

- `pnpm exec vitest run apps/server/test/services/p6r/identity-protocol.test.ts apps/server/test/services/plugins/plugin-p6r-admission-boundary.test.ts --pool=forks --maxWorkers=1`: 2 files, 13 passed, 4.40s.
- `pnpm exec turbo run typecheck --filter=@bb/server --filter=@get-bb/plugin-sdk --output-logs=errors-only --summarize=false`: exit 0; 2 packages.
- `pnpm exec turbo run build --filter=@bb/server --filter=@get-bb/plugin-sdk --output-logs=errors-only --summarize=false`: exit 0; 7 tasks successful, 5 cached, 1.346s.
- `git diff --check`: exit 0.

Built artifact SHA-256:

- apps/server/dist/start-server.js: `5e4a55b96739e6a64b425a656eda0faf450058de6936c239315dc9b938e05eb5`
- packages/plugin-sdk/dist/index.js: `858a1cadd241b1975252272e67f8d37373ffde43eec57af2adfc101900257171`

## Negative-response deadline correction

Configured non-ready outcomes retain their verified error even when the admission-result deadline has elapsed; no scope is issued. Generation/abort guards still run first and ready-session expiry is still enforced before capture. Focused tests: 19/19. Scoped Turbo build and typecheck: 9/9 tasks. Exact current source receipt: preview/auth-boundary-fix.json. Live post-restart desktop/mobile sweep completed with zero failures/server5xx; exact result in preview/ui-smoke/closeout.json. One hundred negative identity GETs all returned401.
