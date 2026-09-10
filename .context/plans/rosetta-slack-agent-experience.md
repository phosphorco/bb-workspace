> Interesting artifacts and learnings must be written back to the [ledger-path]

# Rosetta Slack agent experience: incremental delivery plan

## Plan intent

This plan turns the remaining Rosetta Slack work into a sequence of independently
verifiable gates. Each gate should produce a useful, reviewable increment and
should leave the preceding behavior working. The plan covers the full agent
experience: destination resolution, message fidelity, retrieval, linked-message
expansion, Open Graph and Twitter metadata, files, provenance, permissions,
freshness, delivery, recovery, operator UX, and release validation.

The primary implementation surface is the Rosetta Slack plugin in
plugins/plugins/rosetta-slack. The workspace and child-repository rules in the
root AGENTS.md remain in force. Existing dirty work in the workspace or child
repositories is authored work and must be preserved; unrelated generated or
feature work must not be folded into these gates.

The intended API remains small and progressively disclosed. Agents should be
able to provide one human-readable destination value and message content, while
Rosetta resolves channels, users, direct-message channels, message timestamps,
thread roots, and permalinks internally. More advanced forms remain available
for exact targeting, but they should not be required for common sends or reads.

## Definition of done for the whole plan

The feature is complete only when all of the following are true:

- An agent can read the active Slack conversation, retrieve a bounded amount of
  additional context, and explicitly request a linked message or thread when
  the initial snapshot is incomplete.
- One-level Slack permalink expansion retrieves the target message and its
  relevant thread context, including permalinks with reply paths and
  thread-root query parameters.
- Open Graph and Twitter preview information is extracted with bounded,
  deterministic behavior, associated with the message that introduced the
  link, and clearly marked as metadata rather than authoritative page content.
- Top-level posts and direct replies accept simple destinations and exact
  message references, including channel names, user handles, channel IDs,
  direct-message IDs, and supported permalink or timestamp forms.
- Outbound Slack mrkdwn preserves supported Slack semantics. In particular,
  an inbound user mention can be echoed as a real Slack mention rather than
  being flattened into ordinary display text.
- All aliases for one direct-message conversation use one canonical ordering
  key and one durable delivery path.
- Context identifies hierarchy, source, visibility, trust, freshness,
  completeness, IDs, and failure states. The agent cannot mistake an omitted,
  capped, inaccessible, stale, or failed fetch for proof that no information
  exists.
- Every outbound action has a durable result that distinguishes queued,
  delivered, failed, retried, cancelled, and dead-lettered states and includes
  the exact Slack destination and permalink when available.
- A human or agent can recover from transient fetch and delivery failures
  without duplicating successful sends or silently blocking later messages.
- Automated unit, integration, and end-to-end tests are implemented in the
  codebase, organized using the naming and directory convention below, and can
  be re-run by future agents to prevent regressions.
- Staging validation passes for the exact child commits being promoted, and
  the workspace promotion rules are followed.

## Test and evidence policy

All tests described in this plan must be implemented in the codebase. A test
scenario written in this document is not evidence of coverage by itself.
Tests must be deterministic, isolated from personal Slack credentials, and
re-runnable in local development and CI. Live-workspace checks are an
additional validation layer and never replace automated coverage.

Use the following convention unless the repository adopts an equivalent
convention during Gate 0:

- Focused unit tests live in the Rosetta Slack test directory and use the
  existing area-oriented names, extended with behavior-oriented names where
  needed: state, Slack parsing and formatting, link previews, outbound
  delivery, proactive messaging, agent configuration, and context rendering.
- Integration tests live in a dedicated integration test directory and use
  names ending in integration test. They exercise the plugin boundary with a
  deterministic Slack API double, durable state, outbox transitions, and
  permission or failure responses together.
- End-to-end tests live in a dedicated end-to-end test directory and use names
  ending in end-to-end test. They exercise a complete inbound-to-agent-to-
  outbound flow, including rendered context and operator recovery surfaces.
- Test fixtures are grouped by domain: messages and threads, permalinks and
  previews, users and direct messages, files, delivery failures, migrations,
  and security or trust-boundary cases. Fixtures must identify whether a
  message is a root or reply and must retain the original Slack identifiers.
- Every new behavior has a focused test and, where it crosses a subsystem
  boundary, an integration or end-to-end test. Tests must assert observable
  behavior and durable state, not only internal helper calls.
- External Slack calls in automated tests use recorded or programmatic fakes
  with explicit pagination, rate limits, access errors, malformed responses,
  duplicate responses, and delayed responses. No test depends on a live
  workspace being unchanged.
- Each gate records its test inventory, coverage gaps, command or script used
  to run it, and pass/fail evidence in the [ledger-path].

## Lanes and parallelization

The work can be parallelized after Gate 0 establishes shared contracts and
fixtures. Each lane owns its files and tests, and cross-lane changes should be
coordinated through the contract artifacts rather than by copying partial
implementations.

| Lane | Responsibility | Primary dependencies |
| --- | --- | --- |
| A. Destination and fidelity | Destination grammar, target resolution, reply roots, Slack mrkdwn and mention preservation, delivery receipts | Gate 0 contracts |
| B. Retrieval and evidence | Read surface, thread and permalink expansion, previews, files, context completeness and trust markers | Gate 0 fixtures; can run beside Lane A |
| C. State and reliability | Provenance, migrations, canonical DM ordering, retries, cancellation, freshness, deduplication | Gate 0 contracts; should consume Lane A/B schemas |
| D. Agent contract and tests | Tool descriptions, progressive disclosure, agent-visible result shapes, shared integration and end-to-end harness | Gate 0; coordinates with A–C |
| E. Operator UX and release | Delivery activity, receipts, recovery controls, accessibility, docs, staging and promotion evidence | Gates 1–4; UI work can begin against agreed state schemas |

Recommended execution order:

1. Run Gate 0 as a short shared foundation effort.
2. Start Lanes A, B, and C in parallel once the destination, context,
   provenance, and failure-state contracts are recorded. Lane D builds the
   reusable test harness in parallel and reviews each contract.
3. Join the lanes at Gate 4 for an agent-facing contract review.
4. Run Lane E after the durable delivery and context schemas stabilize.
5. Finish with the shared end-to-end, security, performance, and promotion
   gates. No lane may declare the whole feature complete independently.

Each agent working on a lane must report: files changed, tests added, contract
decisions, unresolved risks, and the path to its ledger entry. Agents should
message the coordinating thread when they finish or are blocked rather than
leaving findings only in local output.

---

## Gate 0 — Baseline, contracts, fixtures, and observability

### Objectives, scope, and dependencies

Establish the shared vocabulary, compatibility expectations, deterministic test
foundation, and baseline evidence needed for the feature lanes to proceed
without conflicting assumptions.

Dependencies: none. This gate may inspect existing behavior and add test
infrastructure, but it must not silently alter unrelated plugin behavior.

Scope includes the current Rosetta Slack agent tools, server routing, Slack API
adapter, link-preview extraction, state and provenance records, outbox and
delivery paths, rendered context, operator UI, and existing documentation.

### Tasks and acceptance criteria

- Inventory the current inbound, read, expansion, preview, outbound, retry,
  follow-up, and operator paths. Record which behavior is implemented, partial,
  best effort, or absent.
  - Acceptance: the inventory names the relevant modules, durable records,
    user-visible surfaces, and current test coverage without claiming coverage
    that does not exist.
- Define the canonical message identity model: workspace, conversation,
  channel or DM ID, message timestamp, root timestamp, sender, visibility, and
  permalink. Define how root posts and replies differ.
  - Acceptance: every supported reference form maps to one canonical identity,
    or produces a typed, user-visible resolution error.
- Define the minimal agent-facing read and send contract, including optional
  parameters for bounded expansion, preview extraction, and exact reply
  targeting. Keep common calls addressable with a single human-readable
  destination value.
  - Acceptance: the contract covers channel names, handles, channel IDs,
    direct-message IDs, timestamp forms, and full Slack permalinks without
    requiring an agent to know internal storage IDs.
- Define context metadata and diagnostic categories: source, hierarchy,
  visibility, trust, freshness, completeness, cap, access denial, not found,
  timeout, malformed data, and upstream failure.
  - Acceptance: every omission that could affect a decision has a distinguishable
    diagnostic state.
- Define the test directory, naming, fixture, fake-Slack, clock, and cleanup
  conventions described in the global test policy.
  - Acceptance: one deterministic fixture can represent a root, a reply, a
    linked reply, a user mention, a file, a preview, and a failed fetch; it can
    be reused by unit, integration, and end-to-end tests.
- Capture a baseline run of the existing focused plugin checks and record
  unrelated pre-existing failures separately from feature failures.
  - Acceptance: the baseline is reproducible and the ledger identifies the
    exact workspace and child-repository state used.

### Verification

Test scenarios must include canonical identity for roots and replies, all
planned reference forms, malformed and ambiguous references, fixture isolation,
deterministic time, pagination, access denial, timeout, rate limit, and
duplicate-response behavior.

Required coverage is unit coverage for parsers and contracts, integration
coverage for the fake Slack boundary and durable records, and a smoke
end-to-end test proving that a fixture can travel from inbound Slack context to
an agent-visible result. Tests must be implemented in the codebase under the
agreed directories and naming convention, and must be re-runnable without live
Slack state.

Pass only when the baseline is reproducible, every contract has an owner, the
fixture harness exercises both success and failure, and all unresolved
ambiguities are written to the [ledger-path]. Fail if a later lane would need to
invent identity, visibility, or failure semantics.

### Gate exit artifact

Publish the contract inventory, test convention, baseline evidence, decision
log, and lane ownership map to the [ledger-path].

---

## Gate 1 — Simple destinations, exact targets, and message fidelity

### Objectives, scope, and dependencies

Make outbound messaging straightforward for agents while preserving exact Slack
semantics. Support top-level posts and replies through a single destination
concept, with progressive disclosure for exact references.

Dependencies: Gate 0’s identity and destination contracts. Lane A leads; Lane D
reviews agent-facing behavior and Lane C reviews durable ordering implications.

Scope includes destination parsing and resolution, conversations and users,
thread-root lookup, permalink parsing, outbound text handling, reply posting,
and delivery-result shaping.

### Tasks and acceptance criteria

- Support human-readable channel and user destinations, canonical channel and
  direct-message IDs, exact channel/message references, full Slack permalinks,
  and supported bare message timestamp references where local provenance makes
  them unambiguous.
  - Acceptance: the common path needs only a destination string and content;
    exact target forms remain available for a direct reply.
- Resolve reply roots from the explicit thread query parameter when a permalink
  points at a reply, validate that the channel in the query and path agree, and
  reject untrusted or mismatched hosts and channels.
  - Acceptance: a reply permalink posts into its actual root thread even when the
    reply is absent from the local message store.
- Resolve top-level versus reply intent consistently. A channel destination
  creates a top-level post; a message destination creates a reply unless the
  contract explicitly requests a root post.
  - Acceptance: no destination silently changes from a root post to a reply or
    vice versa.
- Preserve supported Slack mrkdwn and entity syntax, including real user
  mentions, channel mentions, links, code formatting, and line breaks. Keep
  display-only user names from being mistaken for mention syntax.
  - Acceptance: echoing an inbound mention sends a Slack-recognized mention to
    the same user, while ordinary angle-bracket text is handled safely.
- Return a durable delivery result containing queued, delivered, failed,
  retried, cancelled, or dead-lettered state, canonical destination, target
  root where applicable, and Slack permalink when available.
  - Acceptance: the agent can tell whether work was merely queued or actually
    delivered and can identify the posted message.
- Coordinate with Lane C so aliases for one DM conversation cannot create
  separate ordering barriers.
  - Acceptance: user-handle and direct-message-ID sends share one canonical
    queue key and delivery path.

### Verification

Test scenarios must cover every supported destination form, root and reply
  posts, reply permalinks containing thread-root query parameters, mismatched
  channel identifiers, untrusted hosts, missing local replies, malformed
  timestamps, ambiguous users, archived or inaccessible conversations, and
  mixed handle/direct-message retry ordering.

Required coverage includes unit tests for normalization and mrkdwn fidelity,
integration tests for Slack request payloads, thread-root resolution, durable
outbox ordering, and receipts, and an end-to-end test that receives a message
with a real mention and echoes it as a real mention. Include failure and retry
tests that prove a later send is not blocked forever by a bad target.

All tests must be implemented in the codebase using the Gate 0 naming and
directory convention, and must be re-runnable with deterministic Slack fakes.
Do not treat a manually inspected payload or a one-off Slack send as automated
coverage.

Pass only when all accepted reference forms resolve deterministically, mention
fidelity survives the complete path, aliases share ordering, and receipts are
durable and accurate. Fail if a reply can be posted to the wrong root, if a
mention is flattened, if a queue result is presented as delivery, or if
untrusted links can authorize a send.

### Gate exit artifact

Publish the accepted destination matrix, examples of successful and rejected
resolutions, mention-fidelity evidence, receipt states, and any Slack API
compatibility notes to the [ledger-path].

---

## Gate 2 — Retrieval, one-level expansion, previews, files, and complete context

### Objectives, scope, and dependencies

Turn injected Slack context into a self-describing, bounded evidence snapshot,
and add an agent-controlled retrieval path for information that was not included
initially. Ensure that a Slack message linking to another Slack message can
provide useful context without silently recursing through an unbounded graph.

Dependencies: Gate 0’s context and fixture contracts. Lane B leads and may run
in parallel with Gate 1; it must publish result-shape changes for Lane D and
provenance requirements for Lane C.

Scope includes active-thread hydration, bounded thread retrieval, one-level
permalink expansion, Open Graph and Twitter preview extraction, attachment and
file association, context rendering, freshness, caps, and diagnostics.

### Tasks and acceptance criteria

- Implement or complete a bounded Slack read surface that can fetch a message,
  its containing thread, or a linked target using an exact reference. Expose
  enough control for an agent to refresh or deepen retrieval intentionally.
  - Acceptance: an agent can repair an incomplete initial snapshot without
    depending on hidden server behavior or asking for internal IDs.
- Expand Slack permalinks one level. For a target reply, retrieve the target
  and enough root/thread context to explain its position. Preserve the referring
  message and target identity.
  - Acceptance: expansion is deduplicated, bounded, and does not recursively
    expand links found inside the expanded content unless explicitly requested.
- Extract complete bounded link-preview metadata for supported Open Graph and
  Twitter cards, including title, description, site, canonical URL, image
  metadata, and extraction status where available.
  - Acceptance: metadata is associated with the source message and target URL,
    normalized consistently, capped by size and time, and labeled as untrusted
    external content.
- Associate Slack files and attachment metadata with their source message and
  expose inspectable metadata or a clear unavailable state. Apply size,
  content-type, timeout, and permission limits.
  - Acceptance: files are not detached from the message that introduced them,
    and failed or skipped downloads are visible as diagnostics.
- Render a hierarchy that distinguishes active messages, neighboring messages,
  thread roots, replies, linked messages, previews, files, and agent-generated
  summaries. Include exact IDs and permalinks where allowed.
  - Acceptance: the agent can tell what was directly fetched versus expanded,
    what is current versus cached, and what is missing or capped.
- Define refresh behavior for follow-ups and message edits so a previously
  enriched link can be re-evaluated when context changes.
  - Acceptance: stale ledger deduplication cannot prevent a necessary refresh.

### Verification

Test scenarios must cover active roots and replies, paginated threads, linked
roots and linked replies, reply permalinks with query-string roots, duplicate
links, nested links, inaccessible private conversations, deleted messages,
stale cache entries, caps, timeouts, malformed Slack responses, Open Graph-only
pages, Twitter-only pages, conflicting metadata, missing images, oversized
files, unsupported file types, and preview or file failures.

Required coverage includes unit tests for permalink and metadata parsing,
integration tests for pagination, deduplication, cache refresh, file
association, diagnostics, and trust labeling, and end-to-end tests proving
that a message linking to another Slack message yields one bounded expansion
with visible provenance. Include a test that an expanded private target is
withheld or clearly denied when the requester is not authorized, even if the
bot can technically read it.

All tests must be implemented in the codebase under the agreed unit,
integration, and end-to-end directories, use deterministic network and Slack
fakes, and be re-runnable. Verification must not rely on a browser cache,
external website availability, or a manually copied preview.

Pass only when context is self-describing and every cap, omission, denial,
failure, and stale result is visible to the agent. Pass also requires strict
one-level default expansion, bounded resource use, correct source association,
and refreshable results. Fail if the rendered snapshot suggests completeness
when evidence was omitted, if files or previews lose their source, or if linked
content can recursively grow without an explicit budget.

### Gate exit artifact

Publish the context schema, expansion budget, preview and file policy, fixture
catalog, diagnostic taxonomy, and before/after evidence for representative
thread and permalink cases to the [ledger-path].

---

## Gate 3 — Provenance, permissions, freshness, and reliable lifecycle

### Objectives, scope, and dependencies

Make identity and delivery durable across restarts, pruning, retries, edits,
aliases, and delayed Slack ingestion. Close the gap between what the bot can
read and what the requesting principal is allowed to receive.

Dependencies: Gate 0’s identity and diagnostic contracts. Lane C leads. It may
start the state migration and failure taxonomy in parallel with Lanes A and B,
but final integration depends on their canonical target and context schemas.

Scope includes immutable origins, thread-root provenance, migrations, outbox
ordering, deduplication, retry and dead-letter behavior, delivery receipts,
follow-up refresh, authorization basis, and audit data.

### Tasks and acceptance criteria

- Persist the actual thread root for every delivered message origin, including
  proactive replies and agent-bound replies. For top-level posts, persist the
  posted message as its root.
  - Acceptance: a standalone message timestamp resolves to the correct channel
    and root after outbox pruning, restart, or before history ingestion.
- Migrate existing provenance rows where the root can be recovered; mark rows
  that cannot be recovered instead of guessing.
  - Acceptance: migration is idempotent, observable, reversible where practical,
    and never rewrites an uncertain root as fact.
- Canonicalize user-handle DM destinations to the opened direct-message channel
  before queueing and use that channel as the ordering key.
  - Acceptance: retries and concurrent sends through handle and D-ID aliases
    preserve one conversation order.
- Define at-least-once versus exactly-once expectations and implement safe
  deduplication around retries, worker restarts, Slack timeouts, and ambiguous
  upstream responses.
  - Acceptance: a successful Slack post is not duplicated merely because its
    acknowledgement was delayed, and a failed post does not permanently block
    later sends.
- Add explicit lifecycle states and error reasons for fetch, preview, file,
  authorization, queue, rate-limit, and delivery failures.
  - Acceptance: operators and agents can distinguish retryable errors from
    permanent denials and malformed requests.
- Re-run enrichment for edits and follow-ups when the source or linked target
  changes, while retaining provenance to the original source and prior result.
  - Acceptance: corrections cannot leave a stale enriched snapshot as the only
    evidence presented to the agent.
- Record authorization basis and visibility for inbound, expanded, and outbound
  content. Treat Slack messages, previews, files, and follow-ups as untrusted
  instructions unless separately authorized.
  - Acceptance: a participant’s Slack text cannot by itself authorize a
    privileged action or disclosure to a broader audience.

### Verification

Test scenarios must cover fresh and upgraded state, recoverable and
unrecoverable origins, root and reply provenance, outbox pruning, process
restart, delayed acknowledgements, duplicate Slack responses, rate limits,
permanent permission errors, retry exhaustion, cancellation races, alias
ordering, edited source messages, changed previews, unauthorized private
links, and prompt-injection text in messages, files, and metadata.

Required coverage includes migration unit and integration tests, durable
ordering tests with interleaved aliases, retry and deduplication tests,
authorization and disclosure tests, and end-to-end recovery tests from failure
to receipt. Assert persisted state and audit records, not only returned errors.

All tests must be implemented in the codebase using the agreed naming and
directory structure and must be re-runnable against deterministic clocks and
Slack fakes. A migration that was run once manually is not sufficient
verification.

Pass only when provenance resolves correctly after lifecycle transitions,
ordering is canonical, retry behavior is bounded and safe, and the trust and
authorization basis is visible for each evidence item and action. Fail if the
system guesses a thread root, allows alias bypass of ordering, loses the reason
for a denial, or can disclose bot-readable private material without requester
authorization.

### Gate exit artifact

Publish migration evidence, state-transition diagrams, retry and deduplication
decisions, authorization policy, and unresolved operational risks to the
[ledger-path].

---

## Gate 4 — Agent-operable tools, context contract, and progressive disclosure

### Objectives, scope, and dependencies

Make the feature usable by an agent without requiring knowledge of Slack’s
internal identifiers, while exposing enough control to retrieve missing
evidence and recover from incomplete snapshots. Keep the number of tools small;
make the first call simple and let optional arguments provide depth only when
needed.

Dependencies: Gates 1–3. Lane D leads, with review from all other lanes.

Scope includes tool names and descriptions, argument and result contracts,
initial thread context, follow-ups, child-agent behavior, trust instructions,
diagnostic rendering, and the boundary between automatic enrichment and
agent-controlled retrieval.

### Tasks and acceptance criteria

- Consolidate the agent surface into a minimal set of actions for reading Slack,
  sending a top-level message or reply, and inspecting delivery state. Avoid
  separate tools for every ID or Slack object type.
  - Acceptance: common usage is discoverable from descriptions and requires
    only a human-readable destination plus content for a send.
- Document the accepted destination forms and their precedence, including
  direct-message handles, channel names, canonical IDs, exact message targets,
  and permalinks.
  - Acceptance: an agent can choose the least specific safe form and can opt
    into exact targeting when a reply is intended.
- Make every read result self-describing: active conversation, source bucket,
  root/reply role, exact reference, visibility, trust, freshness, completeness,
  expansion depth, and diagnostics.
  - Acceptance: an agent can decide whether to answer, retrieve more, ask a
    clarification, or refuse disclosure without reverse-engineering formatting.
- Clearly separate untrusted Slack and web content from system instructions,
  user authorization, and tool results.
  - Acceptance: active follow-ups, expanded messages, previews, and files carry
    the same explicit trust treatment as initial inbound content.
- Expose bounded controls for refresh, linked-target retrieval, thread depth,
  preview metadata, and file inspection without enabling unbounded recursion or
  arbitrary network access.
  - Acceptance: default behavior remains cheap and safe; richer context is an
    intentional, budgeted request.
- Ensure child-agent and delegated-thread contexts receive only the authorized
  context and the necessary provenance, not an accidental flattening of all
  readable Slack material.
  - Acceptance: delegation preserves source, visibility, trust, and scope.
- Make outbound tool results precise enough for the agent to report status and
  continue safely after a failure.
  - Acceptance: queued work is never described as delivered, and the result
    exposes a stable way to inspect or retry the action.

### Verification

Test scenarios must exercise tool discovery, minimal arguments, each supported
destination form, optional exact reply targeting, incomplete initial context,
explicit refresh, bounded expansion, denied private content, untrusted
follow-up instructions, delegated context, queued versus delivered results,
and retry after a transient failure.

Required coverage includes agent-configuration tests, integration tests for
tool dispatch and result schemas, and end-to-end black-box tests that begin
with an inbound Slack message and finish with either a correctly formatted
reply or a clear refusal and diagnostic. Include a mention-echo scenario and a
scenario where the agent must retrieve a linked message because the initial
snapshot is intentionally capped.

All tests must be implemented in the codebase under the established unit,
integration, and end-to-end naming convention and must be re-runnable. The
verification is not complete if it checks only TypeScript types or tool
registration while omitting an actual agent-visible result.

Pass only when the minimal tool surface is sufficient for common workflows,
advanced retrieval is bounded and explicit, context and trust metadata are
unambiguous, and agents can distinguish all material delivery and retrieval
states. Fail if agents must guess internal IDs, if the initial context hides
caps or denials, or if untrusted Slack content is presented as authorization.

### Gate exit artifact

Publish the tool contract, progressive-disclosure examples in prose, result
schema, trust-boundary review, and black-box test evidence to the [ledger-path].

---

## Gate 5 — Operator visibility, recovery UX, accessibility, and documentation

### Objectives, scope, and dependencies

Give humans a clear way to inspect what happened, recover from failures, and
understand what the agent saw or sent. Make the operational path as complete as
the API path.

Dependencies: Gates 1–4, especially durable receipts, diagnostics, and state
transitions. Lane E leads.

Scope includes the Rosetta Slack operator surface, delivery activity, receipts,
retry, replay or cancel behavior, context and provenance inspection, responsive
layout, accessibility, documentation, and support guidance.

### Tasks and acceptance criteria

- Show per-request and per-message lifecycle state, destination, target root,
  source thread, timestamps, latest error, retry count, and Slack permalink when
  available.
  - Acceptance: aggregate counts are supplemented by enough detail to diagnose
    one stuck or misrouted action.
- Add safe retry, cancel, and dead-letter handling according to the durable
  state machine. Prevent duplicate controls from issuing concurrent retries.
  - Acceptance: controls are available only for valid states, are idempotent,
    and show the resulting state transition.
- Surface context provenance and completeness diagnostics so a human can tell
  whether linked messages, replies, previews, and files were included,
  omitted, denied, or stale.
  - Acceptance: the operator surface does not imply completeness from an empty
    or partially loaded section.
- Make the interface usable on narrow screens and with keyboard navigation and
  assistive technology. Preserve readable error and status text without relying
  on color alone.
  - Acceptance: all recovery actions have accessible names, focus behavior,
    and state announcements.
- Update documentation for simple destinations, exact reply forms, mention
  fidelity, linked-message expansion, previews, files, trust boundaries,
  delivery receipts, retries, and known limits.
  - Acceptance: docs explain behavior and failure recovery without exposing
    secrets or requiring unstable internal implementation details.

### Verification

Test scenarios must cover every lifecycle state, empty and partial diagnostics,
retry and cancel races, stale receipts, missing permalinks, malformed target
errors, narrow viewport behavior, keyboard-only recovery, focus movement,
screen-reader labels, and documentation examples for both root posts and
replies.

Required coverage includes UI component tests for state rendering, integration
tests for RPC or server state transitions, end-to-end tests for a failed send
that is inspected and recovered, and an accessibility check covering the
recovery flow. Include a regression test proving a successful delivery cannot
be replayed accidentally from a stale operator view.

All tests must be implemented in the codebase using the established directory
and naming convention and must be re-runnable. Manual visual inspection and a
single successful retry do not replace automated coverage.

Pass only when operators can identify, explain, and safely recover every
supported failure class; the UI accurately reflects durable state; and
accessibility checks pass for the complete recovery journey. Fail if the UI
collapses distinct errors, presents queued work as delivered, permits unsafe
duplicate retry, or hides provenance and completeness information.

### Gate exit artifact

Publish UI state screenshots or recordings where useful, accessibility results,
operator runbook updates, and recovery test evidence to the [ledger-path].

---

## Gate 6 — Staging end-to-end validation, security, quotas, and performance

### Objectives, scope, and dependencies

Exercise the full feature in a controlled staging workspace and validate the
boundaries that deterministic tests cannot prove: Slack scopes, real response
shapes, membership, file behavior, permalink behavior, quotas, latency, and
authorization.

Dependencies: Gates 0–5 complete with no unresolved high-severity failures.
Use a designated staging Slack workspace or channels with explicit owner
approval. Do not send test content to unrelated production conversations.

Scope includes real inbound messages, active threads, linked Slack messages,
private and public access, direct messages, mentions, files, Open Graph and
Twitter previews, edits, retries, operator recovery, restart behavior, rate
limits, logging, and secret handling.

### Tasks and acceptance criteria

- Run a scripted staging matrix for root posts, replies, channel-name sends,
  user-handle sends, channel-ID sends, direct-message-ID sends, exact timestamp
  targets, and full permalinks.
  - Acceptance: each case records the expected root, actual Slack result,
    receipt, and cleanup status.
- Validate inbound context and one-level expansion using messages that link to
  roots, replies, files, public pages, pages with only one preview standard,
  and pages with incomplete metadata.
  - Acceptance: staging results match the bounded context contract and expose
    diagnostics rather than silently dropping content.
- Validate real mention round-tripping with a permitted test user and confirm
  that display text and notification semantics are correct.
  - Acceptance: the received mention is represented and sent back as a real
    Slack mention with no accidental broad notification.
- Exercise transient failures, revoked access, rate limits, delayed responses,
  worker restart, retry exhaustion, cancellation, and recovery.
  - Acceptance: no duplicate successful posts, no permanently blocked queue, and
    no misleading receipt.
- Review disclosure and prompt-injection boundaries using public, private, DM,
  file, preview, and follow-up content.
  - Acceptance: the bot’s technical access does not bypass the requesting
    principal’s authorization and untrusted content cannot trigger privileged
    behavior.
- Measure latency, payload size, preview and file budgets, pagination volume,
  cache behavior, and retry pressure under representative and worst-case
  bounded inputs.
  - Acceptance: agreed budgets are met, slow work is observable, and no
    unbounded expansion or memory growth is found.
- Confirm logs and ledger artifacts redact tokens, private message bodies where
  required, and sensitive file contents.
  - Acceptance: debugging evidence is useful without becoming a second data
    exfiltration path.

### Verification

Test scenarios must include the complete approved staging matrix, at least one
real reply permalink with a query-string root, a direct-message alias pair, a
mention echo, a linked Slack reply, a file and preview, a denied private target,
an edit or refresh, a delayed acknowledgement, and a recovery after restart.

Required coverage is the full automated unit, integration, and end-to-end suite
plus a recorded staging run against the approved workspace. Each scenario must
have an expected outcome, observed outcome, receipt or diagnostic, and cleanup
record. Tests added in response to staging findings must be committed to the
codebase and re-runnable with fakes; live staging evidence supplements rather
than replaces them.

Pass only when all automated checks are green, all staging cases match the
contract, security review finds no high-severity disclosure or authorization
issue, budgets are within agreed limits, and artifacts contain no secrets. Fail
on any wrong-root reply, lost mention, false-complete context, duplicate post,
unbounded expansion, unauthorized disclosure, or unrecoverable queue state.

### Gate exit artifact

Publish the staging matrix, observed receipts, latency and quota measurements,
security review, redacted logs, cleanup confirmation, and follow-up fixes to the
[ledger-path].

---

## Gate 7 — Release, promotion, and regression lock

### Objectives, scope, and dependencies

Package the completed feature as a traceable Rosetta Slack child commit and a
tested workspace composition. Make the learned behavior durable for future
agents and prevent the feature from being considered complete merely because a
happy-path demo worked.

Dependencies: Gate 6 passes and all selected child changes are identified.

### Tasks and acceptance criteria

- Review the final diff for scope, accidental generated-file changes, secrets,
  unrelated dirty work, and compatibility with existing plugin consumers.
  - Acceptance: only intended files and tests are selected for the feature
    commit; unrelated authored work remains visible and untouched.
- Run the Rosetta Slack plugin’s required synchronization, reference, SDK type,
  typecheck, test, and build checks, followed by the workspace staging contract
  check.
  - Acceptance: all required checks pass for the exact child commits under
  test, or any pre-existing unrelated failure is explicitly isolated and
  approved rather than silently ignored.
- Confirm the complete unit, integration, end-to-end, accessibility, migration,
  and staging test inventory is checked in under the documented naming and
  directory convention.
  - Acceptance: a fresh agent can discover and re-run the tests without access
  to this conversation or undocumented local state.
- Update user-facing and operator-facing documentation with supported forms,
  boundaries, examples in prose, recovery behavior, and known limitations.
  - Acceptance: documentation agrees with the actual contracts and does not
    promise unrestricted Slack or web retrieval.
- Commit and push selected child-repository changes before advancing the
  workspace gitlink, following the root workspace promotion contract.
  - Acceptance: the workspace points to the exact tested child commits and no
    child HEAD is advanced implicitly.
- Record the release receipt, final test inventory, staging evidence, rollback
  path, and remaining non-blocking risks in the [ledger-path].
  - Acceptance: the ledger is sufficient to reproduce the validation and explain
    what was intentionally deferred.

### Verification

Test scenarios must include a clean checkout or equivalent reproducible install,
the full automated suite, migration checks from representative prior state,
the staging smoke matrix, and a post-build check of the agent tool and operator
surfaces. Re-run the exact test groups from earlier gates so the final result
guards against regressions introduced during integration.

Required coverage is every test committed by Gates 0–6, with no skipped
high-value scenario lacking a documented reason and owner. All tests must remain
implemented in the codebase, organized under the agreed naming and directory
structure, and re-runnable by CI or a future agent. Verification must include
the feature’s failure paths and safety boundaries, not only successful sends.

Pass only when the exact tested composition builds, all required checks and
approved staging scenarios pass, the ledger and docs are complete, and the
promotion receipt is traceable. Fail if any gate lacks evidence, tests are
one-off or undocumented, a known high-severity issue remains, or the workspace
gitlink does not identify the tested child commits.

### Gate exit artifact

Publish the final release checklist, commit mapping, complete test inventory,
staging receipt, rollback instructions, known-risk register, and all remaining
learnings to the [ledger-path].

---

## Coordination rules for parallel agents

- Gate 0 owns shared contracts. No lane should independently redefine message
  identity, root resolution, trust, completeness, or lifecycle states.
- Lanes may work in parallel only after recording their assumptions. When a
  contract changes, the owning lane updates the ledger and notifies affected
  lanes before changing dependent behavior.
- Keep commits small and lane-oriented. A commit should be reviewable against a
  single gate and should include its tests; avoid bundling unrelated generated
  SDK or workspace changes.
- Prefer deterministic fixtures and test doubles for cross-lane coordination.
  Reserve live Slack work for Gate 6, with approved channels, explicit cleanup,
  and redacted evidence.
- Every agent must leave a handoff containing changed files, acceptance status,
  test names and results, open risks, and the ledger path. A lane is not done
  when code compiles; it is done when its acceptance criteria and verification
  evidence are complete.
- The coordinating agent should join lanes only at the contract and
  integration points, resolve conflicting assumptions, and maintain the final
  gate checklist. Do not declare the feature complete until Gate 7 passes.
