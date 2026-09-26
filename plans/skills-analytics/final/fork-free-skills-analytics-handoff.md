# Fork-free Skills Analytics handoff receipt

This receipt supersedes the earlier
[`skills-analytics-handoff.md`](skills-analytics-handoff.md), whose handoff
described a fork-dependent path. The deliverable now uses only the Analytics
community plugin, public BB SDK calls, and retained public BB thread events;
it makes no `fork/` or `fork/upstream` change and does not publish, deploy, or
promote anything.

## Reconstructible evidence

The plugin captures a complete current catalog with
`sdk.skills.list({ projectId, environmentId })`,
`sdk.skills.listFiles({ projectId, environmentId, skillId })`, and
`sdk.skills.getContent({ projectId, environmentId, skillId, path: "SKILL.md" })`.
It derives bounded public thread evidence through `sdk.threads.list`,
`sdk.threads.get`, and `sdk.threads.events.list`. The durable explanation and
reproduction command are in
[`docs/skills-analytics.md`](../../../community-plugins/plugins/analytics/docs/skills-analytics.md).

The retained public live proof is a complete 57-entry Codex snapshot for
`proj_t8x9yhwnvc` / `env_tqsfutmr8b`. `bb-performant-react` is current revision
`9f96984c438da69afea434f07f9a32e9e47c29b488ca33f9c0b2b58de378bc0d`, 6,379
UTF-8 bytes. The same retained thread has prompt `evt_34xvtzvafb` seq 1 and
command start/completion `evt_ktrynhdkme` seq 32 → `evt_nn5dyxhzbj` seq 33.
Both the registered `SKILL.md` and its performance-playbook reference are
lexical command candidates. Since that one command is shell-wrapped and
joined, its successful completion proves only the enclosing outcome, not
either file's individual read.

Prompt and command historical revisions are null. Aggregate token reports are
unallocated, and the `bb-deployment` and `bb-on-this-machine` symlink skills
have null footprints. The selected public RPC returned HTTP 200 in 0.038644
seconds after the stale-query repair.

## Lifecycle and limits

The populated `skillsQuery` path reads retained SQLite data and cannot begin
post-return projector or database work. Awaited lifecycle handlers and awaited
manual refresh own bounded recapture. The compatibility control covers the
former detached stale-query and detached lifecycle behavior.

The evidence never establishes private staged catalog membership, provider
delivery/access/use, activation, instruction effect, individual file reads, or
per-skill token consumption. Current content bytes and `ceil(bytes / 4)` are
only local content-footprint estimates; missing command candidates are
incomplete provider-access coverage, not non-use. Current catalog revisions
are exact at capture time only, while historical revisions remain unknown.

The documentation's bounded read-only `skillsQuery` command selects this
project, environment, and Codex skill over its 200-second capture-local
window. It displays metadata only; raw prompt, command, and output bodies are
not retained by this evidence model and are not part of the reproduction.

## Evidence status

The supporting composition and community checks are to be run before review.
This artifact is intentionally left without a self-adjudicated result: the
`skills-fork-free-handoff` plan node requires an independent reviewer judgment
that the documentation matches the non-empty live page and that every claim can
be reconstructed from the public catalog snapshot and retained events.
