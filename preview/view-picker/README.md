# Preview sidebar picker repair

Cole requested the compact earlier View as treatment and no Preparing sections layout shift. Comparison screenshots render the original IdentityPicker component (still present unchanged in source) with CSS from plugins commit 1cfafeda. These are controlled reference fixtures, not screenshots of the normal live service.

The repaired production picker keeps package-owned directory search, scope-fenced selection and return-to-self. It uses the browser popover top layer with viewport/visual-viewport positioning so sidebar overflow cannot clip it. Its trigger reserves the same width while identity loads; self wording is View as…, preview wording is the chosen name. The list drops the redundant self row while already viewing self. Error details remain available via disclosure. No settings or identities are reset.

The browser fixture mounts actual ProgressInbox through a controlled SDK, tests phone/desktop widths in light/dark/custom palettes, loading-to-ready trigger width, selecting and returning without foreign writes, viewport resize near bottom, Escape/focus, and popup bounds. Controlled fixture evidence does not claim real Tailnet admission. live.json separately checks the actual loaded preview's denied-host fallback and absence of Preparing sections text. Cole's phone supplies the authenticated Safari witness.

Run command (Node22.19/Bun1.3.14):

```
BB_PICKER_REFERENCE_REPO=/home/ubuntu/bb/plugins BB_PICKER_REFERENCE_REVISION=1cfafeda BB_PICKER_SCREENSHOTS=/home/ubuntu/bb-service/preview/view-picker bun packages/bb-identity/type-tests/browser/view-picker-layout-browser-run.mts
```

Source changes are preview-only until separately reviewed for integration. Approved npm tarball is unchanged; new library output is not that reviewed release artifact. Normal BB remains untouched.

The accompanying preparation defect was confirmed against one existing preview canonical record: valid stored settings were decoded by storage, then incorrectly returned as an array to a client expecting the encoded document. Server emission now uses the existing codec. Focused wire/fence/resource/pipeline tests pass 19/19; plugin typecheck/build pass and the preview plugin was reloaded. No saved settings were changed. Exact replayable authored-source patch and scope are in source.patch/source-receipt.json. Generated declarations were refreshed by the selected CLI; they are excluded from the patch.
