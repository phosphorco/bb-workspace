---
name: reconcile-bb-workspace
description: Reconcile the BB workspace and its source submodules with main, preserve intended local work in logical commits, verify the composition, and publish consistent repository and workspace revisions. Use for workspace-wide reconciliation, not a status-only inspection or a single-plugin update.
---

# Reconcile BB workspace to main

Work from `/home/ubuntu/bb` and follow its `AGENTS.md` and child repository
contracts. The end state is a clean, tested, published composition with no
intended work stranded in dirty files or side branches.

- [ ] Run `./bin/status`. Inventory edits, untracked files, branch-only commits,
  gitlinks, fork locks, and runnable source across the workspace, `fork`,
  `plugins`, and `community-plugins`.
- [ ] Fetch each repository's `origin/main`; pull/rebase or merge relevant main
  commits after preserving authored work. Compare actual file contents,
  including untracked files, with main: dirty-file counts and divergent commit
  IDs do not establish that work is unpublished or conflicting.
- [ ] Resolve conflicts against the applicable approved ADRs in `docs/adrs/`.
  Read their latest amendments from fetched workspace `origin/main` if the local
  checkout is stale. Use their intended behavior to break ties, not blanket
  ours/theirs selection. Escalate only decisions the ADRs and task do not settle.
- [ ] Commit all intended source work in logical, reviewable units. Remove
  confirmed disposable generated files; ignore retained non-source artifacts.
  Preserve deliberate source receipts and required tracked artifacts. Never hide
  unresolved authored work with ignore rules or discard it to obtain a clean tree.
- [ ] If the request adds, removes, or changes a **selected** direct plugin,
  reconcile its target host declaration too. The authoritative selection is
  `rosetta-machine/hosts/<host>/home/.config/rosetta-machine/bb-plugins.tsv`,
  not the set of plugin directories. Do not auto-select every discovered leaf.
  If the target host or the requested inclusion is unclear, leave the
  declaration unchanged and report that selection gap. For an explicit target,
  add or revise its literal-tab row (`bb-plugins` or `bb-community-plugins`,
  plugin ID, `plugins/<id>`), then run
  `./bin/bb-plugin-selection --host <host>` from the `rosetta-machine`
  checkout. This is the required read-only source/declaration gate: it neither
  builds nor changes live plugin state.
- [ ] Run relevant repository checks and exercise the combined runtime and
  affected installed plugins against the exact reconciled revisions. Core builds
  alone do not prove plugin compatibility. Follow existing deployment rules;
  this skill does not independently authorize a service restart.
- [ ] Push each child repository's reconciled commits to its `origin/main`,
  preserving concurrent upstream work. Then update workspace gitlinks to those
  exact tested, pushed commits; commit and push workspace `main`. When a host
  selection changed, commit and push its Rosetta declaration only after that
  source is published. Activation is still separate: run the host's apply path
  only under explicit authorization, then verify its selected plugins.
- [ ] Confirm the workspace and three source children are clean, on `main`, and
  equal to their freshly fetched `origin/main`. Confirm gitlinks match child
  HEADs and the runnable fork matches its locked source/tree receipts. Nested
  `fork/upstream` and materialized runtime checkouts stay at their selected exact
  pins; do not move those to main merely to satisfy branch naming.

Report the final repository SHAs, verification results, and any remaining
publication or activation gap. Do not claim reconciliation complete while a
required gap remains.
