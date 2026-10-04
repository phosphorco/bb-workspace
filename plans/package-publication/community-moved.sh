#!/usr/bin/env bash
# Both packages live in pushed community-plugins main, with history, unchanged API, npm-valid manifests,
# packed contents covering every export, standalone code, linked community consumers, and passing checks;
# everything is judged at one SHA in a verification worktree (shared dirt untouched).
# Split tips: $S/split-tips (<pkg> <split-tip> <plugins-source-sha>) written when the subtree is split.
# Known failure: today (no community packages, no split-tips).
cd /home/ubuntu/bb && . plans/package-publication/lib.sh || { echo "FAIL: cannot load lib.sh" >&2; exit 1; }
test -s $S/split-tips || die "no $S/split-tips"
sha=$(origin_head community-plugins)
verify_tree community-plugins "$sha"
node -e 'const w=require(process.argv[1]).workspaces; if(w[0]!=="packages/*") throw new Error("packages/* must be the first workspace: "+w)' "$WT/package.json"
plans/package-publication/standalone.sh "$WT/packages"
# split-tips rows: <pkg> <split-tip> <plugins-source-sha>. Exactly one per package; the source is on plugins
# main after SPLIT_BASE and the tip's tree equals source:packages/<pkg> (what git subtree split produces).
pl=$(origin_head plugins)
for p in $PACKAGES; do [ "$(awk -v p=$p '$1==p' $S/split-tips | wc -l)" = 1 ] || die "split-tips needs exactly one row for $p"; done
[ "$(grep -cvE '^\s*(#|$)' $S/split-tips)" = 2 ] || die "split-tips has unexpected rows"
# Files allowed to differ from the plugins split tip (community-owned manifest/config/docs).
allow='^(package\.json|tsconfig[^/]*\.json|README\.md|PACKAGING\.md|CONSUMERS\.md|STATUS\.md|REVIEW\.md)$'
while read -r p tip src; do
  case "$p" in ''|'#'*) continue;; esac
  git -C plugins merge-base --is-ancestor "$SPLIT_BASE" "$src" && git -C plugins merge-base --is-ancestor "$src" "$pl" || die "$p split source $src not on plugins main after SPLIT_BASE"
  [ "$(git -C community-plugins rev-parse "$tip^{tree}")" = "$(git -C plugins rev-parse "$src:packages/$p")" ] || die "$p split tip tree != $src:packages/$p"
  git -C community-plugins merge-base --is-ancestor "$tip" "$sha" || die "$p split tip $tip not in community history"
  n_src=$(git -C plugins rev-list --count "$src" -- "packages/$p"); n_tip=$(git -C community-plugins rev-list --count "$tip")
  [ "$n_tip" -ge "$n_src" ] || die "$p history not preserved ($n_tip of $n_src commits)"
  diffs=$(git -C community-plugins diff --name-only "$tip^{tree}" "$sha:packages/$p") || die "git diff failed for $p"
  diffs=$(printf '%s\n' "$diffs" | grep -vE "$allow" | grep -vE '^(examples/local-proof/|tsconfig\.proof-sdk\.json)' || true)
  [ -z "$diffs" ] || { echo "$diffs"; die "$p differs from split tip outside the allowlist"; }
  # Contract source = the split source manifest (already carrying the approved additive /testing entries);
  # production = SPLIT_BASE, whose every export must survive unchanged.
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
done < $S/split-tips
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
