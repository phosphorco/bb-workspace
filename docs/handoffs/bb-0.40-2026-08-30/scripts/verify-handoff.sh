#!/usr/bin/env bash
set -euo pipefail

handoff_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
required=(
  README.md
  00-CURRENT-STATE.md
  01-DECISIONS-AND-SCOPE.md
  02-EXECUTION-RUNBOOK.md
  03-MIGRATION-AND-DATA.md
  04-PLUGIN-PORT-MAP.md
  05-VERIFICATION-EVIDENCE.md
  06-CUTOVER-ROLLBACK.md
  AGENT_PROMPT.md
  scripts/preflight.sh
  scripts/capture-evidence.sh
  scripts/verify-handoff.sh
)

for relative_path in "${required[@]}"; do
  [[ -s "$handoff_dir/$relative_path" ]] || {
    printf 'missing or empty: %s\n' "$relative_path" >&2
    exit 1
  }
done

bash -n "$handoff_dir/scripts/preflight.sh"
bash -n "$handoff_dir/scripts/capture-evidence.sh"
bash -n "$handoff_dir/scripts/verify-handoff.sh"

target="f3cab2dd8c5c4be6d450be318550f3a04c8c3a1f"
rg -q --fixed-strings "$target" "$handoff_dir/README.md" "$handoff_dir/02-EXECUTION-RUNBOOK.md"
rg -q --fixed-strings 'BEGIN IMMEDIATE' "$handoff_dir/03-MIGRATION-AND-DATA.md"
rg -q --fixed-strings 'Do not mutate Rosetta' "$handoff_dir/AGENT_PROMPT.md"

printf 'handoff bundle verified\n'
