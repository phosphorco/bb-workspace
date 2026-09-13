---
name: merge-train
description: Plan and run Phosphor stacked pull-request merge trains by balancing downstream unblock value, confidence, and recovery risk over one guarded publication process.
---

# Run a Phosphor merge train

Use this skill for an interdependent PR stack whose layers must be recomposed,
published, retargeted, or merged in order. Use ordinary PR work for one
independent change.

## Set a release posture, not a procedural mode

Record the current release posture before making publication decisions:

- **Land now** weights concrete downstream unblock value and delay cost more
  heavily.
- **Land correctly** weights reduction of in-scope uncertainty and scope
  closure more heavily.

These are adjustable presumptions, not procedures, waivers, permission bundles,
or exclusive states. Apply judgment at each landing-visible boundary. A
high-value, independently usable prefix may deserve an unblock-weighted decision
while a coupled or hard-to-recover suffix deserves a closure-weighted decision.
Revise the posture when evidence, coupling, unblock value, or recovery cost
changes.

If the request already supplies the posture, record it as decision context
without asking the owner to restate it. Use a Workbench `Selector` only for a
genuine owner choice that changes the promised outcome, scope, exception,
consolidation, or publication authority. Posture may itself be a Selector when
the owner makes it part of the promised outcome; otherwise do not make it a
dependency repeated across every node.

Read [decision-graphs.md](references/decision-graphs.md) whenever authoring or
revising a plan. Read
[unblock-weighted.md](references/unblock-weighted.md) when delay cost or
downstream unblock value materially affects the decision.

## Keep invariants separate from heuristics

No posture weakens these publication invariants:

- Obtain exact, current, bounded publication and bypass authority. Posture never
  creates or broadens authority.
- Every separately visible `main` tree must be usable. Repair coupled layers,
  explicitly consolidate them into one authorized merge unit, or hold them.
- Reconcile fresh remote state, guard head rewrites and merges by exact object
  identity, and verify the remote tree after each merge.
- Treat enforced policy as `satisfied`, `failed`, or `unknown`. Failed or unknown
  policy stops publication unless an exact owner grant permits the applicable
  bypass; never infer one.
- Preserve dirty authored work. Stop on an overlapping write footprint rather
  than stashing, resetting, cleaning, relocating, overwriting, or moving a dirty
  child repository HEAD.
- Defer a newly introduced issue only through explicit owner disposition and a
  concrete follow-up.

Everything else is judgment: prefix timing and size, evidence breadth beyond
affected behavior, speculative suffix depth, investigation budget, automation
investment, WIP, and whether a non-critical concern receives immediate closure
or an owner-approved follow-up.

The graph records consequential decisions and safety witnesses, not proof that
an operator followed a named posture. Assess judgment by the evidence connecting
speed, confidence, unblock value, and recovery risk—not by posture labels, node
count, or procedural completeness.

## Establish only decision-relevant facts

In one read-only pass, inventory the PR order, current bases and heads, merge
method, actual repository rules, generated and lockfile boundaries, concurrent
target-branch movement, and dirty local state. Inspect review details only when
they can change a release decision. Resolve merge method early because a squash
train needs a different publication history from a merge-commit train.

At each proposed landing-visible boundary, record a short segment assessment:

- the named downstream consumer and concrete delay avoided;
- residual uncertainty and the evidence that bounds it;
- coupling and intermediate usability;
- blast radius and recovery difficulty;
- evidence freshness and any deferred issues; and
- the event or new evidence that would trigger reassessment.

Do not turn this into a numeric scorecard. Downstream unblock value is not a
slogan: if there is no named consumer or meaningful timing effect, do not claim
it as a reason to publish.

Confidence should rise with irreversibility and blast radius. Local
construction, read-only probes, and speculative refs are comparatively
reversible; branch rewrites and merges create shared coordination costs and
need stronger evidence. Prefer waiting when a cheap near-term probe has high
information value. Prefer landing when remaining uncertainty is bounded,
additional evidence is costly, the segment is independently useful, and delay
blocks valuable work.

Represent executable work as Actions and invariant or decision witnesses as
Guards. Keep the plan coarse: one node for a meaningful candidate, witness, or
landing segment—not one per shell command or API call. The definition owns
intended work; the ledger owns rulings and evidence. A short train with one
operator may need only an inventory, rolling construction, a segment witness,
one landing Action, and a journal.

## Shorten the dependency path

Construction needs an artifact; publication needs confidence. Model those as
different edges:

- Layer `n+1` may consume `produced(layer-n)` as soon as its local ref exists.
- Verification of layer `n` runs behind construction in parallel.
- Publication requires the included layers, segment assessment, usability
  witness, invariant gates, and exact authority.

Do not make a sequential builder return and wait for parent acceptance after
every layer. It should emit durable checkpoints, message the parent, and keep
building until a real decision or hard failure blocks it. A verifier can inspect
completed refs while the builder advances. An earlier failure invalidates its
dependent suffix; choose speculative depth by the cost of that invalidation,
not by a posture label.

Publish the longest segment whose assessment favors landing and whose invariant
gates pass while its suffix continues. Sequential merges inside one Workbench
Action are not atomic. If layers `k..m` only work together, repair their
intermediate trees, consolidate them into one explicitly owner-authorized merge
unit, or keep them unmerged. The clean prefix before `k` may still land.

## Verify decisions, not ceremony

For an already reviewed layer, prove that recomposition preserves the reviewed
tree except for declared conflict resolutions or final touches. Review those
deltas rather than rediscovering the entire feature.

A layer normally needs a cheap immutable transition certificate: candidate
commit and tree, intended predecessor, original reviewed PR head,
reviewed-delta preservation, and intermediate usability. Run or reuse generated
workspace, frozen-lock, formatting, and focused behavioral evidence according
to changed inputs. Invalidate evidence when its lockfile, generator input, path
boundary, candidate tree, or acceptance contract changes. Run broader evidence
where the changed inputs, segment risk, promised outcome, or final composition
justify it—not uniformly at every layer.

An agent may defer a failure without owner intervention only after proving it is
present at the comparison base and outside the changed footprint. A newly
introduced non-critical issue requires explicit owner disposition and a
concrete follow-up; calling it non-egregious is not a waiver.

When a finding is ambiguous, choose a bounded decision probe appropriate to its
risk—normally a direct reproduction, one prior-layer or `main` comparison, and
a narrow repair attempt. Then identify a hard blocker or request an owner
disposition. Do not let open-ended forensics consume the train.

Fresh-context review should inspect the actual changed delta and named risk. A
delegated review on the critical path needs a wall-clock deadline, no-progress
signal, monitor owner, terminal signal, and narrow fallback. Retain partial
findings on timeout and switch to the fallback when further waiting costs more
than its expected value. A reviewer runtime failure is not a verdict. Use only
the review capacity the risk, policy, or owner actually requires.

## Land with a small, guarded controller

Front-load read-only remote-policy discovery and probe any repository-qualified
native merge queue or stacked-merge facility while local candidates build. Use
native machinery only when its partial-landing and recovery semantics preserve
every visible intermediate tree. Otherwise prefer an existing trusted runner or
direct guarded commands with a small resumable journal. A new helper may shadow
read-only work and enter the critical path only after a successful dry run.

Before executing a landing Action, record the authoritative owner instruction
and a scope manifest containing repository, target ref, PR or segment range,
exact heads where applicable, permitted mutations, merge method, rewrite and
bypass scope, actor, and expiry or single-use bound. Plan evidence records this
grant but does not authenticate or obtain it.

For each PR inside the Action, use remote truth as a state machine:

1. Record intent and the observed remote `main`, head, base, and policy state.
2. For squash trains, normalize the candidate onto fresh `main` while preserving
   its verified tree. Publish with an explicit-OID lease such as
   `--force-with-lease=refs/heads/<branch>:<observed-old-oid>`.
3. Refetch, then recheck the rewritten head, base, mergeability, reviews, and
   required checks against that exact SHA.
4. Merge with GitHub's atomic expected-head guard or equivalent `sha` field.
5. Verify remote PR state and merge SHA, fetch `main`, and compare its tree with
   the expected candidate tree before declaring the step complete.
6. Persist distinct `prepared`, `published`, `merge-requested`,
   `remotely-merged`, and `tree-verified` checkpoints.

On restart, timeout, or an ambiguous API response, reconcile GitHub state before
retrying. Preserve an already landed prefix and recompute the suffix from fresh
`main`. Stop on remote movement, a tree mismatch, conflict, unknown or failed
enforced policy, missing authority, or a named hard failure. Never automatically
revert or replay after an unexpected tree.

An expected-head guard protects the PR head, not concurrent movement of its
base. When other writers can change the target, use a qualified native queue or
obtain an owner-approved serialized landing window. Non-required CI and reviews
remain evidence to classify; they do not silently become gates or get silently
ignored. Keep remote publication, merge, review dismissal, and follow-up PR
creation inside the user's actual grant.

## Delegate for flow

When delegation is authorized, choose bounded WIP from available capacity and
the current bottleneck. Usually preserve a coordinator, one warm sequential
builder, and only the verification, diagnosis, publication-prep, or follow-up
lanes that can make independent progress.

Give each child the plan and ledger paths, exact node or segment, source and base
refs, write footprint, current posture and decision criteria, named hard
blockers, and prohibited external effects. Children report checkpoints and
blockers by BB message and keep working when no answer is required. Do not use
`bb wait`. Parent acceptance uses an independent, proportionate oracle cheap
enough to run behind the builder rather than duplicating every child check.

Use isolated refs or an explicitly authorized checkout. Before writing, compare
the node footprint with dirty paths and stop on overlap. Never stash, reset,
clean, overwrite, relocate, or move a dirty child repository HEAD.

## Close the train without extending it accidentally

Every deferred item needs an affected surface, evidence, reason, owner or
routing destination, and release trigger. Start a concrete follow-up in parallel
when authorized and non-contending; base it on the anticipated tip and normalize
it onto final `main` before publication.

Finish the train when its authorized promised segments are merged and fresh
`main` matches the verified composed tree. Keep later cleanup, follow-up review,
and baseline repair as separate campaigns so they do not retroactively extend
the train's completion time.

When posture changes, preserve the earlier assessment and record what new
evidence, coupling, unblock value, or recovery cost changed the decision. Add a
Selector only when the owner changed the promised outcome or made another real
choice. Recheck accepted work only where the new decision changes its evidence
contract.
