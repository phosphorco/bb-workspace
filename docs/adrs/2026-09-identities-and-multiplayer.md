# Identities and multiplayer in a trusted shared BB environment

Date: 2026-09-09
Status: Approved
Decision owner: Cole Lawrence

## Context and motivation

BB is a shared workspace for trusted collaborators and their coding agents. We
use identity to understand who sent a message, preserve authorship as work moves
between threads, and make personal preferences and multiplayer interactions
predictable. Collaborators share access to the environment. Identity tooling is
primarily a convenience for collaboration, not a tenant isolation or authorization
system.

The immediate failure exposed a mismatch between that purpose and our design.
An agent on Rosetta could read BB state but could not create a child thread:
BB returned `401: Tailnet Serve identity could not be verified`. Both a new
worktree and an existing environment failed before the requested work began.
Rosetta is a tagged Tailscale device; Serve does not populate user identity
headers for traffic from tagged devices. The native thread API nevertheless
required a verified person, and the CLI carried no alternative attribution.

A browser request, a CLI call, a loopback request, a remote agent, and a background
job cannot all be expected to arrive through a proxy that verifies a human.
The operating-system account running the process, such as `ubuntu`, also does
not tell us which collaborator initiated the work. Requiring fresh person
verification on every operation makes ordinary collaboration depend on an
incidental transport property.

Our immediate priority is the useful 80/20: messages sent by people retain their
end-user identity, which already works, while other operations continue with
honest machine attribution. We can improve attribution coverage incrementally.

## Decision

In this trusted shared deployment, identity resolution is best-effort attribution.
Missing or unusable person evidence must not, by itself, prevent an otherwise
valid operation. BB supplies a stable machine identity when it cannot determine
a more specific actor.

Resolve attribution in the shared host integration using this order:

1. Use the verified end-user identity when the current request supplies it.
2. Use attribution carried by the owning request, execution, thread, or accepted
   job when that context is available and applicable to the operation.
3. Otherwise use a stable machine identity and continue.

This policy applies to browser, SDK, CLI, loopback, remote-agent, child-thread,
plugin, and background paths. A configured provider being unavailable, timing
out, rejecting evidence, or not applying to a transport must not turn attribution
into a prerequisite for those operations. Invalid person evidence is discarded;
it is never relabeled as verified evidence.

Carrying attribution is not a new authorization grant protocol. Agents must not
need an interactive login, user-supplied token, verified proxy, or delegation
grant merely to use ordinary BB operations in this environment. Existing host
and execution context should supply attribution ambiently where practical.
Incomplete propagation uses the machine fallback.

## Design philosophy and constraints

### Be useful without overstating what we know

Keep actor identity, evidence, execution origin, and initiating person distinct.
A person who starts a thread may remain its initiator, but that does not make
every later agent message a freshly verified message from that person. Preserve
parent-thread and execution links alongside carried attribution. Structured
attribution and UI must distinguish verified human submissions, inherited
attribution, and machine fallback. Model-facing message wrapping stays
minimal, as specified below.

Names, avatars, handles, and Unix usernames are presentation data, not stable
identity keys. A machine actor must be distinguishable from a person even if a
legacy implementation represents both through a common user abstraction. It
must not silently become the operator or the most recent browser user.

### Describe messages with context, sender, content, and optional attachments

Amended 2026-09-10 by Cole: this format supersedes the earlier `[from=…]`
wrapper. Describe the communication itself: where the message was posted, who
sent it, their original words, and any attached material. Do not classify Slack
messages as “untrusted” merely because they arrived through an integration.

For a Slack message posted to a thread:

```text
[message posted to thread]
[sender=slack:@Cole <@U123>]
{Original Content}
<attached>
{Attachment/link enrichment etc}
</attached>
[/sender=slack:@Cole]
```

The opening sender line may include a source-native reference, such as Slack's
`<@U123>`, to make the person recognizable and referable. The closing line repeats
only the readable sender label (`slack:@Cole`), without that optional reference.
This deliberate asymmetry is part of the format. Source-native references are
useful presentation; internal identity keys and verification machinery remain
structured metadata outside the model text.

Use the same shape for the initial request and every subsequent message. Each
message has its own sender and optional attachment block; a batch must not make
one sender the author of everyone else's words. If there is no attached content,
omit the entire `<attached>…</attached>` block, including empty placeholders:

```text
[message posted to thread]
[sender=slack:@Cole <@U123>]
The latest change addresses this. Thanks!
[/sender=slack:@Cole]
```

The pattern applies beyond Slack. For example:

```text
[comment posted to pull request #142]
[sender=github:@maya]
Could we handle an empty response here?
<attached>
File: src/client.ts, line 87

const result = response.items[0];

Comment link: https://github.com/acme/app/pull/142#discussion_r123
</attached>
[/sender=github:@maya]
```

Use a short factual context line when its destination or event adds useful
information. Do not invent destinations when none are known. Direct native BB
messages use `[sender=cole@phosphor.co]` and `[/sender=cole@phosphor.co]` around
their content; machine messages use a readable label such as `machine:rosetta`.
For people, prefer the source handle, otherwise the display name; do not slugify
away useful spelling or case. Retain a known source-native reference when no
profile label is available, without making profile lookup a prerequisite to send.

Preserve the message's original textual content. Keep derived link previews,
file descriptions, retrieved excerpts, and useful source coordinates inside
`<attached>`, separate from the person's words. Preserve actual image/file inputs
as native multimodal attachments rather than replacing them with prose; their
associated textual enrichment follows the same attachment convention. Preserve
typed attachment inputs through transcript assembly, within each provider
adapter's existing capabilities. This amendment does not add native multimodal
support to an adapter that already converts files or images to text markers. A
retrieved message that is attached as context retains its own sender and source;
it must not silently become a new direct message from the requester.

Do not prepend identity verification prose, actor JSON, issuer/subject fields,
or blanket “UNTRUSTED” banners to these messages. Do not insert instructions
about whether the sender has authority into the message envelope. Necessary
agent-role and tool-use instructions belong in their existing instruction layer,
not repeated around each person's message. The format describes communication;
it neither adds security guarantees nor changes independent integration
credentials or the operation's actual delivery semantics.

Escape delimiters and line breaks in generated labels and source references so
they cannot break the envelope. This is formatting correctness, not an
anti-forgery guarantee; do not rewrite the original body or add an authorization
parser. Keep identities, evidence, revision IDs, and delivery bookkeeping in
structured storage. Include only useful source context in attachments, not a
dump of internal records.

Keep one envelope per message, without an additional machine/integration wrapper
around the whole batch. A producer may retain the captured message authors in its
own structured records; the host need not invent an additional machine author
for that already-attributed batch. This does not remove known native authors or
change attribution on ordinary native requests. Preserve original authors and
later editors separately;
use the original author when known, otherwise the editor. Describe edits and
deletions as factual events without pretending a tombstone is the person's
original text. Historical unknown authors remain unknown; do not fabricate a
sender to make a wrapper. Standalone compact/clear commands retain native
behavior. Old transcript text remains historical evidence and need not be
rewritten; new deliveries and re-rendered messages follow this decision.

### Make machine fallback stable and honest

Use an existing stable BB machine identifier, scoped to the BB instance, with a
human-readable machine name such as `rosetta` or `bb-machine`. Renaming a machine
must not change its identity or reassign its history. Prefer the submitting or
executing machine when existing host context identifies it. When a bare HTTP
request does not identify its originating machine, use the receiving BB server's
machine identity; do not guess Rosetta from a path, hostname claim, or Unix user.

That last case intentionally loses attribution precision. It is preferable to
blocking work or pretending to know which person submitted it.

### Preserve multiplayer correctness

Keep request and execution attribution scoped to their owners. Do not introduce
a process-global “current person” that can leak between concurrent users or
threads. Resolve and capture attribution at acceptance, then preserve it across
queues, retries, child-thread work, and restarts. A retry must not adopt whichever
person happens to be active later.

Existing verified end-user messages must retain their identities and evidence.
Historical unknown authors stay unknown; this decision supplies fallback for new
operations and does not authorize retroactive guesses. Record any future explicit
correction separately from the original attribution.

Personal state remains keyed by a stable subject. A machine fallback must not
read or overwrite the operator's preferences by pretending to be that person.
Unattributed clients may share machine-scoped preferences; that is an accepted
limitation. View-as and explicit target selection remain separate from the actor
performing an operation.

### Put policy in the shared integration

Core host integration and the shared identity contract own resolution,
propagation, and fallback. Plugins should receive a usable attribution context
through the common API rather than each inventing a fallback or requiring a
Tailnet-specific header. Identity providers enrich attribution; their availability
does not determine whether the shared workspace remains usable.

Resolution must be bounded. Provider failure should be diagnosable without
logging credentials or making every caller wait indefinitely. Preserve operation
validation, transaction consistency, deduplication, and accepted-message history
when changing identity admission.

### Keep the deployment assumption explicit

This decision assumes trusted collaborators, backend plugins, and processes in
a shared environment. It does not claim private tenancy, malicious-plugin
containment, or forensic proof of the human behind every action. Attribution
alone must not be used as evidence that a person authorized an operation.

Existing network access, machine enrollment, integration credentials, execution
permissions, and explicit user approvals for consequential actions remain their
own mechanisms. This ADR does not remove them or expose BB publicly. A future
untrusted or multi-tenant deployment requires a separate access-control decision;
it must not quietly redefine attribution as authorization for this deployment.

### Do not promise identity forgery resistance

This deployment explicitly does not guarantee that identities cannot be forged
or that attribution history cannot be rewritten. Trusted agents and collaborators
can already edit the unencrypted transcripts and attribution stored on disk.
Application-level identity checks cannot establish a stronger authenticity or
tamper-resistance guarantee over that storage. Forged attribution is not a
security-boundary violation under this decision.

Do not retain or add signing, person-admission leases, evidence-expiry rejection,
identity revocation gates, or other mechanisms solely to enforce that unsupported
guarantee. Remove such mechanisms rather than extending them to machine actors.
A provider-verified marker describes the resolution path that produced a snapshot;
it is not proof against a collaborator fabricating or later editing that snapshot.
Providers may still enrich attribution for convenience, without gating work.

Preserving accepted authors and recording later editors is intended application
behavior, not a tamper-proof audit promise. Keep validation that makes records
usable, prevents accidental owner changes, preserves operation deduplication and
transaction consistency, or implements actual cancellation and disposal. Those
correctness properties and independent integration credentials have purposes
separate from preventing someone from claiming another identity. A proposed
identity check must identify such a concrete purpose; forgery resistance alone
is a reason to reject it in review.

## Intentional trade-offs

We choose continued operation and low-friction collaboration over complete person
verification. Some messages will be attributed only to a machine, some remote
calls will fall back to the receiving machine, and carried context may identify
an initiator without proving the current sender. These are visible limitations,
not reasons to reject work.

We accept that trusted processes can influence attribution and that machine-scoped
state can be shared. In return, ordinary CLI and agent workflows work without
per-request identity setup. Improving context propagation can reduce machine-only
attribution over time without changing the availability guarantee.

We reject requiring verified proxy evidence on every request, mapping unknown
work to the operator, and making scoped agent authorization a prerequisite for
fixing this failure. None fits the collaboration purpose of this deployment.

The original fallback deployment is recorded in the
[identity delivery plan](../../plans/identities-and-multiplayer.plan.pkl).
The 2026-09-10 transcript amendment and remaining producer gaps are tracked in
the [transcript delivery plan](../../plans/message-transcripts.plan.pkl). Its
[gap assessment](../../plans/identity-lanes/transcript-gaps.md) distinguishes
existing behavior from planned work.

## Implementation consequences

Implementation should proceed through the fork and shared identity integration:

1. Extend native author schemas, storage, SDK contracts, UI, and model-facing
   serialization to represent machine actors and attribution evidence without
   presenting them as verified people.
2. Separate native operation admission from person resolution. Apply the shared
   fallback policy to the currently gated create, fork, send, edit, queue, retry,
   compact, and clear-context paths and corresponding plugin integration paths.
3. Carry attribution through existing host, CLI, agent, and job context where
   available. Capture it durably at acceptance and keep execution origin separate.
   Complete ambient propagation is not a prerequisite for machine fallback.
4. Update conflicting contracts and tests, then validate the composed deployment
   before promotion. Preserve existing verified-human and personal-state behavior.

Acceptance must cover a tagged remote host creating a child thread, loopback and
CLI submissions without person headers, missing and failing identity providers,
and a plain request with no identifiable source machine. These operations must
succeed with the appropriate fallback. Also verify two concurrent people retain
their own attribution; queues and restarts preserve accepted authorship; invalid
headers never become verified people; machine renames preserve keys; and unrelated
access checks and operation validation still behave as before.

This ADR records the posture and required outcomes. It does not claim these
changes have shipped or prescribe a new credential protocol.

## Relationship to prior decisions and evidence

For this deployment, this decision supersedes requirements in the earlier
[identity master plan](../../fork/plans/bb-fork-master-plan.md) and
[authority boundary assessment](../../plans/identity-experience/contracts/authority-boundary.md)
that make fresh person admission or scoped delegation necessary for ordinary
CLI, agent, and background operations. Their requirements for honest provenance,
explicit state ownership, durable accepted authorship, and independent access
checks remain relevant. Existing documents and tests describing rejection on
identity failure must be reconciled during implementation.

- [Decision discussion](https://bb-next.banjo-tint.ts.net/projects/proj_t8x9yhwnvc/threads/thr_kmhguukhgy)
- [Original child-thread failure](https://bb-next.banjo-tint.ts.net/projects/proj_5h7gbn97vi/threads/thr_efpgydujvu)
- [Tailscale Serve identity headers](https://tailscale.com/docs/features/tailscale-serve#identity-headers)
