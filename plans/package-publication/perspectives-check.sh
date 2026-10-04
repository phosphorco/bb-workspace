#!/usr/bin/env bash
# perspectives-check.sh WT: the campaign's Perspectives hand-off landed: some commit in community history
# carries all seven files byte-identical to HANDOFF.json (later adaptations are separate commits, printed for
# inspection); at WT the manifest pins exact bb-provider-settings VERSION and ships execution-settings.ts,
# and the lock links it to the workspace package. Known failure: today (files are uncommitted).
cd /home/ubuntu/bb && . plans/package-publication/lib.sh || { echo "FAIL: cannot load lib.sh" >&2; exit 1; }
WT=${1:?WT}; c=community-plugins; sha=$(git -C "$WT" rev-parse HEAD)
landed=""
for k in $(git -C $c rev-list "$sha" -- plugins/perspectives); do
  ok=1
  while IFS=$'\t' read -r path want; do
    got=$(git -C $c show "$k:$path" 2>/dev/null | sha256sum | cut -d' ' -f1); [ "$got" = "$want" ] || { ok=0; break; }
  done < <(python3 -c 'import json,sys;[print(p["path"]+"\t"+p["sha256"]) for p in json.load(open(sys.argv[1]))["paths"]]' "$HANDOFF")
  [ $ok = 1 ] && { landed=$k; break; }
done
[ -n "$landed" ] || die "no commit carries the seven hand-off files byte-identical to HANDOFF.json"
echo "perspectives hand-off bytes landed in ${landed:0:12}; adaptation delta since then:"
git -C $c diff --stat "$landed" "$sha" -- plugins/perspectives | tail -5
node -e '
  const m=require(process.argv[1]); const fail=x=>{console.error("perspectives: "+x);process.exit(1)};
  if(m.dependencies?.["@phosphorco/bb-provider-settings"]!==process.argv[2]) fail("dependency must be exact "+process.argv[2]);
  if(!(m.files||[]).some(f=>/execution-settings\.ts$/.test(f))) fail("files must include execution-settings.ts");
  if(/"(workspace|file|link):/.test(JSON.stringify(m))) fail("non-registry specifier");
' "$WT/plugins/perspectives/package.json" "$VERSION"
echo "perspectives-check: ok"
