#!/usr/bin/env bash
# Pushed plugins main has inverted consumer testing:
#  (1) the private publish workflow was absent (or push-less) in the parent of every package-touching commit after
#      SPLIT_BASE;
#  (2) package trees are standalone (private stage) and contain no consumer registry, consumer suites or
#      native-boundaries/central suites;
#  (3) every consumer plugin has its own test importing the relevant /testing kit (thread-progress also uses
#      createIdentityWireFake); every removed package file is archived (MANIFEST oldPath), moved into a plugin, or
#      has its own row in plugins evidence/package-publication/DISPOSITION.md; the archive was pushed before any removal;
#      each consumer's own suite passes with no skips, including the formerly racing mounted cases;
#  (4) at that SHA, frozen install, sync/references/sdk-types checks and root build/typecheck/test pass.
# Known failure: today (registry present, no plugin kit tests).
. plans/package-publication/lib.sh
sha=$(origin_head plugins)
wf=.github/workflows/publish-provider-settings.yml
commits=$(git -C plugins rev-list --reverse "$SPLIT_BASE..$sha" -- packages)
[ -n "$commits" ] || die "no package cut-over commits after SPLIT_BASE"
for c in $commits; do
  if git -C plugins cat-file -e "$c^:$wf" 2>/dev/null && git -C plugins show "$c^:$wf" | grep -qE '^\s*push:'; then
    die "package commit $c pushed while $wf still had a push trigger"; fi
done
verify_tree plugins "$sha"
plans/package-publication/standalone.sh "$WT/packages" private
ps=$WT/packages/bb-provider-settings
for gone in test/integration/consumers test/integration/consumer-slots.mjs test/integration/native-boundaries.test.ts test/integration/central; do
  test ! -e "$ps/$gone" || die "provider-settings still contains $gone"; done
test ! -e "$WT/packages/bb-identity/type-tests/browser/progress-inbox-browser-app.tsx" || die "identity still hosts thread-progress inbox fixture"
for c in rosetta-slack github-review thread-progress sticky-notes btw future-threads review-to-disposition plugin-provider-settings; do
  grep -rlE "@phosphorco/bb-provider-settings/testing" "$WT/plugins/$c" --include='*.test.*' --exclude-dir=node_modules >/dev/null \
    || die "$c has no test using @phosphorco/bb-provider-settings/testing"
done
grep -rl createIdentityWireFake "$WT/plugins/thread-progress" --include='*.test.*' --include='*.tsx' --exclude-dir=node_modules >/dev/null || die "thread-progress inbox tests do not use createIdentityWireFake"
E=evidence/package-publication
# Archive pushed before any removal: every package commit that deletes files has the manifest in its parent.
for c in $commits; do
  if [ -n "$(git -C plugins diff --name-only --diff-filter=D "$c^" "$c" -- packages)" ]; then
    git -C plugins cat-file -e "$c^:$E/MANIFEST.json" 2>/dev/null || die "commit $c removes package files before the evidence archive was pushed"; fi
done
# Every removed package file is archived (MANIFEST oldPath) or has its own DISPOSITION.md row:
#   | <exact path> | pruned \| replaced-by <plugin test path> | <rationale naming where behaviour is retained> |
removed=$(git -C plugins diff --name-only --diff-filter=DR "$SPLIT_BASE" "$sha" -- packages | sort -u)
git -C plugins cat-file -e "$sha:$E/DISPOSITION.md" 2>/dev/null || die "no $E/DISPOSITION.md on plugins main"
node -e '
  const [removed,disp,man,wt]=[process.argv[1].split("\n").filter(Boolean),process.argv[2],JSON.parse(process.argv[3]),process.argv[4]];
  const fs=require("fs"); const fail=m=>{console.error("FAIL: "+m);process.exit(1)};
  const archived=new Set(man.files.map(f=>f.oldPath)); const rows=new Map();
  for (const l of disp.split("\n")) { const c=l.split("|").map(x=>x.trim()); if(c.length<5||!c[1].startsWith("packages/")) continue; rows.set(c[1].replace(/`/g,""),{d:c[2],r:c[3]}); }
  for (const r of removed) { if(archived.has(r)) continue; const row=rows.get(r); if(!row) fail("no disposition row for "+r);
    if(row.r.length<15) fail("rationale too thin for "+r);
    const m=row.d.match(/^replaced-by\s+`?([^`\s]+)`?/); if(m){ if(!fs.existsSync(wt+"/"+m[1])) fail(r+": replacement "+m[1]+" missing"); }
    else if(row.d!=="pruned") fail(r+": disposition must be pruned or replaced-by <path>"); }
  console.log("dispositions: "+removed.length+" removed files accounted for");
' "$removed" "$(git -C plugins show "$sha:$E/DISPOSITION.md")" "$(git -C plugins show "$sha:$E/MANIFEST.json")" "$WT"
in_tool "cd '$WT' && bun install --frozen-lockfile && bun run references:sync && bun run sync:check && bun run references:check && bun run sdk-types:check \
  && bun run build && bun run typecheck && bun run test"
# Each consumer's own suite runs and passes on its own, with no skipped or failed kit scenario.
for c in rosetta-slack github-review thread-progress sticky-notes btw future-threads review-to-disposition plugin-provider-settings; do
  in_tool "cd '$WT/plugins/$c' && bun run test 2>&1" > "$VT/$c.log" || { tail -20 "$VT/$c.log"; die "$c tests failed"; }
  ! grep -qiE '\(skip|\(todo|# SKIP|# TODO|^not ok|\(fail' "$VT/$c.log" || die "$c has skipped or failed tests"
  grep -qE '\(pass\)|✓|✔|^ok [0-9]+ ' "$VT/$c.log" || die "$c ran no tests"
done
# Formerly racing mounted cases now pass in the ordinary runner (Amendment R3).
passed "$VT/github-review.log" "late.*picker|picker.*late"
passed "$VT/sticky-notes.log" "malformed"
echo "conformance-check: ok at ${sha:0:12}"
