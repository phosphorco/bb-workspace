from pathlib import Path
import subprocess, tempfile, os, json, hashlib, sys
root=Path(__file__).resolve().parents[2]
fork=root/'fork'; source=fork/'build/bb'
manifest=json.loads(Path(sys.argv[1]).read_text())
paths=manifest['paths']; title=manifest['title']; name=manifest['patch']
if not paths or any(Path(p).is_absolute() or '..' in Path(p).parts for p in paths): raise SystemExit('Invalid source paths')
if Path(name).name != name or (fork/'patches'/name).exists(): raise SystemExit('Invalid or existing patch')
base=(fork/'result-tree.lock').read_text().strip()
if base != manifest['baseTree']: raise SystemExit('Sealing base changed')
def git(args, *, data=None, env=None):
    return subprocess.check_output(['git','-c','user.name=Codex','-c','user.email=codex@openai.com','-C',str(source),*args],input=data,env=env)
with tempfile.TemporaryDirectory(prefix='bb-seal-') as tmp:
    env={**os.environ,'GIT_INDEX_FILE':str(Path(tmp)/'index')}
    git(['read-tree',base],env=env)
    git(['add','--',*paths],env=env)
    git(['diff','--cached','--check',base],env=env)
    changed=git(['diff','--cached','--name-only',base],env=env).decode().splitlines()
    if not changed or set(changed)-set(paths): raise SystemExit('Unexpected sealed footprint')
    tree=git(['write-tree'],env=env).decode().strip()
    parent=git(['commit-tree',base],data=b'Selected source before corrective patch\n').decode().strip()
    commit=git(['commit-tree',tree,'-p',parent],data=(title+'\n').encode()).decode().strip()
    patch=git(['format-patch','-1','--stdout','--full-index','--binary',commit])
    (fork/'patches'/name).write_bytes(patch)
    series=fork/'patches/series'; series.write_text(series.read_text().rstrip()+'\n'+name+'\n')
    names=[line for line in series.read_text().splitlines() if line and not line.startswith('#')]
    (fork/'patches/sha256').write_text(''.join(hashlib.sha256((fork/'patches'/p).read_bytes()).hexdigest()+'  '+p+'\n' for p in names))
    (fork/'result-tree.lock').write_text(tree+'\n')
    receipt={'baseTree':base,'resultTree':tree,'patch':name,'patchSha256':hashlib.sha256(patch).hexdigest(),'paths':changed,'sourceSha256':{p:hashlib.sha256((source/p).read_bytes()).hexdigest() for p in changed}}
    (Path(__file__).parent/(name+'.json')).write_text(json.dumps(receipt,indent=2)+'\n')
    print(json.dumps(receipt,indent=2))
