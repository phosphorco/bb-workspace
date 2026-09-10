export const meta = {
  name: "cross-references-proving-spine",
  description: "Implement and verify the Machine Monitor to BB thread Cross References proving spine",
  phases: [
    {
      title: "Build index",
      detail: "Implement canonical exact resources, durable projections, and bounded backlinks",
    },
    {
      title: "Connect source",
      detail: "Add Machine Monitor local attachments and its durable projection outbox",
    },
    {
      title: "Expose backlinks",
      detail: "Add the bounded Machine Monitor picker and per-thread backlink surface",
    },
    {
      title: "Verify spine",
      detail: "Exercise the complete local-first reference flow and repair integration defects",
    },
  ],
};

const resultSchema = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "filesChanged", "checks", "blocker"],
  properties: {
    summary: { type: "string" },
    filesChanged: { type: "array", items: { type: "string" } },
    checks: { type: "array", items: { type: "string" } },
    blocker: { type: ["string", "null"] },
  },
};

const sharedContext = `
Work in /home/ubuntu/bb on the existing direct workspace. Read the root and
community-plugins AGENTS.md files and run ./bin/status before editing. The
workspace and community-plugins repository already contain substantial
authored dirty work, including active Machine Monitor disk-breakdown changes
and the documentation-first Cross References package. Preserve all of it:
never stash, reset, clean, switch branches, commit, move a child HEAD, advance
gitlinks, or delete generated/user files outside the exact task boundary.
Inspect every overlapping diff before editing and merge with it deliberately.

Read these documents as the normative product and v1 contracts:
- community-plugins/plugins/cross-references/ARCHITECTURE.md
- community-plugins/plugins/cross-references/IMPLEMENTATION.md
- community-plugins/plugins/cross-references/README.md

The north star is "link once, recover context everywhere." A reference made
from Machine Monitor must be discoverable from its target thread, preserve the
Machine Monitor source context, and establish the durable primitive that can
later link Sticky Notes, GitHub comments, pull requests, repositories, and
other provider-defined resources. The long-term representation is
authority-free provider plus multipart string keys plus presentation. Exact
identity ignores presentation; later subset containment lets a rich resource
participate in enclosing lookups without synthetic ancestor links. Do not
reduce this to a one-off bookmark table or thread-only identity model.

V1 is deliberately exact-only and deployment-local. Do not publish or imply
containment reads, defineCrossLinks, generic URL codecs/components, GitHub,
Sticky Notes ingestion, federation, automatic deletion cleanup, or a central
provider registry. Preserve an additive path to those capabilities through
the canonical resource model and normalized storage described in the docs.

Use current installed @get-bb/plugin-sdk declarations and working repository
examples for exact APIs. Follow the bb-plugin-authoring, bb-ui, and
bb-performant-react contracts: host-native surfaces and navigation, semantic
theme tokens, bounded results, one 28px thread-header control with portalled
detail, keyed invalidation, refetch on reconnect, no foreground polling, and
abort-aware background services. Use apply_patch for edits. Do not commit
dist output. Do not edit Sticky Notes or unrelated plugins.
`;

phase("Build index");
const index = await agent(
  `${sharedContext}

Own the Cross References backend implementation. Implement the normative
canonicalization, validation, digest, schema/migrations, projection CAS state
machine, exact keyset-paginated backlink query, typed RPC contract, realtime
invalidation, and focused tests described in IMPLEMENTATION.md. Enable and
verify SQLite foreign keys before migrations/registration. Keep resources
exact-deduped and producer occurrences distinct; retain active-empty and
tombstone watermarks; reject conflicting equal revisions and malformed or
unbounded data. Keep pure logic testable and the factory mostly wiring.

You may edit only community-plugins/plugins/cross-references and the minimum
community workspace/package-lock metadata required by its real dependencies.
Do not add the frontend yet and do not touch Machine Monitor. Run focused
tests, typecheck, build, schema/index/query-plan tests, and git diff --check.
Return the structured result. Set blocker only when the next phase truly must
not proceed.`,
  {
    provider: "codex",
    model: "gpt-5.6-luna",
    reasoningLevel: "xhigh",
    label: "cross-references-index",
    phase: "Build index",
    schema: resultSchema,
  },
);

if (!index || index.blocker) {
  throw new Error(`Cross References index blocked: ${index?.blocker ?? "worker failed"}`);
}

phase("Connect source");
const source = await agent(
  `${sharedContext}

The Cross References backend phase completed with this handoff:
${JSON.stringify(index)}

Own Machine Monitor's source side. Read the implemented Cross References RPC
contract and integrate against it without direct database access. Add
Machine Monitor-owned exact BB-thread attachments, expected local revision
CAS, complete-set replacement, atomic revision/outbox commit, immutable
in-flight plus coalesced pending slots, stable mutation/digest retries,
structured error classification, bounded exponential backoff, lease recovery,
startup reconciliation, rollback-safe rebase, stale-ack guards, local status,
and focused tests. Local attach/remove must succeed and remain visible when
Cross References is absent, disabled, stopped, incompatible, or transiently
failing. The delivery service must be abort-aware and idle-quiet.

Preserve and integrate the existing uncommitted Machine Monitor directory
hierarchy/disk-breakdown work. You may edit only the Machine Monitor backend,
RPC contract, store, package metadata, and adjacent tests needed for the
source adapter, plus a narrowly necessary shared Cross References contract
file if integration exposes a real defect. Do not implement UI yet. Do not
touch unrelated Machine Monitor behavior or tests. Run focused tests,
typecheck, build, failure-interleaving tests, and git diff --check. Return the
structured result; set blocker only when the UI phase truly must not proceed.`,
  {
    provider: "codex",
    model: "gpt-5.6-luna",
    reasoningLevel: "xhigh",
    label: "machine-monitor-source",
    phase: "Connect source",
    schema: resultSchema,
  },
);

if (!source || source.blocker) {
  throw new Error(`Machine Monitor source blocked: ${source?.blocker ?? "worker failed"}`);
}

phase("Expose backlinks");
const ui = await agent(
  `${sharedContext}

Backend handoffs:
Cross References: ${JSON.stringify(index)}
Machine Monitor: ${JSON.stringify(source)}

Own the two UI surfaces and their immediately supporting RPCs/tests. Add a
bounded Machine Monitor-owned BB thread picker/search and attachment list
that reflects local truth immediately, supports removal, explains pending or
blocked projection without protocol jargon, and uses native BB navigation.
Add Cross References' experimental per-thread header action: exactly one
compact 28px accessible control, with bounded backlink detail in a portalled
popover, exact per-thread reads, matching-identity realtime invalidation,
reconnect reconciliation, request identity guards, and no polling. Navigate
to threads with toThread and back to the exact Machine Monitor route with the
host semantic URL-link facility. Preserve modifier-click, keyboard, focus,
split-pane, compact viewport, loading, empty, stale, and error behavior.

Use host/native UI contracts and existing vendored components; do not invent
a generic public component API in v1. Keep subscriptions and state per mounted
thread/pane, not module-global. Preserve Machine Monitor's existing disk UI
changes. You may edit only community-plugins/plugins/machine-monitor app/UI
and supporting attachment RPC files/tests, and community-plugins/plugins/
cross-references app/UI/RPC/package files/tests. Run focused frontend/backend
tests, typecheck, build, accessibility/interaction checks available in the
harness, and git diff --check. Return the structured result; set blocker only
when integrated verification cannot proceed.`,
  {
    provider: "codex",
    model: "gpt-5.6-luna",
    reasoningLevel: "xhigh",
    label: "cross-references-ui",
    phase: "Expose backlinks",
    schema: resultSchema,
  },
);

if (!ui || ui.blocker) {
  throw new Error(`Cross References UI blocked: ${ui?.blocker ?? "worker failed"}`);
}

phase("Verify spine");
const verification = await agent(
  `${sharedContext}

Implementation handoffs:
${JSON.stringify({ index, source, ui })}

Act as the proving-spine integration owner. Review every change in the two
owned plugins against IMPLEMENTATION.md and the link-once product motivation.
Run the focused and full community test/typecheck/build gates. Exercise or add
tests for canonical exact identity, CAS outcomes, atomic replacement, cursor
bounds, local-first absence, coalescing/in-flight durability, stale
acknowledgements, rollback/rebase, lease recovery, matching realtime plus
missed-signal reconnect, two-pane component isolation, keyboard/focus/a11y,
and navigation in both directions. Inspect query plans for the exact backlink
index. Ensure no foreground polling, hot retry loop, leaked timer/listener,
unbounded list, generic-v1 promise, unrelated regression, or committed dist.

You may make narrow repairs only within the Cross References and Machine
Monitor paths authorized above, merging with existing dirty work. Do not widen
scope into deferred features. Reload/install the local plugins and exercise
the live staging composition when safe and supported; report any live-runtime
gap honestly rather than claiming it. From community-plugins run npm run test,
npm run typecheck, and npm run build; from /home/ubuntu/bb run git diff
--check and ./bin/check --role staging. Do not commit or advance gitlinks.
Return the structured result with blocker null only if the proving slice is
actually ready for the separate adversarial-closeout workflow.`,
  {
    provider: "codex",
    model: "gpt-5.6-luna",
    reasoningLevel: "xhigh",
    label: "proving-spine-verifier",
    phase: "Verify spine",
    schema: resultSchema,
  },
);

if (!verification) {
  throw new Error("Proving-spine verification worker failed");
}

return { index, source, ui, verification };
