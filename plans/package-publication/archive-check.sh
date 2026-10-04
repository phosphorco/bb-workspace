#!/usr/bin/env bash
# The evidence archive is complete, byte-identical to the ORIGINALS and pushed, judged on plugins origin/main:
#  - expected tracked set = archive-set.txt expanded at SPLIT_BASE; every member is archived and its archived blob on
#    origin/main hashes equal to the original blob at SPLIT_BASE;
#  - expected disk-only set = the independent pre-copy inventory (and every gitignored package file still on disk);
#    each archived blob equals the inventory hash, and equals the original file while that still exists;
#  - failure records are the archived relocation-run logs, equal to their originals while present;
#  - acceptanceLimits equal the verbatim extraction (limits.mjs) recomputed from each archived blob.
# Known failure: today (no archive on plugins origin/main).
cd /home/ubuntu/bb && . plans/package-publication/lib.sh || { echo "FAIL: cannot load lib.sh" >&2; exit 1; }
P=plugins; E=evidence/package-publication; LOGS=/home/ubuntu/.cache/pkgpub-work/logs
INV=/home/ubuntu/.bb/thread-storage/thr_i7xakgdxdd/package-publication/archive-inventory.json
sha=$(origin_head $P)
git -C $P cat-file -e "$sha:$E/MANIFEST.json" 2>/dev/null || die "no $E/MANIFEST.json on plugins origin/main"
test -s $INV || die "no pre-copy inventory $INV"
idx=$(mktemp); GIT_INDEX_FILE=$idx git -C $P read-tree $SPLIT_BASE
tracked=$(GIT_INDEX_FILE=$idx git -C $P ls-files -- $(grep -vE '^\s*(#|$)' $S/archive-set.txt)); rm -f $idx
[ -n "$tracked" ] || die "expected tracked set is empty"
ignored=$(git -C $P ls-files --others --ignored --exclude-standard -- packages/bb-identity packages/bb-provider-settings | grep -vE '/(node_modules|dist)/' || true)
node --input-type=module - "$sha" "$tracked" "$ignored" "$INV" "$LOGS" <<'JS'
import { execFileSync } from 'node:child_process'; import { createHash } from 'node:crypto'; import { readFileSync, existsSync } from 'node:fs';
import { limits } from '/home/ubuntu/bb/plans/package-publication/limits.mjs';
const [head, tr, ig, INV, LOGS] = process.argv.slice(2); const list = (s) => s.split('\n').filter(Boolean);
const P = '/home/ubuntu/bb/plugins'; const E = 'evidence/package-publication';
const git = (rev, path) => execFileSync('git', ['-C', P, 'show', `${rev}:${path}`], { maxBuffer: 1 << 30 });
const sha = (b) => createHash('sha256').update(b).digest('hex');
const fail = (m) => { console.error('FAIL: ' + m); process.exit(1); };
const m = JSON.parse(git(head, `${E}/MANIFEST.json`)); const inv = JSON.parse(readFileSync(INV));
const base = m.splitBase; const byOld = new Map(m.files.map((f) => [f.oldPath, f])); const invBy = new Map(inv.items.map((i) => [i.oldPath, i]));
if (base !== inv.splitBase) fail('manifest and inventory disagree on splitBase');
for (const p of list(tr)) { const f = byOld.get(p); if (!f || !f.tracked) fail(`tracked evidence not archived: ${p}`);
  const orig = sha(git(base, p)); if (orig !== f.sha256 || orig !== invBy.get(p)?.sha256) fail(`tracked hash mismatch vs original: ${p}`); }
const disk = inv.items.filter((i) => !i.tracked);
for (const p of list(ig)) if (!invBy.has(p)) fail(`gitignored package file missing from inventory/archive: ${p}`);
for (const i of disk) { const f = byOld.get(i.oldPath); if (!f) fail(`inventoried disk item not archived: ${i.oldPath}`);
  if (f.sha256 !== i.sha256) fail(`manifest hash != inventory hash: ${i.oldPath}`);
  const orig = i.oldPath.startsWith('pkgpub-work/logs/') ? `${LOGS}/${i.oldPath.split('/').pop()}` : `${P}/${i.oldPath}`;
  if (existsSync(orig) && sha(readFileSync(orig)) !== i.sha256) fail(`original changed since inventory: ${i.oldPath}`); }
for (const f of m.files) { const b = git(head, f.archivedPath); if (sha(b) !== f.sha256) fail(`archived blob mismatch: ${f.archivedPath}`);
  const want = limits(b); const got = m.acceptanceLimits[f.oldPath] ?? [];
  if (JSON.stringify(want) !== JSON.stringify(got)) fail(`acceptance limits not verbatim for ${f.oldPath}`); }
const logs = inv.items.filter((i) => i.oldPath.startsWith('pkgpub-work/logs/')).length;
if (!logs || m.failureRecords.length !== logs) fail('failure records missing');
for (const r of m.failureRecords) if (!m.files.some((f) => f.archivedPath === r)) fail(`failure record not in files: ${r}`);
console.log(`archive-check: ${m.files.length} files verified against originals (${disk.length} disk-only), ${Object.keys(m.acceptanceLimits).length} items with verbatim limits, ${m.failureRecords.length} failure records, at ${head.slice(0, 12)}`);
JS
