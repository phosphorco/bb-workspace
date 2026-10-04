#!/usr/bin/env bash
# Pushed plugins main no longer holds the packages or the private publish workflow; EVERY dependency entry
# naming either package (any section, any key incl. npm aliases) is exactly VERSION; at least as many consumers
# as at SPLIT_BASE; bun.lock resolves both from the registry with the published integrity; at that SHA the
# frozen install and full plugins checks plus relocated consumer suites pass.
# Known failure: SPLIT_BASE (workspace:* consumers, packages present).
cd /home/ubuntu/bb && . plans/package-publication/lib.sh || { echo "FAIL: cannot load lib.sh" >&2; exit 1; }
sha=$(origin_head plugins)
verify_tree plugins "$sha"
for p in $PACKAGES; do test ! -e "$WT/packages/$p" || die "packages/$p still present"; done
test ! -e "$WT/.github/workflows/publish-provider-settings.yml" || die "private publish workflow still present"
count() { node -e '
  const fs=require("fs"),path=require("path"); const [root,ver,strict]=process.argv.slice(1); const n={};
  const walk=d=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){ if(e.name==="node_modules"||e.name===".git") continue;
    const f=path.join(d,e.name); if(e.isDirectory()) walk(f); else if(e.name==="package.json") check(f);}};
  const check=f=>{const j=JSON.parse(fs.readFileSync(f)); for(const s of ["dependencies","devDependencies","peerDependencies","optionalDependencies"]) for(const [k,v] of Object.entries(j[s]||{})) for(const p of ["bb-identity","bb-provider-settings"]) {
    const name="@phosphorco/"+p; if(k!==name && !String(v).includes(name)) continue;
    if(strict==="1" && (k!==name || v!==ver) && j.name!==name) {console.error(f+": "+s+" "+k+"="+v); process.exit(1)}
    if(j.name!==name) n[p]=(n[p]||0)+1; }};
  walk(root); console.log((n["bb-identity"]||0)+" "+(n["bb-provider-settings"]||0));' "$1" "$VERSION" "$2"; }
now=$(count "$WT" 1) || die "non-exact consumer specifier"
vb=$(mktemp -d); git -C plugins archive "$SPLIT_BASE" plugins | tar -x -C "$vb"; was=$(count "$vb" 0); rm -rf "$vb"
read -r ni np <<<"$now"; read -r wi wp <<<"$was"
[ "$ni" -ge "$wi" ] && [ "$np" -ge "$wp" ] || die "consumer count dropped: now $now, before $was"
pub=/home/ubuntu/.bb/thread-storage/thr_i7xakgdxdd/package-publication/published.txt
test -s $pub || die "no published.txt (run published.sh)"
for p in $PACKAGES; do
  integ=$(awk -v n="@phosphorco/$p@$VERSION" '$1==n{print $2}' $pub)
  [[ $integ == sha512-* ]] || die "no published integrity for @phosphorco/$p@$VERSION"
  # bun.lock "packages" tuple: "<name>": ["<name>@<ver>", "<registry or empty>", {meta}, "<integrity>"]
  node -e '
    const [lockf,name,ver,integ]=process.argv.slice(1); const txt=require("fs").readFileSync(lockf,"utf8");
    const lock=JSON.parse(txt.replace(/,(\s*[\]}])/g,"$1"));
    const t=lock.packages?.[name]; const fail=m=>{console.error("bun.lock "+name+": "+m);process.exit(1)};
    if(!Array.isArray(t)) fail("no packages entry");
    if(t[0]!==name+"@"+ver) fail("resolution "+t[0]);
    if(!(t[1]===""||/^https:\/\/registry\.npmjs\.org\/?/.test(t[1]))) fail("registry "+t[1]);
    if(t[t.length-1]!==integ) fail("integrity "+t[t.length-1]+" != "+integ);
    for (const [k,v] of Object.entries(lock.packages)) if(k!==name && Array.isArray(v) && String(v[0]).startsWith(name+"@") && v[0]!==name+"@"+ver) fail("second resolution "+k+" -> "+v[0]);
  ' "$WT/bun.lock" "@phosphorco/$p" "$VERSION" "$integ"
done
in_tool "cd '$WT' && bun install --frozen-lockfile && bun run references:sync && bun run sync:check && bun run references:check && bun run sdk-types:check \
  && bun run build && bun run typecheck && bun run test"
echo "plugins-consume: ok at ${sha:0:12} (consumers identity/provider-settings: $now; before: $was)"
