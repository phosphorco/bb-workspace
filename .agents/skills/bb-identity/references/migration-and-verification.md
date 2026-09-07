# Migration and verification

Use [PACKAGING.md](../../../../plugins/packages/bb-identity/PACKAGING.md), the
[master plan](../../../../fork/plans/bb-fork-master-plan.md), and the applicable
feature migration policy. Read only the current feature and host proof sections.

Before cutover inventory visible features, RPC/API compatibility, saved data,
background work and failure/recovery behavior. Record each preserved replacement
and its acceptance witness. Keep comments, thread actions, mode semantics,
notifications, and unrelated settings working while replacing identity plumbing.
Prompt Stacks remains explicitly excluded by the governing task; do not expand
the scope from its mention in an old catalog.

Legacy absence, unreadable storage, malformed bytes, unknown owner and a verified
foreign owner are different states. Retain exact raw bytes/key/owner marker
without stamping the current actor onto them. Make recovery/export usable even
when no decoded candidate exists. Read-only legacy preview should show eligible
server data without importing or initializing it. Define server/browser/default
precedence before the first initializer and preserve a losing candidate.

Do not invent an atomic transaction across KV and SQLite. The Thread Sections
initial rollout uses cold/drained activation and rejects legacy writes; that
specific prerequisite does not establish hot old/new overlap safety. Missing
prepared evidence is not verified empty. Keep import and receipt in the feature
transaction, with live validation and response-loss replay.

Choose tests that cross the changed boundary:

| Evidence | Establishes | Does not establish |
| --- | --- | --- |
| Pure/controller test | Controlled transitions, tokens, CAS outcomes | Mounted React or actual SDK composition |
| Controlled-SDK browser | Actual component/DOM/IndexedDB behavior | Real provider/core route connection |
| Connected public binding | Wire decode, request authority, callbacks, storage | Host installation and app loading |
| Isolated packed consumer | Emitted graph, declarations, exports, dependencies | Same-artifact runtime portability |
| Identical artifact on both hosts | The exercised real baseline/fork workflows | Untested features or future versions |

Use actual actor A -> B -> A, distinct session stamps, owner records and drafts
for an actor-switch claim. Same-actor RPC replacement is a separate useful test.
For recovery assert the defined successful/blocked result and desired/durable
state through completion; a short no-save sleep can pass while an action fails.
Assert route counts and original operation IDs through response loss and retry.
For native facet consumers, exercise more participants than the initial summary
page and filter on a participant found only on a continuation page. Run the
authored plugin factory against the host SDK routes. A direct query test alone
does not verify the consumer's DTO, readiness guard or pagination. For signed
execution changes, cover an intervening edit between preflight and apply; check
expiry and provider/catalog changes again after asynchronous reads, at commit.
Do not assume a clean UI means the draft store is empty: an earlier checkpoint
may remain after its receipt becomes final. Assert exact actor/address eligibility
and the recovery result, rather than an incidental total row count.

Mock the narrow transport/SDK boundary while leaving the production component,
codec and package binding intact. Match exact DTOs (`Result<IdentityProfile>`,
keyed found profile lookups, typed values versus encoded resource envelopes).
Diagnose the actual controller status and phase before blaming lifecycle code.

All package/tsconfig edits originate in the workspace generator. Ordinary checks
must include libraries and must not import ignored proof output. Put exact-host
SDK witnesses in explicit target jobs with pinned inputs. Test every published
entry in an isolated packed consumer and invoke advertised constructors. Keep
actual browser fixture sources under a static check with the selected consumer
SDK package, JSX and DOM libraries; executing a browser bundle alone does not
check its TypeScript contracts. A fixture needing a different SDK from the
portable library should declare that dependency in its own private test package.

Do not remove a wrapper merely because it forwards a call. First identify its
authority, codec, lifetime, ownership or compatibility role. Remove redundant
layers after behavioral tests pass, then rerun the relevant boundary tests.
Preserve authored dirty work and existing runtime restrictions during cleanup.

A migration may decode a documented historical storage format to recover an
issuer/subject candidate. That is different from parsing current opaque keys.
Validate the exact old version/canonical encoding and confirm the candidate
against current server-issued identity before converting an owner. Keep the
original bytes and an explicit held/exportable disposition for unresolved rows;
never block all current users because one historical row cannot be resolved.
Preservation alone is not usable recovery, and retrying an unmappable delivery
forever does not preserve its workflow.

Use public codecs for branded IDs at consumer boundaries. `as never` only hides
a missing validation step. Profile adapters must preserve the distinction between
people and external sources; a supplied display name or a single execution turn
cannot establish person authority or exclusive authorship.

Inventory actual authored call paths before adding dependencies. Native facets
may expose their own participant member keys, pagination and presentation through
supported SDK APIs. Those keys need not equal normalized identity keys. Preserve
the native domain for native filters; do not add duplicate identity reads merely
to claim adoption. Generated declarations and unrelated uses of “identity” are
not consumer migrations.

When validating a selected core patch composition, run its tests from that
composition rather than borrowing results from a broader dirty candidate.
Include the canonical database initialization hook: a schema export does not
run sidecar migrations. Acceptance fixtures must persist the referenced
host/project/thread graph before testing foreign-key-backed history or participant
projection; do not disable constraints to make synthetic objects sufficient.

For environment-gated artifact witnesses, explicitly forward the artifact input
through the test runner and inspect pass/skip counts. Turbo may filter an
undeclared environment variable, turning an intended packed test into a skip.
An overall green command does not prove a skipped public-package witness.

For cross-repository consumers, use a `bun pm pack` artifact with resolved
catalog versions and prove ordinary npm installation. Merely extracting a
tarball bypasses dependency resolution. Keep local artifact verification separate
from registry publication and standalone lockfile/release readiness.

Exercise the actual plugin factory on each supported SDK, not only its identity
routes. SDK declarations from the development workspace can admit fields that a
newer host rejects at registration. Preserve their behavior through the supported
contract; do not infer compatibility from the identity capability version. For a
factory using `bb.sdk`, a test host must both listen and bind its SDK client,
matching normal server startup.

The replacement fork and its comparison baseline target SDK 0.4.47. A plugin
using the modern tool presentation API must declare that target and retain its
labels in `presentation.label`. Organization plugin `sdkTarget` selects pinned
published SDK types and the matching CLI; it does not move the running normal
host. Keep this distinct from the library's broader installed-peer support.

An isolated source directory is insufficient if its dependency links point into
another checkout. Inspect resolved workspace packages and generated SDK modules;
install the selected lockfile inside the test composition. Record the source tree,
lockfile and resolved package roots with the result. Keep generated build runners
with their generator changes: the organization wrapper consumes `--target-sdk`
and selects the matching CLI before invoking it; the raw CLI does not own that
flag. Select imported companion files before calling a consumer commit-ready.

A rejection test must prove which boundary rejected the input. Parse a supposedly
valid adversarial fixture with the real schema, avoid double casts, and assert the
specific rejection reason plus unchanged durable state. A malformed request ID
can otherwise make an authority test pass without reaching its intended guard.
Mentioned recipients are frozen targets, separate from authorship; derive their
keys and presentation through the active provider, and prevent daemon events from
creating server-authored client requests.

### Shared SDK package identity

A matching SDK version number is insufficient for fork extensions. Build and
pack the selected SDK once, record its source tree and archive/declaration hashes,
and install it through normal package resolution. Consumers import the public
`@get-bb/plugin-sdk` entry points and declare their exact dependency. Do not copy
whole SDK declarations into plugins or use TypeScript path aliases to make an
upstream package look like the fork. Keep intentionally supported upstream SDK
targets and the portable library's older development peer distinct.

Frozen installation, public-export resolution, consumer typechecks and builds
must pass before deleting obsolete copies. Never restore an old declaration to
make a consumer compile: a clean package build must reproduce the contract. A
missing member exposes a wrong artifact or missing host behavior. The upstream
`bb plugin types` command repins package-based plugins to its SDK version; use
the workspace artifact/generator update workflow when retaining a fork pin.
Keep configured public URLs and native sidebar participant projection separate
from request-author authority.

Build-tool compatibility is separate from installed SDK compatibility. Verify
the emitted SDK metadata and ensure a normal build does not recreate declaration
copies. A CLI package version does not identify its bundled SDK version. If a
copied declaration hid a removed API, preserve the behavior through the supported
API and test that behavior; do not restore the declaration or cast around it.
