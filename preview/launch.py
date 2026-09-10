from pathlib import Path
import json,os,socket
root=Path('/home/ubuntu/bb-service/fork/build/bb')
state=Path('/home/ubuntu/.local/share/bb-service-preview')
if not (state/'prepared.json').is_file():raise SystemExit('Preview state has not been prepared')
for port in (40886,40887):
 s=socket.socket();s.setsockopt(socket.SOL_SOCKET,socket.SO_REUSEADDR,1);s.bind(('127.0.0.1',port));s.close()
node='/home/ubuntu/.local/share/mise/installs/node/22.19.0/bin/node'
env={k:os.environ[k] for k in ('HOME','USER','LOGNAME','LANG','XDG_RUNTIME_DIR','DBUS_SESSION_BUS_ADDRESS') if k in os.environ}
env['PATH']='/home/ubuntu/.local/share/mise/installs/node/22.19.0/bin:/home/ubuntu/.local/share/mise/installs/bun/1.3.14/bin:/home/ubuntu/.local/share/mise/installs/pnpm/9.15.0:/home/ubuntu/.local/share/mise/installs/github-cli/2.94.0/gh_2.94.0_linux_amd64/bin:/usr/local/bin:/usr/bin:/bin'
env.update(json.loads((state/'launch-env.json').read_text()))
os.chdir(root)
os.execve(node,[node,'--conditions=source','--import',str(root/'node_modules/tsx/dist/loader.mjs'),str(root/'scripts/start-bb.mjs'),'--data-dir',str(state),'--server-bind-host','127.0.0.1','--server-port','40886','--host-daemon-port','40887'],env)
