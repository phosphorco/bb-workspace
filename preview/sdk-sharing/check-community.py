import json, os, pathlib, subprocess
root=pathlib.Path('/home/ubuntu/bb-service/community-plugins')
here=pathlib.Path(__file__).resolve().parent
env=dict(os.environ)
env.pop('BB_CLI',None)
env['PATH']='/home/ubuntu/.local/share/mise/installs/node/22.19.0/bin:/usr/bin:/bin'
cli='/home/ubuntu/bb-service/fork/build/bb/apps/cli/bin/bb'
with (here/'community-final-node22.log').open('w') as log:
    for cmd in [['npm','ci'],['npm','run','typecheck'],['npm','run','test']]:
        log.write(json.dumps(cmd)+'\n');log.flush()
        subprocess.run(cmd,cwd=root,env=env,stdout=log,stderr=subprocess.STDOUT,check=True)
    for leaf in sorted((root/'plugins').iterdir()):
        if not (leaf/'package.json').exists():continue
        cmd=[cli,'plugin','build','.']
        log.write(json.dumps({'cwd':str(leaf),'command':cmd})+'\n');log.flush()
        subprocess.run(cmd,cwd=leaf,env=env,stdout=log,stderr=subprocess.STDOUT,check=True)
    subprocess.run(['git','diff','HEAD','--check'],cwd=root,env=env,stdout=log,stderr=subprocess.STDOUT,check=True)
    copies=list((root/'plugins').glob('*/types/bb-plugin-sdk*.d.ts'))
    if copies:raise RuntimeError(str(copies))
    log.write('ALL CHECKS PASSED; NO SDK DECLARATION COPIES\n')
print('community npm ci/typecheck/test and all seven selected CLI builds passed')
