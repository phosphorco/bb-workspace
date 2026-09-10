# Go cache reuse and scratch retirement

## Keep useful builds warm

Ordinary same-machine builds should use the Go-selected shared `GOCACHE` and
`GOMODCACHE`. Go supports concurrent processes sharing a local build cache and
keys artifacts by their build inputs. Different worktrees and toolchain versions
do not by themselves require separate cache directories. Do not share a writable
cache between machines over a network filesystem.

Isolated caches are appropriate when a test specifically proves cold-cache,
toolchain acquisition, or environment-isolation behavior. Their owning harness
must retain the source, checksums and result logs separately, then retire its
exact generated cache roots on success, failure and cancellation. Do not change
a test to use shared state when isolation is part of its assertion.

Avoid one new `GOCACHE`/`GOMODCACHE` per thread or proof attempt. A generated
`go.work` may be task-specific without requiring a private build cache. Prefer
`GOTMPDIR` for transient compiler work when that is the actual isolation need;
its lifetime must still belong to the invoking build.

## Native unused-entry trimming

Verified against installed Go 1.26.6 on Rosetta on 2026-09-08:

- `src/cmd/go/internal/cache/cache.go`: use updates entry mtime, at most hourly;
  trimming normally runs at most daily and removes entries unused for five
  days plus an hour of timestamp tolerance. It has no byte-budget policy here.
- `src/cmd/go/internal/work/exec.go`: executing a build graph closes the cache,
  which performs that trimming. An abandoned cache never reused by Go may
  consequently retain old entries indefinitely.
- A disposable fixture proved that `go build unsafe` expires an old entry and
  preserves a recent entry without compiling a project or downloading modules.

After checking an exact cache's producer signature, ownership, source-control
markers, mount boundaries and live references, a maintenance invocation is:

```sh
# Substitute the independently validated absolute private-cache path.
# Run from an existing neutral directory outside the project being inspected.
GOENV=off GOWORK=off GO111MODULE=off GOTOOLCHAIN=local \
  GOCACHEPROG= GOFLAGS= GOCACHE=/exact/validated/private-go-cache \
  /absolute/path/to/verified/go build unsafe
```

This is a mutating cache-maintenance operation. Measure before and after; it
can legitimately recover nothing when entries are recent or trimming recently
ran. Do not force freshness changes, erase `trim.txt`, or call it a hard size
cap. Re-verify behavior if the selected Go implementation changes. Preserve
unknown contents, fuzz corpora, repositories and proof evidence. Prefer running
as the cache owner so newly created bookkeeping files keep their owner.

## September 8 finding

Seven abandoned private caches in `/tmp` held approximately 68 GiB of expired
build artifacts. Native trimming reclaimed them while leaving source, downloaded
modules and proof logs in place. Several further scratch roots were copies of
Bun's package cache. The default `/tmp` policy was 30 days: too long for these
build bursts, and a directory-age sweep would also endanger retained checkouts.

Address this with shared caches and producer-owned scratch retirement. Native
Go cache expiration preserves recently used entries but does not bound a large
active working set. If the hot working set still exceeds available headroom,
use a measured cache/storage budget or provision additional build storage;
moving paths elsewhere on the same root volume does not add capacity. Do not
install a blanket cache-wipe timer as a substitute for that decision.
