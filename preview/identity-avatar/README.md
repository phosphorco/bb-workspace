# Identity settings provider avatar

The Identity page renders the existing provider presentation avatar beside the
name and handle. It reuses BB’s shared Avatar with a decorative image, no-referrer
policy, and an initial fallback when the image is absent or fails. No provider,
SDK, or authority contract changed.

Fork patch 0022 is the durable change. `verification.json` records the exact
source tree, five existing settings tests, app typecheck/build, preview readiness,
and four browser cases at 390/1280 pixels in light/dark Catppuccin. The 22-patch
queue also passed `fork/scripts/verify`.

The browser harness intercepts identity and avatar responses: it tests display,
failed/missing images, stable size, identity replacement, failure clearing and
long-handle wrapping. It does not claim authenticated end-to-end admission.
Run against the isolated preview with its existing Playwright installation:

```sh
node preview/identity-avatar/browser.mjs /path/to/existing/output-directory
```

Preview was reloaded from the verified materialization; all 47 enabled plugins
were running. The normal BB service PID remained unchanged.
