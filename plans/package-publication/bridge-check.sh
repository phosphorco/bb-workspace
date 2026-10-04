#!/usr/bin/env bash
# The Perspectives emergency runtime bridge is retired: the exact owned link
#   community-plugins/node_modules/@phosphorco/bb-provider-settings -> /home/ubuntu/bb/plugins/packages/bb-provider-settings
# is gone; @phosphorco/bb-provider-settings resolves from community-plugins to the community workspace package
# (community-plugins/packages/bb-provider-settings); and Perspectives is running.
# Known failure: today (bridge link in place, no community package).
. plans/package-publication/lib.sh
L=community-plugins/node_modules/@phosphorco/bb-provider-settings
BRIDGE=/home/ubuntu/bb/plugins/packages/bb-provider-settings
[ "$(readlink -f "$L" 2>/dev/null)" != "$BRIDGE" ] || die "bridge link still points at $BRIDGE"
real=$(cd community-plugins/plugins/perspectives && node -e 'console.log(require("fs").realpathSync(require.resolve("@phosphorco/bb-provider-settings/package.json")))' 2>/dev/null) || die "@phosphorco/bb-provider-settings does not resolve from Perspectives"
[ "$real" = /home/ubuntu/bb/community-plugins/packages/bb-provider-settings/package.json ] || die "resolves to $real, not the community workspace package"
st=$(bb plugin list --json | jq -r '.[] | select(.id=="perspectives") | .status')
[ "$st" = running ] || die "perspectives status $st"
echo "bridge-check: retired; resolves to community workspace package; perspectives running"
