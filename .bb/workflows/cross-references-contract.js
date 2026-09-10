export const meta = {
  name: "cross-references-contract",
  description: "Resolve the first-slice Cross References contracts and turn them into an implementation-ready execution document",
  phases: [
    {
      title: "Resolve contract",
      detail: "Independent specialists make the storage, delivery, and BB integration decisions concrete",
    },
    {
      title: "Synthesize plan",
      detail: "One design owner reconciles the decisions into the plugin documentation",
    },
  ],
};

const sharedContext = `
Work in /home/ubuntu/bb. Read the root and community-plugins AGENTS.md files,
run ./bin/status, and preserve every existing dirty change. The target is the
documentation-first public community plugin at
community-plugins/plugins/cross-references. Read ARCHITECTURE.md, README.md,
server.ts, the Machine Monitor implementation, and the current BB plugin SDK
contracts relevant to your assignment.

The product vision is an authority-free cross-reference model: resources have
a provider plus a string key bag and presentation; contributors may eventually
publish aligned defineCrossLinks conventions; exact identity ignores
presentation; a richer resource can later participate in contained lookups.
The first proving spine is deliberately narrower: attach BB threads to the
deployment-local Machine Monitor page, project those references durably into a
shared exact-backlink index, and show a Machine Monitor backlink on a thread.

The feasibility review concluded that BB already supplies plugin SQLite/WAL,
backend RPC, supervised services, realtime invalidation, thread discovery, and
thread-header contributions. It also identified required corrections before
coding: bounded canonical installation-local identities; separation of
resource, producer occurrence, and display grouping; explicit SQLite integrity
and indexes with foreign_keys enabled; rollback-safe CAS, mutation IDs, payload
digests, tombstones, rebase, coalescing, and stale-ack safety; honest
unauthenticated producer attribution; ephemeral realtime plus refetch; and
local-first behavior while Cross References is absent. Containment, public URL
templates/defineCrossLinks, GitHub, Sticky Notes, federation, generic UI, and
automatic deleted-thread cleanup should be deferred.

Return decisions, not a restatement. Cite exact local files and APIs that
constrain each decision. Do not edit files in this phase.
`;

const resultSchema = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "decisions", "risks", "acceptanceTests"],
  properties: {
    summary: { type: "string" },
    decisions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["topic", "recommendation", "rationale"],
        properties: {
          topic: { type: "string" },
          recommendation: { type: "string" },
          rationale: { type: "string" },
        },
      },
    },
    risks: { type: "array", items: { type: "string" } },
    acceptanceTests: { type: "array", items: { type: "string" } },
  },
};

phase("Resolve contract");
const proposals = await parallel([
  () =>
    agent(
      `${sharedContext}\nOwn the identity and relational-storage design. Specify the exact canonical form and limits for BB thread and Machine Monitor page resources, installation scope, deterministic serialization, resource/occurrence/display deduplication boundaries, tables, constraints, foreign-key behavior, exact-backlink query, pagination cursor, and schema migration posture. Keep the first schema exact-only while preserving a credible path to contained matching.`,
      {
        provider: "codex",
        model: "gpt-5.6-luna",
        reasoningLevel: "xhigh",
        label: "identity-and-storage",
        phase: "Resolve contract",
        schema: resultSchema,
      },
    ),
  () =>
    agent(
      `${sharedContext}\nOwn the delivery state machine. Specify Machine Monitor's local attachment mutations, revision allocation, one-row coalescing outbox, mutation IDs, canonical digest, receiver expected-revision CAS, durable empty projections, duplicate/equal/stale/conflicting delivery outcomes, stale acknowledgement protection, database rollback detection and rebase, restart behavior, unavailable-plugin classification, backoff, and the exact transaction boundaries. Prefer the smallest protocol that actually converges.`,
      {
        provider: "codex",
        model: "gpt-5.6-luna",
        reasoningLevel: "xhigh",
        label: "delivery-and-recovery",
        phase: "Resolve contract",
        schema: resultSchema,
      },
    ),
  () =>
    agent(
      `${sharedContext}\nOwn BB integration and slice boundaries. Verify the concrete backend RPC, service, database, realtime, thread search/resolution, internal navigation, Machine Monitor panel, and experimental thread-header APIs. Decide which plugin owns each state and UI surface, how cross-plugin calls and degraded behavior work, what producerPluginId can honestly mean, how mount/reconnect invalidation works without polling, and what must be private or deferred. Include accessibility, compact/split-pane behavior, and verification gates.`,
      {
        provider: "codex",
        model: "gpt-5.6-luna",
        reasoningLevel: "xhigh",
        label: "bb-integration-and-scope",
        phase: "Resolve contract",
        schema: resultSchema,
      },
    ),
]);

const usableProposals = proposals.filter(Boolean);
if (usableProposals.length === 0) {
  throw new Error("No contract specialist returned a usable proposal");
}

phase("Synthesize plan");
const synthesis = await agent(
  `${sharedContext}

You are the design owner. The independent specialist proposals follow:
${JSON.stringify(usableProposals)}

Reconcile them against the actual repository and feasibility findings. Make
the smallest documentation changes that leave no protocol ambiguity for the
first exact-reference proving slice. Update ARCHITECTURE.md where its current
claims are wrong or underspecified. Add IMPLEMENTATION.md beside it containing:
the motivating product outcome; non-goals; precise first-slice contracts;
ownership boundaries; delivery state machine and transaction invariants;
schema and query shapes; degraded/reconnect behavior; a dependency-ordered
three-workflow execution strategy (contract, proving spine, adversarial
closeout); scoped file ownership for future workers; and executable acceptance
gates. Clearly label deferred public APIs and containment work so they remain
vision, not implied first-slice promises.

This agent may edit only community-plugins/plugins/cross-references documentation
and package metadata needed to publish that documentation. Use apply_patch.
Do not implement runtime or UI code, do not touch Machine Monitor or Sticky
Notes, do not commit, and do not disturb unrelated dirty work. Run focused
documentation/package sanity checks and git diff --check. Return a concise
summary of decisions, files changed, checks run, and any blocker that should
prevent the implementation workflow from starting.`,
  {
    provider: "codex",
    model: "gpt-5.6-luna",
    reasoningLevel: "xhigh",
    label: "contract-synthesis",
    phase: "Synthesize plan",
  },
);

return {
  specialistCount: usableProposals.length,
  synthesis,
};
