# Upstream-refresh desktop and templates test remainder review

Reviewed 2026-09-22 against replay `/tmp/bb-upstream-refresh.84BJxg/bb`
at `02020cdb1`. This is read-only diagnosis; no product source, dependency,
host-package, runtime, or configuration change was made.

## Desktop N-API SQLite witness — host prerequisite

The failing assertion is
`apps/desktop/test/electron-builder-config.test.ts:470-504`. It invokes the
native preparation script, which invokes the Electron executable to load
`better-sqlite3` and execute an in-memory query
(`apps/desktop/scripts/prepare-native-modules.cjs:181-220`). The recorded
process never reaches that verification: the dynamic loader rejects Electron
because this host lacks `libgtk-3.so.0`.

This is not evidence of a bad SQLite prebuild, packaging configuration, or
legacy-prebuild fallback. It is a Linux desktop-runtime prerequisite missing
from the test host. Do not make `prepare-native-modules.cjs` suppress the
loader error: that would turn a genuine packaged-native failure into a false
success.

Safe verification choices:

- run this single native witness in a Linux desktop CI image/container which
  includes GTK 3; or
- explicitly mark the host ineligible for this one Electron execution while
  retaining its static packaging checks, with a separate GTK-capable required
  job for the runtime assertion.

Neither choice requires an application dependency change. No matching
`apps/desktop` change exists between upstream target
`78804e79d280998a3b4c3c965ec1b5845703bc0e` and this replay.

## AppImage child-mount witness — unconfirmed timing flake

The recorded full desktop suite timed out after Vitest's default five seconds
in `apps/desktop/test/bb-process.test.ts:180-214`. The same focused test was
then run read-only and passed in 42 ms (one test passed, seven skipped; total
duration 174 ms):

```text
corepack pnpm --dir apps/desktop exec vitest run --config vitest.config.ts \
  test/bb-process.test.ts -t 'imports the bridge from the child AppImage mount'
```

The test exercises `createBbAppProcessLaunch`, but spawns it with
`execFile`; production calls `startBbAppProcess`, which uses a detached
AppImage supervisor (`apps/desktop/src/bb-process.ts:90-191, 271-350`). The
supervisor deliberately remains alive while its process group still has live
descendants. There is no repeatable source-level failure from one timeout.

Before changing runtime code, add a bounded, isolated/repeat witness to
determine whether the failure depends on the shared-worker suite. If it
recurs, improve this test fixture's launch/cleanup and timeout diagnostics (or
exercise the production detached launch with controlled cleanup). Do not add
a blanket supervisor deadline: that would weaken its intended descendant
containment behavior and can orphan a child bridge. No relevant desktop source
diff exists target-to-replay.

## External plugin-scaffold install — cache-policy hypothesis and narrow fix

`packages/templates/test/plugin-scaffold-external.test.ts:265-284` packs the
local SDK and runs `npm install` with `--prefer-offline`. There is no workspace
`.npmrc`; `npm config get registry` reports `https://registry.npmjs.org/`.
An explicit public-registry read with an isolated temporary cache resolved
`@hugeicons/core-free-icons@4.3.4` successfully. Together with the explicit
`--prefer-offline` flag, this supports (but does not prove without inspecting
or clearing the operator cache) the hypothesis that the recorded `ETARGET` was
stale shared npm metadata rather than an unpublished package or an unsupported
target dependency. The declarations and lockfile contain the expected 4.3.4
entry.

If a source change is authorized, the narrow choices are:

- replace `--prefer-offline` with `--prefer-online` only in this explicitly
  external/network contract test, preserving `--ignore-scripts`,
  `--no-package-lock`, and `--no-save`; or
- make the test supply a dedicated, intentionally pre-seeded cache/registry
  fixture that contains the exact package metadata it requires.

The first option validates public installability but is network-dependent; the
second is deterministic but needs a maintained fixture. Do not change the
Hugeicons version merely to mask a stale-cache candidate. The first option was
authorized and applied as a one-line replay-local change at
`packages/templates/test/plugin-scaffold-external.test.ts:279`.

With `npm_config_cache` pointed at a new temporary cache, the focused external
test file passed both tests in 25.01 seconds: it packed the SDK, resolved the
online metadata, typechecked, and ran the backend and frontend scaffold tests.
The original `ETARGET` did not recur. A broader
`turbo run test --filter=@bb/templates` attempt still failed earlier in its
shared suite at `npm pack`, without stderr; a direct identical pack command
then passed. That is a separate shared-suite/intermittent diagnostic and does
not establish a failure in this installer change. No shared npm cache was
cleared or inspected.

The existing pack helper invokes `execFileAsync("npm", ["pack", "--silent",
"--ignore-scripts", "--pack-destination", packDir], { cwd: pluginSdkRoot })`.
It lets an `execFile` rejection escape unchanged, so Vitest reports only the
command in `Error.message`; the recorded broad failure has no exit code,
signal, stdout, or stderr. The external test allocates a unique
`bb-external-pack-*` root and no templates test changes process cwd, so there
is no observed shared pack-destination collision. The full run did overlap
this beforeAll with the 6.8-second shim-types test, while the focused external
file passed. The current evidence therefore cannot distinguish resource or
subprocess scheduling from another shared-run interaction.

If a further test-only change is authorized, make `packPluginSdk` rethrow a
redacted fixed diagnostic containing only command arguments, cwd, exit code,
signal, stdout, and stderr. Do not print environment values. The next
scheduled witness should compare the normal run with one that disables file
parallelism (or runs this file alongside shim-types only); no repeat was run
after this diagnostic review request.

The parent-approved capped witness subsequently ran exactly once with
`GOMAXPROCS=1`, `--maxWorkers=1`, `--maxConcurrency=1`, and
`--no-file-parallelism`. It still failed at the identical pre-install `npm
pack` command; the external test was skipped after its beforeAll failed, while
the other five test files passed. The log is
`/tmp/bb-upstream-refresh-templates-capped.log`. This rules out Vitest file
parallelism as the explanation, but the helper still discarded the child exit
code, signal, stdout, and stderr. Its unique temporary pack root was cleaned
by afterAll, and the log has no `ETARGET`. Do not retry without first adding
the bounded test-only failure receipt described above.

That receipt was then added only around `packPluginSdk`'s `execFileAsync`
rejection. It preserves the command, arguments, cwd, success path, and cause;
its fixed report redacts basic-auth URLs and auth/token/password/secret/API-key
values and caps each stream at 4 KiB. The single parent-approved capped
witness then reported `npm pack` exit code `226`, `killed: false`, and no
signal, errno, syscall, stdout, or stderr. The full Turbo command exited 1;
the log is `/tmp/bb-upstream-refresh-templates-pack-diagnostic.log`.

This confirms that the failure is an ordinary nonzero child exit rather than a
timeout or signal, and remains pre-install (not an `ETARGET`). It does not
identify npm's internal cause because it emits no inherited stream output. No
further repair or retry is authorized from this evidence.

## Exit 226 and Turbo environment admission

The requested temporary cache was passed as `npm_config_cache`, which works for
the direct focused invocation. Turbo's root `test` task explicitly documents
that strict mode strips undeclared variables and admits only
`UPDATE_PARITY_ROW_COUNTS` and `UPDATE_TRANSCRIPT_EXPECTATIONS`
(`turbo.json:584-594`). The specialized `@bb/templates#test` task adds its
dependencies but no cache-variable admission (`turbo.json:596-607`). The
installed Turbo schema defines strict mode as filtering variables to declared
`env`/`globalEnv` entries and defines `passThroughEnv` as the allowlist
(`node_modules/turbo/schema.json:275-279, 647-651`). Thus the temporary npm
cache does not survive the Turbo task boundary into Vitest and its npm child.

Npm initializes both its cache and log directory before a command runs
(`npm/lib/npm.js:141-151`), and its default log directory is below that cache
(`npm/lib/npm.js:411-416`). This explains why a filtered task can fail before
pack output, while the direct command with the writable temporary cache works.
On this Node runtime `EROFS` is errno 30 and `(-30) & 255` is 226. That makes
the child result consistent with a read-only cache/log write, but exit 226 by
itself is not conclusive proof of EROFS.

`npm pack --ignore-scripts` suppresses both the local `prepack` and `postpack`
lifecycle hooks (`npm/node_modules/libnpmpack/lib/index.js:19-28, 45-59`). The
remaining explicit pack write is the tarball under the supplied temporary
`pack-destination` (`npm/node_modules/libnpmpack/lib/index.js:37-43`), which
was writable. The cache/log path is the
remaining unqualified writable destination.

If a fix is authorized, the narrow repair is to add `npm_config_cache` to
`@bb/templates#test`'s `passThroughEnv` in `turbo.json`, then invoke the test
with an explicit writable temporary cache. This preserves strict mode and does
not expose all environment variables. The templates gate remains unresolved
until that bounded verification is scheduled and passes.
