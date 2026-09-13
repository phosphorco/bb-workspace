# Land-now execution playbook

Use this only after the release owner has selected land-now mode. Its purpose is
to reduce elapsed time without hiding the small set of failures that can make a
stack unsafe to consume.

## Start capacity-driven lanes

Keep WIP below available capacity and assign only lanes that can make independent
progress. Preserve coordinator capacity; choose from:

1. **Rolling builder:** recompose the stack in one long-lived checkout or
   coherent ref namespace. Land each local ref/checkpoint and continue from the
   produced predecessor.
2. **Verifier/diagnostician:** verify completed refs behind the builder and own
   the one bounded comparison needed for ambiguous failures.
3. **Publication preparation:** inspect GitHub rules and merge method, rehearse
   the exact direct landing sequence read-only, and prepare the landing journal.
4. **Follow-up:** prepare already-approved deferred work when it has a disjoint
   footprint and does not compete with the train.

The **coordinator** maintains the graph, makes dispositions, accepts evidence,
and starts concrete follow-ups when authorized.

Do not split a sequential build across many cold worktrees merely to appear
parallel. Setup, dependency installation, context recovery, and repeated handoff
usually cost more than one warm builder. Parallelize verification and unrelated
investigation around that builder instead.

## Per-layer decision gate

For each layer, produce an immutable transition certificate containing the
candidate commit and tree, intended predecessor, original reviewed PR head,
reviewed-delta result, changed verification inputs, and intermediate-usability
result. Ask only questions that can change whether its resulting `main` state is
usable:

- Is it based on the intended produced predecessor and does its tree preserve
  the reviewed delta plus declared corrections?
- Are workspace generation and package/export relationships self-consistent at
  this intermediate boundary?
- Is the lockfile valid under frozen install?
- Are changed generated artifacts current, deterministic, and wired into their
  freshness/trigger contracts?
- Do one or two focused checks exercise the behavior changed at this layer?

Reuse installation, generation, and test evidence while their relevant
lockfile, generator inputs, path boundary, candidate tree, and acceptance
contract remain unchanged. Run broad suites at landing-visible trees affected
by their inputs and at the final composed boundary; do not repeat expensive
repository-wide diagnostics at every intermediate ref. A prefix witness should
aggregate current certificates rather than recreate their work.

If a check fails, classify it with a predeclared bounded probe appropriate to
the risk. A common shape is:

1. Reproduce the exact failure once.
2. Run the same witness on the immediate predecessor or accepted baseline.
3. If new and merge-critical, make a narrow repair and rerun the focused gate.
4. If it is proven pre-existing and outside the changed footprint, record its
   disposition and continue. A newly introduced non-critical issue can defer
   only through an explicit owner-approved exception and concrete follow-up.

Stop exploratory repairs after this budget unless evidence establishes a real
production or safety defect. A test-harness mystery is not automatically a
production defect, but it needs an explicit follow-up and a closing acceptance
test.

## Land safe prefixes

As soon as a prefix is produced, verified, and independently witnessed, it may
land under existing authority while the suffix builds. Choose the boundary by
behavior, not round numbers.

- Land through the last layer whose intermediate tree is independently usable.
- If a later layer introduces a known temporary break, stop the prefix before
  it. Waiting for the closing layer does not make the intermediate merges safe.
- Before landing the interval, repair every intermediate tree, consolidate the
  coupled layers into one explicitly owner-authorized PR/merge unit, or keep the
  interval unmerged.

This turns remote CI, mergeability recomputation, and review refresh into work
that overlaps local suffix preparation without pretending several sequential
merges are atomic.

## Use the merge method's real history

For squash merging a stacked series, retargeting alone may create history-shape
conflicts after the predecessor is squashed. During construction, bind each
checkpoint to its candidate commit/tree, predecessor, original PR head, and
verification fingerprint. After the predecessor lands, normalize the next PR
before policy approval and landing readiness:

1. Fetch current `main` and prove its tree equals the previously verified layer.
2. Create a publication commit parented directly on current `main` whose tree is
   exactly the already-verified next-layer tree.
3. Lease-update the PR branch with
   `--force-with-lease=refs/heads/<branch>:<observed-old-oid>`.
4. Refetch; verify its rewritten head/base; then re-evaluate policy, reviews,
   required checks, and mergeability against that exact SHA.
5. Merge with the atomic expected-head guard or API `sha`.
6. Fetch again and prove `main` equals both GitHub's merge result and the expected
   candidate tree.

This changes history shape, not reviewed content. Any tree mismatch is a stop.
For merge-commit trains, retain the natural ancestry when it remains valid.

## Prefer direct guarded operations

A one-off train rarely justifies a new general-purpose runner. Probe a qualified
native merge queue or stacked-merge facility first, including its recovery and
partial-prefix semantics. Use it only when every separately visible tree is
usable. Otherwise a useful minimal controller owns only:

- the ordered PR/candidate mapping;
- current remote `main` and expected PR heads/bases;
- the next incomplete index;
- lease-protected publication, exact-head merge, and post-merge tree checks;
- a readable remote-truth journal with separate `prepared`, `published`,
  `merge-requested`, `remotely-merged`, and `tree-verified` states.

Default it to read-only. Require an exact owner scope grant for execution. A new
helper may enter the critical path only after a successful dry run; otherwise
execute the understood guarded steps directly. Automation is valuable when it
removes repeated operator turns and harmful when debugging it delays the train.

Interpret repository policy from the actual ruleset after every head rewrite.
Represent it as `satisfied`, `failed`, or `unknown`; an API or permission error
is unknown. Some GitHub commands exit nonzero when there are no required checks,
so distinguish a confirmed absence from failed discovery. Optional CI and
review findings still need classification, but they do not become blocking
merely because they are visible.

The PR expected-head guard does not prevent concurrent movement of the target
branch. If other writers can advance `main`, use a qualified native queue or an
owner-approved serialized landing window. On restart, timeout, or a lost API
response, read GitHub first and reconcile the journal before issuing another
mutation. Preserve a landed prefix and rebuild the suffix from fresh `main`;
never automatically revert or replay an unexpected remote tree.

## Keep agents moving

A builder brief should say to continue through the assigned work, send
checkpoint messages without ending the task, and stop only on a named hard gate
or owner decision. Avoid repeated “report before proceeding” language for every
layer.

Every delegated review or investigation names a wall-clock deadline, no-progress
deadline, monitor owner, terminal message, and smaller fallback. Arrange the
deadline signal when spawning it. On timeout, retain partial findings and
replace it at most once with the fallback. Do not leave an active train dependent
on the user asking for status.

Start a concrete follow-up from the anticipated final tree while the original
train lands when it has a disjoint footprint. Normalize it onto fresh final
`main`, publish or merge only under its own authority, and keep its review time
out of the original train's completion measure.

Use isolated refs or an authorized checkout. Compare every grant with dirty
paths before writing and abort on overlap. Never stash, reset, clean, overwrite,
relocate, or move a dirty child repository HEAD for convenience.
