# Lane A discovery: ambient execution context and multiplayer attribution

Date: 2026-09-09
Workspace: `/home/ubuntu/bb`
Status: T1 discovery only; no production source changed

This note covers the A lane in the delivery plan: CLI context, host-daemon and
provider launch context, internal execution and job forwarding, and the exact
server receiving seam to be assigned by root. It is an implementation proposal
for the pending T1 contract. It does not define a second identity protocol and
does not authorize production edits before G1.

The required policy is the approved ADR: resolve a verified current person when
available, use applicable carried attribution next, then use a stable machine
actor; missing or failed person evidence must not block ordinary work
([ADR](../../docs/adrs/2026-09-identities-and-multiplayer.md:35-59)). The model
wrapper is exactly the minimal `[from=label]` form, with structured metadata
kept outside model text ([ADR](../../docs/adrs/2026-09-identities-and-multiplayer.md:78-105)).

## Existing path and what it already proves

The current path has explicit boundaries that should be extended rather than
replaced:

| Boundary | Existing mechanism | A-lane implication |
| --- | --- | --- |
| CLI context | `CliRuntimeContext` owns the loaded CLI config; `BB_PROJECT_ID` and `BB_THREAD_ID` are validated environment context, and `BB_THREAD_ID` drives `--self` ([context-env.ts](../../fork/build/bb/apps/cli/src/context-env.ts:1-112)) | Keep context per command/runtime closure. `BB_THREAD_ID` can identify a sender thread for carried context, but it is not proof of the current person. |
| CLI transport | `createCliBbSdk` builds a node SDK with a small `cliFetch` wrapper and currently supplies no actor header ([client.ts](../../fork/build/bb/apps/cli/src/client.ts:1-15)) | Do not invent a forgeable person header. A transport extension is optional and only useful for a server-validated source hint. |
| Local machine lookup | `resolveLocalHostId` asks the local daemon for its host ID and caches it per CLI process ([daemon.ts](../../fork/build/bb/apps/cli/src/daemon.ts:1-13)) | This is a known local execution/target machine when a command actually selects a host environment. It does not prove the origin of a direct HTTP request. |
| Server request context | Hono context stores the trusted remote address, gate auth kind, gate machine ID, and plugin lineage ([request-context.ts](../../fork/build/bb/apps/server/src/request-context.ts:10-75)); the app captures the remote address per request ([server.ts](../../fork/build/bb/apps/server/src/server.ts:452-468)) | Use request-scoped Hono context or explicit route arguments. Never use process-global or async-local “current person” state. |
| Authenticated machine ingress | `resolveReportedConnectMachineId` accepts an unverified report as-is for non-machine gate requests, but for machine gate auth requires the reported ID to match the authenticated gate machine ID ([hosts.ts](../../fork/build/bb/apps/server/src/internal/hosts.ts:21-46)). The host proxy adds only its existing machine credential to proxied HTTP and WebSocket requests ([machine-auth-proxy.ts](../../fork/build/bb/apps/host-daemon/src/machine-auth-proxy.ts:93-103), [machine-auth-proxy.ts](../../fork/build/bb/apps/host-daemon/src/machine-auth-proxy.ts:125-155). | A source machine may be trusted only after this existing gate/credential verification. Do not read `x-bb-connect-machine` as a machine ID in an ordinary route. |
| Host session | The daemon opens a server session with its authenticated `hostId`, `instanceId`, host name, platform and protocol version ([session.ts](../../fork/build/bb/apps/server/src/internal/session.ts:76-110); [server-client.ts](../../fork/build/bb/apps/host-daemon/src/server-client.ts:435-459)) | This is a durable, authenticated executing machine fact. Host name is presentation; host ID is the stable key. |
| Dispatch hook | The server assembles one request-scoped hook context from the thread, environment, intended host, input, origin, parent and queued row ([dispatch-hooks.ts](../../fork/build/bb/apps/server/src/services/threads/dispatch-hooks.ts:296-325)). Its evaluation lock serializes admission questions ([dispatch-hooks.ts](../../fork/build/bb/apps/server/src/services/threads/dispatch-hooks.ts:328-365)) | Add attribution as an explicit field to this context only after T1. Do not put it in a module-level current actor. |
| Acceptance history | Turn request events already persist initiator, sender thread, input groups, retry marker and native authors/editors ([thread-events.ts](../../fork/build/bb/packages/domain/src/thread-events.ts:105-134)); the server writes those fields transactionally ([thread-events.ts](../../fork/build/bb/apps/server/src/services/threads/thread-events.ts:255-285)) | Accepted attribution belongs with this request event and is the source for later queue/retry work. `senderThreadId` is a relationship, not a person claim. |
| Queues | Inline queue rows carry aligned authors/editors; retry rows point to the original request ([queued-message.ts](../../fork/build/bb/packages/domain/src/queued-message.ts:151-198)). Queue creation freezes attribution ([queued-messages.ts](../../fork/build/bb/apps/server/src/services/threads/queued-messages.ts:209-255)); drain replays rows and reloads retry attribution ([queued-messages.ts](../../fork/build/bb/apps/server/src/services/threads/queued-messages.ts:476-511), [queued-messages.ts](../../fork/build/bb/apps/server/src/services/threads/queued-messages.ts:797-829)) | Read accepted attribution from the row or original request. Do not try to recover it from the request that wakes the queue. |
| Provisioning | The thread provisioning request is a parsed durable object copied through every stage ([thread-provisioning-context.ts](../../fork/build/bb/apps/server/src/services/threads/thread-provisioning-context.ts:71-113), [thread-provisioning-context.ts](../../fork/build/bb/apps/server/src/services/threads/thread-provisioning-context.ts:328-418)) | If T1 puts accepted attribution in this envelope, every constructor including reprovisioning must copy it. One writer must own the shared schema. |
| Host execution | Server command construction knows the selected environment host ([thread-commands.ts](../../fork/build/bb/apps/server/src/services/threads/thread-commands.ts:261-302), [thread-commands.ts](../../fork/build/bb/apps/server/src/services/threads/thread-commands.ts:305-343)). Live RPC records host ID and an execution ID ([live-command.ts](../../fork/build/bb/apps/server/src/services/hosts/live-command.ts:197-220)); the RPC envelope targets that host ([online-rpc.ts](../../fork/build/bb/apps/server/src/services/hosts/online-rpc.ts:163-175)) | Record execution origin beside the accepted initiator. The host target is strong evidence of where work executes, not who initiated it. |
| Daemon/runtime | The daemon has a stable `{hostId, hostName, instanceId}` identity ([daemon.ts](../../fork/build/bb/apps/host-daemon/src/daemon.ts:1-32)). Commands are explicitly routed and serialized by thread/environment lanes ([command-router.ts](../../fork/build/bb/apps/host-daemon/src/command-router.ts:64-107), [command-router.ts](../../fork/build/bb/apps/host-daemon/src/command-router.ts:264-275)). Runtime calls receive explicit input/options, while per-thread runtime config survives bridge restart ([types.ts](../../fork/build/bb/packages/agent-runtime/src/types.ts:118-205), [runtime.ts](../../fork/build/bb/packages/agent-runtime/src/runtime.ts:186-200), [runtime.ts](../../fork/build/bb/packages/agent-runtime/src/runtime.ts:1024-1055)) | If a structured execution field is needed, carry it per command and per runtime thread. Do not place identity in shell environment or a router singleton. |

The existing server fallback identity is also suitable for the receiving-machine
case. `initializeP6rInstanceNamespace` stores one generated value in the BB
database and returns the stored value on later starts
([sidecar-store.ts](../../fork/build/bb/apps/server/src/services/p6r/sidecar-store.ts:187-210));
the app initializes it once and passes it to the identity admission service
([server.ts](../../fork/build/bb/apps/server/src/server.ts:583-624)). T1 should
decide whether this value is the stable instance-scoped machine key or is used
to seed a named machine record. Either way, a bare request must use this
receiving instance and must not guess a remote host.

## Minimal ambient path after T1

The smallest useful implementation has three explicit snapshots and one
resolution point:

```text
request acceptance
  -> current request actor (verified person, when valid/applicable)
  -> carried initiator (accepted request/thread/job, when applicable)
  -> source/execution machine (only when authenticated or selected by host context)
  -> receiving BB instance machine fallback
  -> durable request/queue/provisioning record
  -> explicit host command execution origin
```

T1 should name the snapshots, but they should express these distinct facts:

* `currentActor` is the actor evidenced by this request. A verified person has
  provider evidence; a machine fallback has machine evidence. A client-submitted
  person object is never trusted just because it is present in SDK context.
* `initiator` is the accepted originating person or actor carried from the
  owning request, parent/source thread, or accepted job. It can identify the
  person who started the work without claiming that a later agent turn is a new
  verified submission from that person. Existing `initiator`, `senderThreadId`,
  `parentThreadId`, `origin`, and `startedOnBehalfOf` remain useful links, but
  none should be overloaded as a person identity.
* `executionOrigin` identifies the runtime that performs the operation: BB
  server/instance, authenticated host daemon, host ID, and live command or
  request execution ID where available. It is not an author and should not
  overwrite the accepted initiator.

At the server boundary, resolve once and pass the resulting immutable snapshot
through explicit function arguments. The native acceptance owner should attach
the current author and applicable carried initiator to the accepted request;
A should then carry that result through command construction and job execution.
The current native send path already takes authors/editors explicitly and
reloads original retry attribution from the original request
([thread-send.ts](../../fork/build/bb/apps/server/src/services/threads/thread-send.ts:93-113), [thread-send.ts](../../fork/build/bb/apps/server/src/services/threads/thread-send.ts:459-475)).
That is the right shape to preserve.

The first release should generate the minimal sender wrapper before the host
command is sent, using the structured author snapshot and aligned
`inputGroups`. The current send path already prepares the command from wrapped
input groups ([thread-send.ts](../../fork/build/bb/apps/server/src/services/threads/thread-send.ts:747-765));
there is no reason to expose identity JSON through the provider or shell. This
avoids a host-daemon protocol change in the first slice. If a later provider or
tool genuinely needs structured attribution, add one optional namespaced field
to the existing `thread.start` and `turn.submit` commands only, validate it at
both boundaries, and bump the exact protocol version. Those command schemas are
currently strict and only carry input groups plus runtime context
([commands.ts](../../fork/build/bb/packages/host-daemon-contract/src/commands.ts:275-300), [commands.ts](../../fork/build/bb/packages/host-daemon-contract/src/commands.ts:334-346));
the current protocol is version 180 ([protocol.ts](../../fork/build/bb/packages/host-daemon-contract/src/protocol.ts:1)).

The CLI should continue to work without a new credential ceremony:

1. `BB_THREAD_ID` and existing `senderThreadId`/parent/source fields may carry
   a thread relationship. The server resolves any inherited attribution from
   accepted history; the CLI does not assert that it is the person.
2. A command that selects an existing environment gives the server an
   execution host through the environment row. A new host environment already
   names a host in its intent; the dispatch hook has an `intendedHostId` for
   this cold-start case ([dispatch-hooks.ts](../../fork/build/bb/apps/server/src/services/threads/dispatch-hooks.ts:77-99)).
3. `resolveLocalHostId` may help the CLI fill an existing host target when the
   local daemon is available. Its failure must not block a valid operation;
   resolution falls back to the server machine.
4. Direct SDK/CLI HTTP requests without an authenticated source-machine
   signal use the receiving BB instance machine actor. Do not derive a source
   machine from `BB_SERVER_URL`, a URL hostname/path, the Unix account, or a
   caller-provided hostname.
5. Requests arriving through the machine-authenticated gate may use the gate's
   verified machine ID. The existing machine proxy sends a credential, while
   the server's gate context exposes the verified ID; A must consume the latter,
   never interpret the secret itself as an actor key.

The SDK's empty `BbSdkContext` can become a per-client carrier only if T1 needs
it for a structured, server-validated source hint. It must not become a global
current actor and must not accept `person`, `evidence`, issuer, or subject from
an ordinary client. The smallest first slice can leave SDK transport unchanged
and use the existing explicit payload and server-side resolution seams.

## Source-machine selection matrix

| Situation | Accepted attribution | Execution/source machine fact | Resulting fallback |
| --- | --- | --- | --- |
| Current request has valid provider person evidence and a selected host | Current verified person for this request; preserve any separate carried initiator | Selected environment or live host ID is execution origin | No machine replacement of the person author |
| Tagged remote host creates a child in an existing environment | Carried parent attribution if applicable; current person only if the request independently supplies valid evidence | Existing environment host ID, authenticated daemon session, and live RPC host ID | Host machine may be recorded as execution/source only; never label it as the parent person |
| Tagged remote host creates a new environment naming a host | Same as above | `environmentIntent.hostId` / `intendedHostId` identifies the intended execution host before attachment | Use that host for execution context; if it is not actually authenticated/available, preserve the distinction and use the receiving machine for unknown transport source |
| CLI request reaches server through an authenticated machine gate | Current verified person if independently present; otherwise carried accepted actor | Gate machine ID after existing machine auth validation | Gate machine can be the known ingress machine; do not treat the credential string as its key |
| Loopback CLI or direct SDK request with no person/source-machine context | No invented person; carried attribution only if an applicable accepted source exists | Receiving server only | Stable receiving-instance machine actor |
| Bare remote HTTP request with no source-machine context | No invented remote actor | Receiving server only | Stable receiving-instance machine actor; do not guess Rosetta from hostname/path/user |
| Queue wake, retry, or background job | Accepted author/initiator from queue row or original request | Host selected by the resumed command, plus live execution ID | Preserve accepted attribution even after request context is gone |
| Provider unavailable, rejecting, timing out, or not applicable | Valid current person if already captured; otherwise carried actor; otherwise machine | Same host selection rules | Continue with the applicable machine fallback; provider health is not an availability gate |

This matrix makes the unavoidable loss of precision visible. A server that
receives a direct HTTP request cannot know which remote machine originated it;
calling it `machine:rosetta` because the server is reachable from Rosetta would
be a false claim. Machine labels are presentation only and must remain separate
from stable keys and evidence.

## Queue, job, and restart propagation

The queue wake itself carries only a thread/wake log context. It schedules work
with `deferAfterResponse`, which stores a logging record and calls the work later
([queued-message-dispatch.ts](../../fork/build/bb/apps/server/src/services/threads/queued-message-dispatch.ts:115-157));
`deferAfterResponse` does not propagate request state
([response-deferral.ts](../../fork/build/bb/apps/server/src/services/lib/response-deferral.ts:4-23)).
This is a useful boundary: queue dispatch must read accepted attribution from
the durable row or request event, rather than attempting ambient propagation
from the original Hono request.

The existing durable objects are enough for the first additive contract:

* Inline queued messages store aligned author/editor arrays and should keep
  machine variants in the same codec. Their row is the immutable accepted
  snapshot while waiting.
* Retry rows should continue to carry only the original request ID and attempt;
  the retry path should reload the original accepted attribution, as it already
  does in `thread-send.ts`, and record the retry invocation separately.
* A pending thread start uses `ThreadProvisionContext.request` across metadata,
  environment, workspace, and restart stages. `createReprovisioningContext`
  currently reconstructs a request object from arguments
  ([thread-provisioning-context.ts](../../fork/build/bb/apps/server/src/services/threads/thread-provisioning-context.ts:433-460));
  a new attribution field must be copied there or it will silently disappear
  only on reprovisioning.
* Live host command execution already has a generated execution ID and host ID.
  Keep this execution record beside the accepted request; do not rewrite the
  request author after a retry or host reconnection.

For provider bridge restart, `threadRuntimeConfigs` is per thread and already
rebuilds a runtime from explicit saved configuration
([runtime.ts](../../fork/build/bb/packages/agent-runtime/src/runtime.ts:186-200), [runtime.ts](../../fork/build/bb/packages/agent-runtime/src/runtime.ts:1024-1055)).
If T1 requires provider-side structured attribution, store it there per thread;
otherwise keep attribution in server history and leave the runtime contract
unchanged. Do not put it in `BB_*` shell variables: the shell environment is
intentionally the project/thread/environment context ([thread-shell-environment.ts](../../fork/build/bb/packages/agent-runtime/src/thread-shell-environment.ts:17-29)),
and arbitrary commands must not mistake a BB sender for the OS user.

## Proposed ownership after G1

Root should publish the exact T1 DTO and assign one writer for every shared
declaration before A changes code. The following split keeps A focused on
carrying context:

**A production files, if the contract requires changes:**

* `fork/build/bb/apps/cli/src/client.ts` and `context-env.ts` for a per-client
  context carrier and existing CLI context snapshot; `daemon.ts` and
  `commands/thread/{spawn,fork,actions}.ts` for explicit source-thread and
  host-target forwarding.
* `fork/build/bb/apps/server/src/request-context.ts` and the middleware in
  `server.ts` for request-scoped receiving/source-machine facts, only after root
  assigns this receiving adapter to A. Gate credential verification remains in
  the existing auth path.
* `fork/build/bb/apps/server/src/services/threads/thread-commands.ts` for
  explicit execution-origin/attribution attachment to the already-built host
  command, if the first contract needs a daemon field.
* `fork/build/bb/apps/server/src/services/hosts/live-command.ts` and
  `online-rpc.ts` for the execution record/RPC forwarding, if that metadata is
  not already represented by the selected T1 DTO.
* `fork/build/bb/apps/host-daemon/src/server-client.ts` and
  `server-connection.ts` for authenticated host-session context, then
  `command-router.ts` and `command-handlers/thread.ts` for per-command
  forwarding. `packages/agent-runtime/src/types.ts` and `runtime.ts` are only
  in scope if provider/runtime callbacks need the structured field after the
  server-side wrapper slice.

**Root/N shared or durable files that A should not edit without an explicit
single-writer assignment:**

* `packages/domain/src/p6r-message-author.ts`, `thread-events.ts`,
  `queued-message.ts`, and the server-contract response/request codecs define
  the actor variants and compatibility behavior. Root owns the public
  declarations under the plan.
* `apps/server/src/services/p6r/native-request.ts`,
  `native-acceptance.ts`, `provider-admission.ts`, and sidecar persistence own
  resolution and immutable acceptance. N owns the native admission/durable
  implementation under the plan.
* `apps/server/src/services/threads/thread-send.ts`,
  `dispatch-attempt.ts`, `queued-messages.ts`, `thread-events.ts`,
  `thread-provisioning.ts`, edit, and retry handlers already write and reload
  authorship. N owns these overlaps unless root splits an adapter function
  explicitly. A can provide a requested field contract and forwarding patch,
  but should not duplicate acceptance logic.
* `packages/host-daemon-contract/src/commands.ts` and `session.ts` are shared
  wire declarations. A may propose an optional field, but root owns the final
  contract, protocol bump, generated declarations, and compatibility tests.
* `apps/server/src/services/threads/queued-message-dispatch.ts` must not infer
  an actor from its wake context. If it needs an adapter, A can own the small
  forwarding call only after N's durable row shape is fixed.

The current simple-sender-wrapper work is dirty authored work in the fork. Keep
`fork/patches/0023-fix-p6r-simple-sender-wrappers.patch` and its series/hash/tree
metadata intact. The wrapper's content rule is settled by the ADR; this lane
should not broaden it to carry JSON, evidence labels, or verification prose.

## Concurrency and compatibility witnesses

The G3 proof should exercise independent request objects and durable records,
not merely inspect types. Recommended focused witnesses are:

1. **Request isolation.** Extend
   `fork/build/bb/apps/server/test/request-context.test.ts` with two concurrent
   Hono requests whose actor/provider resolution is deliberately delayed by
   separate latches. Assert that each request sees only its own actor and that a
   failed resolver produces machine fallback. This catches a process-global
   current-person map and proves Hono context lifetime.
2. **Concurrent sends.** Use
   `fork/build/bb/apps/server/test/threads/thread-send-dispatch.test.ts` (or a
   focused sibling) to send A and B with `Promise.all`, different accepted
   contexts, and a shared server. Assert event authors, wrappers, and execution
   origins stay paired. A request that resolves later must not overwrite the
   first request.
3. **Queued acceptance and drain.** Extend
   `requested-queue-drain.test.ts` and `queue-drain-failure.test.ts` with two
   rows from different initiators, a wake after the original request has
   completed, and one failed/retried drain. Assert row authors remain aligned
   and the wake's lack of request context does not change them.
4. **Retry and restart.** Extend `turn-failed-retry.test.ts` and
   `thread-live-start-handoff.test.ts` to clear active/request context between
   attempts, restart/reconnect the host, then assert original accepted author,
   later editor, initiator links, and executing host are distinct. Preserve the
   existing test that rejects the second of two concurrent retries
   (`turn-failed-retry.test.ts:576-593`).
5. **Provisioning copy.** Exercise a pending start through each
   `ThreadProvisionContext` stage and `createReprovisioningContext`; assert the
   accepted attribution survives a restart and host handoff. This specifically
   guards the reconstruction loss at `thread-provisioning-context.ts:433-460`.
6. **Daemon per-thread isolation.** Extend
   `fork/build/bb/apps/host-daemon/test/command/thread-dispatch.test.ts` and
   `thread-stop-races.test.ts` with two thread commands in flight, and use
   `fork/build/bb/packages/agent-runtime/src/runtime.lifecycle.test.ts` for two
   provider threads sharing a process. Assert attribution is passed by command
   and never read from another thread's runtime configuration.
7. **Source-machine trust.** Keep the existing machine proxy and session
   coverage in `apps/host-daemon/src/machine-auth-proxy.test.ts` and
   `server-connection.test.ts`; add server assertions in
   `apps/server/test/host-join-enroll.test.ts` that a verified gate machine is
   accepted, an unverified/mismatched report is not upgraded, and a bare request
   gets the receiving machine. Existing proxy tests already cover credential
   injection and caller override resistance.
8. **Wire compatibility.** If T1 selects a daemon field, update
   `packages/host-daemon-contract/test/contract.test.ts`, the server/daemon
   strict parsers, and protocol mismatch coverage in
   `apps/host-daemon/src/protocol-self-update.test.ts`. Verify old daemons fail
   with the existing protocol mismatch behavior rather than silently dropping
   accepted attribution. If model wrapping remains server-side, keep this
   protocol change out of the first release slice.
9. **Wrapper exactness.** Reuse the current native authorship test witness and
   assert one wrapper per input group, original content preservation, author then
   editor fallback, unknown unwrapped, delimiter escaping, and absence of JSON,
   issuer/subject, avatar, evidence, or verification prose.

The two-person concurrency test, queue/retry/restart tests, and tagged-host
live test are separate evidence. Forged headers or a local browser render do
not prove real source-machine attribution. The ADR explicitly requires real
tagged-host and loopback/bare-request acceptance alongside race coverage
([ADR](../../docs/adrs/2026-09-identities-and-multiplayer.md:200-206)).

## Risks and decisions required from root

* **Transport ambiguity:** a CLI talking directly to BB has no trustworthy
  source-machine fact. Treating a client hint as authoritative would create a
  spoofable actor. The first contract should prefer server-side host context
  and receiving-instance fallback over a new header.
* **Execution/initiator collapse:** the daemon host is the machine executing a
  command, while the parent/request actor is the initiator. Keep both fields in
  every durable boundary where both are known. Never relabel an agent message
  as the parent person merely because `senderThreadId` or `startedOnBehalfOf`
  points to that person-owned thread.
* **Reconstruction loss:** queued work and reprovisioning intentionally run
  after request scope is gone. Durable request/queue fields are authoritative;
  ambient memory can only be a live optimization.
* **Protocol maintenance:** adding a daemon field touches strict schemas,
  generated SDK declarations, server and daemon protocol version checks, and
  old-daemon behavior. Server-side sender wrapping meets the first model need
  without this cost.
* **Shared-file overlap:** A's natural seams (`request-context.ts`,
  `thread-commands.ts`, `live-command.ts`, and provisioning/queue adapters)
  overlap root/N acceptance and contract files. Root must publish the G1
  allowlist and single-writer assignments before any implementation turn.

The proposed release order is therefore: root defines the additive actor,
evidence, initiator, execution-origin, and machine-key codec; N makes native
acceptance and durable records usable with machine fallback; A forwards those
accepted snapshots through existing explicit host/job seams; U formats only the
minimal sender label; then V exercises real transport and concurrent races.
This satisfies the plan's G3 requirement to carry context without a new
credential ceremony while keeping missing context on the G2 machine fallback
path ([Pkl delivery plan and lane ownership](../identities-and-multiplayer.plan.pkl)).

No production source, generated materialization, child HEAD, service, or runtime
was changed for this discovery. Existing dirty authored work was preserved.

## T3 focused witness handoff (2026-09-09)

The disposable verification tree `/tmp/bb-identity-patch-verification` confirms
that the smallest ambient slice needs no new DTO, wire protocol, credential, or
person header. A bare public request is accepted with the receiving server's
machine author (`evidence: "machine"`, `identity.kind: "machine"`, stable
`p6r-machine:v1:<instance>:server` key); `withP6rNativeAuthorContext` adds only
`[from=machine:bb-machine]` and its closing marker to the host command. The
accepted `client/turn/requested` event and queued row retain the original input
and structured `p6rAuthors` separately. The source event's `initiator` and
`senderThreadId` remain the honest operation context; they must not be replaced
with the executing machine or inferred parent owner.

The seven wrapper failures in `/tmp/bb-identity-server-test.log` are confined
to these expectations and should be updated by the server-test owner:

* `apps/server/test/public/public-thread-fork.test.ts:402,460,567`: assert the
  exact machine wrapper around the original input, then parse the accepted
  `client/turn/requested` event and assert the unchanged original blocks,
  initiator, senderThreadId where present, and machine `p6rAuthors`.
* `apps/server/test/public/public-thread-offline-followup.test.ts:161`: before
  reconnect/drain, parse the durable queued row's original `content` and
  `p6rAuthors` object; after drain assert exact machine wrapping in the command
  and original input plus machine authorship in the accepted request event.
* `apps/server/test/public/public-thread-data.test.ts:894,3171`: assert exact
  wrapper plus unchanged attachment/message blocks; for the idle queued send,
  assert the accepted request event's original input and machine `p6rAuthors`
  because the row is consumed by the automatic drain.

The wrappers must not contain identity JSON, stable keys, issuer/subject,
evidence labels, avatar URLs, or verification prose; those remain structured in
the event/queue attribution. The existing native authorship implementation
already enforces this ([native-authorship.ts](../../fork/build/bb/apps/server/src/services/p6r/native-authorship.ts)).

The candidate's whole-workspace typecheck also reports one CLI-only error at
`apps/cli/src/commands/settings.ts:121`: a machine identity has no `subject`.
The narrow correction is a discriminated fallback for readable output, for
example `actor.identity.kind === "person" ? actor.presentation.handle ??
actor.identity.subject : actor.presentation.handle ?? actor.identity.hostId ??
actor.identity.instanceId` (the machine branch should never read person fields).
Add a `settings p6r-identity` command-output fixture with a machine actor and
assert the human-readable line; keep `--json` as the raw structured response.

No production or test edit could be applied in the disposable tree because the
execution approval layer rejected writes there: root `AGENTS.md` designates the
nonexistent `/home/ubuntu/bb-service` implementation checkout, while the
parent task explicitly designates this disposable candidate. The candidate
remains unchanged by this lane. Parent/root should apply the focused test and
CLI edits in the candidate after resolving that authorization mismatch. The
canonical runtime and dirty child repositories remain untouched.
