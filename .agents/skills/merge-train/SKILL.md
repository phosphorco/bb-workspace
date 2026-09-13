---
name: merge-train
description: Plan and run Phosphor stacked pull-request merge trains, choosing and encoding a land-now or land-correctly operating mode before recomposition, publication, and sequential merges.
---

# Run a Phosphor merge train

Use this skill for an interdependent PR stack whose layers must be recomposed,
published, retargeted, or merged in order. Use ordinary PR work for one
independent change.

Choose the train's operating mode before doing review closure or candidate
work:

- **Land now** minimizes time until others can build on `main`. It accepts
  explicit follow-ups but not an unsafe or unmergeable stack.
- **Land correctly** makes complete in-scope closure the release condition.

If the request already makes the mode clear, record that ruling immediately;
do not spend a correctness-first prelude rediscovering the choice. Otherwise
put it to the release owner as a Workbench `Selector`. A short train with an
explicit mode and one operator may use a compact plan containing only the mode,
train manifest, landing Action, and journal; reserve a larger graph for
unresolved decisions, multiple operators, or changing scope. Read
[mode-graphs.md](references/mode-graphs.md) whenever authoring or revising the
plan. For land-now trains, also read [land-now.md](references/land-now.md).

## Establish only release-relevant facts

In one read-only pass, inventory the PR order, current bases and heads, merge
method, actual repository rules, generated/lockfile boundaries, concurrent
target-branch movement, and dirty local state. Inspect review details only when
they can change the release decision. Resolve merge method early because a
squash train needs a different publication history from a merge-commit train.

Represent owner choices as Selectors and executable work as Actions or Guards.
Keep the plan coarse: one node for a meaningful candidate, witness, or landing
segment—not one node per shell command or GitHub API call. The definition owns
intended work; the ledger owns rulings and evidence. Do not create a second
status model from many per-node proof files when a readable train journal or a
direct oracle is enough.

The mode ruling must remain in any Pkl graph. A selector ruling does not activate
a Pkl branch automatically: revise the same definition into the chosen graph,
preserve its ledger, and make mode-sensitive nodes require the current ruling.

## Shorten the dependency path

Construction needs an artifact; publication needs confidence. Model those as
different edges:

- Layer `n+1` may consume `produced(layer-n)` as soon as its local ref exists.
- Verification of layer `n` runs behind construction in parallel.
- Publication of a segment requires every included layer to be both produced
  and verified, plus the segment witness and publication authority.

Do not make a sequential builder return and wait for parent acceptance after
every layer. It should emit durable checkpoints, message the parent, and keep
building until a real decision or hard failure blocks it. The coordinator or a
separate verifier can inspect completed refs while the builder advances. A
failed earlier layer invalidates its dependent suffix, which is an acceptable
speculation cost only when the selected mode permits it.

For land-now, publish and merge the longest verified safe prefix while its
suffix is still being prepared. Every separately merged tree must be usable;
sequential merges inside one Workbench Action are not atomic. If layers `k..m`
only work together, repair their intermediate trees, consolidate them into one
explicitly owner-authorized merge unit, or keep them unmerged. The clean prefix
before `k` may still land.

For land-correctly, construction and review may still pipeline, but publication
waits for the complete stack witness and agreed final evidence.

## Verify decisions, not ceremony

For an already reviewed layer, prove that recomposition preserves the reviewed
tree except for declared conflict resolutions or final touches. Review those
deltas rather than rediscovering the entire feature.

A land-now layer normally needs a cheap immutable transition certificate:
candidate commit and tree, intended predecessor, original reviewed PR head,
reviewed-delta preservation, and intermediate usability. Run or reuse generated
workspace, frozen-lock, formatting, and focused behavioral evidence according
to changed inputs. Invalidate that evidence when its lockfile, generator input,
path boundary, candidate tree, or acceptance contract changes. Broad repository
diagnostics and universal proofs beyond exercised behavior belong at affected
visible boundaries or the final composition, not every layer.

An agent may defer a failure only after proving it is present at the comparison
base and outside the changed footprint. A newly introduced non-critical issue
requires an explicit owner disposition and concrete follow-up; the agent may not
infer that waiver merely by calling the issue non-egregious.

When a finding is ambiguous, predeclare a bounded decision probe appropriate to
its risk—normally a direct reproduction, one prior-layer or main comparison, and
a narrow repair attempt. Then identify a hard blocker or request an owner
disposition; do not let open-ended forensics consume the train.

Fresh-context review should inspect the actual changed delta and named risk.
Every delegated review must name a wall-clock deadline, no-progress deadline,
monitor owner, terminal signal, and narrow fallback. Retain partial findings on
timeout and replace a failed reviewer at most once with the smaller fallback.
A reviewer runtime failure is not a verdict. Use only the number of reviewers
the owner or risk actually requires.

## Land with a small, guarded controller

Front-load read-only remote-policy discovery and probe any repository-qualified
native merge queue or stacked-merge facility while local candidates build. Use
native machinery only when its partial-landing and recovery semantics preserve
every visible intermediate tree. Otherwise prefer an existing trusted runner or
direct guarded commands with a small resumable journal. A new helper may shadow
read-only work and enter the critical path only after a successful dry run; do
not design a general merge engine on the live train.

Treat the landing segment as one Workbench Action when one operator, exact owner
grant, and stop policy govern it. Before execution, record the authoritative
owner instruction and a scope manifest containing repository, target ref,
PR/segment range, exact heads where applicable, permitted mutations, merge
method, rewrite and bypass scope, actor, and expiry or single-use bound. Plan
evidence records this grant but does not authenticate or obtain it. Choosing a
mode never supplies publication authority.

For each PR inside the Action, use remote truth as a state machine:

1. Record intent and the observed remote `main`, head, base, and policy state.
2. For squash trains, normalize the candidate onto fresh `main` while preserving
   its verified tree. Publish with an explicit-OID lease such as
   `--force-with-lease=refs/heads/<branch>:<observed-old-oid>`.
3. Refetch, then recheck the rewritten head, base, mergeability, reviews, and
   required checks. Policy discovery is `satisfied`, `failed`, or `unknown`;
   permission/API failure is unknown, never evidence that no requirements exist.
4. Merge with GitHub's atomic expected-head guard or equivalent `sha` field.
5. Verify remote PR state and merge SHA, fetch `main`, and compare its tree with
   the expected candidate tree before declaring the step complete.
6. Persist distinct `prepared`, `published`, `merge-requested`,
   `remotely-merged`, and `tree-verified` checkpoints.

On restart, timeout, or an ambiguous API response, reconcile GitHub state before
retrying; never assume a request failed because its response was lost. Preserve
an already landed prefix and recompute the suffix from fresh `main`. Stop on
remote movement, a tree mismatch, conflict, unknown or failed enforced policy,
or a mode-defined hard failure. Never automatically revert or replay after an
unexpected tree.

An expected-head guard protects the PR head, not concurrent movement of its base.
When other writers can change the target, use a qualified native queue or obtain
an owner-approved serialized landing window. Non-required CI and reviews remain
evidence to classify; they do not silently become gates or get silently ignored.
Never use an administrative bypass outside the exact recorded grant.

Local acceptance is not publication authority. Keep remote publication, merge,
review dismissal, and any follow-up PR creation inside the user's actual grant.

## Delegate for flow

When delegation is authorized, choose bounded WIP from available capacity and
the current bottleneck. Usually preserve a coordinator, one warm sequential
builder, and only the verification, diagnosis, publication-prep, or follow-up
lanes that can make independent progress. Do not force a fixed lane or reviewer
count, and prefer this rolling pipeline over many cold agents that duplicate
setup or broad investigation.

Give each child the plan and ledger paths, exact node or segment, source/base
refs, write footprint, mode-specific blockers, and prohibited external effects.
Pass paths instead of repeatedly embedding the full plan and ledger. For
local-only work, prohibit push-capable helpers as well as direct pushes.

Children report checkpoints and blockers to the parent by BB message and keep
working when no answer is required. Do not use `bb wait`. Parent acceptance
still includes an independent, proportionate oracle, but that oracle should be
cheap enough to run behind the builder rather than duplicating every expensive
child check.

Use isolated refs or an explicitly authorized checkout. Before writing, compare
the node footprint with dirty paths and stop on overlap. Never stash, reset,
clean, overwrite, relocate, or move a dirty child repository HEAD to make the
train easier to run.

## Finish the selected outcome

For land-now, every deferred item needs an affected surface, evidence, reason,
owner or routing destination, and release trigger. Start a concrete follow-up
in parallel when authorized and when it does not contend with the train; base it
on the anticipated tip and normalize it onto final `main` before publication.

Finish the original train when its authorized segments are merged and fresh
`main` matches the verified composed tree. Keep later cleanup, follow-up review,
and baseline repair as separate campaigns so they do not retroactively extend
the train's completion time.

If the owner changes mode mid-train, preserve the earlier ruling, add a
mode-revision Selector, and revise unfinished dependencies and oracles. Recheck
accepted work only where the new threshold materially changes its evidence.
Never claim that a ledger note alone changed executable policy.
