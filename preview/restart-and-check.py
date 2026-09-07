import subprocess,time,json,urllib.request
from pathlib import Path
state=Path('/home/ubuntu/.local/share/bb-service-preview')
normal=subprocess.check_output(['systemctl','--user','show','bb.service','--property=MainPID','--value'],text=True).strip()
threads=json.load(urllib.request.urlopen('http://127.0.0.1:40886/api/v1/threads'))
active=[t['id'] for t in threads if t.get('status') not in ('idle','completed','archived','error')]
if active:raise SystemExit('Preview threads active; restart deferred: '+str(active))
subprocess.run(['systemctl','--user','restart','bb-service-preview.service'],check=True)
for attempt in range(90):
 try:
  with urllib.request.urlopen('http://127.0.0.1:40886/health',timeout=2) as r:
   if r.status==200:break
 except Exception:pass
 time.sleep(1)
else:raise SystemExit('Preview health timeout')
assert subprocess.check_output(['systemctl','--user','show','bb.service','--property=MainPID','--value'],text=True).strip()==normal
print(json.dumps({'previewHealthy':True,'normalPidUnchanged':normal}),flush=True)
