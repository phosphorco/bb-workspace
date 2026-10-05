#!/usr/bin/env bash
# Both packages live in pushed community-plugins main, with history, unchanged API, npm-valid manifests,
# packed contents covering every export, standalone code, linked community consumers, and passing checks;
# everything is judged at one SHA in a verification worktree (shared dirt untouched).
# Import sources: $S/import-sources (<pkg> <plugins-source-sha>), fresh import (Cole 2026-10-05).
# Known failure: today (no import-sources, no community packages).
cd /home/ubuntu/bb && . plans/package-publication/lib.sh || { echo "FAIL: cannot load lib.sh" >&2; exit 1; }
sha=$(origin_head community-plugins)
verify_tree community-plugins "$sha"
node -e 'const w=require(process.argv[1]).workspaces; if(w[0]!=="packages/*") throw new Error("packages/* must be the first workspace: "+w)' "$WT/package.json"
plans/package-publication/standalone.sh "$WT/packages"
# import-sources (Cole 2026-10-05: fresh import): '<pkg> <full plugins sha>' per package. Each source descends from the accepted conformance commit ce7d05e and
# is on plugins main. fresh-import-check.sh proves the history property over the whole of base..HEAD
# (no roots or plugins commits, one common import commit with full pointers, tree equality at the import commit,
# and no leaks or archived campaign material in any newly reachable tree); see fresh-import-witness.sh.
ACCEPTED=ce7d05ec70dbd8f5dc6f17665cbe2fec8ee61f60
test -s $S/import-sources || die "no $S/import-sources"
pl=$(origin_head plugins)
# Trusted baseline: community main when this plan was authored (reviewed public history, before any package import).
# Everything after it, including peers' commits and side branches, is inspected.
cbase=c0eda5095d7d474816e2edb7ed7049ad53ce697e
for p in $PACKAGES; do [ "$(awk -v p=$p '$1==p' $S/import-sources | wc -l)" = 1 ] || die "import-sources needs exactly one row for $p"; done
[ "$(grep -cvE '^\s*(#|$)' $S/import-sources)" = 2 ] || die "import-sources has unexpected rows"
specs=""
while read -r p src; do
  case "$p" in ''|'#'*) continue;; esac
  [ ${#src} = 40 ] || die "$p source must be a full SHA"
  git -C plugins merge-base --is-ancestor "$ACCEPTED" "$src" && git -C plugins merge-base --is-ancestor "$src" "$pl" || die "$p source $src does not descend from accepted $ACCEPTED on plugins main"
  specs+=" $p=$src"
done < $S/import-sources
mkdir -p "$VT/m"; git -C plugins show "$pl:evidence/package-publication/MANIFEST.json" > "$VT/m/manifest.json"
plans/package-publication/fresh-import-check.sh /home/ubuntu/bb/community-plugins "$cbase" "$sha" /home/ubuntu/bb/plugins "$VT/m/manifest.json" $specs
allow='^(package\.json|tsconfig[^/]*\.json|README\.md|PACKAGING\.md|CONSUMERS\.md)$'
while read -r p src; do
  case "$p" in ''|'#'*) continue;; esac
  base=$(git -C plugins show "$src:packages/$p/package.json") || die "no source manifest for $p"
  prod=$(git -C plugins show "$SPLIT_BASE:packages/$p/package.json") || die "no production manifest for $p"
  root=$(git -C plugins show "$src:package.json") || die "no plugins root manifest"
  node -e '
    const [b,c,ver,root,prod]=[JSON.parse(process.argv[1]),require(process.argv[2]),process.argv[3],JSON.parse(process.argv[4]),JSON.parse(process.argv[5])];
    const fail=m=>{console.error(c.name+": "+m);process.exit(1)};
    const cat=(n,v)=>{ if(!String(v).startsWith("catalog:")) return v; const k=v.slice(8); const t=k?root.catalogs?.[k]:root.catalog; if(!t?.[n]) fail("unresolvable "+n+" "+v); return t[n]; };
    const eq=(x,y)=>JSON.stringify(x??null)===JSON.stringify(y??null);
    if(c.name!==b.name||c.version!==ver) fail("name/version");
    for (const f of ["exports","peerDependencies","peerDependenciesMeta","type"]) if(!eq(c[f],b[f])) fail(f+" differs from split source");
    for (const [k,v] of Object.entries(prod.exports)) if(!eq(c.exports[k],v)) fail("production export "+k+" changed");
    for (const k of Object.keys(c.exports)) if(!(k in prod.exports) && !/^\.\/testing(\/react)?$/.test(k)) fail("unapproved new export "+k);
    for (const [k,v] of Object.entries(prod.peerDependencies||{})) if(c.peerDependencies?.[k]!==v) fail("production peer "+k+" changed");
    const bd=Object.fromEntries(Object.entries(b.dependencies||{}).map(([n,v])=>[n,cat(n,v)]));
    if(!eq(c.dependencies,bd)) fail("dependencies changed: "+JSON.stringify(c.dependencies)+" vs "+JSON.stringify(bd));
    if(!/github\.com\/phosphorco\/bb-community-plugins/.test(c.repository?.url)||c.repository?.directory!=="packages/"+c.name.split("/")[1]) fail("repository");
    if(c.publishConfig?.access!=="public") fail("publishConfig.access");
    if(/"(workspace|catalog|file|link):/.test(JSON.stringify(c))) fail("non-registry specifier");
    for (const s of ["build","test","typecheck"]) if(!c.scripts?.[s]) fail("missing script "+s);
  ' "$base" "$WT/packages/$p/package.json" "$VERSION" "$root" "$prod"
done < $S/import-sources
node -e '
  const lock=require(process.argv[1]); const fail=m=>{console.error(m);process.exit(1)};
  for (const p of ["bb-identity","bb-provider-settings"]) { const e=lock.packages["node_modules/@phosphorco/"+p];
    if(!e||!e.link||e.resolved!=="packages/"+p) fail("lock does not link @phosphorco/"+p+" to packages/"+p); }
  const fs=require("fs"); const ver=process.argv[3]; let n=0;
  for (const d of fs.readdirSync(process.argv[2])) { const f=process.argv[2]+"/"+d+"/package.json"; if(!fs.existsSync(f)) continue; const j=JSON.parse(fs.readFileSync(f));
    for (const s of ["dependencies","devDependencies","peerDependencies","optionalDependencies"]) for (const [k,v] of Object.entries(j[s]||{}))
      if (/@phosphorco\/bb-(identity|provider-settings)/.test(k+" "+v)) { if(!/^@phosphorco\/bb-(identity|provider-settings)$/.test(k)||v!==ver) fail(f+": "+s+" "+k+"="+v); n++; } }
  if (n<2) fail("expected agentation-mentions and perspectives consumers, found "+n);
' "$WT/package-lock.json" "$WT/plugins" "$VERSION"
in_tool "cd '$WT' && npm ci && npm run build && npm run test && npm run typecheck \
  && for p in $PACKAGES; do npm run build -w @phosphorco/\$p && npm run test -w @phosphorco/\$p && npm run typecheck -w @phosphorco/\$p || exit 1; done"
for p in $PACKAGES; do
  in_tool "cd '$WT' && npm pack --dry-run --json --ignore-scripts -w @phosphorco/$p" > "$VT/$p.pack.json"
  node -e '
    const pack=require(process.argv[1])[0]; const pkg=require(process.argv[2]); const files=new Set(pack.files.map(f=>f.path));
    const want=[]; for (const v of Object.values(pkg.exports)) for (const t of Object.values(v)) want.push(t.replace(/^\.\//,""));
    const missing=want.filter(f=>!files.has(f)); if(missing.length){console.error(pkg.name+" pack misses exports: "+missing);process.exit(1)}
    const stray=[...files].filter(f=>/^(test|tools|type-tests|examples|src)\//.test(f)); if(stray.length){console.error(pkg.name+" packs non-dist sources: "+stray.slice(0,5));process.exit(1)}
    console.log(pkg.name+": pack ok ("+files.size+" files, "+pack.integrity+")");
  ' "$VT/$p.pack.json" "$WT/packages/$p/package.json"
done
plans/package-publication/perspectives-check.sh "$WT"
echo "community-moved: ok at ${sha:0:12}"
