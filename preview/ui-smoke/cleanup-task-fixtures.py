import json,urllib.request
from pathlib import Path
root=Path(__file__).parent

def rpc(method,args):
 request=urllib.request.Request('http://127.0.0.1:40886/api/v1/plugins/tasks/rpc/'+method,data=json.dumps(args).encode(),headers={'Content-Type':'application/json'})
 envelope=json.load(urllib.request.urlopen(request))
 if not envelope.get('ok'):raise RuntimeError(envelope.get('error'))
 return envelope['result']

projects=rpc('listProjects',{})['projects']
for receipt in root.glob('runs/task-*/report.json'):
 report=json.loads(receipt.read_text());f=report['fixture']
 matches=[p for p in projects if p['name']==f['projectName'] and p['prefix']==f['prefix'] and p['linkedBbProjectId'] is None]
 if len(matches)!=1:continue
 p=matches[0];tasks=rpc('listTasks',{'projectId':p['id']})['tasks']
 if len(tasks)>1 or any(t['title']!=f['taskTitle'] for t in tasks):
  print('Preserved modified fixture',p['id']);continue
 result=rpc('deleteProject',{'projectId':p['id'],'force':bool(tasks)})
 if result.get('ok') and result.get('deleted'):
  report['cleanup']='Exact owned fixture removed through public plugin RPC (separate from UI assertions)';receipt.write_text(json.dumps(report,indent=2)+'\n');print('Removed owned fixture',p['id'])
 else:raise RuntimeError(result)
