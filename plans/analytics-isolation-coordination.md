# Analytics isolation coordination

Cole's instruction (2026-09-22): employ child agents as BB child threads with
provider `codex`, model `gpt-5.6-terra`, reasoning `high`, service tier `fast`.
Children respond through explicit message passing. Never use `bb wait` or
`bb thread wait` for another thread's response.

Parent: `thr_zdxfefgika`. Definition: `analytics-isolation.plan.pkl`.
Ledger: `analytics-isolation.ledger.jsonl` (parent is the sole writer).

Every child sends a start acknowledgment, material findings/contract proposals,
blockers and its completion summary to the parent using:

```sh
bb thread tell thr_zdxfefgika --mode steer 'Message with findings and evidence'
```

Send completion before ending the child turn; automatic completion notices are
supplementary. Coordinate producer/consumer contracts directly with siblings
once their IDs are supplied, and copy resulting decisions to the parent.
Do not poll for completion. Continue independent authorized work while a
contract decision is pending. Parent receives results as messages, reviews
artifacts independently, and records acceptance rather than equating a child's
completion with proof.

The plan grants separate files to collector, execution, and frontend lanes.
Parent owns production server/RPC/contract integration and shared dependency
files. No child changes those files without a scoped ownership transfer by
message. The frontend lane is the only campaign writer for the fork patch
series, preserving all preexisting dirty patches. Read-only contract inspection
is available to every lane.

Focused lightweight tests may run in each lane. Coordinate expensive browser,
full-build and stress tests with the parent so verification does not itself
compete with BB. Never activate, reload, or enable Analytics on the current
host: Cole requires it disabled until implementation is complete. No runtime
promotion, child commit/push, or workspace gitlink change is part of these
assignments.

## Active scoped ownership transfer

Parent authorized execution child `thr_qsuuwauqx3` by message to add the trusted
snapshot handoff and isolation capability schemas/exports in
`community-plugins/plugins/analytics/execution-contract.ts`. Existing contracts
must be preserved; parent will not edit that file until ownership is returned.
Collector `thr_akw6gtf3f6` coordinates the DTO with execution. Frontend
`thr_bmzrgdfa78` remains sole fork patch writer. All three acknowledged starting.

Contract review conditions: producer-side byte bounds; atomic durable cursor
and snapshot publication; explicit mutation/deletion/reset semantics; verified
launcher controls rather than caller-asserted isolation booleans; and no claim
that in-process admission proves a cross-process global budget. Missing source
or OS controls must fail closed. Offline proofs do not qualify live performance.

## Review and publication authorization

Cole subsequently authorized reasonable review fixes, reload, commit and push.
Parent retains ownership of those integration/publication actions; child grants
still exclude deployment and publication. Analytics remains disabled until full
isolation is proven. Preserve unrelated dirty work and publish only reviewed,
verified task changes with their required source dependencies.

The requested four-lens perspectives panel returned no usable output: its
launches timed out. It is not review evidence. Parent requested independent
cross-reviews through the existing Terra/high/fast BB children instead:
collector reviews execution enforcement; execution reviews frontend and rollout;
frontend reviews source supply after completing its artifact patch.

Frontend may create a unique disposable `/tmp` source-authoring/replay worktree
using `mktemp -d` and the supported fork replay workflow. It must not become a
runtime or plugin source, replace the canonical checkout, touch another lane's
worktree, or change the live materialization. This is patch authoring only;
parent retains live reload ownership.
