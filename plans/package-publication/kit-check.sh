#!/usr/bin/env bash
# Pushed plugins main: both packages ship a /testing conformance kit that is neutral and real:
#  - provider-settings exports ./testing and ./testing/react; identity ./testing declares createIdentityWireFake
#    and defineStateStorageConformance;
#  - kit sources name no consumer plugin, import nothing outside the package, and carry no hashes/receipts;
#  - kit self-test AND a negative self-test (a deliberately broken port must fail a scenario) are part of the
#    package's ordinary test; at that SHA each package builds, typechecks, tests and packs its testing entries.
# Known failure: today (no provider-settings ./testing).
cd /home/ubuntu/bb && . plans/package-publication/lib.sh || { echo "FAIL: cannot load lib.sh" >&2; exit 1; }
sha=$(origin_head plugins)
verify_tree plugins "$sha"
ps=$WT/packages/bb-provider-settings; id=$WT/packages/bb-identity
node -e 'const e=require(process.argv[1]).exports; for (const k of ["./testing","./testing/react"]) if(!e[k]) {console.error("FAIL: provider-settings lacks "+k); process.exit(1)}' "$ps/package.json"
grep -q createIdentityWireFake "$id/testing.d.ts" && grep -q defineStateStorageConformance "$id/testing.d.ts" || die "identity ./testing lacks createIdentityWireFake/defineStateStorageConformance"
consumers='rosetta|github-review|thread-progress|sticky-notes|btw|perspectives|future-threads|review-to-disposition|plugin-provider-settings'
kit=$(ls "$ps"/src/testing*.ts* 2>/dev/null) || die "no provider-settings kit sources"
set +e; bad=$(grep -nE "$consumers|sha256|receipt|(\.\./){2,}" $kit); set -e
[ -z "$bad" ] || { echo "$bad" | head || true; die "kit names consumers, reaches outside, or carries evidence"; }
ls "$ps"/test/testing/*self*.test.* >/dev/null 2>&1 || die "no kit self-test"
# Each fault is required independently; the ordinary run below must execute them (they assert the scenario fails).
grep -lE "write-on-read|writeOnRead" "$ps"/test/testing/*.test.* >/dev/null || die "no write-on-Read negative self-test"
grep -lE "ignored-fingerprint|ignoredFingerprint" "$ps"/test/testing/*.test.* >/dev/null || die "no ignored-fingerprint negative self-test"
grep -lE "late-callback|lateCallback" "$ps"/test/testing/*.test.* >/dev/null || die "no UI late-callback self-test"
grep -lE "delayed-read|delayedRead|delayed initial Read" "$ps"/test/testing/*.test.* >/dev/null || die "no controlled delayed initial-Read self-test"
in_tool "cd '$WT' && bun install --frozen-lockfile && (cd packages/bb-provider-settings && bun run build && bun run typecheck && bun run test 2>&1 | tee '$VT/ps-test.log' && test -f dist/testing.js) \
  && (cd packages/bb-identity && bun run build && bun run typecheck && bun run test)"
in_tool "cd '$ps' && npm pack --dry-run --json --ignore-scripts" > "$VT/ps.pack.json"
node -e 'const f=require(process.argv[1])[0].files.map(x=>x.path); for (const want of ["dist/testing.js","dist/testing-react.js"]) if(!f.includes(want)) {console.error("FAIL: pack lacks "+want); process.exit(1)}' "$VT/ps.pack.json"
# ./testing and core entries stay DOM-free (react/react-dom/jsdom only in ./testing/react).
node -e 'const fs=require("fs"); for (const f of ["index.js","bb.js","testing.js"]) { const t=fs.readFileSync(process.argv[1]+"/dist/"+f,"utf8");
  if(/from\s*["\x27](jsdom|react-dom|react)(\/[^"\x27]*)?["\x27]/.test(t)) { console.error("FAIL: dist/"+f+" imports DOM/React"); process.exit(1) } }' "$ps"
# The ordinary package run executed and passed each required case (a negative case passes when the broken port is
# caught), none skipped: owner faults, UI late callback, controlled delayed initial Read, cross-owner targeting.
for t in "write-on-read|writeOnRead" "ignored-fingerprint|ignoredFingerprint" "late-callback|lateCallback" \
         "delayed-read|delayedRead|delayed initial Read" "cross-owner"; do passed "$VT/ps-test.log" "$t"; done
echo "kit-check: ok at ${sha:0:12}"
