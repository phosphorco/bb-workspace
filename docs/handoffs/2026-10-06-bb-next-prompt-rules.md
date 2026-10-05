# bb-next Prompt Rules deployment — 2026-10-06

Deployed the source delivery in `/home/ubuntu/.bb/thread-storage/thr_dfirty56w6/DELIVERY.md` to bb-machine in place. The user explicitly authorized activation and publication after a working thread-creation test.

## Selected composition

- Fork: `4d9b909690dcc3ae7df03d8432b08b7142f0a8f5`.
- Organization plugins: `5dd3aef6a2c4e08c95be63d8ab79f7084ed60b09`.
- Community plugins: existing published `1c4d16625998ab5bff4e4bda2dd2e9d4598957d6`.
- Clean runtime source tree: `006c86feb52ca604f23b4d422562d635500306ad`, matching the delivery and `fork/result-tree.lock`.
- SDK archive SHA-256: `229a461709fe5e98d1784d83b6c17135ce7c0fb24485b82a14b382b06c8ad530`.

The two delivered patches were applied to the inspected clean existing materialization at `fork/build/bb`. The supported verification script independently replayed the entire queue and passed namespace checks. No alternate runtime checkout or ingress changes were made.

## Live acceptance

`bb.service` serves the rebuilt package from `fork/build/bb`. Prompt Rules 0.1.0 is installed and running from `/home/ubuntu/bb/plugins/plugins/prompt-rules`; its CLI reports `rendererAvailable: true`. All enabled plugins reached running status and `bb status` reported no plugins needing attention.

- Fresh thread `thr_6tcz3avvik` in project `proj_t8x9yhwnvc`, environment `env_tqsfutmr8b`, on `host_chtdmruc4g` completed its first model turn and returned exactly `BB_NEXT_FRESH_THREAD_OK`.
- Chromium opened the thread through HTTPS Tailnet ingress, found the final reply, and reported no page errors.
- Settings → Prompt Rules rendered the editor and observed-prompt selector. Live captures included messages, assembled instructions, and tool descriptions.
- A draft literal replacement preview changed a captured tool description as expected. Saved policy remained revision 0 with no rules.
- Captured sample sequence 511 remained readable after reloading Prompt Rules; rendering remained available.
- The HTTPS health endpoint returned `ok: true` through the assigned service VIP `100.84.229.173`. This host could not resolve `bb-next.banjo-tint.ts.net` through its DNS resolver, so curl and Chromium used an explicit hostname-to-VIP mapping. This verifies ingress and TLS, not DNS availability on other clients.

Startup under verification load first exceeded the launcher's 60-second health deadline. Its automatic retry became healthy. Plugin activation continued afterward; the first early smoke thread failed because Codex had not registered its bridge yet. Once providers loaded, retry `thr_kns6fxmaia` completed with `BB_NEXT_PROMPT_RULES_OK`; the independent fresh-thread check above then passed without retry.

## Verification

- Core: frozen install, 99-task typecheck, and 52-task build passed.
- Organization plugins: frozen install, manifest synchronization, reference pins, exact SDK resolution, typecheck, and full build passed. All 18 Prompt Rules tests passed.
- Organization full test command retains the known Thread Progress participant-rendering failure: `useRpc` lacks the test plugin runtime. DELIVERY.md contains the previous-SDK reproduction. No unrelated test was changed.
- Community plugins: `npm ci`, full tests, typecheck, and build passed for the existing selected commit.
- The initial broad core run stopped at a replay-order timing assertion; that package passed in the subsequent complete run. The complete run finished 95/97 tasks successfully. Three server tests hit 5-second timeouts and one integration test encountered a concurrently missing generated frontend artifact. Focused reruns passed all 53 tests in the three server files and both tests in the integration file. The complete frontend suite passed 5,139 tests; the SDK passed 369. This is not a clean single-run whole-suite pass.

Durable command logs, browser screenshots, thread receipts, and preview results are under `/home/ubuntu/.bb/thread-storage/thr_dfirty56w6/redeployment-2026-10-06/`. The source-only historical SDK check receipt remains unchanged; this handoff records subsequent activation.
