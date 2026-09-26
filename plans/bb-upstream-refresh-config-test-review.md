# Upstream refresh: bb-app config-persistence test review

Reviewed 2026-09-22 against the read-only replay at
`/tmp/bb-upstream-refresh.84BJxg/bb` (`ecd4538d3`) and its full serial inventory
log. This review did not read or alter live configuration, credentials, or
services, and did not rerun the package suite.

## Inventory evidence

The replay command was:

```text
pnpm exec turbo run test --concurrency=1 --continue=always
```

`packages/bb-app` reported 11 timeouts out of 147 tests, all at Vitest's five
second limit, with no assertion mismatch. The exact evidence is in
`/tmp/bb-upstream-refresh.84BJxg/full-test-inventory-after-contract.log`, lines
8440--8620. The failed tests are:

- stores managed config values from the config command
- preserves customModels across managed config writes
- preserves invalid customModels across managed config set writes
- preserves customAcpAgents across managed config writes
- preserves invalid customAcpAgents across managed config set writes
- preserves invalid customAcpAgents across managed config unset writes
- stores managed env values from the env command
- unsets an invalid server bind host already in managed env
- unsets managed env values
- uses persisted BB_SERVER_URL for config refresh without env or flags
- uses --server-url over env and persisted config for config refresh

## Classification

This is not evidence that JSON persistence itself fails. It is an upstream
source liveness defect exposed by an environment-sensitive fixture boundary.

Every failed `config set`, `config unset`, `env set`, or `env unset` path writes
the managed JSON and then awaits `refreshRunningServerConfigAfterWrite()`.
`packages/bb-app/src/launcher.ts` implements that refresh with:

```ts
await fetch(reloadUrl, { method: "POST" });
```

There is no abort signal or request deadline. The affected tests omit an
explicit `--server-url`/`--server-port` for at least the first write, so their
managed runtime resolves the ordinary production loopback default. If a process
accepts that connection but does not complete the response, Node fetch remains
pending past the five-second test deadline. The same tests can have already
written their synthetic files before the timeout.

The nearby passing cases distinguish this from a lock or serialization failure:

- client configuration mutation passes and does not request a server reload;
- config writes that pass a synthetic test server port complete promptly;
- `packages/bb-app` has no target-to-replay source difference for this behavior.
  Replay-only `packages/config` changes concern P6R/tailnet identity boundary
  configuration, not launcher reload dispatch.

The new managed-JSON lock may make the failures look like write deadlocks only
because its timeout is also five seconds. The source sequence instead reaches
the post-write reload fetch, and the lock is released before that fetch begins.

## Minimal synthetic witness

Add a focused launcher test using a local `node:http` server that accepts the
reload request but deliberately never sends headers or a response. Invoke a
single `bb-app config set` with `--server-url` set to that synthetic URL. The
test should prove that a non-required post-write refresh returns within the
configured short request deadline, reports the existing next-start notice, and
the JSON mutation is present. It must not target the normal loopback port.

This is a more precise witness than rerunning the current test in this host:
the current failure depends on an unknown listener at the production default
address, and exercising it could send a reload request to a live service.

## Minimal repair and invariant

1. Give `refreshRunningServerConfig()` a bounded fetch signal. Reuse the
   existing launcher request-timeout policy (or introduce one explicit reload
   timeout) rather than relying on Node's long default fetch lifetime.
2. For `required: false`, treat timeout/connection failure identically: return
   `false`, retain the successful on-disk mutation, and print the existing
   "apply on next start" notice. For explicit `config refresh` (`required:
   true`), throw the existing clear reachability error rather than hanging.
3. In all write tests that intend no live reload, pass a deliberately closed or
   local synthetic server URL. Keep positive reload tests on their owned
   `startConfigReloadTestServer()` listener.

This preserves the important concurrency invariant from the upstream managed
JSON change: the file lock covers read-modify-write and releases before any
network reload attempt. The repair must not expand the lock across the fetch,
otherwise a hung server could block unrelated config writers and reintroduce a
cross-process liveness failure.

## Verification footprint

Run only the focused `packages/bb-app/test/index.test.ts` launcher cases after
the repair: the new hanging-server witness, one successful reload, one
unavailable-server fallback, managed config set/unset, managed env set/unset,
and persisted/flag server-URL precedence. Then run the package test command.
No browser, full graph, live server, or credential fixture is required for this
diagnosis.

## Approved replay-local repair and evidence

The parent approved and this review applied the minimal repair in the replay
only:

- `packages/bb-app/src/launcher.ts` adds a one-second abort signal to the
  reload fetch and consumes the response body under that deadline. Optional
  post-write reloads fall back only on reachability/timeout failure; explicit
  refresh still fails clearly, and non-success HTTP responses still preserve
  their server error semantics.
- `packages/bb-app/test/index.test.ts` routes no-server persistence cases to
  `http://127.0.0.1:1`, keeps successful cases on owned test servers, and adds
  a local server that accepts the request but never completes its response.
  That witness proves the post-write fallback, persisted JSON, and connection
  cleanup without touching a production loopback listener.

Verification in the replay:

- `pnpm exec vitest run --config vitest.config.ts test/index.test.ts` from the
  workspace root: 111/111 tests passed.
- `pnpm exec tsc --noEmit` from `packages/bb-app`: passed.
- Prettier and `git diff --check` for the two changed replay files: passed.

The repair deliberately does not touch the managed JSON lock, schemas, live
configuration, credentials, or service lifecycle. It is an upstream
source-liveness correction applied in the replay so the parent can decide
promotion separately.
