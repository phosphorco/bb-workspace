"""Verify Rosetta's credential-free preview installation; never contact Slack."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import time
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[2]
CLI = ["python3", str(ROOT / "preview/cli.py")]
HEALTH = "http://127.0.0.1:40886/api/v1/plugins/rosetta-slack/http/health"


def cli(*args):
    return json.loads(subprocess.check_output([*CLI, *args], text=True))


def normal_pid():
    return subprocess.check_output(
        ["systemctl", "--user", "show", "bb.service", "-p", "MainPID", "--value"],
        text=True,
    ).strip()


def health():
    try:
        response = urllib.request.urlopen(HEALTH, timeout=10)
    except urllib.error.HTTPError as error:
        response = error
    with response:
        code, body = response.status, json.load(response)
    assert code == 503 and body["status"] == "unavailable", (code, body)
    assert body["reasons"] == ["Slack transport is unconfigured."], body
    assert all(body[key] == 0 for key in (
        "queued", "retrying", "failedDispatches", "unresolvedWorkers",
        "pendingDeliveries", "deadLetters",
    )), body
    assert len(body["lanes"]) == 9, body
    return {"httpStatus": code, **body}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--reload", action="store_true")
    parser.add_argument("--expected-normal-pid")
    options = parser.parse_args()
    before_pid = normal_pid()
    assert before_pid != "0", "Normal service is not running"
    if options.expected_normal_pid:
        assert before_pid == options.expected_normal_pid, "Normal service PID changed"
    before = cli("plugin", "list", "--json")["plugins"]
    selected = next(plugin for plugin in before if plugin["id"] == "rosetta-slack")
    assert selected["rootDir"] == str(ROOT / "plugins/plugins/rosetta-slack"), selected
    assert selected["status"] == "running" and selected["enabled"], selected
    assert selected["app"]["bundle"]["sdkVersion"] == "0.4.47", selected
    initial_health = health()
    if options.reload:
        result = cli("plugin", "reload", "rosetta-slack", "--json")
        assert result["ok"], result
    deadline = time.monotonic() + 20
    while True:
        after = cli("plugin", "list", "--json")["plugins"]
        unhealthy = [p["id"] for p in after if p["enabled"] and p["status"] != "running"]
        if not unhealthy:
            break
        assert time.monotonic() < deadline, unhealthy
        time.sleep(1)
    assert {p["id"] for p in before if p["enabled"]} == {p["id"] for p in after if p["enabled"]}
    final_health = health()
    command = subprocess.run([*CLI, "rosetta-slack", "health"], text=True, capture_output=True)
    assert command.returncode == 1, command.stderr
    cli_health = json.loads(command.stdout)
    assert cli_health["status"] == final_health["status"]
    assert cli_health["reasons"] == final_health["reasons"]
    assert normal_pid() == before_pid, "Normal service changed during verification"
    artifacts = ["server.js", "app.js", "app.css"]
    receipt = {
        "checkedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "scope": "Real SDK 0.4.47 preview load/reload and readiness; no Slack credentials or sends.",
        "normalPidUnchanged": before_pid,
        "reloaded": options.reload,
        "enabledRunningPlugins": len([p for p in after if p["enabled"]]),
        "source": selected["rootDir"],
        "appSdkVersion": selected["app"]["bundle"]["sdkVersion"],
        "healthBefore": initial_health,
        "healthAfter": final_health,
        "cliHealthExitCode": command.returncode,
        "artifactSha256": {name: hashlib.sha256(
            (ROOT / "plugins/plugins/rosetta-slack/dist" / name).read_bytes()
        ).hexdigest() for name in artifacts},
    }
    (Path(__file__).parent / "runtime.json").write_text(json.dumps(receipt, indent=2) + "\n")
    print(json.dumps({key: receipt[key] for key in (
        "checkedAt", "normalPidUnchanged", "reloaded", "enabledRunningPlugins", "cliHealthExitCode",
    )}))


if __name__ == "__main__":
    main()
