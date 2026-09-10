# Transcript verification evidence

The [Pkl plan](../message-transcripts.plan.pkl) and its ledger own coordination. This receipt describes selected source and evidence; activation and promotion require a separate delivery receipt.

## Selected composition

- Native replay: `0ba993279b93dc90c52ef33a4b8ff848ee2917c3`, tree `2952d30514af252b57634cf0023d4b8e5ac6356e`. Existing patch0016 only; sixteen patches remain. Patch SHA-256: `472d180a787f835447481310cf0fe2dcd9f8bb405bbe556a7317ece3bf18b4a0`.
- Organization plugins: `99922ef` (shared binding/Slack implementation `9328809`, then a test typing correction). Thirteen unrelated Diffs/subscription-router files remain unchanged from the recorded baseline and are excluded from these commits.
- Community: `fb6a9830d3942219cf16dca5d75b05fb65dc5d54`, combining Agentation `43cfdf5` with incoming timing-plugin commits through `8432daa`.
- Identity archive: `phosphorco-bb-identity-0.1.0.e9433450fa93.tgz`, SHA-256 `e9433450fa93639641e2a3596f9b3fcebc2b980b5dc6f0bf644636f960edd8f4`. [Provenance](transcript-library-artifact.json) records the exact package tree; it matches the committed source. All twelve packed runtime files match the verified build.
- Public SDK source/exports and selected SDK archive are unchanged. No new database field, public SDK export, or patch17 was added.

## Provider composition evidence

Native tests exercise real plugin SDK HTTP requests, including an SDK reference acquired before producer mode is enabled and an untouched second plugin. Producer send and explicit queued create omit a synthetic native machine frame; ordinary requests retain attribution. HTTP tests cover persistence before controlled drain, original-author handling, grouped mention attachment ownership, retries, commands, and label escaping. Focused identity/native/SDK checks passed 36/36.

The retained [Agentation witness](agentation-cross-lane-witness.test.ts) loads the actual built community plugin and installed public runtime. It invokes mixed-author dispatch, a fresh different-author reply RPC, and explicit queue creation/drain through `createNodeBbSdk`, Hono admission/routes, native `turn.submit`, and Codex conversion. The actual provider input equals the producer payload. Root independently reran it successfully: `/tmp/bb-transcripts-agentation-independent.log`.

The witness removes the replay runner's `source` resolution condition only for the installed community SDK runtime, using a temporary Node resolver hook. Published SDK archives contain runtime output, not their advertised source path. It does not copy envelope logic or native assembly. Its explicit presentation hint complements the separate native runtime test that proves automatic SDK hinting and plugin isolation. The temporary replay copies were removed.

Slack's real factory tests cover initial requests, follow-ups, revisions/deletions and retrieved context. The legacy reservation regression rejects changed prompts before lookup/send, then reconciles `absent-final` and preserves stored author/input JSON byte-for-byte. The full Slack suite passed 184 tests. These are controlled fake-Slack/gateway tests, not live Slack delivery.

## Verification and independent review

- Fork `scripts/verify` independently passed namespace checks, patch hashes and exact result tree. The clean authoring replay matches the selected commit.
- Full core typecheck and build passed; build completed 13/13 tasks. All 2,315 tracked server tests passed in the controlled environment. The final clean replay run passed all 88 typecheck tasks and 85 test tasks, including 77 integration tests. Logs: `/tmp/bb-transcripts-final-clean-typecheck.log` and `/tmp/bb-transcripts-final-clean-test.log`.
- Organization frozen install, workspace sync, references, SDK resolution, typecheck, tests and build passed.
- Community frozen install, aggregate tests, typecheck and build passed after the incoming merge and exact archive update.
- Shared binding typecheck, 148 runtime tests, five portable tests and build passed.

Design review `thr_th57yhtvtb` identified attachment ownership and provider-capability limits. Review `thr_y9x2y9a2aw` found the corrected angle escaping gap. Review `thr_2d96ggfxnd` required actual Agentation/provider and Slack legacy-retry evidence, now supplied. Correction review `thr_mmktggb5nm` supported plugin-scoped SDK policy and found the corrected explicit-header replacement issue. No source defect remains from those reviews. Two earlier panels failed operationally because the provider rejected inherited `codex-luna`; they are not passing reviews.

Earlier tests exposed stale attachment counts and a resolver spy; both were corrected. Two builtin hot-reload checks failed in inherited-environment runs, while unchanged canonical tests and minimal-environment replay tests passed 31/31. The controlled full server run passed all tracked tests; an unfinished untracked witness was also collected despite an exclusion flag and failed only on package resolution. That witness now independently passes and has been removed. No timeout was increased or assertion removed. The exact cause of the inherited-run watcher behavior is not claimed.

## Preserved behavior and limits

- Slack and Agentation are not installed on bb-machine. No live Slack was contacted. BB acceptance alone is not a Slack-post receipt.
- Child-thread source prefixes remain inside sender content because they are persisted input. Old transcript text is not rewritten.
- Codex preserves native image/localImage forms and converts localFile to a path marker. Claude retains its existing textual image/file markers. The ADR explicitly preserves current provider capabilities; no new multimodal support is claimed.
- Slack retains immutable reserved input and author snapshots. Agentation interrupted dispatch restages annotation IDs and may reread current annotations; it does not promise immutable body snapshots.
- The dormant captured-author resolver had no preceding toolbar emitter. Historical authorIdentityId values remain unresolved. The [host queue preflight](transcript-queue-preflight.json) found no queued rows/pending external operations; that is host-specific evidence.
- Generic external operations reserved before a rendering upgrade have no cross-version rendering marker; existing idempotency/conflict behavior remains.
- The SDK timeout helper's existing handling of a signal supplied only through Request was not changed. This transcript amendment does not claim complete Fetch compatibility.
