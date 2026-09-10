---
name: bb-env-disk-usage
description: Diagnose and safely recover disk space on the Rosetta BB host, with special handling for BB runtime state, worktrees, thread storage, Phosphor checkouts, caches, temporary files, backups, and deleted-open files.
---

# BB environment disk usage

Use this skill when the Rosetta/BB machine is low on disk, reports `100%` usage,
accumulates worktrees or temporary build trees, or needs a storage inventory.
The objective is to restore headroom without deleting source changes, the live BB
database, the only usable backup, active environments, or evidence that the
operator intends to retain.

## Operating principles

1. Measure before deleting and measure again afterward.
2. Treat `~/bb`, `~/.bb`, `~/phosphor`, `/tmp`, and caches as different ownership
   domains. Similar-looking checkouts do not necessarily have the same owner.
3. Prefer regenerable caches and provably unowned artifacts before archived or
   authored work.
4. Never infer that a BB environment is orphaned merely because it is absent
   from the `~/phosphor/control` worktree registry. It may belong to the BB fork
   or another repository.
5. Remove registered worktrees with Git before deleting residual directories.
   Direct directory deletion can strand many gigabytes under
   `~/phosphor/control/.git/worktrees`.
6. Do not use a recursive destructive command against a broad path, a glob, `$HOME`,
   `/tmp`, `~/.bb`, or `~/phosphor`. Resolve and validate exact targets first.
7. Preserve dirty repositories. Never run `git clean`, reset, checkout, or stash
   as part of disk maintenance.
8. Preserve the emergency reserve during routine cleanup.

## Machine layout

The observed Rosetta machine has two NVMe devices in RAID1. RAID1 capacity is
not additive: the root filesystem is one approximately 878 GiB ext4 filesystem
on `/dev/md3`. `/boot` is separate on `/dev/md2`.

Important paths:

| Path | Owner and purpose |
|---|---|
| `~/bb` | Canonical BB source workspace. Do not treat it as cache. |
| `~/bb/fork/build/bb` | In-place materialized BB runtime used by `bb.service`. |
| `~/.bb/bb.db` | Live BB SQLite database. Critical operator state. |
| `~/.bb/worktrees` | BB-managed environment worktrees for multiple repositories. |
| `~/.bb/thread-storage` | Thread-owned checkouts, evidence, test harnesses, dependencies, and build artifacts. |
| `~/.bb/plugins`, `plugin-host-artifacts`, `runtime` | Installed runtime/plugin state. Inspect ownership before pruning. |
| `~/phosphor/control` | Main Phosphor control repository and common Git worktree database. |
| `~/phosphor/control/.git/worktrees` | Per-worktree Git administration, including large nested-submodule stores. Never delete directly. |
| `~/phosphor/worktrees` | Human and service worktrees for control and other repositories. |
| `~/.local/state/rosetta-machine` | Backups, migration state, and recovery state. |
| `~/.local/share/rosetta-machine` | Installed/versioned Rosetta and BB artifacts. |
| `/tmp` | Build, test, review, provider, workbench, browser, and materialization scratch space. This has been the fastest-growing storage domain. |
| `~/.cache`, `~/.npm`, `~/.local/share/pnpm` | Regenerable tool and package caches, with different pruning commands. |
| `~/storage-emergency-reserve-10GiB` | Visible 10 GiB emergency reserve. Release only during an actual capacity emergency. |

The host has also had roughly 31 million allocated inodes. Directory scans can
therefore take many minutes even when the byte total is modest.

## BB service and state boundaries

The user service `bb.service` runs from `~/bb/fork/build/bb`, not from old
revision-named deployments under `~/.local/share/rosetta-machine`.

Check it with:

```sh
systemctl --user status bb.service --no-pager
systemctl --user show bb.service \
  -p ActiveState -p SubState -p MainPID \
  -p MemoryCurrent -p MemoryPeak -p TasksCurrent
```

BB can own hundreds of processes and many environments. During the 2026-08
incident it ranged from about 11 to 31 GiB of service memory and from roughly
567 to 1,125 tasks. This is relevant to disk work because active provider,
watcher, worktree, and browser processes may retain files or recreate caches.

The live database is:

```text
/home/ubuntu/.bb/bb.db
```

Never delete, replace, vacuum, or copy it casually while BB is writing. A
SQLite backup must be transactionally consistent. For a high-confidence
maintenance backup, briefly quiesce `bb.service`, use the SQLite backup API,
run `PRAGMA integrity_check`, record a SHA-256 checksum, and restart BB.

The most recent backup must always be rediscovered at incident time. A known
historical verified backup from 2026-08-28 was:

```text
/home/ubuntu/.local/state/rosetta-machine/backups/
  bb-current-20260828T180000-0400/bb.db
SHA256 04cf2f62e253808a0b4cca4872fae5dbab7fdecc6d86e45be6d83724d0872fb9
```

That path proves the backup procedure, not that it remains the newest backup.
Also preserve `backups/bb-authentic-handoff/`; its recovery contract explicitly
said not to delete it.

## Correctly measuring disk use

Start with the filesystem rather than `du`:

```sh
df -hT /
df -B1 --output=source,size,used,avail,pcent,target /
df -ih /
```

`df` is authoritative for allocated filesystem space. `du` explains named
files but can differ because of filesystem metadata, deleted-open files, scan
timing, unreadable paths, sparse files, and hard links.

For a root reconciliation, use one invocation so GNU `du` deduplicates hard
links across sibling paths:

```sh
sudo du -x -B1 --max-depth=1 / | sort -nr
```

This can take 10–20 minutes on this host. Do not launch overlapping full-tree
scans. Drill into only the largest branches afterward:

```sh
du -x -B1 --max-depth=2 /home/ubuntu/.bb | sort -nr | head -120
du -x -B1 --max-depth=2 /home/ubuntu/phosphor | sort -nr | head -120
du -x -B1 --max-depth=1 /tmp | sort -nr | head -120
```

Do not add independently measured worktree totals without considering hard
links. Bun and package-manager dependency trees may be heavily hard-linked,
while nested Git submodule packs may be true physical duplicates.

Check deleted-open files separately:

```sh
sudo lsof +L1
```

Deduplicate by device and inode before summing. Multiple mappings of the same
deleted executable are not multiple copies on disk.

Check pressure while diagnosing:

```sh
free -h
swapon --show
vmstat 1 5
cat /proc/pressure/cpu
cat /proc/pressure/memory
cat /proc/pressure/io
```

## Reclamation order

### Tier 1: regenerable and normally safe

#### Go build cache

Preserve the shared cache for ongoing builds. Cole explicitly requested a
longer-term solution on 2026-09-08: repeated full cache clearing makes the next
build pay the same compilation cost and does not stop abandoned private caches
from accumulating. Distinguish the active `go env GOCACHE` from harness-specific
cache roots in `/tmp` and workspaces.

Inspect the selected cache first:

```sh
go env GOCACHE
```

The Go build cache has repeatedly reached 25–39 GB. Its size alone is not a
reason to empty it. Prefer retiring abandoned scratch data and applying Go's
native unused-entry expiration to verified old private caches. Full
`go clean -cache` is an emergency measure or an explicit cold-build request,
not routine retention. Do not assume `~/.cache/go-build` without checking
`go env GOCACHE`.

For Go-related pressure, read [Go cache reuse and retirement](references/go-cache-reuse.md)
before selecting targets. It describes the verified native age-trimming
operation, preservation of recent entries, and producer cleanup expectations.

#### Trash

Measure and empty only the user's Trash. Read-only directories may require
adding owner write permission inside Trash before deletion.

```sh
du -sh ~/.local/share/Trash
find ~/.local/share/Trash -mindepth 1 -depth -delete
```

Trash deletion is permanent. Never generalize this command to `~/.local/share`.

#### Package caches

Use package-manager pruning rather than deleting stores blindly:

```sh
pnpm store prune
npm cache clean --force
```

`~/.npm/_npx` is cached execution material and can be removed only after
checking that no process references it. The pnpm store may remain large after
pruning because installed projects still reference its content.

#### Unused containers and images

Inspect first:

```sh
podman system df -v
podman ps -a
```

Then prune only unused objects. An image referenced by a stopped or stuck
container may still be intentionally retained.

#### Browser and tool caches

Examples include `~/.cache/ms-playwright`, node-gyp, uv, Electron, linters, and
code-server caches. Verify that no browser or tool process references the exact
target before clearing it. QMD indexes are regenerable but potentially
expensive, so treat `~/.cache/qmd` as a deliberate tradeoff rather than an
automatic deletion.

### Tier 2: temporary workspaces

`/tmp` has been the dominant recurring failure mode. At peak it held about
362 GB and more than 117,000 top-level entries. It refilled hundreds of
gigabytes in a day with names such as:

- `bb-provider-bridge-*`
- `bb-workbench-*`
- `orchestrator-test-*`
- `service-home-generation-*`
- `go-build*`
- BB review/materialization directories
- Claude/browser scratch directories

Use the top-level entry's own modification time as the retention boundary.
Take a dry-run inventory first:

```sh
cutoff='2 days ago'
date -d "$cutoff" --iso-8601=seconds
sudo find /tmp -xdev -mindepth 1 -maxdepth 1 \
  ! -newermt "$cutoff" -printf '%TY-%Tm-%Td %TH:%TM\t%y\t%p\n'
```

Preserve system-managed or active paths, including:

- `.ICE-unix`, `.X11-unix`, `.XIM-unix`, `.font-unix`, `.Test-unix`
- `systemd-private-*`
- `snap-private-tmp`
- mounted trees
- exact top-level entries referenced by a process cwd, executable, or open fd

Freeze the cutoff once. Do not let entries cross the threshold while a
long-running deletion is in progress. Delete resolved top-level targets in
bounded batches, remaining on the root filesystem with `-xdev`, then rerun the
same candidate query to verify zero eligible entries remain.

The two-day policy recovered about 272 GB in one pass, but the machine later
refilled within a day. At the observed creation rate, two days of retention can
exceed the available disk. Prevention needs either a one-day policy, a byte
quota, producer cleanup on success/failure, or all three.

### Tier 3: BB worktrees and thread storage

#### BB environment worktrees

`~/.bb/worktrees` reached about 81 GB with 99 top-level directories. Determine
ownership from all of these sources:

1. BB `environments` rows in `~/.bb/bb.db`.
2. `git worktree list --porcelain` for the relevant common repository.
3. The worktree's `.git`/common-dir relationship.
4. Live process cwd, executable, arguments, and open file references.
5. Dirty Git status using `GIT_OPTIONAL_LOCKS=0`.

Useful database fields include `id`, `path`, `managed`, `is_worktree`,
`status`, `created_at`, `updated_at`, and `retire_requested_at`.

Important lesson: a directory absent from the control repository's worktree
list may still be a valid `ready` BB environment for `~/bb/fork` or another
repository. During the incident, six apparent control orphans were legitimate
ready BB-fork environments.

High-confidence candidates have all of these properties:

- no environment row for the path;
- no worktree registration in any owning repository;
- no live process reference;
- clean or not a Git checkout;
- not named or documented as recovery/handoff evidence.

#### Thread storage

`~/.bb/thread-storage` reached about 90 GB. It stores much more than thread
text: cloned repositories, registered worktrees, evidence, raw benchmark runs,
private pnpm/npm stores, `node_modules`, browser proof output, and repeated
materializations.

Seven idle/archived thread directories occupied about 56 GB. Their composition
was roughly:

- more than 21 GB of repeated `node_modules`;
- about 10 GB of private package stores;
- about 25 GB of cloned repositories, overlays, build output, raw performance
  captures, and proof artifacts.

Deleting an archived thread directory does not delete its conversation row
from `bb.db`, but reopening the thread will lose its retained filesystem
evidence and checkouts. Treat this as an explicit retention policy decision.

Named harness directories with no matching `threads` row are stronger
candidates. Examples found during the incident included a 26 GB cold-load
harness and several multi-gigabyte TSGo proof directories. Still verify live
references and provenance before removal.

Some thread-storage directories are registered Git worktrees. Remove those
through their common Git repository first, then delete remaining caches and
artifacts. Otherwise stale Git administrative data remains.

### Tier 4: Phosphor worktrees and Git administration

`~/phosphor` reached about 117 GB. The largest portions were:

- `control`: about 51 GB;
- `worktrees`: about 48 GB;
- nested control worktrees: about 8 GB;
- old control replacement directories and other repositories.

The surprising part of `control` was:

```text
control/.git/worktrees    ~31.5 GB
control/.git/objects      ~0.5 GB
```

The worktree administration directories contained per-worktree `modules`
trees as large as 8 GB. These are nested-submodule Git databases associated
with specific worktrees. They are real duplicate physical storage, not merely
the shared main object database.

Never delete `.git/worktrees/<name>` or its `modules` directory directly.
Instead:

1. map the admin entry's `gitdir` back to the actual worktree;
2. verify BB/database ownership and live processes;
3. inspect dirty status with optional locks disabled;
4. remove the exact worktree through `git worktree remove` when authorized;
5. run `git worktree prune --dry-run --verbose`, then prune only confirmed
   missing registrations;
6. verify that the corresponding admin/modules allocation disappeared.

Age and a missing upstream branch are useful signals, not sufficient proof.
One clean worktree with a gone remote branch was a strong candidate, while
another old worktree had genuine uncommitted source changes and had to be
preserved. Several July/August worktrees still hosted live Bun, Vite, Jaeger,
RustFS, Claude, or code-server processes.

Clean worktrees belonging to other repositories are also not control orphans.
For example, three large `lnlp-*` trees under `~/phosphor/worktrees` belonged
to the `layered-nlp` common repository and had valid upstream branches.

### Tier 5: installed versions, sessions, and recovery state

These are reclaimable only with a retention decision:

- old Codex standalone releases;
- Codex archived sessions;
- unused mise Node, Go, Bun, Nushell, and other runtime versions;
- unused Rust toolchains;
- old versioned BB/Rosetta installed artifacts;
- old migration/recovery state;
- archived BB thread-storage directories.

For Codex releases, preserve the `current` symlink target and every executable
version used by a running process. During one cleanup, retaining current
`0.149.1` and still-active `0.148.0` allowed older releases to be removed.

For versioned Rosetta/BB application artifacts, retain the current paired
revision and at least two complete paired rollback revisions. A fork-only
revision without the matching app artifact is not a complete rollback.

## Deleted-open processes and observability stores

Old Jaeger processes previously pinned about 4.3 GB of deleted Badger files.
They belonged to retired Phosphor worktrees and had been reparented to PID 1.
Stopping the exact orphan processes returned the space immediately.

At the same time, the live control-plane Jaeger repeatedly consumed around
1.4 CPU cores, 2.4 GiB of RAM, and a multi-gigabyte Badger store. Its config
used 72-hour span retention. Multiple Jaeger instances existed:

- the intentional `jaeger-otlp.service`;
- the live control-plane Jaeger;
- orphaned worktree-local Jaeger instances.

Never kill all Jaeger processes indiscriminately. Map each config path and
cgroup/service owner first.

## Incident-safe cleanup workflow

1. Capture `df`, inode use, memory, swap, load, and pressure.
2. Confirm `bb.service` and the live database path.
3. Identify the newest verified BB backup and its checksum before deleting BB
   migration, deployment, or recovery state.
4. Check deleted-open files and orphan observability processes.
5. Restore immediate headroom with verified expendable caches; preserve warm
   build caches during routine work. Inspect Trash provenance before emptying it.
6. Apply the approved `/tmp` retention rule with system/active exclusions.
7. Inventory `~/.bb` and `~/phosphor` with one physical-allocation scan per
   parent.
8. Cross-reference BB database ownership, every relevant Git registry, dirty
   status, and process references.
9. Remove exact high-confidence orphans; use Git for registered worktrees.
10. Recheck `df`, `lsof +L1`, `bb.service`, the backup checksum, and Git
    registry health.
11. Record what was deleted, what was retained, recovered bytes, and whether
    deletion is recoverable.

## Prevention

The machine repeatedly returned to 97–100% after large cleanups. Manual cache
deletion is therefore not a sufficient fix.

Implement these controls:

- automated `/tmp` cleanup with protected-path and active-reference exclusions;
- maximum byte or inode budgets for BB provider/test scratch roots;
- producer-owned cleanup in success, failure, timeout, and cancellation paths;
- shared Go build/module caches for ordinary builds; isolated caches only when
  the verification requires them, with explicit run-end retirement;
- retention limits for archived BB thread storage;
- BB environment retirement that also removes Git worktree administration;
- periodic pruning of package caches, old tool versions, and unused container
  images;
- alerts at both percentage and absolute-free-space thresholds;
- monitoring for sudden growth rate, not just current fullness;
- limits on Jaeger retention and lifecycle cleanup for worktree-local services;
- preservation of the visible 10 GiB emergency reserve as last-resort capacity.

Suggested alert levels for this approximately 878 GiB filesystem:

- warning at 85% or less than 100 GiB free;
- urgent at 92% or less than 50 GiB free;
- critical at 97% or less than 20 GiB free;
- emergency response when normal user allocation reaches zero.

## Reporting format

Every disk-maintenance report should state:

- current `df` used, available, and percentage;
- physical allocation by major ownership domain;
- exact targets and evidence for proposed deletion;
- active/dirty/database-owned exclusions;
- expected and actual reclaimed bytes;
- backup path, integrity result, and checksum when BB state is involved;
- service health after cleanup;
- the recurrence mechanism and recommended preventive control.

Historical incident notes also live in:

```text
~/rosetta-machine/STORAGE_AND_DISK_EXHAUSTION_LEARNINGS.md
```
