#!/usr/bin/env bash
# community publish.yml on pushed main releases both packages without changing existing plugin releases, and a
# dry run was proven for each package against the CURRENT package tree, lock and workflow:
#  - structure: both packages in dispatch options, <pkg>/v* tags and the case mapping (workspace + packages/<pkg>
#    source path); every pre-existing option, tag and plugin mapping from the base revision is retained;
#    id-token: write; dry_run boolean input; the publish step is conditioned on dry_run being false and the
#    package publish uses --provenance; validate runs on push and packs both packages.
#  - execution: a successful workflow_dispatch run whose head commit has the same packages/<pkg> tree,
#    package-lock.json and publish.yml blobs as main, whose uploaded release-receipt-<pkg> artifact says
#    {"dryRun":true,"workspace":"@phosphorco/<pkg>","path":"packages/<pkg>"} for that head, and whose
#    "Publish public package" step concluded "skipped".
# Known failure: today (no package entries).
. plans/package-publication/lib.sh
BASE_PUBLISH=c0eda5095d7d474816e2edb7ed7049ad53ce697e
C=community-plugins; R=phosphorco/bb-community-plugins
sha=$(origin_head $C)
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
git -C $C show "$sha:.github/workflows/publish.yml" > $tmp/new.yml
git -C $C show "$BASE_PUBLISH:.github/workflows/publish.yml" > $tmp/old.yml
git -C $C show "$sha:.github/workflows/validate-pull-request.yml" > $tmp/validate.yml
python3 - "$tmp" <<'PY'
import yaml,sys,re
t=sys.argv[1]; fail=lambda m: sys.exit("FAIL: "+m)
def load(f):
  txt=open(f"{t}/{f}").read(); w=yaml.safe_load(txt); return txt,w,(w.get(True) or w.get('on'))
nt,nw,non=load('new.yml'); ot,ow,oon=load('old.yml'); vt,vw,von=load('validate.yml')
mp=lambda txt: dict(re.findall(r'^\s*([a-z0-9-]+)\)\s*workspace="([^"]+)"',txt,re.M))
nm,om=mp(nt),mp(ot)
ni=non['workflow_dispatch']['inputs']; oi=oon['workflow_dispatch']['inputs']
for k,v in om.items(): nm.get(k)==v or fail(f"plugin mapping {k} changed or lost")
set(oi['plugin']['options'])<=set(ni['plugin']['options']) or fail("lost dispatch options")
set(oon['push']['tags'])<=set(non['push']['tags']) or fail("lost tag triggers")
for p in ['bb-identity','bb-provider-settings']:
  p in ni['plugin']['options'] or fail(p+" not a dispatch choice")
  (p+"/v*") in non['push']['tags'] or fail(p+" tag trigger")
  nm.get(p)=="@phosphorco/"+p or fail(p+" workspace mapping")
  re.search(r'packages/\$\{?plugin\}?|packages/'+p, nt) or fail(p+" source path under packages/")
(ni.get('dry_run') or {}).get('type')=='boolean' or fail("dry_run boolean input")
nw['permissions'].get('id-token')=='write' or fail("id-token")
steps=nw['jobs']['publish']['steps']; pub=[s for s in steps if s.get('name')=='Publish public package']
len(pub)==1 or fail("exactly one 'Publish public package' step")
re.fullmatch(r"\$\{\{\s*!\s*inputs\.dry_run\s*\}\}|\$\{\{\s*inputs\.dry_run\s*!=\s*true\s*\}\}|!\s*inputs\.dry_run|inputs\.dry_run\s*!=\s*true",str(pub[0].get('if','')).strip()) or fail("publish step if must be exactly 'inputs.dry_run != true' or '!inputs.dry_run': "+str(pub[0].get('if')))
'--provenance' in pub[0]['run'] or fail("publish step lacks --provenance")
any('release-receipt' in str(s) for s in steps) or fail("no release-receipt artifact step")
'push' in von or fail("validate does not run on push")
all(('@phosphorco/'+p) in vt for p in ['bb-identity','bb-provider-settings']) or fail("validate does not pack both packages")
print("publish.yml/validate structure ok; plugin mappings retained:",len(om))
PY
blob() { git -C $C rev-parse "$1:$2" 2>/dev/null || echo none; }
for p in $PACKAGES; do
  inputs="packages/$p package.json package-lock.json tsconfig.base.json .github/workflows/publish.yml"
  want=$(for f in $inputs; do blob $sha $f; done | tr "\n" " ")
  found=""
  while read -r id h; do
    [ "$(for f in $inputs; do blob $h $f; done | tr "\n" " ")" = "$want" ] || continue
    rm -rf $tmp/a; gh run download "$id" -R $R -n "release-receipt-$p" -D $tmp/a >/dev/null 2>&1 || continue
    node -e 'const r=require(process.argv[1]); const [p,h]=process.argv.slice(2);
      if(!(r.dryRun===true&&r.workspace==="@phosphorco/"+p&&r.path==="packages/"+p&&r.sha===h)) process.exit(1)' \
      "$tmp/a/release-receipt.json" "$p" "$h" || continue
    st=$(gh run view "$id" -R $R --json jobs --jq '[.jobs[].steps[] | select(.name=="Publish public package") | .conclusion] | join(",")')
    [ "$st" = skipped ] || continue
    found=$id; break
  done < <(gh run list -R $R --workflow publish.yml --event workflow_dispatch -L 100 --json databaseId,headSha,conclusion \
           --jq '.[] | select(.conclusion=="success") | "\(.databaseId) \(.headSha)"')
  [ -n "$found" ] || die "no proven dry run for $p against main's package tree, lock and publish.yml"
  echo "$p: dry run proven (run $found)"
done
