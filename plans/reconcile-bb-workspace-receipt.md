# Workspace reconciliation — 2026-09-10

Source selection and verification record. This is not a normal-runtime activation receipt.

## Selected source

| Repository | Selected main revision | Integrated origin/main |
| --- | --- | --- |
| fork | `6f514108af1623ae0a9f5538cb699fb50970f857` | `2c6b274530c8473aea4b992e063d6e98ac2b75e9` |
| plugins | `ed73a8239800cf2e9690d613d7addf4e24d627df` | `c8ace12c72497002da2caf5c157ba5402e9a9181` |
| community-plugins | `aa42ba29461b955414bee0df4415d3e31d22d79b` | `fb6a9830d3942219cf16dca5d75b05fb65dc5d54` |

Workspace merge integrates `43d8fc2c11763f6d2582d22edec35e38f89c63cd`.
Its containing commit is the publication receipt; child publication must precede it.
Nested upstream stays pinned at `960255b98ce3dccdcb5754eb67a7f989236602a1`.
Fork replay yields source `fc11803cce70f44a0099c03b10a214eafd296651`,
tree `116370cf44d556e53c346340bfe473eab47eddc3`.

## Preservation and conflict decisions

- Workspace authored skills, plans, workflow definitions, prototypes and source
  receipts were preserved in `19d01cc`, `cb615aa`, `a14fd56`, and `e9e1e92`.
  Only transient ledger locks are newly ignored. Tracked SDK archives are
  deliberate reproducibility inputs, not disposable build output.
- Community work was preserved in nine logical commits (`d3a1c02` through
  `d011f9c`) before merging. Main's public SDK package, Agentation attribution,
  supported Cross References links, worker packaging and redacted verifier
  behavior supersede older local variants. Additive Analytics extraction,
  execution and UI foundations remain; this does not close the larger Analytics
  product plan. SDK fixtures and Node type-stripping compatibility were repaired.
- Organization plugins include the author's verified Thread Progress fix
  `42b1617`. Recent shared Workbench hook commits `7af626d` and `c7ae9a4`
  were recovered from their side branch as `3e3981c` and `072cc1d`.
  Their merge with main's new machine-login path needed a failing/passing
  regression fix (`d3ded81`). The UI skill now refers to shared skill paths and
  the current public SDK package (`ed73a82`). Older Slack readiness changes
  were compared by content and were already present or superseded by main.
- Fork main's exact patch series and replay receipt implement the approved
  [identity ADR](../docs/adrs/2026-09-identities-and-multiplayer.md): trusted
  best-effort attribution, producer-message rendering and no obsolete person
  admission/expiry gate. The earlier identity-first cutover is retained in
  history and its historical plan/ledger, not selected as the runtime source.
  No authored branch or dirty checkout was reset, cleaned or discarded.

## Verification evidence

Evidence logs live under `/home/ubuntu/.bb/thread-storage/thr_ateba9rdkp/`.

- Fork patch replay and exact tree verification passed. Proof source frozen
  at the revision above; frozen install, typecheck (88 tasks), build (13 tasks)
  passed. Final aggregate tests: **85/85 tasks passed** (82 cached), including
  server 2,315 passed / 1 skipped and integration 77 passed.
  Evidence: `reconcile-fork-tests-accepted.log`.
  Test subprocesses use `TMPDIR=/var/tmp` with Turbo `--env-mode=loose`
  because a pre-existing `/tmp/.git` contaminates native-root fixtures; BB
  connection variables (including the host daemon port) and `CODEX_HOME` are
  unset in those subprocesses.
  Serial execution avoids observed launcher timeouts under concurrent load.
  The server's authored cross-repository tests require
  `BB_THREAD_MANAGER_PLUGIN_ROOT=/home/ubuntu/bb/plugins/plugins/thread-manager`
  and `BB_THREAD_PROGRESS_PLUGIN_ROOT=/home/ubuntu/bb/plugins/plugins/thread-progress`.
  Both actual-plugin witnesses passed with these bindings
  (`reconcile-native-plugin-witnesses.log`).
- Organization frozen install, sync, references, SDK types, typecheck, tests
  and build passed. Final typecheck/tests/build rerun passed after the hook
  merge repair. Focused shared-hooks account tests: 6 passed; the new rejection
  test failed before the repair and passed after it.
- Community `npm ci`, typecheck, tests and build passed:
  `reconcile-community-{typecheck,tests,build}.log`.
  Additional Analytics foundation checks: 36 passed
  (`reconcile-analytics-foundations.log`); mounted execution UI: 14 passed
  (`reconcile-analytics-ui.log`).
- [Combined smoke source](reconcile-bb-workspace-smoke.mts) starts a fresh
  selected-source test host and loads all 11 affected plugins from canonical
  directories. All report running. Agent Connect OPTIONS returns 204 and
  missing/invalid plugin connection tokens return 401 for GET/POST.
  Evidence: `reconcile-composition-smoke.log`. This proves factory and HTTP
  compatibility, not live-data migration or browser acceptance for every plugin.
- Thread Progress author supplied actual-component Chromium evidence for nested
  controls, persisted state, rails, keyboard, three palettes and narrow layout;
  leaf 330 passed with 1 existing skip. Evidence is in thread
  `thr_pba9nv72y6` (`nested-browser.mts`, `nested-browser.log`). Their live reload
  succeeded on retry before reconciliation.

## Activation boundary

Normal `fork/build/bb` remains at
`0c92471bb5ee180d474d6c38717c55b32f47c95e`, not the selected new source.
No normal service restart, host-router installation or machine-policy promotion
was performed. Source publication does not by itself activate these changes.

The pre-existing `bb-fork-proof.service` remained running from its earlier
launch. The proof checkout was moved while that old service was running;
that old process is explicitly **not** acceptance evidence for the new source.
The fresh test-host smoke above is separate and was stopped after verification.
Coordinate retirement/restart of the old proof service and normal activation
before claiming full source/runtime reconciliation. Preserve operator runtime
state and confirm the exact new source receipt after activation.

One failed test run inherited the operator's `CODEX_HOME`; a mocked-fetch
assertion printed a real bearer token instead of its fixture token. The saved
log was redacted, but tool output also contained the token. The user was
notified to treat it as exposed and rotate it. No credential files were changed.
