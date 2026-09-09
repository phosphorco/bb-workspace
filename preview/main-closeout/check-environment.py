import os,subprocess,tempfile
from pathlib import Path
root=Path(__file__).resolve().parents[2];source=root/'fork/build/bb'
env=os.environ.copy();env['PATH']='/home/ubuntu/.local/share/mise/installs/node/22.21.1/bin:/home/ubuntu/.local/share/mise/installs/bun/1.3.14/bin:/home/ubuntu/.local/share/mise/installs/pnpm/9.15.0:/usr/local/bin:/usr/bin:/bin';env.pop('BB_CLI',None);env['BB_THREAD_MANAGER_PLUGIN_ROOT']=str(root/'plugins/plugins/thread-manager')
with tempfile.TemporaryDirectory(prefix='bb-core-tests-',dir='/var/tmp') as tmp:
 env['TMPDIR']=tmp
 with (root/'preview/main-closeout/environment-focused.log').open('w') as log:
  p=subprocess.run(['pnpm','exec','turbo','run','test','--filter=@bb/server','--filter=@bb/app','--filter=@bb/host-daemon','--env-mode=loose','--continue=always','--','CommandPalette.test.tsx','thread-manager-native-parity.test.ts','command-discovery.test.ts','--passWithNoTests'],cwd=source,env=env,stdout=log,stderr=subprocess.STDOUT)
 raise SystemExit(p.returncode)
