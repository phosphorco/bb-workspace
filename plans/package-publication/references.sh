#!/usr/bin/env bash
# Active guidance and tooling (not historical plans/evidence) point at the community packages, judged at the
# workspace tree and freshly fetched child origin/main:
#  - no bare plugins/packages/<pkg> (or, inside plugins, relative packages/<pkg>) or bb-identity tarball path in
#    workspace .agents/AGENTS/README/bin/sdk-artifacts README, plugins AGENTS/README/tools/.github/manifests
#    (relocated consumer suites excepted), community AGENTS/README/tools/.github/manifests;
#  - every community manifest dependency on either package (any section) is exactly VERSION;
#  - relative Markdown links resolve in workspace skill/AGENTS/README and in child AGENTS.md/README.md at the
#    fetched SHA. Fork is excluded (unchanged).
# Known failure: today (.agents/skills/bb-identity references plugins/packages).
cd /home/ubuntu/bb && . plans/package-publication/lib.sh || { echo "FAIL: cannot load lib.sh" >&2; exit 1; }
pl=$(origin_head plugins); cm=$(origin_head community-plugins)
pat='(^|[^-a-z])plugins/packages/bb-(identity|provider-settings)|phosphorco-bb-identity-0\.'
ppat='(^|[^-a-z/])(plugins/)?packages/bb-(identity|provider-settings)|phosphorco-bb-identity-0\.'
g() { local rc; set +e; out=$("$@"); rc=$?; set -e; [ $rc -le 1 ] || die "git grep error: $*"; printf '%s' "$out"; }
bad=""
bad+="$(g git grep -nE "$pat" -- .agents AGENTS.md README.md bin sdk-artifacts/README.md)"$'\n'
bad+="$(g git -C plugins grep -nE "$ppat" "$pl" -- AGENTS.md README.md tools .github '*package.json' ':!tools/package-consumers')"$'\n'
bad+="$(g git -C community-plugins grep -nE "$pat" "$cm" -- AGENTS.md README.md tools .github '*package.json')"$'\n'
bad=$(printf "%s" "$bad" | sed "/^$/d"); [ -z "$bad" ] || { echo "$bad" | head -30 || true; die "stale package references"; }
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
git -C community-plugins archive "$cm" plugins packages | tar -x -C "$tmp" --wildcards '*/package.json' 2>/dev/null || true
node -e '
  const fs=require("fs"),path=require("path"); const [root,ver]=process.argv.slice(1); let n=0;
  for (const top of ["plugins","packages"]) { const d=path.join(root,top); if(!fs.existsSync(d)) continue;
    for (const e of fs.readdirSync(d)) { const f=path.join(d,e,"package.json"); if(!fs.existsSync(f)) continue; const j=JSON.parse(fs.readFileSync(f));
      for (const s of ["dependencies","devDependencies","peerDependencies","optionalDependencies"]) for (const [k,v] of Object.entries(j[s]||{}))
        if (/@phosphorco\/bb-(identity|provider-settings)/.test(k+" "+v)) { n++; if(!/^@phosphorco\/bb-(identity|provider-settings)$/.test(k)||v!==ver) { console.error(top+"/"+e+": "+s+" "+k+"="+v); process.exit(1) } } } }
  if(n<2) { console.error("expected at least 2 community consumers, found "+n); process.exit(1) }
' "$tmp" "$VERSION" || die "community consumer pins"
miss=0
# Full link destinations; skip anchors, schemes (https:, mailto:, ...) and absolute paths; strip #fragments.
links() { grep -oE '\]\([^) ]+' | sed 's/^](//' | grep -vE '^(#|/|[a-zA-Z][a-zA-Z0-9+.-]*:)' | sed 's/#.*//' | grep -v '^$' || true; }
while IFS= read -r f; do d=$(dirname "$f")
  for l in $(links < "$f"); do [ -e "$d/$l" ] || { echo "$f -> $l missing"; miss=1; }; done
done < <(git ls-files .agents/skills/bb-identity AGENTS.md README.md | grep '\.md$')
for spec in "plugins $pl" "community-plugins $cm"; do read -r repo rev <<<"$spec"
  for f in AGENTS.md README.md; do git -C $repo cat-file -e "$rev:$f" 2>/dev/null || continue
    for l in $(git -C $repo show "$rev:$f" | links); do
      t=$(python3 -c 'import os,sys;print(os.path.normpath(sys.argv[1]))' "$l")
      case "$t" in ../*) [ -e "/home/ubuntu/bb/$repo/$l" ] || { echo "$repo/$f -> $l missing"; miss=1; }; continue;; esac
      git -C $repo cat-file -e "$rev:$t" 2>/dev/null || { echo "$repo@${rev:0:8}/$f -> $l missing"; miss=1; }
    done; done; done
[ $miss = 0 ] || die "broken relative links"
echo "references: ok (plugins ${pl:0:12}, community ${cm:0:12})"
