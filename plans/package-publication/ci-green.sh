#!/usr/bin/env bash
# Required workflows ran on push for the freshly fetched origin/main of each child and their latest attempt
# succeeded: plugins CI (ci.yml); community Validate (validate-pull-request.yml, push trigger added by
# publish-workflow). Known failure: today (plugins CI red; community validate has no push runs).
. plans/package-publication/lib.sh
for spec in "plugins phosphorco/bb-plugins ci.yml" "community-plugins phosphorco/bb-community-plugins validate-pull-request.yml"; do
  read -r d repo wf <<<"$spec"; sha=$(origin_head "$d")
  r=$(gh run list -R "$repo" --workflow "$wf" --commit "$sha" --event push -L 100 --json databaseId,status,conclusion,createdAt,attempt \
      --jq 'sort_by(.createdAt) | last | "\(.databaseId) \(.status) \(.conclusion) \(.attempt)"')
  [ -n "$r" ] && [ "$r" != "null null null null" ] || die "$repo $wf: no push run for ${sha:0:12}"
  read -r id st co at <<<"$r"
  [ "$st" = completed ] && [ "$co" = success ] || die "$repo $wf run $id (attempt $at) is $st/$co at ${sha:0:12}"
  echo "$repo $wf: success (run $id, ${sha:0:12})"
done
