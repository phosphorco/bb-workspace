# Theme, motion, and sizing

CSS and BB own the surface contract. The ECharts adapter resolves that contract into a small immutable presentation input, applies it without update storms, and rebuilds only when the pinned ECharts version requires an initialization-bound change.

## Contents

- [Resolve semantic presentation](#resolve-semantic-presentation)
- [Fingerprint only chart-relevant theme state](#fingerprint-only-chart-relevant-theme-state)
- [Give every host a definite size](#give-every-host-a-definite-size)
- [Respect reduced motion](#respect-reduced-motion)
- [Use animation to explain continuity](#use-animation-to-explain-continuity)
- [Verify the presentation matrix](#verify-the-presentation-matrix)

## Resolve semantic presentation

Prefer BB's explicit theme or palette primitive when the plugin SDK exposes one. Otherwise resolve a documented, bounded set of computed CSS values from the nearest owned theme boundary. Do not let every figure invent its own token names or hardcoded light/dark palette.

Use semantic roles:

```ts
type ResolvedChartTheme = Readonly<{
  foreground: string;
  mutedForeground: string;
  surface: string;
  border: string;
  focus: string;
  series: readonly string[];
}>;
```

Confirm every token against the current BB theme bridge. Palette roles can resolve to materially different colors across light, dark, built-in, custom, and plugin-contributed themes.

Stable domain or series colors may be literal invariants only when color itself carries identity and the product has deliberately accepted the cross-theme tradeoff. Keep the exception inside the data visualization. Surrounding text, controls, focus, menus, errors, and surfaces remain semantic and theme-aware. Never rely on color alone; retain text, shape, position, pattern, or another cue.

Construct ECharts styles from trusted resolved values. Do not expose CSS text, HTML tooltip markup, formatter code, or arbitrary color objects to authored configuration.

## Fingerprint only chart-relevant theme state

A class or style mutation is merely a possible invalidation signal. It is not proof that the chart theme changed.

Preferred flow:

```text
BB theme revision or bounded DOM mutation
  -> schedule at most one resolution per frame
  -> resolve the small chart theme
  -> compute a deterministic fingerprint
  -> stop if fingerprint is unchanged
  -> recompile resolved presentation values
  -> apply the structural update policy
```

Use the smallest available subscription:

1. An explicit BB palette/theme revision from the owning surface.
2. One observer on the known theme root and only the attributes that select themes.
3. A scoped, persistent token probe owned by the chart surface when no typed bridge exists.

Avoid observing every ancestor and immediately calling `setOption()` for unrelated `class` or `style` changes. Avoid appending and removing a probe for every ordinary data update. If a probe is necessary, create one per owned surface or resolve tokens through a shared theme adapter, keep it non-interactive and layout-neutral, and read it only after a relevant invalidation.

The fingerprint should include only normalized values used by compilation. Do not fingerprint arbitrary computed style or serialize the entire DOM theme state.

Some colors live directly in the compiled option even when ECharts also has a theme mechanism. A theme change therefore normally requires recompilation. Whether an ECharts theme itself can change in place is version-sensitive: verify the exact pinned API and source, keep that behavior in the version adapter, and rebuild only when required. Never assume an online ECharts 6 example applies to a pinned older release.

## Give every host a definite size

ECharts cannot infer a useful height from an unconstrained empty container. CSS owns the host's responsive dimensions; the lifecycle adapter consumes the resulting content size.

Host rules:

- Provide a definite height, `min-height`, aspect ratio, or parent layout contract appropriate to the named BB surface.
- Use `min-width: 0` inside grid and flex layouts so the figure may shrink rather than overflow.
- Let the card or panel own placement and spacing; let the chart host own only the drawing rectangle.
- Observe the chart host, not the viewport and not an ECharts-generated child.
- Treat 0×0 as hidden/not ready, not as an error.
- Keep overflow policy deliberate so tooltips, focus indicators, and native menus are not accidentally clipped.
- Verify long titles, axis labels, text zoom, locale changes, and narrow containers rather than assuming one desktop card size.
- Prefer container-aware responsive layout over duplicating JavaScript window breakpoints.

The resize adapter should pass CSS-pixel dimensions consistently, deduplicate unchanged sizes, and coalesce bursts with `requestAnimationFrame`. Do not write measured dimensions back into CSS or React state unless the product layout truly depends on them; that can create a read/write loop.

Device-pixel-ratio changes can occur through browser zoom or moving a window between displays. Establish the pinned renderer's behavior in supported browsers. If additional handling is required, use one shared, tested host-level signal and resize or rebuild according to the version adapter; do not install speculative global listeners per figure.

## Respect reduced motion

Reduced motion is a live presentation preference. Prefer a shared BB motion primitive. Otherwise use `matchMedia("(prefers-reduced-motion: reduce)")` through a narrow shared subscription rather than independent broad React state in every mark.

When reduction is requested:

- compile ECharts animation off, with zero animation durations where needed for the pinned version;
- stop decorative loading loops and provide a legible static state;
- avoid animated zoom, roam, emphasis, universal transitions, and delayed staged entrances unless verified to remain effectively motionless;
- keep progress, loading, and completion understandable without movement;
- do not remove data, actions, focus indication, or status text.

On a preference change, update the resolved presentation input. Do not remount the React subtree. Rebuild the ECharts instance only if a genuinely initialization-bound option changes.

CSS and ECharts motion policies must agree. A motion-safe chart beside an endlessly animating plugin loader is not a complete implementation.

## Use animation to explain continuity

Animation is optional explanatory behavior, not a liveness indicator.

Enable it only when all of the following hold:

- semantic identity across the old and new marks is known;
- the mark count and update frequency fit a measured budget;
- a transition helps users understand the change;
- interruption by a newer generation is defined;
- the renderer lane preserves the intended behavior;
- reduced motion is not requested.

Use stable series and item/group identities for transitions. If filtering, regrouping, or a structural change makes continuity ambiguous, prefer a short enter/exit treatment or no animation. Never morph analytically unrelated marks because their array positions happen to match.

Keep animation parameters in the trusted adapter. Bound durations and delays; avoid per-item staggering that turns large datasets into long-running work. Streaming or rapidly updating diagnostics should generally batch updates at a useful presentation cadence and omit animation that cannot finish before the next value arrives.

For deterministic image capture and automated visual comparison, render from a known steady state with animation disabled or wait for the pinned renderer's verified completion signal.

## Verify the presentation matrix

Test:

- light, dark, and one materially different custom palette;
- stable domain colors against each supported surface;
- chart-relevant theme change and unrelated ancestor mutation;
- repeated equivalent theme invalidations producing no option update;
- reduced motion at mount and changed while mounted;
- ordinary animation interrupted by a newer generation;
- fixed, grid, flex, split-pane, and container-query layouts;
- zero-sized mount followed by reveal;
- narrow width, text zoom, long labels, and locale-sensitive values;
- device-pixel-ratio changes on supported browser/renderer combinations;
- SVG and Canvas lanes where both are supported;
- loading, empty, degraded, stale, and error states around the figure.

Development diagnostics may expose the normalized theme fingerprint, motion mode, host CSS size, renderer backing size when available, device pixel ratio, instance key, and last resize/update reason. Keep diagnostics bounded and do not log full computed styles or authored data.
