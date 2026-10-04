#!/usr/bin/env bash
# Both packages are on npm at VERSION, released from the intended community source: the npm SLSA provenance
# attestation names workflow phosphorco/bb-community-plugins .github/workflows/publish.yml at ref
# refs/tags/<pkg>/v<VERSION> and source commit == npm gitHead == that tag's commit, which is on community main
# and carries VERSION in packages/<pkg>/package.json; repository metadata points at community; integrity is a
# nonempty sha512. Records "<name>@<ver> <integrity> gitHead=<sha>" in published.txt.
# Known failure: today (404 for both).
. plans/package-publication/lib.sh
C=community-plugins
sha=$(origin_head $C); git -C $C fetch -q --tags origin
out=/home/ubuntu/.bb/thread-storage/thr_i7xakgdxdd/package-publication; mkdir -p $out; : > $out/published.txt.new
for p in $PACKAGES; do
  n=@phosphorco/$p; tag=$p/v$VERSION
  j=$(npm view "$n@$VERSION" --json 2>/dev/null) || die "$n@$VERSION not on npm"
  read -r repo head integ < <(node -e 'const j=JSON.parse(process.argv[1]); console.log([j.repository?.url,j.gitHead,j.dist?.integrity].join(" "))' "$j")
  [[ $repo == *github.com/phosphorco/bb-community-plugins* ]] || die "$n repository is $repo"
  [[ $integ == sha512-* ]] || die "$n integrity '$integ'"
  tc=$(git -C $C rev-parse "refs/tags/$tag^{commit}" 2>/dev/null) || die "tag $tag missing"
  [ "$head" = "$tc" ] || die "$n gitHead $head != $tag commit $tc"
  git -C $C merge-base --is-ancestor "$tc" "$sha" || die "$tag commit not on community main"
  v=$(git -C $C show "$tc:packages/$p/package.json" | node -p 'JSON.parse(require("fs").readFileSync(0)).version')
  [ "$v" = "$VERSION" ] || die "$tag manifest version $v"
  enc=$(node -p 'encodeURIComponent(process.argv[1])' "$n@$VERSION")
  curl -fsS "https://registry.npmjs.org/-/npm/v1/attestations/$enc" > /tmp/pkgpub-att.json || die "$n has no attestations"
  python3 - "$tag" "$tc" <<'PY' || die "$n provenance does not match $tag"
import json,base64,sys
tag,commit=sys.argv[1:]; a=json.load(open('/tmp/pkgpub-att.json'))['attestations']
slsa=[x for x in a if 'slsa.dev/provenance' in x['predicateType']]
assert slsa, "no SLSA provenance"
st=json.loads(base64.b64decode(slsa[0]['bundle']['dsseEnvelope']['payload']))
bd=st['predicate']['buildDefinition']; wf=bd['externalParameters']['workflow']
assert wf['repository']=='https://github.com/phosphorco/bb-community-plugins', wf
assert wf['path']=='.github/workflows/publish.yml', wf
assert wf['ref']=='refs/tags/'+tag, wf
assert any(d.get('digest',{}).get('gitCommit')==commit for d in bd.get('resolvedDependencies',[])), bd.get('resolvedDependencies')
print("provenance:",wf['repository'],wf['path'],wf['ref'],commit[:12])
PY
  echo "$n@$VERSION $integ gitHead=$head" | tee -a $out/published.txt.new
done
mv $out/published.txt.new $out/published.txt
