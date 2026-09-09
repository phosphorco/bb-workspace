from pathlib import Path
import subprocess, json, urllib.request, hashlib
root=Path(__file__).resolve().parents[2];out=Path(__file__).parent
before=json.loads((out/'runtime-before.json').read_text())
def pid(unit):return subprocess.check_output(['systemctl','--user','show',unit,'--property=MainPID','--value'],text=True).strip()
normal=pid('bb.service');preview=pid('bb-service-preview.service')
assert normal==before['services']['bb.service']['MainPID'],'Normal service changed'
assert preview!='0' and preview!=before['services']['bb-service-preview.service']['MainPID'],'Preview did not restart'
checks=[]
for path in ['/health','/','/settings/p6rIdentity','/api/v1/system/p6rIdentity']:
    with urllib.request.urlopen('http://127.0.0.1:40886'+path,timeout=10) as response:
        body=response.read();assert response.status==200,path
        item={'path':path,'status':response.status}
        if path.endswith('/p6rIdentity') and path.startswith('/api/'):
            status=json.loads(body)['status'];assert status in ['ready','unauthenticated','unavailable','unconfigured'];item['identityStatus']=status
        checks.append(item)
plugins=json.loads(subprocess.check_output(['python3',str(root/'preview/cli.py'),'plugin','list','--json'],text=True))['plugins']
old=json.loads((out/'plugins-runtime-before.json').read_text())['plugins']
expected={p['id'] for p in old if p['enabled']}
current={p['id'] for p in plugins if p['enabled']}
assert expected==current,'Enabled plugin set changed'
assert all(p['status']=='running' for p in plugins if p['enabled']),'An enabled plugin is not running'
artifacts=['apps/server/dist/start-server.js','apps/app/dist/index.html','apps/host-daemon/dist/index.js','apps/cli/dist/index.js']
receipt={'sourceTree':(root/'fork/result-tree.lock').read_text().strip(),'normalPidUnchanged':normal,'previewPid':preview,'http':checks,'enabledPlugins':len(current),'plugins':[{'id':p['id'],'status':p['status'],'enabled':p['enabled'],'rootDir':p.get('rootDir'),'version':p.get('version')} for p in plugins],'artifactSha256':{path:hashlib.sha256((root/'fork/build/bb'/path).read_bytes()).hexdigest() for path in artifacts},'scope':'Local preview runtime and enabled-plugin readiness; identity status is observed, not fabricated human admission.'}
(out/'runtime-after.json').write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps({'previewHealthy':True,'enabledPlugins':len(current),'normalPidUnchanged':normal,'identityStatus':checks[-1].get('identityStatus')}))
