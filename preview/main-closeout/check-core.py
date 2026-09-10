from pathlib import Path
import subprocess, os, json, time, tempfile
root=Path(__file__).resolve().parents[2]
source=root/'fork/build/bb'; out=Path(__file__).parent
env=os.environ.copy()
env['PATH']='/home/ubuntu/.local/share/mise/installs/node/22.21.1/bin:/home/ubuntu/.local/share/mise/installs/bun/1.3.14/bin:/home/ubuntu/.local/share/mise/installs/pnpm/9.15.0:/usr/local/bin:/usr/bin:/bin'
env.pop('BB_CLI',None)
fixture_tmp=tempfile.TemporaryDirectory(prefix='bb-core-tests-',dir='/var/tmp')
env['TMPDIR']=fixture_tmp.name
env['BB_THREAD_MANAGER_PLUGIN_ROOT']=str(root/'plugins/plugins/thread-manager')
packages=['@bb/server','@bb/app','@bb/cli','@bb/db','@bb/domain','@bb/thread-view','@bb/server-contract','@bb/sdk','@get-bb/plugin-sdk','@bb/host-daemon']
filters=['--filter='+name for name in packages]
commands=[['pnpm','install','--frozen-lockfile'],['pnpm','exec','turbo','run','typecheck',*filters,'--continue=always'],['pnpm','exec','turbo','run','test',*filters,'--concurrency=2','--continue=always','--env-mode=loose'],['pnpm','build']]
receipt={'sourceTree':(root/'fork/result-tree.lock').read_text().strip(),'node':subprocess.check_output(['node','--version'],env=env,text=True).strip(),'packages':packages,'threadManagerFixture':'plugins/plugins/thread-manager','testEnvironment':'Turbo loose mode preserves the explicit fixture root; private TMPDIR under /var/tmp avoids unrelated /tmp/.git ancestry','checks':[]}
failed=False
for index,cmd in enumerate(commands):
    logpath=out/f'core-{index}.log'; started=time.time()
    with logpath.open('w') as log:
        p=subprocess.run(cmd,cwd=source,env=env,stdout=log,stderr=subprocess.STDOUT)
    result={'command':cmd,'exitCode':p.returncode,'elapsedSeconds':round(time.time()-started,2),'log':logpath.name}
    receipt['checks'].append(result)
    (out/'core-checks.json').write_text(json.dumps(receipt,indent=2)+'\n')
    print(json.dumps(result),flush=True)
    failed=failed or p.returncode!=0
    if index==0 and p.returncode:break
fixture_tmp.cleanup()
raise SystemExit(1 if failed else 0)
