# Thread Progress sidebar: feature catalog (2026-10-09)

A snapshot of what the **"Thread progress"** sidebar did on 2026-10-09, recorded before
designing its successor. Source: `plugins/plugins/thread-progress` in bb-plugins at
commit `1284fe5`; host contract from Plugin SDK 0.6.29 bundled types. Paths below are
relative to that plugin directory unless noted.

This catalog was written from the source and then reviewed by a four-lens panel
(completeness, factual accuracy, fitness as a redesign brief, stale statements). The
review's accepted corrections are folded in. It is a static reading of the code, not a
runtime verification.

**How to read it.** Part A is observable behavior, the part a redesign replaces. Part B is
the engineering appendix: data, persistence, server pipeline, performance mechanisms.
Those are current implementation choices, not requirements. Part C labels what is
dormant, unused, or historical.

---

# Part A. Observable behavior

## A0. Orientation and glossary

### What it is

- A BB plugin (`package.json` → `bb.name: "Thread Progress"`, icon `Mountain`) that
  registers three app surfaces (`app.tsx`):
  1. `experimental_threadList` id `progress-inbox`, title **"Thread progress"**. Replaces
     the sidebar's entire scrolling thread area when chosen under Settings → Appearance →
     Sidebar. This catalog covers that surface.
  2. `navPanel` "Thread Progress / Summaries" (see C1).
  3. `settingsSection` "Progress execution" (see C1).
- The host passes `activeThreadId`, `activeProjectId`, `isCompactViewport`, `onNavigate`,
  and a deprecated `searchQuery` that is always `""` (BB moved thread search to the quick
  palette). `isCompactViewport` and `activeProjectId` are not read.

### Glossary (these are counted and filtered differently; do not interchange them)

| Term | Definition | Where it matters |
|---|---|---|
| **Thread** | one host thread row (`PluginSidebarThread`) | rows, timers, comments |
| **Family** | a top-level thread (**root**, `parentThreadId` null or unresolvable) plus every descendant, nested by `parentThreadId`; one contiguous block that grouping never splits | sections, ordering, dragging, badges |
| **Root** | the family's top-level thread | section predicates evaluate **roots only**; only roots are draggable |
| **Rendered rows** | roots plus whichever descendants the family's child-visibility mode (or an active filter) reveals | what is on screen |
| **Section header count** | sum over the section's visible roots of **whole family size**, including descendants currently hidden by child-visibility or backgrounding (`progress-inbox.tsx:2333`, `familyThreadCountFromIndex`) | the `<small>` number |
| **Quick-filter badge** | number of **distinct families** with at least one matching member whose root is in some section (`:1545`) | the Active / Waiting-on-me counts |
| **`maximumItems`** | caps **families** (roots), not rows (`thread-list-pipeline.ts:170`) | section "Maximum" |
| **Backgrounded family** | every member backgrounded (`rollUpSubtreeEvery`); one foreground child keeps the family up | sinking, worktree partition |

Worked example: a section with Maximum 2 showing two roots, one with 4 descendants of which
1 is active, renders 2 roots + 1 revealed child = 3 rows, shows header count **6**, and
contributes **1** to the Active badge.

## A1. Layout, top to bottom

```
.thread-progress-inbox (container-type: inline-size)
├─ Toolbar  role=toolbar "Thread list controls"
│   ├─ left:  [View as…] [identity-status ⚠ (conditional)] [Sort cycle] [Sections popover]
│   └─ right: [Groups toggle] [Display popover]
├─ QuickFilterBar  role=group "Show threads": All | Active (n) | Waiting on me (n)
├─ Banners (0..n, see state matrix)
├─ Scroll area  .thread-progress-inbox-scroll (overscroll contain, scroll-padding-top = header height)
│   ├─ empty / loading states (see state matrix)
│   └─ .thread-progress-sections → <section> per active section
│       ├─ sticky header button: chevron (rotates 90° open) · name · <small>count</small>
│       │   (empty section → non-interactive header at 55% opacity, count 0)
│       └─ thread list (non-empty & not collapsed)
│           ├─ flat: <ol> of families
│           └─ grouped and/or worktree: <ol.thread-progress-group-tree> of
│               family | worktree group | title-prefix group (recursive)
└─ DragOverlay (group drags only): label + "n threads"
```

Toolbar buttons are 1.75rem tall with a 0.9rem icon and optional text label; labels hide
below a 24rem container width (`app.css:217`). Active state is a `--sidebar-accent` wash.

### State and action matrix

| State | What shows | What is editable | Recovery |
|---|---|---|---|
| Threads loading | blank scroll area (`:2284` renders null) | toolbar | none needed |
| Threads error | "Could not load threads." | toolbar | host refetch |
| No threads | "No threads yet" | all | |
| No active sections | "No active sections. Open Sections to turn one on." | Sections popover | |
| Quick filter empties every section | "No active threads in these sections" / "Nothing in these sections is waiting on you" | all | pick All |
| Sections pending identity | Sections button shows "Loading your sections…"; View as… disabled, busy | sort, display, groups, rows; **not** sections or section collapse (collapse goes through the same guarded edit path, `:1843`, `:2318`, and toasts "not editable until… ready") | wait |
| Sections blocked (storage-error, indeterminate, draft-recovery, migration-required, identity-unavailable, owner-changed) | banner "Section sync paused" + plain-language reason + `<details>` error + **Try again**; same block repeated inside the Sections popover | everything except sections | Try again (reconnect) |
| Sections conflict | banner "Thread Sections changed while your edit was in flight" | choose **Use server version** / **Keep my version** | that choice |
| Viewing as another person | banner "Viewing as <name>" + **Return to my view**; Sections popover says "Preview only" | rows, comments, display (actual identity); sections read-only; view state read-only | Return to my view |
| Identity unavailable / error | ⚠ toolbar button with tooltip "Current identity is unavailable… Click to retry." | sections suspended; view state falls back to browser-local | click to retry |
| Action error | banner with the error text | | next action |

## A2. Row anatomy and realization

Rendered by `ProgressThreadRow` (`progress-inbox.tsx:3685`) and `ThreadTemporalRow` (`:4143`).

```
<li.thread-progress-sortable-thread>      ← stable shell: sortable id, viewport-observer target,
│   data-viewport-heavy, data-compact        contain: layout paint style; min-height 2.5rem (1.85rem compact)
└─ <div.thread-progress-inbox-row>        ← is-active, is-backgrounded, is-family-active-child, is-working|is-stopped,
    │   is-covered-command, can-reveal-actions, has-actions, actions-mounted; data-curtain-tone,
    │   data-suppress-group-rail, data-reorder-enabled, data-menu-open, data-renaming, data-thread-progress-hill=<phase>
    ├─ ::before  curtain: right→left gradient wash, colour by tone, opacity variable
    ├─ ::after   left gutter marker: 3px pill in group hue; active row → 5px full-height bar in hue or --primary
    ├─ <a.thread-progress-row-link href="#">   absolute inset-0; click / keyboard / reorder-drag / split-drag target;
    │     data-sidebar-thread-shortcut-target, aria-current=page when active, role=link "sortable thread"
    ├─ <svg.thread-progress-inbox-hill>       right:3rem bottom:.4rem, width min(5.5rem,30%), h 2rem (1.7rem compact)
    ├─ <div.thread-progress-thread-sticker>   3rem square, right:2.15rem, z-index −1, ≤30% opacity, rotation −7..7°
    ├─ <div.thread-progress-row-main>         text column, padding-left .75rem
    │   ├─ title  (.is-unread → weight 600)  OR  inline rename <input>
    │   │     working → animated gradient "shimmer" text, weight 600
    │   └─ addon line (hidden on compact rows)  h .95rem, 0.62rem
    │       ├─ participants: ≤3 overlapping 0.85rem avatars + "+n"; hover/focus reveals the name inline
    │       └─ "activity · topic" (policy-gated opacity)  OR  project name when the thread has no progress row
    └─ <div.thread-progress-row-status-slot>
        ├─ status  role=timer aria-label=<full sentence>, title=<same>
        │     [icon?] <compact duration>;  icon: 💬 attention · ⚠ error · ⌨ covered command
        └─ hover actions: [Add comment] [⋯ Thread actions]  (float over the text with a mask fade)
    <ul.thread-progress-comments>  avatar? · body · [×]   (double-click = edit)
```

### Realization matrix (what offscreen rows still show)

Rows outside the scroll viewport (plus a 320px overscan) and not pinned by focus, menu,
rename, drag, or being the active thread render **light**:

| Part | Light (offscreen) | Heavy (realized) |
|---|---|---|
| shell, link, title, project fallback | yes | yes |
| status timer | yes, clock frozen at last sample | yes, ticks every second |
| **sticker** | **yes** (not gated by realization, `:4310`) | yes |
| hill chart | no | if phase present and policy opacity > 0 |
| participants, topic/activity | no | yes |
| hover action buttons | no | yes |
| comments list and comment dialog | no | yes |
| working shimmer animation | paused | running |

Compact rows (`data-compact`: backgrounded, or a child shown under a parent in "Active
children" mode) are 1.85rem, drop the addon line, keep the hill at 1.7rem, and sit at 40%
opacity.

## A3. Status semantics and visual encoding

### Predicates (`progress-inbox.tsx:4620-4760`, `lib/thread-attention.ts`)

- **blocking** = `hasPendingInteraction` ∨ indicator `waiting-for-input` ∨ the summary's
  disposition is `requires-input` with a `waitingOn` target equal to *this viewer*.
- **attention (viewer)** = blocking ∨ summary disposition requires-input / optional-next-steps
  waiting on this viewer.
- **failed** = indicator `unread-error` ∨ progress state `error`.
- **covered background command** = indicator `background-command`, `runtimeStatus` exactly
  `idle`, `backgroundCommands > 0`, and all other activity counters 0
  (`background-command-presentation.ts`). It applies immediately: an idle agent holding an open
  shell command is not generating. (The earlier 30-minute grace keyed on
  `newestBackgroundCommandStartedAt`, which the current host no longer supplies, so it never
  fired.) Covered rows skip the arrival curtain unless they are also blocking or failed.
- **working** = ¬blocking ∧ ¬failed ∧ ¬covered ∧ (progress state `active` ∨ indicator ∈
  {working-draft, workflow, background-agent, background-command, plan-mode, goal, runtime}).
- **waiting on viewer (strict)** = viewer is in `p6rParticipants` ∧ (pending interaction ∨
  `waiting-for-input` ∨ `unread-error` ∨ requires-input on viewer). Evaluated on roots only.
- **waiting dependency label** when disposition ≠ settled and the targets exclude the viewer:
  "Waiting on another thread / n threads / a background job / n background jobs / another
  person / n people / other work".

### The four "active / attention" predicates are not the same

| Used by | Predicate | Includes failures? | Requires viewer participation? | Scope |
|---|---|---|---|---|
| Quick filter **Active** and section mode `working` | working | no | no | any member reveals the family |
| Family child-visibility mode **Active children** (`:1465`) | working **∨ unread-error**, including backgrounded children | yes (unread error) | no | child branches |
| Section mode **Needs attention** (`:4655`) | attention(viewer) ∨ `unread-error` ∨ progress error | yes | no | roots |
| Quick filter **Waiting on me** (`thread-attention.ts:47`) | strict waiting-on-viewer | only `unread-error` | **yes** | roots only; never reveals children |

### Timer (`StatusTimer`, `formatCompactTimer`)

- Reference time precedence: a covered background command uses the plugin progress
  `lastEndedAtMs` when progress is idle after an observed run (basis `stop-transition`), else
  `thread.updatedAt` (basis `updated`); otherwise, if the plugin progress state
  agrees with the host-derived working flag, `progress.stateSinceMs`; otherwise
  `thread.updatedAt`.
- Kind: `working`, `idle`, or `covered`.
- Compact text: 5-second steps under a minute (`0s…55s`), then `m`, `h`, `d`.
- Full sentence (tooltip and aria-label): "Needs you · stopped for 3 minutes 10 seconds";
  "Optional next step · stopped for …"; "<dependency label> · stopped for …";
  "6 background commands open · agent stopped for …" (observed stop) or "… open · agent idle ·
  updated … ago" (no observed stop); failure text takes precedence; "<host indicatorLabel> · working|stopped for …"
  (this is how queued-message states surface: the host labels `queued-waiting` /
  `queued-failed`); "Failed · stopped for …"; "Working for … · worked 1h 12m total";
  "Stopped | Waiting for follow-up for … · worked … total".
- Tone colours: working `--primary`; waiting `--success-foreground`; blocking
  `--warning-foreground`; error `--destructive`; covered → phase colour (only when the row
  currently renders a hill, see below).

### Curtain (`lib/sidebar-display.ts:rowCurtain`)

- working → none.
- blocking → tone `attention`, opacity 0.22 + 0.58 × intensity; intensity decays with the
  **last run duration**: 1.0 at ≤30s, 0.85 at 2m, 0.6 at 5m, 0.35 at 10m, 0.2 at ≥30m
  (short runs that stop to ask glow brightest).
- otherwise an arrival wash fading linearly to 0 over **10 minutes** since `endedAt`:
  `ready` (×0.32) or `error` (×0.46).
- Tones `working`, `pinned`, `interaction`, `open` exist in CSS and the type but no code emits them.

### Age fading (`lib/sidebar-progress.ts:recencyPresentation`)

- Row opacity blends absolute age with age relative to the newest activity in the list;
  the relative share grows as the whole list goes quiet (0 at 1h, 0.6 at 6h, 1 at 24h).
- Curve (log-interpolated): 1.0 ≤10m, 0.84 at 1h, 0.6 at 6h, 0.34 at 24h, 0.24 at 7d.
- Add-on opacity = max(0.08, ((row − 0.2)/0.8)^1.7).
- Overrides, in order: active row 1; compact rows 0.4; persistent attention (working,
  attention, failed) 1; `ready` curtain floor 0.86; pinned floor 0.78.
- Hover, focus-within, or an open menu → opacity 1 plus an accent wash.

### Per-feature visibility policies (Display popover)

Hill chart, topic summary, and sticker each have a policy `never` | `always` |
`recent{started, ended, interacted}`. "Recent" opacity decays linearly to 0 over **6 hours**
from the newest selected timestamp, where *started* = `lastStartedAtMs` (or `updatedAt` if
working with no progress row), *ended* = `lastEndedAtMs` (or `updatedAt`), *interacted* =
the host's `lastReadAt` (`:4832`). Final opacity = policy opacity × add-on age opacity.

### Hill chart (`ProgressHill`, `:4481`)

- Renders only on a realized row with a phase and policy opacity > 0 (`:3964`). A 144×28
  path: faint full tail, predicted stroke dashed to 24 / 50 / 77 % for defining / working /
  polishing with a marker; optional **observed** stroke offset 3px with a marker at
  `complete/nodes` along the hill.
- When and only when the hill renders, the row carries `data-thread-progress-hill=<phase>`
  (`:4304`), which sets the phase colour (defining → warning, working → accent-foreground,
  polishing → success) used by the hill, the addon line tint, and the covered timer.
- On compact rows the hill shrinks to 1.7rem (`app.css:1456`); it is not hidden.
- Hidden by default (policy `never`); forced to full opacity on hover.

### Working shimmer

Working rows animate a `--primary` sweep through the title and topic text (2.4s linear);
paused offscreen; disabled under `prefers-reduced-motion`.

## A4. Controls catalog

| Control | Location | Exact label / options | Default | Scope | Effect |
|---|---|---|---|---|---|
| View as… | toolbar left | bb-identity picker: "My view", people search | self | identity session | read-only lens over another person's sections and view state (A1) |
| Identity status | toolbar left, conditional | ⚠ with retry tooltip | | | retry identity resolution |
| Sort | toolbar left, cycle button | Manual order → Recent activity → Section defaults | **Section defaults** | per browser | A5 |
| Sort right-click (Recent only) | | "Apply Recent order to Manual" | | per browser | copies current Recent order into the manual list and switches to Manual |
| Sections | toolbar left, popover | editor (A6) | Pinned + Everything else | per identity | partition |
| Custom groups | toolbar right, toggle | "Groups on / Groups off" | off | per identity | A8 title-prefix grouping |
| Display → Recent sort | popover | "All activity" / "My last message" (+ loading / unavailable / error note with Retry) | All activity | per browser | basis for Recent and for sections sorted by recent activity; **not** for section recency windows |
| Display → Hill chart | popover | Never / Recent (Started, Ended, Interacted) / Always | Never | per browser | A3 |
| Display → Topic summary | popover | same | Always | per browser | A3 |
| Display → Sticker | popover | same | Always | per browser | A3 |
| Display → Grouping | popover | ☐ Group by worktree | off | per browser | A8 |
| Display → Hover actions | popover | Never / Alt/Opt + Hover / Hover | Hover | per browser | A10 |
| Quick filter | under toolbar | All / Active (n) / Waiting on me (n) | All | per browser | A7 |
| Section header | list | collapse / expand | open | per identity (stored in the section config) | hides that section's rows; membership claims unchanged |
| Rails | list | bar (group / worktree) or tube (family) | open / Active children | per identity | A8 |

## A5. Ordering

One **shared manual sequence** and one **Recent** projection; sections slice them.

- **Manual** (`lib/manual-thread-order.ts`): a persisted id list per browser. New threads
  enter at the top (reconciled only against a fully loaded list). Dragging moves whole
  families; a group or worktree heading drag moves its visible descendants as one block.
  Saved order is saved sunk (A9).
- **Recent, basis "All activity"** (`lib/thread-order.ts`): activity time = max(host
  `latestAttentionAt`, `lastStartedAtMs`, `lastEndedAtMs`), rolled up to the family's newest
  member. Rows fall into **temporal cohorts** measured from the newest activity in the list:
  0–4h, the next 36h, the next week, then weekly bands. Order within a cohort: foreground
  before backgrounded, then activity desc, createdAt desc, id.
- **Recent, basis "My last message"** (`sidebar-progress.ts:58`, `viewer-message-recency.ts`):
  a plain descending sort on the family's newest **viewer-authored** `client/turn/requested`
  time, **without cohorts**. Known "never messaged" sorts as −∞; a thread not yet in the
  cache sorts by `createdAt`; until the first complete load for this viewer the list stays
  in All-activity order (the Display note says so); cached values are kept while a thread's
  newer version refetches, so one update never flips the whole list. Loads run in batches
  of 100 with a 300ms debounce.
- **Section defaults**: each section's "Default sort" (manual | activity) picks between the
  two established orders for that section; the global Sort button shows icon-only.
- Reorder eligibility: dragging works only in Manual, or under Section defaults inside a
  section whose default is manual (`:2365`); only roots (depth 0) are draggable (`:3031`);
  drops are ignored across section scopes (`:1720`); a family may appear in more than one
  section when "Exclude threads shown above" is off, but an accepted drop still rewrites the
  single shared manual sequence.

## A6. Sections

### Config (`ThreadSectionConfig`, `lib/thread-list-pipeline.ts:11`)

`name, active, filterMode (all | pinned | attention | working), sortMode (manual | activity),
participantFilter ({all} | {viewer} | {identity}), projectIds[], groupPaths[] (exact title
prefixes), maximumItems (1–100 | none), recentWithinMs (Any time | 1h | 4h | 1d | 3d | 1w | 2w |
30d), excludePreviouslyShown, collapsed`. Defaults: **Pinned** (pinned, manual) then
**Everything else** (all, exclude previously shown).

### Evaluation law (`deriveThreadSections`; `THREAD_GROUPING_DESIGN.md`)

Evaluated top to bottom over **family roots** in the established order (`:1493`):

1. Predicates on the root: filterMode, participation (root's `p6rParticipants`), exact
   title-prefix paths (ORed, case-sensitive), project ids, and recency window using the
   **All-activity timestamp regardless of the Recent basis** (`:1518`). A pinned or matching
   child does not qualify its family on its own.
2. If `excludePreviouslyShown`, drop roots already claimed above.
3. `maximumItems` keeps the first N **families**; overflow stays eligible below.
4. Claim. Then the quick filter restricts each section's visible subsequence
   independently. Collapse participates in neither phase, so claims never leak.

- **Absorbing** section = active, all, all participants, no project / group / max / recency.
  New sections insert before the first absorbing one; an excluding section below one is
  unreachable (editor warns; pre-v5 saved shapes are repaired on decode).
- A shared clock wakes at the next recency-window or covered-command deadline so rows change
  section on time.

### Editor (Sections popover)

"Filtered sections / Active sections apply top to bottom" + **Add**. Per section: eye toggle
(active), name input (blank → "Section n"), ↑ ↓ 🗑 (the last remaining section cannot be
removed); when active: Threads, Default sort, Participation (All / Viewer (name) / Specific
person → identity picker), Maximum, Recent within; collapsible project list ("Remove n
unavailable projects"); collapsible title-group list with free-text add and retained "(not
currently loaded)" paths; "Exclude threads shown above"; unreachable warning.

### Storage and identity

Identity-scoped state resource through `@phosphorco/bb-identity` (collection
`thread-sections`, record `sidebar`, payload v5), receipt-backed SQLite on the server, write
policy self-only, read policy collaborators. Conflicts and blocked states surface as in A1.
No browser draft, import, or export by design.

## A7. Quick filter

`All | Active | Waiting on me`, per browser. Badges count distinct families already in
sections (A0). Applied after section claims, so it never moves a family between sections.

**Reveal behaviour (active today).** A non-All quick filter supplies its matching thread ids
through the same path the dormant text search used (`:1450`, `:2101`). Effects: matching
descendants are revealed inside collapsed or mode-filtered families; the family summary
line is suppressed; children lose the compact "Active children" treatment (`:3020`,
`:3037`); the rail tooltip appends "(filtered results override)". Waiting on me matches
roots only, so it never reveals children; Active can.

## A8. Grouping and hierarchy

### Title-prefix groups (`lib/thread-groups.ts`)

- Law: the first colon splits `group path: subject`; the path is slash-separated, trimmed,
  case-sensitive. No prefix → the project name is the display-only fallback path.
- Projection wraps only **adjacent** runs of ≥2 rows sharing a prefix at each depth;
  singleton nested branches lift to the nearest rendered ancestor; `flatten(project(order))
  === order`, so Manual and Recent give the same hierarchy for the same flat order.
- Group node: bar rail, optional drag handle, `<details><summary>` heading with chevron and
  the last path segment; collapsed state per identity.
- Right-click a heading → **Change color…**: hue slider 0–360° with live rail preview,
  Save / Clear color / Cancel. Hues are **shared by everyone**, keyed by the exact segment
  name, resolved deepest segment first; a thread's own prefix hue wins over an inherited
  one, which wins over the project-name hue.

### Worktree groups (`lib/worktree-groups.ts`)

Buckets top-level families by (project, environment) when `workspaceDisplayKind` is a
managed or unmanaged worktree, only when ≥2 families share one; the group sits at its first
member and gathers later members across intervening rows (so the flatten law does not hold
for worktree projection); label = environment name → branch → "Worktree"; never gathers
across the foreground/background boundary; under custom groups it resolves only to the
project path; collapse per identity; draggable as a block.

### Families

- Built from `parentThreadId` with missing-parent and cycle repair.
- **Child visibility mode** per parent, per identity: `collapsed ⋅`, `working ∶` (default,
  shown as "Active"), `foreground ∴`, `all ∷`. A child branch shows when its subtree matches
  the mode (A3 table for the Active predicate).
- Controls: the family tube rail cycles modes; the **family summary line** below the children
  (or in their place when collapsed) shows the glyph, mode label, a ratio (`active/total`,
  `foreground/total`, `n children`), one 7×2px tick per active direct child branch (red if
  that branch has an unread error), and on hover a four-button mode picker.
- Children under a parent in Active mode render compact (A2).

### Rails (`app.css:1117-1280, 2612-2730`)

One absolutely positioned 0.75rem button per group / worktree / family; z-index 2 + depth
(cap 11); strength 18% + 12% per depth (cap 66%), or 68% with a hue. **Bar** (groups,
worktrees): 4px pill with a notch triangle cut out, flipped when collapsed, 5px on hover.
**Tube** (families): 6px hollow outlined tube with a solid cap over the parent row and two
triangles pointing toward each other when open. The row's own gutter marker is suppressed
when its hue equals the enclosing rail's.

## A9. Background and foreground (canonical statement)

- Server-stored **global** set (shared by every identity; `migrations.ts:39`, no identity column).
- Row menu: **Push to background / Bring to foreground**.
- Bulk items (`lib/thread-row-bulk-actions.ts:61`, targets from `thread-nesting.ts:203`),
  visible when applicable and **disabled** when nothing qualifies:
  - *Move children to background*: every foreground descendant, including ones hidden by
    the current child-visibility mode.
  - *Move siblings after this to background*: later same-level siblings that are foreground.
  - *Archive backgrounded children*: descendant subtrees that are **entirely** backgrounded;
    mixed subtrees are left alone.
- Presentation: compact row at 40% opacity, no addon line, hill shrunk.
- **Sinking rule** (referenced by A5, A6, A8): in every sort mode and at every nesting
  level, fully-backgrounded families are stably partitioned below foreground ones; Recent
  additionally orders foreground before background within each cohort; worktree gathering
  never crosses the boundary; manual order is saved sunk.
- Drag across the boundary: dropping a backgrounded family onto a foreground row brings it
  (and the dragged row) to the foreground optimistically, restoring the order if the RPC
  fails; a foreground family dropped among backgrounded rows lands after the last
  foreground family.
- Lifecycle, grouping, and unread state are untouched.

## A10. Gestures, menus, dialogs

| Gesture | Target | Result |
|---|---|---|
| Click | row link, title | open thread (title click waits 220ms to rule out a double-click) |
| ⌘/Ctrl-click; menu "Open in split" | row, title | open in split pane |
| Drag toward the main area | row link (host `splitProps`) | drag-to-split, host-owned |
| Drag ≥4px (mouse) / long-press 300ms ±6px (touch) | row link, title text, group handle | reorder when eligible (A5) |
| Arrow keys (dnd-kit keyboard sensor) | focused row link | reorder |
| Double-click | title | inline rename (Enter saves, Esc cancels, blur saves; failure keeps the input) |
| Double-click | comment | edit comment |
| Right-click | row | context menu |
| Hover / Alt+hover (policy) | row | reveal 💬 and ⋯; text masks under them; timer hides |
| Right-click | group heading | Change color… |
| Right-click | Sort button in Recent | Apply Recent order to Manual |
| Click | section header | collapse / expand (guarded edit, A1) |
| Click | bar rail | collapse / expand group or worktree |
| Click | tube rail, summary label | cycle child visibility; mode buttons set directly |
| Hover / focus | participant avatar, +n | inline name disclosure |

Row clicks are swallowed for 250ms after a drag ends or cancels. Alt tracking (window
keydown / keyup / blur) is installed only in the "Alt/Opt + Hover" policy. On touch, coarse
pointers, or widths ≤48rem the ⋯ button is always visible, the 💬 button is hidden (Add
comment stays in the menu), and the timer never masks.

**Row action menu** (context menu and ⋯ dropdown carry the same items): Open in split (if
available) · Copy link · — · Add comment · Mark read / unread · Pin / Unpin · Push to
background / Bring to foreground · bulk items (A9) · Rename · Change group · — · Add sticker /
Edit sticker… · — · Archive · **Delete**. Archive and Delete hand off to host confirmations.

**Dialogs**: Rename thread (whole title); Change thread group (prefix only, datalist of
existing prefixes, blank clears); Add / Edit comment (textarea ≤2000); Edit sticker
(rotated preview, direction ≤1000, Regenerate, Remove, Okay; the old sticker fades under a
painting animation while generating); Color "<group>"; Identity picker (search, avatar,
name, login); View as.

## A11. Control dependencies and precedence

The controls are not independent. A redesign that recombines them inherits these couplings
unless it changes them.

| Control | Applies when | Overridden by / interacts with |
|---|---|---|
| Section "Default sort" | only while global Sort = Section defaults | global Manual / Recent override every section |
| Dragging | Sort = Manual, or Section defaults + section default manual | roots only; same section scope only; rewrites the one shared order |
| Recent basis (My last message) | Recent mode and manual-default sections sorted by activity | **not** section recency windows (always All activity); falls back to All activity until loaded |
| Quick filter | after section claims | reveals members like search; never changes membership or counts in headers |
| Section recency window, project, prefix, participation | root facts only | children never qualify a family |
| Custom groups | after ordering; adjacency only | worktree groups form first and resolve to project path |
| Worktree groups | ≥2 families, same partition | split by foreground / background |
| Child-visibility mode | per parent | overridden by an active quick filter (reveal) |
| Background sinking | every sort, every level | drag across the boundary flips state |
| Feature visibility (hill / topic / sticker) | multiplied by age opacity | hover forces 1; compact rows drop topic |
| Phase colour | only while a hill renders | hill policy Never (default) disables phase tinting entirely |
| Identity scope | sections, view state (grouping, collapse, child modes) per identity; hues shared; backgrounding global; sort / basis / quick filter / display per browser | View-as makes identity-scoped state read-only |

---

# Part B. Engineering appendix (current mechanisms, not requirements)

## B1. Host contract

`PluginSidebarThread` fields (SDK `bb-plugin-sdk-app.d.ts:20673`); ✓ = read by the inbox.

| Field | Read | Notes |
|---|---|---|
| `id`, `projectId` | ✓ | |
| `title`, `titleFallback` | ✓ | via local `displayTitle()`; the SDK's mention-resolved `displayTitle` is not used |
| `displayTitle`, `href` | ✗ | row anchor is `href="#"` with a click handler |
| `parentThreadId` | ✓ | families |
| `lifecycleOwnerThreadId`, `sourceThreadId`, `originKind`, `originPluginId` | ✗ | |
| `sectionId` (host named sections) | ✗ | a different concept from plugin Thread Sections |
| `providerId` | ✗ | |
| `status` | ✗ | |
| `runtimeStatus` | ✓ | only `idle` lets a background-command-only thread be covered; other states are not otherwise distinguished |
| `queuedWork` | ✗ (field) | but queued states reach the user through `indicator` / `indicatorLabel` in the timer sentence |
| `hasPendingInteraction` | ✓ | |
| `activity {workflows, backgroundAgents, backgroundCommands, planMode, goals}` | ✓ | |
| `indicator` (14 values), `indicatorLabel` | ✓ | |
| `p6rParticipants[]` | ✓ | |
| `isUnread`, `isPinned` | ✓ | |
| `pinnedAt`, `pinSortKey`, `isArchived`, `archivedAt`, `isHidden` | ✗ | |
| `environment {id, name, branchName, workspaceDisplayKind}` | ✓ | `path`, `isWorktree`, `providerId` unread |
| `host {id, name}` | ✗ | |
| `createdAt`, `updatedAt`, `lastReadAt`, `latestAttentionAt` | ✓ | |

Host actions used: `open`, `setPinned`, `setRead`, `rename`, `archive`, `requestDelete`;
unused: `openNewThread`, `experimental_archiveEnvironmentThreads`. Per-row hook used:
`experimental_useSidebarThreadSplit`. Available but unused: `experimental_useSidebarThreadPullRequest`
(an opt-in git-host lookup; PR state is **not** on the thread payload) and the host's
`sections` list.

## B2. Data model exposed to the row

`PublicProgress` (`lib/progress.ts:70`): `state (active | idle | error)`, `stateSinceMs`,
`accumulatedWorkMs`, `lastStartedAtMs`, `lastEndedAtMs`, `topic`, `activity`, `phase`,
`disposition`, `waitingOn[] {kind: identity | bb-thread | background-job, id}` (≤32),
`summaryGeneratedAtMs`, `observedPlan {slug, title, complete, nodes} | null`.

Validation accepts topic 1–80 characters and activity 1–100 characters (`progress.ts:91`);
the prompt's "3–7 words" / "4–14 words" are requests, not limits. Topic is kept once set;
activity, phase, disposition, and waitingOn are replaced only by an **accepted** later
summary (`server.ts:1603`), so a quiet idle span may leave them unchanged.

Also: global `backgroundedThreadIds`; `ThreadComment {id, threadId, body, author profile |
null, createdAtMs, updatedAtMs}`; `ThreadSticker {svg | null, rotation, prompt, status}`;
`IdentityProfile {principalKey, legacyIdentityId, displayName, login, profilePicture, tag,
assurance}`; shared hues; per-identity view state; per-thread viewer-message time.

## B3. Persistence map

| Scope | Key / table | Contents |
|---|---|---|
| Browser localStorage | `thread-progress:sort-mode` | manual / activity / section |
| | `thread-progress:recent-basis` | activity / viewer-message |
| | `thread-progress:quick-filter` | all / working / attention |
| | `thread-progress:manual-order:v1` | ordered root ids |
| | `thread-progress:sidebar-display` | v1 {hillChart, topicSummary, sticker, hoverActions, groupByWorktree} |
| | `thread-progress:sidebar-view-state:v2` | local fallback copy of view state, written only when no identity resolves |
| | `thread-progress:group-threads`, `thread-progress:subtree-background:v1` | legacy, read for migration |
| Server kv, per identity | `sidebar-view-state:v2:<principal>` | v6 {groupThreads, familyChildVisibility[], collapsedGroups[], collapsedWorktrees[]} |
| Server kv, shared | `group-hues:v1` | [segment, hue][] |
| Identity state resource | `thread-sections` / `sidebar` | sections v5 |
| Plugin SQLite, shared | `backgrounded_threads`, `thread_comments`, `thread_stickers`, `sticker_jobs`, `thread_progress`, `topic_summary_history`, `topic_summary_latest`, `summary_jobs`, `summary_attempts`, `summary_worker_cleanup`, `summary_thread_deliveries`, `thread_user_turn_counts`, `thread_phase_facet_projection`, `notification_outbox` | |

Identity-state writes are serialized and retried at 250ms / 1s / 4s; loads retry on the
same schedule and a transient read failure never overwrites durable state; previewing
another identity never writes.

## B4. Realtime and refresh

Channels `progress-changed`, `comments-changed` (ids batched by 500), `stickers-changed`,
`group-hues-changed`, `topic-summaries-changed`. Reconnect refetches identity, progress,
comments, stickers, hues. Comments also refetch when the listed threads or viewer change
and on tab visibility if older than 60s. Backgrounding and hue changes are optimistic with
request fences; hue saves queue and retry 0 / 250 / 1000 / 4000ms.

## B5. RPC surface (`server.ts:rpcContract`)

`getCurrentIdentity`, `getThreadContext` (for other plugins), `listProgress`,
`listViewerMessageRecency`, `listTopicSummaries`, `listThreadParticipants`,
`searchIdentityDirectory`, `getIdentityProfiles`, `loadSidebarViewState`,
`saveSidebarViewState`, `loadGroupHues`, `setGroupHue`, `setBackgrounded` (unused by the UI),
`setManyBackgrounded`, `listComments`, `addComment`, `editComment`, `deleteComment`,
`listStickers`, `generateSticker`, `removeSticker`. All run as `interactive-user` through
bb-identity. Also `GET /progress` and CLI `bb thread-progress summaries [--json]`.

## B6. Server pipeline

- **Lifecycle**: host events `thread.created / active / idle / failed / archived / deleted`
  on visible threads → `active | idle | error` transitions; durations derived from stored
  timestamps; startup reconciles against the host list. Archive removes progress; delete
  also removes backgrounding, comments, stickers, deliveries, jobs, attempts, and the
  latest-summary pointer (history kept).
- **Summaries**: settings `summariesEnabled` (true), `summariesForChildThreads` (false),
  `idleDelaySeconds` ("60"), `summaryMinUserTurns` ("0"). Sweep every 5s; eligible = idle ≥
  delay ∧ user turns ≥ minimum ∧ not yet requested for this idle span ∧ no pending retry ∧
  parent rule; at most 2 requests per sweep; one claimed attempt per (thread, completed-turn
  basis). Candidate `waitingOn` allowlist = participants, threads this thread messaged
  (`client/turn/requested` with `senderThreadId`), active Background Jobs. Worker = hidden
  fork at the last `turn/completed`; fallback = hidden spawn with the last 60 outline items
  as untrusted evidence and an unknown source basis. Accepted only if the source is still
  idle in the same span; appended to history; worker archived via a retrying cleanup queue.
  Optional execution overrides through `@phosphorco/bb-provider-settings`.
- **Phase facet**: declares host facet `thread-progress/phase` (enum) and projects the
  plugin phase with a durable revision table; degrades when the host lacks facets.
- **Observed plan**: per primary-host environment, newest Plan-as-Graph `.plan.ts` under
  `.context/plans` or Workbench `.plan.pkl` under `plans` by ledger mtime; ignored if >24h
  older than the latest commit; `bun tools/plan/run.mts tick` / `workbench plan tick
  --format json`; shared by every thread in that environment.
- **Stickers**: hidden spawn; output must be a path-only 64×64 SVG ≤24KB with no scripts,
  text, images, filters; one job per thread; previous sticker restored on launch failure.
- **Comments**: ≤2000 chars, author frozen as a profile snapshot; anyone may edit or remove.
- **Notifications**: `work-ready` (quiet, soon) on idle; `work-failed` (loud,
  time-sensitive) on failure; delivered to the `notifications` plugin via a durable outbox.

## B7. Performance mechanisms

- **Viewport realization**: one IntersectionObserver on the scroll root with 320px vertical
  overscan; a row is heavy when intersecting or pinned (active, focus-within, renaming,
  comment editor, menu open, dragging, within 8 rows of a drop target). Instance keys name a
  row's place in the tree, so re-sorting keeps realization. The value 96 is a **diagnostic
  threshold** only: the controller publishes `data-viewport-limit-exceeded` and high-water
  marks (`:419`) and never limits realization.
- **Temporal reactivity**: one shared deadline-based scheduler (`temporal-reactivity.ts:163`)
  wakes at the earliest registered deadline, suspends while the document is hidden; realized
  rows register a 1s source, offscreen rows a frozen sample; a "section-membership" source
  registers the next recency-window or covered-command deadline.
- Rows are memoized with stable callbacks; collection-reuse helpers keep identities across
  refetches; subtree facts are computed once per render in O(n).
- CSS: `contain: layout paint style` on shells, `overflow-anchor: none`, shimmer paused
  offscreen, no `:has()` on rows.

## B8. Accessibility and adaptive behaviour

Toolbar `role=toolbar`; quick filter `role=group` with `aria-pressed`; section headers and
rails `aria-expanded` (+ `aria-controls` on families); rows `role=link` with
`aria-current=page`; status `role=timer` with the full sentence; participants `role=group`
with names; sortable items announce "sortable thread / group / worktree group".
Focus-visible rings on every control; forced-colors-safe header focus; `prefers-reduced-motion`
disables shimmer, sticker animation, and transitions; touch / coarse / ≤48rem rules in A10;
container ≤24rem hides toolbar labels.

---

# Part C. Dormant paths, unused capabilities, history, adjacent surfaces

## C1. Adjacent surfaces in the same plugin

- **Thread Progress / Summaries** nav panel: TanStack table of latest summaries; columns
  Topic, Activity, Thread, Project, Follow-up, Phase, Generated; per-column filters; sort
  presets; pagination 25 / 50 / 100; expandable cells; thread buttons open (modifier or
  middle-click = split); notices for truncated snapshots and no-longer-visible threads.
- **Settings → Progress execution**: role editors for `summary` (inherit / by-provider,
  reasoning-only) and `sticker` (inherit / tuple).
- CLI `bb thread-progress summaries`.

## C2. Status of notable paths

| Item | Status | Evidence |
|---|---|---|
| Text search matching (title, project, group path, topic, activity, comment bodies) | **dormant**: host passes `searchQuery=""` (`fork/upstream/apps/app/src/components/sidebar/PluginThreadList.tsx:72`) | `progress-inbox.tsx:1418` |
| Filtered-family reveal (descendants revealed, summary suppressed, compact removed) | **active** through the quick filter (A7) | `:1450`, `:2101`, `:3037` |
| Built-in sidebar "progress block" augmentation | **removed** in `64812d0`; README section "Both the inbox and built-in sidebar…" and `app.css:1-128` are leftovers | `app.tsx` |
| `FilterMenu`, `ParticipantFilterMenu` | **not mounted**; their roles moved into section config | `sidebar-list-menu.tsx` |
| Curtain tones `working`, `pinned`, `interaction`, `open` | **styled, never emitted** | `sidebar-display.ts:rowCurtain` |
| `setBackgrounded` RPC | **unused** by the UI (uses `setManyBackgrounded`) | `server.ts` |
| `isCompactViewport`, `activeProjectId` props | **unread** | `progress-inbox.tsx:700` |
| Host fields not read: `displayTitle`, `href`, `status`, `runtimeStatus`, `queuedWork`, `sectionId`, `host`, `providerId`, `pinnedAt`, `pinSortKey`, `isHidden`, `environment.path/isWorktree/providerId` | **available, unread**; note queued states still surface via `indicatorLabel` | B1 |
| PR state | **requires the opt-in per-row hook**; not on the payload | SDK contract |
| Server values present but shown only in the timer sentence or tooltip: `accumulatedWorkMs` ("worked … total"), dependency targets (as a count label) | **partially surfaced** | A3 |
| Server values not shown in the row: `summaryGeneratedAtMs`, `observedPlan.title`, individual `waitingOn` targets | **unsurfaced** | B2 |
| Row anchor `href="#"` | native middle-click / copy-link / open-in-new-window do not work from the anchor; **Copy link** is a menu item | `:3946` |
| "Thread Sections" (plugin) vs host "sections" (`bb thread section`) | **name collision**, different concepts | B1 |

## C3. Densities for reference

Standard row 2.5rem, compact 1.85rem; title 0.78rem, addon 0.62rem, timer 0.61rem,
section header 0.68rem (1.9rem tall, sticky), group heading 0.66rem (1.8rem), family
summary line 0.6rem (≥1.45rem).
