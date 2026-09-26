# Provider observability probe

Probe artifact: `community-plugins/plugins/analytics/test/skills/probes/`.
It reads controlled raw fixtures and the current bridge/runtime source rather
than invoking a networked provider. The acceptance command is:

```sh
node community-plugins/plugins/analytics/test/skills/acceptance.mjs --suite observability-probe --timeout-ms 120000
```

## Evidence matrix

| Evidence | Codex | Claude Code | Boundary |
| --- | --- | --- | --- |
| Resolved catalog | Controlled root/catalog fixture; before staging | Same controlled root/catalog fixture | Resolved is not active. |
| Active staged catalog | `skills/configure` canonical root payload; Codex stores root paths and applies `skills/extraRoots/set` to live connections | `skills/configure` creates local plugins linked to staged roots for later sessions | Bridge staging is not provider observation. |
| Configure acknowledgement | `{ ok: true }` after Codex forwarding succeeds | `{ ok: true }` after local plugin assembly | An acknowledgement is not proof that a provider ingested or used a skill. |
| Busy-runtime behavior | Runtime has a separately observable bridge-restart deferral when a shared bridge hosts a busy thread | Same runtime behavior | The probe does not relabel it as catalog deferral. |
| Provider-visible/native signal | `skills/changed` exists in the Codex protocol surface but is classified `noise`; no normalized per-skill catalog/activation/body signal | Local plugin injection is visible in session `plugins`; no native activation signal is observed | Unsupported signals remain unsupported. |
| Registered `SKILL.md` read | Unsupported: no native read attribution | `Read` preserves `file_path`/`path`; controlled `SKILL.md` path is attributable by staged-tree containment | Read evidence does not prove activation or instruction effect. |
| Contained subtree read | Unsupported | Controlled `references/current.md` path is attributable by staged-tree containment | A subtree read is distinct from the registered file read. |
| Context snapshot | `thread/tokenUsage/updated` includes aggregate usage/context-window fields, not a skill footprint | Latest request context becomes an estimated context-window observation; `ClaudeContextUsageCollector` additionally reports named `skills.skillFrontmatter` entries | Context occupancy is not provider consumption for a skill. |
| Token report | Aggregate `thread/tokenUsage/updated`; no model/tokenizer identity in this fixture; no per-skill value | Aggregate SDK result usage; fixture names model; no per-skill value | Never apportion aggregate tokens. |

## Raw controlled fixtures and methods

`controlled-skill-root.json` contains one root and one skill tree:
`release-notes/SKILL.md` plus `release-notes/references/current.md`. It is the
source of the resolved catalog and canonical `skills/configure` request.
`provider-events.json` contains the raw task-scoped Claude `Read` inputs,
Claude context/result usage objects, an actual-shaped Claude ContextUsage
`skills.skillFrontmatter` report, its nullable-turn capture metadata, and a
Codex `thread/tokenUsage/updated` object. The suite validates their paths and
current source shapes.

| Report | Provider/model | Tokenizer | Serializer | Method | Result |
| --- | --- | --- | --- | --- | --- |
| Frontmatter footprint | local / no model | none | UTF-8 YAML frontmatter bytes | `ceil(bytes / 4)` heuristic | Local estimate only; not provider context or consumption. |
| Claude named frontmatter context | Claude Code / `claude-sonnet-4-5-20250929` | provider-undisclosed | `ClaudeContextUsageCollector` → `skills.skillFrontmatter` | provider-reported context-usage snapshot, normalized `estimated: true` | Fixture preserves `name=release-notes`, `source=project`, `tokens=22`; nullable `providerTurnId=null`; not body loading, activation, or token consumption. |
| Codex usage | Codex / model unknown in report | provider-undisclosed | `thread/tokenUsage/updated` | provider aggregate | 151 aggregate tokens in fixture; per-skill null/unsupported. |
| Claude usage | Claude Code / `claude-sonnet-4-5-20250929` | provider-undisclosed | SDK result `usage` | provider aggregate | 120 input, 31 output in fixture; per-skill null/unsupported. |
| Claude context | Claude Code / `claude-sonnet-4-5-20250929` | provider-undisclosed | assistant `usage` plus `modelUsage.contextWindow` | provider-reported estimated context snapshot | 120 used, 200000 capacity in fixture; not a skill allocation. |

Current source anchors: `packages/agent-runtime/src/bridge-protocol-adapter.ts`,
`packages/agent-runtime/src/runtime-provider-process.ts`,
`packages/agent-runtime/src/runtime.ts`,
`plugins/provider-codex/src/bridge/bridge.ts`,
`plugins/provider-codex/src/delta-translation.ts`,
`plugins/provider-codex/src/visibility.ts`,
`plugins/provider-claude-code/src/bridge/bridge.ts`,
`plugins/provider-claude-code/src/tool-classification.ts`, and
`plugins/provider-claude-code/src/delta-translation.ts`, and
`plugins/provider-claude-code/src/bridge/context-usage.ts` under `fork/upstream`.
They were inspected at `fork/upstream` commit
`267938526dfcbc0edb228ce827b5bec202c1af97`; the probe reads those paths on
each run, so an incompatible shape fails rather than silently retaining this
snapshot.

### Claude named-frontmatter snapshot limits

The collector emits this report after a `result` or `system:compact_boundary`
message only when a provider session ID exists. It stamps the normalized
snapshot with `providerTurnId: null`; it is session-scoped and may lag the turn
that produced it. `estimated: true` means the provider-reported context report
is normalized as an estimate; it does **not** turn the local UTF-8
`ceil(bytes/4)` heuristic into a provider report. The collector invalidates on
new input/messages, suppresses stale or non-current reads by revision, and
gives up after 5 seconds. Those controls prevent a racing in-memory stale
publish; they are not a durable cross-restart snapshot deduplication key.

## Reproduction

```sh
node --check community-plugins/plugins/analytics/test/skills/probes/run.mjs
node community-plugins/plugins/analytics/test/skills/acceptance.mjs --suite observability-probe --timeout-ms 120000
pnpm --dir fork/upstream/plugins/provider-claude-code test -- src/bridge/__tests__/skill-plugins.test.ts --maxWorkers=1
pnpm --dir fork/upstream/plugins/provider-claude-code test -- src/bridge/__tests__/bridge.test.ts --maxWorkers=1 -t 'assembles a local plugin per generic skill root'
pnpm --dir fork/upstream/plugins/provider-codex test -- src/native-roots.test.ts --maxWorkers=1
pnpm --dir fork/upstream/plugins/provider-codex test -- src/bridge/bridge.conformance.test.ts --maxWorkers=1
```

The Agent Runtime capability test was also attempted directly, but this checked
out source lacks its generated `packages/agent-runtime/dist/test-bridges/`
scripted echo provider. The failure establishes a materialization prerequisite,
not a provider-signal result; the scoped probe instead asserts the current
runtime source shape and the passing provider-local tests above.

This is implementation evidence only. It does not adjudicate the reviewer
oracle for `skills-observability-probe`.
