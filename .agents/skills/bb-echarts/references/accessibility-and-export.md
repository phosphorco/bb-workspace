# Accessibility and export

Read this reference when a BB ECharts surface must expose exact values,
keyboard-operable actions, reduced-motion behavior, CSV/data export, or a
deterministic image. ECharts ARIA and image APIs are useful mechanisms, but BB
owns the user-facing contract and canonical data.

## Contents

- [Accessibility is an application contract](#accessibility-is-an-application-contract)
- [Describe meaning and state](#describe-meaning-and-state)
- [Provide a native exact table](#provide-a-native-exact-table)
- [Preserve non-pointer operation](#preserve-non-pointer-operation)
- [Color, tooltip, and motion rules](#color-tooltip-and-motion-rules)
- [Declare export semantics](#declare-export-semantics)
- [Canonical data and CSV export](#canonical-data-and-csv-export)
- [Deterministic image export](#deterministic-image-export)
- [Verification](#verification)

## Accessibility is an application contract

Register ECharts ARIA support when useful, but do not treat generated ARIA text
as a substitute for exact values or operable controls. ECharts does not know
the application's question, identity scope, action permissions, truncation,
staleness, or the difference between local viewport state and semantic state.

BB should provide:

1. a concise application-owned description;
2. visible and programmatic loading, empty, stale, partial, and error states;
3. an exact value representation when values matter;
4. keyboard access to essential commands;
5. non-color cues where color carries meaning;
6. reduced-motion behavior;
7. export labels that state what is included.

Do not put the same long description on the chart, its surrounding section, and
the table. Establish one accessible naming/description relationship and keep
generated chart output from duplicating it excessively.

## Describe meaning and state

A useful description explains the figure's purpose, population, visual
encodings, and meaningful current state. For example:

```text
Request latency by service for the last hour. Horizontal position is time,
vertical position is milliseconds, and color identifies service. Showing 240
of 240 points. Viewport is zoomed to the last 15 minutes.
```

Distinguish states that alter the data from states that alter only the view:

- “Filtered to …” means canonical application data changed.
- “Zoomed to …” means the current viewport changed.
- “Showing N of M” means plotted reduction or truncation occurred.
- “As of …” or an application revision states freshness when relevant.

Announce meaningful user-triggered changes with the surrounding BB UI's normal
status patterns. Avoid a live region that narrates every hover, animation frame,
resize, or polling refresh.

## Provide a native exact table

When users must inspect, reference, copy, or act on precise values, render an
adjacent native table or disclosure. It should derive from
`CompiledFigure.accessibleData` and `plottedDatumKeys`, or another explicitly
declared canonical subset, not by reading ECharts state.

The table should preserve:

- plotted row order unless its own sort is clearly labeled;
- stable application row/datum keys;
- semantic column headers and units;
- intentional formatting for null, missing, infinite, and invalid values;
- the distinction between raw values and display formatting;
- “N of M” disclosure when the figure is reduced;
- the same row-level capabilities used by the chart context menu.

Use a real `<table>` for ordinary bounded results. Give it a caption or an
accessible name, use `<th scope="col">`, and keep row actions in native buttons
or menus. If a large table requires virtualization, preserve its announced row
count, logical order, focus behavior, and a non-virtualized export path; do not
add virtualization to a small table merely for consistency.

An exact table is not required to duplicate decorative marks or every
intermediate geometry. It represents the values and identities users can
meaningfully inspect.

## Preserve non-pointer operation

Every essential figure command needs a native control:

| Pointer behavior | Non-pointer equivalent |
|---|---|
| Right-click datum | Row actions/menu in the exact table |
| Right-click canvas | Visible figure-actions button |
| Hover tooltip | Exact table or focusable detail control |
| Click to activate | Native row/button activation |
| Reset zoom | Named button |
| Export | Named figure action |
| Add reference to chat | Row or figure action using the same reference target |

Brush, lasso, drag, or wheel gestures may remain enhancements unless the action
is essential. If the gesture commits application state, provide a keyboard
path that can express the same state and an obvious way to clear or undo it.

Do not assign elaborate ARIA widget roles directly to ECharts-generated canvas
or SVG descendants unless the adapter owns and tests the complete keyboard
interaction model. Generated graphics change across renderer and version.

## Color, tooltip, and motion rules

- Meet BB's contrast expectations in resolved themes, including muted axes and
  grid lines that convey necessary information.
- Use labels, symbols, line styles, direct annotation, or decals when color is
  the only categorical discriminator.
- Keep tooltip content structured and host-generated. Never accept authored
  HTML, CSS, or executable formatters.
- Do not place unique information only in a tooltip.
- Disable or reduce animation under `prefers-reduced-motion`.
- Avoid transitions that imply continuity between unrelated identities.
- Do not flash or continuously animate a chart merely to indicate freshness.

Test light/dark and high-contrast-relevant BB themes with real resolved tokens,
not hard-coded example colors.

## Declare export semantics

An export policy should answer before implementation:

```text
Data source:
Rows and columns:
Ordering:
Current application filters included:
Local zoom/legend state included:
Reduction or truncation included:
Value formatting:
Filename and title:
Authorization boundary:
Maximum rows/bytes or mark count:
```

CSV/data export and image export normally have different scopes. Data export
usually represents canonical data and declared application state. Image export
represents a visual state and may include local zoom, legend visibility, and
annotations. Label both actions so users do not infer that a screenshot and a
CSV contain identical populations.

Export is a data egress capability. Apply the same authorization at export time
as at inspection time, cap resource use, and do not allow authored filenames,
paths, URLs, MIME types, or download destinations.

## Canonical data and CSV export

Serialize data from canonical application rows with a trusted column order.
Never reconstruct truth from `getOption()`, `series.data`, generated SVG, or
tooltip text: ECharts may have transformed, stacked, sampled, or formatted it.
For query-backed dashboards, the analytics extension defines whether the source
is the complete bounded query result, the plotted subset, or a detail result.

CSV serialization should:

- emit UTF-8 with a documented newline convention;
- quote fields containing quotes, separators, or newlines and double embedded
  quotes;
- preserve zero, `false`, and empty string distinctly from null;
- use stable machine-readable column names or include an explicit mapping to
  display labels;
- make raw-versus-formatted numeric and temporal values intentional;
- use deterministic ordering;
- state when the exported set is reduced or truncated;
- avoid materializing an unbounded file in browser memory.

Spreadsheet applications can interpret cells beginning with formula markers as
code. Neutralize cells beginning with `=`, `+`, `-`, `@`, tab, carriage return,
or line-feed when an exported field can contain user-controlled text. Apply the
chosen neutralization before CSV quoting, preserve the original value through a
safe documented convention when necessary, and test the resulting file in the
supported spreadsheet path. See the [OWASP CSV Injection
guidance](https://owasp.org/www-community/attacks/CSV_Injection) for the threat
model; do not assume RFC-style quoting alone disables formulas.

Generate filenames in trusted host code from allowlisted identifiers and a
safe timestamp/revision. Exclude path separators and control characters.

## Deterministic image export

Use ECharts' export API only from a known steady render state:

1. capture the intended compiled revision and theme;
2. stop or disable animation for deterministic capture;
3. wait for the pinned version's appropriate render completion boundary;
4. decide whether local zoom, legend state, selection, and hover are included;
5. call the supported instance export API;
6. bound pixel ratio, dimensions, and output bytes;
7. discard a result if the figure changed during capture.

SVG is available only from an SVG render path. A Canvas figure that requires an
SVG export may compile the same trusted figure and canonical data into a
short-lived, bounded, off-screen SVG instance, capture it, and dispose it. Do
not attempt this for a result whose mark count made SVG unsuitable in the first
place. PNG/raster export should likewise cap resolution to prevent accidental
memory spikes.

Resolve colors and fonts before capture. Transparent backgrounds are useful
only when the consuming context supports them; otherwise apply a trusted theme
surface. Give users feedback while an export is prepared and return an
actionable error if renderer, size, or current state prevents it.

If image fidelity is a product requirement, compare decoded image dimensions
and a small set of semantic visual fixtures in browser tests. A raw data URL
snapshot is brittle and expensive.

## Verification

Test at least:

- exact table values/order against the compiled plotted set;
- N-of-M disclosure and empty/null-heavy/extreme-value cases;
- keyboard access to inspect, reference, reset, and export commands;
- focus restoration after a table or figure menu closes;
- reduced motion before mount and after the preference changes;
- non-color distinction for categorical series;
- CSV quoting, nulls, Unicode, newlines, formula prefixes, column order, and
  deterministic row order;
- export authorization and size/row caps;
- image export after animation, during a superseding update, under both themes,
  and for every supported renderer;
- repeated export without retained off-screen chart instances or object URLs.

Prefer assertions against canonical rows, compiled metadata, and observable
browser behavior. Do not snapshot generated ARIA prose, `getOption()`, a base64
image, or the entire generated SVG as the product contract.
