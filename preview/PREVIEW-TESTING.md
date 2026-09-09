# Preview testing status

> Policy update — 2026-09-09: the approved [Identities and multiplayer ADR](../docs/adrs/2026-09-identities-and-multiplayer.md)
> governs this trusted shared deployment. Use verified people when available,
> applicable carried attribution next, and a stable machine actor otherwise;
> missing or failed person verification must not block ordinary operations.
> Never relabel fallback as a verified person or redirect pending personal-state
> writes to another owner. Independent access checks and data validation remain.
> Earlier rejection requirements below are superseded; versioned API descriptions
> and test receipts remain historical evidence, not proof of ADR implementation.


This preview is for Cole to exercise the selected fork and organization plugins. Normal BB remains unchanged. All commands use the preview CLI wrapper and port 40888.

## Available surfaces

24 bundled plugins are enabled. Organization activation covers 20 additional plugins plus the pre-existing Identity Boundaries provider. Those 45 plus community Analytics, BB UI Reference and Machine Monitor are enabled initially (48 total); Prompt Stacks was subsequently disabled after a verified missing-host-API failure, leaving 47 running. GitHub now finds the existing pinned gh binary on preview PATH. `bundled-activation.json` and `org-plugin-activation.json` record exact dispositions and sources.

Held bundled plugins: account-pool (account routing), connect (additional public ingress), keep-awake (host power policy), memory (automatic memory behavior). Initially held organization plugins: Agent Connect (external connection testing) and ntfy/Slack (endpoint credentials), agentd/perspectives (automatic agent work), Phosphor Checkouts (repository orchestration), subscription-router (account routing). These are not covered by this preview smoke run.

## Harnesses

- `ui-smoke/run.mjs`: isolated Playwright desktop/mobile navigation, settings, composer draft, plugin panels, existing thread view. No sends. Detailed local artifacts and screenshots under ui-smoke/runs.
- `ui-smoke/task-workflow.mjs`: UI project/task creation and reload persistence. Owned fixtures cleaned through the public tasks RPC using cleanup-task-fixtures.py.
- `/identity-check/workflows.html`: user-triggered same-origin real-Tailnet browser render sweep. No impersonation or copied auth; download a local JSON report. Tagged hosts cannot run the human-authenticated layer.

First run: 101 cases, 4 passes and 97 failures, with no uncaught JavaScript exceptions. Most failures share one missing-person -> HTTP 500 transport defect in background plugin requests. Additional failures were the missing gh PATH and test selectors (mobile sidebar covered buttons; Thread Progress replacement uses buttons instead of native thread anchors). This run is diagnostic evidence, not an acceptance pass. The shared auth error classification passed 19 focused regressions, server/SDK typechecks and production build. Actual restarted HTTP and RPC denials are 401; sidebar startup is 200. Final browser rerun and its raw failures are recorded in ui-smoke/latest.json. Prompt Stacks was disabled after its missing host API was reproduced; its held-state desktop/mobile configuration checks pass in ui-smoke/held-plugin-verification.json.

The screenshot witness from Cole proves real-user identity, people search/selection, and model-visible mention context. It does not prove all edit/queue/retry/delivery workflows. UI page rendering likewise does not prove data correctness. Do not promote normal or claim full-host parity from this preview.

Auth repair provenance: `auth-boundary-fix.json` and `.patch` capture seven changed files against selected tree66a21, including the new test. Result tree c30b12255a7f9f098e7bf9b6d1999410e7956785. Shared index and normal source were not modified. The preview port probe also now handles released TIME_WAIT sockets while rejecting occupied listeners.

Prompt Stacks is held after real UI getGlobal failed: selected host has no /api/v1/system/prompt-stacks route. Source remains intact; required queue/catalog feature re-port is tracked in plugin-issues.json. It is not counted as usable just because its app bundle loaded.

The first post-fix sweep also caught two 503 responses from Notifications during mobile Plans/thread navigation. A denied provider session has a short deadline; capture checked expiry before classifying the denial. The correction classifies configured non-ready outcomes before that deadline, while retaining generation/signal checks and ready-session expiry. Deterministic deadline regressions and scoped build/typecheck pass; live rerun is complete.

Final post-correction sweep: 136 cases, 1 pass, 135 auth-required, 0 failures; zero uncaught browser errors, zero horizontal overflow and zero server5xx. Auth-required cases are not authenticated workflow passes. All 47 enabled plugins are running. Negative stability: 100/100 identity GETs returned401. Normal BB remains active with unchanged PID606208. See ui-smoke/closeout.json and latest.json for exact run artifacts.

## Agent Connect follow-up

Agent Connect is now enabled from the preview organization source. Its optional durable operation ID is exposed through GraphQL and the served JavaScript helper; 56 focused tests and the aggregate organization checks passed. Live testing found that external QUEUE sends bypassed the native active-thread queue dispatcher. The four-file core repair is sealed in family 13, with 29 focused acceptance/drain tests and server typecheck/build passing. It preserves mixed-batch input positions, frozen attribution, atomic participant projection, and receipt promotion. Exact ordered source replay passes. The full server suite remains non-green; the context-clear queue timeout reproduces on the exact pre-fix source, while timestamp-format and absent fixture-input failures remain separately recorded. Preview restart and live queue acceptance passed on source tree 00e5fb5f9e703f1820744c524c60065b821b8eb2. The live test retained exactly one queued row across identical retries, rejected changed payloads, drained to an accepted attributed receipt, and returned submitted on final retry. Disposable connections were revoked and test threads/project deleted. See fork/plans/artifacts/bb-identity-kernel-960255b98/active-external-queue-verification.json.

Agent Connect finite calls now pass live in both streamed-helper and nonstreamed forms on source tree 064f32c8b630bad312c57eab1bdb4bc2f48f4153. The core history reader waits for exact request-to-turn linkage; plugin execution/response cleanup releases unused or failed observers; validated stream conditions avoid cross-bundle GraphQL directive coercion. Identical retries do not send again, changed payloads reject, and subsequent casts are not blocked by stale leases. Native delta pruning may change replay chunk counts; the canonical final MESSAGE and terminal event sequences were retained. See agent-connect-finite-call-closeout.json for precise checks, cleanup, and remaining untested workflows.

## Host daemon restart recovery

Restart Resume is now enabled in the preview, superseding its initial automation hold. Live verification passed one graceful daemon interruption and two successive hard daemon crashes affecting two concurrent tasks. Every thread resumed automatically without operator follow-up; each interruption produced one successful recovery claim. Both batch tasks completed with all 180 results independently verified, saved progress preserved, and no surviving old workers. No production source repair was required. Normal BB and the preview server remained unchanged. See [restart-resume/README.md](restart-resume/README.md) and [closeout.json](restart-resume/closeout.json) for source provenance, evidence and limits. Completed concurrent test threads remain available for Cole; raw test state and one-off scripts stay untracked.
