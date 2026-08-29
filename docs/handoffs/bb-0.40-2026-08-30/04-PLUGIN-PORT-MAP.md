# Plugin and patch port map

## Plugin consumers

| Contract | Consumers | 0.40 target |
| --- | --- | --- |
| request actor context | identity-boundaries, notifications, ntfy, sticky-notes, Thread Progress | nullable actor with assurance; server-derived owner |
| participant reads | Thread Progress, thread-manager | narrow standard thread field only after equivalence, otherwise explicit disablement |
| plugin-external auth/send | agent-connect and external integrations | `auth: "external"`, disjoint authority, atomic actor/send |
| generated SDK declarations | every organization plugin | refresh only from final materialized 0.40 artifact |
| identity-scoped settings | Thread Progress sections | required shared CAS/revision/mutation/reconnect state machine |

## Identity-state requirements

The shared plugin helper must implement server-derived trusted ownership,
atomic SQLite compare-and-set, idempotent mutation IDs, server revision plus
local generation, one in-flight save, coalesced pending state, owner-switch
invalidation, conflict rebase, reconnect, and generic invalidation messages
that expose no owner keys or values.

Deterministically test stale load, edit during save, owner switch while dirty,
conflict, duplicate mutation, reconnect, migration race, and two-client
interleavings.

## Thread Progress

- Own phase in its plugin DB and merge into its replacement thread-list surface.
- Stop publishing/reading active `experimental_facets.phase`.
- Disable facet filters without a safe replacement.
- Preserve section configuration and mark unavailable semantics explicitly.
- Explicitly retain or migrate/drop `thread_phase_facet_projection`.

## Patch disposition starting point

| Patch | Starting disposition |
| --- | --- |
| 0001 | Split into DB, authority, authorship, protocol, presentation |
| 0002–0003 | Defer generic facets and their SDK |
| 0004 | Port only compact participant UI if equivalence survives |
| 0005 | Fold structured compact classification into authorship |
| 0006 | Fold still-relevant deployment witnesses into protocol/runtime |
| 0007 | Replace with minimal request actor context |
| 0008 | Fold safe avatar behavior into presentation |
| 0009, 0013 | Drop generalized staging recovery; artifacts fail closed |
| 0010, 0018, 0020 | Retest; keep only if migration startup remains bounded |
| 0011 | Retest packaged-runtime coherence |
| 0012, 0019, 0022 | Fold surviving protocol/validation witnesses |
| 0014, 0017, 0023, 0024 | Fold into request identity authority and negative tests |
| 0015, 0025 | Defer generalized facet queries/cache |
| 0016 | Keep only if minimal SDK reproduces the import collision |
| 0021 | Retest truncated prepared-statement behavior |
| 0026 | Defer header layout refinement |
| 0027 | Defer native appearance; checksum rows |
| 0028 | Defer native prompt stacks; use plugin/request-bound sends |
| 0029 | Fold stored author rendering into presentation |
| 0030 | Port isolated workspace PATH helper |
| 0031 | Split into request-bound and plugin-external capabilities |
| 0032 | Default defer unless owner proves a release-critical invariant |

This table is not the freeze receipt. Inventory every candidate present
tomorrow and record exact upstream symbols, tests, and final disposition.

## Required plugin commands

From `plugins/`:

```sh
bun install --frozen-lockfile
bun run sync:check
bun run references:check
bun run sdk-types:check
bun run typecheck
bun run test
bun run build
```

From `community-plugins/`:

```sh
npm ci
npm run test
npm run typecheck
npm run build
```

Direct-load representative plugins only from the canonical workspace paths and
use `bb plugin source <id>` to prove their origin.
