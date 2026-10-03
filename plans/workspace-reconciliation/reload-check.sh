#!/usr/bin/env bash
# Every enabled plugin whose canonical leaf changed between baseline-gitlinks and tested-shas was reloaded
# after the full check (reloads.log: "<plugin-id> <epoch>") and is running. A change to shared packages
# or root manifests counts as a change to every enabled leaf in that repository.
set -u
here=/home/ubuntu/bb/plans/workspace-reconciliation
cd /home/ubuntu/bb || exit 1
for f in tested-shas baseline-gitlinks; do [ -f "$here/$f" ] || { echo "missing $f"; exit 1; }; done
tested_at=$(stat -c %Y "$here/tested-shas")
listfile=$(mktemp); trap 'rm -f "$listfile"' EXIT
bb plugin list --json > "$listfile" || { echo "bb plugin list failed"; exit 1; }
roots=""
for r in plugins community-plugins; do
  old=$(awk -v r="$r" '$1==r{print $2}' "$here/baseline-gitlinks"); new=$(awk -v r="$r" '$1==r{print $2}' "$here/tested-shas")
  if [ -n "$(git -C "$r" diff --name-only "$old" "$new" -- packages package.json bun.lock package-lock.json tsconfig.json)" ]; then
    roots+=" /home/ubuntu/bb/$r/plugins/*"
  else
    for leaf in $(git -C "$r" diff --name-only "$old" "$new" -- plugins/ | cut -d/ -f2 | sort -u); do roots+=" /home/ubuntu/bb/$r/plugins/$leaf"; done
  fi
done
HOLD="$here/reload-hold.txt" RELOADS="$here/reloads.log" TESTED_AT="$tested_at" python3 - "$listfile" $roots <<'PY'
import fnmatch, json, os, sys
data = json.load(open(sys.argv[1])); patterns = sys.argv[2:]
plugins = data["plugins"] if isinstance(data, dict) else data
reloads = {}
if os.path.exists(os.environ["RELOADS"]):
    for line in open(os.environ["RELOADS"]):
        parts = line.split()
        if len(parts) == 2: reloads[parts[0]] = max(reloads.get(parts[0], 0), int(parts[1]))
tested_at = int(os.environ["TESTED_AT"]); fail = False
held = set(l.strip() for l in open(os.environ["HOLD"]) if l.strip() and not l.startswith("#")) if os.path.exists(os.environ["HOLD"]) else set()
for p in plugins:
    root = str(p.get("rootDir", ""))
    if not any(fnmatch.fnmatch(root, pat) for pat in patterns): continue
    if not p.get("enabled"): print(f"skip {p['id']} ({root}): disabled"); continue
    if p["id"] in held: print(f"skip {p['id']} ({root}): owner reload hold"); continue
    ok_reload = reloads.get(p["id"], 0) >= tested_at; ok_run = p.get("status") == "running"
    print(f"{'ok' if ok_reload and ok_run else 'FAIL'} {p['id']} ({root}) reloaded={ok_reload} status={p.get('status')}")
    fail |= not (ok_reload and ok_run)
print("changed patterns:", " ".join(patterns) or "(none)")
sys.exit(1 if fail else 0)
PY
