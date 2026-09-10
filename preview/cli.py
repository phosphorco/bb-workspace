from pathlib import Path
import json,os,sys
root=Path('/home/ubuntu/bb-service/fork/build/bb');state=Path('/home/ubuntu/.local/share/bb-service-preview')
node='/home/ubuntu/.local/share/mise/installs/node/22.19.0/bin/node'
env={k:os.environ[k] for k in ('HOME','USER','LOGNAME','LANG','XDG_RUNTIME_DIR','DBUS_SESSION_BUS_ADDRESS') if k in os.environ}
env['PATH']='/home/ubuntu/.local/share/mise/installs/node/22.19.0/bin:/home/ubuntu/.local/share/mise/installs/bun/1.3.14/bin:/home/ubuntu/.local/share/mise/installs/github-cli/2.94.0/gh_2.94.0_linux_amd64/bin:/usr/local/bin:/usr/bin:/bin'
env.update(json.loads((state/'launch-env.json').read_text()))
os.chdir(root);os.execve(node,[node,str(root/'apps/cli/dist/index.js'),*sys.argv[1:]],env)
