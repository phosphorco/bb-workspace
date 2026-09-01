---
name: bb-echarts
description: Build, review, extend, or debug Apache ECharts integrations in BB React surfaces and plugins. Use for chart adapters, lifecycle, identity, interactions, context menus, references, renderer choice, export, accessibility, performance, or version-sensitive ECharts behavior. Do not use for analytics query design unless ECharts integration is also involved.
---

# BB ECharts

Treat ECharts as a trusted imperative rendering kernel behind a BB-owned adapter. BB owns the public schema, semantic identity, application state, commands, menus, references, accessibility, security, and lifecycle. ECharts owns drawing, layout, hit testing, and transient rendering mechanics.

## Start at the real boundary

Before changing code, identify the installed ECharts version, modular imports, public figure contract, trusted compiler, shared chart host, identity representation, application state owner, export path, and test infrastructure. Reuse the existing adapter rather than creating a chart-local lifecycle.

Read only the references needed for the task:

- For responsibility boundaries and safe public contracts, read [references/ownership-and-contracts.md](references/ownership-and-contracts.md).
- For `CompiledFigure`, structural signatures, component IDs, datum identity, and event lookup, read [references/compiled-figure-and-identity.md](references/compiled-figure-and-identity.md).
- For pinned-version research, modular registration, and wrapper boundaries, read [references/version-and-registry.md](references/version-and-registry.md).
- For React mounting, cleanup, resizing, and `setOption` update policy, read [references/react-lifecycle-and-updates.md](references/react-lifecycle-and-updates.md).
- For SVG/Canvas choice, bounded data, progressive modes, and measurement, read [references/renderer-density-and-performance.md](references/renderer-density-and-performance.md).
- For host sizing, theme changes, animation, and reduced motion, read [references/theme-motion-and-sizing.md](references/theme-motion-and-sizing.md).
- For chart intents, right-click menus, BB references, selection, and application commands, read [references/events-menus-and-references.md](references/events-menus-and-references.md).
- For exact-value access, keyboard parity, image/data export, and disclosure, read [references/accessibility-and-export.md](references/accessibility-and-export.md).
- For lifecycle matrices, minimal reproductions, official-source research, diagnostics, and recurring failures, read [references/testing-research-and-failure-atlas.md](references/testing-research-and-failure-atlas.md).

## Invariants

1. Do not expose unrestricted ECharts options, callbacks, HTML, CSS, URLs, regular expressions, toolbox features, event handlers, or `renderItem` code to untrusted authors.
2. Keep authored specification, canonical data, compiled option, runtime viewport state, semantic application state, and normalized intent as separate representations.
3. Give every structural component an explicit stable ID. Give every interactive datum application identity; never use `seriesIndex` or `dataIndex` as durable identity.
4. Normalize ECharts and ZRender events immediately into BB-owned intents. Render menus and commands as native BB UI.
5. Centralize initialization, non-zero sizing, observers, event binding, update strategy, renderer changes, and disposal in one shared host.
6. Treat `setOption` as a patch to a long-lived internal model. Let the adapter choose merge, targeted replacement, full replacement, or rebuild from a deterministic structural comparison.
7. Choose SVG or Canvas before initialization from measured workload and interaction requirements. Do not silently sacrifice identity or hit testing for density.
8. Preserve an exact, keyboard-accessible representation outside the graphical surface when users must inspect or act on values.
9. Export from canonical application data when possible; do not reconstruct truth from ECharts state.
10. Verify behavior against the pinned ECharts version and turn version-sensitive findings into adapter invariants and tests.

## Working sequence

For a new capability, name the user or application intent first. Add the narrowest safe schema field or host capability, compile it into trusted ECharts configuration, normalize its events back into BB types, and test the update sequence and lifecycle—not only a clean first mount.

For an existing integration, preserve its public contract unless the task explicitly changes it. Prefer query or application-side reduction, one shared host, modular `echarts/core` imports, stable compiled identities, and bounded diagnostics.

When the task is query-backed analytics, also use the sibling `bb-echarts-analytics` skill for relational truth, provenance, filtering, and analytical references.
