# Skills Analytics qualification performance policy

Decision: `baseline-derived-explicit-budgets` (reviewer ruling recorded in
`plans/skills-analytics.ledger.jsonl`). This document fixes the workload and
numeric acceptance envelope before the qualification suite may report a
measured pass. It is not a claim that an isolated process is a composed-host
benchmark.

## Exact controlled workload

The production-bound source fixture is
`community-plugins/plugins/analytics/test/skills/queries/dashboard-queries/run.ts`.
Its independent expected population is three catalogs/exact revisions, ten
lifecycle facts (resolved, active-staged, bridge-acknowledged,
provider-observed, registered `SKILL.md` Read, subtree Read, another exact
Claude active unit, a different-revision Read, and a Codex active unit), four
named measurement facts, two provider partitions, and these named turns:
`turn-a`, `stage-turn-a`, `read-turn-a`, `subtree-turn-a`, `stage-turn-b`,
`read-turn-b`, `turn-c`. It includes a later turn Read and a different
revision Read so false no-read logic cannot pass.

The expected retained active growth is at most 10 lifecycle rows, 4 measurement
rows, and 14 active source rows for this population. An unchanged catalog is
replayed only through the production idempotent source identity path; it must
not create a second active source/fact row. The suite also asserts exact Claude
Read evidence, native activation unsupported, Codex per-skill unsupported,
and separate provider/model/method/serializer/tokenizer token partitions.

## Baseline and budgets

The immutable calibration receipt is
`test/skills/fixtures/qualification/performance-calibration.json`. It has three
calibration samples captured before holdout evaluation, their raw values, p95,
capture time, Node/platform/arch/CPU, final source identities, SHA-256 file
identities for the selected dirty production/fixture working tree, and the derived
numeric budgets. The qualification suite must never derive a threshold from its
five holdout samples. Both calibration and holdout use nearest rank: sort *n*
milliseconds ascending and select `ceil(0.95*n)-1` (the maximum at n=3 or n=5).
The sampled commands use Node's monotonic `performance.now()` around the final
production fixture, deliberately including process startup/import cost.

The conservative baseline-derived holdout limits recorded in that receipt are
cold extraction 10ms, cold query 20ms, cold drilldown 10ms, and cold browser
first-useful-render 2500ms. The receipt also records future composed-host warm
limits: extraction 10ms, query 20ms, drilldown 10ms, first-useful-render
1500ms. A later warm measurement
cannot reuse an isolated cold pass: it must record five real composed-host
samples at the final source identities and compare its own p95 against those
numeric warm limits.

First useful render means the rendered Skills heading plus the bounded revision
table are present. Drilldown means a raw-contributor dialog for an exact fact
is present. The browser workload has 101 revisions (the component must show
100) and 100 contributors; this exercises the table and disclosure bounds.

## Fail-closed and idle rules

Timeout, child import rejection, malformed result, cleanup failure, missing
provider evidence, unsupported workload, false activation, false `unused` /
no-read claim, token-partition pooling, any row-growth over the stated bounds,
or a nonzero idle refresh operation fails the suite. While no Skills dashboard
consumer is mounted, permitted idle refresh work is exactly **zero**. No-read
is only a qualified absence in an exact observable active Claude delivery
cohort; it is never "unused". No positive Codex per-skill/native activation
claim is supported by this qualification instrument.
