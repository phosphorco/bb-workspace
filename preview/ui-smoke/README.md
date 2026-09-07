# Preview browser smoke suite

Run only against the isolated preview (normal BB is refused):

```sh
/home/ubuntu/.local/share/mise/installs/node/22.19.0/bin/node /home/ubuntu/bb-service/preview/ui-smoke/run.mjs
```

The pinned Playwright Core dependency is installed in this harness directory; it uses the existing host Chrome. It does not change the core or plugin package lockfiles. Each run uses fresh browser contexts and writes JSON, screenshots and rendered text under `runs/`; `latest.json` points at the finished run. Artifacts may include user-visible thread content; keep them local.

Coverage: desktop/light and mobile-width/dark Chromium, home, composer draft entry and clearing without sending, Extensions, Skills, settings, every enabled plugin settings page, discovered plugin navigation panels, and an existing thread read. Assertions check expected controls, plugin titles, route changes, visible failure states, unhandled JavaScript exceptions and server 5xx responses. HTTP errors and request failures are recorded even when nonfatal. After the shared transport fix, a case with 401 responses is explicitly `auth-required`, not a normal pass. The server-side runner cannot supply a real Tailnet person. Screenshots support visual review; horizontal overflow is reported separately.

This is a smoke suite, not a claim of full fork acceptance. A running plugin or rendered settings page does not prove its data/edit/retry/subscription behavior. The runner is a tagged Tailnet host, so it does not impersonate a human or synthesize identity headers. Cole's supplied identity/search/mention screenshots are distinct real-user evidence. Chromium emulation does not prove iOS Safari compatibility.

Remaining layers: app-specific reversible fixture workflows; provider execution and queue/edit/retry; two-real-user isolation; credential-backed Slack/ntfy/Agent Connect delivery; reconnect and browser recovery; long lists and performance. Run external-send or model-execution scenarios only with explicit destinations and dedicated fixtures. Never reuse Cole's existing thread as a mutation fixture.

Plugin activation receipts are `../bundled-activation.json` and the organization lane's inventory. Disabled-by-policy and unconfigured plugins are coverage gaps, not passes.

## Real-user run

Open https://rosetta.banjo-tint.ts.net:40888/identity-check/workflows.html from an authenticated Tailnet user's device. Click Run checks and keep the tab in front. This uses the same-origin self-profile RPC before traversing installed plugin settings and navigation panels in an iframe. It records render results and setup gaps, not deep workflow correctness; download the local JSON report afterward. A tagged machine is rejected explicitly.

## Reversible persistence fixture

`node task-workflow.mjs` creates a uniquely named task project and task through the UI, reloads, and asserts persistence. It does not attach a BB project or dispatch an agent. `python3 cleanup-task-fixtures.py` removes only matching names/prefixes from that run's receipt, and preserves fixtures with unexpected tasks. Cleanup uses the public tasks RPC and is separately labeled; it is not claimed as a UI delete test.

First-pass findings: absent-human plugin scope failures were emitted as HTTP 500 (shared transport issue); GitHub CLI was absent from the preview PATH (existing pinned binary added); mobile navigation requires opening the sidebar before clicking covered buttons (test corrected). Rendering reports include kept-alive offscreen content; an offscreen fallback is not treated as a visible UI defect.

`check-denial-stability.mjs` performs 100 sequential identity GETs from the tagged-host browser context. The post-fix receipt `denial-stability.json` records 100 HTTP401 responses and no unexpected statuses. It tests negative-response stability, not authenticated plugin behavior.
