from pathlib import Path
import subprocess, os, json, sys, time
root=Path(__file__).resolve().parents[2]
kind=sys.argv[1]
if kind not in ('plugins','community-plugins'): raise SystemExit('Unknown package set')
env=os.environ.copy()
env['PATH']='/home/ubuntu/.local/share/mise/installs/node/22.21.1/bin:/home/ubuntu/.local/share/mise/installs/bun/1.3.14/bin:/home/ubuntu/.local/share/mise/installs/pnpm/9.15.0:/usr/local/bin:/usr/bin:/bin'
env.pop('BB_CLI',None)
commands=([['bun','install','--frozen-lockfile']]+[['bun','run',x] for x in ['references:sync','sync:check','references:check','sdk-types:check','typecheck','test','build','sdk-types:check']]) if kind=='plugins' else [['npm','ci'],['npm','run','test'],['npm','run','typecheck'],['npm','run','build']]
start=int(sys.argv[2]) if len(sys.argv)>2 else 0
label=sys.argv[3] if len(sys.argv)>3 else 'checks'
out=Path(__file__).parent
receipt={'repository':kind,'head':subprocess.check_output(['git','rev-parse','HEAD'],cwd=root/kind,text=True).strip(),'node':subprocess.check_output(['node','--version'],env=env,text=True).strip(),'checks':[]}
for index,cmd in enumerate(commands):
    if index < start: continue
    path=out/f'{kind}-{label}-{index}.log'; started=time.time()
    with path.open('w') as log:
        proc=subprocess.run(cmd,cwd=root/kind,env=env,stdout=log,stderr=subprocess.STDOUT)
    result={'command':cmd,'exitCode':proc.returncode,'elapsedSeconds':round(time.time()-started,2),'log':path.name}
    receipt['checks'].append(result)
    (out/f'{kind}-{label}.json').write_text(json.dumps(receipt,indent=2)+'\n')
    print(json.dumps(result),flush=True)
    if proc.returncode: raise SystemExit(proc.returncode)
