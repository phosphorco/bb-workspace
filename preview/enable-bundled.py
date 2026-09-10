import subprocess,json,time
from pathlib import Path
root=Path(__file__).resolve().parent
excluded={"account-pool":"Changes provider account routing; requires deliberate account configuration", "connect":"Would provision another remote-access ingress; existing private Serve is selected", "keep-awake":"Host power policy, no Linux UI benefit", "memory":"Changes agent memory behavior; defer until basic preview stable"}
items=json.loads((root/'plugins-before-ui-smoke.json').read_text())["plugins"]
results=[]
for p in items:
 if not p['source'].startswith('builtin:'): continue
 if p['id'] in excluded:
  results.append({'id':p['id'],'outcome':'held','reason':excluded[p['id']]});continue
 try:
  r=subprocess.run(['python3',str(root/'cli.py'),'plugin','enable',p['id']],capture_output=True,text=True,timeout=120)
  row={'id':p['id'],'outcome':'enabled' if r.returncode==0 else 'failed','output':(r.stdout+r.stderr)[-2400:]}
 except subprocess.TimeoutExpired:
  row={'id':p['id'],'outcome':'timeout'}
 results.append(row);print(json.dumps(row),flush=True)
 (root/'bundled-activation.json').write_text(json.dumps(results,indent=2)+'\n')
