#!/usr/bin/env bash
set -euo pipefail
export PATH=/home/ubuntu/.local/share/mise/shims:/usr/local/bin:/usr/bin:/bin
exec >>/tmp/bb-transcripts-activation.log 2>&1
runtime=/home/ubuntu/bb/fork/build/bb
old_head=83a1c2928735aba553edf9f46c77995134497350
next_head=0ba993279b93dc90c52ef33a4b8ff848ee2917c3
next_tree=2952d30514af252b57634cf0023d4b8e5ac6356e
[[ $(git -C "$runtime" rev-parse HEAD) == "$old_head" ]]
[[ -z $(git -C "$runtime" status --porcelain=v1) ]]
[[ $(cat /home/ubuntu/bb/fork/result-tree.lock) == "$next_tree" ]]
[[ $(git -C "$runtime" rev-parse "$next_head^{tree}") == "$next_tree" ]]
recover_activation() {
  result=$?
  trap - ERR
  set +e
  echo "Transcript activation failed with exit $result; recovering previous canonical runtime."
  if [[ -z $(git -C "$runtime" status --porcelain=v1) ]]; then
    git -C "$runtime" checkout --detach --no-overwrite-ignore "$old_head" &&
      (cd "$runtime" && pnpm install --frozen-lockfile && pnpm build) > /tmp/bb-transcripts-recovery-build.log 2>&1
  fi
  systemctl --user start bb.service
  for attempt in {1..60}; do
    if BB_SERVER_URL=http://127.0.0.1:38886 "$runtime/packages/bb-app/host-daemon/dist/bb" thread tell thr_kmhguukhgy 'Transcript activation failed; recovery attempted to previous canonical runtime. Do not accept delivery. Inspect /tmp/bb-transcripts-activation.log and recovery-build.log, recover and continue the authorized plan.' --model gpt-6-astra --reasoning-level high --service-tier fast --json > /tmp/bb-transcripts-recovery-resume.json 2>&1; then break; fi
    sleep 1
  done
  exit "$result"
}
trap recover_activation ERR
date -u
sleep 2
systemctl --user stop bb.service
[[ $(git -C "$runtime" rev-parse HEAD) == "$old_head" ]]
[[ -z $(git -C "$runtime" status --porcelain=v1) ]]
git -C "$runtime" checkout --detach --no-overwrite-ignore "$next_head"
[[ $(git -C "$runtime" rev-parse 'HEAD^{tree}') == "$next_tree" ]]
cd "$runtime"
pnpm install --frozen-lockfile >/tmp/bb-transcripts-live-install.log 2>&1
pnpm exec turbo run typecheck --concurrency=1 >/tmp/bb-transcripts-live-typecheck.log 2>&1
python3 - <<'PY'
import os, subprocess
check_env = {'HOME': '/home/ubuntu', 'PATH': '/home/ubuntu/.local/share/mise/installs/node/22.19.0/bin:/home/ubuntu/.local/share/mise/installs/pnpm/9.15.0:/usr/local/bin:/usr/bin:/bin', 'NODE_ENV': 'test', 'BB_THREAD_MANAGER_PLUGIN_ROOT': '/home/ubuntu/bb/plugins/plugins/thread-manager'}
with open('/tmp/bb-transcripts-live-test.log', 'w') as log:
    result = subprocess.run(['pnpm', 'exec', 'turbo', 'run', 'test', '--env-mode=loose', '--concurrency=1'], env=check_env, stdout=log, stderr=subprocess.STDOUT)
raise SystemExit(result.returncode)
PY
pnpm build >/tmp/bb-transcripts-live-build.log 2>&1
[[ -z $(git status --porcelain=v1) ]]
systemctl --user start bb.service
for attempt in {1..60}; do
  if BB_SERVER_URL=http://127.0.0.1:38886 "$runtime/packages/bb-app/host-daemon/dist/bb" settings p6r-identity --json >/tmp/bb-transcripts-live-machine.json 2>/tmp/bb-transcripts-live-probe-error.log; then
    date -u
    BB_SERVER_URL=http://127.0.0.1:38886 "$runtime/packages/bb-app/host-daemon/dist/bb" thread tell thr_kmhguukhgy 'Transcript activation completed in canonical runtime. Replay 0ba993279b93dc90c52ef33a4b8ff848ee2917c3 tree 2952d30514af252b57634cf0023d4b8e5ac6356e; canonical install/typecheck/test/build passed. Continue execution from /home/ubuntu/bb/plans/message-transcripts.plan.pkl and sibling ledger via workbench plan recall/tick. Complete live codex gpt-5.6-luna low fast child proof over loopback and remote URL, inspect provider transcript, then commit/push selected children and workspace promotion and communicate delivery. Never bb wait. Activation log /tmp/bb-transcripts-activation.log.' --model gpt-6-astra --reasoning-level high --service-tier fast --json >/tmp/bb-transcripts-live-resume-message.json
    exit 0
  fi
  sleep 1
done
exit 1
