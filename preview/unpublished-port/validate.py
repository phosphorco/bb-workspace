"""Run the repository's required checks and preserve bounded handoff evidence."""
import json
import os
from pathlib import Path
import subprocess
import sys

root = Path(__file__).resolve().parents[2]
repo = sys.argv[1]
environment = dict(os.environ)
# Keep native-addon installation and all test/build processes on one runtime;
# the operator's global mise selection can change while this work is running.
environment["PATH"] = "/home/ubuntu/.local/share/mise/installs/node/22.21.1/bin:" + environment["PATH"]
commands = {
    "plugins": [
        ["bun", "install", "--frozen-lockfile"],
        *[["bun", "run", name] for name in ("sync:check", "references:check", "sdk-types:check", "typecheck", "test", "build")],
    ],
    "community-plugins": [
        ["npm", "ci"],
        *[["npm", "run", name] for name in ("test", "typecheck", "build")],
    ],
}[repo]
receipts = []
for index, command in enumerate(commands):
    log = root / "preview/unpublished-port" / f"{repo}-{index}.log"
    with log.open("w") as output:
        result = subprocess.run(command, cwd=root / repo, env=environment, stdout=output, stderr=subprocess.STDOUT)
    receipts.append({"command": command, "exitCode": result.returncode, "log": log.name})
    print(json.dumps(receipts[-1]), flush=True)
    (root / "preview/unpublished-port" / f"{repo}-checks.json").write_text(json.dumps(receipts, indent=2) + "\n")
    if result.returncode:
        print("\n".join(log.read_text(errors="replace").splitlines()[-50:]), flush=True)
        sys.exit(result.returncode)
