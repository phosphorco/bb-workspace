#!/usr/bin/env bash
# Producer for archive-evidence. Copies campaign evidence byte-identically into the PRIVATE plugins repo at
# evidence/package-publication/ (bb-workspace is public): tracked ARCHIVE files from archive-set.txt read from git
# at SPLIT_BASE, every gitignored file under both packages read from disk, and the relocation-era failure logs.
# Records an independent inventory of ORIGINAL hashes in thread storage before copying, then MANIFEST.json with
# per-item verbatim acceptance limits. Originals come from the canonical tree and git; the archive is written under
# DEST (a scratch plugins checkout), so the shared tree gains no untracked files. Commits nothing.
. plans/package-publication/lib.sh
P=/home/ubuntu/bb/plugins; DEST=${DEST:?DEST=<plugins checkout to write the archive into>}; E=evidence/package-publication; LOGS=/home/ubuntu/.cache/pkgpub-work/logs
INV=/home/ubuntu/.bb/thread-storage/thr_i7xakgdxdd/package-publication/archive-inventory.json
[ ! -e "$DEST/$E" ] || die "$DEST/$E already exists; inspect before re-running"
idx=$(mktemp); GIT_INDEX_FILE=$idx git -C $P read-tree $SPLIT_BASE
tracked=$(GIT_INDEX_FILE=$idx git -C $P ls-files -- $(grep -vE '^\s*(#|$)' $S/archive-set.txt)); rm -f $idx
[ -n "$tracked" ] || die "empty tracked set"
ignored=$(git -C $P ls-files --others --ignored --exclude-standard -- packages/bb-identity packages/bb-provider-settings | grep -vE '/(node_modules|dist)/' || true)
logs=$(cd $LOGS && ls -1)
node --input-type=module - "$P" "$SPLIT_BASE" "$INV" "$E" "$LOGS" "$tracked" "$ignored" "$logs" "$DEST" <<'JS'
import { execFileSync } from 'node:child_process'; import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'; import { dirname, join } from 'node:path';
import { limits } from '/home/ubuntu/bb/plans/package-publication/limits.mjs';
const [P, base, INV, E, LOGS, tr, ig, lg, DEST] = process.argv.slice(2); const list = (s) => s.split('\n').filter(Boolean);
const sha = (b) => createHash('sha256').update(b).digest('hex');
const items = [
  ...list(tr).map((p) => ({ oldPath: p, tracked: true, source: `git:${base}`, read: () => execFileSync('git', ['-C', P, 'show', `${base}:${p}`], { maxBuffer: 1 << 30 }) })),
  ...list(ig).map((p) => ({ oldPath: p, tracked: false, source: 'disk', read: () => readFileSync(join(P, p)) })),
  ...list(lg).map((n) => ({ oldPath: `pkgpub-work/logs/${n}`, tracked: false, source: 'disk', failureRecord: true, read: () => readFileSync(join(LOGS, n)) })),
];
// 1. Independent inventory of original bytes, written before any copy.
for (const it of items) { it.bytes = it.read(); it.sha256 = sha(it.bytes); }
mkdirSync(dirname(INV), { recursive: true });
writeFileSync(INV, JSON.stringify({ at: new Date().toISOString(), splitBase: base, items: items.map(({ oldPath, tracked, source, sha256 }) => ({ oldPath, tracked, source, sha256 })) }, null, 1) + '\n');
// 2. Byte-identical copies and manifest.
const files = []; const acceptanceLimits = {}; const failureRecords = [];
for (const it of items) {
  const rel = it.failureRecord ? `relocation-run-logs/${it.oldPath.split('/').pop()}` : it.oldPath;
  const dest = join(DEST, E, rel); mkdirSync(dirname(dest), { recursive: true }); writeFileSync(dest, it.bytes);
  const copied = sha(readFileSync(dest)); if (copied !== it.sha256) throw new Error(`copy mismatch ${rel}`);
  files.push({ oldPath: it.oldPath, archivedPath: `${E}/${rel}`, sha256: it.sha256, tracked: it.tracked, source: it.source });
  const l = limits(it.bytes); if (l.length) acceptanceLimits[it.oldPath] = l;
  if (it.failureRecord) failureRecords.push(`${E}/${rel}`);
}
writeFileSync(join(DEST, E, 'MANIFEST.json'), JSON.stringify({
  note: 'Byte-identical archive of bb-identity / bb-provider-settings campaign evidence before the move to bb-community-plugins. Historical proof only: nothing here was re-run or re-certified. acceptanceLimits are verbatim lines from each original item.',
  splitBase: base, files, failureRecords, acceptanceLimits }, null, 1) + '\n');
console.log(`archived ${files.length} files (${files.filter((f) => !f.tracked).length} disk-only), ${Object.keys(acceptanceLimits).length} items with limits, ${failureRecords.length} failure records`);
JS
