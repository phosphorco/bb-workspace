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

### Keep transcript sender wrapping minimal

Wrap the original message content with only a readable sender label:

```text
[from=cole@phosphor.co]
{Original content}
[/from=cole@phosphor.co]
```

For people, use the handle when available and otherwise the display name. For
machine attribution, use a clearly machine-qualified readable label, such as
`machine:rosetta`. These labels are presentation, not stable identity keys or
authorization evidence. Escape delimiter characters and line breaks in labels
so they cannot alter the wrapper structure.

Do not inject actor JSON, identity keys, issuer/subject fields, evidence labels,
avatar URLs, “BB verified sender” prose, or instructions about interpreting
profile fields. Keep that metadata in structured attribution and history.
The wrapper answers who the message is from without making the agent process
the identity machinery.

Preserve the original content and wrap each attributed message group separately.
Messages without known attribution remain unwrapped; standalone built-in
compact and clear commands retain their native dispatch behavior. Preserve
original authors and later editors separately in storage. The wrapper uses the
original author when known, falling back to the editor only when the original
author is unknown; it does not add an editor metadata block.

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

Implementation tasks and verification gates are tracked in the
[Pkl delivery plan](../../plans/identities-and-multiplayer.plan.pkl).

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
