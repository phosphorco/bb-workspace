# Isolated BB service preview

Cole authorized this independent workspace and new ports for a Tailnet identity test.
It is not a promotion or a replacement for `/home/ubuntu/bb`.

- App: https://rosetta.banjo-tint.ts.net:40888/
- Identity check: https://rosetta.banjo-tint.ts.net:40888/identity-check/
- Local API: 127.0.0.1:40886; daemon: 127.0.0.1:40887.
- Data: `/home/ubuntu/.local/share/bb-service-preview` (fresh, no copied normal data).
- Unit: `bb-service-preview.service` (transient user unit).
- Exact repository pins: `PREVIEW.json`; core source tree `c30b12255a7f9f098e7bf9b6d1999410e7956785`.

The preview now enables the bundled interactive tools and the reviewed everyday
organization plugins. Exact running/configuration/held status is recorded in
`preview/bundled-activation.json`, `preview/org-plugin-activation.json`, and
`preview/PREVIEW-TESTING.md`. Outbound integrations, account routing and extra
remote-access setup remain explicit holds. Normal state and credentials were not
copied. Cole's existing preview test thread is preserved.

The provider refreshes its directory from real local Tailscale status. It accepts
only the configured owned Serve authority and host-captured proxy ingress, then
maps the authenticated Serve login to one current directory record. The diagnostic
page sends no identity headers and uses the existing public self-profile RPC.

Open the identity-check URL from your own Tailnet device. It should show your name
and login with “Tailnet identity verified.” Try another signed-in Tailnet user to
check that the displayed identity changes. A tagged machine has no user identity;
server-side probes are not evidence of Cole's browser authentication. The preview
uses private Tailscale Serve, never Funnel, and does not change `svc:bb`.

## Testing

[Run real-user plugin checks](https://rosetta.banjo-tint.ts.net:40888/identity-check/workflows.html) from your Tailnet device. The server-side Playwright harness and coverage limits are documented in `preview/ui-smoke/README.md`.

## Operations

Inspect: `systemctl --user status bb-service-preview.service`

Logs: `journalctl --user -u bb-service-preview.service -n 100 --no-pager`

Stop: `systemctl --user stop bb-service-preview.service`

Start after a stop (first confirm the preview unit/ports are unowned):

```sh
systemd-run --user --unit=bb-service-preview \
  --description='Isolated BB Tailnet identity preview' \
  --property=WorkingDirectory=/home/ubuntu/bb-service/fork/build/bb \
  --property=KillMode=control-group --property=TimeoutStopSec=20 \
  --property=Restart=no /usr/bin/python3 /home/ubuntu/bb-service/preview/launch.py
```

Preview CLI only: `python3 /home/ubuntu/bb-service/preview/cli.py plugin list`

Remove only this private route when the preview is no longer needed:
`tailscale serve --https=40888 off`. Do not reset all Serve configuration.

The launch wrapper strips inherited BB connection/auth/thread variables and uses
the supported production launcher with fixed new data/ports. The production
launcher owns server/daemon enrollment and process lifetime. State is retained on
stop. This is process/state isolation under the same Unix account, not a security
sandbox against trusted local administrators.

Ownership, configuration and verification receipts are in the preview data directory.
No preview state or credential belongs in Git. Keep source modifications visible;
do not automatically reset or replace any of the original dirty repositories.

## Shared SDK source receipt

The SDK sharing composition is recorded in `preview/sdk-sharing/commits.json`,
with checks in `preview/sdk-sharing/checks.json`. The archive required by relative
file dependencies is tracked in `sdk-artifacts/`. Keep it alongside the child
repositories. The branch is a preview/review receipt, not a normal-host pin.
Raw runtime inventories, browser captures and local test logs are intentionally
not committed; references to those files above describe local evidence.
