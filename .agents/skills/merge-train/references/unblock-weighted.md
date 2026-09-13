# Reason about unblock-weighted decisions

Use this reference when delay cost or downstream unblock value materially
affects a merge-train decision. It is not a separate workflow and does not
weaken publication invariants. It helps decide where faster feedback,
speculation, narrower evidence, or earlier segment landing is worth the
remaining uncertainty.

## Make unblock value concrete

Before letting urgency influence a landing decision, identify:

- the person, team, PR, deployment, or experiment waiting on the segment;
- what they cannot do until it lands;
- the meaningful time window or delay cost; and
- whether a cheaper temporary path would provide the same unblock.

If those facts are unknown, treat unblock value as unproven rather than filling
the assessment with generic urgency. Reassess when the consumer, timing, or
alternative changes.

## Start capacity-driven lanes

Keep WIP below available capacity and assign only lanes that can make
independent progress. Preserve coordinator capacity; choose from:

1. **Rolling builder:** recompose the stack in one long-lived checkout or
   coherent ref namespace. Emit each local ref and transition certificate, then
   continue from the produced predecessor.
2. **Verifier or diagnostician:** verify completed refs behind the builder and
   run bounded comparisons for findings that can change a segment decision.
3. **Publication preparation:** inspect GitHub rules and merge method, rehearse
   the direct landing sequence read-only, and prepare the landing journal.
4. **Follow-up:** prepare an already-approved deferred change when its footprint
   is disjoint and it does not compete with the train.

The coordinator maintains the graph, updates segment assessments, accepts
evidence, and routes owner decisions.

Do not split a sequential build across many cold worktrees merely to appear
parallel. Setup, dependency installation, context recovery, and repeated
handoff can cost more than one warm builder. Parallelize verification and
independent investigation around that builder.

## Scale evidence with consequence

For each layer, produce an immutable transition certificate containing the
candidate commit and tree, intended predecessor, original reviewed PR head,
reviewed-delta result, changed verification inputs, and
intermediate-usability result.

Ask which evidence can change the publication decision:

- Does the tree preserve the reviewed delta plus declared corrections?
- Are generated workspace, package, export, and lockfile relationships
  self-consistent at this visible boundary?
- Do focused checks exercise the changed behavior?
- What uncertainty remains, and how hard would recovery be if it is wrong?

Reuse installation, generation, and test evidence while its relevant lockfile,
generator inputs, path boundary, candidate tree, and acceptance contract remain
unchanged. Run broader suites when changed inputs, blast radius, recovery cost,
or the promised outcome justify them. A segment witness should aggregate current
certificates rather than recreate their work.

Prefer a cheap near-term probe when it has high information value. When a check
fails, a useful bounded probe often reproduces the exact failure, compares it
with the immediate predecessor or accepted baseline, and attempts a narrow
repair if the failure is new and merge-critical. Stop when the result is enough
to identify a blocker, justify the segment, or request an owner disposition;
do not continue forensics merely because a land-now label exists.

A failure proven pre-existing and outside the changed footprint may be recorded
and left outside the train. A newly introduced non-critical issue can defer only
through an explicit owner-approved exception and concrete follow-up.

## Decide at each visible boundary

Once a segment is produced and verified, compare landing it now with waiting for
more evidence or scope closure.

Landing is favored when:

- every intermediate `main` tree is independently usable;
- the segment gives a named consumer meaningful value now;
- residual uncertainty is bounded and visible;
- further evidence is slow or costly relative to its expected information; and
- blast radius and recovery costs are acceptable under the promised outcome.

Waiting is favored when:

- an inexpensive imminent check could materially change confidence;
- the segment is tightly coupled to unfinished layers;
- the open concern is part of the promised outcome;
- publication would create costly coordination or recovery; or
- authority, policy, remote truth, or intermediate usability is unresolved.

These are reasons, not a checklist or score. Record the facts that actually
decide the segment and what would cause reassessment.

If a later layer introduces a temporary break, stop before it. Repair every
intermediate tree, consolidate the coupled layers into one explicitly
owner-authorized PR or merge unit, or hold the interval. Sequential merges do
not become atomic because they share one Action or execute quickly.

Landing a safe prefix can overlap remote CI, mergeability recomputation, and
review refresh with local suffix preparation. The same reasoning may justify a
safe prefix under a closure-weighted posture; conversely, high urgency does not
justify landing a hard-to-recover or unusable boundary.

## Use the merge method's real history

For squash merging a stacked series, retargeting alone may create history-shape
conflicts after the predecessor is squashed. During construction, bind each
checkpoint to its candidate commit and tree, predecessor, original PR head, and
verification fingerprint. After the predecessor lands, normalize the next PR
before treating it as publication-ready:

1. Fetch current `main` and prove its tree equals the previously verified layer.
2. Create a publication commit parented directly on current `main` whose tree is
   exactly the already-verified next-layer tree.
3. Lease-update the PR branch with
   `--force-with-lease=refs/heads/<branch>:<observed-old-oid>`.
4. Refetch; verify the rewritten head and base; then re-evaluate policy,
   reviews, required checks, and mergeability against that exact SHA.
5. Merge with the atomic expected-head guard or API `sha`.
6. Fetch again and prove `main` equals both GitHub's merge result and the
   expected candidate tree.

This changes history shape, not reviewed content. Any tree mismatch stops the
train for reconciliation. For merge-commit trains, retain natural ancestry when
it remains valid.

## Prefer the smallest trusted controller

Probe a qualified native merge queue or stacked-merge facility early, including
its recovery and partial-prefix semantics. Use it only when every separately
visible tree is usable. Otherwise prefer an existing trusted runner or direct
guarded commands with:

- the ordered PR and candidate mapping;
- current remote `main` and exact PR heads and bases;
- the next incomplete index;
- lease-protected publication and exact-head merges;
- post-merge remote tree checks; and
- a journal separating `prepared`, `published`, `merge-requested`,
  `remotely-merged`, and `tree-verified`.

Default new automation to read-only and put it on the critical path only after
a successful dry run. Automation is useful when it removes repeated operator
turns; abandon it promptly when debugging costs more than the remaining manual
sequence.

Interpret repository policy from the actual rules after every head rewrite.
Policy is `satisfied`, `failed`, or `unknown`; API or permission errors are
unknown. Distinguish confirmed absence of required checks from failed discovery.
Optional CI and review findings still need classification, but visibility alone
does not make them gates.

The PR expected-head guard does not prevent concurrent movement of the target
branch. If other writers can advance `main`, use a qualified native queue or an
owner-approved serialized landing window. On restart, timeout, or a lost API
response, read GitHub first and reconcile the journal before mutating again.
Preserve a landed prefix and rebuild the suffix from fresh `main`; never
automatically revert or replay an unexpected remote tree.

## Keep critical-path work moving

A builder brief should say to continue through the assigned work, send durable
checkpoints without ending the task, and stop only on named hard gates or real
owner decisions.

For delegated work on the critical path, name a wall-clock deadline,
no-progress signal, monitor owner, terminal message, and narrower fallback.
Retain partial findings on timeout and switch to the fallback when waiting costs
more than the expected value of the original review. Do not make the user ask
for status before a stalled dependency is noticed.

Start a concrete follow-up from the anticipated final tree when it is authorized
and non-contending. Normalize it onto fresh final `main` before publication, and
keep its review time outside the original train's completion measure.

Use isolated refs or an authorized checkout. Compare every grant with dirty
paths before writing and abort on overlap. Never stash, reset, clean, overwrite,
relocate, or move a dirty child repository HEAD.
