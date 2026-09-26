# bb-machine upstream rollout, 2026-09-26

User authorized completion of the rollout and a new upstream sync. The five
runtime edits were retained in the previously committed exact patch archive.

Selected source:
- Fork: 3fd298ba9ba32e2b46a0678b162410dc5a852ab3
- Upstream: 9c9bae7f36a237c7e1b96de3d4c2186d13967686 (BB 0.44.0)
- Locked runtime tree: a5be4c5a2233f9f02631fce86debf82b8a4920a6
- Materialized commit: fe066ed89768acbbabf6558684bce675f745235b
- Organization plugins: 5c86c4d (published main)
- Community plugins: fabc274 (published main)
- SDK: 0.5.29+phosphor.f35653218f9b.sdk.a0aca52c9e73; the later
  migration/test patches leave its source subtree unchanged.

Canonical install, 99-task typecheck, 52-task build and 623 DB tests passed.
Both plugin repositories passed their required checks. The broader core test
run passed 94 of 97 task groups; remaining daemon assertions were corrected,
and focused daemon (35), server (58), and integration (79) tests passed. The
server rerun used /tmp because fault-barrier fixtures intentionally require it;
the broader suite used disk-backed scratch to avoid tmpfs inode exhaustion.

The operator-authorized manual cutover stopped bb.service and froze the two
existing background jobs. No open handles remained under BB/router state.
The private capture at
`~/.local/state/rosetta-machine/bb-backups/20260926T0146Z-upstream-044/`
contains BB state, router state, the source preimage and compiled runtime
archive. The capture receipt records its verification and hashes. Independent
SSH Codex sessions under ~/.codex were outside the migrated state scope. This
manual procedure is not a Core-issued maintenance receipt or proof of the
plan-only automated cutover contract.

The fresh stopped-state database rehearsal migrated twice, retained checked
thread/event/identity-profile/settings counts, passed quick_check and had no
foreign-key violations. The canonical service started successfully at 03:51
CEST with no restart loop; local and Tailnet HTTPS health returned ok. Existing
background jobs were thawed. All declared direct/builtin states were verified;
ACP Providers and Diffs remain disabled. Local and HTTPS attribution returned
machine fallback, invalid person headers remained machine attribution, and an
invalid thread request reached schema validation (400).

This host's resolver returns NXDOMAIN for its own Service hostname; HTTPS was
verified with the assigned Service address 100.84.229.173 using --resolve.
The matching router generation
`42b732e767638c3539f71752ecbad59877acdcfee9f707063548005f91e71273`
is now active; doctor reports healthy, matchesBundle=true, no issues, and
Codex 0.156.1. The install completed but its full status response exceeded the
CLI's 1 MiB output limit; the independent doctor probe confirmed activation.
No provider conversations were launched merely to validate the deployment.

Workspace normal contract passes. Service has zero automatic restarts, all
selected plugins are running, and original background jobs are unfrozen.
The broad machine check stops on the pre-existing Home Manager marker mismatch
(selected machine repo 63de7e7, installed marker 49ee89b). Workbench hook
activation is advisory and still needs reconciliation; this rollout did not
perform an unrelated full machine apply. A peer HTTPS check from Rosetta was
unavailable because SSH timed out; owned ingress was tested locally through
its assigned Service IP. Verified-person browser acceptance was not claimed.

